import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiUrl, model, results, timestamp } = body

    if (!apiUrl || !model || !results || !Array.isArray(results)) {
      return NextResponse.json(
        { error: 'Missing required fields: apiUrl, model, results' },
        { status: 400 }
      )
    }

    // Save each test result to the database
    const savedResults = await Promise.all(
      results.map(async (result: any) => {
        return await db.testResult.create({
          data: {
            apiUrl,
            model,
            concurrency: result.concurrency,
            message: result.message,
            latency: result.latency,
            throughput: result.throughput,
            promptThroughput: result.promptThroughput,
            totalTokens: result.totalTokens,
            loadTime: result.loadTime,
            evalTime: result.evalTime,
            gpuDelta: result.gpuDelta,
            ramDelta: result.ramDelta,
            peakGpuUtilization: result.peak_gpu_usage?.["peak_gpu_utilization_%"] || null,
            peakGpuVramUsage: result.peak_gpu_usage?.["peak_gpu_vram_usage_%"] || null,
            peakGpuVramMb: result.peak_gpu_usage?.["peak_gpu_vram_mb"] || null,
            peakCpuRamUsage: result.peak_ram_usage?.["peak_cpu_ram_usage_%"] || null,
            peakCpuRamUsageMb: result.peak_ram_usage?.["peak_cpu_ram_usage_mb"] || null,
            gpuMemoryDelta: result.gpuMemoryDelta,
            ramMemoryDelta: result.ramMemoryDelta,
            timestamp: new Date(timestamp),
          },
        })
      })
    )

    return NextResponse.json({
      success: true,
      message: `Saved ${savedResults.length} test results`,
      savedCount: savedResults.length,
    })
  } catch (error) {
    console.error('Error saving test results:', error)
    return NextResponse.json(
      { error: 'Failed to save test results', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
