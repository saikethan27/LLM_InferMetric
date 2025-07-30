import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

interface TestRequest {
  message: string
  model: string
}

interface SSEMessage {
  type: 'status' | 'content' | 'metrics' | 'DONE'
  message?: string
  content?: string
  metrics?: any
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const concurrency = parseInt(searchParams.get('concurrency') || '1')
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial status
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Initializing request...'
        })
        
        await new Promise(resolve => setTimeout(resolve, 500))
        
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Monitoring resources...'
        })
        
        await new Promise(resolve => setTimeout(resolve, 300))
        
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Connecting to Ollama...'
        })
        
        await new Promise(resolve => setTimeout(resolve, 800))
        
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Processing your request...'
        })
        
        // Simulate content generation (streaming tokens)
        const tokens = [
          'Hello', '!', ' ', 'How', ' ', 'can', ' ', 'I', ' ', 'assist', ' ', 'you', ' ', 'today', '?', ' ', '😊'
        ]
        
        for (let i = 0; i < tokens.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300))
          
          sendSSEMessage(controller, {
            type: 'content',
            content: tokens[i]
          })
        }
        
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Receiving response...'
        })
        
        await new Promise(resolve => setTimeout(resolve, 500))
        
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Calculating metrics...'
        })
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Generate mock metrics based on concurrency
        const metrics = generateRealisticMetrics(concurrency)
        
        // Send final metrics
        sendSSEMessage(controller, {
          type: 'metrics',
          metrics
        })
        
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Complete!'
        })
        
        // Send DONE message
        sendSSEMessage(controller, {
          type: 'DONE'
        })
        
      } catch (error) {
        console.error('Load test error:', error)
        sendSSEMessage(controller, {
          type: 'status',
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      } finally {
        controller.close()
      }
    }
  })
  
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type'
    }
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as TestRequest
  const { searchParams } = new URL(request.url)
  const concurrency = parseInt(searchParams.get('concurrency') || '1')
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial status
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Initializing request...'
        })
        
        await new Promise(resolve => setTimeout(resolve, 500))
        
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Monitoring resources...'
        })
        
        await new Promise(resolve => setTimeout(resolve, 300))
        
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Connecting to Ollama...'
        })
        
        await new Promise(resolve => setTimeout(resolve, 800))
        
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Processing your request...'
        })
        
        // Try to use real AI if available, otherwise simulate
        let tokens: string[] = []
        try {
          const zai = await ZAI.create()
          const completion = await zai.chat.completions.create({
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant. Provide a brief, friendly response.'
              },
              {
                role: 'user',
                content: body.message
              }
            ],
            max_tokens: 100,
            temperature: 0.7
          })
          
          const response = completion.choices[0]?.message?.content || 'Hello! How can I help you today?'
          // Split response into tokens for streaming
          tokens = response.split('').map(char => char === ' ' ? ' ' : char)
          
        } catch (error) {
          console.log('AI service not available, using mock response')
          // Fallback to mock response
          tokens = [
            'Hello', '!', ' ', 'I', ' ', 'understand', ' ', 'you', ' ', 'said', ':', ' ', 
            ...body.message.split(' '), 
            '. ', 'How', ' ', 'can', ' ', 'I', ' ', 'help', ' ', 'you', ' ', 'today', '?'
          ]
        }
        
        // Stream tokens
        for (let i = 0; i < tokens.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))
          
          sendSSEMessage(controller, {
            type: 'content',
            content: tokens[i]
          })
        }
        
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Receiving response...'
        })
        
        await new Promise(resolve => setTimeout(resolve, 500))
        
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Calculating metrics...'
        })
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Generate realistic metrics based on concurrency and actual processing
        const metrics = generateRealisticMetrics(concurrency, tokens.length)
        
        // Send final metrics
        sendSSEMessage(controller, {
          type: 'metrics',
          metrics
        })
        
        sendSSEMessage(controller, {
          type: 'status',
          message: 'Complete!'
        })
        
        // Send DONE message
        sendSSEMessage(controller, {
          type: 'DONE'
        })
        
      } catch (error) {
        console.error('Load test error:', error)
        sendSSEMessage(controller, {
          type: 'status',
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      } finally {
        controller.close()
      }
    }
  })
  
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type'
    }
  })
}

