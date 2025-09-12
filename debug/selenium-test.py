#!/usr/bin/env python3
"""
Selenium test to verify the actual browser workflow
Tests the exact user interaction that's failing
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import time
import sys

def test_workflow():
    print("[TEST] Starting Selenium test for Digital Twins workflow...")
    
    # Setup Chrome driver
    chrome_options = Options()
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    # chrome_options.add_argument('--headless')  # Comment out to see the browser
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        driver.get('http://localhost:3009')
        
        print("[OK] Page loaded successfully")
        print(f"[INFO] Page title: {driver.title}")
        
        # Wait for page to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        print("[INFO] Checking DOM structure...")
        
        # Check if elements exist
        elements_to_check = [
            ('existingSection', 'Existing dataset section'),
            ('uploadSection', 'Upload section'),
            ('datasetSelect', 'Dataset dropdown'),
            ('startAnalysisBtn', 'Start Analysis button')
        ]
        
        for element_id, description in elements_to_check:
            try:
                element = driver.find_element(By.ID, element_id)
                is_visible = element.is_displayed()
                status = "OK" if element else "MISSING"
                visibility = "visible" if is_visible else "hidden"
                print(f"[{status}] {description}: {visibility}")
            except Exception as e:
                print(f"[ERROR] {description}: NOT FOUND - {str(e)}")
        
        # Test the workflow that's failing
        print("\n[TEST] Testing the failing workflow...")
        
        # Step 1: Check default state (should be existing dataset)
        existing_radio = driver.find_element(By.CSS_SELECTOR, 'input[value="existing"]')
        if existing_radio.is_selected():
            print("[OK] 'Use Existing Dataset' is selected by default")
        else:
            print("[ERROR] Default selection is not 'Use Existing Dataset'")
            existing_radio.click()
            time.sleep(1)
        
        # Step 2: Select a dataset
        dataset_select = Select(driver.find_element(By.ID, 'datasetSelect'))
        options = [option.text for option in dataset_select.options]
        print(f"[INFO] Available datasets: {options}")
        
        if len(options) > 1:  # More than just "Choose a dataset..."
            dataset_select.select_by_index(1)  # Select first real dataset
            print(f"[OK] Selected dataset: {dataset_select.first_selected_option.text}")
            time.sleep(1)
        else:
            print("[ERROR] No datasets available to select")
            return False
        
        # Step 3: Find the "Start Analysis Pipeline" button
        try:
            start_btn = driver.find_element(By.ID, 'startAnalysisBtn')
            print(f"[OK] Found Start Analysis button: '{start_btn.text}'")
            print(f"[INFO] Button enabled: {start_btn.is_enabled()}")
            print(f"[INFO] Button visible: {start_btn.is_displayed()}")
        except Exception as e:
            print(f"[ERROR] Start Analysis button not found: {str(e)}")
            return False
        
        # Step 4: Look for the problematic "Process & Analyze" button
        try:
            process_btn = driver.find_element(By.ID, 'processBtn')
            print(f"[WARNING] Found Process button: '{process_btn.text}'")
            print(f"[INFO] Process button visible: {process_btn.is_displayed()}")
            print(f"[INFO] Process button enabled: {process_btn.is_enabled()}")
            
            # Check if this button is in the upload section
            upload_section = driver.find_element(By.ID, 'uploadSection')
            is_upload_visible = upload_section.is_displayed()
            print(f"[INFO] Upload section visible: {is_upload_visible}")
            
            if not is_upload_visible and process_btn.is_displayed():
                print("[ERROR] PROBLEM FOUND: Process button is visible but upload section is hidden!")
                print("   This explains why clicking it gives 'Missing form elements' error")
        except Exception as e:
            print(f"[INFO] Process button not found (this might be OK): {str(e)}")
        
        # Step 5: Click the START ANALYSIS button (not the process button)
        print("\n[ACTION] Clicking 'Start Analysis Pipeline' button...")
        try:
            start_btn.click()
            time.sleep(2)  # Wait for any processing
            
            # Check for any alerts or errors
            try:
                alert_elements = driver.find_elements(By.CSS_SELECTOR, '.alert')
                for alert in alert_elements:
                    if alert.is_displayed():
                        print(f"[ALERT] Alert found: {alert.text}")
            except:
                pass
            
            print("[OK] Button click executed successfully")
            
        except Exception as e:
            print(f"[ERROR] Failed to click Start Analysis button: {str(e)}")
            return False
        
        # Wait a bit to see what happens
        time.sleep(5)
        
        print("\n[SUMMARY] Final page state:")
        print(f"Current URL: {driver.current_url}")
        
        # Check console logs for errors
        try:
            logs = driver.get_log('browser')
            print(f"\n[LOGS] Browser console logs ({len(logs)} entries):")
            for log in logs[-10:]:  # Last 10 logs
                level = log['level']
                message = log['message']
                print(f"  {level}: {message}")
        except Exception as e:
            print(f"Could not retrieve console logs: {e}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Test failed with error: {str(e)}")
        return False
    finally:
        if 'driver' in locals():
            driver.quit()

if __name__ == "__main__":
    success = test_workflow()
    sys.exit(0 if success else 1)