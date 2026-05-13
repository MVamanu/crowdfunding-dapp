import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CrowdfundingStableMilestoneV2Module", (m) => {
  const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const contract = m.contract("CrowdfundingStableMilestoneV2", [USDC_SEPOLIA]);
  return { contract };
});
