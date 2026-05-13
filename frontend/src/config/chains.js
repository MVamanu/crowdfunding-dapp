import { PublicKey, clusterApiUrl } from "@solana/web3.js";

export const SEPOLIA_RPC_URL =
  import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

export const SOLANA_CLUSTER = import.meta.env.VITE_SOLANA_CLUSTER || "devnet";
export const SOLANA_RPC_URL =
  import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl(SOLANA_CLUSTER);

export const CONTRACTS = {
  eth: import.meta.env.VITE_ETH_CONTRACT_ADDRESS || "0x53EF55468DF1570952b7A07eF46926c3837e5770",
  milestone:
    import.meta.env.VITE_ETH_MILESTONE_CONTRACT_ADDRESS ||
    "0x50B8de29C8226a85c99b9679060A30a180277a1E",
  unified:
    import.meta.env.VITE_ETH_UNIFIED_CONTRACT_ADDRESS ||
    "0x4C6b83E06c9B7f83a029312eA9E3E00E7CBC6a5e",
  crossMilestone:
    import.meta.env.VITE_ETH_CROSS_MILESTONE_CONTRACT_ADDRESS ||
    "0x96132Dd1FFD9Ef26dbDEd95Dd4e3C2e220C21A4E",
  stable:
    import.meta.env.VITE_ETH_STABLE_CONTRACT_ADDRESS ||
    "0x8FA441B88BC346427E34baf5B1b1E09ed1700f3c",
  stableV2:
    import.meta.env.VITE_ETH_STABLE_V2_CONTRACT_ADDRESS ||
    "0xE3Ae8c1BF26e6bAfe7EDc5143Cd288B9DF4C1e40",
  stableMilestone:
    import.meta.env.VITE_ETH_STABLE_MILESTONE_CONTRACT_ADDRESS ||
    "0xB0c5218ef966c6EBfEedE21909595cC327267998",
};

export const SOLANA_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_SOLANA_PROGRAM_ID || "9Q26M3XJE9pveumjKK4VxMfBu8EQXPnqHHTNXfSU5kEi"
);

export const USDC = {
  sepoliaAddress:
    import.meta.env.VITE_USDC_SEPOLIA_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  solanaDevnetMint: new PublicKey(
    import.meta.env.VITE_USDC_SOLANA_DEVNET_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
  ),
};

export const UNISWAP = {
  sepoliaSwapRouter02:
    import.meta.env.VITE_UNISWAP_SEPOLIA_SWAP_ROUTER_02 ||
    "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
  sepoliaQuoterV2:
    import.meta.env.VITE_UNISWAP_SEPOLIA_QUOTER_V2 ||
    "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",
  sepoliaWeth:
    import.meta.env.VITE_UNISWAP_SEPOLIA_WETH ||
    "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
  sepoliaWethUsdcFee: Number(import.meta.env.VITE_UNISWAP_SEPOLIA_WETH_USDC_FEE || 3000),
};

export const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_SPL_TOKEN_PROGRAM_ID || "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_ASSOCIATED_TOKEN_PROGRAM_ID || "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);
