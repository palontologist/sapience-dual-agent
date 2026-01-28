"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import WalletConnect from "@/components/WalletConnect";

interface Condition {
  id: string;
  question: string;
  shortName?: string;
  endTime: number;
}

interface ForecastResult {
  conditionId: string;
  probability: number;
  confidence: number;
  edge: number;
  reasoning: string;
}

export default function TradingPage() {
  const { address, isConnected } = useAccount();
  const {
    writeContract,
    data: hash,
    isPending: isWriting,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const [conditions, setConditions] = useState<Condition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<Condition | null>(
    null,
  );
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected) {
      fetchConditions();
    }
  }, [isConnected]);

  useEffect(() => {
    if (isSuccess) {
      alert(`✅ Forecast submitted! TX: ${hash}`);
      setForecast(null);
      setSelectedCondition(null);
    }
  }, [isSuccess, hash]);

  const fetchConditions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/conditions?limit=30");
      const data = await response.json();

      if (data.success) {
        setConditions(data.conditions);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateForecast = async (condition: Condition) => {
    setSelectedCondition(condition);
    setIsGenerating(true);
    setError(null);
    setForecast(null);

    try {
      const response = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conditionId: condition.id,
          question: condition.shortName || condition.question,
          endTime: condition.endTime,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setForecast(data.forecast);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const submitForecastWithWallet = async () => {
    if (!forecast || !selectedCondition || !address) return;

    try {
      // Prepare transaction data
      const response = await fetch("/api/submit-with-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conditionId: forecast.conditionId,
          probability: forecast.probability,
          reasoning: forecast.reasoning,
          signature: "",
          address: address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Send transaction using wagmi
        writeContract({
          address: data.transaction.to as `0x${string}`,
          abi: [
            {
              name: "attest",
              type: "function",
              inputs: [
                {
                  name: "request",
                  type: "tuple",
                  components: [
                    { name: "schema", type: "bytes32" },
                    {
                      name: "data",
                      type: "tuple",
                      components: [
                        { name: "recipient", type: "address" },
                        { name: "expirationTime", type: "uint64" },
                        { name: "revocable", type: "bool" },
                        { name: "refUID", type: "bytes32" },
                        { name: "data", type: "bytes" },
                        { name: "value", type: "uint256" },
                      ],
                    },
                  ],
                },
              ],
              outputs: [{ name: "", type: "bytes32" }],
              stateMutability: "payable",
            },
          ],
          functionName: "attest",
          args: [data.transaction.data],
        });
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-8xl mb-6">🔗</div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Connect Your Wallet
          </h2>
          <p className="text-gray-400 mb-8 max-w-md">
            Connect your wallet to start making predictions on Sapience markets
            with your own account
          </p>
          <WalletConnect />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Profit-Focused Trading
          </h2>
          <p className="text-gray-400 text-sm">
            Submit predictions with profit targets and stop losses
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <WalletConnect />
          <button
            onClick={fetchConditions}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
          >
            {isLoading ? "⏳ Loading..." : "🔄 Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-600 text-red-200 rounded-lg p-4">
          ❌ {error}
        </div>
      )}

      {/* Forecast Panel */}
      {forecast && selectedCondition && (
        <div className="bg-gradient-to-br from-green-900 to-blue-900 border-2 border-green-500 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">
            💰 Your Forecast Ready to Submit
          </h3>

          <div className="bg-black bg-opacity-30 rounded-lg p-4 mb-4">
            <h4 className="text-white font-semibold mb-2">
              {selectedCondition.shortName || selectedCondition.question}
            </h4>

            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-gray-300 text-sm">Probability</div>
                <div className="text-2xl font-bold text-purple-300">
                  {forecast.probability}%
                </div>
              </div>
              <div>
                <div className="text-gray-300 text-sm">Confidence</div>
                <div className="text-2xl font-bold text-blue-300">
                  {forecast.confidence}%
                </div>
              </div>
              <div>
                <div className="text-gray-300 text-sm">Edge</div>
                <div className="text-2xl font-bold text-green-300">
                  {forecast.edge.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-gray-300 text-sm">Expected Return</div>
                <div className="text-2xl font-bold text-yellow-300">
                  {(
                    (forecast.edge > 0
                      ? forecast.probability
                      : 100 - forecast.probability) / 100
                  ).toFixed(2)}
                  x
                </div>
              </div>
            </div>

            <div className="text-gray-200 text-sm mb-3">
              <span className="font-semibold">Reasoning:</span>{" "}
              {forecast.reasoning}
            </div>

            <div className="text-gray-300 text-xs bg-blue-900 bg-opacity-30 p-3 rounded">
              <div className="font-semibold mb-1">⚠️ Transaction Details:</div>
              <div>• Network: Arbitrum</div>
              <div>• Gas: ~$0.50 USD</div>
              <div>• Your forecast will be recorded on-chain</div>
            </div>

            <div className="text-gray-300 text-xs bg-green-900 bg-opacity-30 p-3 rounded mt-3">
              <div className="font-semibold mb-1">
                💰 Profit-Focused Trading:
              </div>
              <div>
                • This session uses profit targets instead of time limits
              </div>
              <div>
                • Automatic stop when profit target reached or stop loss
                triggered
              </div>
              <div>• Expected return based on edge and probability</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={submitForecastWithWallet}
              disabled={isWriting || isConfirming}
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
            >
              {isWriting
                ? "📝 Signing..."
                : isConfirming
                  ? "⏳ Confirming..."
                  : "💰 Submit from Wallet"}
            </button>
            <button
              onClick={() => {
                setForecast(null);
                setSelectedCondition(null);
              }}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Markets List */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Available Markets</h3>

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">⏳</div>
            <p>Loading markets...</p>
          </div>
        ) : conditions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">📊</div>
            <p>No active markets found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conditions.map((condition) => (
              <div
                key={condition.id}
                className="bg-gray-900 border border-gray-600 rounded-lg p-4 hover:border-purple-500 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 mr-4">
                    <h3 className="text-white font-semibold mb-1">
                      {condition.shortName || condition.question}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Ends:{" "}
                      {new Date(condition.endTime * 1000).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={() => generateForecast(condition)}
                    disabled={isGenerating}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-semibold text-sm transition-colors whitespace-nowrap"
                  >
                    {isGenerating && selectedCondition?.id === condition.id
                      ? "⏳ Generating..."
                      : "🤖 Generate Forecast"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
