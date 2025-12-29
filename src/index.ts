/**
 * Sapience Dual Agent - Forecasting + Trading
 */

import dotenv from "dotenv";
import { ForecastingAgent } from "./agents/forecasting-agent";
import { validateConfig, API_KEYS, ETHEREUM_CONFIG } from "./config";

dotenv.config();

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("🎯 SAPIENCE DUAL AGENT - Forecasting + Trading");
  console.log("═══════════════════════════════════════════════════\n");

  try {
    // Validate configuration
    validateConfig();

    const mode = process.env.AGENT_MODE || "forecasting"; // Default to forecasting only
    const maxForecasts = parseInt(process.env.MAX_FORECASTS || "2");

    if (mode === "forecasting" || mode === "both") {
      console.log("📊 Starting Forecasting Agent...\n");
      const forecastingAgent = new ForecastingAgent({
        privateKey: ETHEREUM_CONFIG.PRIVATE_KEY,
        groqApiKey: API_KEYS.GROQ_API_KEY,
      });

      await forecastingAgent.run(maxForecasts);
    }

    // Skip trading agent - no public trading API available
    if (mode === "trading") {
      console.log("\n⚠️  Trading mode not available - Sapience is forecasting-only");
      console.log("    Use mode=forecasting to generate forecasts\n");
    }

    console.log("\n═══════════════════════════════════════════════════");
    console.log("✨ Forecasting agent completed!");
    console.log("═══════════════════════════════════════════════════\n");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
