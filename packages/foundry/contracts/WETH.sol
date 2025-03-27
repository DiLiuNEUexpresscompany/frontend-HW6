// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./interfaces/IWETH.sol";

/**
 * @title WETH - Wrapped Ether
 * @dev 这是ETH的ERC20包装版本，兼容Uniswap的自动ETH转换功能
 */
contract WETH is IWETH {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;

    // 事件定义
    event Approval(address indexed src, address indexed guy, uint256 wad);
    event Transfer(address indexed src, address indexed dst, uint256 wad);
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    // 状态变量
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /**
     * @dev 接收ETH并自动转换为WETH
     */
    receive() external payable {
        deposit();
    }

    /**
     * @dev 将ETH转换为WETH
     */
    function deposit() public payable override {
        balanceOf[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev 将WETH转换回ETH
     * @param wad 要提取的数量
     */
    function withdraw(uint256 wad) public override {
        require(balanceOf[msg.sender] >= wad, "WETH: insufficient balance");
        balanceOf[msg.sender] -= wad;
        payable(msg.sender).transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }

    /**
     * @dev 返回合约的总供应量
     */
    function totalSupply() public view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev 批准另一个地址花费代币
     * @param guy 被授权的地址
     * @param wad 批准的数量
     */
    function approve(address guy, uint256 wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }

    /**
     * @dev 转移代币到另一个地址
     * @param dst 目标地址
     * @param wad 转移的数量
     */
    function transfer(address dst, uint256 wad) public override returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    /**
     * @dev 从一个地址转移代币到另一个地址
     * @param src 源地址
     * @param dst 目标地址
     * @param wad 转移的数量
     */
    function transferFrom(address src, address dst, uint256 wad) public returns (bool) {
        require(balanceOf[src] >= wad, "WETH: insufficient balance");

        if (src != msg.sender && allowance[src][msg.sender] != type(uint).max) {
            require(allowance[src][msg.sender] >= wad, "WETH: insufficient allowance");
            allowance[src][msg.sender] -= wad;
        }

        balanceOf[src] -= wad;
        balanceOf[dst] += wad;

        emit Transfer(src, dst, wad);

        return true;
    }
}