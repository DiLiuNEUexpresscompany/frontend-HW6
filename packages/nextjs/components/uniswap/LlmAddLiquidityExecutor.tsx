"use client";

import { useEffect, useState } from "react";
import { Address, Hash } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";

import deployedContracts from "~~/contracts/deployedContracts";
import { parseTokenAmount } from "~~/utils/uniswap";
import { notification } from "~~/utils/scaffold-eth";
import { COMMON_TOKENS, isETH } from "./tokenList";

const ROUTER_ABI = deployedContracts[11155111].UniswapV2Router02.abi;

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

interface LlmAddLiquidityProps {
  poolAddress: Address;
  params: {
    amountA?: string | number;
    amountB?: string | number;
    tokenA?: string;
    tokenB?: string;
    slippage?: string | number; // percentage, e.g. "0.5" or "100%"
  };
  autoExecute?: boolean;
  onDone?: () => void;
}

export default function LlmAddLiquidityExecutor({
  poolAddress,
  params,
  autoExecute = true,
  onDone,
}: LlmAddLiquidityProps) {
  const publicClient = usePublicClient();
  const { address: user } = useAccount();

  const routerAddress = deployedContracts[11155111].UniswapV2Router02.address as Address;
  const wethAddress = COMMON_TOKENS.WETH.address as Address;

  const [executed, setExecuted] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [inFlight, setInFlight] = useState(false);

  const resolveTokenAddress = (symbolOrAddress?: string): Address => {
    if (!symbolOrAddress) return wethAddress;
    if (symbolOrAddress.startsWith("0x")) return symbolOrAddress as Address;
    const entry = Object.values(COMMON_TOKENS).find(
      t => t.symbol.toUpperCase() === symbolOrAddress.toUpperCase(),
    );
    return (entry?.address ?? wethAddress) as Address;
  };

  const tokenAAddr = resolveTokenAddress(params.tokenA);
  const tokenBAddr = resolveTokenAddress(params.tokenB);
  const isTokenAEth = isETH(tokenAAddr);
  const isTokenBEth = isETH(tokenBAddr);

  // 解析滑点值
  const slipPct = typeof params.slippage === 'string' 
    ? parseFloat(params.slippage.replace('%', '')) 
    : Number(params.slippage) || 0.5;

  const { data: allowanceA } = useReadContract({
    address: isTokenAEth ? undefined : tokenAAddr,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: user && !isTokenAEth ? [user, routerAddress] : undefined,
    query: { enabled: !!user && !isTokenAEth },
  });
  const { data: allowanceB } = useReadContract({
    address: isTokenBEth ? undefined : tokenBAddr,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: user && !isTokenBEth ? [user, routerAddress] : undefined,
    query: { enabled: !!user && !isTokenBEth },
  });

  const { writeContractAsync } = useWriteContract();

  const run = async () => {
    if (!user || executed || inFlight || !publicClient) return;
    setAttempted(true);
    setInFlight(true);

    try {
      const amtABig = parseTokenAmount(String(params.amountA ?? 0), 18);
      const amtBBig = parseTokenAmount(String(params.amountB ?? 0), 18);

      // parse slippage value, support strings like "1.5%" or numbers
      let slipPct = 0.5;
      if (typeof params.slippage === 'string') {
        const match = params.slippage.match(/([\d.]+)/);
        slipPct = match ? Number(match[1]) : slipPct;
      } else if (typeof params.slippage === 'number') {
        slipPct = params.slippage;
      }
      slipPct = Math.max(0, Math.min(100, slipPct));
      const SLIPPAGE_BPS = BigInt(Math.round(slipPct * 100)); // e.g. 1% → 100 bps

      const calcMin = (amt: bigint) =>
        SLIPPAGE_BPS === 10000n ? 0n : (amt * (10000n - SLIPPAGE_BPS)) / 10000n;

      const minA = calcMin(amtABig);
      const minB = calcMin(amtBBig);

      const approveIfNeeded = async (token: Address, need: boolean) => {
        if (!need) return;
        const hash = await writeContractAsync({
          address: token,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [routerAddress, BigInt(2) ** BigInt(255)],
        });
        await publicClient.waitForTransactionReceipt({ hash: hash as Hash, confirmations: 1 });
      };

      await approveIfNeeded(tokenAAddr, !isTokenAEth && (!allowanceA || allowanceA < amtABig));
      await approveIfNeeded(tokenBAddr, !isTokenBEth && (!allowanceB || allowanceB < amtBBig));

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
      let txHash: Hash;

      if (isTokenAEth || isTokenBEth) {
        const tokenAddr = isTokenAEth ? tokenBAddr : tokenAAddr;
        const tokenAmt = isTokenAEth ? amtBBig : amtABig;
        const ethAmt = isTokenAEth ? amtABig : amtBBig;
        const tokenMin = isTokenAEth ? minB : minA;
        const ethMin = isTokenAEth ? minA : minB;

        txHash = await writeContractAsync({
          address: routerAddress,
          abi: ROUTER_ABI,
          functionName: "addLiquidityETH",
          args: [tokenAddr, tokenAmt, tokenMin, ethMin, user, deadline],
          value: ethAmt,
        }) as Hash;
      } else {
        txHash = await writeContractAsync({
          address: routerAddress,
          abi: ROUTER_ABI,
          functionName: "addLiquidity",
          args: [tokenAAddr, tokenBAddr, amtABig, amtBBig, minA, minB, user, deadline],
        }) as Hash;
      }

      await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });

      notification.success("Liquidity added ✔️");
      setExecuted(true);
      onDone?.();
    } catch (err: any) {
      if (err?.code === 4001) {
        notification.error("Transaction rejected — auto‑execute paused");
        setInFlight(false);
        return;
      }
      console.error(err);
      notification.error("Add‑liquidity failed");
    } finally {
      setInFlight(false);
    }
  };

  useEffect(() => {
    if (autoExecute && !executed && !inFlight && !attempted) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowanceA, allowanceB]);

  if (executed) return <div className="alert alert-success">Liquidity added successfully</div>;

  return (
    <div className="p-4 bg-base-200 rounded-lg space-y-2">
      <h3 className="text-lg font-semibold">LLM Liquidity Executor</h3>
      <p>Pair: <code>{poolAddress}</code></p>
      <p>TokenA: {params.tokenA ?? "-"} — Amount: {params.amountA ?? 0}</p>
      <p>TokenB: {params.tokenB ?? "-"} — Amount: {params.amountB ?? 0}</p>
      <p>Slippage: {slipPct}%</p>
      {!autoExecute && (
        <button className="btn btn-primary" onClick={run} disabled={inFlight || executed}>
          {inFlight ? "Pending…" : "Execute"}
        </button>
      )}
    </div>
  );
}
