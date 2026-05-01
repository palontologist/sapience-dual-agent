"use client";

import { useState, useEffect } from "react";

interface MarketOpportunity {
  id: string;
  title: string;
  description: string;
  platform: "sapience" | "polymarket" | "kalshi" | "ethereal";
  type: "prediction" | "perpetual" | "vibe";
  currentPrice?: number;
  yesPrice?: number;
  noPrice?: number;
  confidence: number;
  edge: number;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "SKIP";
  expectedReturn: number;
  riskScore: number;
  reasoning: string;
  closeDate?: string;
  volume?: number;
  leverage?: number;
  takeProfit?: number;
  stopLoss?: number;
}

interface OpportunityStats {
  total: number;
  strongBuy: number;
  buy: number;
  avgEdge: number;
  avgExpectedReturn: number;
  platforms: {
    sapience: number;
    polymarket: number;
    kalshi: number;
    ethereal: number;
  };
}

export default function OpportunitiesDashboard() {
  const [opportunities, setOpportunities] = useState<MarketOpportunity[]>([]);
  const [stats, setStats] = useState<OpportunityStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string>("all");
  const [minEdge, setMinEdge] = useState<number>(2);
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<MarketOpportunity | null>(null);

  useEffect(() => {
    fetchOpportunities();
  }, [platform, minEdge]);

  const fetchOpportunities = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/opportunities?platform=${platform}&minEdge=${minEdge}&limit=30`,
      );
      const data = await response.json();

      if (data.success) {
        setOpportunities(data.opportunities);
        setStats(data.stats);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case "STRONG_BUY":
        return "bg-green-600 text-white";
      case "BUY":
        return "bg-green-500 text-white";
      case "HOLD":
        return "bg-yellow-600 text-white";
      case "SELL":
        return "bg-red-500 text-white";
      case "SKIP":
        return "bg-gray-600 text-gray-300";
      default:
        return "bg-gray-600 text-gray-300";
    }
  };

  const getPlatformBadge = (platform: string) => {
    switch (platform) {
      case "sapience":
        return "bg-purple-900 text-purple-300";
      case "polymarket":
        return "bg-blue-900 text-blue-300";
      case "kalshi":
        return "bg-cyan-900 text-cyan-300";
      case "ethereal":
        return "bg-pink-900 text-pink-300";
      default:
        return "bg-gray-700 text-gray-300";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "prediction":
        return "🎯";
      case "perpetual":
        return "📈";
      case "vibe":
        return "✨";
      default:
        return "📊";
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4 items-center">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2"
            >
              <option value="all">All Platforms</option>
              <option value="sapience">Sapience</option>
              <option value="polymarket">Polymarket</option>
              <option value="kalshi">Kalshi</option>
              <option value="ethereal">Ethereal Perps</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">
              Min Edge %
            </label>
            <select
              value={minEdge}
              onChange={(e) => setMinEdge(Number(e.target.value))}
              className="bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2"
            >
              <option value={1}>1%</option>
              <option value={2}>2%</option>
              <option value={5}>5%</option>
              <option value={10}>10%</option>
            </select>
          </div>
        </div>
        <button
          onClick={fetchOpportunities}
          disabled={isLoading}
          className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105"
        >
          {isLoading ? "⏳ Refreshing..." : "🔄 Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-600 text-red-200 rounded-lg p-4">
          ❌ {error}
        </div>
      )}

      {/* Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-900 to-green-800 border border-green-600 rounded-lg p-4">
            <div className="text-green-200 text-sm">Total Opportunities</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-900 to-purple-800 border border-purple-600 rounded-lg p-4">
            <div className="text-purple-200 text-sm">Strong Buy</div>
            <div className="text-2xl font-bold text-white">
              {stats.strongBuy}
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 border border-blue-600 rounded-lg p-4">
            <div className="text-blue-200 text-sm">Avg Edge</div>
            <div className="text-2xl font-bold text-white">
              {stats.avgEdge.toFixed(1)}%
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-900 to-yellow-800 border border-yellow-600 rounded-lg p-4">
            <div className="text-yellow-200 text-sm">Expected Return</div>
            <div className="text-2xl font-bold text-white">
              {stats.avgExpectedReturn.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Platform Breakdown */}
      {stats && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-bold text-white mb-3">
            Platform Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-purple-400 font-bold text-xl">
                {stats.platforms.sapience}
              </div>
              <div className="text-gray-400 text-sm">Sapience</div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-bold text-xl">
                {stats.platforms.polymarket}
              </div>
              <div className="text-gray-400 text-sm">Polymarket</div>
            </div>
            <div className="text-center">
              <div className="text-cyan-400 font-bold text-xl">
                {stats.platforms.kalshi}
              </div>
              <div className="text-gray-400 text-sm">Kalshi</div>
            </div>
            <div className="text-center">
              <div className="text-pink-400 font-bold text-xl">
                {stats.platforms.ethereal}
              </div>
              <div className="text-gray-400 text-sm">Ethereal</div>
            </div>
          </div>
        </div>
      )}

      {/* Opportunity Detail Modal */}
      {selectedOpportunity && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-purple-500 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-white">
                  {selectedOpportunity.title}
                </h2>
                <button
                  onClick={() => setSelectedOpportunity(null)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getPlatformBadge(selectedOpportunity.platform)}`}
                >
                  {selectedOpportunity.platform.toUpperCase()}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getRecommendationColor(selectedOpportunity.recommendation)}`}
                >
                  {selectedOpportunity.recommendation}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-800 rounded p-3">
                  <div className="text-gray-400 text-sm">Edge</div>
                  <div className="text-xl font-bold text-green-400">
                    {selectedOpportunity.edge.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <div className="text-gray-400 text-sm">Confidence</div>
                  <div className="text-xl font-bold text-blue-400">
                    {selectedOpportunity.confidence.toFixed(0)}%
                  </div>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <div className="text-gray-400 text-sm">Expected Return</div>
                  <div className="text-xl font-bold text-yellow-400">
                    {selectedOpportunity.expectedReturn.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <div className="text-gray-400 text-sm">Risk Score</div>
                  <div className="text-xl font-bold text-red-400">
                    {selectedOpportunity.riskScore.toFixed(0)}
                  </div>
                </div>
              </div>

              {selectedOpportunity.currentPrice && (
                <div className="bg-gray-800 rounded p-3 mb-4">
                  <div className="text-gray-400 text-sm">Current Price</div>
                  <div className="text-lg font-bold text-white">
                    ${selectedOpportunity.currentPrice.toLocaleString()}
                  </div>
                  {selectedOpportunity.leverage && (
                    <div className="text-sm text-pink-400">
                      {selectedOpportunity.leverage}x Leverage
                    </div>
                  )}
                  {selectedOpportunity.takeProfit && (
                    <div className="text-sm text-green-400">
                      Take Profit: ${selectedOpportunity.takeProfit.toFixed(2)}
                    </div>
                  )}
                  {selectedOpportunity.stopLoss && (
                    <div className="text-sm text-red-400">
                      Stop Loss: ${selectedOpportunity.stopLoss.toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              {selectedOpportunity.yesPrice !== undefined && (
                <div className="bg-gray-800 rounded p-3 mb-4">
                  <div className="flex gap-4">
                    <span className="text-green-400">
                      YES: {(selectedOpportunity.yesPrice * 100).toFixed(1)}%
                    </span>
                    <span className="text-red-400">
                      NO: {(selectedOpportunity.noPrice! * 100).toFixed(1)}%
                    </span>
                  </div>
                  {selectedOpportunity.volume && (
                    <div className="text-sm text-gray-400 mt-1">
                      Volume: ${selectedOpportunity.volume.toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-black bg-opacity-30 rounded p-3">
                <div className="text-gray-400 text-sm font-semibold mb-1">
                  Analysis:
                </div>
                <p className="text-gray-300">{selectedOpportunity.reasoning}</p>
              </div>

              {selectedOpportunity.closeDate && (
                <div className="text-gray-400 text-sm mt-3">
                  Closes:{" "}
                  {new Date(selectedOpportunity.closeDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Opportunities Grid */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Top Opportunities</h3>

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">⏳</div>
            <p>Finding the best opportunities...</p>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">🔍</div>
            <p>No opportunities found matching your criteria</p>
            <p className="text-sm mt-2">
              Try lowering the minimum edge threshold
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp) => (
              <div
                key={opp.id}
                onClick={() => setSelectedOpportunity(opp)}
                className="bg-gray-900 border border-gray-600 rounded-lg p-4 hover:border-purple-500 transition-all cursor-pointer hover:bg-gray-850"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getTypeIcon(opp.type)}</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getPlatformBadge(opp.platform)}`}
                    >
                      {opp.platform.toUpperCase()}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getRecommendationColor(opp.recommendation)}`}
                    >
                      {opp.recommendation}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">
                      +{opp.expectedReturn.toFixed(1)}%
                    </div>
                    <div className="text-gray-500 text-xs">Expected</div>
                  </div>
                </div>

                <h4 className="text-white font-semibold mb-2">{opp.title}</h4>

                <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                  <div>
                    <span className="text-gray-500">Edge: </span>
                    <span className="text-green-400 font-semibold">
                      {opp.edge.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Conf: </span>
                    <span className="text-blue-400 font-semibold">
                      {opp.confidence.toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Risk: </span>
                    <span className="text-red-400 font-semibold">
                      {opp.riskScore.toFixed(0)}
                    </span>
                  </div>
                </div>

                <p className="text-gray-400 text-sm line-clamp-2">
                  {opp.reasoning}
                </p>

                {opp.closeDate && (
                  <div className="text-gray-500 text-xs mt-2">
                    Closes: {new Date(opp.closeDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vibe Trading Strategy Section */}
      <div className="bg-gradient-to-br from-purple-900 to-blue-900 border border-purple-500 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">
          ✨ Vibe Trading Strategies
        </h3>
        <div className="space-y-4">
          <div className="bg-black bg-opacity-30 rounded-lg p-4">
            <h4 className="text-purple-300 font-semibold mb-2">
              Strategy 1: Edge-Based Position Sizing
            </h4>
            <p className="text-gray-300 text-sm">
              Allocate position size proportional to edge. Higher edge = larger
              position. Formula: Position = Base_Size × (Edge / Min_Edge) ×
              Confidence_Multiplier
            </p>
          </div>
          <div className="bg-black bg-opacity-30 rounded-lg p-4">
            <h4 className="text-purple-300 font-semibold mb-2">
              Strategy 2: Cross-Platform Arbitrage
            </h4>
            <p className="text-gray-300 text-sm">
              Find price discrepancies between Sapience and Dome markets. When
              Sapience shows different probability than Polymarket/Kalshi, trade
              the divergence.
            </p>
          </div>
          <div className="bg-black bg-opacity-30 rounded-lg p-4">
            <h4 className="text-purple-300 font-semibold mb-2">
              Strategy 3: Momentum Perp Scalping
            </h4>
            <p className="text-gray-300 text-sm">
              Use Ethereal perps to capture short-term momentum. High confidence
              + momentum alignment = quick 2-5% scalps with leverage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
