import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CrowdfundingStableV2Module", (m) => {
  // USDC pe Sepolia
  const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  // Uniswap V2 Router pe Sepolia
  const UNISWAP_V2_ROUTER_SEPOLIA = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008";

  const contract = m.contract("CrowdfundingStableV2", [USDC_SEPOLIA, UNISWAP_V2_ROUTER_SEPOLIA]);
  return { contract };
});
