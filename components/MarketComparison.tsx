'use client'

import { useState, useEffect } from 'react'

// Configuration constants
const SIMILARITY_THRESHOLD = 0.3 // Minimum similarity score to consider a match
const MIN_WORD_LENGTH = 3 // Minimum word length for similarity calculation

interface SapienceCondition {
  id: string
  question: string
  shortName?: string
  endTime: number
}

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

interface ComparisonMatch {
  sapience: SapienceCondition
  dome: DomeMarket | null
  similarity: number
  analysis: string
  recommendation: string
}

export default function MarketComparison() {
  const [sapienceMarkets, setSapienceMarkets] = useState<SapienceCondition[]>([])
  const [domeMarkets, setDomeMarkets] = useState<DomeMarket[]>([])
  const [comparisons, setComparisons] = useState<ComparisonMatch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalSapienceMarkets: 0,
    totalDomeMarkets: 0,
    potentialMatches: 0,
    highValueOpportunities: 0
  })

  useEffect(() => {
    fetchMarketsAndCompare()
  }, [])

  const fetchMarketsAndCompare = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Fetch Sapience conditions
      const sapienceResponse = await fetch('/api/conditions?limit=30')
      const sapienceData = await sapienceResponse.json()
      
      // Fetch Dome markets
      const domeResponse = await fetch('/api/dome/markets?platform=both&limit=30')
      const domeData = await domeResponse.json()
      
      if (sapienceData.success && domeData.success) {
        setSapienceMarkets(sapienceData.conditions)
        setDomeMarkets(domeData.markets)
        
        // Perform comparison analysis
        const matches = analyzeMarkets(sapienceData.conditions, domeData.markets)
        setComparisons(matches)
        
        // Calculate stats
        const highValue = matches.filter(m => 
          m.dome && (m.similarity > 0.5 || m.recommendation === 'Strong Opportunity')
        ).length
        
        setStats({
          totalSapienceMarkets: sapienceData.conditions.length,
          totalDomeMarkets: domeData.markets.length,
          potentialMatches: matches.filter(m => m.dome !== null).length,
          highValueOpportunities: highValue
        })
      } else {
        setError(sapienceData.error || domeData.error)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const analyzeMarkets = (sapience: SapienceCondition[], dome: DomeMarket[]): ComparisonMatch[] => {
    const matches: ComparisonMatch[] = []
    
    for (const sMarket of sapience) {
      let bestMatch: DomeMarket | null = null
      let bestSimilarity = 0
      
      // Try to find matching markets based on question similarity
      for (const dMarket of dome) {
        const similarity = calculateSimilarity(
          sMarket.question.toLowerCase(),
          dMarket.title.toLowerCase()
        )
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity
          bestMatch = dMarket
        }
      }
      
      // Only include if similarity threshold is met
      if (bestSimilarity < SIMILARITY_THRESHOLD) {
        bestMatch = null
        bestSimilarity = 0
      }
      
      const analysis = generateAnalysis(sMarket, bestMatch, bestSimilarity)
      const recommendation = generateRecommendation(sMarket, bestMatch, bestSimilarity)
      
      matches.push({
        sapience: sMarket,
        dome: bestMatch,
        similarity: bestSimilarity,
        analysis,
        recommendation
      })
    }
    
    // Sort by similarity and recommendation priority
    return matches.sort((a, b) => {
      if (a.dome && !b.dome) return -1
      if (!a.dome && b.dome) return 1
      return b.similarity - a.similarity
    })
  }

  const calculateSimilarity = (str1: string, str2: string): number => {
    // Simple word-based similarity calculation
    const words1 = new Set(str1.split(/\s+/).filter(w => w.length > MIN_WORD_LENGTH))
    const words2 = new Set(str2.split(/\s+/).filter(w => w.length > MIN_WORD_LENGTH))
    
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    
    return union.size > 0 ? intersection.size / union.size : 0
  }

  const generateAnalysis = (
    sapience: SapienceCondition, 
    dome: DomeMarket | null, 
    similarity: number
  ): string => {
    if (!dome) {
      return 'No matching market found in Dome API. This is a unique Sapience opportunity for early positioning.'
    }
    
    if (similarity > 0.7) {
      return `Strong match found! This market is available on both Sapience and ${dome.platform}. Compare pricing and liquidity.`
    } else if (similarity > 0.5) {
      return `Potential match on ${dome.platform}. Review market details to confirm if they're the same event.`
    } else {
      return `Weak match on ${dome.platform}. Markets may be related but not identical.`
    }
  }

  const generateRecommendation = (
    sapience: SapienceCondition, 
    dome: DomeMarket | null, 
    similarity: number
  ): string => {
    if (!dome) {
      return 'Unique Market'
    }
    
    if (similarity > 0.7) {
      return 'Strong Opportunity'
    } else if (similarity > 0.5) {
      return 'Investigate Further'
    } else {
      return 'Related Market'
    }
  }

  const getRecommendationColor = (rec: string) => {
    switch(rec) {
      case 'Strong Opportunity': return 'bg-green-900 text-green-300 border-green-500'
      case 'Investigate Further': return 'bg-yellow-900 text-yellow-300 border-yellow-500'
      case 'Related Market': return 'bg-blue-900 text-blue-300 border-blue-500'
      case 'Unique Market': return 'bg-purple-900 text-purple-300 border-purple-500'
      default: return 'bg-gray-700 text-gray-300 border-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
            🔍 Market Intelligence Analysis
          </h2>
          <p className="text-gray-400">
            Compare Sapience forecast positions against Dome API markets
          </p>
        </div>
        <button
          onClick={fetchMarketsAndCompare}
          disabled={isLoading}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105"
        >
          {isLoading ? '⏳ Analyzing...' : '🔄 Refresh Analysis'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-600 text-red-200 rounded-lg p-4">
          ❌ {error}
        </div>
      )}

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-900 to-purple-800 border border-purple-600 rounded-lg p-6">
          <div className="text-purple-200 text-sm mb-1">Sapience Markets</div>
          <div className="text-3xl font-bold text-white">{stats.totalSapienceMarkets}</div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-900 to-blue-800 border border-blue-600 rounded-lg p-6">
          <div className="text-blue-200 text-sm mb-1">Dome Markets</div>
          <div className="text-3xl font-bold text-white">{stats.totalDomeMarkets}</div>
        </div>
        
        <div className="bg-gradient-to-br from-yellow-900 to-yellow-800 border border-yellow-600 rounded-lg p-6">
          <div className="text-yellow-200 text-sm mb-1">Potential Matches</div>
          <div className="text-3xl font-bold text-white">{stats.potentialMatches}</div>
        </div>
        
        <div className="bg-gradient-to-br from-green-900 to-green-800 border border-green-600 rounded-lg p-6">
          <div className="text-green-200 text-sm mb-1">High Value Opportunities</div>
          <div className="text-3xl font-bold text-white">{stats.highValueOpportunities}</div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">💡 Key Insights & Advice</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-gray-300">
                <strong className="text-green-400">Cross-Platform Opportunities:</strong> {stats.potentialMatches} markets appear on both platforms. 
                Compare pricing between Sapience and Dome (Polymarket/Kalshi) to identify arbitrage opportunities.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-gray-300">
                <strong className="text-blue-400">Unique Positions:</strong> {stats.totalSapienceMarkets - stats.potentialMatches} Sapience markets 
                have no close match in Dome. These represent unique forecasting opportunities with potentially less competition.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <p className="text-gray-300">
                <strong className="text-purple-400">Trading Strategy:</strong> Focus on "Strong Opportunity" matches with high similarity scores. 
                These markets have sufficient data for cross-platform analysis and informed decision-making.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="text-gray-300">
                <strong className="text-yellow-400">Risk Management:</strong> Markets with lower similarity scores may be related but not identical. 
                Always verify event details before taking positions to avoid mismatched bets.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Results */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">📋 Market Comparison Results</h3>
        
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">⏳</div>
            <p>Analyzing markets...</p>
          </div>
        ) : comparisons.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">📊</div>
            <p>No markets found for comparison</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comparisons.slice(0, 20).map((comp, idx) => (
              <div 
                key={idx}
                className={`bg-gray-900 border-2 rounded-lg p-5 ${
                  comp.dome ? 'border-purple-600' : 'border-gray-600'
                }`}
              >
                {/* Sapience Market */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-900 text-purple-300">
                      SAPIENCE
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRecommendationColor(comp.recommendation)}`}>
                      {comp.recommendation}
                    </span>
                  </div>
                  <h4 className="text-white font-semibold text-lg mb-1">
                    {comp.sapience.shortName || comp.sapience.question}
                  </h4>
                  <p className="text-gray-400 text-sm">
                    Closes: {new Date(comp.sapience.endTime * 1000).toLocaleDateString()}
                  </p>
                </div>

                {/* Dome Market Match */}
                {comp.dome && (
                  <div className="mb-4 pl-4 border-l-2 border-blue-500">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        comp.dome.platform === 'polymarket' 
                          ? 'bg-purple-900 text-purple-300'
                          : 'bg-blue-900 text-blue-300'
                      }`}>
                        {comp.dome.platform.toUpperCase()}
                      </span>
                      <span className="text-yellow-400 text-sm font-semibold">
                        Match: {(comp.similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <h5 className="text-gray-200 font-semibold mb-1">
                      {comp.dome.title}
                    </h5>
                    <div className="flex gap-4 text-sm mt-2">
                      <span className="text-green-400">
                        YES: {(comp.dome.yes_price * 100).toFixed(1)}%
                      </span>
                      <span className="text-red-400">
                        NO: {(comp.dome.no_price * 100).toFixed(1)}%
                      </span>
                      {comp.dome.volume > 0 && (
                        <span className="text-gray-400">
                          Vol: ${comp.dome.volume.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Analysis */}
                <div className="bg-black bg-opacity-30 rounded-lg p-3">
                  <p className="text-gray-300 text-sm">
                    <span className="font-semibold text-blue-400">Analysis:</span> {comp.analysis}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
