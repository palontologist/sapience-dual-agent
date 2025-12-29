import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface DomeMarket {
  id: string
  title: string
  description: string
  platform: 'kalshi' | 'polymarket'
  yes_price: number
  no_price: number
  volume: number
  close_date?: string
  slug?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || 'both'
    const limit = parseInt(searchParams.get('limit') || '10')

    // Dynamic import to avoid bundling issues
    const { DomeClient } = await import('@dome-api/sdk')
    
    const domeClient = new DomeClient({
      apiKey: process.env.DOME_API_KEY || '',
    })

    let markets: DomeMarket[] = []

    // Fetch from Polymarket
    if (platform === 'polymarket' || platform === 'both') {
      try {
        const polyResponse = await domeClient.polymarket.markets.getMarkets({
          limit: platform === 'both' ? Math.floor(limit / 2) : limit,
        })

        const polyData = (polyResponse as any).markets || polyResponse
        const polyArray = Array.isArray(polyData) ? polyData : [polyData]
        
        const polymarkets = polyArray.map((market: any) => ({
          id: market.condition_id || market.conditionId || market.id,
          title: market.title || market.question,
          description: market.description || '',
          platform: 'polymarket' as const,
          yes_price: parseFloat(market.outcome_prices?.[0] || market.outcomePrices?.[0] || '0.5'),
          no_price: parseFloat(market.outcome_prices?.[1] || market.outcomePrices?.[1] || '0.5'),
          volume: parseFloat(market.volume_total || market.volume || '0'),
          close_date: market.end_time ? new Date(market.end_time * 1000).toISOString() : (market.end_date || market.endDate),
          slug: market.market_slug || market.slug,
        }))

        markets.push(...polymarkets)
      } catch (error) {
        console.error('Error fetching Polymarket:', error)
      }
    }

    // Fetch from Kalshi
    if (platform === 'kalshi' || platform === 'both') {
      try {
        const kalshiResponse = await domeClient.kalshi.markets.getMarkets({
          limit: platform === 'both' ? Math.floor(limit / 2) : limit,
        })

        const kalshiData = (kalshiResponse as any).markets || kalshiResponse
        const kalshiArray = Array.isArray(kalshiData) ? kalshiData : [kalshiData]
        
        const kalshiMarkets = kalshiArray.map((market: any) => ({
          id: market.ticker || market.id,
          title: market.title || market.question,
          description: market.subtitle || market.description || '',
          platform: 'kalshi' as const,
          yes_price: parseFloat(market.yes_price || market.yesPrice || '0.5'),
          no_price: parseFloat(market.no_price || market.noPrice || '0.5'),
          volume: parseFloat(market.volume || '0'),
          close_date: market.close_time || market.closeTime,
          slug: market.ticker,
        }))

        markets.push(...kalshiMarkets)
      } catch (error) {
        console.error('Error fetching Kalshi:', error)
      }
    }

    return NextResponse.json({ 
      success: true,
      markets,
      count: markets.length,
      platform
    })
  } catch (error: any) {
    console.error('Error fetching Dome markets:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
