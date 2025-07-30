#!/usr/bin/env python3
"""
Simple Python client to test the streaming chat endpoint
"""

import requests
import json
import sys

def test_streaming_chat():
    """Test the streaming chat endpoint"""
    
    url = "http://localhost:8000/chat/stream"
    
    payload = {
        "message": "Tell me a short story about a robot learning to paint",
        "model": "qwen3:4b-q8_0"
    }
    
    print("🚀 Starting streaming chat test...")
    print(f"📤 Sending message: {payload['message']}")
    print(f"🤖 Using model: {payload['model']}")
    print("-" * 60)
    
    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            stream=True,
            timeout=600
        )
        
        if response.status_code == 200:
            print("✅ Connected successfully!")
            print("-" * 60)
            
            content_buffer = ""
            
            for line in response.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    
                    if line_str.startswith('data: '):
                        data_str = line_str[6:].strip()
                        
                        if data_str == '[DONE]':
                            print("\n" + "="*60)
                            print("🎉 Stream completed successfully!")
                            break
                        
                        try:
                            data = json.loads(data_str)
                            
                            if data['type'] == 'status':
                                print(f"📊 Status: {data['message']}")
                            
                            elif data['type'] == 'content':
                                content = data['content']
                                content_buffer += content
                                # Print content as it streams
                                print(content, end='', flush=True)
                            
                            elif data['type'] == 'metrics':
                                print("\n" + "-"*60)
                                print("📈 Performance Metrics:")
                                print(f"   • Total Time: {data['total_time_seconds']}s")
                                print(f"   • Tokens/Second: {data['tokens_per_second']}")
                                print(f"   • Total Tokens: {data['total_tokens']}")
                                print(f"   • Load Time: {data['load_time_seconds']}s")
                                print(f"   • Model: {data['model']}")
                                print(f"   • Eval Time: {data['eval_time_seconds']}s")
                                
                                # Show resource usage if available
                                if data.get('resource_delta'):
                                    print("\n🔧 Resource Usage:")
                                    delta = data['resource_delta']
                                    if 'ram' in delta:
                                        ram_delta = delta['ram']['memory_delta_gb']
                                        print(f"   • RAM Delta: {ram_delta:.3f} GB")
                                    if 'gpu' in delta and delta['gpu']:
                                        for gpu in delta['gpu']:
                                            mem_delta = gpu['memory_delta_mb']
                                            util_delta = gpu['utilization_delta_percent']
                                            print(f"   • GPU {gpu['gpu_index']}: {mem_delta} MB, {util_delta}% util")
                            
                            elif data['type'] == 'error':
                                print(f"❌ Error: {data['message']}")
                                break
                                
                        except json.JSONDecodeError as e:
                            print(f"⚠️  JSON decode error: {e}")
                            continue
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Cannot connect to the FastAPI server.")
        print("   Make sure the server is running on http://localhost:8000")
    except requests.exceptions.Timeout:
        print("❌ Timeout Error: Request took too long")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def test_simple_chat():
    """Test the simple non-streaming chat endpoint for comparison"""
    
    url = "http://localhost:8000/chat"
    
    payload = {
        "message": "Hello! How are you?",
        "model": "qwen3:4b-q8_0"
    }
    
    print("🔄 Testing simple (non-streaming) chat...")
    
    try:
        response = requests.post(url, json=payload, timeout=600)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Response: {data['response'][:100]}...")
            print(f"📊 Tokens/sec: {data['tokens_per_second']}")
            print(f"⏱️  Total time: {data['total_time_seconds']}s")
        else:
            print(f"❌ Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "simple":
        test_simple_chat()
    else:
        test_streaming_chat()
