import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CrowdfundingUnifiedModule", (m) => {
  const crowdfundingUnified = m.contract("CrowdfundingUnified");
  return { crowdfundingUnified };
});
