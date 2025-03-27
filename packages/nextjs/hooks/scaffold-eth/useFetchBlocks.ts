import { useCallback, useEffect, useState } from "react";
import {
  Block,
  Hash,
  Transaction,
  TransactionReceipt,
  createPublicClient,
  http,
  publicActions,
  walletActions,
} from "viem";
import { sepolia } from "viem/chains";
import { decodeTransactionData } from "~~/utils/scaffold-eth";

const BLOCKS_PER_PAGE = 20;

// 使用 createPublicClient 连接到 Tenderly 的虚拟 Sepolia 测试网
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://virtual.sepolia.rpc.tenderly.co/a6122906-66f1-4c1a-b4e7-92fecdcd0e25'),
}).extend(publicActions).extend(walletActions);

export const useFetchBlocks = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [transactionReceipts, setTransactionReceipts] = useState<{
    [key: string]: TransactionReceipt;
  }>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [totalBlocks, setTotalBlocks] = useState(0n);
  const [error, setError] = useState<Error | null>(null);

  const fetchBlocks = useCallback(async () => {
    setError(null);

    try {
      const blockNumber = await publicClient.getBlockNumber();
      setTotalBlocks(blockNumber);

      const startingBlock = blockNumber - BigInt(currentPage * BLOCKS_PER_PAGE);
      const blockNumbersToFetch = Array.from(
        { length: Number(BLOCKS_PER_PAGE < startingBlock + 1n ? BLOCKS_PER_PAGE : startingBlock + 1n) },
        (_, i) => startingBlock - BigInt(i),
      );

      const blocksWithTransactions = blockNumbersToFetch.map(async blockNumber => {
        try {
          return publicClient.getBlock({ blockNumber, includeTransactions: true });
        } catch (err) {
          setError(err instanceof Error ? err : new Error("An error occurred."));
          throw err;
        }
      });
      const fetchedBlocks = await Promise.all(blocksWithTransactions);

      fetchedBlocks.forEach(block => {
        block.transactions.forEach(tx => decodeTransactionData(tx as Transaction));
      });

      const txReceipts = await Promise.all(
        fetchedBlocks.flatMap(block =>
          block.transactions.map(async tx => {
            try {
              const receipt = await publicClient.getTransactionReceipt({ hash: (tx as Transaction).hash });
              return { [(tx as Transaction).hash]: receipt };
            } catch (err) {
              setError(err instanceof Error ? err : new Error("An error occurred."));
              throw err;
            }
          }),
        ),
      );

      setBlocks(fetchedBlocks);
      setTransactionReceipts(prevReceipts => ({ ...prevReceipts, ...Object.assign({}, ...txReceipts) }));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("An error occurred."));
    }
  }, [currentPage]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  // 替换 watchBlocks 方法，使用轮询方式获取新区块
  useEffect(() => {
    if (currentPage !== 0) return;

    let lastKnownBlock: bigint | undefined;
    const pollInterval = setInterval(async () => {
      try {
        const latestBlockNumber = await publicClient.getBlockNumber();
        
        if (!lastKnownBlock || latestBlockNumber > lastKnownBlock) {
          // 有新区块
          const newBlock = await publicClient.getBlock({ 
            blockNumber: latestBlockNumber, 
            includeTransactions: true 
          });
          
          // 处理新区块数据
          if (newBlock.transactions.length > 0) {
            newBlock.transactions.forEach((tx: Transaction) => decodeTransactionData(tx as Transaction));
            
            const receipts = await Promise.all(
              newBlock.transactions.map(async (tx: Transaction) => {
                try {
                  const receipt = await publicClient.getTransactionReceipt({ hash: (tx as Transaction).hash });
                  return { [(tx as Transaction).hash]: receipt };
                } catch (err) {
                  setError(err instanceof Error ? err : new Error("An error occurred fetching receipt."));
                  throw err;
                }
              }),
            );
            
            setTransactionReceipts(prevReceipts => ({ ...prevReceipts, ...Object.assign({}, ...receipts) }));
          }
          
          setBlocks(prevBlocks => [newBlock, ...prevBlocks.slice(0, BLOCKS_PER_PAGE - 1)]);
          setTotalBlocks(latestBlockNumber);
          lastKnownBlock = latestBlockNumber;
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("An error occurred during polling."));
      }
    }, 5000); // 每5秒轮询一次

    return () => clearInterval(pollInterval);
  }, [currentPage]);

  return {
    blocks,
    transactionReceipts,
    currentPage,
    totalBlocks,
    setCurrentPage,
    error,
  };
};