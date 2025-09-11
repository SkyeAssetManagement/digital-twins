#!/usr/bin/env python3
"""
Python Data Wrangling Pipeline - Debug Version
Uses same remote database and Anthropic API as the JavaScript version
"""

import os
import sys
import json
import base64
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
import anthropic
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class PythonDataWrangler:
    def __init__(self):
        self.anthropic_client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        self.database_url = os.getenv('DATABASE_URL')
        self.connection = None
        self.original_data = None
        self.header_rows = []
        self.data_start_row = None
        self.filled_headers = []
        self.concatenated_headers = []
        self.column_mapping = {}
        
    def connect_database(self):
        """Connect to PostgreSQL database"""
        try:
            logger.info("Connecting to database...")
            self.connection = psycopg2.connect(self.database_url)
            logger.info("Database connected successfully")
            return True
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return False
    
    def get_document_from_database(self, document_id=1):
        """Retrieve document from database"""
        try:
            cursor = self.connection.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT id, name, original_filename, file_type, file_size, 
                       file_content_base64, processing_status, target_demographic, description
                FROM source_documents 
                WHERE id = %s
            """
            
            cursor.execute(query, (document_id,))
            document = cursor.fetchone()
            
            if not document:
                raise Exception(f"Document with ID {document_id} not found")
            
            logger.info(f"Retrieved document: {document['name']}")
            logger.info(f"File size: {document['file_size']} bytes")
            
            return dict(document)
            
        except Exception as e:
            logger.error(f"Failed to retrieve document: {e}")
            raise
        finally:
            cursor.close()
    
    def load_excel_from_base64(self, base64_content):
        """Load Excel data from base64 string"""
        try:
            logger.info("Decoding base64 content...")
            
            # Decode base64 to bytes
            excel_bytes = base64.b64decode(base64_content)
            
            # Load Excel file into pandas
            df = pd.read_excel(excel_bytes, sheet_name=0, header=None)
            
            # Convert to list of lists (like JavaScript version)
            self.original_data = df.values.tolist()
            
            # Fill NaN with empty strings
            for i, row in enumerate(self.original_data):
                self.original_data[i] = [str(cell) if pd.notna(cell) else '' for cell in row]
            
            logger.info(f"Loaded Excel data: {len(self.original_data)} rows x {len(self.original_data[0]) if self.original_data else 0} columns")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to load Excel data: {e}")
            return False
    
    def determine_header_rows(self):
        """Determine how many header rows exist"""
        try:
            logger.info("Determining header rows...")
            
            max_rows_to_check = min(10, len(self.original_data))
            
            for row_idx in range(max_rows_to_check):
                row = self.original_data[row_idx]
                
                # Calculate empty ratio
                empty_count = sum(1 for cell in row if cell == '' or cell == 'nan')
                empty_ratio = empty_count / len(row) if row else 1
                
                # Calculate numeric ratio  
                numeric_count = 0
                for cell in row:
                    try:
                        float(cell)
                        numeric_count += 1
                    except (ValueError, TypeError):
                        pass
                numeric_ratio = numeric_count / len(row) if row else 0
                
                logger.info(f"Row {row_idx}: empty_ratio={empty_ratio:.2f}, numeric_ratio={numeric_ratio:.2f}")
                
                # If high numeric ratio and low empty ratio, likely data row
                if numeric_ratio > 0.3 and empty_ratio < 0.5:
                    self.data_start_row = row_idx
                    break
            
            # If no clear data row found, assume headers are first 2 rows
            if self.data_start_row is None:
                self.data_start_row = 2
            
            self.header_rows = list(range(self.data_start_row))
            
            logger.info(f"Determined header rows: {self.header_rows}")
            logger.info(f"Data starts at row: {self.data_start_row}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to determine header rows: {e}")
            return False
    
    def forward_fill_headers(self):
        """Forward fill blank headers to the right"""
        try:
            logger.info("Forward filling header rows...")
            
            self.filled_headers = []
            
            for row_idx in self.header_rows:
                if row_idx >= len(self.original_data):
                    continue
                
                original_row = self.original_data[row_idx][:]
                filled_row = original_row[:]
                
                # Forward fill: propagate non-empty values to the right
                last_value = ''
                for col_idx in range(len(filled_row)):
                    if filled_row[col_idx] and filled_row[col_idx].strip():
                        last_value = filled_row[col_idx].strip()
                    elif last_value:
                        filled_row[col_idx] = last_value
                
                self.filled_headers.append(filled_row)
                logger.info(f"Row {row_idx} filled: first 5 = {filled_row[:5]}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to forward fill headers: {e}")
            return False
    
    def concatenate_headers(self):
        """Concatenate headers with | separator"""
        try:
            logger.info("Concatenating headers with | separator...")
            
            if not self.filled_headers:
                raise Exception("No filled headers to concatenate")
            
            # Find rightmost filled column
            rightmost_filled_column = 0
            for header_row in self.filled_headers:
                for col_idx in range(len(header_row) - 1, -1, -1):
                    if header_row[col_idx] and header_row[col_idx].strip():
                        rightmost_filled_column = max(rightmost_filled_column, col_idx)
                        break
            
            logger.info(f"Processing columns 0 to {rightmost_filled_column} (rightmost filled column)")
            
            # Create concatenated headers
            self.concatenated_headers = []
            
            for col_idx in range(rightmost_filled_column + 1):
                header_parts = []
                for header_row in self.filled_headers:
                    if col_idx < len(header_row) and header_row[col_idx] and header_row[col_idx].strip():
                        header_parts.append(header_row[col_idx].strip())
                
                # Join with | separator, remove duplicates
                unique_parts = []
                for part in header_parts:
                    if part not in unique_parts:
                        unique_parts.append(part)
                
                concatenated = ' | '.join(unique_parts) if unique_parts else f'Column_{col_idx}'
                self.concatenated_headers.append(concatenated)
            
            logger.info(f"Created {len(self.concatenated_headers)} concatenated headers")
            logger.info(f"Example: Column 15 = '{self.concatenated_headers[15] if len(self.concatenated_headers) > 15 else 'N/A'}'")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to concatenate headers: {e}")
            return False
    
    def generate_abbreviated_names_llm(self):
        """Use Claude to generate abbreviated column names"""
        try:
            logger.info("Generating abbreviated names with Claude Opus 4.1...")
            
            # Process in batches of 25 columns
            batch_size = 25
            abbreviated_headers = []
            
            for i in range(0, len(self.concatenated_headers), batch_size):
                batch = self.concatenated_headers[i:i + batch_size]
                
                logger.info(f"Processing batch {i//batch_size + 1}: columns {i}-{i+len(batch)-1}")
                
                # Create prompt for this batch
                batch_list = '\n'.join([f"{i+idx}. {header}" for idx, header in enumerate(batch)])
                
                prompt = f"""You are a data analysis expert. I need you to create short, meaningful abbreviated column names for survey data columns.

