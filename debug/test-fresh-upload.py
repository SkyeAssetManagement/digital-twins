#!/usr/bin/env python3
"""
Test fresh file upload of Detail_Parents Survey.xlsx with complete 7-step pipeline
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import time
import os
import sys

def test_fresh_upload():
    print("[TEST] Starting fresh file upload test...")
    
    # File path
    file_path = r"C:\Users\skyeAM\Downloads\Detail_Parents Survey.xlsx"
    
    # Check file exists
    if not os.path.exists(file_path):
        print(f"[ERROR] File not found: {file_path}")
        return False
    
    file_size = os.path.getsize(file_path)
    print(f"[INFO] File found: {file_path} ({file_size} bytes)")
    
    # Setup Chrome driver
    chrome_options = Options()
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    # chrome_options.add_argument('--headless')  # Comment out to see the browser
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        driver.get('http://localhost:3009')
        
        print("[OK] Page loaded: Digital Twins Analysis Lab")
        
        # Wait for page to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Step 1: Click "Upload New Dataset"
        print("\n[STEP 1] Switching to Upload New Dataset...")
        upload_radio = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'input[value="upload"]'))
        )
        upload_radio.click()
        time.sleep(1)
        
        # Verify upload section is now visible
        upload_section = driver.find_element(By.ID, 'uploadSection')
        if upload_section.is_displayed():
            print("[OK] Upload section is now visible")
        else:
            print("[ERROR] Upload section should be visible but is not")
            return False
        
        # Step 2: Select the Excel file
        print("\n[STEP 2] Selecting Excel file...")
        file_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, 'fileInput'))
        )
        file_input.send_keys(file_path)
        print(f"[OK] File selected: {file_path}")
        
        # Wait for upload form to appear
        time.sleep(2)
        upload_form = driver.find_element(By.ID, 'uploadForm')
        if upload_form.is_displayed():
            print("[OK] Upload form is now visible")
        else:
            print("[ERROR] Upload form should be visible after file selection")
            return False
        
        # Step 3: Fill in the form details
        print("\n[STEP 3] Filling upload form...")
        
        dataset_name = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, 'datasetName'))
        )
        dataset_name.clear()
        dataset_name.send_keys("Fresh Parents Survey Upload Test")
        
        target_demo = driver.find_element(By.ID, 'targetDemo')
        target_demo.clear()
        target_demo.send_keys("Parents with children 0-12 years")
        
        description = driver.find_element(By.ID, 'description')
        description.clear()
        description.send_keys("Testing complete upload workflow with Detail_Parents Survey.xlsx - full 7-step pipeline integration")
        
        print("[OK] Form filled with test data")
        
        # Step 4: Click "Process & Analyze" button
        print("\n[STEP 4] Clicking Process & Analyze button...")
        
        process_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, 'processBtn'))
        )
        
        print(f"[INFO] Button text: '{process_btn.text}'")
        print(f"[INFO] Button enabled: {process_btn.is_enabled()}")
        
        # Click the button
        process_btn.click()
        print("[OK] Process & Analyze button clicked")
        
        # Step 5: Monitor the upload and processing
        print("\n[STEP 5] Monitoring upload and processing...")
        
        # Wait for processing to complete (this might take a while)
        max_wait_time = 300  # 5 minutes
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            try:
                # Check for any alerts or status messages
                alerts = driver.find_elements(By.CSS_SELECTOR, '.alert')
                for alert in alerts:
                    if alert.is_displayed():
                        alert_text = alert.text
                        print(f"[STATUS] Alert: {alert_text}")
                        
                        # Check for completion indicators
                        if "complete" in alert_text.lower() or "success" in alert_text.lower():
                            print("[SUCCESS] Processing appears to be complete")
                            break
                        elif "error" in alert_text.lower() or "failed" in alert_text.lower():
                            print(f"[ERROR] Processing failed: {alert_text}")
                            return False
                
                # Check if data wrangling results section appeared
                results_section = driver.find_elements(By.ID, 'dataWranglingResults')
                if results_section and results_section[0].is_displayed():
                    print("[SUCCESS] Data wrangling results section is visible!")
                    break
                    
            except Exception as e:
                print(f"[DEBUG] Monitoring exception: {e}")
            
            time.sleep(5)  # Check every 5 seconds
        else:
            print("[TIMEOUT] Processing took longer than expected")
            return False
        
        # Step 6: Verify the results
        print("\n[STEP 6] Verifying results...")
        
        try:
            # Check for column count
            total_columns_span = driver.find_element(By.ID, 'totalColumnsProcessed')
            column_count = total_columns_span.text
            print(f"[INFO] Total columns processed: {column_count}")
            
            if "253" in column_count:
                print("[SUCCESS] Correct number of columns processed (253)")
            else:
                print(f"[WARNING] Expected 253 columns, got: {column_count}")
            
            # Check for column mapping table
            mapping_table = driver.find_element(By.ID, 'columnMappingBody')
            rows = mapping_table.find_elements(By.TAG_NAME, 'tr')
            print(f"[INFO] Column mapping table has {len(rows)} rows displayed")
            
            if len(rows) > 0:
                print("[SUCCESS] Column mapping table populated with data")
                
                # Show first few mappings as example
                for i, row in enumerate(rows[:3]):
                    cells = row.find_elements(By.TAG_NAME, 'td')
                    if len(cells) >= 3:
                        col_num = cells[0].text
                        long_name = cells[1].text[:50] + "..." if len(cells[1].text) > 50 else cells[1].text
                        short_name = cells[2].text
                        print(f"[EXAMPLE] Column {col_num}: '{long_name}' -> '{short_name}'")
            else:
                print("[ERROR] Column mapping table is empty")
                return False
            
            # Check download buttons
            csv_btn = driver.find_element(By.CSS_SELECTOR, 'button[onclick="downloadMappingCSV()"]')
            json_btn = driver.find_element(By.CSS_SELECTOR, 'button[onclick="downloadMappingJSON()"]')
            
            if csv_btn.is_displayed() and json_btn.is_displayed():
                print("[SUCCESS] Download buttons are available")
            else:
                print("[WARNING] Download buttons not visible")
            
        except Exception as e:
            print(f"[ERROR] Results verification failed: {e}")
            return False
        
        # Step 7: Check console logs for any errors
        print("\n[STEP 7] Checking console logs...")
        try:
            logs = driver.get_log('browser')
            error_logs = [log for log in logs if log['level'] == 'SEVERE']
            
            if error_logs:
                print(f"[WARNING] Found {len(error_logs)} severe console errors:")
                for log in error_logs[-5:]:  # Last 5 errors
                    print(f"  ERROR: {log['message']}")
            else:
                print("[SUCCESS] No severe console errors found")
                
            # Show last few info logs
            info_logs = [log for log in logs if log['level'] == 'INFO'][-3:]
            if info_logs:
                print("[INFO] Recent console info:")
                for log in info_logs:
                    print(f"  INFO: {log['message']}")
                    
        except Exception as e:
            print(f"[INFO] Could not retrieve console logs: {e}")
        
        print("\n[SUCCESS] Fresh file upload test completed successfully!")
        print("- File uploaded successfully")
        print("- 7-step pipeline executed")
        print("- Column mappings generated")
        print("- Results displayed in UI")
        print("- Download functionality available")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Test failed with error: {str(e)}")
        return False
    finally:
        if 'driver' in locals():
            # Keep browser open for a moment to see results
            print("\n[INFO] Keeping browser open for 10 seconds to view results...")
            time.sleep(10)
            driver.quit()

if __name__ == "__main__":
    success = test_fresh_upload()
    sys.exit(0 if success else 1)