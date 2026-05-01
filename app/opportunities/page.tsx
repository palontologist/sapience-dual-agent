"use client";

import OpportunitiesDashboard from "@/components/OpportunitiesDashboard";

export default function OpportunitiesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-600 mb-2">
                🎯 Best Opportunities
              </h1>
              <p className="text-gray-400 text-lg">
                AI-curated trading opportunities across all platforms
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Powered by</div>
              <div className="text-xs text-purple-400">
                Vibe Trading + Sapience AI
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard */}
        <OpportunitiesDashboard />

        {/* Info Panel */}
        <div className="mt-8 bg-purple-900 bg-opacity-30 border border-purple-600 rounded-lg p-6">
          <h3 className="text-xl font-bold text-purple-300 mb-4">
            ℹ️ How Opportunities Work
          </h3>
          <div className="text-gray-300 space-y-3 text-sm">
            <p>
              <strong className="text-white">Multi-Source Aggregation:</strong>{" "}
              We scan Sapience, Polymarket, Kalshi, and Ethereal perps to find
              the highest-edge opportunities.
            </p>
            <p>
              <strong className="text-white">Edge Calculation:</strong> Edge
              measures the gap between market price and AI-estimated true
              probability. Higher edge = better opportunity.
            </p>
            <p>
              <strong className="text-white">Vibe Scoring:</strong> Inspired by{" "}
              <a
                href="https://github.com/HKUDS/Vibe-Trading"
                className="text-purple-400 underline"
              >
                Vibe-Trading
              </a>
              , we use multi-agent analysis to score and rank opportunities.
            </p>
            <p>
              <strong className="text-white">Risk Management:</strong> Each
              opportunity includes confidence, risk score, and suggested
              position sizing. Never risk more than you can afford to lose.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
