import { useState, useEffect, useRef } from "react";
import { Chart, ChartConfiguration, TooltipItem } from 'chart.js';
import 'chart.js/auto';
import { type Address } from "viem";
import { useAccount } from "wagmi";
import { useReadContract } from "wagmi";
import { formatTokenAmount } from "~~/utils/uniswap";
import deployedContracts from "~~/contracts/deployedContracts";

// 获取路由合约ABI
const ROUTER_ABI = deployedContracts[11155111].UniswapV2Router02.abi;
const ROUTER_ADDRESS = deployedContracts[11155111].UniswapV2Router02.address as Address;

// 池合约ABI，用于获取储备数据
const POOL_ABI = [
  {
    "inputs": [],
    "name": "getReserves",
    "outputs": [
      {
        "internalType": "uint112",
        "name": "_reserve0",
        "type": "uint112"
      },
      {
        "internalType": "uint112",
        "name": "_reserve1",
        "type": "uint112"
      },
      {
        "internalType": "uint32",
        "name": "_blockTimestampLast",
        "type": "uint32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token0",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token1",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// ERC20代币ABI片段
const ERC20_ABI = [
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// 储备曲线图组件的属性
interface ReservesCurveChartProps {
  poolAddress: Address;
  token0Symbol?: string;
  token1Symbol?: string;
  refreshTrigger?: number; // 用于触发刷新的计数器
}

interface CurvePoint {
  x: number;
  y: number;
  price: number;
}

export const ReservesCurveChart = ({ 
  poolAddress, 
  token0Symbol: initialToken0Symbol, 
  token1Symbol: initialToken1Symbol,
  refreshTrigger = 0
}: ReservesCurveChartProps) => {
  const chartRef = useRef<Chart | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token0Address, setToken0Address] = useState<Address | null>(null);
  const [token1Address, setToken1Address] = useState<Address | null>(null);
  const [token0Decimals, setToken0Decimals] = useState<number>(18);
  const [token1Decimals, setToken1Decimals] = useState<number>(18);
  const [token0Symbol, setToken0Symbol] = useState<string>(initialToken0Symbol || "Token0");
  const [token1Symbol, setToken1Symbol] = useState<string>(initialToken1Symbol || "Token1");
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [forceRedraw, setForceRedraw] = useState(0);
  const [curvePoints, setCurvePoints] = useState<CurvePoint[]>([]);
  const [currentPoint, setCurrentPoint] = useState<CurvePoint>({ x: 0, y: 0, price: 0 });
  const { address: accountAddress } = useAccount();

  // 使用wagmi的useReadContract获取代币地址
  const { data: token0ReadData } = useReadContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "token0",
    query: {
      enabled: !!poolAddress
    }
  });

  const { data: token1ReadData } = useReadContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "token1",
    query: {
      enabled: !!poolAddress
    }
  });

  // 使用useReadContract获取储备数据
  const { data: reservesData, refetch: refetchReserves } = useReadContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "getReserves",
    query: {
      enabled: !!poolAddress
    }
  });

  // 使用useReadContract获取代币0的小数位数
  const { data: token0DecimalsData } = useReadContract({
    address: token0Address as Address,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: {
      enabled: !!token0Address
    }
  });

  // 使用useReadContract获取代币1的小数位数
  const { data: token1DecimalsData } = useReadContract({
    address: token1Address as Address,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: {
      enabled: !!token1Address
    }
  });

  // 如果没有提供初始符号，则获取代币符号
  const { data: token0SymbolData } = useReadContract({
    address: token0Address as Address,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: {
      enabled: !!token0Address && !initialToken0Symbol
    }
  });

  const { data: token1SymbolData } = useReadContract({
    address: token1Address as Address,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: {
      enabled: !!token1Address && !initialToken1Symbol
    }
  });

  // 设置代币地址
  useEffect(() => {
    if (token0ReadData) {
      setToken0Address(token0ReadData as Address);
    }
    if (token1ReadData) {
      setToken1Address(token1ReadData as Address);
    }
  }, [token0ReadData, token1ReadData]);

  // 设置代币小数位数
  useEffect(() => {
    if (token0DecimalsData !== undefined) {
      setToken0Decimals(token0DecimalsData);
    }
    if (token1DecimalsData !== undefined) {
      setToken1Decimals(token1DecimalsData);
    }
  }, [token0DecimalsData, token1DecimalsData]);

  // 设置代币符号（如果没有提供初始符号）
  useEffect(() => {
    if (!initialToken0Symbol && token0SymbolData) {
      setToken0Symbol(token0SymbolData);
    }
    if (!initialToken1Symbol && token1SymbolData) {
      setToken1Symbol(token1SymbolData);
    }
  }, [token0SymbolData, token1SymbolData, initialToken0Symbol, initialToken1Symbol]);

  // 刷新储备数据
  useEffect(() => {
    console.log("刷新触发器更新:", refreshTrigger);
    refetchReserves();
  }, [refreshTrigger, refetchReserves]);

  // 强制重绘图表的函数
  const handleForceRedraw = () => {
    // 先销毁图表
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    
    // 刷新数据
    refetchReserves();
    
    // 触发重绘
    setForceRedraw(prev => prev + 1);
  };

  // 处理储备数据并计算当前价格
  useEffect(() => {
    if (reservesData) {
      setIsLoading(true);
      
      try {
        const [reserve0, reserve1] = reservesData;
        
        console.log("Retrieved reserve data:", {
          reserve0: reserve0.toString(),
          reserve1: reserve1.toString()
        });
        
        // 计算当前价格 (price = reserve1 / reserve0)
        const reserve0Adjusted = Number(reserve0) / 10 ** token0Decimals;
        const reserve1Adjusted = Number(reserve1) / 10 ** token1Decimals;
        const price = reserve1Adjusted / reserve0Adjusted;
        
        console.log("Calculated price:", {
          reserve0Adjusted,
          reserve1Adjusted,
          price
        });
        
        setCurrentPrice(price);
        setCurrentPoint({
          x: reserve0Adjusted,
          y: reserve1Adjusted,
          price: price
        });
        setError(null);
      } catch (err) {
        console.error('Failed to process reserve data:', err);
        setError(err instanceof Error ? err.message : 'Failed to process reserve data');
      } finally {
        setIsLoading(false);
      }
    }
  }, [reservesData, token0Decimals, token1Decimals]);

