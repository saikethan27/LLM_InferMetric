import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Get distinct API URLs
    const apiUrls = await db.testResult.findMany({
      select: {
        apiUrl: true,
      },
      distinct: ['apiUrl'],
      orderBy: {
        apiUrl: 'asc',
      },
    })

    // Get distinct models
    const models = await db.testResult.findMany({
      select: {
        model: true,
      },
      distinct: ['model'],
      orderBy: {
        model: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      apiUrls: apiUrls.map(item => item.apiUrl),
      models: models.map(item => item.model),
    })
  } catch (error) {
    console.error('Error retrieving filter options:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve filter options', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
