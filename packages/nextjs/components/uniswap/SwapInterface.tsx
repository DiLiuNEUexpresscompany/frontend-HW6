"use client"; // 关键：声明这是一个客户端组件

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { type Address } from "viem";
import { useReadContract, useWriteContract } from "wagmi";
import { calculateAmountOutMin, formatTokenAmount, parseTokenAmount, calculatePriceImpact } from "~~/utils/uniswap";
import deployedContracts from "~~/contracts/deployedContracts";
import { useWatchBalance } from "~~/hooks/scaffold-eth/useWatchBalance";
import { formatEther } from "viem";
import { notification } from "~~/utils/scaffold-eth";

// 从deployedContracts获取ABI
const ROUTER_ABI = deployedContracts[11155111].UniswapV2Router02.abi;
const FACTORY_ABI = deployedContracts[11155111].UniswapV2Factory.abi;
const ROUTER_ADDRESS = deployedContracts[11155111].UniswapV2Router02.address;

// ERC20 代币的 ABI
const ERC20_ABI = [
  {
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
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

// Pair 合约的 ABI
const PAIR_ABI = [
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { name: "reserve0", type: "uint112", internalType: "uint112" },
      { name: "reserve1", type: "uint112", internalType: "uint112" },
      { name: "blockTimestampLast", type: "uint32", internalType: "uint32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const WETH_ADDRESS = "0x764ac516ec320a310375e69f59180355c69e313f"; // 这里是 Mainnet WETH 地址，如在本地测试可自行替换

interface SwapInterfaceProps {
  poolAddress: Address;
  routerAddress?: Address; // 可选，如果不提供则使用deployedContracts中的地址
  wethAddress?: Address; // 允许传递WETH地址以适应不同网络
  onSwapCompleted?: () => void; // 交易完成后的回调
}

export const SwapInterface = ({ 
  poolAddress, 
  routerAddress = ROUTER_ADDRESS as Address,
  wethAddress = WETH_ADDRESS as Address,
  onSwapCompleted
}: SwapInterfaceProps) => {
  // 基本状态
  const [amount, setAmount] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [priceImpactThreshold, setPriceImpactThreshold] = useState(100);
  const [isSwapReversed, setIsSwapReversed] = useState(false); // 交换方向状态
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  // 代币相关状态
  const [inputTokenSymbol, setInputTokenSymbol] = useState<string>("");
  const [outputTokenSymbol, setOutputTokenSymbol] = useState<string>("");
  const [inputTokenDecimals, setInputTokenDecimals] = useState<number>(18);
  const [outputTokenDecimals, setOutputTokenDecimals] = useState<number>(18);
  const [isInputTokenEth, setIsInputTokenEth] = useState<boolean>(false);
  const [isOutputTokenEth, setIsOutputTokenEth] = useState<boolean>(false);
  const [inputBalance, setInputBalance] = useState<bigint | null>(null);
  const [outputBalance, setOutputBalance] = useState<bigint | null>(null);

  // 获取当前钱包地址
  const { address } = useAccount();

  // 实时监听 ETH 余额
  const {
    data: ethBalanceData,
    isError: isEthBalanceError,
    isLoading: isEthBalanceLoading,
  } = useWatchBalance({
    address,
  });

  // 读取 Pair 合约数据
  const { data: reserves } = useReadContract({
    address: poolAddress,
    abi: PAIR_ABI,
    functionName: "getReserves",
    query: {
      refetchInterval: 3000, // 每3秒刷新一次池子储备
    }
  });

  const { data: token0Address } = useReadContract({
    address: poolAddress,
    abi: PAIR_ABI,
    functionName: "token0",
  });

  const { data: token1Address } = useReadContract({
    address: poolAddress,
    abi: PAIR_ABI,
    functionName: "token1",
  });

  // 根据交换方向获取当前输入和输出代币
  const inputToken = isSwapReversed ? token1Address : token0Address;
  const outputToken = isSwapReversed ? token0Address : token1Address;

  // 读取代币信息
  const { data: inputTokenSymbolData } = useReadContract({
    address: inputToken as Address,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: {
      enabled: !!inputToken,
    }
  });

  const { data: outputTokenSymbolData } = useReadContract({
    address: outputToken as Address,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: {
      enabled: !!outputToken,
    }
  });

  const { data: inputTokenDecimalsData } = useReadContract({
    address: inputToken as Address,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: {
      enabled: !!inputToken,
    }
  });

  const { data: outputTokenDecimalsData } = useReadContract({
    address: outputToken as Address,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: {
      enabled: !!outputToken,
    }
  });

  // 读取当前输入代币余额（带重新获取函数）
  const { data: inputTokenBalance, refetch: refetchInputBalance } = useReadContract({
    address: inputToken as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!inputToken && !isInputTokenEth,
      refetchInterval: 1000, // 每秒刷新
    },
  });

  // 读取当前输出代币余额（带重新获取函数）
  const { data: outputTokenBalance, refetch: refetchOutputBalance } = useReadContract({
    address: outputToken as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!outputToken && !isOutputTokenEth,
      refetchInterval: 1000, // 每秒刷新
    },
  });

  // 读取授权额度（带重新获取函数）
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: inputToken as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && inputToken ? [address, routerAddress] : undefined,
    query: {
      enabled: !!address && !!inputToken && !isInputTokenEth,
      refetchInterval: 3000, // 每3秒刷新
    },
  });

  // 写合约：swap、approve
  const { writeContract: swap, isPending: isSwapping } = useWriteContract();
  const { writeContract: approve, isPending: isApproving } = useWriteContract();

  // 检查代币是否是ETH/WETH
  useEffect(() => {
    if (inputToken) {
      setIsInputTokenEth(inputToken.toLowerCase() === wethAddress.toLowerCase());
    }
    if (outputToken) {
      setIsOutputTokenEth(outputToken.toLowerCase() === wethAddress.toLowerCase());
    }
  }, [inputToken, outputToken, wethAddress]);

  // 更新代币信息
  useEffect(() => {
    if (inputTokenSymbolData) {
      setInputTokenSymbol(isInputTokenEth ? "ETH" : inputTokenSymbolData);
    } else if (isInputTokenEth) {
      setInputTokenSymbol("ETH");
    }
    
    if (outputTokenSymbolData) {
      setOutputTokenSymbol(isOutputTokenEth ? "ETH" : outputTokenSymbolData);
    } else if (isOutputTokenEth) {
      setOutputTokenSymbol("ETH");
    }
    
    if (inputTokenDecimalsData !== undefined) {
      setInputTokenDecimals(inputTokenDecimalsData);
    }
    
    if (outputTokenDecimalsData !== undefined) {
      setOutputTokenDecimals(outputTokenDecimalsData);
    }
  }, [inputTokenSymbolData, outputTokenSymbolData, inputTokenDecimalsData, outputTokenDecimalsData, isInputTokenEth, isOutputTokenEth]);

  // 更新余额与授权状态
  useEffect(() => {
    // 更新输入代币余额
    if (isInputTokenEth && ethBalanceData) {
      setInputBalance(ethBalanceData.value);
    } else if (inputTokenBalance !== undefined) {
      setInputBalance(inputTokenBalance);
    }
    
    // 更新输出代币余额
    if (isOutputTokenEth && ethBalanceData) {
      setOutputBalance(ethBalanceData.value);
    } else if (outputTokenBalance !== undefined) {
      setOutputBalance(outputTokenBalance);
    }
    
    // 更新授权状态
    if (!isInputTokenEth && allowance !== undefined && amount) {
      const amountBigInt = parseTokenAmount(amount, inputTokenDecimals);
      setNeedsApproval(allowance < amountBigInt);
    } else if (isInputTokenEth) {
      setNeedsApproval(false); // ETH不需要授权
    }
  }, [
    ethBalanceData, 
    inputTokenBalance, 
    outputTokenBalance, 
    allowance, 
    amount, 
    isInputTokenEth, 
    isOutputTokenEth, 
    inputTokenDecimals
  ]);

  // 输入金额发生变化时，计算预期输出和价格影响
  useEffect(() => {
    if (amount && reserves && inputToken && outputToken) {
      const amountIn = parseTokenAmount(amount, inputTokenDecimals);
      const [reserve0, reserve1] = reserves as [bigint, bigint, number];
      
      // 确定正确的储备顺序
      const inputReserve = isSwapReversed ? reserve1 : reserve0;
      const outputReserve = isSwapReversed ? reserve0 : reserve1;
      
      // 计算价格影响
      setPriceImpact(calculatePriceImpact(amountIn, inputReserve));
      
      // 计算预期输出 (使用UniswapV2公式: amountOut = (amountIn * 997 * outputReserve) / (inputReserve * 1000 + amountIn * 997))
      if (amountIn > BigInt(0) && inputReserve > BigInt(0)) {
        const amountInWithFee = amountIn * BigInt(997);
        const numerator = amountInWithFee * outputReserve;
        const denominator = (inputReserve * BigInt(1000)) + amountInWithFee;
        
        if (denominator > BigInt(0)) {
          const amountOut = numerator / denominator;
          setExpectedOutput(formatTokenAmount(amountOut, outputTokenDecimals));
        } else {
          setExpectedOutput("0");
        }
      } else {
        setExpectedOutput("0");
      }
    } else {
      setPriceImpact(null);
      setExpectedOutput("");
    }
  }, [amount, reserves, inputToken, outputToken, isSwapReversed, inputTokenDecimals, outputTokenDecimals]);

  /**
   * 用户输入交易金额时的处理
   */
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);

    // 检查是否需要授权
    if (!isInputTokenEth && value && allowance !== undefined) {
      const amountBigInt = parseTokenAmount(value, inputTokenDecimals);
      setNeedsApproval(allowance < amountBigInt);
    }
  };

  /**
   * 授权
   */
  const handleApprove = async () => {
    if (!inputToken || !amount || isInputTokenEth) return;
    setDebugInfo(null);
    
    const amountToApprove = parseTokenAmount(amount, inputTokenDecimals);
    // 授权大量代币，以避免频繁授权
    const largeApproval = amountToApprove * BigInt(10);
    
    try {
      approve({
        address: inputToken,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [routerAddress, largeApproval],
      });
      notification.success("Approval request sent");
      
      // 监听授权结果
      setTimeout(() => {
        refetchAllowance();
      }, 2000);
    } catch (error) {
      console.error("Failed to approve:", error);
      notification.error("Approval failed");
      setDebugInfo(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  /**
   * 发起 Swap 交易
   */
  const handleSwap = async () => {
    if (!amount || !reserves || !address || !inputToken || !outputToken) {
      notification.error("Please enter valid amounts");
      return;
    }
    
    setDebugInfo(null);
    
    const amountIn = parseTokenAmount(amount, inputTokenDecimals);
    const slippageBips = Math.floor(Number(slippage) * 100);
    const amountOutMin = expectedOutput ? 
      parseTokenAmount(expectedOutput, outputTokenDecimals) * BigInt(10000 - slippageBips) / BigInt(10000) : 
      BigInt(0);
    
    const path = [inputToken, outputToken];
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30分钟期限

    try {
      // 检查ETH余额是否足够支付gas和交易金额
      if (isInputTokenEth) {
        if (!ethBalanceData || ethBalanceData.value < amountIn) {
          notification.error("Insufficient ETH balance");
          return;
        }
        // 确保留有足够的gas费
        const gasReserve = parseTokenAmount("0.01", 18); // 预留0.01 ETH作为gas费
        if (ethBalanceData.value < amountIn + gasReserve) {
          notification.error("Please reserve enough ETH for gas");
          return;
        }
      }

      // 记录调试信息
      const debugLog = {
        inputToken: {
          address: inputToken,
          amount: amountIn.toString(),
          symbol: inputTokenSymbol,
          isEth: isInputTokenEth
        },
        outputToken: {
          address: outputToken,
          minAmount: amountOutMin.toString(),
          symbol: outputTokenSymbol,
          isEth: isOutputTokenEth
        },
        router: routerAddress,
        deadline: deadline.toString(),
        slippage: slippage,
        path: path.map(p => p.toString())
      };
      
      console.log("交易参数:", debugLog);

      // 执行交易
      if (isInputTokenEth) {
        // ETH -> Token
        swap({
          address: routerAddress,
          abi: ROUTER_ABI,
          functionName: "swapExactETHForTokens",
          args: [amountOutMin, path, address, deadline],
          value: amountIn,
        }, {
          onSuccess: async () => {
            notification.success("Transaction successful");
            setAmount("");
            // 立即刷新所有余额
            await Promise.all([
              refetchInputBalance(),
              refetchOutputBalance()
            ]);
            // 等待1秒后再次刷新以确保数据更新
            setTimeout(async () => {
              await Promise.all([
                refetchInputBalance(),
                refetchOutputBalance()
              ]);
            }, 1000);
            if (onSwapCompleted) onSwapCompleted();
          },
          onError: (error) => {
            notification.error("Transaction failed");
            setDebugInfo(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      } else if (isOutputTokenEth) {
        // Token -> ETH
        swap({
          address: routerAddress,
          abi: ROUTER_ABI,
          functionName: "swapExactTokensForETH",
          args: [amountIn, amountOutMin, path, address, deadline],
        }, {
          onSuccess: async () => {
            notification.success("Transaction successful");
            setAmount("");
            // 立即刷新所有余额
            await Promise.all([
              refetchInputBalance(),
              refetchOutputBalance()
            ]);
            // 等待1秒后再次刷新以确保数据更新
            setTimeout(async () => {
              await Promise.all([
                refetchInputBalance(),
                refetchOutputBalance()
              ]);
            }, 1000);
            if (onSwapCompleted) onSwapCompleted();
          },
          onError: (error) => {
            notification.error("Transaction failed");
            setDebugInfo(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      } else {
        // Token -> Token
        swap({
          address: routerAddress,
          abi: ROUTER_ABI,
          functionName: "swapExactTokensForTokens",
          args: [amountIn, amountOutMin, path, address, deadline],
        }, {
          onSuccess: async () => {
            notification.success("Transaction successful");
            setAmount("");
            // 立即刷新所有余额
            await Promise.all([
              refetchInputBalance(),
              refetchOutputBalance()
            ]);
            // 等待1秒后再次刷新以确保数据更新
            setTimeout(async () => {
              await Promise.all([
                refetchInputBalance(),
                refetchOutputBalance()
              ]);
            }, 1000);
            if (onSwapCompleted) onSwapCompleted();
          },
          onError: (error) => {
            notification.error("Transaction failed");
            setDebugInfo(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      }
    } catch (error) {
      console.error("Transaction failed:", error);
      notification.error("Transaction failed");
      setDebugInfo(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // 切换交换方向
  const handleReverseSwap = () => {
    setIsSwapReversed(!isSwapReversed);
    setAmount(""); // 清空输入，因为代币和价格都会变化
    setExpectedOutput("");
    setPriceImpact(null);
  };

  // 余额是否不足
  const isInsufficientBalance = inputBalance !== null && amount && parseTokenAmount(amount, inputTokenDecimals) > inputBalance;
  
  // 价格影响是否过高
  const isHighPriceImpact = priceImpact !== null && priceImpact > priceImpactThreshold;

  return (
    <div className="space-y-4 p-4 bg-base-100 rounded-lg shadow-md">
      <h2 className="text-xl font-bold">Token Swap</h2>
      <p className="text-sm text-base-content/70">Swap tokens through liquidity pool</p>
      
      <div className="space-y-4">
        {/* 输入代币数量 */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">From ({inputTokenSymbol || '---'})</span>
            {isInputTokenEth && <span className="badge badge-info">ETH</span>}
            {priceImpact !== null && (
              <span className={`label-text-alt ${
                priceImpact > 15 ? "text-error" : priceImpact > 5 ? "text-warning" : "text-success"
              }`}>
                Price Impact: {priceImpact.toFixed(2)}%
              </span>
            )}
          </label>
          <div className="join w-full">
            <input
              type="number"
              className={`input input-bordered join-item w-full ${isInsufficientBalance ? "input-error" : ""}`}
              value={amount}
              onChange={handleAmountChange}
              placeholder="0.0"
              step="any"
            />
            {inputBalance !== null && isInputTokenEth && (
              <button 
                className="btn join-item"
                onClick={() => {
                  if (ethBalanceData) {
                    const gasReserve = parseTokenAmount("0.01", 18);
                    const usableBalance = ethBalanceData.value > gasReserve 
                      ? ethBalanceData.value - gasReserve 
                      : BigInt(0);
                    setAmount(formatTokenAmount(usableBalance, inputTokenDecimals));
                  }
                }}
              >
                Max
              </button>
            )}
          </div>
          {inputBalance !== null && (
            <label className="label">
              <span className="label-text-alt flex items-center gap-2">
                <span>Balance: {isInputTokenEth 
                  ? `${ethBalanceData ? Number(formatEther(ethBalanceData.value)).toFixed(4) : '0.0'} ETH`
                  : `${formatTokenAmount(inputBalance, inputTokenDecimals)} ${inputTokenSymbol}`
                }</span>
                {isInputTokenEth && (
                  <button 
                    className="btn btn-xs"
                    onClick={() => {
                      if (ethBalanceData) {
                        const gasReserve = parseTokenAmount("0.01", 18);
                        const usableBalance = ethBalanceData.value > gasReserve 
                          ? ethBalanceData.value - gasReserve 
                          : BigInt(0);
                        setAmount(formatTokenAmount(usableBalance, inputTokenDecimals));
                      }
                    }}
                  >
                    Max
                  </button>
                )}
              </span>
            </label>
          )}
          {isInsufficientBalance && (
            <label className="label">
              <span className="label-text-alt text-error">
                Insufficient {inputTokenSymbol} balance
              </span>
            </label>
          )}
        </div>

        {/* 交换方向按钮 */}
        <div className="flex justify-center">
          <button 
            className="btn btn-circle btn-outline" 
            onClick={handleReverseSwap}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* 输出代币数量 */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">To ({outputTokenSymbol || '---'})</span>
            {isOutputTokenEth && <span className="badge badge-info">ETH</span>}
          </label>
          <div className="join w-full">
            <input
              type="number"
              className="input input-bordered join-item w-full"
              value={expectedOutput}
              disabled
              placeholder="0.0"
            />
          </div>
          {outputBalance !== null && (
            <label className="label">
              <span className="label-text-alt flex items-center gap-2">
                <span>Balance: {isOutputTokenEth 
                  ? (ethBalanceData ? Number(formatEther(ethBalanceData.value)).toFixed(4) : '0.0') 
                  : formatTokenAmount(outputBalance, outputTokenDecimals)} {outputTokenSymbol}</span>
              </span>
            </label>
          )}
        </div>

        {/* 滑点设置 */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Slippage (%)</span>
            <span className="label-text-alt">Recommended: 0.5%</span>
          </label>
          <input
            type="number"
            className="input input-bordered"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            min="0.1"
            max="10"
            step="0.1"
          />
        </div>
        
        {/* 价格影响警告 */}
        {priceImpact !== null && priceImpact > 5 && (
          <div className={`alert ${priceImpact > 15 ? "alert-error" : "alert-warning"} mt-2`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current flex-shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              {priceImpact > 15
                ? `Extreme price impact (${priceImpact.toFixed(2)}%)! You may lose most of your funds`
                : `High price impact (${priceImpact.toFixed(2)}%), trade carefully`}
            </div>
          </div>
        )}

        {/* 允许超高价格影响 */}
        {priceImpact !== null && priceImpact > 15 && (
          <div className="form-control">
            <label className="cursor-pointer label justify-start">
              <input
                type="checkbox"
                className="toggle toggle-warning"
                checked={priceImpactThreshold >= 100}
                onChange={(e) => {
                  setPriceImpactThreshold(e.target.checked ? 100 : 15);
                }}
              />
              <span className="label-text ml-2">I understand the risks and want to proceed</span>
            </label>
          </div>
        )}
        
        {/* 按钮部分 */}
        <div className="space-y-2">
          {needsApproval && (
            <button 
              className={`btn btn-primary w-full${isApproving ? " loading" : ""}`}
              onClick={handleApprove}
              disabled={isApproving || !amount}
            >
              {isApproving ? "Approving..." : `Approve ${inputTokenSymbol || 'Token'}`}
            </button>
          )}
          
          {!needsApproval && (
            <button 
              className={`btn btn-primary w-full${isSwapping ? " loading" : ""}`}
              onClick={handleSwap}
              disabled={Boolean(
                isSwapping || 
                !amount || 
                isInsufficientBalance || 
                isHighPriceImpact
              )}
            >
              {isSwapping ? "Swapping..." : 
              isInsufficientBalance ? `Insufficient ${inputTokenSymbol || 'Token'} Balance` :
              isHighPriceImpact ? "Price Impact Too High" :
              "Swap"}
            </button>
          )}
        </div>

        {/* 交易解释 */}
        <div className="alert alert-info text-sm mt-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <p>Swap operation exchanges one token for another through the liquidity pool.</p>
            <p className="mt-1">This operation may require two transactions: one for approval and one for swapping.</p>
          </div>
        </div>
        
        {/* 调试信息 */}
        {debugInfo && (
          <div className="alert alert-warning text-sm mt-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-medium">Debug Info</p>
              <p className="text-xs break-all">{debugInfo}</p>
            </div>
          </div>
        )}

        {/* 帮助提示 */}
        <div className="collapse collapse-arrow border border-base-300 bg-base-200 mt-2">
          <input type="checkbox" /> 
          <div className="collapse-title text-md font-medium">
            Troubleshooting & Help
          </div>
          <div className="collapse-content text-sm"> 
            <p className="mb-2"><strong>Common reasons for transaction failure:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Insufficient ETH for gas fees</li>
              <li>Slippage too low, price moved before confirmation</li>
              <li>Token approval failed</li>
              <li>Insufficient liquidity</li>
              <li>High price impact may result in minimal token output</li>
            </ul>
            
            <p className="mt-3 mb-2"><strong>Ways to reduce price impact:</strong></p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Reduce transaction amount, split large trades</li>
              <li>Wait for increased liquidity</li>
              <li>Try alternative trading paths or platforms</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};