"use client";

import { useState } from "react";
import { NLInput } from "./NLInput";
import { LLMServiceFactory, LLMProvider } from "~~/services/llm/factory";
import { LLMResponse, defaultLLMConfig } from "~~/services/llm/types";
import { TransactionExecutor } from "./TransactionExecutor";
import { notification } from "~~/utils/scaffold-eth";
import PoolQueryExecutor, { PoolIntent } from "./PoolQueryExecutor";
import { Address } from "viem";

interface CommandResult {
  type: "swap" | "deposit" | "query" | "error";
  data?: any;
  error?: string;
}

interface QueryData {
  poolAddress: Address;
  intent: PoolIntent;
  timeframe: "today" | { from: number; to: number };
}

export const NLProcessor = () => {
  const [result, setResult] = useState<CommandResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [llmProvider, setLlmProvider] = useState<LLMProvider>("openai");
  const [openSourceEndpoint, setOpenSourceEndpoint] = useState("");
  const [queryData, setQueryData] = useState<QueryData | null>(null);

  const processCommand = async (command: string) => {
    setIsProcessing(true);
    setResult(null);

    try {
      // 使用默认配置创建LLM服务
      const llmService = LLMServiceFactory.createService(llmProvider, {
        ...defaultLLMConfig,  // 首先使用默认配置
        ...(llmProvider === "open-source" ? { apiEndpoint: openSourceEndpoint } : {})  // 然后覆盖特定配置
      });

      // 使用LLM处理命令
      const llmResponse = await llmService.processCommand(command);
      
      if (llmResponse.type === "error") {
        setResult({
          type: "error",
          error: llmResponse.explanation || "Failed to process command"
        });
        return;
      }

      // 设置成功结果
      setResult({
        type: llmResponse.type,
        data: {
          command: command,
          parsedCommand: llmResponse,
          confidence: llmResponse.confidence
        }
      });

      // 如果是查询类型，设置查询数据
      if (llmResponse.type === "query" && llmResponse.params.poolAddress) {
        setQueryData({
          poolAddress: llmResponse.params.poolAddress as Address,
          intent: llmResponse.action as PoolIntent,
          timeframe: llmResponse.params.timeframe || "today"
        });
      }

    } catch (error) {
      console.error("Error processing command:", error);
      setResult({
        type: "error",
        error: error instanceof Error ? error.message : "An error occurred while processing your command."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-semibold mb-2">LLM Settings</h3>
        <div className="flex gap-4 items-center">
          <select
            value={llmProvider}
            onChange={(e) => setLlmProvider(e.target.value as LLMProvider)}
            className="p-2 border rounded"
          >
            <option value="openai">OpenAI</option>
            <option value="open-source">Open Source</option>
          </select>
          
          {llmProvider === "open-source" && (
            <input
              type="text"
              value={openSourceEndpoint}
              onChange={(e) => setOpenSourceEndpoint(e.target.value)}
              placeholder="Enter open source LLM endpoint"
              className="flex-1 p-2 border rounded"
            />
          )}
        </div>
        <div className="mt-2 text-sm text-gray-600">
          <p>Current Model: {defaultLLMConfig.model}</p>
          {llmProvider === "openai" && (
            <p>Using OpenAI API Key: {defaultLLMConfig.apiKey ? "✓ Configured" : "✗ Not configured"}</p>
          )}
        </div>
      </div>

      <NLInput onCommandSubmit={processCommand} />
      
      {isProcessing && (
        <div className="text-center p-4">
          <p>Processing your command...</p>
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 border rounded-lg">
          {result.type === "error" ? (
            <div className="text-red-500">
              <p>{result.error}</p>
            </div>
          ) : (
            <>
              <div>
                <p className="font-semibold">Command Type: {result.type}</p>
                <p>Original Command: {result.data.command}</p>
                <p>Confidence: {(result.data.confidence * 100).toFixed(1)}%</p>
                <div className="mt-2">
                  <p className="font-semibold">Parsed Command:</p>
                  <pre className="bg-gray-100 p-2 rounded mt-1">
                    {JSON.stringify(result.data.parsedCommand, null, 2)}
                  </pre>
                </div>
              </div>
              
              {(result.type === "swap" || result.type === "deposit") && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Executing Transaction</h3>
                  <TransactionExecutor
                    llmResponse={result.data.parsedCommand}
                    onTransactionComplete={() => {
                      setResult(null);
                      notification.success("Transaction completed successfully");
                    }}
                  />
                </div>
              )}

              {result.type === "query" && queryData && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Query Results</h3>
                  <PoolQueryExecutor
                    poolAddress={queryData.poolAddress}
                    intent={queryData.intent}
                    timeframe={queryData.timeframe}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}; 