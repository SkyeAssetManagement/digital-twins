/**
 * Survey Data Manager - Phase 3X Database Layer
 * 
 * Comprehensive API for managing all survey data and analysis results
 * Provides high-level abstraction over the normalized database schema
 * 
 * Key Features:
 * - Survey ingestion and metadata storage
 * - Column detection result persistence
 * - Response data normalization and storage
 * - Analysis result tracking and retrieval
 * - Performance optimization and caching
 * - Complete audit trail maintenance
 */

import pg from 'pg';
const { Pool } = pg;

export class SurveyDataManager {
    constructor(options = {}) {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 30000,
            ...options
        });
        
        this.cache = new Map(); // Simple in-memory cache
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }
    
    /**
     * ===================================================
     * SURVEY MANAGEMENT METHODS
     * ===================================================
     */
    
    /**
     * Create a new survey record
     */
    async createSurvey(surveyData) {
        const {
            name,
            displayName,
            description,
            targetDemographic,
            businessDescription,
            originalFilename,
            fileSizeBytes,
            totalColumns,
            totalResponses,
            metadata = {}
        } = surveyData;
        
        try {
            const result = await this.pool.query(`
                INSERT INTO surveys (
                    name, display_name, description, target_demographic, 
                    business_description, original_filename, file_size_bytes,
                    total_columns, total_responses, metadata, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'uploaded')
                RETURNING *
            `, [
                name, displayName, description, targetDemographic,
                businessDescription, originalFilename, fileSizeBytes,
                totalColumns, totalResponses, JSON.stringify(metadata)
            ]);
            
            console.log(`✅ Created survey: ${name} (ID: ${result.rows[0].id})`);
            return result.rows[0];
            
        } catch (error) {
            console.error('❌ Failed to create survey:', error);
            throw new Error(`Survey creation failed: ${error.message}`);
        }
    }
    
    /**
     * Get survey by name or ID
     */
    async getSurvey(identifier) {
        const cacheKey = `survey_${identifier}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        try {
            const isId = Number.isInteger(Number(identifier));
            const query = isId ? 'SELECT * FROM surveys WHERE id = $1' : 'SELECT * FROM surveys WHERE name = $1';
            
            const result = await this.pool.query(query, [identifier]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const survey = result.rows[0];
            survey.metadata = typeof survey.metadata === 'string' ? JSON.parse(survey.metadata) : survey.metadata;
            
            this.setCache(cacheKey, survey);
            return survey;
            
        } catch (error) {
            console.error('❌ Failed to get survey:', error);
            throw new Error(`Survey retrieval failed: ${error.message}`);
        }
    }
    
    /**
     * Update survey status and metadata
     */
    async updateSurveyStatus(surveyId, status, additionalData = {}) {
        try {
            const result = await this.pool.query(`
                UPDATE surveys 
                SET status = $2, last_analyzed = CURRENT_TIMESTAMP,
                    metadata = metadata || $3::jsonb,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `, [surveyId, status, JSON.stringify(additionalData)]);
            
            console.log(`✅ Updated survey ${surveyId} status to: ${status}`);
            
            // Clear cache
            this.clearCachePattern(`survey_${surveyId}`);
            
            return result.rows[0];
            
        } catch (error) {
            console.error('❌ Failed to update survey status:', error);
            throw new Error(`Survey status update failed: ${error.message}`);
        }
    }
    
    /**
     * Get survey by ID (alias for getSurvey)
     */
    async getSurveyById(surveyId) {
        return this.getSurvey(surveyId);
    }
    
    /**
     * ===================================================
     * COLUMN MANAGEMENT METHODS
     * ===================================================
     */
    
    /**
     * Store column definitions for a survey
     */
    async storeColumnDefinitions(surveyId, columns) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Clear existing columns for this survey
            await client.query('DELETE FROM survey_columns WHERE survey_id = $1', [surveyId]);
            
            // Insert new column definitions
            for (let i = 0; i < columns.length; i++) {
                const column = columns[i];
                await client.query(`
                    INSERT INTO survey_columns (
                        survey_id, column_index, column_name, short_name, 
                        data_type, sample_values, unique_value_count, null_count
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    surveyId,
                    column.index || i,
                    column.longName || column.name,
                    column.shortName || column.short_name,
                    column.dataType || 'text',
                    JSON.stringify(column.sampleValues || []),
                    column.uniqueValueCount || 0,
                    column.nullCount || 0
                ]);
            }
            
            await client.query('COMMIT');
            console.log(`✅ Stored ${columns.length} column definitions for survey ${surveyId}`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Failed to store column definitions:', error);
            throw new Error(`Column storage failed: ${error.message}`);
        } finally {
            client.release();
        }
    }
    
    /**
     * Store column detection results from Phase 3A
     */
    async storeColumnDetectionResults(surveyId, detectionResults) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            for (const result of detectionResults) {
                // Get column ID
                const columnResult = await client.query(
                    'SELECT id FROM survey_columns WHERE survey_id = $1 AND column_name = $2',
                    [surveyId, result.column]
                );
                
                if (columnResult.rows.length === 0) {
                    console.warn(`⚠️  Column not found: ${result.column}`);
                    continue;
                }
                
                const columnId = columnResult.rows[0].id;
                
                await client.query(`
                    INSERT INTO column_detection_results (
                        survey_id, column_id, detection_method, is_open_ended,
                        confidence_score, reasoning, indicator_matched,
                        sample_analysis, processing_time_ms, llm_model_used
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (survey_id, column_id) 
                    DO UPDATE SET
                        detection_method = EXCLUDED.detection_method,
                        is_open_ended = EXCLUDED.is_open_ended,
                        confidence_score = EXCLUDED.confidence_score,
                        reasoning = EXCLUDED.reasoning,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    surveyId, columnId, result.method, true, // Assuming detected columns are open-ended
                    result.confidence, result.reasoning, result.indicator || null,
                    result.sampleAnalysis || null, null, 'claude-opus-4-1'
                ]);
                
                // Update column as open-ended
                await client.query(
                    'UPDATE survey_columns SET is_open_ended = true WHERE id = $1',
                    [columnId]
                );
            }
            
            await client.query('COMMIT');
            console.log(`✅ Stored detection results for ${detectionResults.length} columns`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Failed to store column detection results:', error);
            throw new Error(`Detection result storage failed: ${error.message}`);
        } finally {
            client.release();
        }
    }
    
    /**
     * ===================================================
     * RESPONSE DATA METHODS
     * ===================================================
     */
    
    /**
     * Store survey responses in normalized format
     */
    async storeSurveyResponses(surveyId, responseData) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Get column mappings for this survey
            const columnsResult = await client.query(
                'SELECT id, column_name, column_index FROM survey_columns WHERE survey_id = $1',
                [surveyId]
            );
            
            const columnMap = new Map();
            columnsResult.rows.forEach(col => {
                columnMap.set(col.column_name, col.id);
                columnMap.set(col.column_index, col.id);
            });
            
            console.log(`📊 Processing ${responseData.length} survey responses...`);
            
            for (let i = 0; i < responseData.length; i++) {
                const responseRow = responseData[i];
                
                // Create response record
                const responseResult = await client.query(`
                    INSERT INTO survey_responses (
                        survey_id, respondent_id, response_index, submission_date, completion_status
                    ) VALUES ($1, $2, $3, $4, 'complete')
                    RETURNING id
                `, [
                    surveyId,
                    responseRow.respondent_id || `respondent_${i}`,
                    i,
                    responseRow.submission_date || new Date()
                ]);
                
                const responseId = responseResult.rows[0].id;
                
                // Store individual response values
                for (const [columnKey, value] of Object.entries(responseRow)) {
                    if (columnKey.startsWith('_') || ['respondent_id', 'submission_date'].includes(columnKey)) {
                        continue; // Skip metadata columns
                    }
                    
                    const columnId = columnMap.get(columnKey) || columnMap.get(parseInt(columnKey));
                    if (!columnId) {
                        console.warn(`⚠️  Column mapping not found: ${columnKey}`);
                        continue;
                    }
                    
                    if (value !== null && value !== undefined && value !== '') {
                        await client.query(`
                            INSERT INTO response_values (
                                response_id, column_id, value_text, 
                                value_numeric, value_boolean, is_null
                            ) VALUES ($1, $2, $3, $4, $5, false)
                        `, [
                            responseId, columnId, String(value),
                            isNaN(Number(value)) ? null : Number(value),
                            typeof value === 'boolean' ? value : null
                        ]);
                    } else {
                        await client.query(`
                            INSERT INTO response_values (response_id, column_id, is_null)
                            VALUES ($1, $2, true)
                        `, [responseId, columnId]);
                    }
                }
                
                // Progress logging
                if ((i + 1) % 100 === 0) {
                    console.log(`📈 Progress: ${i + 1}/${responseData.length} responses processed`);
                }
            }
            
            await client.query('COMMIT');
            console.log(`✅ Successfully stored ${responseData.length} survey responses`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Failed to store survey responses:', error);
            throw new Error(`Response storage failed: ${error.message}`);
        } finally {
            client.release();
        }
    }
    
    /**
     * ===================================================
     * ANALYSIS RESULTS METHODS
     * ===================================================
     */
    
    /**
     * Store customer archetypes
     */
    async storeCustomerArchetypes(surveyId, archetypes) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Clear existing archetypes
            await client.query('DELETE FROM customer_archetypes WHERE survey_id = $1', [surveyId]);
            
            for (const archetype of archetypes) {
                await client.query(`
                    INSERT INTO customer_archetypes (
                        survey_id, archetype_name, archetype_slug, description,
                        demographics, behaviors, pain_points, preferences,
                        discriminatory_questions, population_percentage, confidence_score
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    surveyId,
                    archetype.name,
                    archetype.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                    archetype.description || '',
                    JSON.stringify(archetype.demographics || {}),
                    JSON.stringify(archetype.behaviors || {}),
                    JSON.stringify(archetype.pain_points || []),
                    JSON.stringify(archetype.preferences || []),
                    JSON.stringify(archetype.discriminatory_questions || []),
                    archetype.percentage || 0,
                    archetype.confidence || 0.8
                ]);
            }
            
            await client.query('COMMIT');
            console.log(`✅ Stored ${archetypes.length} customer archetypes`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Failed to store customer archetypes:', error);
            throw new Error(`Archetype storage failed: ${error.message}`);
        } finally {
            client.release();
        }
    }
    
    /**
     * Store semantic categorization results
     */
    async storeCategorizationResults(surveyId, categorizationResults) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Store semantic categories first
            const categories = Array.from(new Set(
                categorizationResults.categorizations.map(c => ({
                    name: c.category_name,
                    type: c.category_type,
                    description: c.category_description || ''
                }))
            ));
            
            const categoryIds = new Map();
            
            for (const category of categories) {
                // Try to find existing category
                const existingResult = await client.query(`
                    SELECT id FROM semantic_categories 
                    WHERE survey_id = $1 AND category_name = $2
                `, [surveyId, category.name]);
                
                let categoryId;
                if (existingResult.rows.length > 0) {
                    categoryId = existingResult.rows[0].id;
                } else {
                    // Create new category
                    const insertResult = await client.query(`
                        INSERT INTO semantic_categories (
                            survey_id, category_name, category_type, description, 
                            discovery_method, confidence_score
                        ) VALUES ($1, $2, $3, $4, 'llm_adaptive', 0.8)
                        RETURNING id
                    `, [surveyId, category.name, category.type, category.description]);
                    
                    categoryId = insertResult.rows[0].id;
                }
                
                categoryIds.set(category.name, categoryId);
            }
            
            // Store individual categorizations
            for (const categorization of categorizationResults.categorizations) {
                const categoryId = categoryIds.get(categorization.category_name);
                
                await client.query(`
                    INSERT INTO response_categorizations (
                        response_id, column_id, category_id, confidence_score, 
                        reasoning, llm_model_used
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (response_id, column_id, category_id) 
                    DO UPDATE SET 
                        confidence_score = EXCLUDED.confidence_score,
                        reasoning = EXCLUDED.reasoning,
                        processing_date = CURRENT_TIMESTAMP
                `, [
                    categorization.response_id,
                    categorization.column_id, 
                    categoryId,
                    categorization.confidence,
                    categorization.reasoning,
                    'claude-opus-4-1-20250805'
                ]);
            }
            
            await client.query('COMMIT');
            console.log(`✅ Stored ${categorizationResults.categorizations.length} categorization results`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Failed to store categorization results:', error);
            throw new Error(`Categorization storage failed: ${error.message}`);
        } finally {
            client.release();
        }
    }
    
    /**
     * Store discovered categories from adaptive discovery
     */
    async storeDiscoveredCategories(surveyId, categories) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Clear existing discovered categories
            await client.query(
                'DELETE FROM semantic_categories WHERE survey_id = $1 AND discovery_method = $2', 
                [surveyId, 'adaptive_discovery']
            );
            
            for (const category of categories) {
                await client.query(`
                    INSERT INTO semantic_categories (
                        survey_id, category_name, category_type, description,
                        business_relevance, discovery_method, confidence_score,
                        coverage_percentage
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    surveyId,
                    category.name,
                    category.type,
                    category.description,
                    category.business_relevance || '',
                    'adaptive_discovery',
                    category.confidence_score || 0.85,
                    category.expected_coverage || 0
                ]);
            }
            
            await client.query('COMMIT');
            console.log(`✅ Stored ${categories.length} discovered categories`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Failed to store discovered categories:', error);
            throw new Error(`Category storage failed: ${error.message}`);
        } finally {
            client.release();
        }
    }
    
    /**
     * Store category discovery session results
     */
    async storeCategoryDiscoveryResults(surveyId, sessionId, discoveryResults) {
        try {
            await this.pool.query(`
                UPDATE analysis_sessions 
                SET results_summary = $2
                WHERE id = $1
            `, [sessionId, JSON.stringify({
                categories_discovered: discoveryResults.categories.length,
                coverage_achieved: discoveryResults.qualityMetrics.coverage,
                quality_score: discoveryResults.qualityMetrics.overallQualityScore,
                refinement_iterations: discoveryResults.discovery.refinementIterations,
                business_alignment: discoveryResults.qualityMetrics.businessAlignment,
                category_types: discoveryResults.categories.reduce((acc, cat) => {
                    acc[cat.type] = (acc[cat.type] || 0) + 1;
                    return acc;
                }, {})
            })]);
            
            console.log(`✅ Stored discovery results for session: ${sessionId}`);
            
        } catch (error) {
            console.error('❌ Failed to store discovery results:', error);
            throw new Error(`Discovery results storage failed: ${error.message}`);
        }
    }
    
    /**
     * Store ROI target analysis results
     */
    async storeROITargetResults(surveyId, analysisResults) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Store feature importance results for ROI targets
            for (const target of analysisResults.analysis.roiTargets) {
                // Find the column ID for this target
                const columnResult = await client.query(`
                    SELECT id FROM survey_columns 
                    WHERE survey_id = $1 AND column_name = $2
                `, [surveyId, target.column_name]);
                
                if (columnResult.rows.length > 0) {
                    const columnId = columnResult.rows[0].id;
                    
                    await client.query(`
                        INSERT INTO feature_importance (
                            survey_id, column_id, importance_score, importance_rank,
                            analysis_type, target_variable, business_impact_score
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (survey_id, column_id, target_variable) 
                        DO UPDATE SET 
                            importance_score = EXCLUDED.importance_score,
                            importance_rank = EXCLUDED.importance_rank,
                            business_impact_score = EXCLUDED.business_impact_score
                    `, [
                        surveyId,
                        columnId,
                        target.business_impact_score,
                        analysisResults.analysis.roiTargets.indexOf(target) + 1,
                        'roi_target_analysis',
                        target.roi_type,
                        target.business_impact_score
                    ]);
                }
            }
            
            // Store Pain/Pleasure categorizations as semantic categories
            const allFeatures = [
                ...analysisResults.analysis.painPleasureCategories.pain.map(f => ({...f, category_type: 'pain'})),
                ...analysisResults.analysis.painPleasureCategories.pleasure.map(f => ({...f, category_type: 'pleasure'})),
                ...analysisResults.analysis.painPleasureCategories.other.map(f => ({...f, category_type: 'other'}))
            ];
            
            // Clear existing pain/pleasure categories
            await client.query(
                'DELETE FROM semantic_categories WHERE survey_id = $1 AND discovery_method = $2',
                [surveyId, 'pain_pleasure_analysis']
            );
            
            for (const feature of allFeatures) {
                await client.query(`
                    INSERT INTO semantic_categories (
                        survey_id, category_name, category_type, description,
                        discovery_method, confidence_score
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    surveyId,
                    feature.column_name || feature.name || 'unknown_feature',
                    feature.category_type,
                    feature.reasoning || `Feature categorized as ${feature.category_type}`,
                    'pain_pleasure_analysis',
                    feature.confidence || 0.8
                ]);
            }
            
            await client.query('COMMIT');
            console.log(`✅ Stored ROI target analysis results: ${analysisResults.analysis.roiTargets.length} targets, ${allFeatures.length} pain/pleasure features`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Failed to store ROI target results:', error);
            throw new Error(`ROI target results storage failed: ${error.message}`);
        } finally {
            client.release();
        }
    }
    
    /**
     * Store MDA feature analysis results
     */
    async storeMDAResults(surveyId, analysisResults) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Store feature importance results for each target
            for (const [targetName, targetResult] of Object.entries(analysisResults.targetAnalysis)) {
                for (const feature of targetResult.featureImportance.reported.total) {
                    // Find the column ID for this feature
                    const columnResult = await client.query(`
                        SELECT id FROM survey_columns 
                        WHERE survey_id = $1 AND (column_name = $2 OR short_name = $2)
                    `, [surveyId, feature.feature]);
                    
                    if (columnResult.rows.length > 0) {
                        const columnId = columnResult.rows[0].id;
                        
                        await client.query(`
                            INSERT INTO feature_importance (
                                survey_id, column_id, importance_score, importance_rank,
                                analysis_type, target_variable, statistical_significance,
                                business_impact_score
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                            ON CONFLICT (survey_id, column_id, target_variable, analysis_type) 
                            DO UPDATE SET 
                                importance_score = EXCLUDED.importance_score,
                                importance_rank = EXCLUDED.importance_rank,
                                statistical_significance = EXCLUDED.statistical_significance,
                                business_impact_score = EXCLUDED.business_impact_score
                        `, [
                            surveyId,
                            columnId,
                            feature.meanImportance,
                            feature.rank,
                            'mda_permutation',
                            targetName,
                            feature.isSignificant ? feature.confidenceInterval?.lower || 0 : 0,
                            feature.businessRelevance || 0.8
                        ]);
                    }
                }
            }
            
            // Store ML model performance results
            for (const [targetName, targetResult] of Object.entries(analysisResults.targetAnalysis)) {
                await client.query(`
                    INSERT INTO ml_model_results (
                        survey_id, model_type, target_variable, accuracy,
                        train_size, test_size, feature_count, training_time_seconds
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (survey_id, model_type, target_variable) 
                    DO UPDATE SET 
                        accuracy = EXCLUDED.accuracy,
                        train_size = EXCLUDED.train_size,
                        test_size = EXCLUDED.test_size,
                        feature_count = EXCLUDED.feature_count,
                        training_time_seconds = EXCLUDED.training_time_seconds
                `, [
                    surveyId,
                    'random_forest',
                    targetName,
                    targetResult.modelPerformance.baselineAccuracy,
                    targetResult.modelPerformance.trainSamples,
                    targetResult.modelPerformance.testSamples,
                    targetResult.featureImportance.totalFeatures,
                    Math.round(analysisResults.summary.processingTimeMs / 1000)
                ]);
            }
            
            await client.query('COMMIT');
            console.log(`✅ Stored MDA analysis results for ${Object.keys(analysisResults.targetAnalysis).length} targets`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Failed to store MDA results:', error);
            throw new Error(`MDA results storage failed: ${error.message}`);
        } finally {
            client.release();
        }
    }
    
    /**
     * Start an analysis session for audit tracking
     */
    async startAnalysisSession(surveyId, sessionType, phase, configuration = {}) {
        try {
            const result = await this.pool.query(`
                INSERT INTO analysis_sessions (
                    survey_id, session_type, phase, status, configuration
                ) VALUES ($1, $2, $3, 'running', $4)
                RETURNING id
            `, [surveyId, sessionType, phase, JSON.stringify(configuration)]);
            
            const sessionId = result.rows[0].id;
            console.log(`🔄 Started ${phase} analysis session: ${sessionId}`);
            
            return sessionId;
            
        } catch (error) {
            console.error('❌ Failed to start analysis session:', error);
            throw new Error(`Analysis session start failed: ${error.message}`);
        }
    }
    
    /**
     * Complete an analysis session
     */
    async completeAnalysisSession(sessionId, results = {}) {
        try {
            await this.pool.query(`
                UPDATE analysis_sessions 
                SET status = 'completed',
                    completed_at = CURRENT_TIMESTAMP,
                    processing_time_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)),
                    results_summary = $2
                WHERE id = $1
            `, [sessionId, JSON.stringify(results)]);
            
            console.log(`✅ Completed analysis session: ${sessionId}`);
            
        } catch (error) {
            console.error('❌ Failed to complete analysis session:', error);
            throw new Error(`Analysis session completion failed: ${error.message}`);
        }
    }
    
    /**
     * Fail an analysis session with error details
     */
    async failAnalysisSession(sessionId, errorMessage, additionalData = {}) {
        try {
            await this.pool.query(`
                UPDATE analysis_sessions 
                SET status = 'failed', 
                    completed_at = CURRENT_TIMESTAMP,
                    error_message = $2,
                    results_summary = $3
                WHERE id = $1
            `, [sessionId, errorMessage, JSON.stringify(additionalData)]);
            
            console.log(`❌ Failed analysis session: ${sessionId} - ${errorMessage}`);
            
        } catch (error) {
            console.error('❌ Failed to update failed analysis session:', error);
            throw new Error(`Analysis session failure update failed: ${error.message}`);
        }
    }
    
    /**
     * Find active analysis session for a survey
     */
    async findActiveSession(surveyId, sessionType) {
        try {
            const result = await this.pool.query(`
                SELECT id FROM analysis_sessions 
                WHERE survey_id = $1 AND session_type = $2 AND status = 'running'
                ORDER BY started_at DESC
                LIMIT 1
            `, [surveyId, sessionType]);
            
            return result.rows.length > 0 ? result.rows[0].id : null;
            
        } catch (error) {
            console.error('❌ Failed to find active session:', error);
            return null;
        }
    }
    
    /**
     * ===================================================
     * QUERY METHODS
     * ===================================================
     */
    
    /**
     * Get survey overview with statistics
     */
    async getSurveyOverview() {
        const cacheKey = 'survey_overview';
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        try {
            const result = await this.pool.query('SELECT * FROM survey_overview ORDER BY upload_date DESC');
            
            this.setCache(cacheKey, result.rows, 60000); // Cache for 1 minute
            return result.rows;
            
        } catch (error) {
            console.error('❌ Failed to get survey overview:', error);
            throw new Error(`Survey overview query failed: ${error.message}`);
        }
    }
    
    /**
     * Get open-ended responses for a survey
     */
    async getOpenEndedResponses(surveyIdentifier, columnName = null) {
        try {
            const survey = await this.getSurvey(surveyIdentifier);
            if (!survey) {
                throw new Error(`Survey not found: ${surveyIdentifier}`);
            }
            
            let query = `
                SELECT rdv.respondent_id, rdv.column_name, rdv.short_name, rdv.value_text
                FROM response_data_view rdv
                WHERE rdv.survey_name = $1 AND rdv.is_open_ended = true
            `;
            
            const params = [survey.name];
            
            if (columnName) {
                query += ' AND rdv.column_name = $2';
                params.push(columnName);
            }
            
            query += ' ORDER BY rdv.respondent_id, rdv.column_name';
            
            const result = await this.pool.query(query, params);
            return result.rows;
            
        } catch (error) {
            console.error('❌ Failed to get open-ended responses:', error);
            throw new Error(`Open-ended responses query failed: ${error.message}`);
        }
    }
    
    /**
     * Get customer archetypes for a survey
     */
    async getCustomerArchetypes(surveyIdentifier) {
        const cacheKey = `archetypes_${surveyIdentifier}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        try {
            const survey = await this.getSurvey(surveyIdentifier);
            if (!survey) {
                throw new Error(`Survey not found: ${surveyIdentifier}`);
            }
            
            const result = await this.pool.query(`
                SELECT * FROM archetype_analysis_view 
                WHERE survey_name = $1 
                ORDER BY population_percentage DESC
            `, [survey.name]);
            
            this.setCache(cacheKey, result.rows);
            return result.rows;
            
        } catch (error) {
            console.error('❌ Failed to get customer archetypes:', error);
            throw new Error(`Customer archetypes query failed: ${error.message}`);
        }
    }
    
    /**
     * ===================================================
     * UTILITY METHODS
     * ===================================================
     */
    
    /**
     * Simple cache management
     */
    getFromCache(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data;
    }
    
    setCache(key, data, timeout = null) {
        const expires = Date.now() + (timeout || this.cacheTimeout);
        this.cache.set(key, { data, expires });
    }
    
    clearCachePattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }
    
    /**
     * Health check method
     */
    async healthCheck() {
        try {
            const result = await this.pool.query('SELECT NOW() as server_time, version() as version');
            return {
                status: 'healthy',
                database: 'connected',
                server_time: result.rows[0].server_time,
                version: result.rows[0].version,
                cache_size: this.cache.size
            };
        } catch (error) {
            return {
                status: 'error',
                database: 'disconnected',
                error: error.message
            };
        }
    }
    
    /**
     * Cleanup and close connections
     */
    async close() {
        await this.pool.end();
        this.cache.clear();
        console.log('🔒 SurveyDataManager connection pool closed');
    }
}

// Export singleton instance
export default new SurveyDataManager();