import { useState, useEffect, useRef } from "react";
import { type Address, TransactionReceipt } from "viem";
import { useDeployedContractInfo, useScaffoldContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { AddressInput } from "~~/components/scaffold-eth";
import { COMMON_TOKENS, getTokenInfo, getTokenSymbol, isETH } from "~~/components/uniswap/tokenList";

interface PoolSelectorProps {
  factoryAddress: Address;
  onPoolSelect: (poolAddress: Address) => void;
}

// 已知交易对信息接口
interface PairInfo {
  address: Address;
  token0Address?: Address;
  token1Address?: Address;
  token0Symbol?: string;
  token1Symbol?: string;
}

// ETH address constant - this is the zero address commonly used to represent ETH in Uniswap
const ETH_ADDRESS = COMMON_TOKENS.ETH.address;
const WETH_ADDRESS = COMMON_TOKENS.WETH.address;

export const PoolSelector = ({ factoryAddress, onPoolSelect }: PoolSelectorProps) => {
  const [error, setError] = useState<string | null>(null);
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [token0Address, setToken0Address] = useState<Address>();
  const [token1Address, setToken1Address] = useState<Address>();
  const [useEth, setUseEth] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fetchAttemptedRef = useRef(false);
  
  const { data: factoryContract } = useScaffoldContract({
    contractName: "UniswapV2Factory"
  });

  const { writeContractAsync: createPair, isPending: isCreating } = useScaffoldWriteContract({
    contractName: "UniswapV2Factory",
  });

  const handleCreatePair = async () => {
    if (!token0Address || !token1Address) {
      setError("请输入两个代币地址");
      return;
    }
    
    if (token0Address === token1Address) {
      setError("两个代币地址不能相同");
      return;
    }

    try {
      setError(null);
      
      // If ETH is selected, replace with WETH address for creating the pair
      const actualToken0 = isETH(token0Address) ? WETH_ADDRESS : token0Address;
      const actualToken1 = isETH(token1Address) ? WETH_ADDRESS : token1Address;
      
      await createPair({
        functionName: "createPair",
        args: [actualToken0, actualToken1],
      }, {
        onBlockConfirmation: (txnReceipt) => {
          console.log("📦 Transaction blockHash", txnReceipt.blockHash);
          fetchAttemptedRef.current = false; // 重置获取标志，允许重新获取交易对列表
          fetchPairs(); // 创建成功后重新获取交易对
        },
      });
    } catch (err) {
      console.error("创建交易对失败:", err);
      setError("创建交易对失败，请检查代币地址是否正确");
    }
  };

  const fetchPairs = async () => {
    if (!factoryContract) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const allPairsLength = await factoryContract.read.allPairsLength();
      
      if (Number(allPairsLength) === 0) {
        setPairs([]);
        return;
      }

      const pairPromises = [];
      for (let i = 0; i < Number(allPairsLength); i++) {
        pairPromises.push(factoryContract.read.allPairs([BigInt(i)]));
      }
      
      const pairAddresses = await Promise.all(pairPromises);
      
      // 转换成带有代币信息的对象数组
      const pairsWithSymbols = pairAddresses
        .filter(Boolean)
        .map((address) => {
          return {
            address,
            // 注意：这里应该从交易对合约获取实际的token0和token1
            // 为了演示，我们暂时不填充这些字段
          };
        });
      
      setPairs(pairsWithSymbols);
      
    } catch (err) {
      console.error("获取交易对失败:", err);
      setError("获取交易对列表失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (factoryContract && !fetchAttemptedRef.current) {
      fetchAttemptedRef.current = true;
      fetchPairs();
    }
  }, [factoryContract]);

  const toggleEth = () => {
    if (useEth) {
      // If turning off ETH, clear the address if it was set to ETH
      if (isETH(token0Address as Address)) setToken0Address(undefined);
    } else {
      // If turning on ETH, set token0 to ETH
      setToken0Address(ETH_ADDRESS);
    }
    setUseEth(!useEth);
  };

  // 渲染代币选择输入框
  const renderTokenInput = (
    value: Address | undefined, 
    onChange: (address: Address) => void, 
    label: string, 
    isEthFixed = false
  ) => {
    // 如果固定为ETH
    if (isEthFixed) {
      const ethInfo = getTokenInfo(ETH_ADDRESS);
      return (
        <div className="form-control">
          <label className="label">
            <span className="label-text">{label}</span>
          </label>
          <div className="input input-bordered flex items-center px-3 py-2">
            {ethInfo?.logoURI && (
              <img src={ethInfo.logoURI} alt="ETH" className="w-6 h-6 mr-2" />
            )}
            <span>ETH</span>
          </div>
        </div>
      );
    }
    
    // 如果已有地址且在代币列表中，显示代币信息
    const tokenInfo = value ? getTokenInfo(value) : undefined;
    
    return (
      <div className="form-control">
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
        
        {/* 代币地址输入 */}
        <div className="relative">
          <AddressInput
            value={value || ""}
            onChange={onChange}
            placeholder={`输入${label}的合约地址`}
          />
          
          {/* 如果有代币信息，显示代币符号 */}
          {tokenInfo && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center bg-base-300 px-2 py-1 rounded">
              {tokenInfo.logoURI && (
                <img src={tokenInfo.logoURI} alt={tokenInfo.symbol} className="w-5 h-5 mr-1" />
              )}
              <span>{tokenInfo.symbol}</span>
            </div>
          )}
        </div>
        
        {/* 常用代币快速选择 */}
        <div className="flex flex-wrap gap-1 mt-2">
          {Object.values(COMMON_TOKENS)
            // 如果当前标签是"代币1"且useEth=true，或者是已经选中的代币，不显示
            .filter(token => 
              !((label === "代币1" && useEth && token.symbol === "ETH") || 
                (value && token.address.toLowerCase() === value.toLowerCase()))
            )
            .map(token => (
              <button
                key={token.address}
                className="btn btn-xs btn-outline"
                onClick={() => onChange(token.address)}
              >
                {token.symbol}
              </button>
            ))
          }
        </div>
      </div>
    );
  };

  const renderCreatePairInterface = () => (
    <div className="space-y-4 p-4 bg-base-200 rounded-lg">
      <h3 className="text-lg font-semibold">创建新交易对</h3>
      
      <div className="form-control">
        <label className="label cursor-pointer">
          <span className="label-text">使用ETH作为交易对</span> 
          <input 
            type="checkbox" 
            className="toggle toggle-primary" 
            checked={useEth}
            onChange={toggleEth}
          />
        </label>
      </div>
      
      {renderTokenInput(token0Address, setToken0Address, "代币1", useEth)}
      {renderTokenInput(token1Address, setToken1Address, "代币2")}
      
      <button 
        className={`btn btn-primary w-full ${isCreating || isLoading ? "loading" : ""}`}
        onClick={handleCreatePair}
        disabled={isCreating || isLoading || (!token0Address && !useEth) || !token1Address}
      >
        {isCreating ? "创建中..." : "创建交易对"}
      </button>
    </div>
  );

  const renderPairList = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center p-4">
          <span className="loading loading-spinner"></span>
        </div>
      );
    }
    
    if (pairs.length === 0) {
      return (
        <div className="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 className="font-bold">提示</h3>
            <div className="text-sm">
              暂无交易对，请创建新的交易对
            </div>
            <div className="text-xs mt-1">
              工厂合约地址: {factoryAddress}
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <>
        <div className="divider">已有交易对</div>
        <div className="grid grid-cols-1 gap-4">
          {pairs.map((pair, index) => {
            // 如果有token信息，显示代币符号，否则显示索引号
            const pairDisplay = pair.token0Symbol && pair.token1Symbol
              ? `${pair.token0Symbol}/${pair.token1Symbol}`
              : `交易对 #${index + 1}`;
              
            return (
              <button
                key={pair.address}
                className="btn btn-outline text-left flex flex-col items-start h-auto p-3"
                onClick={() => onPoolSelect(pair.address)}
              >
                <div className="font-medium">{pairDisplay}</div>
                <div className="text-xs text-left opacity-70 truncate w-full mt-1">
                  {pair.address}
                </div>
              </button>
            );
          })}
        </div>
      </>
    );
  };

  if (error) {
    return (
      <div className="space-y-4">
        <div className="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-bold">错误</h3>
            <div className="text-sm">{error}</div>
            <div className="text-xs mt-1">
              工厂合约地址: {factoryAddress}
            </div>
          </div>
        </div>
        {renderCreatePairInterface()}
        {renderPairList()}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderCreatePairInterface()}
      {renderPairList()}
    </div>
  );
};