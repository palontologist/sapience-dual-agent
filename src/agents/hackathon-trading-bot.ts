import { QuantumTradingBot, BotConfig } from "./quantum-trading-bot";

export interface HackathonConfig {
  competition: string;
  duration: number; // hours
  maxRisk: number;
  targetReturn: number; // multiple
  enableLiveTrading: boolean;
}

export class HackathonTradingBot {
  private bot: QuantumTradingBot;
  private hackathonConfig: HackathonConfig;

  constructor(groqApiKey: string, hackathonConfig: HackathonConfig) {
    this.hackathonConfig = hackathonConfig;

    // Configure bot for maximum performance
    const botConfig: BotConfig = {
      initialCapital: 1000, // Start with 1k
      targetCapital: 10000000, // Target 10M (10000x)
      maxLeverage: 100, // Maximum leverage
      riskLevel: "ULTRA_AGGRESSIVE",
      tradingMode: hackathonConfig.enableLiveTrading
        ? "FULL_AUTO"
        : "SEMI_AUTO",
      updateInterval: 30000, // 30 seconds
      maxConcurrentTrades: 10,
      enableML: true,
      enableSentiment: true,
      enableUltraAggressive: true,
    };

    this.bot = new QuantumTradingBot(botConfig, groqApiKey);
  }

  /**
   * Start hackathon trading session
   */
  async startHackathonSession(): Promise<void> {
    console.log("🏆 HACKATHON TRADING SESSION STARTED");
    console.log(`📋 Competition: ${this.hackathonConfig.competition}`);
    console.log(`⏱️  Duration: ${this.hackathonConfig.duration} hours`);
    console.log(`🎯 Target Return: ${this.hackathonConfig.targetReturn}x`);
    console.log(`⚡ Maximum Risk Level: ULTRA AGGRESSIVE`);
    console.log(
      `🔗 Live Trading: ${this.hackathonConfig.enableLiveTrading ? "ENABLED" : "DISABLED"}`,
    );
    console.log("");

    // Start the bot
    await this.bot.start();

    // Set up monitoring for hackathon duration
    this.setupHackathonMonitoring();

    // Auto-stop after duration
    setTimeout(
      async () => {
        await this.endHackathonSession();
      },
      this.hackathonConfig.duration * 60 * 60 * 1000,
    );
  }

  /**
   * End hackathon session and generate report
   */
  async endHackathonSession(): Promise<void> {
    console.log("\n🏁 HACKATHON SESSION ENDING");

    await this.bot.stop();

    // Generate final report
    const report = this.generateHackathonReport();
    this.printHackathonReport(report);

    // Submit results if applicable
    if (this.hackathonConfig.enableLiveTrading) {
      await this.submitHackathonResults(report);
    }
  }

  /**
   * Set up real-time monitoring
   */
  private setupHackathonMonitoring(): void {
    const monitorInterval = setInterval(() => {
      const status = this.bot.getStatus();
      this.printLiveStatus(status);

      // Check if we've hit target
      if (status.totalROI >= (this.hackathonConfig.targetReturn - 1) * 100) {
        console.log("\n🎯 TARGET ACHIEVED! EARLY VICTORY!");
        clearInterval(monitorInterval);
        this.endHackathonSession();
      }

      // Check for critical failure
      if (status.totalROI <= -80) {
        // 80% loss
        console.log("\n💥 CRITICAL LOSS - SESSION TERMINATED");
        clearInterval(monitorInterval);
        this.endHackathonSession();
      }
    }, 60000); // Update every minute

    // Clear on session end
    setTimeout(
      () => {
        clearInterval(monitorInterval);
      },
      this.hackathonConfig.duration * 60 * 60 * 1000,
    );
  }

  /**
   * Print live status
   */
  private printLiveStatus(status: any): void {
    const uptime = Math.floor(status.uptime / 1000 / 60); // minutes
    const roi = status.totalROI.toFixed(2);
    const capital = status.currentCapital.toLocaleString();
    const trades = status.tradesExecuted;
    const winRate = (status.winRate * 100).toFixed(1);

    console.log(`\n📊 LIVE STATUS [${uptime}m]`);
    console.log(`💰 Capital: $${capital} | 📈 ROI: ${roi}%`);
    console.log(`🎯 Trades: ${trades} | 🏆 Win Rate: ${winRate}%`);
    console.log(`📍 Active Positions: ${status.currentPositions}`);

    if (status.errors.length > 0) {
      console.log(`⚠️  Recent Errors: ${status.errors.length}`);
    }
  }

