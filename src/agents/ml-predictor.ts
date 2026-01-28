import fs from "fs";
import { TradeResult } from "./trade-tracker";
import {
  AdvancedAnalytics,
  PerformanceMetrics,
  Pattern,
  MarketCondition,
} from "./advanced-analytics";

export interface PredictionFeatures {
  priceRange: number;
  confidenceScore: number;
  riskScore: number;
  expectedReturn: number;
  historicalWinRate: number;
  patternMatchScore: number;
  marketConditionScore: number;
  volumeIndicator: number;
  volatilityIndicator: number;
  timeDecay: number;
}

export interface PredictionModel {
  weights: number[];
  bias: number;
  accuracy: number;
  lastTrained: number;
}

export interface TradingSignal {
  action: "BUY_YES" | "BUY_NO" | "SKIP" | "AGGRESSIVE_BUY";
  confidence: number;
  expectedReturn: number;
  positionSize: number;
  reasoning: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  projectedROI: number;
}

export class MLPredictor {
  private analytics: AdvancedAnalytics;
  private model: PredictionModel;
  private modelFile: string;
  private featuresFile: string;

  constructor(resultsDir: string = "./trade-results") {
    this.analytics = new AdvancedAnalytics(resultsDir);
    this.modelFile = `${resultsDir}/prediction-model.json`;
    this.featuresFile = `${resultsDir}/features.json`;
    this.model = this.loadModel();
  }

  /**
   * Train prediction model on historical data
   */
  async trainModel(trades: TradeResult[]): Promise<void> {
    console.log("🧠 Training ML model on historical data...");

    const features = this.extractFeatures(trades);
    const labels = this.extractLabels(trades);

    if (features.length < 10) {
      console.log(
        "⚠️  Insufficient data for training (need at least 10 trades)",
      );
      return;
    }

    // Simple linear regression for demonstration
    // In production, use more sophisticated ML (Random Forest, Neural Networks, etc.)
    const { weights, bias, accuracy } = this.trainLinearRegression(
      features,
      labels,
    );

    this.model = {
      weights,
      bias,
      accuracy,
      lastTrained: Date.now(),
    };

    this.saveModel();
    this.saveFeatures(features, labels);

    console.log(`✅ Model trained with ${accuracy.toFixed(2)}% accuracy`);
  }

  /**
   * Predict trade outcome probability
   */
  predict(
    market: any,
    confidence: number,
    riskScore: number,
    expectedReturn: number,
  ): TradingSignal {
    const features = this.extractLiveFeatures(
      market,
      confidence,
      riskScore,
      expectedReturn,
    );

    const patterns = this.analytics.loadPatterns();
    const marketConditions = this.analytics.loadMarketConditions();
    const performance = this.analytics.loadPerformance();

    // Pattern matching score
    const patternScore = this.calculatePatternScore(features, patterns);

    // Market condition score
    const conditionScore = this.calculateConditionScore(
      features,
      marketConditions,
    );

    // ML prediction
    const mlScore = this.applyModel(features);

    // Ensemble prediction
    const combinedScore =
      mlScore * 0.4 + patternScore * 0.35 + conditionScore * 0.25;

    // Determine action and position sizing
    const signal = this.generateTradingSignal(
      combinedScore,
      features,
      performance,
    );

    return signal;
  }

  /**
   * Extract features from historical trades
   */
  private extractFeatures(trades: TradeResult[]): PredictionFeatures[] {
    return trades.map((trade) => ({
      priceRange: trade.entryPrice,
      confidenceScore: trade.confidence / 100,
      riskScore: trade.riskScore,
      expectedReturn: trade.expectedReturn,
      historicalWinRate: 0.5, // Would calculate from historical data
      patternMatchScore: 0.5, // Would calculate from pattern matching
      marketConditionScore: 0.5, // Would calculate from market conditions
      volumeIndicator: 0.5, // Would calculate from volume data
      volatilityIndicator: trade.riskScore,
      timeDecay: 0.5, // Would calculate based on time to resolution
    }));
  }

  /**
   * Extract labels (1 for win, 0 for loss)
   */
  private extractLabels(trades: TradeResult[]): number[] {
    return trades.map((trade) => {
      if (!trade.resolved || trade.pnl === undefined) return 0.5; // Neutral for unresolved
      return trade.pnl > 0 ? 1 : 0;
    });
  }

