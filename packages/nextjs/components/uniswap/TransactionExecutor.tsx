"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { type Address } from "viem";
import { notification } from "~~/utils/scaffold-eth";
import { LLMResponse } from "~~/services/llm/types";
import { useDeployedContractInfo, useScaffoldContract } from "~~/hooks/scaffold-eth";
import { PoolSelector } from "./PoolSelector";
import { SwapInterface } from "./SwapInterface";
import { LiquidityInterface } from "./LiquidityInterface";
import { COMMON_TOKENS, getTokenInfo, isETH } from "./tokenList";
import deployedContracts from "~~/contracts/deployedContracts";
import LlmAddLiquidityExecutor from "./LlmAddLiquidityExecutor";

// 从deployedContracts获取ABI
const FACTORY_ABI = deployedContracts[11155111].UniswapV2Factory.abi;

// ETH和WETH地址常量
const ETH_ADDRESS = COMMON_TOKENS.ETH.address;
const WETH_ADDRESS = COMMON_TOKENS.WETH.address;

interface TransactionExecutorProps {
  llmResponse: LLMResponse;
  onTransactionComplete?: () => void;
}

export const TransactionExecutor = ({ 
  llmResponse, 
  onTransactionComplete 
}: TransactionExecutorProps) => {
  const [selectedPool, setSelectedPool] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [autoExecute, setAutoExecute] = useState<boolean>(true);
  
  const { address } = useAccount();
  const { data: deployedContractData } = useDeployedContractInfo({ contractName: "UniswapV2Factory" });
  
  const { data: factoryContract } = useScaffoldContract({
    contractName: "UniswapV2Factory"
  });

  // 根据代币符号获取代币地址
  const getTokenAddressBySymbol = (symbol: string): Address | null => {
    const normalizedSymbol = symbol.toUpperCase();
    
    // 检查常见代币
    for (const [key, info] of Object.entries(COMMON_TOKENS)) {
      if (info.symbol.toUpperCase() === normalizedSymbol) {
        console.log(`Found token address for ${symbol}: ${info.address}`);
        return info.address;
      }
    }
    
    // 如果没有找到，返回null
    console.log(`No token address found for ${symbol}`);
    return null;
  };

  // 根据LLM响应自动选择或创建交易对
  const selectOrCreatePair = async () => {
    if (!factoryContract) return;
    
    try {
      setIsLoading(true);
      
      let token0Address: Address | null = null;
      let token1Address: Address | null = null;
      
      // 根据交易类型获取代币地址
      switch (llmResponse.type) {
        case "swap": {
          const { tokenIn, tokenOut } = llmResponse.params;
          if (!tokenIn || !tokenOut) {
            notification.error("Missing token information for swap");
            return;
          }
          
          // 获取代币地址
          token0Address = getTokenAddressBySymbol(tokenIn);
          token1Address = getTokenAddressBySymbol(tokenOut);
          
          // 如果找不到代币地址，尝试直接使用符号作为地址（仅用于测试）
          if (!token0Address && tokenIn.startsWith("0x")) {
            token0Address = tokenIn as Address;
          }
          if (!token1Address && tokenOut.startsWith("0x")) {
            token1Address = tokenOut as Address;
          }
          
          break;
        }
        
        case "deposit": {
          const { tokenA, tokenB } = llmResponse.params;
          if (!tokenA || !tokenB) {
            notification.error("Missing token information for deposit");
            return;
          }
          
          // 获取代币地址
          token0Address = getTokenAddressBySymbol(tokenA);
          token1Address = getTokenAddressBySymbol(tokenB);
          
          // 如果找不到代币地址，尝试直接使用符号作为地址（仅用于测试）
          if (!token0Address && tokenA.startsWith("0x")) {
            token0Address = tokenA as Address;
          }
          if (!token1Address && tokenB.startsWith("0x")) {
            token1Address = tokenB as Address;
          }
          
          break;
        }
        
        case "query": {
          // 查询操作需要用户手动选择池子
          return;
        }
        
        default:
          notification.error("Unsupported transaction type");
          return;
      }
      
      // 检查代币地址是否有效
      if (!token0Address || !token1Address) {
        console.error("Invalid token addresses:", { token0Address, token1Address });
        notification.error("Could not find token addresses. Please select a pool manually.");
        return;
      }
      
      // 如果代币是ETH，替换为WETH
      const actualToken0 = isETH(token0Address) ? WETH_ADDRESS : token0Address;
      const actualToken1 = isETH(token1Address) ? WETH_ADDRESS : token1Address;
      
      console.log("Checking pair with addresses:", { actualToken0, actualToken1 });
      
      // 尝试获取现有交易对
      const pairAddress = await factoryContract.read.getPair([actualToken0, actualToken1]);
      console.log("Pair address result:", pairAddress);
      
      if (pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000") {
        // 交易对已存在
        setSelectedPool(pairAddress);
        notification.success("Found existing pool");
      } else {
        // 尝试反向顺序
        const reversePairAddress = await factoryContract.read.getPair([actualToken1, actualToken0]);
        console.log("Reverse pair address result:", reversePairAddress);
        
        if (reversePairAddress && reversePairAddress !== "0x0000000000000000000000000000000000000000") {
          // 交易对以反向顺序存在
          setSelectedPool(reversePairAddress);
          notification.success("Found existing pool (reverse order)");
        } else {
          // 交易对不存在，提示用户手动选择或创建
          notification.info("Pool not found. Please select or create a pool manually.");
        }
      }
    } catch (error) {
      console.error("Error selecting pair:", error);
      notification.error("Failed to select pair");
    } finally {
      setIsLoading(false);
    }
  };

  // 验证交易参数
  const validateTransaction = () => {
    if (!llmResponse.params) return false;
    
    switch (llmResponse.type) {
      case "swap":
        return !!(llmResponse.params.amountIn && llmResponse.params.tokenIn && llmResponse.params.tokenOut);
      case "deposit":
        return !!(llmResponse.params.amountA && llmResponse.params.tokenA && 
                 llmResponse.params.amountB && llmResponse.params.tokenB);
      default:
        return false;
    }
  };

  // 当池子被选中且自动执行开启时，自动执行交易
  useEffect(() => {
    if (selectedPool && autoExecute && llmResponse.type !== "query") {
      console.log("Auto-execute enabled, pool selected:", selectedPool);
      console.log("LLM Response:", llmResponse);
      
      if (validateTransaction()) {
        console.log("Transaction validated, proceeding with auto-execution");
        // 这里不需要手动执行，因为SwapInterface和LiquidityInterface组件会自动执行
      } else {
        console.error("Invalid transaction parameters");
        notification.error("Invalid transaction parameters");
      }
    }
  }, [selectedPool, autoExecute, llmResponse]);

  // 初始化时尝试自动选择交易对
  useEffect(() => {
    if (factoryContract && llmResponse.type !== "query" && !selectedPool) {
      selectOrCreatePair();
    }
  }, [factoryContract, llmResponse, selectedPool]);

  if (!deployedContractData?.address) {
    return <div className="text-error">Factory contract not deployed</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end mb-4">
        <label className="flex items-center cursor-pointer gap-2">
          <span className="label-text">Auto-execute</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={autoExecute}
            onChange={(e) => setAutoExecute(e.target.checked)}
          />
        </label>
      </div>

      <div className="bg-base-200 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Transaction Details</h3>
        <div className="space-y-2">
          <p><span className="font-medium">Type:</span> {llmResponse.type}</p>
          <p><span className="font-medium">Action:</span> {llmResponse.action}</p>
          <p><span className="font-medium">Confidence:</span> {(llmResponse.confidence * 100).toFixed(1)}%</p>
          {llmResponse.explanation && (
            <p><span className="font-medium">Explanation:</span> {llmResponse.explanation}</p>
          )}
          <div className="mt-2">
            <p className="font-medium">Parameters:</p>
            <pre className="bg-base-300 p-2 rounded mt-1 text-sm overflow-x-auto">
              {JSON.stringify(llmResponse.params, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pool Selection</h3>
      </div>

      {selectedPool ? (
        <>
          {llmResponse.type === "swap" && (
            <SwapInterface
              poolAddress={selectedPool}
              autoExecute={autoExecute}
              initialAmount={llmResponse.params.amountIn?.toString()}
              initialTokenIn={llmResponse.params.tokenIn}
              initialTokenOut={llmResponse.params.tokenOut}
              onSwapCompleted={onTransactionComplete}
            />
          )}
          {llmResponse.type === "deposit" && (
            <LlmAddLiquidityExecutor
              poolAddress={selectedPool}
              autoExecute={autoExecute}
              params={{
                amountA: llmResponse.params.amountA,
                amountB: llmResponse.params.amountB,
                tokenA: llmResponse.params.tokenA,
                tokenB: llmResponse.params.tokenB,
                slippage: llmResponse.params.slippage
              }}
              onDone={onTransactionComplete}
            />
          )}
        </>
      ) : (
        <PoolSelector
          factoryAddress={deployedContractData?.address}
          onPoolSelect={setSelectedPool}
        />
      )}

      {isLoading && (
        <div className="text-center p-4">
          <p>Loading pool information...</p>
        </div>
      )}

      {selectedPool && validateTransaction() && (
        <div className="mt-4">
          {llmResponse.type === "swap" && (
            <SwapInterface 
              poolAddress={selectedPool} 
              onSwapCompleted={onTransactionComplete}
              autoExecute={autoExecute}
              initialAmount={String(llmResponse.params.amountIn)}
              initialTokenIn={llmResponse.params.tokenIn}
              initialTokenOut={llmResponse.params.tokenOut}
            />
          )}
          {llmResponse.type === "query" && (
            <div className="bg-base-200 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Query Results</h3>
              <p>Query results will be displayed here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 