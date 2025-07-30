"""
Data cleaning and simplification functions for GPU monitoring
"""
from typing import List, Dict, Any
from pydantic import BaseModel

class SimplifiedGPUData(BaseModel):
    """Simplified GPU monitoring data"""
    memory_delta_mb: int
    utilization_delta_percent: int
    peak_memory_mb: int
    peak_utilization_percent: int
    memory_usage_pattern: str  # "stable", "gradual_increase", "spike"

class SimplifiedRAMData(BaseModel):
    """Simplified RAM monitoring data"""
    memory_delta_gb: float
    peak_usage_gb: float
    usage_pattern: str  # "stable", "gradual_increase", "spike"

class SimplifiedResponse(BaseModel):
    """Clean and simplified response for load testing"""
    response: str
    model: str
    
    # Performance metrics
    tokens_per_second: float
    total_tokens: int
    total_time_seconds: float
    
    # Simplified resource data
    gpu_data: SimplifiedGPUData
    ram_data: SimplifiedRAMData
    
    # Load testing insights
    bottleneck_type: str  # "vram", "gpu_compute", "ram", "balanced"
    resource_efficiency: str  # "high", "medium", "low"

def analyze_usage_pattern(usage_samples: List[float], threshold_percent: float = 10) -> str:
    """Analyze if usage is stable, gradual increase, or spike"""
    if not usage_samples or len(usage_samples) < 3:
        return "insufficient_data"
    
    start_avg = sum(usage_samples[:3]) / 3
    end_avg = sum(usage_samples[-3:]) / 3
    max_val = max(usage_samples)
    min_val = min(usage_samples)
    
    # Check for spike (sudden jump > threshold)
    for i in range(1, len(usage_samples)):
        if abs(usage_samples[i] - usage_samples[i-1]) > threshold_percent:
            return "spike"
    
    # Check for gradual increase
    if end_avg > start_avg * 1.2:  # 20% increase
        return "gradual_increase"
    
    # Otherwise stable
    return "stable"

def determine_bottleneck(gpu_delta_mb: int, gpu_util_delta: int, ram_delta_gb: float, 
                        total_vram_mb: int) -> str:
    """Determine the primary bottleneck"""
    vram_usage_percent = (gpu_delta_mb / total_vram_mb) * 100
    
    # VRAM bound if using > 70% of available VRAM
    if vram_usage_percent > 70:
        return "vram"
    
    # GPU compute bound if high utilization but low VRAM
    if gpu_util_delta > 50 and vram_usage_percent < 50:
        return "gpu_compute"
    
    # RAM bound if significant RAM usage
    if ram_delta_gb > 2.0:
        return "ram"
    
    return "balanced"

def calculate_efficiency(tokens_per_second: float, gpu_util_delta: int) -> str:
    """Calculate resource efficiency based on tokens/second vs GPU usage"""
    efficiency_ratio = tokens_per_second / max(gpu_util_delta, 1)
    
    if efficiency_ratio > 0.5:
        return "high"
    elif efficiency_ratio > 0.2:
        return "medium"
    else:
        return "low"