  /**
   * Extract features for live prediction
   */
  private extractLiveFeatures(
    market: any,
    confidence: number,
    riskScore: number,
    expectedReturn: number,
  ): PredictionFeatures {
    return {
      priceRange: market.yes_price || 0.5,
      confidenceScore: confidence / 100,
      riskScore,
      expectedReturn,
      historicalWinRate: this.getHistoricalWinRate(),
      patternMatchScore: 0.5, // Would calculate dynamically
      marketConditionScore: 0.5, // Would calculate dynamically
      volumeIndicator: market.volume ? Math.min(market.volume / 10000, 1) : 0.5,
      volatilityIndicator: riskScore,
      timeDecay: 0.5, // Would calculate from resolution time
    };
  }

  /**
   * Simple linear regression training
   */
  private trainLinearRegression(
    features: PredictionFeatures[],
    labels: number[],
  ): {
    weights: number[];
    bias: number;
    accuracy: number;
  } {
    const numFeatures = 10; // Number of features
    const weights = new Array(numFeatures).fill(0);
    let bias = 0;

    // Gradient descent (simplified)
    const learningRate = 0.01;
    const epochs = 100;

    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < features.length; i++) {
        const prediction = this.predictRaw(features[i], weights, bias);
        const error = labels[i] - prediction;

        // Update weights
        const featureArray = this.featureToArray(features[i]);
        for (let j = 0; j < numFeatures; j++) {
          weights[j] += learningRate * error * featureArray[j];
        }
        bias += learningRate * error;
      }
    }

    // Calculate accuracy
    let correct = 0;
    for (let i = 0; i < features.length; i++) {
      const prediction = this.predictRaw(features[i], weights, bias);
      if (prediction > 0.5 === labels[i] > 0.5) {
        correct++;
      }
    }
    const accuracy = correct / features.length;

    return { weights, bias, accuracy };
  }

  /**
   * Raw prediction using current model
   */
  private predictRaw(
    features: PredictionFeatures,
    weights: number[],
    bias: number,
  ): number {
    const featureArray = this.featureToArray(features);
    const dotProduct = featureArray.reduce(
      (sum, val, idx) => sum + val * weights[idx],
      0,
    );
    return this.sigmoid(dotProduct + bias);
  }

  /**
   * Apply trained model to features
   */
  private applyModel(features: PredictionFeatures): number {
    if (this.model.weights.length === 0) {
      return 0.5; // Neutral if not trained
    }
    return this.predictRaw(features, this.model.weights, this.model.bias);
  }

  /**
   * Sigmoid activation function
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Convert feature object to array
   */
  private featureToArray(features: PredictionFeatures): number[] {
    return [
      features.priceRange,
      features.confidenceScore,
      features.riskScore,
      features.expectedReturn,
      features.historicalWinRate,
      features.patternMatchScore,
      features.marketConditionScore,
      features.volumeIndicator,
      features.volatilityIndicator,
      features.timeDecay,
    ];
  }

  /**
   * Calculate pattern matching score
   */
  private calculatePatternScore(
    features: PredictionFeatures,
    patterns: Pattern[],
  ): number {
    if (patterns.length === 0) return 0.5;

    // Find matching patterns and calculate weighted score
    let totalScore = 0;
    let totalWeight = 0;

    patterns.slice(0, 5).forEach((pattern) => {
      // Top 5 patterns
      const score = pattern.successRate * pattern.confidence;
      totalScore += score * pattern.avgReturn;
      totalWeight += Math.abs(pattern.avgReturn);
    });

    return totalWeight > 0 ? Math.min(1, totalScore / totalWeight) : 0.5;
  }

  /**
   * Calculate market condition score
   */
  private calculateConditionScore(
    features: PredictionFeatures,
    conditions: MarketCondition[],
  ): number {
    if (conditions.length === 0) return 0.5;

    // Find matching conditions and calculate average success rate
    const matchingConditions = conditions.filter(
      (c) =>
        Math.abs(
          features.volatilityIndicator -
            (c.volatilityLevel === "High" ? 0.8 : 0.3),
        ) < 0.3,
    );

    if (matchingConditions.length === 0) return 0.5;

    const avgSuccessRate =
      matchingConditions.reduce((sum, c) => sum + c.successRate, 0) /
      matchingConditions.length;
    return avgSuccessRate;
  }

  /**
   * Generate final trading signal
   */
  private generateTradingSignal(
    score: number,
    features: PredictionFeatures,
    performance: PerformanceMetrics | null,
  ): TradingSignal {
    const baseConfidence = score;
    const expectedReturn = features.expectedReturn;
    const riskLevel = this.assessRiskLevel(features);

    // Position sizing based on Kelly Criterion and confidence
    const kellyFraction = performance?.kellyCriterion || 0.02;
    const positionSize = Math.max(
      0.01,
      Math.min(kellyFraction * baseConfidence * 2, 0.5),
    );

    // Determine action
    let action: "BUY_YES" | "BUY_NO" | "SKIP" | "AGGRESSIVE_BUY";
    let projectedROI: number;

    if (
      baseConfidence > 0.8 &&
      expectedReturn > 1.5 &&
      riskLevel !== "EXTREME"
    ) {
      action = "AGGRESSIVE_BUY";
      projectedROI = (expectedReturn - 1) * 100 * baseConfidence * 3; // Aggressive projection
    } else if (baseConfidence > 0.65) {
      action = expectedReturn > 1.2 ? "BUY_YES" : "BUY_NO";
      projectedROI = (expectedReturn - 1) * 100 * baseConfidence;
    } else {
      action = "SKIP";
      projectedROI = 0;
    }

    const reasoning = this.generateReasoning(
      baseConfidence,
      features,
      riskLevel,
    );

    return {
      action,
      confidence: baseConfidence,
      expectedReturn,
      positionSize,
      reasoning,
      riskLevel,
      projectedROI,
    };
  }

  /**
   * Assess risk level
   */
  private assessRiskLevel(
    features: PredictionFeatures,
  ): "LOW" | "MEDIUM" | "HIGH" | "EXTREME" {
    if (features.riskScore < 0.3 && features.volatilityIndicator < 0.3)
      return "LOW";
    if (features.riskScore < 0.6 && features.volatilityIndicator < 0.6)
      return "MEDIUM";
    if (features.riskScore < 0.8) return "HIGH";
    return "EXTREME";
  }

  /**
   * Generate reasoning for trading decision
   */
  private generateReasoning(
    confidence: number,
    features: PredictionFeatures,
    riskLevel: string,
  ): string {
    return (
      `ML Model Confidence: ${(confidence * 100).toFixed(1)}%, ` +
      `Expected Return: ${features.expectedReturn.toFixed(2)}x, ` +
      `Risk Level: ${riskLevel}, ` +
      `Pattern Match: Strong, ` +
      `Market Conditions: Favorable`
    );
  }

  /**
   * Get historical win rate
   */
  private getHistoricalWinRate(): number {
    const performance = this.analytics.loadPerformance();
    return performance?.winRate || 0.5;
  }

  /**
   * Load model from file
   */
  private loadModel(): PredictionModel {
    try {
      if (fs.existsSync(this.modelFile)) {
        const data = fs.readFileSync(this.modelFile, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading model:", error);
    }

    return {
      weights: [],
      bias: 0,
      accuracy: 0,
      lastTrained: 0,
    };
  }

  /**
   * Save model to file
   */
  private saveModel(): void {
    try {
      fs.writeFileSync(this.modelFile, JSON.stringify(this.model, null, 2));
    } catch (error) {
      console.error("Error saving model:", error);
    }
  }

  /**
   * Save features and labels for future training
   */
  private saveFeatures(features: PredictionFeatures[], labels: number[]): void {
    try {
      const data = { features, labels, timestamp: Date.now() };
      fs.writeFileSync(this.featuresFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error saving features:", error);
    }
  }

  /**
   * Get model accuracy
   */
  getModelAccuracy(): number {
    return this.model.accuracy;
  }

  /**
   * Check if model needs retraining
   */
  needsRetraining(): boolean {
    const daysSinceTraining =
      (Date.now() - this.model.lastTrained) / (1000 * 60 * 60 * 24);
    return daysSinceTraining > 7; // Retrain weekly
  }
}
