// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MockUniswapRouter - Router mock pentru testare swap ETH->USDC
/// @dev Simuleaza Uniswap V2 Router: 1 ETH = 2000 USDC (rata fixa pentru teste)
interface IERC20Mint {
    function mint(address to, uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
}

contract MockUniswapRouter {
    address public immutable WETH_ADDRESS;
    IERC20Mint public immutable usdcToken;
    // Rata de schimb: 1 ETH = 2000 USDC (simplificat pentru teste)
    uint256 public constant ETH_TO_USDC_RATE = 2000_000_000; // 2000 USDC cu 6 zecimale

    constructor(address _weth, address _usdc) {
        WETH_ADDRESS = _weth;
        usdcToken = IERC20Mint(_usdc);
    }

    function WETH() external view returns (address) {
        return WETH_ADDRESS;
    }

    function getAmountsOut(uint amountIn, address[] calldata) external pure returns (uint[] memory amounts) {
        amounts = new uint[](2);
        amounts[0] = amountIn;
        // 1 ETH (1e18 wei) = 2000 USDC (2000 * 1e6)
        amounts[1] = (amountIn * ETH_TO_USDC_RATE) / 1e18;
    }

    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint
    ) external payable returns (uint[] memory amounts) {
        amounts = new uint[](2);
        amounts[0] = msg.value;
        uint256 usdcAmount = (msg.value * ETH_TO_USDC_RATE) / 1e18;
        require(usdcAmount >= amountOutMin, "Slippage prea mare");
        amounts[1] = usdcAmount;
        // Mint USDC catre destinatar
        usdcToken.mint(to, usdcAmount);
    }
}
