// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title TestUSDC - Test USDC Token
 * @dev 这是一个用于测试的 USDC 代币
 */
contract TestUSDC {
    string public name = "Test USDC";
    string public symbol = "USDC";
    uint8 public decimals = 6;  // USDC uses 6 decimals

    // 事件定义
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);

    // 状态变量
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    constructor() {
        // 铸造 1,000,000 USDC 给部署者
        uint256 initialSupply = 1_000_000 * 10**decimals;
        balanceOf[msg.sender] = initialSupply;
        totalSupply = initialSupply;
        emit Transfer(address(0), msg.sender, initialSupply);
    }

    /**
     * @dev 批准另一个地址花费代币
     */
    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @dev 转移代币到另一个地址
     */
    function transfer(address to, uint256 amount) public returns (bool) {
        return transferFrom(msg.sender, to, amount);
    }

    /**
     * @dev 从一个地址转移代币到另一个地址
     */
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(balanceOf[from] >= amount, "TestUSDC: insufficient balance");

        if (from != msg.sender && allowance[from][msg.sender] != type(uint).max) {
            require(allowance[from][msg.sender] >= amount, "TestUSDC: insufficient allowance");
            allowance[from][msg.sender] -= amount;
        }

        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
        return true;
    }

    /**
     * @dev 铸造代币（仅供测试使用）
     */
    function mint(address to, uint256 amount) public {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
}