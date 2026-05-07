import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("CrowdfundingStable", async function () {
  const { viem } = await network.create();
  const walletClients = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  // Deploy MockERC20 pentru teste
  async function deployMockUSDC() {
    const mockToken = await viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
    return mockToken;
  }

  it("creeaza o campanie USDC cu succes", async function () {
    const usdc = await deployMockUSDC();
    const contract = await viem.deployContract("CrowdfundingStable", [
      usdc.address, 6
    ]);
    await contract.write.createCampaign([
      "Test Campanie USDC", "Descriere", 100_000_000n, 30n
    ]);
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.title, "Test Campanie USDC");
    assert.equal(campaign.goal, 100_000_000n);
    assert.equal(campaign.isActive, true);
    assert.equal(campaign.goalReached, false);
  });

  it("accepta donatii USDC cu approve", async function () {
    const usdc = await deployMockUSDC();
    const contract = await viem.deployContract("CrowdfundingStable", [
      usdc.address, 6
    ]);
    await contract.write.createCampaign(["Test", "Desc", 100_000_000n, 30n]);

    // Mint USDC pentru donator
    await usdc.write.mint([walletClients[1].account.address, 200_000_000n]);

    // Approve + Donate
    await usdc.write.approve([contract.address, 50_000_000n], {
      account: walletClients[1].account
    });
    await contract.write.donate([0n, 50_000_000n], {
      account: walletClients[1].account
    });

    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.amountRaised, 50_000_000n);
    assert.equal(campaign.goalReached, false);
  });

  it("seteaza goalReached cand goalul e atins", async function () {
    const usdc = await deployMockUSDC();
    const contract = await viem.deployContract("CrowdfundingStable", [
      usdc.address, 6
    ]);
    await contract.write.createCampaign(["Test", "Desc", 100_000_000n, 30n]);
    await usdc.write.mint([walletClients[1].account.address, 200_000_000n]);
    await usdc.write.approve([contract.address, 100_000_000n], {
      account: walletClients[1].account
    });
    await contract.write.donate([0n, 100_000_000n], {
      account: walletClients[1].account
    });

    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.goalReached, true);
  });

  it("owner poate retrage USDC dupa atingerea goalului", async function () {
    const usdc = await deployMockUSDC();
    const contract = await viem.deployContract("CrowdfundingStable", [
      usdc.address, 6
    ]);
    await contract.write.createCampaign(["Test", "Desc", 100_000_000n, 30n]);
    await usdc.write.mint([walletClients[1].account.address, 200_000_000n]);
    await usdc.write.approve([contract.address, 100_000_000n], {
      account: walletClients[1].account
    });
    await contract.write.donate([0n, 100_000_000n], {
      account: walletClients[1].account
    });

    const balanceBefore = await usdc.read.balanceOf([walletClients[0].account.address]);
    await contract.write.withdraw([0n]);
    const balanceAfter = await usdc.read.balanceOf([walletClients[0].account.address]);

    assert.equal(balanceAfter - balanceBefore, 100_000_000n);
  });

  it("esueaza donate fara approve", async function () {
    const usdc = await deployMockUSDC();
    const contract = await viem.deployContract("CrowdfundingStable", [
      usdc.address, 6
    ]);
    await contract.write.createCampaign(["Test", "Desc", 100_000_000n, 30n]);
    await usdc.write.mint([walletClients[1].account.address, 200_000_000n]);

    await assert.rejects(
      contract.write.donate([0n, 50_000_000n], {
        account: walletClients[1].account
      }),
      /Allowance insuficient/
    );
  });

  it("esueaza withdraw daca goal nu e atins", async function () {
    const usdc = await deployMockUSDC();
    const contract = await viem.deployContract("CrowdfundingStable", [
      usdc.address, 6
    ]);
    await contract.write.createCampaign(["Test", "Desc", 100_000_000n, 30n]);
    await usdc.write.mint([walletClients[1].account.address, 200_000_000n]);
    await usdc.write.approve([contract.address, 50_000_000n], {
      account: walletClients[1].account
    });
    await contract.write.donate([0n, 50_000_000n], {
      account: walletClients[1].account
    });

    await assert.rejects(
      contract.write.withdraw([0n]),
      /Goalul nu a fost atins/
    );
  });

  it("esueaza daca non-owner incearca withdraw", async function () {
    const usdc = await deployMockUSDC();
    const contract = await viem.deployContract("CrowdfundingStable", [
      usdc.address, 6
    ]);
    await contract.write.createCampaign(["Test", "Desc", 100_000_000n, 30n]);
    await usdc.write.mint([walletClients[1].account.address, 200_000_000n]);
    await usdc.write.approve([contract.address, 100_000_000n], {
      account: walletClients[1].account
    });
    await contract.write.donate([0n, 100_000_000n], {
      account: walletClients[1].account
    });

    await assert.rejects(
      contract.write.withdraw([0n], { account: walletClients[1].account }),
      /Nu esti proprietarul/
    );
  });
});
