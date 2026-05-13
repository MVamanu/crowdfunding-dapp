import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("CrowdfundingCrossMilestone", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();

  const milestoneTitles = ["Faza 1", "Faza 2"];
  const milestoneDescs = ["Dezvoltare", "Lansare"];
  const milestoneAmounts = [500n, 500n];

  it("creeaza campanie cross-chain cu succes", async function () {
    const contract = await viem.deployContract("CrowdfundingCrossMilestone");
    await contract.write.createCampaign([
      "Test Cross Milestone", "Descriere", 1000n, 30n,
      "SolanaAddr", "eth", milestoneTitles, milestoneDescs, milestoneAmounts
    ]);
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.title, "Test Cross Milestone");
    assert.equal(campaign.goalUSD, 1000n);
    assert.equal(campaign.milestoneCount, 2n);
    assert.equal(campaign.primaryChain, "eth");
    assert.equal(campaign.solanaAddress, "SolanaAddr");
  });

  it("accepta donatii ETH", async function () {
    const contract = await viem.deployContract("CrowdfundingCrossMilestone");
    await contract.write.createCampaign([
      "Test", "Desc", 1000n, 30n, "SolAddr", "eth",
      milestoneTitles, milestoneDescs, milestoneAmounts
    ]);
    await contract.write.donateETH([0n], {
      value: 500000000000000000n,
      account: walletClients[1].account
    });
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.amountRaisedETH, 500000000000000000n);
  });

  it("valideaza descrierile milestone si durata", async function () {
    const contract = await viem.deployContract("CrowdfundingCrossMilestone");
    await assert.rejects(
      contract.write.createCampaign([
        "Test", "Desc", 1000n, 30n, "SolAddr", "eth",
        milestoneTitles, ["Doar una"], milestoneAmounts
      ]),
      /Date invalide/
    );

    await assert.rejects(
      contract.write.createCampaign([
        "Test", "Desc", 1000n, 0n, "SolAddr", "eth",
        milestoneTitles, milestoneDescs, milestoneAmounts
      ]),
      /Durata trebuie sa fie pozitiva/
    );
  });

  it("nu accepta donatii ETH dupa deadline", async function () {
    const contract = await viem.deployContract("CrowdfundingCrossMilestone");
    await contract.write.createCampaign([
      "Test", "Desc", 1000n, 1n, "SolAddr", "eth",
      milestoneTitles, milestoneDescs, milestoneAmounts
    ]);

    await publicClient.request({
      method: "evm_increaseTime",
      params: [2 * 24 * 60 * 60],
    });
    await publicClient.request({ method: "evm_mine", params: [] });

    await assert.rejects(
      contract.write.donateETH([0n], {
        value: 500000000000000000n,
        account: walletClients[1].account
      }),
      /Campania a expirat/
    );
  });

  it("owner poate inregistra donatii SOL in USD", async function () {
    const contract = await viem.deployContract("CrowdfundingCrossMilestone");
    await contract.write.createCampaign([
      "Test", "Desc", 1000n, 30n, "SolAddr", "eth",
      milestoneTitles, milestoneDescs, milestoneAmounts
    ]);
    await contract.write.recordSolDonation([0n, 250n]);
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.amountRaisedSOLusd, 250n);
  });

  it("submit milestone si vot", async function () {
    const contract = await viem.deployContract("CrowdfundingCrossMilestone");
    await contract.write.createCampaign([
      "Test", "Desc", 1000n, 30n, "SolAddr", "eth",
      milestoneTitles, milestoneDescs, milestoneAmounts
    ]);
    await contract.write.donateETH([0n], {
      value: 500000000000000000n,
      account: walletClients[1].account
    });
    await contract.write.submitMilestone([0n]);
    const milestone = await contract.read.getMilestone([0n, 0n]);
    assert.equal(milestone.votingActive, true);

    await contract.write.vote([0n, 0n, true], { account: walletClients[1].account });
    const milestoneAfter = await contract.read.getMilestone([0n, 0n]);
    assert.equal(milestoneAfter.votesFor, 500000000000000000n);
  });

  it("esueaza daca non-donator voteaza", async function () {
    const contract = await viem.deployContract("CrowdfundingCrossMilestone");
    await contract.write.createCampaign([
      "Test", "Desc", 1000n, 30n, "SolAddr", "eth",
      milestoneTitles, milestoneDescs, milestoneAmounts
    ]);
    await contract.write.donateETH([0n], {
      value: 500000000000000000n,
      account: walletClients[1].account
    });
    await contract.write.submitMilestone([0n]);
    await assert.rejects(
      contract.write.vote([0n, 0n, true], { account: walletClients[2].account }),
      /Trebuie sa fii donator ETH/
    );
  });

  it("doar ownerul poate finaliza milestone-ul curent", async function () {
    const contract = await viem.deployContract("CrowdfundingCrossMilestone");
    await contract.write.createCampaign([
      "Test", "Desc", 1000n, 30n, "SolAddr", "eth",
      milestoneTitles, milestoneDescs, milestoneAmounts
    ]);
    await contract.write.donateETH([0n], {
      value: 500000000000000000n,
      account: walletClients[1].account
    });
    await contract.write.submitMilestone([0n]);
    await contract.write.vote([0n, 0n, true], { account: walletClients[1].account });

    await assert.rejects(
      contract.write.finalizeMilestone([0n, 0n], { account: walletClients[1].account }),
      /Nu esti proprietarul/
    );

    await assert.rejects(
      contract.write.finalizeMilestone([0n, 1n]),
      /Milestone invalid/
    );

    await contract.write.finalizeMilestone([0n, 0n]);
    const campaign = await contract.read.getCampaign([0n]);
    const milestone = await contract.read.getMilestone([0n, 0n]);
    assert.equal(campaign.currentMilestone, 1n);
    assert.equal(milestone.approved, true);
  });
});
