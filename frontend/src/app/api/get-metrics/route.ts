import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apiUrl = searchParams.get('apiUrl')
    const model = searchParams.get('model')

    // Build where clause based on filters
    const where: any = {}
    if (apiUrl) {
      where.apiUrl = {
        contains: apiUrl,
      }
    }
    if (model) {
      where.model = {
        contains: model,
      }
    }

    // Get test results from database
    const results = await db.testResult.findMany({
      where,
      orderBy: [
        { timestamp: 'desc' },
        { concurrency: 'asc' }
      ],
      take: 1000, // Limit to last 1000 results
    })

    return NextResponse.json({
      success: true,
      results: results.map(result => ({
        concurrency: result.concurrency,
        message: result.message,
        model: result.model,
        latency: result.latency,
        throughput: result.throughput,
        promptThroughput: result.promptThroughput,
        totalTokens: result.totalTokens,
        loadTime: result.loadTime,
        evalTime: result.evalTime,
        gpuDelta: result.gpuDelta,
        ramDelta: result.ramDelta,
        peakGpuUtilization: result.peakGpuUtilization,
        peakGpuVramUsage: result.peakGpuVramUsage,
        peakGpuVramMb: result.peakGpuVramMb,
        peakCpuRamUsage: result.peakCpuRamUsage,
        peakCpuRamUsageMb: result.peakCpuRamUsageMb,
        gpuMemoryDelta: result.gpuMemoryDelta,
        ramMemoryDelta: result.ramMemoryDelta,
        timestamp: result.timestamp,
        apiUrl: result.apiUrl,
      })),
      count: results.length,
    })
  } catch (error) {
    console.error('Error retrieving test results:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve test results', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
