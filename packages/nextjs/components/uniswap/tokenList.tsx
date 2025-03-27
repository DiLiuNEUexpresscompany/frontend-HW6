// src/constants/tokenList.ts
import { type Address } from "viem";

// 定义代币接口
export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

// 常用代币的映射
export const COMMON_TOKENS: { [key: string]: TokenInfo } = {
  // ETH 特殊处理
  ETH: {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // ETH 占位符地址
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://cryptologos.cc/logos/ethereum-eth-logo.png"
  },
  // 包装后的 ETH
  WETH: {
    address: "0x764ac516ec320a310375e69f59180355c69e313f", 
    symbol: "WETH",
    name: "Wrapped Ethereum",
    decimals: 18,
    logoURI: "https://images.seeklogo.com/logo-png/45/1/wrapped-ether-weth-logo-png_seeklogo-453292.png"
  },
  // 其他常见代币
  testUSDC: {
    address: "0x8682d6f065e716d4c78b7bb5701e6e5859d050c5",
    symbol: "testUSDC",
    name: "testUSDC Coin",
    decimals: 6,
    logoURI: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png"
  },
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoURI: "https://cryptologos.cc/logos/tether-usdt-logo.png"
  },
  DAI: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    logoURI: "https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png"
  },
  // 可以添加更多代币...
};

// 通过地址查找代币信息的映射
export const TOKEN_ADDRESS_MAP: { [address: string]: TokenInfo } = 
  Object.values(COMMON_TOKENS).reduce((map, token) => {
    map[token.address.toLowerCase()] = token;
    return map;
  }, {} as { [address: string]: TokenInfo });

// 添加自定义代币到映射
export function addCustomToken(token: TokenInfo): void {
  // 添加到映射
  TOKEN_ADDRESS_MAP[token.address.toLowerCase()] = token;
}

// 根据地址获取代币信息
export function getTokenInfo(address: Address): TokenInfo | undefined {
  return TOKEN_ADDRESS_MAP[address.toLowerCase()];
}

// 根据地址获取代币符号
export function getTokenSymbol(address: Address): string {
  const token = getTokenInfo(address);
  return token ? token.symbol : address.substring(0, 6) + '...' + address.substring(address.length - 4);
}

// 判断是否为 ETH 地址
export function isETH(address: Address): boolean {
  return address.toLowerCase() === COMMON_TOKENS.ETH.address.toLowerCase();
}

// 获取所有支持的代币列表
export function getAllTokens(): TokenInfo[] {
  return Object.values(TOKEN_ADDRESS_MAP);
}