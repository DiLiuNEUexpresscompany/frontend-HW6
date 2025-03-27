// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Script, console } from "forge-std/Script.sol";
import { ScaffoldETHDeploy } from "./DeployHelpers.s.sol";

import { UniswapV2Factory } from "../contracts/UniswapV2Factory.sol";
import { UniswapV2Router02 } from "../contracts/UniswapV2Router02.sol";
import { UniswapV2Pair } from "../contracts/UniswapV2Pair.sol";
import { WETH } from "../contracts/WETH.sol";
import { TestUSDC } from "../contracts/TestUSDC.sol";

contract Deploy is ScaffoldETHDeploy {
    function run() public ScaffoldEthDeployerRunner {
        // Deploy WETH
        WETH weth = new WETH();
        deployments.push(Deployment("WETH", address(weth)));
        
        // Deploy TestUSDC
        TestUSDC usdc = new TestUSDC();
        deployments.push(Deployment("TestUSDC", address(usdc)));
        
        // Deploy Factory
        UniswapV2Factory factory = new UniswapV2Factory(msg.sender);
        deployments.push(Deployment("UniswapV2Factory", address(factory)));
        
        // Deploy Router with WETH address
        UniswapV2Router02 router = new UniswapV2Router02(address(factory), address(weth));
        deployments.push(Deployment("UniswapV2Router02", address(router)));
        
        // 这里不需要部署 Pair，因为 Pair 是由 Factory 创建的
        // 但是我们需要将 Pair 的 ABI 添加到部署信息中，以便前端可以使用
        deployments.push(Deployment("UniswapV2Pair", address(0)));
        
        // 为 Router 批准 WETH 和 USDC
        weth.approve(address(router), type(uint256).max);
        usdc.approve(address(router), type(uint256).max);
        
        console.log("WETH deployed to:", address(weth));
        console.log("TestUSDC deployed to:", address(usdc));
        console.log("Factory deployed to:", address(factory));
        console.log("Router deployed to:", address(router));
        console.log("UniswapV2Pair interface added with placeholder address");
    }
}