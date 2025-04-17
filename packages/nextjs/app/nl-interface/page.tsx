"use client";

import { NLProcessor } from "~~/components/uniswap/NLProcessor";

export default function NLInterfacePage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Uniswap Natural Language Interface
      </h1>
      
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">How to use</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Swap tokens: "swap 10 USDC for ETH"</li>
            <li>Add liquidity: "deposit 5 Tether and 3 wbtc"</li>
            <li>Query pool info: "what are the reserves of the tether-eth pool"</li>
          </ul>
        </div>

        <NLProcessor />
      </div>
    </div>
  );
} 