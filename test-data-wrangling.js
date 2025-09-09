/**
 * Test Data Wrangling with Claude Opus 4.1
 * Send actual Excel structure to Claude for analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { DATA_WRANGLING_PROMPT } from './src/prompts/data-wrangling-prompt.js';

// Initialize Claude client
const claude = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// Use the actual data structure we discovered from the mums dataset
const testDataStructure = `
Row 1: ["Respondent ID", "Collector ID", "Start Date", "End Date", "IP Address", "Email Address", "First Name", "Last Name", "Custom Data 1", "Are you?", "How old are you?", "In which State or Territory do you currently live?", "Are you currently pregnant?", "How many children do you have?", "Do you have a child aged under 12 months old?", "Within your household who typically purchases these types of baby care products?"]

Row 2: [null, null, null, null, null, null, null, null, null, "Response", "Response", "Response", "Response", "Response", "Response", "Response"]

Row 3: [114900330067, 436228068, 45854.79224537037, 45859.608715277776, "203.30.15.186", null, null, null, null, "Female", "30-45 years", "New South Wales", "No", 3, "Yes", "I do"]

Row 4: [114903225253, 436228068, 45859.32724537037, 45859.34579861111, "104.28.90.4", null, null, null, null, "Female", "30-45 years", "Victoria", "No", 2, "Yes", "I do"]

Row 5: [114903197227, 436228068, 45859.24866898148, 45859.25325231482, "103.81.124.251", null, null, null, null, "Female", "30-45 years", "New South Wales", "No", 2, "Yes", "I do"]

Additional Context:
- Total columns: 253
- Total rows: 1106
- This appears to be a parent/mother survey about baby care products
- Row 1 contains the actual question text mixed with metadata columns
- Row 2 contains "Response" labels for question columns and nulls for metadata
- Row 3+ contains the actual survey response data
`;

async function testDataWrangling() {
    try {
        console.log('=== TESTING DATA WRANGLING WITH CLAUDE OPUS 4.1 ===');
        console.log('Sending Excel structure to Claude for analysis...\n');
        
        const response = await claude.messages.create({
            model: 'claude-opus-4-1-20250805',
            max_tokens: 4000,
            temperature: 0.2, // Lower temperature for analytical precision
            messages: [{
                role: 'user',
                content: `${DATA_WRANGLING_PROMPT}

## Data Structure to Analyze

${testDataStructure}

Please analyze this survey data structure and provide a complete data wrangling plan in JSON format.`
            }]
        });

        console.log('=== CLAUDE OPUS 4.1 ANALYSIS ===');
        console.log(response.content[0].text);
        
        // Try to parse the JSON response
        try {
            const jsonMatch = response.content[0].text.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[1]);
                console.log('\n=== PARSED ANALYSIS ===');
                console.log(JSON.stringify(analysis, null, 2));
                return analysis;
            }
        } catch (parseError) {
            console.log('Could not parse JSON, but got response above');
        }
        
    } catch (error) {
        console.error('Error testing data wrangling:', error);
    }
}

testDataWrangling();