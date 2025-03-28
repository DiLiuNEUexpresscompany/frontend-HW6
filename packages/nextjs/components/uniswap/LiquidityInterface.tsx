import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { type Address, formatEther } from "viem";
import { useReadContract, useWriteContract } from "wagmi";
import { formatTokenAmount, parseTokenAmount } from "~~/utils/uniswap";
import deployedContracts from "~~/contracts/deployedContracts";
import { notification } from "~~/utils/scaffold-eth";
import { useWatchBalance } from "~~/hooks/scaffold-eth/useWatchBalance";


// 从deployedContracts获取ABI
const ROUTER_ABI = deployedContracts[11155111].UniswapV2Router02.abi;
const ROUTER_ADDRESS = deployedContracts[11155111].UniswapV2Router02.address;

// ERC20 代币的 ABI
const ERC20_ABI = [
  {
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" }
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
    type: "function"
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
  }
] as const;

const WETH_ABI = [
  ...ERC20_ABI,
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  }
] as const;

interface LiquidityInterfaceProps {
  poolAddress: Address;
  routerAddress?: Address;
  wethAddress?: Address; // 允许传递WETH地址以适应不同网络
  onLiquidityAdded?: () => void; // 添加流动性成功后的回调
}

export const LiquidityInterface = ({ 
  poolAddress, 
  routerAddress = ROUTER_ADDRESS as Address,
  // 默认使用部署的WETH地址，或者在本地网络使用常见的WETH地址
  wethAddress = "0x764ac516ec320a310375e69f59180355c69e313f" as Address,
  onLiquidityAdded
}: LiquidityInterfaceProps) => {
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [slippage, setSlippage] = useState("1.0"); // 默认滑点提高到1%
  const [needsApproval0, setNeedsApproval0] = useState(false);
  const [needsApproval1, setNeedsApproval1] = useState(false);
  const [balance0, setBalance0] = useState<bigint | null>(null);
  const [balance1, setBalance1] = useState<bigint | null>(null);
  const [token0Symbol, setToken0Symbol] = useState<string>("");
  const [token1Symbol, setToken1Symbol] = useState<string>("");
  const [token0Decimals, setToken0Decimals] = useState<number>(18);
  const [token1Decimals, setToken1Decimals] = useState<number>(18);
  const [isToken0Eth, setIsToken0Eth] = useState<boolean>(false);
  const [isToken1Eth, setIsToken1Eth] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const { address } = useAccount();
  const [wethBalance0, setWethBalance0] = useState<bigint | null>(null);
  const [wethBalance1, setWethBalance1] = useState<bigint | null>(null);
  const [showWrapEthModal, setShowWrapEthModal] = useState(false);
  const [wrapAmount, setWrapAmount] = useState("");

  // 使用useWatchBalance获取ETH余额
  const {
    data: ethBalanceData,
    isError: isEthBalanceError,
    isLoading: isEthBalanceLoading,
  } = useWatchBalance({
    address,
  });

  // 读取合约数据
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

  // 读取代币信息
  const { data: token0SymbolData } = useReadContract({
    address: token0Address as Address,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: {
      enabled: !!token0Address,
    }
  });

  const { data: token1SymbolData } = useReadContract({
    address: token1Address as Address,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: {
      enabled: !!token1Address,
    }
  });

  const { data: token0DecimalsData } = useReadContract({
    address: token0Address as Address,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: {
      enabled: !!token0Address,
    }
  });

  const { data: token1DecimalsData } = useReadContract({
    address: token1Address as Address,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: {
      enabled: !!token1Address,
    }
  });

  // 检查代币余额和授权
  const { data: token0Balance, refetch: refetchToken0Balance } = useReadContract({
    address: token0Address as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!token0Address && !isToken0Eth,
      refetchInterval: 1000, // 缩短到1秒刷新一次
    }
  });

  const { data: token1Balance, refetch: refetchToken1Balance } = useReadContract({
    address: token1Address as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!token1Address && !isToken1Eth,
      refetchInterval: 1000, // 缩短到1秒刷新一次
    }
  });

  const { data: token0Allowance, refetch: refetchToken0Allowance } = useReadContract({
    address: token0Address as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && token0Address ? [address, routerAddress] : undefined,
    query: {
      enabled: !!address && !!token0Address && !isToken0Eth,
      refetchInterval: 3000, // 每3秒刷新一次
    }
  });

  const { data: token1Allowance, refetch: refetchToken1Allowance } = useReadContract({
    address: token1Address as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && token1Address ? [address, routerAddress] : undefined,
    query: {
      enabled: !!address && !!token1Address && !isToken1Eth,
      refetchInterval: 3000, // 每3秒刷新一次
    }
  });

  // 查询WETH余额
  const { data: weth0Balance, refetch: refetchWeth0Balance } = useReadContract({
    address: wethAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isToken0Eth,
      refetchInterval: 1000,
    }
  });

  const { data: weth1Balance, refetch: refetchWeth1Balance } = useReadContract({
    address: wethAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isToken1Eth,
      refetchInterval: 1000,
    }
  });

  // 写入合约
  const { writeContract: addLiquidity, isPending: isAddingLiquidity } = useWriteContract();
  const { writeContract: approve0, isPending: isApproving0 } = useWriteContract();
  const { writeContract: approve1, isPending: isApproving1 } = useWriteContract();
  const { writeContract: wethDeposit } = useWriteContract();

  // 检查是否是ETH代币
  useEffect(() => {
    if (token0Address) {
      setIsToken0Eth(token0Address.toLowerCase() === wethAddress.toLowerCase());
    }
    if (token1Address) {
      setIsToken1Eth(token1Address.toLowerCase() === wethAddress.toLowerCase());
    }
  }, [token0Address, token1Address, wethAddress]);

  // 更新代币信息
  useEffect(() => {
    if (token0SymbolData) {
      setToken0Symbol(isToken0Eth ? "ETH" : token0SymbolData);
    } else if (isToken0Eth) {
      setToken0Symbol("ETH");
    }
    
    if (token1SymbolData) {
      setToken1Symbol(isToken1Eth ? "ETH" : token1SymbolData);
    } else if (isToken1Eth) {
      setToken1Symbol("ETH");
    }
    
    if (token0DecimalsData !== undefined) {
      setToken0Decimals(token0DecimalsData);
    }
    
    if (token1DecimalsData !== undefined) {
      setToken1Decimals(token1DecimalsData);
    }
  }, [token0SymbolData, token1SymbolData, token0DecimalsData, token1DecimalsData, isToken0Eth, isToken1Eth]);

  // 更新余额和授权状态
  useEffect(() => {
    // 处理Token0余额
    if (isToken0Eth && ethBalanceData) {
      setBalance0(ethBalanceData.value);
    } else if (token0Balance !== undefined) {
      setBalance0(token0Balance);
    }
    
    // 处理Token1余额
    if (isToken1Eth && ethBalanceData) {
      setBalance1(ethBalanceData.value);
    } else if (token1Balance !== undefined) {
      setBalance1(token1Balance);
    }
    
    // 处理Token0授权
    if (isToken0Eth) {
      // ETH不需要授权
      setNeedsApproval0(false);
    } else if (token0Allowance !== undefined && amount0) {
      const amount0BigInt = parseTokenAmount(amount0, token0Decimals);
      setNeedsApproval0(token0Allowance < amount0BigInt);
    }
    
    // 处理Token1授权
    if (isToken1Eth) {
      // ETH不需要授权
      setNeedsApproval1(false);
    } else if (token1Allowance !== undefined && amount1) {
      const amount1BigInt = parseTokenAmount(amount1, token1Decimals);
      setNeedsApproval1(token1Allowance < amount1BigInt);
    }
    
  }, [ethBalanceData, token0Balance, token1Balance, token0Allowance, token1Allowance, amount0, amount1, token0Decimals, token1Decimals, isToken0Eth, isToken1Eth]);

  // 更新WETH余额
  useEffect(() => {
    if (isToken0Eth && weth0Balance !== undefined) {
      setWethBalance0(weth0Balance);
    }
    if (isToken1Eth && weth1Balance !== undefined) {
      setWethBalance1(weth1Balance);
    }
  }, [weth0Balance, weth1Balance, isToken0Eth, isToken1Eth]);

  const handleAmount0Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount0(value);
    
    if (!isToken0Eth && value && token0Allowance !== undefined) {
      const amount0BigInt = parseTokenAmount(value, token0Decimals);
      setNeedsApproval0(token0Allowance < amount0BigInt);
    }
  };

  const handleAmount1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount1(value);
    
    if (!isToken1Eth && value && token1Allowance !== undefined) {
      const amount1BigInt = parseTokenAmount(value, token1Decimals);
      setNeedsApproval1(token1Allowance < amount1BigInt);
    }
  };

  const handleApprove0 = async () => {
    if (!token0Address || !amount0 || isToken0Eth) return;
    
    const amountToApprove = parseTokenAmount(amount0, token0Decimals);
    // 授权大量代币，以避免频繁授权
    const largeApproval = amountToApprove * BigInt(10);
    
    try {
      approve0({
        address: token0Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [routerAddress, largeApproval],
      });
      notification.success("Approval request sent");
      
      // 监听授权结果
      setTimeout(() => {
        refetchToken0Allowance();
      }, 2000);
    } catch (error) {
      console.error("代币0授权失败:", error);
      notification.error("Token0 approval failed");
      setDebugInfo(`代币0授权失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleApprove1 = async () => {
    if (!token1Address || !amount1 || isToken1Eth) return;
    
    const amountToApprove = parseTokenAmount(amount1, token1Decimals);
    // 授权大量代币，以避免频繁授权
    const largeApproval = amountToApprove * BigInt(10);
    
    try {
      approve1({
        address: token1Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [routerAddress, largeApproval],
      });
      notification.success("Approval request sent");
      
      // 监听授权结果
      setTimeout(() => {
        refetchToken1Allowance();
      }, 2000);
    } catch (error) {
      console.error("代币1授权失败:", error);
      notification.error("Token1 approval failed");
      setDebugInfo(`代币1授权失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleAddLiquidity = async () => {
    if (!amount0 || !amount1 || !address || !token0Address || !token1Address) {
      notification.error("Please enter valid amounts");
      return;
    }
    
    setDebugInfo(null);
    
    const amount0BigInt = parseTokenAmount(amount0, token0Decimals);
    const amount1BigInt = parseTokenAmount(amount1, token1Decimals);
    const slippageBips = Math.floor(Number(slippage) * 100);
    const amount0Min = amount0BigInt * BigInt(10000 - slippageBips) / BigInt(10000);
    const amount1Min = amount1BigInt * BigInt(10000 - slippageBips) / BigInt(10000);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30分钟期限
    
    try {
      // 记录调试信息
      const debugLog = {
        token0: {
          address: token0Address,
          amount: amount0BigInt.toString(),
          min: amount0Min.toString(),
          symbol: token0Symbol,
          isEth: isToken0Eth
        },
        token1: {
          address: token1Address,
          amount: amount1BigInt.toString(),
          min: amount1Min.toString(),
          symbol: token1Symbol,
          isEth: isToken1Eth
        },
        router: routerAddress,
        deadline: deadline.toString(),
        slippage: slippage
      };
      
      console.log("添加流动性参数:", debugLog);
      
      // 检查ETH余额是否足够支付gas
      if (!ethBalanceData || ethBalanceData.value === BigInt(0)) {
        notification.error("Insufficient ETH for gas fees");
        return;
      }

      // 根据是否包含ETH选择不同的添加流动性方法
      if (isToken0Eth || isToken1Eth) {
        // 使用addLiquidityETH，确定哪个是ETH，哪个是代币
        const tokenAddress = isToken0Eth ? token1Address : token0Address;
        const tokenAmount = isToken0Eth ? amount1BigInt : amount0BigInt;
        const tokenAmountMin = isToken0Eth ? amount1Min : amount0Min;
        const ethAmount = isToken0Eth ? amount0BigInt : amount1BigInt;
        const ethAmountMin = isToken0Eth ? amount0Min : amount1Min;

        // 检查ETH余额是否足够
        if (ethBalanceData.value < ethAmount) {
          notification.error("Insufficient ETH balance");
          return;
        }

        addLiquidity({
          address: routerAddress,
          abi: ROUTER_ABI,
          functionName: "addLiquidityETH",
          args: [tokenAddress, tokenAmount, tokenAmountMin, ethAmountMin, address, deadline],
          value: ethAmount,
        }, {
          onSuccess: async () => {
            notification.success("Successfully added liquidity");
            setAmount0("");
            setAmount1("");
            // 立即刷新所有余额
            await Promise.all([
              refetchToken0Balance(),
              refetchToken1Balance()
            ]);
            // 等待1秒后再次刷新以确保数据更新
            setTimeout(async () => {
              await Promise.all([
                refetchToken0Balance(),
                refetchToken1Balance()
              ]);
            }, 1000);
            if (onLiquidityAdded) onLiquidityAdded();
          },
          onError: (error) => {
            notification.error("Failed to add liquidity");
            setDebugInfo(`添加流动性失败: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      } else {
        // 使用addLiquidity (仅适用于两个都是ERC20代币的情况)
        addLiquidity({
          address: routerAddress,
          abi: ROUTER_ABI,
          functionName: "addLiquidity",
          args: [token0Address, token1Address, amount0BigInt, amount1BigInt, amount0Min, amount1Min, address, deadline],
        }, {
          onSuccess: async () => {
            notification.success("Successfully added liquidity");
            setAmount0("");
            setAmount1("");
            // 立即刷新所有余额
            await Promise.all([
              refetchToken0Balance(),
              refetchToken1Balance()
            ]);
            // 等待1秒后再次刷新以确保数据更新
            setTimeout(async () => {
              await Promise.all([
                refetchToken0Balance(),
                refetchToken1Balance()
              ]);
            }, 1000);
            if (onLiquidityAdded) onLiquidityAdded();
          },
          onError: (error) => {
            notification.error("Failed to add liquidity");
            setDebugInfo(`添加流动性失败: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      }
    } catch (error) {
      console.error("添加流动性失败:", error);
      notification.error("Failed to add liquidity");
      setDebugInfo(`添加流动性失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleWrapEth = async () => {
    if (!wrapAmount) return;
    
    try {
      const wrapAmountBigInt = parseTokenAmount(wrapAmount, 18);
      
      wethDeposit({
        address: wethAddress,
        abi: WETH_ABI,
        functionName: "deposit",
        value: wrapAmountBigInt,
      }, {
        onSuccess: async () => {
          notification.success("ETH wrapped successfully");
          setWrapAmount("");
          setShowWrapEthModal(false);
          // 刷新余额
          await Promise.all([
            refetchWeth0Balance(),
            refetchWeth1Balance()
          ]);
          // 1秒后再次刷新
          setTimeout(async () => {
            await Promise.all([
              refetchWeth0Balance(),
              refetchWeth1Balance()
            ]);
          }, 1000);
        },
        onError: (error) => {
          notification.error("ETH wrapping failed");
          setDebugInfo(`ETH 包装失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    } catch (error) {
      console.error("ETH 包装失败:", error);
      notification.error("ETH wrapping failed");
      setDebugInfo(`ETH 包装失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const isInsufficientBalance0 = isToken0Eth 
    ? (ethBalanceData && amount0 && parseTokenAmount(amount0, token0Decimals) > ethBalanceData.value)
    : (balance0 !== null && amount0 && parseTokenAmount(amount0, token0Decimals) > balance0);
    
  const isInsufficientBalance1 = isToken1Eth
    ? (ethBalanceData && amount1 && parseTokenAmount(amount1, token1Decimals) > ethBalanceData.value)
    : (balance1 !== null && amount1 && parseTokenAmount(amount1, token1Decimals) > balance1);

  return (
    <div className="space-y-4 p-4 bg-base-100 rounded-lg shadow-md">
      <h2 className="text-xl font-bold">Add Liquidity</h2>
      <p className="text-sm text-base-content/70">Add liquidity to receive LP tokens and start trading</p>
      
      {/* 代币0输入 */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Token0 Amount ({token0Symbol || '---'})</span>
          {isToken0Eth && <span className="badge badge-info">ETH</span>}
        </label>
        <div className="join w-full">
          <input
            type="number"
            className={`input input-bordered join-item w-full ${isInsufficientBalance0 ? "input-error" : ""}`}
            value={amount0}
            onChange={handleAmount0Change}
            placeholder="0.0"
            step="any"
          />
          {balance0 !== null && isToken0Eth && (
            <button 
              className="btn join-item"
              onClick={() => {
                // 如果是ETH，保留一些用于gas费
                const reserveAmount = parseTokenAmount("0.01", 18);
                const usableBalance = balance0 > reserveAmount ? balance0 - reserveAmount : BigInt(0);
                setAmount0(formatTokenAmount(usableBalance, 18));
              }}
            >
              Max
            </button>
          )}
        </div>
        {balance0 !== null && isToken0Eth && (
          <label className="label">
            <span className="label-text-alt flex items-center gap-2">
              <span>ETH Balance: {ethBalanceData ? Number(formatEther(ethBalanceData.value)).toFixed(4) : '0.0'} ETH</span>
            </span>
          </label>
        )}
        {balance0 !== null && !isToken0Eth && (
          <label className="label">
            <span className="label-text-alt flex items-center gap-1">
              Balance: {formatTokenAmount(balance0, token0Decimals)} {token0Symbol}
            </span>
          </label>
        )}
        {isInsufficientBalance0 && (
          <label className="label">
            <span className="label-text-alt text-error">
              Insufficient {token0Symbol} balance
            </span>
          </label>
        )}
      </div>

      {/* 代币1输入 */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Token1 Amount ({token1Symbol || '---'})</span>
          {isToken1Eth && <span className="badge badge-info">ETH</span>}
        </label>
        <div className="join w-full">
          <input
            type="number"
            className={`input input-bordered join-item w-full ${isInsufficientBalance1 ? "input-error" : ""}`}
            value={amount1}
            onChange={handleAmount1Change}
            placeholder="0.0"
            step="any"
          />
          {balance1 !== null && isToken1Eth && (
            <button 
              className="btn join-item"
              onClick={() => {
                // 如果是ETH，保留一些用于gas费
                const reserveAmount = parseTokenAmount("0.01", 18);
                const usableBalance = balance1 > reserveAmount ? balance1 - reserveAmount : BigInt(0);
                setAmount1(formatTokenAmount(usableBalance, 18));
              }}
            >
              Max
            </button>
          )}
        </div>
        {balance1 !== null && isToken1Eth && (
          <label className="label">
            <span className="label-text-alt flex items-center gap-2">
              <span>ETH Balance: {ethBalanceData ? Number(formatEther(ethBalanceData.value)).toFixed(4) : '0.0'} ETH</span>
            </span>
          </label>
        )}
        {balance1 !== null && !isToken1Eth && (
          <label className="label">
            <span className="label-text-alt flex items-center gap-1">
              Balance: {formatTokenAmount(balance1, token1Decimals)} {token1Symbol}
            </span>
          </label>
        )}
        {isInsufficientBalance1 && (
          <label className="label">
            <span className="label-text-alt text-error">
              Insufficient {token1Symbol} balance
            </span>
          </label>
        )}
      </div>

      {/* 滑点设置 */}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Slippage (%)</span>
          <span className="label-text-alt">Recommended: 1.0%</span>
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
      
      {/* 按钮部分 */}
      <div className="space-y-2">
        {/* 代币0授权按钮 */}
        {needsApproval0 && (
          <button 
            className={`btn btn-primary w-full${isApproving0 ? " loading" : ""}`}
            onClick={handleApprove0}
            disabled={isApproving0 || !amount0}
          >
            {isApproving0 ? "Approving..." : `Approve ${token0Symbol || 'Token0'}`}
          </button>
        )}
        
        {/* 代币1授权按钮 */}
        {needsApproval1 && (
          <button 
            className={`btn btn-primary w-full${isApproving1 ? " loading" : ""}`}
            onClick={handleApprove1}
            disabled={isApproving1 || !amount1}
          >
            {isApproving1 ? "Approving..." : `Approve ${token1Symbol || 'Token1'}`}
          </button>
        )}
        
        {/* 添加流动性按钮 */}
        {!needsApproval0 && !needsApproval1 && (
          <button 
            className={`btn btn-primary w-full${isAddingLiquidity ? " loading" : ""}`}
            onClick={handleAddLiquidity}
            disabled={Boolean(
              isAddingLiquidity || 
              !amount0 || 
              !amount1 || 
              isInsufficientBalance0 || 
              isInsufficientBalance1
            )}
          >
            {isAddingLiquidity ? "Adding Liquidity..." : 
             isInsufficientBalance0 ? `Insufficient ${token0Symbol || 'Token0'} Balance` :
             isInsufficientBalance1 ? `Insufficient ${token1Symbol || 'Token1'} Balance` :
             "Add Liquidity"}
          </button>
        )}
      </div>
      
      {/* 交易解释 */}
      <div className="alert alert-info text-sm mt-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <p>After adding liquidity, you will receive LP tokens representing your share in the pool.</p>
          <p className="mt-1">This operation may require two transactions: one for approval and one for adding liquidity.</p>
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
      <div className="collapse collapse-arrow border border-base-300 bg-base-200 mt-4">
        <input type="checkbox" /> 
        <div className="collapse-title text-md font-medium">
          Troubleshooting & Help
        </div>
        <div className="collapse-content text-sm"> 
          <p className="mb-2"><strong>Common reasons for liquidity addition failure:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Insufficient ETH for gas fees</li>
            <li>Slippage too low</li>
            <li>Token approval failed</li>
            <li>Incorrect token contract address</li>
          </ul>
          
          <p className="mt-3 mb-2"><strong>Test token addition process:</strong></p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Deploy test token contract</li>
            <li>Mint tokens using deployment account</li>
            <li>Approve Router contract for token trading</li>
            <li>Add liquidity (sufficient liquidity needed before trading)</li>
          </ol>
        </div>
      </div>

      {/* ETH 包装模态框 */}
      {showWrapEthModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Wrap ETH to WETH</h3>
            <p className="py-4">You need to wrap ETH to WETH before adding liquidity.</p>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Wrap Amount</span>
              </label>
              <div className="join">
                <input
                  type="number"
                  className="input input-bordered join-item w-full"
                  value={wrapAmount}
                  onChange={(e) => setWrapAmount(e.target.value)}
                  placeholder="Enter amount of ETH to wrap"
                  step="any"
                />
                <button 
                  className="btn join-item"
                  onClick={() => {
                    if (balance0 !== null) {
                      const reserveAmount = parseTokenAmount("0.01", 18);
                      const usableBalance = balance0 > reserveAmount ? balance0 - reserveAmount : BigInt(0);
                      setWrapAmount(formatTokenAmount(usableBalance, 18));
                    }
                  }}
                >
                  Max
                </button>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowWrapEthModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleWrapEth}>Confirm Wrap</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowWrapEthModal(false)}></div>
        </div>
      )}
    </div>
  );
};