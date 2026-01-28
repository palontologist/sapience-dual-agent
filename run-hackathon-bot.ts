#!/usr/bin/env node

import dotenv from "dotenv";
import { runHackathonBot } from "./src/agents/hackathon-trading-bot";

// Load environment variables
dotenv.config();

async function main() {
  console.log("🚀 STARTING QUANTUM TRADING BOT FOR HACKATHON");
  console.log("💰 Target: 10000x RETURNS");
  console.log("⚡ Strategy: Ultra-Aggressive with ML & Sentiment Analysis");
  console.log("🔥 Mode: Maximum Risk for Maximum Reward");
  console.log("");

  try {
    await runHackathonBot();
  } catch (error) {
    console.error("💥 FATAL ERROR:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Gracefully shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Terminating...");
  process.exit(0);
});

main();