def clean_gpu_data(raw_response: Dict[str, Any]) -> SimplifiedResponse:
    """
    Clean and simplify the massive GPU monitoring data
    Returns only essential metrics for load testing
    """
    
    # Extract basic info
    response_text = raw_response.get("response", "")
    model = raw_response.get("model", "unknown")
    tokens_per_second = raw_response.get("tokens_per_second", 0)
    total_tokens = raw_response.get("total_tokens", 0)
    total_time_seconds = raw_response.get("total_time_seconds", 0)
    
    # Extract GPU deltas
    gpu_delta = raw_response.get("resource_delta", {}).get("gpu", [{}])[0]
    memory_delta_mb = gpu_delta.get("memory_delta_mb", 0)
    utilization_delta_percent = gpu_delta.get("utilization_delta_percent", 0)
    
    # Extract RAM delta
    ram_delta = raw_response.get("resource_delta", {}).get("ram", {})
    ram_memory_delta_gb = ram_delta.get("memory_delta_gb", 0)
    
    # Extract peak values
    peak_gpu = raw_response.get("peak_gpu_usage", {}).get("gpus", [{}])[0]
    peak_memory_mb = peak_gpu.get("memory_used_mb", 0)
    peak_utilization_percent = peak_gpu.get("utilization_percent", 0)
    total_vram_mb = peak_gpu.get("memory_total_mb", 6144)
    
    peak_ram = raw_response.get("peak_ram_usage", {})
    peak_ram_gb = peak_ram.get("used_gb", 0)
    
    # Analyze patterns from during-usage data
    gpu_during = raw_response.get("gpu_usage_during", [])
    memory_samples = [sample.get("gpus", [{}])[0].get("memory_used_mb", 0) for sample in gpu_during]
    utilization_samples = [sample.get("gpus", [{}])[0].get("utilization_percent", 0) for sample in gpu_during]
    
    ram_during = raw_response.get("ram_usage_during", [])
    ram_samples = [sample.get("used_gb", 0) for sample in ram_during]
    
    # Determine patterns
    memory_pattern = analyze_usage_pattern(memory_samples, threshold_percent=500)  # 500MB threshold
    ram_pattern = analyze_usage_pattern(ram_samples, threshold_percent=0.5)  # 0.5GB threshold
    
    # Determine bottleneck and efficiency
    bottleneck = determine_bottleneck(memory_delta_mb, utilization_delta_percent, 
                                    ram_memory_delta_gb, total_vram_mb)
    efficiency = calculate_efficiency(tokens_per_second, utilization_delta_percent)
    
    # Create simplified data structures
    gpu_data = SimplifiedGPUData(
        memory_delta_mb=memory_delta_mb,
        utilization_delta_percent=utilization_delta_percent,
        peak_memory_mb=peak_memory_mb,
        peak_utilization_percent=peak_utilization_percent,
        memory_usage_pattern=memory_pattern
    )
    
    ram_data = SimplifiedRAMData(
        memory_delta_gb=round(ram_memory_delta_gb, 2),
        peak_usage_gb=round(peak_ram_gb, 2),
        usage_pattern=ram_pattern
    )
    
    return SimplifiedResponse(
        response=response_text,
        model=model,
        tokens_per_second=tokens_per_second,
        total_tokens=total_tokens,
        total_time_seconds=total_time_seconds,
        gpu_data=gpu_data,
        ram_data=ram_data,
        bottleneck_type=bottleneck,
        resource_efficiency=efficiency
    )

def print_clean_summary(simplified_data: SimplifiedResponse):
    """Print a clean, readable summary of the GPU monitoring data"""
    
    print("=" * 60)
    print("🚀 OLLAMA PERFORMANCE SUMMARY")
    print("=" * 60)
    
    print(f"📝 Response: {simplified_data.response[:100]}...")
    print(f"🤖 Model: {simplified_data.model}")
    print(f"⚡ Speed: {simplified_data.tokens_per_second} tokens/sec")
    print(f"📊 Total Tokens: {simplified_data.total_tokens}")
    print(f"⏱️  Total Time: {simplified_data.total_time_seconds}s")
    
    print("\n🎮 GPU ANALYSIS:")
    print(f"  💾 VRAM Used: {simplified_data.gpu_data.memory_delta_mb} MB")
    print(f"  🔥 GPU Utilization: {simplified_data.gpu_data.utilization_delta_percent}%")
    print(f"  📈 Peak VRAM: {simplified_data.gpu_data.peak_memory_mb} MB")
    print(f"  📈 Peak GPU: {simplified_data.gpu_data.peak_utilization_percent}%")
    print(f"  📉 Memory Pattern: {simplified_data.gpu_data.memory_usage_pattern}")
    
    print("\n🧠 RAM ANALYSIS:")
    print(f"  💾 RAM Used: {simplified_data.ram_data.memory_delta_gb} GB")
    print(f"  📈 Peak RAM: {simplified_data.ram_data.peak_usage_gb} GB")
    print(f"  📉 RAM Pattern: {simplified_data.ram_data.usage_pattern}")
    
    print("\n🎯 LOAD TESTING INSIGHTS:")
    print(f"  🚧 Bottleneck: {simplified_data.bottleneck_type.upper()}")
    print(f"  ⚡ Efficiency: {simplified_data.resource_efficiency.upper()}")
    
    # Recommendations
    print("\n💡 RECOMMENDATIONS:")
    if simplified_data.bottleneck_type == "vram":
        print("  • VRAM is the limiting factor - consider smaller model or more VRAM")
    elif simplified_data.bottleneck_type == "gpu_compute":
        print("  • GPU compute is the limiting factor - consider more powerful GPU")
    elif simplified_data.bottleneck_type == "ram":
        print("  • System RAM is the limiting factor - add more RAM")
    else:
        print("  • Resources are well balanced - good for scaling concurrent requests")
    
    if simplified_data.resource_efficiency == "low":
        print("  • Low efficiency - check for background processes or optimization")
    
    print("=" * 60)

# Example usage function
def process_ollama_response(raw_response: Dict[str, Any]) -> SimplifiedResponse:
    """
    Main function to process raw Ollama response and return clean data
    
    Usage:
        raw_data = {...}  # Your massive response
        clean_data = process_ollama_response(raw_data)
        print_clean_summary(clean_data)
    """
    return clean_gpu_data(raw_response)
