'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ForecastingDashboard from '@/components/ForecastingDashboard'
import AgentControls from '@/components/AgentControls'
import MarketList from '@/components/MarketList'
import MarketComparison from '@/components/MarketComparison'

export default function Home() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'markets' | 'comparison' | 'control'>('comparison')

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
                🎯 Sapience Dual Agent
              </h1>
              <p className="text-gray-400 text-lg">
                AI-Powered Prediction Market Forecasting
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/trade')}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105"
              >
                💰 Trading Agent
              </button>
              <button
                onClick={() => router.push('/dome')}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105"
              >
                🔮 Dome Markets
              </button>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'comparison'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            🔍 Market Analysis
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'dashboard'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setActiveTab('markets')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'markets'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            🎲 Sapience Markets
          </button>
          <button
            onClick={() => setActiveTab('control')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'control'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            ⚙️ Controls
          </button>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {activeTab === 'comparison' && <MarketComparison />}
          {activeTab === 'dashboard' && <ForecastingDashboard />}
          {activeTab === 'markets' && <MarketList />}
          {activeTab === 'control' && <AgentControls />}
        </div>
      </div>
    </main>
  )
}
