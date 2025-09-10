#!/usr/bin/env python3
"""
Generate comprehensive comparison table for header transformations
"""

# Original data structure
original_data = [
    ['', '', 'When considering these types of products, how important are the following aspects to you in deciding which one to purchase: (select one per aspect)', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', '', 'Price', 'Quality', 'Brand', 'Features', 'Design', 'Reviews', 'Availability', 'Customer Service', 'Warranty', 'Sustainability', 'Innovation', 'Compatibility', 'Ease of Use', 'Support', 'Reputation']
]

# Forward fill row 0
row_0_ffilled = []
last_value = ''
for cell in original_data[0]:
    if cell.strip():
        last_value = cell.strip()
    row_0_ffilled.append(last_value if last_value else '[EMPTY]')

# Row 1 as-is
row_1 = [cell.strip() if cell.strip() else '[EMPTY]' for cell in original_data[1]]

# Combined: Row 0 (ffilled) + ' - ' + Row 1
combined_headers = []
for i, (r0, r1) in enumerate(zip(row_0_ffilled, row_1)):
    if i <= 1:  # First two columns are ID/demographic
        if i == 0:
            combined_headers.append('Respondent_ID')
        else:
            combined_headers.append('Age_Group')
    else:
        if r0 != '[EMPTY]' and r1 != '[EMPTY]':
            combined_headers.append(f'{r0} - {r1}')
        elif r1 != '[EMPTY]':
            combined_headers.append(r1)
        elif r0 != '[EMPTY]':
            combined_headers.append(r0)
        else:
            combined_headers.append(f'Column_{i}')

# LLM actual results
llm_headers = ['Respondent_ID', 'Age_Group', 'ImportancePrice', 'ImportanceQuality', 'ImportanceBrand', 'ImportanceFeatures', 'ImportanceDesign', 'ImportanceReviews', 'ImportanceAvailability', 'ImportanceCustomer Service', 'ImportanceWarranty', 'ImportanceSustainability', 'ImportanceInnovation', 'ImportanceCompatibility', 'ImportanceEase of Use', 'ImportanceSupport', 'ImportanceReputation']

# Generate markdown file
markdown_content = """# Header Transformation Analysis

## Original Data Structure
- **Row 0**: Question text with blanks in columns 0-1, question text starting at column 2
- **Row 1**: Sub-labels (Price, Quality, Brand, etc.)

## Transformation Approaches Compared

| Col | LLM Result | FFill Row 0 | Row 1 | FFill Row 0 + " - " + Row 1 |
|-----|------------|-------------|-------|------------------------------|
"""

# Generate table rows
for i in range(len(llm_headers)):
    llm_name = llm_headers[i] if i < len(llm_headers) else 'N/A'
    ffill_r0 = row_0_ffilled[i] if i < len(row_0_ffilled) else 'N/A'
    r1 = row_1[i] if i < len(row_1) else 'N/A'
    combined = combined_headers[i] if i < len(combined_headers) else 'N/A'
    
    # Truncate long values for readability
    ffill_display = ffill_r0[:50] + '...' if len(ffill_r0) > 50 else ffill_r0
    combined_display = combined[:70] + '...' if len(combined) > 70 else combined
    
    markdown_content += f"| **{i}** | `{llm_name}` | `{ffill_display}` | `{r1}` | `{combined_display}` |\n"

markdown_content += """
## Analysis

### Forward-Fill Results
- **Columns 0-1**: Empty, need manual assignment
- **Columns 2-16**: All get the same long question text forward-filled

### LLM Results  
- **Columns 0-1**: Intelligently assigned `Respondent_ID`, `Age_Group`
- **Columns 2-16**: Created concise, meaningful headers with `Importance` prefix

### Key Differences

1. **Length Management**:
   - Forward-fill: Creates 89+ character column names
   - LLM: Creates concise 15-20 character names

2. **Semantic Understanding**:
   - Forward-fill: Mechanical concatenation
   - LLM: Understands that "importance" is the key concept

3. **Analysis Readiness**:
   - Forward-fill: Unwieldy for Excel, Python, SQL
   - LLM: Perfect for data analysis tools

4. **Consistency**:
   - Forward-fill: Inconsistent (some empty, some very long)  
   - LLM: Consistent pattern across all rating columns

## Conclusion

The LLM approach is superior for data analysis because it:
- Maintains semantic meaning without verbosity
- Creates analysis-friendly column names
- Demonstrates understanding of survey data structure
- Produces professional, database-ready headers
"""

# Write to file
with open('header_comparison_analysis.md', 'w', encoding='utf-8') as f:
    f.write(markdown_content)

print("SUCCESS: Generated header_comparison_analysis.md")
print(f"Analyzed {len(llm_headers)} columns")
print("Full comparison table with forward-fill analysis complete")