Here are the full column names:
{batch_list}

For each column, provide a concise abbreviation (max 20 characters) that captures the essence of the question. Focus on the key concept being measured.

Guidelines:
- Use clear, readable abbreviations 
- Include question context when important
- Use underscores for readability
- Avoid special characters except underscores
- Make names unique and descriptive

Return ONLY a JSON object with this exact format:
{{
  "abbreviations": [
    {{"original": "full name", "abbreviated": "short_name"}},
    ...
  ]
}}"""

                # Call Claude API
                response = self.anthropic_client.messages.create(
                    model="claude-opus-4-1-20250805",
                    max_tokens=2000,
                    messages=[{"role": "user", "content": prompt}]
                )
                
                # Parse response
                response_text = response.content[0].text.strip()
                
                try:
                    response_json = json.loads(response_text)
                    abbreviations = response_json.get('abbreviations', [])
                    
                    for abbrev in abbreviations:
                        abbreviated_headers.append(abbrev['abbreviated'])
                    
                    logger.info(f"Generated {len(abbreviations)} abbreviations for batch")
                    
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse LLM response as JSON: {e}")
                    # Fallback: create simple abbreviations
                    for idx, header in enumerate(batch):
                        abbreviated_headers.append(f"col_{i+idx}")
            
            # Create column mapping
            self.column_mapping = {}
            for idx, (long_name, short_name) in enumerate(zip(self.concatenated_headers, abbreviated_headers)):
                self.column_mapping[str(idx)] = {
                    'longName': long_name,
                    'shortName': short_name
                }
            
            logger.info(f"Generated {len(abbreviated_headers)} abbreviated names")
            return True
            
        except Exception as e:
            logger.error(f"Failed to generate abbreviated names: {e}")
            return False
    
    def run_complete_pipeline(self, document_id=1):
        """Run the complete data wrangling pipeline"""
        try:
            logger.info("Starting complete Python data wrangling pipeline...")
            
            # Step 1: Connect to database
            if not self.connect_database():
                return False
            
            # Step 2: Get document from database
            document = self.get_document_from_database(document_id)
            
            # Step 3: Load Excel data
            if not self.load_excel_from_base64(document['file_content_base64']):
                return False
            
            # Step 4: Determine header rows
            if not self.determine_header_rows():
                return False
            
            # Step 5: Forward fill headers
            if not self.forward_fill_headers():
                return False
            
            # Step 6: Concatenate headers
            if not self.concatenate_headers():
                return False
            
            # Step 7: Generate abbreviated names
            if not self.generate_abbreviated_names_llm():
                return False
            
            # Step 8: Print results
            logger.info("=== PIPELINE RESULTS ===")
            logger.info(f"Document: {document['name']}")
            logger.info(f"Total rows: {len(self.original_data)}")
            logger.info(f"Total columns: {len(self.original_data[0]) if self.original_data else 0}")
            logger.info(f"Header rows: {len(self.header_rows)}")
            logger.info(f"Data start row: {self.data_start_row}")
            logger.info(f"Concatenated headers: {len(self.concatenated_headers)}")
            logger.info(f"Column mappings: {len(self.column_mapping)}")
            
            # Show sample mappings
            logger.info("\nSample column mappings:")
            for i, (col_num, mapping) in enumerate(list(self.column_mapping.items())[:5]):
                long_name = mapping['longName'][:50] + ('...' if len(mapping['longName']) > 50 else '')
                logger.info(f"  Column {col_num}: '{long_name}' -> '{mapping['shortName']}'")
            
            return True
            
        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            return False
        finally:
            if self.connection:
                self.connection.close()
                logger.info("Database connection closed")

def main():
    """Main function to run the pipeline"""
    logger.info("Starting Python Data Wrangling Pipeline Debug")
    
    # Check environment variables
    if not os.getenv('DATABASE_URL'):
        logger.error("DATABASE_URL environment variable not set")
        return False
    
    if not os.getenv('ANTHROPIC_API_KEY'):
        logger.error("ANTHROPIC_API_KEY environment variable not set")
        return False
    
    # Create wrangler and run pipeline
    wrangler = PythonDataWrangler()
    success = wrangler.run_complete_pipeline(document_id=1)
    
    if success:
        logger.info("✅ Python pipeline completed successfully!")
        return True
    else:
        logger.error("❌ Python pipeline failed!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)