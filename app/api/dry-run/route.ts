import { NextRequest, NextResponse } from 'next/server'
import { validateConfig, API_KEYS, ETHEREUM_CONFIG } from '@/src/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes timeout

interface DryRunRequest {
  maxTrades?: number
}

export async function POST(request: NextRequest) {
  try {
    const body: DryRunRequest = await request.json()
    const maxTrades = body.maxTrades || 10

    validateConfig()

    // Dynamic import to avoid bundling issues
    const { default: TradingDryRun } = await import('@/src/trading-dry-run')

    const dryRun = new TradingDryRun({
      privateKey: ETHEREUM_CONFIG.PRIVATE_KEY,
      groqApiKey: API_KEYS.GROQ_API_KEY,
      arbitrumRpcUrl: ETHEREUM_CONFIG.ARBITRUM_RPC_URL,
      maxTrades,
    })

    // Run dry run and return results
    const startTime = Date.now()
    const results = await dryRun.run()
    const duration = Date.now() - startTime

    return NextResponse.json({ 
      success: true,
      message: 'Trading dry run completed successfully',
      duration: `${(duration / 1000).toFixed(2)}s`,
      results: {
        totalMarketsAnalyzed: results.totalMarketsAnalyzed,
        tradesRecommended: results.tradesRecommended,
        tradesSkipped: results.tradesSkipped,
        avgConfidence: results.avgConfidence,
        avgEdge: results.avgEdge,
        potentialCapitalDeployed: results.potentialCapitalDeployed,
        recommendedTrades: results.decisions.filter(d => d.action === 'buy').map(d => ({
          question: d.marketQuestion,
          side: d.side,
          currentPrice: d.currentPrice,
          fairValue: d.fairValue,
          edge: d.edge,
          confidence: d.confidence,
        })),
      },
    })
  } catch (error: any) {
    console.error('Error running dry run:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
