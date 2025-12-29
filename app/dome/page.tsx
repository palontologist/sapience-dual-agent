'use client'

import DomeMarkets from '@/components/DomeMarkets'

export default function DomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
            🔮 Dome Markets
          </h1>
          <p className="text-gray-400 text-lg">
            Polymarket & Kalshi Markets with AI Forecasting
          </p>
        </header>

        {/* Dome Markets Component */}
        <DomeMarkets />

        {/* Info Section */}
        <div className="mt-8 bg-blue-900 bg-opacity-30 border border-blue-600 rounded-lg p-6">
          <h3 className="text-xl font-bold text-blue-300 mb-4">ℹ️ About Dome Integration</h3>
          <div className="text-gray-300 space-y-3 text-sm">
            <p>
              <strong className="text-white">Dome API</strong> provides aggregated access to prediction markets from multiple platforms:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong className="text-purple-300">Polymarket:</strong> Largest decentralized prediction market</li>
              <li><strong className="text-blue-300">Kalshi:</strong> CFTC-regulated prediction market exchange</li>
            </ul>
            <p>
              Click "AI Forecast" on any market to generate probability estimates, confidence scores, and trading recommendations using Groq AI.
            </p>
            <p className="text-xs text-gray-400 mt-4">
              Note: Forecasts are for informational purposes only and should not be considered financial advice.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
