import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") || "all";
    const minEdge = parseFloat(searchParams.get("minEdge") || "2");
    const limit = parseInt(searchParams.get("limit") || "20");

    const opportunities: MarketOpportunity[] = [];

    // Fetch from Sapience
    if (platform === "all" || platform === "sapience") {
      try {
        const sapienceResponse = await fetch(
          `${request.nextUrl.origin}/api/conditions?limit=15`,
        );
        const sapienceData = await sapienceResponse.json();

        if (sapienceData.success && sapienceData.conditions) {
          for (const condition of sapienceData.conditions) {
            const edge = Math.random() * 15 + 2; // Simulated edge for demo
            if (edge >= minEdge) {
              opportunities.push({
                id: condition.id,
                title: condition.shortName || condition.question,
                description: condition.question,
                platform: "sapience",
                type: "prediction",
                confidence: Math.random() * 30 + 65,
                edge,
                recommendation:
                  edge > 8 ? "STRONG_BUY" : edge > 5 ? "BUY" : "HOLD",
                expectedReturn: edge * 1.5,
                riskScore: Math.random() * 40 + 20,
                reasoning: `Market shows ${edge.toFixed(1)}% edge with active forecasting opportunity`,
                closeDate: condition.endTime
                  ? new Date(condition.endTime * 1000).toISOString()
                  : undefined,
              });
            }
          }
        }
      } catch (error) {
        console.error("Error fetching Sapience:", error);
      }
    }

    // Fetch from Dome (Polymarket & Kalshi)
    if (
      platform === "all" ||
      platform === "polymarket" ||
      platform === "kalshi"
    ) {
      try {
        const domeResponse = await fetch(
          `${request.nextUrl.origin}/api/dome/markets?platform=both&limit=20`,
        );
        const domeData = await domeResponse.json();

        if (domeData.success && domeData.markets) {
          for (const market of domeData.markets) {
            const edge = Math.abs((market.yes_price - 0.5) * 100);
            if (edge >= minEdge) {
              opportunities.push({
                id: market.id,
                title: market.title,
                description: market.description,
                platform: market.platform,
                type: "prediction",
                yesPrice: market.yes_price,
                noPrice: market.no_price,
                confidence: Math.random() * 25 + 70,
                edge,
                recommendation:
                  market.yes_price < 0.5 && edge > 5
                    ? "STRONG_BUY"
                    : edge > 3
                      ? "BUY"
                      : "HOLD",
                expectedReturn: edge * 2,
                riskScore: Math.random() * 35 + 15,
                reasoning: `${market.platform} market with ${(market.volume || 0).toLocaleString()} volume showing ${edge.toFixed(1)}% pricing edge`,
                closeDate: market.close_date,
                volume: market.volume,
              });
            }
          }
        }
      } catch (error) {
        console.error("Error fetching Dome:", error);
      }
    }

    // Generate Ethereal Perp opportunities
    if (platform === "all" || platform === "ethereal") {
      try {
        const perpSymbols = [
          { symbol: "BTCUSD", price: 67500, change: 2.5 },
          { symbol: "ETHUSD", price: 3450, change: -1.2 },
          { symbol: "SOLUSD", price: 178, change: 5.8 },
          { symbol: "ARBUSD", price: 1.85, change: 3.2 },
        ];

        for (const perp of perpSymbols) {
          const edge = Math.abs(perp.change) * 2;
          if (edge >= minEdge) {
            opportunities.push({
              id: `ethereal-${perp.symbol}`,
              title: `${perp.symbol} Perpetual`,
              description: `Ethereal perpetual futures for ${perp.symbol}`,
              platform: "ethereal",
              type: "perpetual",
              currentPrice: perp.price,
              confidence: Math.min(Math.abs(perp.change) * 10 + 60, 95),
              edge,
              recommendation: perp.change > 0 ? "BUY" : "SELL",
              expectedReturn: Math.abs(perp.change) * 3,
              riskScore: Math.random() * 50 + 30,
              reasoning: `Perp showing ${perp.change > 0 ? "bullish" : "bearish"} momentum at $${perp.price} with ${Math.abs(perp.change)}% change`,
              leverage: Math.min(Math.floor(Math.abs(perp.change)) + 2, 10),
              takeProfit:
                perp.change > 0 ? perp.price * 1.05 : perp.price * 0.95,
              stopLoss: perp.change > 0 ? perp.price * 0.97 : perp.price * 1.03,
            });
          }
        }
      } catch (error) {
        console.error("Error generating perp opportunities:", error);
      }
    }

    // Sort by expected return descending
    opportunities.sort((a, b) => b.expectedReturn - a.expectedReturn);

    // Calculate stats
    const stats = {
      total: opportunities.length,
      strongBuy: opportunities.filter((o) => o.recommendation === "STRONG_BUY")
        .length,
      buy: opportunities.filter((o) => o.recommendation === "BUY").length,
      avgEdge:
        opportunities.length > 0
          ? opportunities.reduce((sum, o) => sum + o.edge, 0) /
            opportunities.length
          : 0,
      avgExpectedReturn:
        opportunities.length > 0
          ? opportunities.reduce((sum, o) => sum + o.expectedReturn, 0) /
            opportunities.length
          : 0,
      platforms: {
        sapience: opportunities.filter((o) => o.platform === "sapience").length,
        polymarket: opportunities.filter((o) => o.platform === "polymarket")
          .length,
        kalshi: opportunities.filter((o) => o.platform === "kalshi").length,
        ethereal: opportunities.filter((o) => o.platform === "ethereal").length,
      },
    };

    return NextResponse.json({
      success: true,
      opportunities: opportunities.slice(0, limit),
      stats,
      filters: {
        platform,
        minEdge,
        limit,
      },
    });
  } catch (error: any) {
    console.error("Error fetching opportunities:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
