// components/PoolQueryExecutor.tsx
"use client";

import React, { useEffect, useState } from "react";
import { type Address, keccak256 } from "viem";
import { useReadContract, usePublicClient } from "wagmi";
import { MetricCard } from "./MetricCard";
import SwapPriceDistribution from "./SwapPriceDistribution";

// 你自己定义的 UniswapV2Pair ABI（只要包含你要用的方法和事件就行）
const PAIR_ABI = [
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { name: "reserve0", type: "uint112", internalType: "uint112" },
      { name: "reserve1", type: "uint112", internalType: "uint112" },
      { name: "blockTimestampLast", type: "uint32", internalType: "uint32" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "sender", type: "address" },
      { indexed: false, name: "amount0In", type: "uint256" },
      { indexed: false, name: "amount1In", type: "uint256" },
      { indexed: false, name: "amount0Out", type: "uint256" },
      { indexed: false, name: "amount1Out", type: "uint256" },
      { indexed: true, name: "to", type: "address" }
    ],
    name: "Swap",
    type: "event"
  }
] as const;

// 添加 ERC20 ABI 用于获取代币信息
const ERC20_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

// 事件 topic
const SWAP_TOPIC = keccak256(
  new TextEncoder().encode(
    "Swap(address,uint256,uint256,uint256,uint256,address)"
  )
);
const AVG_BLOCK_TIME = 12;

export type PoolIntent = 
  | "getReserves"
  | "swapCount"
  | "priceDistribution";

export interface PoolQueryExecutorProps {
  poolAddress: Address;
  intent: PoolIntent;
  timeframe: "today" | { from: number; to: number };
}

export default function PoolQueryExecutor({
  poolAddress,
  intent,
  timeframe,
}: PoolQueryExecutorProps) {
  const publicClient = usePublicClient();
  const [token0Info, setToken0Info] = useState<{ decimals: number; symbol: string } | null>(null);
  const [token1Info, setToken1Info] = useState<{ decimals: number; symbol: string } | null>(null);

  // —— 1. getReserves ——
  const { data: rawReserves } = useReadContract({
    address: poolAddress,
    abi: PAIR_ABI,
    functionName: "getReserves",
    query: { enabled: intent === "getReserves" },
  });
  const [reserves, setReserves] = useState<{ reserve0: number, reserve1: number, timestamp: number } | null>(null);
  useEffect(() => {
    if (rawReserves && intent === "getReserves") {
      const [r0, r1, ts] = rawReserves;
      setReserves({ reserve0: Number(r0), reserve1: Number(r1), timestamp: Number(ts) * 1000 });
    }
  }, [rawReserves, intent]);

  // 获取代币0信息
  const { data: token0Address } = useReadContract({
    address: poolAddress,
    abi: PAIR_ABI,
    functionName: "token0",
  });

  const { data: token0Decimals } = useReadContract({
    address: token0Address as Address,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!token0Address },
  });

  const { data: token0Symbol } = useReadContract({
    address: token0Address as Address,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: !!token0Address },
  });

  // 获取代币1信息
  const { data: token1Address } = useReadContract({
    address: poolAddress,
    abi: PAIR_ABI,
    functionName: "token1",
  });

  const { data: token1Decimals } = useReadContract({
    address: token1Address as Address,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!token1Address },
  });

  const { data: token1Symbol } = useReadContract({
    address: token1Address as Address,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: !!token1Address },
  });

  // 更新代币信息
  useEffect(() => {
    if (token0Decimals !== undefined && token0Symbol) {
      setToken0Info({ decimals: Number(token0Decimals), symbol: token0Symbol });
    }
  }, [token0Decimals, token0Symbol]);

  useEffect(() => {
    if (token1Decimals !== undefined && token1Symbol) {
      setToken1Info({ decimals: Number(token1Decimals), symbol: token1Symbol });
    }
  }, [token1Decimals, token1Symbol]);

  // 格式化数字函数
  const formatTokenAmount = (amount: number, decimals: number) => {
    return (amount / Math.pow(10, decimals)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals
    });
  };

  // —— 2. swapCount ——
  const [swapCount, setSwapCount] = useState<number | null>(null);
  useEffect(() => {
    if (intent !== "swapCount") return;
    if (!publicClient) {
      console.warn("Public client is not available");
      return;
    }
    (async () => {
      const now = Date.now();
      let fromTs: number, toTs: number;
      if (timeframe === "today") {
        const t = new Date(); t.setHours(0,0,0,0);
        fromTs = t.getTime(); toTs = now;
      } else {
        fromTs = timeframe.from; toTs = timeframe.to;
      }
      const latest = await publicClient.getBlockNumber();
      const blocksAgo = Math.ceil((now - fromTs) / (AVG_BLOCK_TIME * 1000));
      const fromBlock = BigInt(Math.max(0, Number(latest) - blocksAgo));
      const logs = await publicClient.getLogs({
        address: poolAddress,
        event: {
          name: "Swap",
          type: "event",
          inputs: [
            { type: "address", indexed: true, name: "sender" },
            { type: "uint256", indexed: false, name: "amount0In" },
            { type: "uint256", indexed: false, name: "amount1In" },
            { type: "uint256", indexed: false, name: "amount0Out" },
            { type: "uint256", indexed: false, name: "amount1Out" },
            { type: "address", indexed: true, name: "to" }
          ]
        },
        fromBlock,
        toBlock: latest,
      });
      setSwapCount(logs.length);
    })();
  }, [intent, timeframe, poolAddress, publicClient]);

  return (
    <div className="space-y-6">
      {intent === "getReserves" && reserves && token0Info && token1Info && (
        <>
          <h3 className="text-lg font-semibold">Pool Reserves</h3>
          <MetricCard 
            label={`${token0Info.symbol} Reserve`} 
            value={formatTokenAmount(reserves.reserve0, token0Info.decimals)} 
          />
          <MetricCard 
            label={`${token1Info.symbol} Reserve`} 
            value={formatTokenAmount(reserves.reserve1, token1Info.decimals)} 
          />
          <p className="text-sm text-gray-500">
            Last updated: {new Date(reserves.timestamp).toLocaleString()}
          </p>
        </>
      )}

      {intent === "swapCount" && swapCount !== null && (
        <>
          <h3 className="text-lg font-semibold">
            Swaps {timeframe === "today" ? "Today" : ""}
          </h3>
          <MetricCard label="Total Swaps" value={swapCount.toString()} />
        </>
      )}

      {intent === "priceDistribution" && (
        <>
          <h3 className="text-lg font-semibold">Price Distribution</h3>
          <div className="h-[400px]">
            <SwapPriceDistribution
              poolAddress={poolAddress}
              refreshTrigger={Date.now()}
            />
          </div>
        </>
      )}
    </div>
  );
}
