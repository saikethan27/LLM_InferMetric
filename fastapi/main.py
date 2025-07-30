from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
import requests
import json
import platform
import subprocess
import re
import psutil
import threading
import time
from typing import List, Generator
from data_cleaner import clean_gpu_data, SimplifiedResponse, print_clean_summary

app = FastAPI(title="Ollama Chat API", description="Simple FastAPI to communicate with Ollama")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
def get_gpu_usage():
    """Get GPU usage based on OS"""
    os_name = platform.system().lower()
    
    try:
        if os_name == "windows":
            # Windows: Use nvidia-smi
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=index,name,memory.used,memory.total,utilization.gpu", 
                 "--format=csv,noheader,nounits"], 
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                gpus = []
                for line in lines:
                    if line.strip():
                        parts = line.split(', ')
                        if len(parts) >= 5:
                            gpus.append({
                                "index": int(parts[0]),
                                "name": parts[1],
                                "memory_used_mb": int(parts[2]),
                                "memory_total_mb": int(parts[3]),
                                "utilization_percent": int(parts[4])
                            })
                return {"gpus": gpus, "available": True}
        else:
            # Linux: Use nvidia-smi
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=index,name,memory.used,memory.total,utilization.gpu", 
                 "--format=csv,noheader,nounits"], 
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                gpus = []
                for line in lines:
                    if line.strip():
                        parts = line.split(', ')
                        if len(parts) >= 5:
                            gpus.append({
                                "index": int(parts[0]),
                                "name": parts[1],
                                "memory_used_mb": int(parts[2]),
                                "memory_total_mb": int(parts[3]),
                                "utilization_percent": int(parts[4])
                            })
                return {"gpus": gpus, "available": True}
    except Exception as e:
        return {"error": str(e), "available": False}
    
    return {"error": "nvidia-smi not found or failed", "available": False}

def get_ram_usage():
    """Get RAM usage using psutil"""
    try:
        memory = psutil.virtual_memory()
        return {
            "total_gb": round(memory.total / (1024**3), 2),
            "used_gb": round(memory.used / (1024**3), 2),
            "available_gb": round(memory.available / (1024**3), 2),
            "percent_used": round(memory.percent, 2)
        }
    except Exception as e:
        return {"error": str(e)}

def calculate_resource_delta(before, after):
    """Calculate the difference in resource usage"""
    delta = {}
    
    # GPU delta
    if before.get("gpu_usage_before", {}).get("available") and after.get("gpu_usage_after", {}).get("available"):
        gpu_before = before["gpu_usage_before"]["gpus"]
        gpu_after = after["gpu_usage_after"]["gpus"]
        
        gpu_deltas = []
        for i, (gb, ga) in enumerate(zip(gpu_before, gpu_after)):
            gpu_deltas.append({
                "gpu_index": i,
                "memory_delta_mb": ga["memory_used_mb"] - gb["memory_used_mb"],
                "utilization_delta_percent": ga["utilization_percent"] - gb["utilization_percent"]
            })
        delta["gpu"] = gpu_deltas
    
    # RAM delta
    if "ram_usage_before" in before and "ram_usage_after" in after:
        ram_before = before["ram_usage_before"]
        ram_after = after["ram_usage_after"]
        
        if "error" not in ram_before and "error" not in ram_after:
            delta["ram"] = {
                "memory_delta_gb": round(ram_after["used_gb"] - ram_before["used_gb"], 3),
                "percent_delta": round(ram_after["percent_used"] - ram_before["percent_used"], 2)
            }
    
    return delta

def monitor_resources_during_streaming(monitoring_data, stop_event, interval=0.5):
    """Monitor GPU and RAM usage during streaming"""
    while not stop_event.is_set():
        timestamp = time.time()
        gpu_usage = get_gpu_usage()
        ram_usage = get_ram_usage()
        
        monitoring_data["gpu_samples"].append({
            "timestamp": timestamp,
            "usage": gpu_usage
        })
        monitoring_data["ram_samples"].append({
            "timestamp": timestamp,
            "usage": ram_usage
        })
        
        time.sleep(interval)

