import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CrowdfundingStableV2Module", (m) => {
  const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const contract = m.contract("CrowdfundingStableV2", [USDC_SEPOLIA]);
  return { contract };
});
