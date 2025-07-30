# FastAPI Ollama Chat API

A FastAPI application that communicates with Ollama with both regular and streaming responses, including comprehensive performance monitoring.

## Features

- 🚀 **Real-time Streaming**: Stream responses as they're generated
- 📊 **Performance Monitoring**: Track tokens/second, response times, and resource usage
- 🖥️ **Resource Tracking**: Monitor GPU and RAM usage during inference
- 🎯 **Multiple Endpoints**: Choose between streaming and batch responses
- 🧹 **Clean Responses**: Simplified output for load testing

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Make sure Ollama is running on your system:
```bash
ollama serve
```

3. Run the FastAPI application:
```bash
python main.py
```

Or use uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Usage

The API will be available at `http://localhost:8000`

### Endpoints

- `GET /` - Health check endpoint
- `POST /chat` - Send a message to Ollama (full response with metrics)
- `POST /chat/simple` - Send a message to Ollama (simplified response)
- `POST /chat/stream` - **NEW!** Stream responses in real-time with Server-Sent Events

### Streaming Endpoint (Recommended)

The streaming endpoint provides real-time feedback showing:
- Connection status
- Processing updates
- Content as it's generated
- Final performance metrics

#### Example Streaming Request

```bash
curl -X POST "http://localhost:8000/chat/stream" \
     -H "Content-Type: application/json" \
     -d '{"message": "Tell me about quantum computing", "model": "qwen3:4b-q8_0"}'
```

#### Stream Response Format

The streaming endpoint returns Server-Sent Events (SSE) with different message types:

```
data: {"type": "status", "message": "Initializing request..."}

data: {"type": "status", "message": "Processing your request..."}

data: {"type": "content", "content": "Quantum computing is..."}

data: {"type": "metrics", "tokens_per_second": 45.2, "total_time_seconds": 2.1, ...}

data: [DONE]
```

### Regular Endpoints

#### Example Request

```bash
curl -X POST "http://localhost:8000/chat" \
     -H "Content-Type: application/json" \
     -d '{"message": "Explain quantum computing simply", "model": "qwen3:4b-q8_0"}'
```

#### Example Response

```json
{
    "response": "Sure! Here's a simple explanation of quantum computing...",
    "model": "qwen3:4b-q8_0",
    "created_at": "2025-07-29T15:02:11.797046Z",
    "done": true,
    "done_reason": "stop",
    "total_duration": 55788990900,
    "load_duration": 7423977700,
    "prompt_eval_count": 14,
    "prompt_eval_duration": 985081000,
    "eval_count": 795,
    "eval_duration": 47378216100,
    "tokens_per_second": 16.78,
    "prompt_tokens_per_second": 14.21,
    "total_tokens": 809,
    "total_time_seconds": 55.789,
    "load_time_seconds": 7.424,
    "prompt_eval_time_seconds": 0.985,
    "eval_time_seconds": 47.378,
    "gpu_usage_before": {
        "gpus": [
            {
                "index": 0,
                "name": "NVIDIA GeForce RTX 4090",
                "memory_used_mb": 8192,
                "memory_total_mb": 24576,
                "utilization_percent": 15
            }
        ],
        "available": true
    },
    "gpu_usage_after": {
        "gpus": [
            {
                "index": 0,
                "name": "NVIDIA GeForce RTX 4090",
                "memory_used_mb": 12288,
                "memory_total_mb": 24576,
                "utilization_percent": 85
            }
        ],
        "available": true
    },
    "ram_usage_before": {
        "total_gb": 32.0,
        "used_gb": 12.5,
        "available_gb": 19.5,
        "percent_used": 39.06
    },
    "ram_usage_after": {
        "total_gb": 32.0,
        "used_gb": 13.2,
        "available_gb": 18.8,
        "percent_used": 41.25
    },
    "resource_delta": {
        "gpu": [
            {
                "gpu_index": 0,
                "memory_delta_mb": 4096,
                "utilization_delta_percent": 70
            }
        ],
        "ram": {
            "memory_delta_gb": 0.7,
            "percent_delta": 2.19
        }
    }
}
```

## Test Clients

### HTML Client (Recommended for Testing)

Open `streaming_client.html` in your browser for a real-time chat interface:

```bash
# Start the server first
python main.py

# Then open streaming_client.html in your browser
start streaming_client.html  # Windows
# or
open streaming_client.html   # macOS
# or
xdg-open streaming_client.html  # Linux
```

The HTML client provides:
- ✨ Real-time streaming display
- 📊 Live performance metrics
- 🎛️ Model selection
- 🎨 Beautiful UI with status indicators

### Python Test Client

Test the streaming functionality programmatically:

```bash
# Test streaming endpoint
python test_streaming.py

# Test regular endpoint for comparison
python test_streaming.py simple
```

The Python client shows:
- 📡 Connection status
- 📝 Real-time content streaming
- 📈 Performance metrics
- 🔧 Resource usage deltas

### Response Fields

- `response`: The actual AI-generated response text
- `model`: The model used for generation
- `created_at`: Timestamp when the response was created
- `done`: Whether the generation is complete
- `done_reason`: Reason for completion (e.g., "stop")

#### Raw Timing Data (nanoseconds)
- `total_duration`: Total time for the request
- `load_duration`: Time to load the model
- `prompt_eval_duration`: Time to evaluate the prompt
- `eval_duration`: Time to generate tokens

#### Token Counts
- `prompt_eval_count`: Number of tokens in the prompt
- `eval_count`: Number of tokens generated
- `total_tokens`: Total tokens processed (prompt + generated)

#### Load Testing Metrics
- `tokens_per_second`: Generation speed (tokens/sec)
- `prompt_tokens_per_second`: Prompt processing speed (tokens/sec)
- `total_time_seconds`: Total request time in seconds
- `load_time_seconds`: Model load time in seconds
- `prompt_eval_time_seconds`: Prompt evaluation time in seconds
- `eval_time_seconds`: Token generation time in seconds

#### Resource Monitoring
- `gpu_usage_before/after`: GPU memory and utilization before/after request
- `ram_usage_before/after`: System RAM usage before/after request
- `resource_delta`: Calculated differences showing resource consumption per request

#### GPU Metrics (per GPU)
- `memory_used_mb`: VRAM usage in megabytes
- `memory_total_mb`: Total VRAM available
- `utilization_percent`: GPU core utilization percentage
- `memory_delta_mb`: VRAM increase during request
- `utilization_delta_percent`: GPU utilization increase during request

#### RAM Metrics
- `total_gb`: Total system RAM
- `used_gb`: Currently used RAM
- `available_gb`: Available RAM
- `percent_used`: RAM usage percentage
- `memory_delta_gb`: RAM increase during request

## Load Testing Analysis

This API provides comprehensive metrics to analyze:

1. **VRAM vs GPU Power**: Compare `memory_delta_mb` vs `utilization_delta_percent` to see if bottleneck is memory or compute
2. **Concurrent Request Impact**: Send multiple requests to see how `tokens_per_second` degrades with load
3. **Resource Scaling**: Track how `resource_delta` increases with concurrent requests
4. **Performance Optimization**: Identify if you need more VRAM or more GPU cores based on utilization patterns

## API Documentation

Once the server is running, you can access the interactive API documentation at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