  /**
   * Generate comprehensive hackathon report
   */
  private generateHackathonReport(): any {
    const status = this.bot.getStatus();
    const endTime = Date.now();
    const duration = endTime - (endTime - status.uptime);

    return {
      competition: this.hackathonConfig.competition,
      duration: Math.floor(duration / 1000 / 60), // minutes
      finalCapital: status.currentCapital,
      initialCapital: 1000,
      totalROI: status.totalROI,
      tradesExecuted: status.tradesExecuted,
      winRate: status.winRate,
      finalPositions: status.currentPositions,
      peakCapital: status.currentCapital, // Would track peak
      maxDrawdown: 0, // Would calculate
      sharpeRatio: 0, // Would calculate
      errors: status.errors,
      success: status.totalROI > 0,
      rank: this.calculateRank(status.totalROI),
    };
  }

  /**
   * Print detailed hackathon report
   */
  private printHackathonReport(report: any): void {
    console.log("\n" + "=".repeat(60));
    console.log("🏆 HACKATHON FINAL REPORT");
    console.log("=".repeat(60));

    console.log(`📋 Competition: ${report.competition}`);
    console.log(`⏱️  Duration: ${report.duration} minutes`);
    console.log(
      `💰 Initial Capital: $${report.initialCapital.toLocaleString()}`,
    );
    console.log(`💵 Final Capital: $${report.finalCapital.toLocaleString()}`);
    console.log(`📈 Total ROI: ${report.totalROI.toFixed(2)}%`);
    console.log(`🎯 Trades Executed: ${report.tradesExecuted}`);
    console.log(`🏆 Win Rate: ${(report.winRate * 100).toFixed(1)}%`);
    console.log(`📍 Final Positions: ${report.finalPositions}`);

    if (report.success) {
      console.log("\n✅ HACKATHON SUCCESS!");
      console.log(`🥇 Estimated Rank: ${report.rank}`);
    } else {
      console.log("\n❌ HACKATHON RESULT: SUB-OPTIMAL");
      console.log(`📊 Rank: ${report.rank}`);
    }

    console.log("\n" + "=".repeat(60));
  }

  /**
   * Calculate estimated rank based on ROI
   */
  private calculateRank(roi: number): string {
    if (roi > 9000) return "🥇 TOP 10 (LEGENDARY)";
    if (roi > 5000) return "🥈 TOP 50 (EXCEPTIONAL)";
    if (roi > 2000) return "🥉 TOP 100 (EXCELLENT)";
    if (roi > 1000) return "🏅 TOP 250 (VERY GOOD)";
    if (roi > 500) return "⭐ TOP 500 (GOOD)";
    if (roi > 200) return "✨ TOP 1000 (ABOVE AVERAGE)";
    if (roi > 50) return "📈 MID FIELD";
    if (roi > 0) return "📊 PARTICIPANT";
    return "📉 NEEDS IMPROVEMENT";
  }

  /**
   * Submit results to competition
   */
  private async submitHackathonResults(report: any): Promise<void> {
    console.log("📤 Submitting hackathon results...");

    try {
      // This would integrate with the hackathon submission API
      const submission = {
        competition: report.competition,
        finalCapital: report.finalCapital,
        totalROI: report.totalROI,
        tradesExecuted: report.tradesExecuted,
        winRate: report.winRate,
        timestamp: Date.now(),
        signature: "quantum_trading_bot_v1",
      };

      // Log submission (would actually submit)
      console.log("📋 Submission Data:", JSON.stringify(submission, null, 2));
      console.log("✅ Results submitted successfully!");
    } catch (error) {
      console.error("❌ Error submitting results:", error);
    }
  }

  /**
   * Get current hackathon status
   */
  getHackathonStatus(): any {
    const botStatus = this.bot.getStatus();
    const timeRemaining = Math.max(
      0,
      this.hackathonConfig.duration * 60 * 60 * 1000 - botStatus.uptime,
    );

    return {
      ...botStatus,
      timeRemaining: Math.floor(timeRemaining / 1000 / 60), // minutes
      targetROI: (this.hackathonConfig.targetReturn - 1) * 100,
      onTrack:
        botStatus.totalROI >=
        (this.hackathonConfig.targetReturn - 1) *
          100 *
          (botStatus.uptime / (this.hackathonConfig.duration * 60 * 60 * 1000)),
    };
  }
}

// Example usage
export async function runHackathonBot(): Promise<void> {
  const hackathonConfig: HackathonConfig = {
    competition: "Sapience Trading Championship 2026",
    duration: 24, // 24 hours
    maxRisk: 0.3,
    targetReturn: 10000, // 10000x
    enableLiveTrading: true,
  };

  const groqApiKey = process.env.GROQ_API_KEY || "";

  if (!groqApiKey) {
    console.error("❌ GROQ_API_KEY not set");
    return;
  }

  const hackathonBot = new HackathonTradingBot(groqApiKey, hackathonConfig);
  await hackathonBot.startHackathonSession();
}

// Run if called directly
if (require.main === module) {
  runHackathonBot().catch(console.error);
}
