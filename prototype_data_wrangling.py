#!/usr/bin/env python3
"""
LLM-Guided Data Wrangling Pipeline - Python Prototype
Test the complete pipeline before implementing in Vercel
"""

import json
import pandas as pd
import numpy as np
from anthropic import Anthropic
import os
from typing import Dict, List, Any
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class LLMDataWrangler:
    def __init__(self, api_key: str):
        self.anthropic = Anthropic(api_key=api_key)
        self.original_data = None
        self.working_data = None
        self.transformation_log = []
        
    def load_excel_data(self, file_path='data/datasets/mums/Detail_Parents Survey.xlsx'):
        """Load actual Excel data from the project"""
        try:
            logger.info(f"Loading Excel file: {file_path}")
            df = pd.read_excel(file_path, header=None)
            
            # Convert DataFrame to list of lists
            self.original_data = df.values.tolist()
            
            # Replace NaN values with empty strings
            for row in self.original_data:
                for i, cell in enumerate(row):
                    if pd.isna(cell):
                        row[i] = ''
                    else:
                        row[i] = str(cell)
            
            self.working_data = [row[:] for row in self.original_data]  # Deep copy
            logger.info(f"Loaded Excel data: {len(self.original_data)} rows, {len(self.original_data[0])} columns")
            
            return {'success': True, 'rows': len(self.original_data), 'columns': len(self.original_data[0])}
            
        except Exception as e:
            logger.error(f"Failed to load Excel file: {e}")
            return {'success': False, 'error': str(e)}
        
    def get_llm_analysis(self, max_retries=3):
        """Get LLM analysis with executable transformation plan"""
        
        # For large datasets, sample strategically: first 5 rows + first 20 columns
        sample_data = []
        max_sample_cols = 20  # Limit columns for LLM analysis
        
        for i, row in enumerate(self.working_data[:5]):
            # Take first 20 columns + sample of remaining columns to show structure
            if len(row) > max_sample_cols:
                sample_row = row[:max_sample_cols] + ['...'] + row[-3:] if len(row) > max_sample_cols + 3 else row[:max_sample_cols]
            else:
                sample_row = row
            sample_data.append(sample_row)
        
        # Build the prompt with sampled data
        data_sample = "\n".join([
            f"Row {i}: [{', '.join([f'\"{str(cell)[:30]}\"' for cell in row])}]" 
            for i, row in enumerate(sample_data)
        ])
        
        prompt = f"""# Data Structure Analysis for Survey Data Wrangling

You are analyzing survey data to create an EXECUTABLE cleaning plan with specific instructions.

## Data Sample (first 5 rows):
{data_sample}

## Analysis Parameters:
- Total rows: {len(self.working_data)}
- Total columns: {len(self.working_data[0]) if self.working_data else 0}

## Your Task:
Return a JSON object with EXECUTABLE cleaning instructions:

{{
  "headerAnalysis": {{
    "headerRows": [array of row indexes that are headers],
    "dataStartRow": number,
    "explanation": "brief explanation"
  }},
  "executablePlan": {{
    "removeRows": [array of row indexes to remove],
    "renameColumns": {{
      "0": "new_name_for_column_0",
      "1": "new_name_for_column_1"
    }},
    "combineHeaders": {{
      "enabled": true/false,
      "startColumn": number,
      "endColumn": number,
      "prefix": "prefix_for_combined_headers",
      "questionText": "main question text",
      "subLabels": ["array", "of", "sublabels"]
    }},
    "dataValidation": {{
      "numericColumns": [array of column indexes that should be numeric],
      "expectedRange": {{"min": 1, "max": 5}},
      "missingValueHandling": "strategy"
    }}
  }},
  "matrixQuestions": {{
    "detected": true/false,
    "count": number,
    "details": [array of matrix question objects]
  }},
  "qualityAssessment": {{
    "completeness": "percentage or assessment",
    "issues": ["array of issues found"],
    "recommendations": ["array of recommendations"]
  }}
}}

CRITICAL: Return ONLY valid JSON. No markdown formatting, no explanatory text, just the JSON object."""

        for attempt in range(max_retries):
            try:
                logger.info(f"Sending analysis request to Claude (attempt {attempt + 1})")
                logger.info(f"Prompt length: {len(prompt)} characters")
                
                response = self.anthropic.messages.create(
                    model="claude-opus-4-1-20250805",
                    max_tokens=4000,
                    temperature=0.2,
                    messages=[{
                        "role": "user",
                        "content": prompt
                    }]
                )
                
                response_text = response.content[0].text.strip()
                logger.info(f"Received response: {len(response_text)} characters")
                
                # Try to parse JSON
                try:
                    # Remove any markdown formatting if present
                    if response_text.startswith('```json'):
                        response_text = response_text.replace('```json', '').replace('```', '').strip()
                    elif response_text.startswith('```'):
                        response_text = response_text.replace('```', '').strip()
                    
                    analysis = json.loads(response_text)
                    logger.info("SUCCESS: Successfully parsed LLM response as JSON")
                    return {
                        'success': True,
                        'analysis': analysis,
                        'raw_response': response_text[:500] + '...' if len(response_text) > 500 else response_text,
                        'prompt_length': len(prompt)
                    }
                    
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse JSON (attempt {attempt + 1}): {e}")
                    if attempt == max_retries - 1:
                        return {
                            'success': False,
                            'error': f'JSON parsing failed after {max_retries} attempts',
                            'raw_response': response_text,
                            'last_error': str(e)
                        }
                        
            except Exception as e:
                logger.error(f"API call failed (attempt {attempt + 1}): {e}")
                if attempt == max_retries - 1:
                    return {
                        'success': False,
                        'error': f'API call failed after {max_retries} attempts: {str(e)}'
                    }
                    
        return {'success': False, 'error': 'Unexpected error in LLM analysis'}
    
    def apply_transformation_plan(self, analysis: Dict[str, Any], max_retries=3):
        """Apply the LLM's transformation plan to the data"""
        
        if not analysis.get('success') or 'analysis' not in analysis:
            return {'success': False, 'error': 'No valid analysis provided'}
            
        executable_plan = analysis['analysis'].get('executablePlan', {})
        transformation_results = []
        
        for attempt in range(max_retries):
            try:
                logger.info(f"Applying transformation plan (attempt {attempt + 1})")
                
                # Step 1: Remove header rows
                if 'removeRows' in executable_plan and executable_plan['removeRows']:
                    rows_to_remove = sorted(executable_plan['removeRows'], reverse=True)
                    for row_idx in rows_to_remove:
                        if 0 <= row_idx < len(self.working_data):
                            removed_row = self.working_data.pop(row_idx)
                            logger.info(f"Removed row {row_idx}: {removed_row[:3]}...")
                    transformation_results.append(f"Removed {len(rows_to_remove)} header rows")
                
                # Step 2: Rename columns
                if 'renameColumns' in executable_plan and executable_plan['renameColumns']:
                    if self.working_data:
                        for col_idx_str, new_name in executable_plan['renameColumns'].items():
                            col_idx = int(col_idx_str)
                            if 0 <= col_idx < len(self.working_data[0]):
                                old_name = self.working_data[0][col_idx]
                                self.working_data[0][col_idx] = new_name
                                logger.info(f"Renamed column {col_idx}: '{old_name}' → '{new_name}'")
                        transformation_results.append(f"Renamed {len(executable_plan['renameColumns'])} columns")
                
                # Step 3: Combine headers
                if ('combineHeaders' in executable_plan and 
                    executable_plan['combineHeaders'].get('enabled') and
                    'subLabels' in executable_plan['combineHeaders']):
                    
                    config = executable_plan['combineHeaders']
                    if self.working_data:
                        start_col = config.get('startColumn', 2)
                        sub_labels = config.get('subLabels', [])
                        prefix = config.get('prefix', 'Q_')
                        
                        combined_count = 0
                        for i, label in enumerate(sub_labels):
                            col_idx = start_col + i
                            if col_idx < len(self.working_data[0]):
                                new_header = f"{prefix}{label}"
                                old_header = self.working_data[0][col_idx]
                                self.working_data[0][col_idx] = new_header
                                logger.info(f"Combined header at column {col_idx}: '{old_header}' → '{new_header}'")
                                combined_count += 1
                        
                        transformation_results.append(f"Combined {combined_count} headers")
                
                # Step 4: Data type validation
                if ('dataValidation' in executable_plan and 
                    'numericColumns' in executable_plan['dataValidation']):
                    
                    numeric_cols = executable_plan['dataValidation']['numericColumns']
                    validation_issues = 0
                    converted_values = 0
                    
                    for row_idx in range(1, len(self.working_data)):  # Skip header row
                        for col_idx in numeric_cols:
                            if col_idx < len(self.working_data[row_idx]):
                                value = self.working_data[row_idx][col_idx]
                                try:
                                    if value and str(value).strip():
                                        numeric_value = float(str(value).strip())
                                        self.working_data[row_idx][col_idx] = numeric_value
                                        converted_values += 1
                                except (ValueError, TypeError):
                                    validation_issues += 1
                                    logger.warning(f"Could not convert '{value}' to numeric at row {row_idx}, col {col_idx}")
                    
                    transformation_results.append(f"Converted {converted_values} values to numeric, {validation_issues} validation issues")
                
                # Success!
                logger.info("SUCCESS: Transformation completed successfully")
                return {
                    'success': True,
                    'transformed_data': self.working_data,
                    'transformation_results': transformation_results,
                    'rows_processed': len(self.working_data) - 1,  # Exclude header
                    'columns_processed': len(self.working_data[0]) if self.working_data else 0,
                    'attempt_used': attempt + 1
                }
                
            except Exception as e:
                logger.error(f"Transformation failed (attempt {attempt + 1}): {e}")
                if attempt == max_retries - 1:
                    return {
                        'success': False,
                        'error': f'Transformation failed after {max_retries} attempts: {str(e)}',
                        'partial_results': transformation_results
                    }
        
        return {'success': False, 'error': 'Unexpected error in transformation'}
    
    def export_to_csv(self, filename='cleaned_data.csv'):
        """Export cleaned data to CSV"""
        try:
            df = pd.DataFrame(self.working_data[1:], columns=self.working_data[0])
            df.to_csv(filename, index=False)
            logger.info(f"SUCCESS: Exported cleaned data to {filename}")
            return {'success': True, 'filename': filename, 'rows': len(df), 'columns': len(df.columns)}
        except Exception as e:
            logger.error(f"CSV export failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def print_data_preview(self, title="Data Preview", max_rows=5):
        """Print a preview of the current data"""
        print(f"\n{'='*50}")
        print(f"{title}")
        print(f"{'='*50}")
        print(f"Shape: {len(self.working_data)} rows × {len(self.working_data[0]) if self.working_data else 0} columns")
        print()
        
        for i, row in enumerate(self.working_data[:max_rows]):
            row_preview = [str(cell)[:15] + '...' if len(str(cell)) > 15 else str(cell) for cell in row[:5]]
            print(f"Row {i}: {row_preview}")
        
        if len(self.working_data) > max_rows:
            print(f"... ({len(self.working_data) - max_rows} more rows)")
        print()

def main():
    """Run the complete data wrangling pipeline"""
    
    # Get API key from environment
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY environment variable not set")
        return
    
    print("Starting LLM-Guided Data Wrangling Pipeline")
    print("=" * 60)
    
    # Initialize the wrangler
    wrangler = LLMDataWrangler(api_key)
    
    # Step 1: Load actual Excel data
    print("\nStep 1: Loading actual Excel data...")
    load_result = wrangler.load_excel_data()
    
    if load_result['success']:
        print(f"SUCCESS: Loaded {load_result['rows']} rows x {load_result['columns']} columns")
        wrangler.print_data_preview("Original Data")
    else:
        print(f"ERROR: Failed to load Excel data: {load_result['error']}")
        return
    
    # Step 2: Get LLM analysis
    print("\nStep 2: Getting LLM analysis...")
    analysis_result = wrangler.get_llm_analysis()
    
    if analysis_result['success']:
        print("SUCCESS: LLM Analysis completed successfully!")
        print(f"Prompt length: {analysis_result['prompt_length']} characters")
        
        # Print key findings
        analysis = analysis_result['analysis']
        if 'headerAnalysis' in analysis:
            header_info = analysis['headerAnalysis']
            print(f"Header rows detected: {header_info.get('headerRows', 'N/A')}")
            print(f"Data starts at row: {header_info.get('dataStartRow', 'N/A')}")
        
        if 'matrixQuestions' in analysis:
            matrix_info = analysis['matrixQuestions']
            print(f"Matrix questions detected: {matrix_info.get('detected', 'N/A')}")
            
    else:
        print("ERROR: LLM Analysis failed!")
        print(f"Error: {analysis_result.get('error', 'Unknown error')}")
        return
    
    # Step 3: Apply transformation plan
    print("\nStep 3: Applying transformation plan...")
    transform_result = wrangler.apply_transformation_plan(analysis_result)
    
    if transform_result['success']:
        print("SUCCESS: Data transformation completed successfully!")
        print(f"Processed {transform_result['rows_processed']} data rows")
        print(f"Processed {transform_result['columns_processed']} columns")
        print("Transformations applied:")
        for result in transform_result['transformation_results']:
            print(f"   - {result}")
        
        wrangler.print_data_preview("Cleaned Data")
        
    else:
        print("ERROR: Data transformation failed!")
        print(f"Error: {transform_result.get('error', 'Unknown error')}")
        return
    
    # Step 4: Export to CSV
    print("\nStep 4: Exporting to CSV...")
    export_result = wrangler.export_to_csv()
    
    if export_result['success']:
        print(f"SUCCESS: Exported to {export_result['filename']}")
        print(f"Final dataset: {export_result['rows']} rows x {export_result['columns']} columns")
    else:
        print(f"ERROR: Export failed: {export_result.get('error', 'Unknown error')}")
    
    print("\nPipeline completed!")
    print("=" * 60)

if __name__ == "__main__":
    main()