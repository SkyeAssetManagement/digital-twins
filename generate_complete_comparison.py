#!/usr/bin/env python3
"""
Generate complete column comparison for all 253 columns
Shows LLM result vs forward-fill approach for every column
"""

import pandas as pd
import numpy as np

def create_complete_comparison():
    """Create a complete comparison table for all 253 columns"""
    
    print("Loading actual Excel data...")
    df = pd.read_excel('data/datasets/mums/Detail_Parents Survey.xlsx', header=None)
    
    # Convert to string and handle NaN
    data = []
    for _, row in df.iterrows():
        row_data = []
        for cell in row:
            if pd.isna(cell):
                row_data.append('')
            else:
                row_data.append(str(cell))
        data.append(row_data)
    
    print(f"Loaded data: {len(data)} rows x {len(data[0])} columns")
    
    # Load the cleaned data to get LLM results
    cleaned_df = pd.read_csv('cleaned_data.csv')
    llm_headers = list(cleaned_df.columns)
    
    print(f"LLM generated {len(llm_headers)} column headers")
    
    # Generate forward-fill approach
    row_0 = data[0]  # Original headers
    row_1 = data[1] if len(data) > 1 else [''] * len(row_0)  # Sub-labels
    
    # Forward fill row 0 across blank columns
    ffill_row_0 = []
    last_value = ''
    for cell in row_0:
        if cell and cell.strip():
            last_value = cell.strip()
            ffill_row_0.append(last_value)
        else:
            ffill_row_0.append(last_value)
    
    # Create concatenated headers (ffill row 0 + " - " + row 1)
    concatenated_headers = []
    for i in range(len(ffill_row_0)):
        if i < len(row_1) and row_1[i] and row_1[i].strip():
            if ffill_row_0[i]:
                concatenated_headers.append(f"{ffill_row_0[i]} - {row_1[i].strip()}")
            else:
                concatenated_headers.append(row_1[i].strip())
        else:
            concatenated_headers.append(ffill_row_0[i] if ffill_row_0[i] else '')
    
    # Create comparison table
    comparison_data = []
    
    for i in range(len(row_0)):
        # Get LLM result (pad with empty if not enough)
        llm_result = llm_headers[i] if i < len(llm_headers) else ''
        
        # Get original values
        original_row_0 = row_0[i] if i < len(row_0) else ''
        original_row_1 = row_1[i] if i < len(row_1) else ''
        
        # Get forward-filled values
        ffill_value = ffill_row_0[i] if i < len(ffill_row_0) else ''
        concat_value = concatenated_headers[i] if i < len(concatenated_headers) else ''
        
        comparison_data.append({
            'Column': i,
            'LLM Result': llm_result,
            'Original Row 0': original_row_0,
            'Original Row 1': original_row_1, 
            'FFill Row 0': ffill_value,
            'FFill Row 0 + " - " + Row 1': concat_value
        })
    
    # Create DataFrame and save as CSV for easier viewing
    comparison_df = pd.DataFrame(comparison_data)
    comparison_df.to_csv('complete_column_comparison_253.csv', index=False)
    
    # Also create markdown format
    markdown_content = "# Complete Column-by-Column Comparison (All 253 Columns)\n\n"
    markdown_content += "| Column | LLM Result | Original Row 0 | Original Row 1 | FFill Row 0 | FFill Row 0 + \" - \" + Row 1 |\n"
    markdown_content += "|--------|------------|---------------|---------------|-------------|------------------------------|\n"
    
    for _, row in comparison_df.iterrows():
        col = row['Column']
        llm = str(row['LLM Result']).replace('|', '\\|')
        orig_0 = str(row['Original Row 0']).replace('|', '\\|')
        orig_1 = str(row['Original Row 1']).replace('|', '\\|') 
        ffill = str(row['FFill Row 0']).replace('|', '\\|')
        concat = str(row['FFill Row 0 + " - " + Row 1']).replace('|', '\\|')
        
        markdown_content += f"| {col} | `{llm}` | `{orig_0}` | `{orig_1}` | `{ffill}` | `{concat}` |\n"
    
    # Save markdown
    with open('complete_column_comparison_253.md', 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    
    print(f"Generated complete comparison for {len(comparison_data)} columns")
    print("Files created:")
    print("- complete_column_comparison_253.csv (spreadsheet format)")
    print("- complete_column_comparison_253.md (markdown format)")
    
    # Print summary stats
    empty_llm = sum(1 for row in comparison_data if not row['LLM Result'])
    empty_original_0 = sum(1 for row in comparison_data if not row['Original Row 0'])
    empty_original_1 = sum(1 for row in comparison_data if not row['Original Row 1'])
    
    print(f"\nSummary:")
    print(f"- Total columns: {len(comparison_data)}")
    print(f"- Empty LLM results: {empty_llm}")
    print(f"- Empty Original Row 0: {empty_original_0}")
    print(f"- Empty Original Row 1: {empty_original_1}")

if __name__ == "__main__":
    create_complete_comparison()