import { formatUnits, parseUnits } from "viem";

/**
 * 计算考虑滑点的最小输出金额
 * @param amountIn 输入金额
 * @param slippage 滑点百分比 (例如: 0.5 表示 0.5%)
 * @returns 最小输出金额
 */
export const calculateAmountOutMin = (amountIn: bigint, slippage: number): bigint => {
  // 将滑点百分比转换为小数
  const slippageDecimal = slippage / 100;
  
  // 计算考虑滑点的最小输出金额
  // 例如：如果滑点是 0.5%，那么最小输出金额应该是预期输出金额的 99.5%
  const slippageMultiplier = BigInt(Math.floor((1 - slippageDecimal) * 10000)) / 10000n;
  
  // 返回最小输出金额
  return (amountIn * slippageMultiplier) / 10000n;
};

/**
 * 格式化代币金额为可读字符串
 * @param amount 代币金额（wei）
 * @param decimals 代币精度
 * @param displayDecimals 显示的小数位数
 * @returns 格式化后的金额字符串
 */
export const formatTokenAmount = (amount: bigint, decimals: number, displayDecimals: number = 6): string => {
  return Number(formatUnits(amount, decimals)).toFixed(displayDecimals);
};

/**
 * 将用户输入的金额转换为代币金额（wei）
 * @param amount 用户输入的金额字符串
 * @param decimals 代币精度
 * @returns 代币金额（wei）
 */
export const parseTokenAmount = (amount: string, decimals: number): bigint => {
  try {
    return parseUnits(amount, decimals);
  } catch (error) {
    console.error("解析代币金额失败:", error);
    return 0n;
  }
};

/**
 * 计算价格影响
 * @param amountIn 输入金额
 * @param amountOut 输出金额
 * @returns 价格影响百分比
 */
export const calculatePriceImpact = (amountIn: bigint, amountOut: bigint): number => {
  if (amountIn === 0n) return 0;
  return Math.abs(Number(amountOut - amountIn) / Number(amountIn) * 100);
}; 
