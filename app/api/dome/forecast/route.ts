import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ForecastRequest {
  marketId: string;
  title: string;
  platform: "kalshi" | "polymarket";
  yes_price: number;
  no_price: number;
  volume?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ForecastRequest = await request.json();

    if (!body.marketId || !body.title) {
      return NextResponse.json(
        { success: false, error: "Missing marketId or title" },
        { status: 400 },
      );
    }

    // Dynamic import for Groq
    const Groq = (await import("groq-sdk")).default;

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || "",
    });

    const prompt = `You are a prediction market forecasting expert. Analyze this market:

Platform: ${body.platform.toUpperCase()}
Question: "${body.title}"
Current YES Price: ${(body.yes_price * 100).toFixed(1)}%
Current NO Price: ${(body.no_price * 100).toFixed(1)}%
24h Volume: $${body.volume?.toLocaleString() || "N/A"}

Provide your analysis in JSON format:
{
  "probability": <number 0-100>,
  "confidence": <number 0-100>,
  "reasoning": "<detailed reasoning>",
  "fair_value": <number 0-100>,
  "edge": <number>,
  "recommendation": "BUY_YES" or "BUY_NO" or "SKIP"
}

Rules:
- probability: Your estimated probability for YES outcome
- confidence: How confident you are (0-100)
- fair_value: What you think the fair market price should be
- edge: Difference between fair_value and current yes_price
- recommendation: BUY_YES if underpriced, BUY_NO if overpriced, SKIP if fairly priced
- Only recommend BUY if edge > 5% and confidence > 65%`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "moonshotai/kimi-k2-instruct-0905",
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from Groq response");
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      forecast: {
        marketId: body.marketId,
        platform: body.platform,
        probability: analysis.probability,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        fair_value: analysis.fair_value,
        edge: analysis.edge,
        recommendation: analysis.recommendation,
        current_yes_price: body.yes_price * 100,
      },
    });
  } catch (error: any) {
    console.error("Error generating Dome forecast:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
