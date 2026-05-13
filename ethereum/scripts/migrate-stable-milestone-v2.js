import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { ethers } from "ethers";

const OLD_CONTRACT =
  process.env.OLD_STABLE_MILESTONE_CONTRACT ||
  "0x27d85EEB926AE080b41e77B69263190D9d5eB8F3";
const NEW_CONTRACT =
  process.env.NEW_STABLE_MILESTONE_CONTRACT ||
  "0xB0c5218ef966c6EBfEedE21909595cC327267998";
const RPC_URL = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;
const DRY_RUN = process.env.DRY_RUN !== "false";

const ABI = [
  "function campaignCount() view returns (uint256)",
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 totalGoal,uint256 amountRaisedLocal,uint256 amountRaisedExternal,bool isActive,uint256 deadline,bool goalReached,string mainChain,string[] acceptedChains,uint256 milestoneCount,uint256 currentMilestone))",
  "function getMilestone(uint256,uint256) view returns (tuple(string title,string description,uint256 amount,bool completed,bool approved,uint256 votesFor,uint256 votesAgainst,bool votingActive,uint256 votingDeadline))",
  "function createCampaign(string,string,uint256,string,string[],string[],string[],string[],uint256[]) returns (uint256)",
];

function requireEnv() {
  if (!RPC_URL) throw new Error("Missing SEPOLIA_RPC_URL in .env");
  if (!PRIVATE_KEY && !DRY_RUN) throw new Error("Missing SEPOLIA_PRIVATE_KEY in .env");
}

function getDurationDays(deadlineSeconds) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const secondsLeft = Math.max(24 * 60 * 60, Number(deadlineSeconds) - nowSeconds);
  return BigInt(Math.ceil(secondsLeft / (24 * 60 * 60)));
}

async function readCampaign(contract, id) {
  const campaign = await contract.getCampaign(id);
  const titles = [];
  const descriptions = [];
  const amounts = [];

  for (let i = 0; i < Number(campaign.milestoneCount); i++) {
    const milestone = await contract.getMilestone(id, i);
    titles.push(milestone.title);
    descriptions.push(milestone.description);
    amounts.push(milestone.amount);
  }

  return {
    oldId: Number(id),
    owner: campaign.owner,
    title: campaign.title,
    description: campaign.description,
    durationDays: getDurationDays(campaign.deadline).toString(),
    mainChain: campaign.mainChain,
    acceptedChains: [...campaign.acceptedChains],
    externalAddresses: campaign.acceptedChains.map(() => ""),
    milestoneTitles: titles,
    milestoneDescriptions: descriptions,
    milestoneAmounts: amounts.map(amount => amount.toString()),
    oldTotals: {
      totalGoal: campaign.totalGoal.toString(),
      amountRaisedLocal: campaign.amountRaisedLocal.toString(),
      amountRaisedExternal: campaign.amountRaisedExternal.toString(),
      isActive: campaign.isActive,
      goalReached: campaign.goalReached,
      currentMilestone: campaign.currentMilestone.toString(),
    },
  };
}

async function main() {
  requireEnv();

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const oldContract = new ethers.Contract(OLD_CONTRACT, ABI, provider);
  const newContract = PRIVATE_KEY
    ? new ethers.Contract(NEW_CONTRACT, ABI, new ethers.Wallet(PRIVATE_KEY, provider))
    : new ethers.Contract(NEW_CONTRACT, ABI, provider);

  const oldCount = Number(await oldContract.campaignCount());
  const newCountBefore = Number(await newContract.campaignCount());
  const report = {
    dryRun: DRY_RUN,
    oldContract: OLD_CONTRACT,
    newContract: NEW_CONTRACT,
    oldCount,
    newCountBefore,
    migrated: [],
    skipped: [],
  };

  console.log(`Found ${oldCount} campaigns on old contract.`);
  console.log(DRY_RUN ? "DRY_RUN=true, no transactions will be sent." : "DRY_RUN=false, migration transactions will be sent.");

  for (let i = 0; i < oldCount; i++) {
    const item = await readCampaign(oldContract, i);
    console.log(`Campaign ${i}: ${item.title}`);

    if (DRY_RUN) {
      report.migrated.push({ ...item, newId: null, txHash: null });
      continue;
    }

    const newId = Number(await newContract.campaignCount());
    const tx = await newContract.createCampaign(
      item.title,
      item.description,
      BigInt(item.durationDays),
      item.mainChain || "eth",
      item.acceptedChains.length > 0 ? item.acceptedChains : ["eth"],
      item.externalAddresses,
      item.milestoneTitles,
      item.milestoneDescriptions,
      item.milestoneAmounts.map(amount => BigInt(amount))
    );
    console.log(`  tx: ${tx.hash}`);
    await tx.wait();
    console.log(`  migrated old ${i} -> new ${newId}`);
    report.migrated.push({ ...item, newId, txHash: tx.hash });
  }

  report.newCountAfter = Number(await newContract.campaignCount());
  await mkdir("migration-reports", { recursive: true });
  const path = `migration-reports/stable-milestone-v2-${Date.now()}.json`;
  await writeFile(path, JSON.stringify(report, null, 2));
  console.log(`Report written to ${path}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
