#!/usr/bin/env python3
"""
Test three-stage analysis API to verify real data connection
"""

import requests
import json
import sys

def test_three_stage_analysis():
    print("🧪 Testing Three-Stage Analysis API with Real Data")
    print("=" * 55)
    
    # Test URL (server running on port 3011)
    url = "http://localhost:3011/api/three-stage-analysis/1"
    
    try:
        print(f"\n📡 Making request to: {url}")
        print("⏳ Waiting for response...")
        
        response = requests.get(url, timeout=30)
        
        print(f"\n📊 Response Status: {response.status_code}")
        print(f"📝 Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            
            print("\n✅ SUCCESS - Analysis completed!")
            
            # Check if we got real data or NA fallback
            if data.get('data_status') == 'NA':
                print("❌ Still getting NA fallback - real data not connected")
                if 'error' in data:
                    print(f"   Error: {data['error']}")
            else:
                print("✅ REAL DATA CONNECTED!")
                
                # Print key metrics
                if 'statistical_analysis' in data:
                    stats = data['statistical_analysis']
                    print(f"📈 Statistical Analysis:")
                    print(f"   Total Columns: {stats.get('total_columns', 'N/A')}")
                    print(f"   Total Responses: {stats.get('total_responses', 'N/A')}")
                
                if 'market_archetypes' in data:
                    archetypes = data['market_archetypes']
                    if 'segments' in archetypes:
                        print(f"👥 Market Archetypes: {len(archetypes['segments'])} segments found")
                        total_coverage = archetypes.get('total_market_coverage', 0)
                        print(f"📊 Total Market Coverage: {total_coverage}%")
                        
                        # List archetype names
                        for i, segment in enumerate(archetypes['segments'][:3]):  # First 3
                            name = segment.get('name', f'Segment {i+1}')
                            size = segment.get('size_percentage', 0)
                            print(f"   • {name}: {size}%")
                
                if 'digital_twin_readiness' in data:
                    readiness = data['digital_twin_readiness']
                    print(f"🤖 Digital Twin Readiness: {readiness.get('overall_score', 'N/A')}/100")
                    
        elif response.status_code == 400:
            error_data = response.json()
            print(f"❌ Bad Request - {error_data.get('error', 'Unknown error')}")
            if error_data.get('data_status') == 'NA':
                print("   📋 This confirms the API is returning NA per CLAUDE.md standards")
                
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.Timeout:
        print("⏰ Request timed out - analysis may be taking too long")
        
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - is the server running on port 3011?")
        
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    test_three_stage_analysis()