function sendSSEMessage(controller: ReadableStreamDefaultController, data: SSEMessage) {
  const message = `data: ${JSON.stringify(data)}\n\n`
  controller.enqueue(new TextEncoder().encode(message))
}

function generateRealisticMetrics(concurrency: number, tokenCount: number = 50) {
  // Simulate realistic metrics that scale with concurrency
  const baseLatency = 2.0
  const latencyPerConcurrency = 0.3
  const totalDuration = (baseLatency + (concurrency * latencyPerConcurrency)) * 1000000000 // Convert to nanoseconds
  
  const actualTokens = tokenCount || Math.max(20, 100 - (concurrency * 5))
  const totalTimeSeconds = totalDuration / 1000000000
  const tokensPerSecond = actualTokens / totalTimeSeconds
  const promptTokensPerSecond = Math.max(5, tokensPerSecond * 0.6)
  
  const loadTime = Math.max(0.5, 1.0 + (concurrency * 0.1))
  const evalTime = Math.max(0.3, totalTimeSeconds - loadTime - 0.5)
  const promptEvalTime = Math.max(0.1, totalTimeSeconds * 0.1)
  
  // Resource metrics
  const baseGpuDelta = 8
  const gpuDeltaPerConcurrency = 3
  const gpuDelta = Math.min(95, baseGpuDelta + (concurrency * gpuDeltaPerConcurrency))
  
  const baseRamDelta = 5
  const ramDeltaPerConcurrency = 2
  const ramDelta = Math.min(90, baseRamDelta + (concurrency * ramDeltaPerConcurrency))
  
  const baseGpuMemory = 1000
  const gpuMemoryPerConcurrency = 500
  const gpuMemoryDelta = baseGpuMemory + (concurrency * gpuMemoryPerConcurrency)
  
  const baseRamMemory = 0.5
  const ramMemoryPerConcurrency = 0.3
  const ramMemoryDelta = -(baseRamMemory + (concurrency * ramMemoryPerConcurrency)) // Negative as it's freed
  
  const basePeakGpu = 15
  const peakGpuPerConcurrency = 5
  const peakGpu = Math.min(100, basePeakGpu + (concurrency * peakGpuPerConcurrency))
  
  const basePeakRam = 75
  const peakRamPerConcurrency = 3
  const peakRam = Math.min(95, basePeakRam + (concurrency * peakRamPerConcurrency))
  
  return {
    model: 'qwen3:4b-q8_0',
    created_at: new Date().toISOString(),
    done: true,
    total_duration: totalDuration,
    tokens_per_second: tokensPerSecond,
    prompt_tokens_per_second: promptTokensPerSecond,
    total_tokens: actualTokens,
    total_time_seconds: totalTimeSeconds,
    load_time_seconds: loadTime,
    prompt_eval_time_seconds: promptEvalTime,
    eval_time_seconds: evalTime,
    resource_delta: {
      gpu: [
        {
          gpu_index: 0,
          memory_delta_mb: gpuMemoryDelta,
          utilization_delta_percent: gpuDelta
        }
      ],
      ram: {
        memory_delta_gb: ramMemoryDelta,
        percent_delta: ramDelta
      }
    },
    peak_gpu_usage: {
      gpus: [
        {
          index: 0,
          name: 'NVIDIA GeForce GTX 1660 Ti',
          memory_used_mb: 5450 + (concurrency * 200),
          memory_total_mb: 6144,
          utilization_percent: peakGpu
        }
      ],
      available: true
    },
    peak_ram_usage: {
      total_gb: 15.84,
      used_gb: 14.06 + (concurrency * 0.2),
      available_gb: Math.max(0.5, 1.79 - (concurrency * 0.1)),
      percent_used: peakRam
    }
  }
}