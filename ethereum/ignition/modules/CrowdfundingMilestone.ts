import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CrowdfundingMilestoneModule", (m) => {
  const crowdfundingMilestone = m.contract("CrowdfundingMilestone");
  return { crowdfundingMilestone };
});
