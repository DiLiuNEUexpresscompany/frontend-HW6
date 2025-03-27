// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../contracts/UniswapV2Router02.sol";

contract DeployRouter is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        address factory = 0x8a2144B5baF0B2C8807dE8e0Fa82156cD0DEA8DC;
        address weth = 0x764ac516ec320A310375E69F59180355c69e313f;
        
        UniswapV2Router02 router = new UniswapV2Router02(factory, weth);
        
        vm.stopBroadcast();
        
        console.log("Router deployed at:", address(router));
    }
}