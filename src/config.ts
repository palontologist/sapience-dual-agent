/**
 * Configuration for Sapience agents
 */

export const SAPIENCE_CONFIG = {
  // API endpoints
  API_BASE_URL: "https://api.sapience.xyz",
  MARKETS_ENDPOINT: "/markets",
  FORECASTS_ENDPOINT: "/forecasts",
  LEADERBOARD_ENDPOINT: "/leaderboard",

  // Arbitrum network
  ARBITRUM_RPC_URL: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
  CHAIN_ID: 42161,

  // Contracts
  EAS_CONTRACT_ADDRESS: "0xA1207F3BBa224E02c159c0dFpF493b4e5C10e6B9", // EAS on Arbitrum
  USDE_TOKEN_ADDRESS: "0xFd4cb59b3B0F51a08CEa8fade0F7B13d51180fff", // USDe on Arbitrum

  // Agent parameters
  FORECASTING:  {
    MIN_CONFIDENCE: 0.70,
    MAX_MARKETS_PER_RUN: 50,
    REQUEST_DELAY_MS: 2000,
  },

  TRADING: {
    MIN_CONFIDENCE: 0.65,
    MIN_EXPECTED_VALUE: 1.1, // 10% edge
    WAGER_AMOUNT: 1, // 1 USDe per trade
    MAX_TRADES_PER_RUN: 10,
    REQUEST_DELAY_MS: 2000,
  },

  // Market filtering
  MIN_LIQUIDITY: 1000, // Minimum liquidity to consider
  MIN_DAYS_TO_RESOLUTION: 1,
  MAX_DAYS_TO_RESOLUTION: 365,
};

export const API_KEYS = {
  ANTHROPIC: process.env.ANTHROPIC_API_KEY || "",
  PRIVATE_KEY: process.env. PRIVATE_KEY || "",
  SAPIENCE_API_KEY: process.env. SAPIENCE_API_KEY || "",
};

export function validateConfig(): void {
  if (!API_KEYS.ANTHROPIC) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  if (!API_KEYS.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not set");
  }
}
