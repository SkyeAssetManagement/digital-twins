#!/usr/bin/env python3
"""
Local Python Data Wrangling Pipeline Debugger
Replicates the JavaScript pipeline for easier debugging
"""

import pandas as pd
import json
import sys
import os
from pathlib import Path
import anthropic
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class DataWranglingDebugger:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        
    def step_1_load_file(self, file_path):
        """Step 1: Load and examine raw file structure"""
        print(f"\n=== STEP 1: Loading file {file_path} ===")
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        # Load Excel file preserving structure
        if file_path.endswith(('.xlsx', '.xls')):
            # Read as raw data preserving empty cells
            df_raw = pd.read_excel(file_path, header=None, engine='openpyxl')
            raw_data = df_raw.fillna('').values.tolist()
        elif file_path.endswith('.csv'):
            df_raw = pd.read_csv(file_path, header=None, encoding='utf-8')
            raw_data = df_raw.fillna('').values.tolist()
        else:
            raise ValueError(f"Unsupported file format: {file_path}")
            
        result = {
            'file_path': file_path,
            'file_size': os.path.getsize(file_path),
            'total_rows': len(raw_data),
            'total_columns': len(raw_data[0]) if raw_data else 0,
            'first_5_rows': raw_data[:5],
            'raw_data': raw_data
        }
        
        print(f"[OK] File loaded: {result['total_rows']} rows, {result['total_columns']} columns")
        print(f"[INFO] File size: {result['file_size']:,} bytes")
        
        # Show first few rows for inspection
        print("\n[INFO] First 5 rows preview:")
        for i, row in enumerate(result['first_5_rows']):
            print(f"Row {i}: {row[:10]}...")  # Show first 10 columns
            
        return result
    
    def step_2_analyze_structure(self, raw_data):
        """Step 2: Basic structure analysis - raw stats only"""
        print(f"\n=== STEP 2: Analyzing structure (basic stats only) ===")
        
        analysis = {
            'total_rows': len(raw_data),
            'total_columns': len(raw_data[0]) if raw_data else 0,
            'row_analysis': []
        }
        
        # Analyze first 10 rows with basic statistics
        for i in range(min(10, len(raw_data))):
            row = raw_data[i]
            row_analysis = {
                'row_index': i,
                'cell_count': len(row),
                'empty_cells': sum(1 for cell in row if not cell or cell == ''),
                'non_empty_cells': sum(1 for cell in row if cell and cell != ''),
                'cells_preview': row[:15],  # First 15 cells
                'avg_cell_length': sum(len(str(cell)) for cell in row) / len(row) if row else 0,
                'max_cell_length': max(len(str(cell)) for cell in row) if row else 0,
                'unique_values': len(set(str(cell) for cell in row if cell))
            }
            analysis['row_analysis'].append(row_analysis)
            
            print(f"Row {i}: {row_analysis['non_empty_cells']}/{row_analysis['cell_count']} non-empty cells")
            
        print(f"[OK] Structure analysis complete - NO pattern detection (left for LLM)")
        return analysis
    
    def step_3_llm_analysis(self, raw_data):
        """Step 3: Get LLM analysis with full prompt and response"""
        print(f"\n=== STEP 3: LLM Analysis ===")
        
        # Prepare data sample for LLM (first 5 rows, first 20 columns)
        data_sample = [row[:20] for row in raw_data[:5]]
        
        prompt = self._build_analysis_prompt(data_sample)
        print(f"[INFO] Prompt length: {len(prompt)} characters")
        
        try:
            response = self.client.messages.create(
                model='claude-opus-4-1-20250805',
                max_tokens=4000,
                temperature=0.2,
                messages=[{
                    'role': 'user',
                    'content': prompt
                }]
            )
            
            response_text = response.content[0].text
            print(f"[OK] LLM response received: {len(response_text)} characters")
            
            # Try to extract JSON
            try:
                # Look for JSON in code blocks first
                import re
                json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
                if json_match:
                    analysis = json.loads(json_match.group(1))
                else:
                    # Try to find raw JSON
                    json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                    if json_match:
                        analysis = json.loads(json_match.group(0))
                    else:
                        raise ValueError("No JSON found in response")
                        
                print("[OK] Successfully parsed LLM analysis")
                
                result = {
                    'prompt_sent': prompt,
                    'raw_response': response_text,
                    'parsed_analysis': analysis,
                    'success': True
                }
                
                # Print key findings
                if 'analysis' in analysis:
                    print(f"[RESULT] Structure type: {analysis['analysis'].get('structure_type', 'Unknown')}")
                    print(f"[RESULT] Data start row: {analysis['analysis'].get('data_start_row', 'Unknown')}")
                    print(f"[RESULT] Issues detected: {analysis['analysis'].get('header_issues', [])}")
                
                return result
                
            except json.JSONDecodeError as e:
                print(f"[ERROR] Failed to parse LLM response as JSON: {e}")
                print(f"Raw response: {response_text[:500]}...")
                return {
                    'prompt_sent': prompt,
                    'raw_response': response_text,
                    'parsed_analysis': None,
                    'success': False,
                    'error': str(e)
                }
                
        except Exception as e:
            print(f"[ERROR] LLM analysis failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def step_4_apply_wrangling(self, raw_data, llm_analysis):
        """Step 4: Apply wrangling plan step by step"""
        print(f"\n=== STEP 4: Applying wrangling plan ===")
        
        if not llm_analysis['success']:
            print("[ERROR] Cannot apply wrangling - LLM analysis failed")
            return {'success': False, 'error': 'LLM analysis failed'}
            
        analysis = llm_analysis['parsed_analysis']
        if not analysis or 'wrangling_plan' not in analysis:
            print("[ERROR] No wrangling plan found in LLM analysis")
            return {'success': False, 'error': 'No wrangling plan found'}
            
        plan = analysis['wrangling_plan']
        working_data = [row[:] for row in raw_data]  # Deep copy
        step_results = []
        
        print(f"[INFO] Applying {len(plan)} wrangling steps...")
        
        for step_name, step_data in plan.items():
            print(f"\n[STEP] Applying {step_name}: {step_data.get('description', '')}")
            
            try:
                # Apply the step (simplified - you can expand this)
                if step_data.get('action') == 'extract_clean_headers':
                    # Example: extract headers from specific rows
                    target_rows = step_data.get('target_rows', [0])
                    headers = []
                    for row_idx in target_rows:
                        if row_idx < len(working_data):
                            headers.extend(working_data[row_idx])
                    
                    step_result = {
                        'step_name': step_name,
                        'action': step_data.get('action'),
                        'success': True,
                        'headers_extracted': len(headers),
                        'sample_headers': headers[:10]
                    }
                    
                elif step_data.get('action') == 'remove_metadata_rows':
                    # Example: remove rows containing metadata
                    rows_to_remove = step_data.get('target_rows', [])
                    for row_idx in sorted(rows_to_remove, reverse=True):
                        if row_idx < len(working_data):
                            working_data.pop(row_idx)
                    
                    step_result = {
                        'step_name': step_name,
                        'action': step_data.get('action'),
                        'success': True,
                        'rows_removed': len(rows_to_remove),
                        'remaining_rows': len(working_data)
                    }
                    
                else:
                    # Generic step handling
                    step_result = {
                        'step_name': step_name,
                        'action': step_data.get('action'),
                        'success': True,
                        'note': 'Step simulation - implement specific logic as needed'
                    }
                
                step_results.append(step_result)
                print(f"[OK] {step_name} completed successfully")
                
            except Exception as e:
                print(f"[ERROR] {step_name} failed: {e}")
                step_results.append({
                    'step_name': step_name,
                    'action': step_data.get('action'),
                    'success': False,
                    'error': str(e)
                })
        
        return {
            'success': True,
            'original_plan': plan,
            'step_results': step_results,
            'final_data': working_data,
            'processing_complete': all(step['success'] for step in step_results)
        }
    
    def step_5_validate_output(self, processed_data):
        """Step 5: Validate final output"""
        print(f"\n=== STEP 5: Validating output ===")
        
        if not processed_data['success']:
            print("[ERROR] Cannot validate - processing failed")
            return {'success': False, 'error': 'Processing failed'}
            
        final_data = processed_data['final_data']
        
        validation = {
            'total_rows': len(final_data),
            'total_columns': len(final_data[0]) if final_data else 0,
            'empty_rows': sum(1 for row in final_data if not any(cell for cell in row)),
            'missing_data_percentage': 0,
            'recommendations': []
        }
        
        # Calculate missing data percentage
        if final_data:
            total_cells = sum(len(row) for row in final_data)
            empty_cells = sum(sum(1 for cell in row if not cell or cell == '') for row in final_data)
            validation['missing_data_percentage'] = (empty_cells / total_cells * 100) if total_cells > 0 else 0
        
        # Generate recommendations
        if validation['empty_rows'] > 0:
            validation['recommendations'].append(f"Remove {validation['empty_rows']} empty rows")
        if validation['missing_data_percentage'] > 50:
            validation['recommendations'].append(f"High missing data: {validation['missing_data_percentage']:.1f}%")
            
        print(f"[OK] Validation complete:")
        print(f"  [INFO] Final data: {validation['total_rows']} rows x {validation['total_columns']} columns")
        print(f"  [INFO] Missing data: {validation['missing_data_percentage']:.1f}%")
        print(f"  [INFO] Recommendations: {len(validation['recommendations'])}")
        
        return validation
    
    def _build_analysis_prompt(self, data_sample):
        """Build the generic data analysis prompt"""
        sample_text = ""
        for i, row in enumerate(data_sample):
            sample_text += f"Row {i}: [{', '.join(f'\"{cell}\"' for cell in row)}]\n"
        
        return f"""# Generic Survey Data Structure Analysis

You are an expert data analyst. Analyze this tabular data and determine how to clean it into a proper survey format.

## Data Sample (first 5 rows, up to 20 columns):
{sample_text}

## Your Task:
1. Identify which rows contain question headers vs actual response data
2. Determine if headers span multiple rows and need combining
3. Detect any matrix questions that should be split into separate columns
4. Create a plan to extract clean, concise question headers
5. Ensure all response data is preserved

## Required JSON Response Format:
{{
  "success": true,
  "analysis": {{
    "structure_type": "<describe what you see>",
    "question_rows": [<array of row indices containing headers>],
    "data_start_row": <first row with actual responses>,
    "header_issues": ["<list of problems found>"],
    "recommended_approach": "<your strategy>"
  }},
  "wrangling_plan": {{
    "step_1": {{
      "action": "<action_name>",
      "description": "<what this step does>",
      "target_rows": [<affected rows>]
    }},
    "step_2": {{
      "action": "<action_name>",
      "description": "<what this step does>"
    }}
  }}
}}

Analyze the structure and provide a generic cleaning approach that would work for similar datasets."""

def main():
    """Main function to run the pipeline"""
    if len(sys.argv) != 2:
        print("Usage: python debug_pipeline.py <file_path>")
        print("Example: python debug_pipeline.py 'C:\\\\code\\\\digital-twins\\\\data\\\\datasets\\\\mums\\\\Detail_Parents Survey.xlsx'")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    try:
        debugger = DataWranglingDebugger()
        
        # Step 1: Load file
        step1_result = debugger.step_1_load_file(file_path)
        
        # Step 2: Analyze structure  
        step2_result = debugger.step_2_analyze_structure(step1_result['raw_data'])
        
        # Step 3: LLM analysis
        step3_result = debugger.step_3_llm_analysis(step1_result['raw_data'])
        
        # Step 4: Apply wrangling
        step4_result = debugger.step_4_apply_wrangling(step1_result['raw_data'], step3_result)
        
        # Step 5: Validate output
        step5_result = debugger.step_5_validate_output(step4_result)
        
        print(f"\n[COMPLETE] Pipeline completed!")
        print(f"Results saved in variables for inspection")
        
        # Save results to JSON for inspection
        results = {
            'step_1': step1_result,
            'step_2': step2_result, 
            'step_3': step3_result,
            'step_4': step4_result,
            'step_5': step5_result
        }
        
        # Remove raw_data from saved results to keep file size manageable
        if 'raw_data' in results['step_1']:
            results['step_1']['raw_data'] = f"<{len(results['step_1']['raw_data'])} rows removed for JSON export>"
            
        with open('debug_pipeline_results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, default=str)
            
        print(f"[INFO] Results saved to: debug_pipeline_results.json")
        
    except Exception as e:
        print(f"[ERROR] Pipeline failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()