// 绘制储备曲线
  useEffect(() => {
    if (!canvasRef.current || !reservesData || currentPrice === 0) return;

    console.log("Starting chart drawing", {
      reserve0: reservesData[0].toString(),
      reserve1: reservesData[1].toString(),
      currentPrice,
      token0Decimals,
      token1Decimals
    });

    // 清除之前的图表
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) {
      setError('Failed to initialize chart context');
      return;
    }

    try {
      const [reserve0, reserve1] = reservesData;
      
      // 计算储备的实际值
      const reserve0Adjusted = Number(reserve0) / 10 ** token0Decimals;
      const reserve1Adjusted = Number(reserve1) / 10 ** token1Decimals;
      
      // 计算恒定乘积 k
      const k = reserve0Adjusted * reserve1Adjusted;
      console.log("Calculated k value:", k);
      
      // 设置适合当前储备范围的坐标轴范围
      // 生成范围从当前储备的0.5倍到2倍
      const xMin = Math.max(0, reserve0Adjusted * 0.5);
      const xMax = reserve0Adjusted * 2;
      const yMin = Math.max(0, reserve1Adjusted * 0.5);
      const yMax = reserve1Adjusted * 2;
      
      console.log("Chart range:", { xMin, xMax, yMin, yMax });
      
      // 生成曲线数据点
      const numPoints = 100; // 曲线上的点数
      const xStep = (xMax - xMin) / numPoints;
      
      const newCurvePoints: CurvePoint[] = [];
      
      for (let i = 0; i <= numPoints; i++) {
        const x = xMin + i * xStep;
        // 由于 x * y = k, 所以 y = k / x
        const y = x > 0 ? k / x : 0; // 避免除以零
        const pointPrice = x > 0 ? y / x : 0;
        
        newCurvePoints.push({
          x,
          y,
          price: pointPrice
        });
      }
      
      // 使用临时变量存储，避免在依赖数组中引用状态变量
      const pointsForChart = newCurvePoints;
      const currentPointForChart = {
        x: reserve0Adjusted,
        y: reserve1Adjusted,
        price: currentPrice
      };
      
      // 更新状态，但不在依赖数组中引用
      setCurvePoints(newCurvePoints);
      
      console.log("Generated curve point count:", newCurvePoints.length);
      console.log("Current point:", currentPointForChart);

      // 创建图表配置
      const chartConfig: ChartConfiguration = {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Reserve Curve',
              data: pointsForChart.map(p => ({ x: p.x, y: p.y })),
              backgroundColor: 'rgba(75, 192, 192, 0.1)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1,
              pointRadius: 0,
              showLine: true,
              fill: false
            },
            {
              label: 'Current Position',
              data: [{ x: currentPointForChart.x, y: currentPointForChart.y }],
              backgroundColor: 'rgba(255, 99, 132, 1)',
              pointRadius: 5,
              pointHoverRadius: 7
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'linear' as const,
              display: true,
              min: xMin,
              max: xMax,
              title: {
                display: true,
                text: `${token0Symbol} Reserves`
              },
              ticks: {
                callback: function(tickValue: string | number): string {
                  const value = typeof tickValue === 'string' 
                    ? parseFloat(tickValue) 
                    : tickValue;
                  return value.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                  });
                }
              }
            },
            y: {
              type: 'linear' as const,
              display: true,
              min: yMin,
              max: yMax,
              title: {
                display: true,
                text: `${token1Symbol} Reserves`
              },
              ticks: {
                callback: function(tickValue: string | number): string {
                  const value = typeof tickValue === 'string' 
                    ? parseFloat(tickValue) 
                    : tickValue;
                  return value.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                  });
                }
              }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context: TooltipItem<"scatter">): string[] {
                  const index = context.dataIndex;
                  const datasetIndex = context.datasetIndex;
                  
                  if (datasetIndex === 0) { // Reserve curve
                    const point = pointsForChart[index];
                    return [
                      `${token0Symbol}: ${point.x.toLocaleString(undefined, {maximumFractionDigits: 2})}`,
                      `${token1Symbol}: ${point.y.toLocaleString(undefined, {maximumFractionDigits: 2})}`,
                      `Price: ${point.price.toLocaleString(undefined, {maximumFractionDigits: 6})}`
                    ];
                  } else { // Current position
                    return [
                      `${token0Symbol}: ${currentPointForChart.x.toLocaleString(undefined, {maximumFractionDigits: 2})}`,
                      `${token1Symbol}: ${currentPointForChart.y.toLocaleString(undefined, {maximumFractionDigits: 2})}`,
                      `Current Price: ${currentPointForChart.price.toLocaleString(undefined, {maximumFractionDigits: 6})}`
                    ];
                  }
                }
              }
            }
          }
        },
      };
    
      // 创建图表
      chartRef.current = new Chart(ctx, chartConfig);
      console.log("Chart created successfully");
    } catch (err) {
      console.error('Chart initialization failed:', err);
      setError('Chart initialization failed');
    }
    
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  // 从依赖数组中移除 curvePoints 和 currentPoint
  }, [reservesData, currentPrice, token0Symbol, token1Symbol, token0Decimals, token1Decimals, forceRedraw]);
    
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Reserve Curve</h2>
        <div className="flex items-center gap-2">
            {currentPrice > 0 && (
            <div className="text-sm" key={`price-${currentPrice}`}>
              Current Price: 1 {token0Symbol} = {currentPrice.toFixed(6)} {token1Symbol}
            </div>
          )}
          <button 
            className="btn btn-sm btn-outline" 
            onClick={handleForceRedraw}
          >
            Refresh Chart
          </button>
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