def calculate_peak_usage(samples, metric_type):
    """Calculate peak usage from monitoring samples"""
    if not samples:
        return None
    
    if metric_type == "gpu":
        peak_memory_mb = 0
        peak_memory_percent = 0
        peak_utilization = 0
        
        for sample in samples:
            if sample["usage"].get("available"):
                for gpu in sample["usage"]["gpus"]:
                    if gpu["memory_used_mb"] > peak_memory_mb:
                        peak_memory_mb = gpu["memory_used_mb"]
                    if gpu["memory_percent"] > peak_memory_percent:
                        peak_memory_percent = gpu["memory_percent"]
                    if gpu["utilization_percent"] > peak_utilization:
                        peak_utilization = gpu["utilization_percent"]
        
        return {
            "peak_gpu_utilization_%": peak_utilization,
            "peak_gpu_vram_usage_%": peak_memory_percent,
            "peak_gpu_vram_mb": peak_memory_mb
        } if peak_memory_mb > 0 or peak_utilization > 0 else None
    
    elif metric_type == "ram":
        peak_usage_gb = 0
        peak_usage_percent = 0
        
        for sample in samples:
            if "error" not in sample["usage"]:
                if sample["usage"]["used_gb"] > peak_usage_gb:
                    peak_usage_gb = sample["usage"]["used_gb"]
                if sample["usage"]["percent_used"] > peak_usage_percent:
                    peak_usage_percent = sample["usage"]["percent_used"]
        
        return {
            "peak_cpu_ram_usage_%": peak_usage_percent,
            "peak_cpu_ram_usage_mb": round(peak_usage_gb * 1024, 2)
        } if peak_usage_gb > 0 else None

class MessageRequest(BaseModel):
    concurrency : int
    message: str
    model: str = "qwen3:4b-q8_0"  # Default model, can be changed

class MessageResponse(BaseModel):
    response: str
    model: str
    created_at: str
    done: bool
    done_reason: str = None
    # Raw timing data (nanoseconds)
    total_duration: int = None
    load_duration: int = None
    prompt_eval_count: int = None
    prompt_eval_duration: int = None
    eval_count: int = None
    eval_duration: int = None
    # Calculated metrics for load testing
    tokens_per_second: float = None
    prompt_tokens_per_second: float = None
    total_tokens: int = None
    total_time_seconds: float = None
    load_time_seconds: float = None
    prompt_eval_time_seconds: float = None
    eval_time_seconds: float = None
    # Resource monitoring
    gpu_usage_before: dict = None
    gpu_usage_after: dict = None
    ram_usage_before: dict = None
    ram_usage_after: dict = None
    resource_delta: dict = None
    # Real-time monitoring during streaming
    gpu_usage_during: List[dict] = None
    ram_usage_during: List[dict] = None
    peak_gpu_usage: dict = None
    peak_ram_usage: dict = None

@app.get("/")
async def root():
    return {"message": "FastAPI llm Model inference testing Chat API is running!"}

@app.post("/chat/simple", response_model=SimplifiedResponse)
async def chat_simple(request: MessageRequest):
    """
    Send a message to Ollama and get a clean, simplified response for load testing
    """
    # Call the full chat endpoint internally
    full_response = await chat_with_ollama(request)
    
    # Convert to dict and clean
    response_dict = full_response.dict()
    simplified = clean_gpu_data(response_dict)
    
    return simplified

