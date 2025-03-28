"use client";

import { useEffect, useState } from "react";
import { Address } from "viem";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { ReservesCurveChart } from "~~/components/uniswap/ReservesCurveChart";
import { PoolSelector } from "~~/components/uniswap/PoolSelector";
import { SwapInterface } from "~~/components/uniswap/SwapInterface";
import { LiquidityInterface } from "~~/components/uniswap/LiquidityInterface";
import { useReadContract } from "wagmi";
import SwapPriceDistribution from "~~/components/uniswap/SwapPriceDistribution";

export default function Home() {
  const [selectedPool, setSelectedPool] = useState<Address>();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [hasLiquidity, setHasLiquidity] = useState(false);
  const { data: routerInfo } = useDeployedContractInfo({
    contractName: "UniswapV2Router02"
  });
  const { data: factoryInfo } = useDeployedContractInfo({
    contractName: "UniswapV2Factory"
  });
  const { data: wethInfo } = useDeployedContractInfo({
    contractName: "WETH"
  });

  // Pair 合约的 ABI 片段，用于获取储备量
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
    }
  ] as const;

  // 检查池中是否有流动性
  const { data: reservesData, refetch: refetchReserves } = useReadContract({
    address: selectedPool as Address,
    abi: PAIR_ABI,
    functionName: "getReserves",
    query: {
      enabled: !!selectedPool,
    }
  });

  // 检查池中的流动性状态
  useEffect(() => {
    if (reservesData) {
      const [reserve0, reserve1] = reservesData;
      // 如果两个储备都大于0，则认为池中有流动性
      setHasLiquidity(reserve0 > 0n && reserve1 > 0n);
    } else {
      setHasLiquidity(false);
    }
  }, [reservesData]);

  // 定期刷新储备数据
  useEffect(() => {
    if (selectedPool) {
      const interval = setInterval(() => {
        refetchReserves();
      }, 5000); // 每5秒刷新一次
      return () => clearInterval(interval);
    }
  }, [selectedPool, refetchReserves]);

  const handlePoolSelect = (poolAddress: Address) => {
    setSelectedPool(poolAddress);
    // 立即刷新储备数据
    setTimeout(() => refetchReserves(), 500);
  };

  const handleLiquidityAdded = () => {
    // 增加刷新触发器，触发相关组件刷新
    setRefreshTrigger(prev => prev + 1);
    // 刷新储备数据以检查流动性状态
    refetchReserves();
  };

  // 刷新函数
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (!routerInfo?.address || !factoryInfo?.address) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-base-200 to-base-300 py-8">
        <div className="container mx-auto px-4">
          <div className="alert alert-warning shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-bold">Notice!</h3>
              <div className="text-sm">Router or Factory contract not deployed. Please deploy contracts first.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-base-200 to-base-300 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Uniswap V2
          </h1>
          <p className="text-base-content/60">
            Decentralized Exchange - Trade, Provide Liquidity, Earn Yields
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* 左侧面板 */}
          <div className="lg:col-span-3 space-y-6">
            <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-200">
              <div className="card-body">
                <h2 className="card-title text-2xl font-bold mb-6 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Select Pool
                </h2>
                <PoolSelector 
                  onPoolSelect={handlePoolSelect} 
                  factoryAddress={factoryInfo.address}
                />
              </div>
            </div>

            {selectedPool && (
              <>
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-200">
                  <div className="card-body">
                    <h2 className="card-title text-2xl font-bold mb-2 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Liquidity
                    </h2>
                    {!hasLiquidity && (
                      <div className="alert alert-info mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span>Sufficient liquidity must be added before trading</span>
                      </div>
                    )}
                    <LiquidityInterface 
                      poolAddress={selectedPool} 
                      routerAddress={routerInfo.address}
                      wethAddress={wethInfo?.address} 
                      onLiquidityAdded={handleLiquidityAdded}
                    />
                  </div>
                </div>

                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-200">
                  <div className="card-body">
                    <h2 className="card-title text-2xl font-bold mb-2 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Swap Tokens
                    </h2>
                    {!hasLiquidity && (
                      <div className="alert alert-warning mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <h3 className="font-bold">Warning!</h3>
                          <div className="text-sm">This pool has no liquidity. Trades may fail or have extreme price impact. Please add liquidity first.</div>
                        </div>
                      </div>
                    )}
                    <SwapInterface 
                      poolAddress={selectedPool} 
                      routerAddress={routerInfo.address} 
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 右侧面板 */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPool ? (
              <>
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-200">
                  <div className="card-body">
                    <h2 className="card-title text-xl font-bold mb-2">Pool Status</h2>
                    {hasLiquidity ? (
                      <div className="alert alert-success">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Pool has liquidity, ready for trading</span>
                      </div>
                    ) : (
                      <div className="alert alert-warning">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Pool has no liquidity, needs to be added</span>
                      </div>
                    )}
                    <div className="text-sm opacity-70 mt-2">
                      Pool Address: <span className="font-mono text-xs break-all">{selectedPool}</span>
                    </div>
                  </div>
                </div>
                
               <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-200">
                <div className="card-body">
                  <h2 className="card-title text-xl font-bold mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    Reserve Curve
                  </h2>
                  <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold">Reserve Curve</h2>
                    <button 
                      className="btn btn-sm btn-outline"
                      onClick={handleRefresh}
                    >
                      Refresh Data
                    </button>
                  </div>
                  {reservesData ? (
                    <div className="flex flex-col gap-y-6 lg:gap-y-8">
                      <h2 className="text-3xl font-bold text-center">Reserve Curve</h2>
                      <ReservesCurveChart 
                        poolAddress={selectedPool} 
                        refreshTrigger={refreshTrigger}
                        key={`pool-${selectedPool}-refresh-${refreshTrigger}`} 
                      />
                      
                      {/* Price Distribution Chart */}
                      <div className="mt-4">
                        <SwapPriceDistribution 
                          poolAddress={selectedPool}
                          refreshTrigger={refreshTrigger}
                          key={`pool-${selectedPool}-price-${refreshTrigger}`}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center items-center h-[400px]">
                      <span className="loading loading-spinner loading-lg"></span>
                    </div>
                  )}
                </div>
              </div>
                
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-200">
                  <div className="card-body">
                    <h2 className="card-title text-xl font-bold mb-2">User Guide</h2>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>
                        <span className="font-medium">Select Pool</span>
                        <p className="text-xs ml-5 text-base-content/70">Choose or create a pool from the left panel</p>
                      </li>
                      <li>
                        <span className="font-medium text-primary">Add Liquidity</span>
                        <p className="text-xs ml-5 text-base-content/70">Add sufficient liquidity to enable trading</p>
                      </li>
                      <li>
                        <span className="font-medium">Start Trading</span>
                        <p className="text-xs ml-5 text-base-content/70">Once there&apos;s enough liquidity, you can swap tokens</p>
                      </li>
                    </ol>
                  </div>
                </div>
              </>
            ) : (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body items-center text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-base-content/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <h3 className="text-lg font-semibold mt-4">Please Select a Pool</h3>
                  <p className="text-base-content/60 mt-2">
                    More features will be shown after selecting a pool
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
