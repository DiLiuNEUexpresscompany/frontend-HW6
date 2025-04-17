"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

interface NLInputProps {
  onCommandSubmit: (command: string) => void;
}

export const NLInput = ({ onCommandSubmit }: NLInputProps) => {
  const [command, setCommand] = useState("");
  const { address } = useAccount();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      onCommandSubmit(command.trim());
      setCommand("");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="nl-command" className="text-lg font-semibold">
            Enter your command
          </label>
          <div className="flex gap-2">
            <input
              id="nl-command"
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g., 'swap 10 USDC for ETH' or 'what are the reserves of the tether-eth pool'"
              className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!address}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            >
              Execute
            </button>
          </div>
          {!address && (
            <p className="text-red-500 text-sm">Please connect your wallet first</p>
          )}
        </div>
      </form>
    </div>
  );
}; 