@app.post("/chat", response_model=MessageResponse)
async def chat_with_ollama(request: MessageRequest):
    """
    Send a message to Ollama with streaming and real-time resource monitoring
    """
    try:
        # Get resource usage before request
        gpu_before = get_gpu_usage()
        ram_before = get_ram_usage()
        
        # Setup real-time monitoring
        monitoring_data = {
            "gpu_samples": [],
            "ram_samples": []
        }
        stop_monitoring = threading.Event()
        
        # Ollama API endpoint (default local installation)
        ollama_url = "http://localhost:11434/api/chat"
        
        # Prepare the request payload for Ollama with streaming
        payload = {
            "model": request.model,
            "messages": [
                {
                    "role": "user",
                    "content": request.message
                }
            ],
            "stream": True
        }
        
        # Start resource monitoring in background thread
        monitor_thread = threading.Thread(
            target=monitor_resources_during_streaming,
            args=(monitoring_data, stop_monitoring, 0.2)  # Monitor every 200ms
        )
        monitor_thread.start()
        
        # Send streaming request to Ollama
        response = requests.post(
            ollama_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=600,
            stream=True
        )
        
        # Process streaming response
        full_response = ""
        final_data = None
        
        if response.status_code == 200:
            for line in response.iter_lines():
                if line:
                    try:
                        chunk = json.loads(line.decode('utf-8'))
                        if "message" in chunk and "content" in chunk["message"]:
                            full_response += chunk["message"]["content"]
                        
                        # Store the final chunk with metadata
                        if chunk.get("done", False):
                            final_data = chunk
                            break
                    except json.JSONDecodeError:
                        continue
        
        # Stop monitoring
        stop_monitoring.set()
        monitor_thread.join()
        
        # Get resource usage after request
        gpu_after = get_gpu_usage()
        ram_after = get_ram_usage()
        
        if response.status_code == 200 and final_data:
            # Extract the content from the final response
            message_content = full_response or "No response from Ollama"
            
            # Raw data from Ollama (from final chunk)
            total_duration = final_data.get("total_duration", 0)
            load_duration = final_data.get("load_duration", 0)
            prompt_eval_count = final_data.get("prompt_eval_count", 0)
            prompt_eval_duration = final_data.get("prompt_eval_duration", 0)
            eval_count = final_data.get("eval_count", 0)
            eval_duration = final_data.get("eval_duration", 0)
            
            # Calculate metrics for load testing
            total_time_seconds = total_duration / 1_000_000_000 if total_duration else 0
            load_time_seconds = load_duration / 1_000_000_000 if load_duration else 0
            prompt_eval_time_seconds = prompt_eval_duration / 1_000_000_000 if prompt_eval_duration else 0
            eval_time_seconds = eval_duration / 1_000_000_000 if eval_duration else 0
            
            tokens_per_second = eval_count / eval_time_seconds if eval_time_seconds > 0 and eval_count > 0 else 0
            prompt_tokens_per_second = prompt_eval_count / prompt_eval_time_seconds if prompt_eval_time_seconds > 0 and prompt_eval_count > 0 else 0
            total_tokens = prompt_eval_count + eval_count
            
            # Calculate resource deltas
            resource_data = {
                "gpu_usage_before": gpu_before,
                "gpu_usage_after": gpu_after,
                "ram_usage_before": ram_before,
                "ram_usage_after": ram_after
            }
            resource_delta = calculate_resource_delta(resource_data, resource_data)
            
            # Calculate peak usage during streaming
            peak_gpu = calculate_peak_usage(monitoring_data["gpu_samples"], "gpu")
            peak_ram = calculate_peak_usage(monitoring_data["ram_samples"], "ram")
            
            return MessageResponse(
                response=message_content,
                model=final_data.get("model", "unknown"),
                created_at=final_data.get("created_at", ""),
                done=final_data.get("done", False),
                done_reason=final_data.get("done_reason"),
                total_duration=total_duration,
                load_duration=load_duration,
                prompt_eval_count=prompt_eval_count,
                prompt_eval_duration=prompt_eval_duration,
                eval_count=eval_count,
                eval_duration=eval_duration,
                tokens_per_second=round(tokens_per_second, 2),
                prompt_tokens_per_second=round(prompt_tokens_per_second, 2),
                total_tokens=total_tokens,
                total_time_seconds=round(total_time_seconds, 3),
                load_time_seconds=round(load_time_seconds, 3),
                prompt_eval_time_seconds=round(prompt_eval_time_seconds, 3),
                eval_time_seconds=round(eval_time_seconds, 3),
                gpu_usage_before=gpu_before,
                gpu_usage_after=gpu_after,
                ram_usage_before=ram_before,
                ram_usage_after=ram_after,
                resource_delta=resource_delta,
                gpu_usage_during=[sample["usage"] for sample in monitoring_data["gpu_samples"]],
                ram_usage_during=[sample["usage"] for sample in monitoring_data["ram_samples"]],
                peak_gpu_usage=peak_gpu,
                peak_ram_usage=peak_ram
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Ollama API error: {response.status_code} - {response.text}"
            )
            
    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail="Cannot connect to Ollama. Make sure Ollama is running on localhost:11434"
        )
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Request to Ollama timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )

