#!/usr/bin/env python3
"""
Complete column-by-column comparison showing all transformation approaches
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
    row_0_ffilled.append(last_value if last_value else '')

# Row 1 as-is
row_1 = [cell.strip() for cell in original_data[1]]

# Combined: Row 0 (ffilled) + ' - ' + Row 1
combined_headers = []
for i, (r0, r1) in enumerate(zip(row_0_ffilled, row_1)):
    if r0 and r1:
        combined_headers.append(f'{r0} - {r1}')
    elif r1:
        combined_headers.append(r1)
    elif r0:
        combined_headers.append(r0)
    else:
        combined_headers.append('')

# LLM actual results from our test
llm_headers = ['Respondent_ID', 'Age_Group', 'ImportancePrice', 'ImportanceQuality', 'ImportanceBrand', 'ImportanceFeatures', 'ImportanceDesign', 'ImportanceReviews', 'ImportanceAvailability', 'ImportanceCustomer Service', 'ImportanceWarranty', 'ImportanceSustainability', 'ImportanceInnovation', 'ImportanceCompatibility', 'ImportanceEase of Use', 'ImportanceSupport', 'ImportanceReputation']

# Generate complete comparison table
markdown_content = """# Complete Column-by-Column Comparison

| Column | LLM Result | FFill Row 0 | Row 1 | FFill Row 0 + " - " + Row 1 |
|--------|------------|-------------|-------|------------------------------|
"""

# Generate all rows
for i in range(max(len(llm_headers), len(row_0_ffilled), len(row_1), len(combined_headers))):
    llm = llm_headers[i] if i < len(llm_headers) else ''
    r0_ff = row_0_ffilled[i] if i < len(row_0_ffilled) else ''
    r1 = row_1[i] if i < len(row_1) else ''
    combined = combined_headers[i] if i < len(combined_headers) else ''
    
    markdown_content += f"| {i} | `{llm}` | `{r0_ff}` | `{r1}` | `{combined}` |\n"

# Write to file
with open('complete_column_comparison.md', 'w', encoding='utf-8') as f:
    f.write(markdown_content)

print("Generated complete_column_comparison.md")
print(f"Compared {max(len(llm_headers), len(row_0_ffilled), len(row_1), len(combined_headers))} columns total")

# Also print to console for immediate viewing
print("\nComplete Column Comparison:")
print("=" * 120)
print(f"{'Col':<3} | {'LLM Result':<25} | {'FFill Row 0':<40} | {'Row 1':<20} | {'Combined':<40}")
print("-" * 120)

for i in range(max(len(llm_headers), len(row_0_ffilled), len(row_1), len(combined_headers))):
    llm = llm_headers[i] if i < len(llm_headers) else ''
    r0_ff = row_0_ffilled[i] if i < len(row_0_ffilled) else ''
    r1 = row_1[i] if i < len(row_1) else ''
    combined = combined_headers[i] if i < len(combined_headers) else ''
    
    # Truncate for display
    llm_disp = llm[:24]
    r0_disp = r0_ff[:39] 
    r1_disp = r1[:19]
    comb_disp = combined[:39]
    
    print(f"{i:<3} | {llm_disp:<25} | {r0_disp:<40} | {r1_disp:<20} | {comb_disp:<40}")