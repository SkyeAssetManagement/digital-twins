#!/usr/bin/env python3
"""
ACTUAL TEST of the upload workflow to see the exact error
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import time
import sys

def test_actual_upload():
    print("Starting REAL upload test...")
    
    chrome_options = Options()
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    # chrome_options.add_argument('--headless')
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        driver.get('http://localhost:3009')
        
        print("Page loaded")
        
        # Wait and click Upload New Dataset
        upload_radio = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'input[value="upload"]'))
        )
        upload_radio.click()
        print("Clicked Upload New Dataset")
        time.sleep(1)
        
        # Check if upload section is visible
        upload_section = driver.find_element(By.ID, 'uploadSection')
        print(f"Upload section visible: {upload_section.is_displayed()}")
        
        # Find and use file input
        file_input = driver.find_element(By.ID, 'fileInput')
        file_path = r"C:\Users\skyeAM\Downloads\Detail_Parents Survey.xlsx"
        file_input.send_keys(file_path)
        print(f"File selected: {file_path}")
        time.sleep(2)
        
        # Check if form appeared
        upload_form = driver.find_element(By.ID, 'uploadForm')
        print(f"Upload form visible: {upload_form.is_displayed()}")
        
        # Fill form
        dataset_name = driver.find_element(By.ID, 'datasetName')
        dataset_name.clear()
        dataset_name.send_keys("Test Upload")
        
        target_demo = driver.find_element(By.ID, 'targetDemo')
        target_demo.clear()
        target_demo.send_keys("Test Demographic")
        
        print("Form filled")
        
        # Now check what elements exist before clicking
        print("\n=== DOM STATE BEFORE CLICKING ===")
        
        try:
            file_input_check = driver.find_element(By.ID, 'fileInput')
            print(f"fileInput exists: {file_input_check is not None}")
            print(f"fileInput visible: {file_input_check.is_displayed()}")
            print(f"fileInput has files: {len(file_input_check.get_attribute('files') or [])}")
        except Exception as e:
            print(f"fileInput ERROR: {e}")
        
        try:
            name_input_check = driver.find_element(By.ID, 'datasetName')
            print(f"datasetName exists: {name_input_check is not None}")
            print(f"datasetName visible: {name_input_check.is_displayed()}")
            print(f"datasetName value: '{name_input_check.get_attribute('value')}'")
        except Exception as e:
            print(f"datasetName ERROR: {e}")
        
        try:
            demo_input_check = driver.find_element(By.ID, 'targetDemo')
            print(f"targetDemo exists: {demo_input_check is not None}")
            print(f"targetDemo visible: {demo_input_check.is_displayed()}")
            print(f"targetDemo value: '{demo_input_check.get_attribute('value')}'")
        except Exception as e:
            print(f"targetDemo ERROR: {e}")
        
        try:
            process_btn = driver.find_element(By.ID, 'processBtn')
            print(f"processBtn exists: {process_btn is not None}")
            print(f"processBtn visible: {process_btn.is_displayed()}")
            print(f"processBtn enabled: {process_btn.is_enabled()}")
            print(f"processBtn text: '{process_btn.text}'")
        except Exception as e:
            print(f"processBtn ERROR: {e}")
        
        print("=== SECTIONS VISIBILITY ===")
        
        try:
            upload_section = driver.find_element(By.ID, 'uploadSection')
            print(f"uploadSection visible: {upload_section.is_displayed()}")
        except Exception as e:
            print(f"uploadSection ERROR: {e}")
            
        try:
            existing_section = driver.find_element(By.ID, 'existingSection')
            print(f"existingSection visible: {existing_section.is_displayed()}")
        except Exception as e:
            print(f"existingSection ERROR: {e}")
        
        # NOW CLICK THE BUTTON
        print("\n=== CLICKING PROCESS BUTTON ===")
        process_btn = driver.find_element(By.ID, 'processBtn')
        process_btn.click()
        print("Process button clicked")
        
        # Wait for any alerts
        time.sleep(3)
        
        # Check for alerts
        try:
            alerts = driver.find_elements(By.CSS_SELECTOR, '.alert')
            for alert in alerts:
                if alert.is_displayed():
                    print(f"ALERT: {alert.text}")
        except Exception as e:
            print(f"No alerts found: {e}")
        
        # Check console logs
        try:
            logs = driver.get_log('browser')
            print(f"\n=== CONSOLE LOGS ({len(logs)} entries) ===")
            for log in logs[-10:]:
                print(f"{log['level']}: {log['message']}")
        except Exception as e:
            print(f"Could not get console logs: {e}")
        
        # Keep browser open to see what happened
        print("\nKeeping browser open for inspection...")
        time.sleep(30)
        
        return True
        
    except Exception as e:
        print(f"Test failed: {e}")
        return False
    finally:
        if 'driver' in locals():
            driver.quit()

if __name__ == "__main__":
    test_actual_upload()