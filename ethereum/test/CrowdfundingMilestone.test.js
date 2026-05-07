import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("CrowdfundingMilestone", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();

  const milestoneTitles = ["Faza 1 - Dezvoltare", "Faza 2 - Testare", "Faza 3 - Lansare"];
  const milestoneDescs = ["Dezvoltarea produsului", "Testare si QA", "Lansare publica"];
  const milestoneAmounts = [300000000000000000n, 300000000000000000n, 400000000000000000n];
  const totalGoal = 1000000000000000000n;

  it("creeaza o campanie cu milestone-uri", async function () {
    const contract = await viem.deployContract("CrowdfundingMilestone");
    await contract.write.createCampaign([
      "Test Milestone Campaign", "Descriere test", 30n,
      milestoneTitles, milestoneDescs, milestoneAmounts
    ]);
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.title, "Test Milestone Campaign");
    assert.equal(campaign.totalGoal, totalGoal);
    assert.equal(campaign.milestoneCount, 3n);
    assert.equal(campaign.currentMilestone, 0n);
  });

  it("returneaza milestone-urile corect", async function () {
    const contract = await viem.deployContract("CrowdfundingMilestone");
    await contract.write.createCampaign([
      "Test", "Descriere", 30n,
      milestoneTitles, milestoneDescs, milestoneAmounts
    ]);
    const m0 = await contract.read.getMilestone([0n, 0n]);
    const m1 = await contract.read.getMilestone([0n, 1n]);
    const m2 = await contract.read.getMilestone([0n, 2n]);
    assert.equal(m0.title, "Faza 1 - Dezvoltare");
    assert.equal(m0.amount, 300000000000000000n);
    assert.equal(m1.title, "Faza 2 - Testare");
    assert.equal(m2.title, "Faza 3 - Lansare");
    assert.equal(m2.amount, 400000000000000000n);
  });

  it("accepta donatii", async function () {
    const contract = await viem.deployContract("CrowdfundingMilestone");
    await contract.write.createCampaign([
      "Test", "Descriere", 30n,
      milestoneTitles, milestoneDescs, milestoneAmounts
    ]);
    await contract.write.donate([0n], {
      value: 500000000000000000n,
      account: walletClients[1].account
    });
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.amountRaised, 500000000000000000n);
  });

  it("esueaza cu mai putin de 2 milestone-uri", async function () {
    const contract = await viem.deployContract("CrowdfundingMilestone");
    await assert.rejects(
      contract.write.createCampaign([
        "Test", "Descriere", 30n,
        ["Singur"], ["Desc"], [1000000000000000000n]
      ]),
      /Minim 2 milestone-uri/
    );
  });

  it("submit milestone dupa atingerea goalului", async function () {
    const contract = await viem.deployContract("CrowdfundingMilestone");
    await contract.write.createCampaign([
      "Test", "Descriere", 30n,
      milestoneTitles, milestoneDescs, milestoneAmounts
    ]);
    await contract.write.donate([0n], { value: 1000000000000000000n, account: walletClients[1].account });
    await contract.write.submitMilestone([0n]);
    const milestone = await contract.read.getMilestone([0n, 0n]);
    assert.equal(milestone.votingActive, true);
  });

  it("donatorii pot vota milestone", async function () {
    const contract = await viem.deployContract("CrowdfundingMilestone");
    await contract.write.createCampaign([
      "Test", "Descriere", 30n,
      milestoneTitles, milestoneDescs, milestoneAmounts
    ]);
    await contract.write.donate([0n], { value: 1000000000000000000n, account: walletClients[1].account });
    await contract.write.submitMilestone([0n]);
    await contract.write.vote([0n, 0n, true], { account: walletClients[1].account });
    const milestone = await contract.read.getMilestone([0n, 0n]);
    assert.equal(milestone.votesFor, 1000000000000000000n);
  });

  it("esueaza daca non-donator voteaza", async function () {
    const contract = await viem.deployContract("CrowdfundingMilestone");
    await contract.write.createCampaign([
      "Test", "Descriere", 30n,
      milestoneTitles, milestoneDescs, milestoneAmounts
    ]);
    await contract.write.donate([0n], { value: 1000000000000000000n, account: walletClients[1].account });
    await contract.write.submitMilestone([0n]);
    await assert.rejects(
      contract.write.vote([0n, 0n, true], { account: walletClients[2].account }),
      /Trebuie sa fii donator/
    );
  });
});
