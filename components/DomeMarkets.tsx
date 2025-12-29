'use client'

import { useState, useEffect } from 'react'

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

interface DomeForecast {
  marketId: string
  platform: string
  probability: number
  confidence: number
  reasoning: string
  fair_value: number
  edge: number
  recommendation: 'BUY_YES' | 'BUY_NO' | 'SKIP'
  current_yes_price: number
}

export default function DomeMarkets() {
  const [markets, setMarkets] = useState<DomeMarket[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [platform, setPlatform] = useState<'both' | 'polymarket' | 'kalshi'>('both')
  const [selectedMarket, setSelectedMarket] = useState<DomeMarket | null>(null)
  const [forecast, setForecast] = useState<DomeForecast | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMarkets()
  }, [platform])

  const fetchMarkets = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/dome/markets?platform=${platform}&limit=20`)
      const data = await response.json()
      
      if (data.success) {
        setMarkets(data.markets)
      } else {
        setError(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const generateForecast = async (market: DomeMarket) => {
    setSelectedMarket(market)
    setIsGenerating(true)
    setError(null)
    setForecast(null)
    
    try {
      const response = await fetch('/api/dome/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: market.id,
          title: market.title,
          platform: market.platform,
          yes_price: market.yes_price,
          no_price: market.no_price,
          volume: market.volume
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setForecast(data.forecast)
      } else {
        setError(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const getPlatformColor = (platform: string) => {
    return platform === 'polymarket' ? 'text-purple-400' : 'text-blue-400'
  }

  const getPlatformBadge = (platform: string) => {
    return platform === 'polymarket' 
      ? 'bg-purple-900 text-purple-300' 
      : 'bg-blue-900 text-blue-300'
  }

  const getRecommendationColor = (rec: string) => {
    switch(rec) {
      case 'BUY_YES': return 'bg-green-900 text-green-300'
      case 'BUY_NO': return 'bg-red-900 text-red-300'
      default: return 'bg-gray-700 text-gray-300'
    }
  }

  return (
    <div className="space-y-6">
      {/* Platform Filter */}
      <div className="flex gap-4 items-center">
        <h2 className="text-2xl font-bold text-white">Dome Markets</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setPlatform('both')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              platform === 'both'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All Platforms
          </button>
          <button
            onClick={() => setPlatform('polymarket')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              platform === 'polymarket'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Polymarket
          </button>
          <button
            onClick={() => setPlatform('kalshi')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              platform === 'kalshi'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Kalshi
          </button>
        </div>
        <button
          onClick={fetchMarkets}
          disabled={isLoading}
          className="ml-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
        >
          {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-600 text-red-200 rounded-lg p-4">
          ❌ {error}
        </div>
      )}

      {/* Forecast Panel */}
      {forecast && selectedMarket && (
        <div className="bg-gradient-to-br from-purple-900 to-blue-900 border-2 border-purple-500 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">🎯 AI Forecast Analysis</h3>
          
          <div className="bg-black bg-opacity-30 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPlatformBadge(selectedMarket.platform)}`}>
                {selectedMarket.platform.toUpperCase()}
              </span>
              <h4 className="text-white font-semibold flex-1">
                {selectedMarket.title}
              </h4>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-gray-300 text-sm">Current Price</div>
                <div className="text-xl font-bold text-yellow-300">{forecast.current_yes_price.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-gray-300 text-sm">AI Probability</div>
                <div className="text-2xl font-bold text-purple-300">{forecast.probability.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-gray-300 text-sm">Confidence</div>
                <div className="text-2xl font-bold text-blue-300">{forecast.confidence.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-gray-300 text-sm">Edge</div>
                <div className={`text-2xl font-bold ${forecast.edge > 5 ? 'text-green-300' : 'text-gray-300'}`}>
                  {forecast.edge > 0 ? '+' : ''}{forecast.edge.toFixed(1)}%
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <span className="text-gray-300 text-sm font-semibold">Reasoning:</span>
              <p className="text-gray-200 text-sm mt-1">{forecast.reasoning}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-gray-300 text-sm font-semibold">Recommendation:</span>
              <span className={`px-4 py-2 rounded-full text-sm font-bold ${getRecommendationColor(forecast.recommendation)}`}>
                {forecast.recommendation}
              </span>
            </div>
          </div>
          
          <button
            onClick={() => {
              setForecast(null)
              setSelectedMarket(null)
            }}
            className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* Markets List */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">⏳</div>
            <p>Loading markets...</p>
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">📊</div>
            <p>No markets found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {markets.map((market) => (
              <div 
                key={market.id}
                className="bg-gray-900 border border-gray-600 rounded-lg p-4 hover:border-purple-500 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 mr-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getPlatformBadge(market.platform)}`}>
                        {market.platform.toUpperCase()}
                      </span>
                      {market.volume > 0 && (
                        <span className="text-gray-400 text-xs">
                          Vol: ${(market.volume).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-semibold mb-1">
                      {market.title}
                    </h3>
                    {market.description && (
                      <p className="text-gray-400 text-sm mb-2">
                        {market.description.substring(0, 150)}
                        {market.description.length > 150 && '...'}
                      </p>
                    )}
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-400">
                        YES: {(market.yes_price * 100).toFixed(1)}%
                      </span>
                      <span className="text-red-400">
                        NO: {(market.no_price * 100).toFixed(1)}%
                      </span>
                      {market.close_date && (
                        <span className="text-gray-500">
                          Closes: {new Date(market.close_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => generateForecast(market)}
                    disabled={isGenerating}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-semibold text-sm transition-colors whitespace-nowrap"
                  >
                    {isGenerating && selectedMarket?.id === market.id 
                      ? '⏳ Analyzing...' 
                      : '🤖 AI Forecast'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
