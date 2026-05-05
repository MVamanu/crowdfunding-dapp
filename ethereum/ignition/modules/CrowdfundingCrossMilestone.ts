import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CrowdfundingCrossMilestoneModule", (m) => {
  const contract = m.contract("CrowdfundingCrossMilestone");
  return { contract };
});
