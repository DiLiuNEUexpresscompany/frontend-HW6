import { useEffect, useRef, useState } from "react";
import { Chart } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { type Address } from "viem";
import { usePublicClient } from "wagmi";

interface PriceHistoryChartProps {
  poolAddress: Address;
}

interface SwapEvent {
  args: {
    amount0In: bigint;
    amount1In: bigint;
    amount0Out: bigint;
    amount1Out: bigint;
  };
  blockNumber: bigint;
  transactionHash: string;
  timestamp: number;
}

interface PriceDataPoint {
  timestamp: number;
  price: number;
}

const calculateExecutionPrice = (args: SwapEvent["args"]): number | null => {
  const { amount0In, amount1In, amount0Out, amount1Out } = args;
  
  try {
    // Token0 -> Token1 swap
    if (amount0In > 0n && amount1Out > 0n) {
      return Number(amount1Out) / Number(amount0In);
    }
    // Token1 -> Token0 swap
    else if (amount1In > 0n && amount0Out > 0n) {
      return Number(amount1In) / Number(amount0Out);
    }
    return null;
  } catch (error) {
    console.error('Error calculating price:', error);
    return null;
  }
};

const timeRanges = [
  { label: "24小时", value: 24 * 60 * 60 },
  { label: "7天", value: 7 * 24 * 60 * 60 },
  { label: "30天", value: 30 * 24 * 60 * 60 },
] as const;

const SWAP_EVENT_ABI = {
  type: "event",
  name: "Swap",
  inputs: [
    { type: "address", name: "sender", indexed: true },
    { type: "uint256", name: "amount0In", indexed: false },
    { type: "uint256", name: "amount1In", indexed: false },
    { type: "uint256", name: "amount0Out", indexed: false },
    { type: "uint256", name: "amount1Out", indexed: false },
    { type: "address", name: "to", indexed: true }
  ]
} as const;
  
export const PriceHistoryChart = ({ poolAddress }: PriceHistoryChartProps) => {
  const chartRef = useRef<Chart | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRanges[0].value);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<SwapEvent[]>([]);
  const publicClient = usePublicClient();

  useEffect(() => {
    const fetchEvents = async () => {
      if (!publicClient || !poolAddress) {
        setError('Missing required dependencies');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);

        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - BigInt(Math.floor(selectedTimeRange / 12));
        
        const logs = await publicClient.getLogs({
          address: poolAddress,
          event: SWAP_EVENT_ABI,
          fromBlock: fromBlock > 0n ? fromBlock : 0n,
          toBlock: currentBlock
        });

        // Process logs in batches to avoid overloading
        const batchSize = 10;
        const validEvents: SwapEvent[] = [];
        
        for (let i = 0; i < logs.length; i += batchSize) {
          const batch = logs.slice(i, i + batchSize);
          const blocks = await Promise.all(
            batch.map(log => publicClient.getBlock({ blockNumber: log.blockNumber }))
          );

          batch.forEach((log, index) => {
            if (log.args.amount0In !== undefined && 
                log.args.amount1In !== undefined && 
                log.args.amount0Out !== undefined && 
                log.args.amount1Out !== undefined) {
              validEvents.push({
                args: {
                  amount0In: log.args.amount0In,
                  amount1In: log.args.amount1In,
                  amount0Out: log.args.amount0Out,
                  amount1Out: log.args.amount1Out
                },
                blockNumber: log.blockNumber,
                timestamp: Number(blocks[index].timestamp),
                transactionHash: log.transactionHash
              });
            }
          });
        }

        setEvents(validEvents);
      } catch (err) {
        console.error('Failed to fetch events:', err);
        setError(err instanceof Error ? err.message : '获取历史数据失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [publicClient, poolAddress, selectedTimeRange]);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    if (!events.length) {
      setError(prev => prev || '没有可用的交易数据');
      return;
    }

    const prices: PriceDataPoint[] = events
      .map(event => {
        const price = calculateExecutionPrice(event.args);
        return price !== null ? {
          timestamp: event.timestamp * 1000,
          price
        } : null;
      })
      .filter((price): price is PriceDataPoint => price !== null)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (prices.length === 0) {
      setError('没有有效的价格数据');
      return;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) {
      setError('无法初始化图表上下文');
      return;
    }

    try {
      const data = {
        datasets: [{
          label: "交易价格",
          data: prices.map(p => ({
            x: p.timestamp,
            y: p.price
          })),
          borderColor: "rgb(75, 192, 192)",
          fill: true
        }]
      };

      const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "nearest",
          intersect: false,
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit: selectedTimeRange <= 24 * 60 * 60 ? "hour" : "day",
              displayFormats: {
                hour: "MM-dd HH:mm",
                day: "MM-dd"
              }
            },
            title: {
              display: true,
              text: "时间"
            }
          },
          y: {
            title: {
              display: true,
              text: "价格"
            },
            ticks: {
              callback: function(value: number): string {
                return value.toFixed(6);
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: any): string => {
                const value = context.parsed.y;
                return `价格: ${value.toFixed(6)}`;
              }
            }
          },
          legend: {
            display: false
          }
        }
      };

      chartRef.current = new Chart(ctx, {
        type: "line",
        data,
      });
    } catch (err) {
      console.error('Chart initialization error:', err);
      setError('图表初始化失败');
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [events, selectedTimeRange]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">历史交易价格</h2>
        <div className="join">
          {timeRanges.map(range => (
            <button
              key={range.value}
              className={`join-item btn btn-sm ${selectedTimeRange === range.value ? "btn-primary" : ""}`}
              onClick={() => setSelectedTimeRange(range.value)}
              disabled={isLoading}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="relative h-[400px]">
        {isLoading ? (
          <div className="absolute inset-0 flex justify-center items-center bg-base-100/50">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex justify-center items-center bg-base-100/50">
            <div className="text-error flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        ) : null}
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};