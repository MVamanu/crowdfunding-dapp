import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CrowdfundingStableModule", (m) => {
  // USDC pe Sepolia Testnet: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
  const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const contract = m.contract("CrowdfundingStable", [USDC_SEPOLIA, 6]);
  return { contract };
});
