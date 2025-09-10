#!/usr/bin/env python3
"""
Improved Data Wrangling Pipeline
1. Determine number of header rows
2. Fill forward to the right for blank columns
3. Bottom row of each column concatenates itself and rows above (separated by |)
4. LLM cycles through the concatenated text and makes each section more concise
5. Save column mapping: number, longName (pure concatenate), shortName (LLM abbreviated)
"""

import json
import pandas as pd
import numpy as np
from anthropic import Anthropic
import os
from typing import Dict, List, Any, Tuple
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ImprovedDataWrangler:
    def __init__(self, api_key: str):
        self.anthropic = Anthropic(api_key=api_key)
        self.original_data = None
        self.header_rows = []
        self.data_start_row = None
        self.column_mapping = {}  # {col_num: {'longName': str, 'shortName': str}}
        
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
                        row[i] = str(cell).strip()
            
            logger.info(f"Loaded Excel data: {len(self.original_data)} rows, {len(self.original_data[0])} columns")
            
            return {'success': True, 'rows': len(self.original_data), 'columns': len(self.original_data[0])}
            
        except Exception as e:
            logger.error(f"Failed to load Excel file: {e}")
            return {'success': False, 'error': str(e)}
    
    def determine_header_rows(self):
        """Step 1: Determine number of header rows by analyzing data patterns"""
        if not self.original_data:
            return {'success': False, 'error': 'No data loaded'}
        
        logger.info("Determining header rows...")
        
        # Look for patterns that indicate data vs headers
        # Headers typically have more text, data rows have more consistent patterns
        data_start_candidates = []
        
        for row_idx in range(min(10, len(self.original_data))):  # Check first 10 rows
            row = self.original_data[row_idx]
            
            # Count empty cells
            empty_count = sum(1 for cell in row if not cell or cell == '')
            # Count numeric-like cells
            numeric_count = 0
            for cell in row:
                if cell and str(cell).replace('.', '').replace('-', '').isdigit():
                    numeric_count += 1
            
            # Calculate ratios
            total_cells = len(row)
            empty_ratio = empty_count / total_cells if total_cells > 0 else 0
            numeric_ratio = numeric_count / total_cells if total_cells > 0 else 0
            
            logger.info(f"Row {row_idx}: empty_ratio={empty_ratio:.2f}, numeric_ratio={numeric_ratio:.2f}")
            
            # Data rows typically have lower empty ratio and higher numeric ratio
            if empty_ratio < 0.7 and numeric_ratio > 0.1:
                data_start_candidates.append(row_idx)
        
        # Use the earliest candidate as data start
        if data_start_candidates:
            self.data_start_row = min(data_start_candidates)
        else:
            self.data_start_row = 2  # Default assumption
        
        # Header rows are everything before data start
        self.header_rows = list(range(self.data_start_row))
        
        logger.info(f"Determined header rows: {self.header_rows}")
        logger.info(f"Data starts at row: {self.data_start_row}")
        
        return {
            'success': True, 
            'header_rows': self.header_rows,
            'data_start_row': self.data_start_row
        }
    
    def forward_fill_headers(self):
        """Step 2: Fill forward to the right for blank columns in header rows"""
        if not self.header_rows:
            return {'success': False, 'error': 'Header rows not determined'}
        
        logger.info("Forward filling header rows...")
        
        filled_headers = []
        
        for row_idx in self.header_rows:
            if row_idx >= len(self.original_data):
                continue
                
            row = self.original_data[row_idx][:]  # Copy
            filled_row = []
            last_value = ''
            
            for cell in row:
                if cell and cell.strip():
                    last_value = cell.strip()
                    filled_row.append(last_value)
                else:
                    filled_row.append(last_value)
            
            filled_headers.append(filled_row)
            logger.info(f"Row {row_idx} filled: first 5 = {filled_row[:5]}")
        
        self.filled_headers = filled_headers
        return {'success': True, 'filled_headers': len(filled_headers)}
    
    def concatenate_headers(self):
        """Step 3: Bottom row concatenates itself and rows above, separated by |"""
        if not hasattr(self, 'filled_headers') or not self.filled_headers:
            return {'success': False, 'error': 'Headers not forward filled'}
        
        logger.info("Concatenating headers with | separator...")
        
        num_columns = len(self.filled_headers[0]) if self.filled_headers else 0
        concatenated_headers = []
        
        for col_idx in range(num_columns):
            # Collect all header values for this column
            column_parts = []
            for row_data in self.filled_headers:
                if col_idx < len(row_data) and row_data[col_idx]:
                    column_parts.append(row_data[col_idx])
            
            # Remove duplicates while preserving order
            unique_parts = []
            for part in column_parts:
                if part not in unique_parts:
                    unique_parts.append(part)
            
            # Join with | separator
            long_name = ' | '.join(unique_parts) if unique_parts else f'Column_{col_idx}'
            concatenated_headers.append(long_name)
        
        self.concatenated_headers = concatenated_headers
        logger.info(f"Created {len(concatenated_headers)} concatenated headers")
        logger.info(f"Example: Column 15 = '{concatenated_headers[15] if len(concatenated_headers) > 15 else 'N/A'}'")
        
        return {'success': True, 'concatenated_count': len(concatenated_headers)}
    
    def llm_abbreviate_headers(self, batch_size=25):
        """Step 4: LLM cycles through concatenated text and makes each section more concise"""
        if not hasattr(self, 'concatenated_headers') or not self.concatenated_headers:
            return {'success': False, 'error': 'Headers not concatenated'}
        
        logger.info(f"LLM abbreviating {len(self.concatenated_headers)} headers in batches of {batch_size}...")
        
        abbreviated_headers = []
        
        # Process in batches to avoid overwhelming the LLM
        for batch_start in range(0, len(self.concatenated_headers), batch_size):
            batch_end = min(batch_start + batch_size, len(self.concatenated_headers))
            batch_headers = self.concatenated_headers[batch_start:batch_end]
            
            logger.info(f"Processing batch {batch_start}-{batch_end-1}")
            
            # Build prompt for this batch
            header_list = "\n".join([
                f"{i + batch_start}: {header}" 
                for i, header in enumerate(batch_headers)
            ])
            
            prompt = f"""You are abbreviating survey column headers to make them concise and readable.

For each header below, create a short, clear column name that captures the essential meaning.
Rules:
- Use snake_case format (lowercase with underscores)
- Maximum 30 characters
- Preserve key information but remove redundancy
- For matrix questions, focus on the specific aspect being measured
- Make names unique and descriptive

Headers to abbreviate:
{header_list}

Return ONLY a JSON object with the format:
{{
  "0": "abbreviated_name_1",
  "1": "abbreviated_name_2",
  ...
}}

Use the original column numbers (not 0-indexed for this batch)."""

            try:
                response = self.anthropic.messages.create(
                    model="claude-opus-4-1-20250805",
                    max_tokens=3000,
                    temperature=0.2,
                    messages=[{
                        "role": "user",
                        "content": prompt
                    }]
                )
                
                response_text = response.content[0].text.strip()
                
                # Parse JSON response
                if response_text.startswith('```json'):
                    response_text = response_text.replace('```json', '').replace('```', '').strip()
                elif response_text.startswith('```'):
                    response_text = response_text.replace('```', '').strip()
                
                batch_result = json.loads(response_text)
                
                # Convert back to list format
                for i, header in enumerate(batch_headers):
                    col_idx = batch_start + i
                    if str(col_idx) in batch_result:
                        abbreviated_headers.append(batch_result[str(col_idx)])
                    else:
                        # Fallback if LLM didn't provide abbreviation
                        fallback_name = f"col_{col_idx}"
                        abbreviated_headers.append(fallback_name)
                        logger.warning(f"No abbreviation for column {col_idx}, using fallback: {fallback_name}")
                
                logger.info(f"Batch {batch_start}-{batch_end-1} completed successfully")
                
            except Exception as e:
                logger.error(f"LLM abbreviation failed for batch {batch_start}-{batch_end-1}: {e}")
                # Fallback for this batch
                for i, header in enumerate(batch_headers):
                    col_idx = batch_start + i
                    fallback_name = f"col_{col_idx}"
                    abbreviated_headers.append(fallback_name)
        
        self.abbreviated_headers = abbreviated_headers
        logger.info(f"LLM abbreviation completed: {len(abbreviated_headers)} headers")
        
        return {'success': True, 'abbreviated_count': len(abbreviated_headers)}
    
    def create_column_mapping(self):
        """Step 5: Save column mapping with number, longName, shortName"""
        if not (hasattr(self, 'concatenated_headers') and hasattr(self, 'abbreviated_headers')):
            return {'success': False, 'error': 'Headers not processed'}
        
        logger.info("Creating column mapping dictionary...")
        
        self.column_mapping = {}
        
        for col_idx in range(len(self.concatenated_headers)):
            long_name = self.concatenated_headers[col_idx]
            short_name = self.abbreviated_headers[col_idx] if col_idx < len(self.abbreviated_headers) else f'col_{col_idx}'
            
            self.column_mapping[col_idx] = {
                'longName': long_name,
                'shortName': short_name
            }
        
        # Save to JSON file
        with open('column_mapping.json', 'w', encoding='utf-8') as f:
            json.dump(self.column_mapping, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Column mapping created for {len(self.column_mapping)} columns")
        logger.info("Saved to column_mapping.json")
        
        return {'success': True, 'mapping_count': len(self.column_mapping)}
    
    def generate_comparison_table(self):
        """Generate improved comparison table with separate columns for up to 4 header rows"""
        if not self.column_mapping:
            return {'success': False, 'error': 'Column mapping not created'}
        
        logger.info("Generating improved comparison table with separate header columns...")
        
        # Create comparison data
        comparison_data = []
        
        for col_idx, mapping in self.column_mapping.items():
            # Get original row data - separate columns for up to 4 header rows
            header_values = ['', '', '', '']  # Support up to 4 header rows
            
            for i in range(min(4, len(self.header_rows))):
                row_idx = self.header_rows[i]
                if row_idx < len(self.original_data) and col_idx < len(self.original_data[row_idx]):
                    header_values[i] = self.original_data[row_idx][col_idx]
            
            row_data = {
                'Column': col_idx,
                'Row_0_Header': header_values[0],
                'Row_1_Header': header_values[1],
                'Row_2_Header': header_values[2],
                'Row_3_Header': header_values[3],
                'Forward_Filled_Concatenated': mapping['longName'],
                'LLM_Abbreviated': mapping['shortName']
            }
            comparison_data.append(row_data)
        
        # Create DataFrame and save as CSV
        comparison_df = pd.DataFrame(comparison_data)
        comparison_df.to_csv('improved_column_comparison.csv', index=False)
        
        # Create markdown format with full field content (no truncation)
        num_header_rows = min(4, len(self.header_rows))
        markdown_content = f"# Improved Column Comparison - All {len(comparison_data)} Columns\n\n"
        
        # Dynamic header based on actual number of header rows
        header_line = "| Column "
        separator_line = "|--------|"
        
        for i in range(4):  # Always show up to 4 header columns
            header_line += f"| Row {i} Header "
            separator_line += "-------------|"
        
        header_line += "| Forward Filled Concatenated | LLM Abbreviated |\n"
        separator_line += "-----------------------------|-----------------|\n"
        
        markdown_content += header_line + separator_line
        
        for _, row in comparison_df.iterrows():
            col = row['Column']
            row_0 = str(row['Row_0_Header']).replace('|', '\\|')
            row_1 = str(row['Row_1_Header']).replace('|', '\\|')
            row_2 = str(row['Row_2_Header']).replace('|', '\\|')
            row_3 = str(row['Row_3_Header']).replace('|', '\\|')
            concat = str(row['Forward_Filled_Concatenated']).replace('|', '\\|')
            abbrev = str(row['LLM_Abbreviated']).replace('|', '\\|')
            
            markdown_content += f"| {col} | `{row_0}` | `{row_1}` | `{row_2}` | `{row_3}` | `{concat}` | `{abbrev}` |\n"
        
        # Save markdown
        with open('improved_column_comparison.md', 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        logger.info("Comparison table generated:")
        logger.info("- improved_column_comparison.csv")
        logger.info("- improved_column_comparison.md")
        
        return {'success': True, 'rows': len(comparison_data)}

def main():
    """Run the improved pipeline"""
    
    # Get API key from environment
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY environment variable not set")
        return
    
    print("Starting Improved Data Wrangling Pipeline")
    print("=" * 60)
    
    # Initialize the wrangler
    wrangler = ImprovedDataWrangler(api_key)
    
    # Step 1: Load data
    print("\nStep 1: Loading Excel data...")
    load_result = wrangler.load_excel_data()
    if not load_result['success']:
        print(f"ERROR: {load_result['error']}")
        return
    print(f"SUCCESS: Loaded {load_result['rows']} rows x {load_result['columns']} columns")
    
    # Step 2: Determine header rows
    print("\nStep 2: Determining header rows...")
    header_result = wrangler.determine_header_rows()
    if not header_result['success']:
        print(f"ERROR: {header_result['error']}")
        return
    print(f"SUCCESS: Header rows: {header_result['header_rows']}, Data starts: {header_result['data_start_row']}")
    
    # Step 3: Forward fill headers
    print("\nStep 3: Forward filling headers...")
    fill_result = wrangler.forward_fill_headers()
    if not fill_result['success']:
        print(f"ERROR: {fill_result['error']}")
        return
    print(f"SUCCESS: Forward filled {fill_result['filled_headers']} header rows")
    
    # Step 4: Concatenate headers
    print("\nStep 4: Concatenating headers...")
    concat_result = wrangler.concatenate_headers()
    if not concat_result['success']:
        print(f"ERROR: {concat_result['error']}")
        return
    print(f"SUCCESS: Created {concat_result['concatenated_count']} concatenated headers")
    
    # Step 5: LLM abbreviation
    print("\nStep 5: LLM abbreviating headers...")
    abbrev_result = wrangler.llm_abbreviate_headers()
    if not abbrev_result['success']:
        print(f"ERROR: {abbrev_result['error']}")
        return
    print(f"SUCCESS: Abbreviated {abbrev_result['abbreviated_count']} headers")
    
    # Step 6: Create column mapping
    print("\nStep 6: Creating column mapping...")
    mapping_result = wrangler.create_column_mapping()
    if not mapping_result['success']:
        print(f"ERROR: {mapping_result['error']}")
        return
    print(f"SUCCESS: Created mapping for {mapping_result['mapping_count']} columns")
    
    # Step 7: Generate comparison table
    print("\nStep 7: Generating comparison table...")
    table_result = wrangler.generate_comparison_table()
    if not table_result['success']:
        print(f"ERROR: {table_result['error']}")
        return
    print(f"SUCCESS: Generated comparison table with {table_result['rows']} rows")
    
    print("\nPipeline completed successfully!")
    print("Files generated:")
    print("- column_mapping.json (column number -> longName, shortName)")
    print("- improved_column_comparison.csv (spreadsheet format)")
    print("- improved_column_comparison.md (markdown format)")
    print("=" * 60)

if __name__ == "__main__":
    main()