@app.post("/chat/stream")
async def chat_stream(request: MessageRequest):
    """
    Stream chat responses in real-time using Server-Sent Events (SSE)
    """
    def generate_stream() -> Generator[str, None, None]:
        try:
            # Send initial status
            yield f"data: {json.dumps({'type': 'status', 'message': 'Initializing request...'})}\n\n"
            
            # Get resource usage before request
            gpu_before = get_gpu_usage()
            ram_before = get_ram_usage()
            
            yield f"data: {json.dumps({'type': 'status', 'message': 'Monitoring resources...'})}\n\n"
            
            # Setup real-time monitoring
            monitoring_data = {
                "gpu_samples": [],
                "ram_samples": []
            }
            stop_monitoring = threading.Event()
            
            # Ollama API endpoint
            ollama_url = "http://localhost:11434/api/chat"
            
            # Prepare the request payload for Ollama with streaming
            payload = {
                "model": request.model,
                "messages": [
                    {
                        "role": "user",
                        "content": request.message
                    }
                ],
                "stream": True
            }
            
            yield f"data: {json.dumps({'type': 'status', 'message': 'Connecting to Ollama...'})}\n\n"
            
            # Start resource monitoring in background thread
            monitor_thread = threading.Thread(
                target=monitor_resources_during_streaming,
                args=(monitoring_data, stop_monitoring, 0.2)
            )
            monitor_thread.start()
            
            yield f"data: {json.dumps({'type': 'status', 'message': 'Processing your request...'})}\n\n"
            
            # Send streaming request to Ollama
            response = requests.post(
                ollama_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=600,
                stream=True
            )
            
            if response.status_code != 200:
                yield f"data: {json.dumps({'type': 'error', 'message': f'Ollama API error: {response.status_code}'})}\n\n"
                return
            
            yield f"data: {json.dumps({'type': 'status', 'message': 'Receiving response...'})}\n\n"
            
            # Process streaming response
            full_response = ""
            final_data = None
            
            for line in response.iter_lines():
                if line:
                    try:
                        chunk = json.loads(line.decode('utf-8'))
                        
                        if "message" in chunk and "content" in chunk["message"]:
                            content = chunk["message"]["content"]
                            full_response += content
                            
                            # Stream the content as it arrives
                            yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                        
                        # Store the final chunk with metadata
                        if chunk.get("done", False):
                            final_data = chunk
                            break
                            
                    except json.JSONDecodeError:
                        continue
            
            # Stop monitoring
            stop_monitoring.set()
            monitor_thread.join()
            
            # Get resource usage after request
            gpu_after = get_gpu_usage()
            ram_after = get_ram_usage()
            
            yield f"data: {json.dumps({'type': 'status', 'message': 'Calculating metrics...'})}\n\n"
            
            if final_data:
                # Calculate all metrics
                total_duration = final_data.get("total_duration", 0)
                load_duration = final_data.get("load_duration", 0)
                prompt_eval_count = final_data.get("prompt_eval_count", 0)
                prompt_eval_duration = final_data.get("prompt_eval_duration", 0)
                eval_count = final_data.get("eval_count", 0)
                eval_duration = final_data.get("eval_duration", 0)
                
                # Calculate metrics
                total_time_seconds = total_duration / 1_000_000_000 if total_duration else 0
                load_time_seconds = load_duration / 1_000_000_000 if load_duration else 0
                prompt_eval_time_seconds = prompt_eval_duration / 1_000_000_000 if prompt_eval_duration else 0
                eval_time_seconds = eval_duration / 1_000_000_000 if eval_duration else 0
                
                tokens_per_second = eval_count / eval_time_seconds if eval_time_seconds > 0 and eval_count > 0 else 0
                prompt_tokens_per_second = prompt_eval_count / prompt_eval_time_seconds if prompt_eval_time_seconds > 0 and prompt_eval_count > 0 else 0
                total_tokens = prompt_eval_count + eval_count
                
                # Calculate resource deltas
                resource_data = {
                    "gpu_usage_before": gpu_before,
                    "gpu_usage_after": gpu_after,
                    "ram_usage_before": ram_before,
                    "ram_usage_after": ram_after
                }
                resource_delta = calculate_resource_delta(resource_data, resource_data)
                
                # Calculate peak usage
                peak_gpu = calculate_peak_usage(monitoring_data["gpu_samples"], "gpu")
                peak_ram = calculate_peak_usage(monitoring_data["ram_samples"], "ram")
                
                # Send final metrics
                metrics = {
                    "type": "metrics",
                    "model": final_data.get("model", "unknown"),
                    "created_at": final_data.get("created_at", ""),
                    "done": True,
                    "total_duration": total_duration,
                    "tokens_per_second": round(tokens_per_second, 2),
                    "prompt_tokens_per_second": round(prompt_tokens_per_second, 2),
                    "total_tokens": total_tokens,
                    "total_time_seconds": round(total_time_seconds, 3),
                    "load_time_seconds": round(load_time_seconds, 3),
                    "prompt_eval_time_seconds": round(prompt_eval_time_seconds, 3),
                    "eval_time_seconds": round(eval_time_seconds, 3),
                    "resource_delta": resource_delta,
                    "peak_gpu_usage": peak_gpu,
                    "peak_ram_usage": peak_ram
                }
                
                yield f"data: {json.dumps(metrics)}\n\n"
            
            yield f"data: {json.dumps({'type': 'status', 'message': 'Complete!'})}\n\n"
            yield "data: [DONE]\n\n"
            
        except requests.exceptions.ConnectionError:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Cannot connect to Ollama. Make sure Ollama is running on localhost:11434'})}\n\n"
        except requests.exceptions.Timeout:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Request to Ollama timed out'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Unexpected error: {str(e)}'})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
