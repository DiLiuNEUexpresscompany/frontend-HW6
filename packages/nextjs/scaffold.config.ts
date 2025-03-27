import * as chains from "viem/chains";
import { defineChain } from "viem";

export type ScaffoldConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  onlyLocalBurnerWallet: boolean;
};

export const DEFAULT_ALCHEMY_API_KEY = "oKxs-03sij-U_N0iOlrSsZFr29-IqbuF";

// 定义 Tenderly 虚拟 Sepolia 测试网
export const tenderlyVirtualSepolia = defineChain({
  ...chains.sepolia,
  id: chains.sepolia.id,
  name: 'Tenderly Virtual Sepolia',
  rpcUrls: {
    default: {
      http: ['https://virtual.sepolia.rpc.tenderly.co/a6122906-66f1-4c1a-b4e7-92fecdcd0e25'],
    },
    public: {
      http: ['https://virtual.sepolia.rpc.tenderly.co/a6122906-66f1-4c1a-b4e7-92fecdcd0e25'],
    },
  },
});

const scaffoldConfig = {
  // 将 targetNetworks 改为包含 Tenderly 虚拟测试网
  targetNetworks: [tenderlyVirtualSepolia],

  // 减少轮询间隔以便更快看到更新（对于测试环境）
  pollingInterval: 5000,

  // 保持 Alchemy API Key 不变
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,

  // 更新 rpcOverrides 使用我们的 Tenderly RPC URL
  rpcOverrides: {
    // 确保使用与 tenderlyVirtualSepolia 相同的 id
    [chains.sepolia.id]: "https://virtual.sepolia.rpc.tenderly.co/a6122906-66f1-4c1a-b4e7-92fecdcd0e25",
  },

  // 保持 WalletConnect 项目 ID 不变
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",

  // 由于我们连接的是测试网而不是本地网络，可以将此设为 false
  onlyLocalBurnerWallet: false,
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;