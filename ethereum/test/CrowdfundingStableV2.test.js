import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("CrowdfundingStableV2", async function () {
  const { viem } = await network.create();
  const walletClients = await viem.getWalletClients();

  async function deployAll() {
    const usdc = await viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
    const contract = await viem.deployContract("CrowdfundingStableV2", [usdc.address]);
    return { usdc, contract };
  }

  it("creeaza campanie cu main chain ETH", async function () {
    const { contract } = await deployAll();
    await contract.write.createCampaign([
      "Test ETH Main", "Descriere", 100_000_000n, 30n,
      "eth", ["eth", "sol"], ["", "SolanaAddr"]
    ]);
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.title, "Test ETH Main");
    assert.equal(campaign.mainChain, "eth");
    assert.equal(campaign.goalUSDC, 100_000_000n);
    assert.equal(campaign.isActive, true);
    assert.equal(campaign.goalReached, false);
  });

  it("creeaza campanie cu main chain SOL", async function () {
    const { contract } = await deployAll();
    await contract.write.createCampaign([
      "Test SOL Main", "Descriere", 100_000_000n, 30n,
      "sol", ["eth", "sol"], ["", "SolanaAddr"]
    ]);
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.mainChain, "sol");
  });

  it("accepta donatii USDC locale", async function () {
    const { usdc, contract } = await deployAll();
    await contract.write.createCampaign([
      "Test", "Desc", 100_000_000n, 30n,
      "eth", ["eth", "sol"], ["", ""]
    ]);
    await usdc.write.mint([walletClients[1].account.address, 200_000_000n]);
    await usdc.write.approve([contract.address, 50_000_000n], {
      account: walletClients[1].account
    });
    await contract.write.donateLocal([0n, 50_000_000n], {
      account: walletClients[1].account
    });
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.amountRaisedLocal, 50_000_000n);
    assert.equal(campaign.amountRaisedExternal, 0n);
  });

  it("inregistreaza donatie externa SOL", async function () {
    const { contract } = await deployAll();
    await contract.write.createCampaign([
      "Test", "Desc", 100_000_000n, 30n,
      "eth", ["eth", "sol"], ["", "SolAddr"]
    ]);
    await contract.write.recordExternalDonation([0n, 30_000_000n, "sol"]);
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.amountRaisedExternal, 30_000_000n);
    const solDonations = await contract.read.getExternalDonations([0n, "sol"]);
    assert.equal(solDonations, 30_000_000n);
  });

  it("goalReached cand total local + extern >= goal", async function () {
    const { usdc, contract } = await deployAll();
    await contract.write.createCampaign([
      "Test", "Desc", 100_000_000n, 30n,
      "eth", ["eth", "sol"], ["", ""]
    ]);
    await usdc.write.mint([walletClients[1].account.address, 200_000_000n]);
    await usdc.write.approve([contract.address, 60_000_000n], {
      account: walletClients[1].account
    });
    await contract.write.donateLocal([0n, 60_000_000n], {
      account: walletClients[1].account
    });
    await contract.write.recordExternalDonation([0n, 40_000_000n, "sol"]);
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.goalReached, true);
    const total = await contract.read.getTotalRaised([0n]);
    assert.equal(total, 100_000_000n);
  });

  it("owner retrage USDC dupa goal atins", async function () {
    const { usdc, contract } = await deployAll();
    await contract.write.createCampaign([
      "Test", "Desc", 100_000_000n, 30n,
      "eth", ["eth"], [""]
    ]);
    await usdc.write.mint([walletClients[1].account.address, 200_000_000n]);
    await usdc.write.approve([contract.address, 100_000_000n], {
      account: walletClients[1].account
    });
    await contract.write.donateLocal([0n, 100_000_000n], {
      account: walletClients[1].account
    });
    const balBefore = await usdc.read.balanceOf([walletClients[0].account.address]);
    await contract.write.withdraw([0n]);
    const balAfter = await usdc.read.balanceOf([walletClients[0].account.address]);
    assert.equal(balAfter - balBefore, 100_000_000n);
  });

  it("esueaza recordExternalDonation daca non-owner", async function () {
    const { contract } = await deployAll();
    await contract.write.createCampaign([
      "Test", "Desc", 100_000_000n, 30n,
      "eth", ["eth", "sol"], ["", ""]
    ]);
    await assert.rejects(
      contract.write.recordExternalDonation([0n, 30_000_000n, "sol"], {
        account: walletClients[1].account
      }),
      /Nu esti proprietarul/
    );
  });

  it("esueaza donateLocal fara approve", async function () {
    const { usdc, contract } = await deployAll();
    await contract.write.createCampaign([
      "Test", "Desc", 100_000_000n, 30n,
      "eth", ["eth"], [""]
    ]);
    await usdc.write.mint([walletClients[1].account.address, 200_000_000n]);
    await assert.rejects(
      contract.write.donateLocal([0n, 50_000_000n], {
        account: walletClients[1].account
      }),
      /Aproba USDC mai intai/
    );
  });
});
