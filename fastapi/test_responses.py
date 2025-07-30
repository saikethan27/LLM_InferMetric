"""
Test script to demonstrate the difference between full and simplified responses
"""
import requests
import json
from data_cleaner import clean_gpu_data, print_clean_summary

def test_full_response():
    """Test the full detailed response"""
    url = "http://localhost:8000/chat"
    payload = {
        "message": "hi",
        "model": "qwen3:4b-q8_0"
    }
    
    print("🔍 TESTING FULL RESPONSE...")
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Full response size: {len(json.dumps(data))} characters")
        
        # Show simplified version of this data
        print("\n🧹 CLEANING THE DATA...")
        simplified = clean_gpu_data(data)
        print_clean_summary(simplified)
        
        return data
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None

def test_simplified_response():
    """Test the simplified response endpoint"""
    url = "http://localhost:8000/chat/simple"
    payload = {
        "message": "explain rust vs python",
        "model": "qwen3:4b-q8_0"
    }
    
    print("\n🎯 TESTING SIMPLIFIED RESPONSE...")
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Simplified response size: {len(json.dumps(data))} characters")
        print("\nSimplified Response:")
        print(json.dumps(data, indent=2))
        return data
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None

def compare_responses():
    """Compare both response types"""
    print("=" * 80)
    print("🚀 OLLAMA API RESPONSE COMPARISON")
    print("=" * 80)
    
    # Test both
    full_data = test_full_response()
    simplified_data = test_simplified_response()
    
    if full_data and simplified_data:
        full_size = len(json.dumps(full_data))
        simple_size = len(json.dumps(simplified_data))
        reduction = ((full_size - simple_size) / full_size) * 100
        
        print(f"\n📊 SIZE COMPARISON:")
        print(f"  Full response: {full_size:,} characters")
        print(f"  Simplified: {simple_size:,} characters")
        print(f"  Reduction: {reduction:.1f}%")
        
        print(f"\n🎯 KEY INSIGHTS FROM SIMPLIFIED DATA:")
        print(f"  • Bottleneck: {simplified_data['bottleneck_type']}")
        print(f"  • Efficiency: {simplified_data['resource_efficiency']}")
        print(f"  • VRAM Delta: {simplified_data['gpu_data']['memory_delta_mb']} MB")
        print(f"  • GPU Utilization: {simplified_data['gpu_data']['utilization_delta_percent']}%")

if __name__ == "__main__":
    compare_responses()
