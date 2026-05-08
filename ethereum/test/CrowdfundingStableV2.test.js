import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("CrowdfundingStableV2", async function () {
  const { viem } = await network.create();
  const walletClients = await viem.getWalletClients();

  async function deployAll() {
    const usdc = await viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
    const weth = await viem.deployContract("MockERC20", ["Wrapped ETH", "WETH", 18]);
    const router = await viem.deployContract("MockUniswapRouter", [weth.address, usdc.address]);
    const contract = await viem.deployContract("CrowdfundingStableV2", [usdc.address, router.address]);
    return { usdc, weth, router, contract };
  }

  it("creeaza campanie cu main chain ETH", async function () {
    const { contract } = await deployAll();
    await contract.write.createCampaign([
      "Test ETH Main", "Descriere", 100_000_000n, 30n,
      "eth", ["eth", "sol"], ""
    ]);
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.title, "Test ETH Main");
    assert.equal(campaign.mainChain, "eth");
    assert.equal(campaign.goalUSDC, 100_000_000n);
    assert.equal(campaign.isActive, true);
    assert.equal(campaign.goalReached, false);
  });

  it("creeaza campanie cu main chain SOL si solanaId", async function () {
    const { contract } = await deployAll();
    const solanaId = "5bgwcbaeK9LCjpiPCvMTdvVxvLGTUKrhBH6ZtBhhyq1C";
    await contract.write.createCampaign([
      "Test SOL Main", "Descriere", 100_000_000n, 30n,
      "sol", ["eth", "sol"], solanaId
    ]);
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.mainChain, "sol");
    assert.equal(campaign.solanaId, solanaId);
    const exists = await contract.read.solanaIdExists([solanaId]);
    assert.equal(exists, true);
  });

  it("accepta donatii USDC locale ETH", async function () {
    const { usdc, contract } = await deployAll();
    await contract.write.createCampaign([
      "Test", "Desc", 100_000_000n, 30n,
      "eth", ["eth", "sol"], ""
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
  });

  it("accepta donatii ETH cu swap automat la USDC", async function () {
    const { contract } = await deployAll();
    await contract.write.createCampaign([
      "Test ETH Swap", "Desc", 1_000_000_000n, 30n,
      "eth", ["eth"], ""
    ]);

    // Donator trimite 0.1 ETH -> swap la USDC (0.1 * 2000 = 200 USDC)
    await contract.write.donateETH([0n], {
      account: walletClients[1].account,
      value: 100_000_000_000_000_000n // 0.1 ETH in wei
    });

    const campaign = await contract.read.getCampaign([0n]);
    // 0.1 ETH * 2000 USDC/ETH = 200 USDC = 200_000_000 (6 decimale)
    assert.equal(campaign.amountRaisedLocal, 200_000_000n);
  });

  it("getUSDCForETH returneaza estimarea corecta", async function () {
    const { contract } = await deployAll();
    // 1 ETH = 2000 USDC conform MockRouter
    const estimate = await contract.read.getUSDCForETH([1_000_000_000_000_000_000n]);
    assert.equal(estimate, 2_000_000_000n); // 2000 USDC cu 6 zecimale
  });

  it("accepta donatii ETH pentru campanie SOL prin solanaId", async function () {
    const { usdc, contract } = await deployAll();
    const solanaId = "5bgwcbaeK9LCjpiPCvMTdvVxvLGTUKrhBH6ZtBhhyq1C";
    await contract.write.createCampaign([
      "Test SOL", "Desc", 100_000_000n, 30n,
      "sol", ["eth", "sol"], solanaId
    ]);
    await usdc.write.mint([walletClients[1].account.address, 200_000_000n]);
    await usdc.write.approve([contract.address, 50_000_000n], {
      account: walletClients[1].account
    });
    await contract.write.donateForSolCampaign([solanaId, 50_000_000n], {
      account: walletClients[1].account
    });
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.amountRaisedLocal, 50_000_000n);
  });

  it("accepta donatii ETH swap pentru campanie SOL", async function () {
    const { contract } = await deployAll();
    const solanaId = "5bgwcbaeK9LCjpiPCvMTdvVxvLGTUKrhBH6ZtBhhyq1C";
    await contract.write.createCampaign([
      "Test SOL ETH", "Desc", 1_000_000_000n, 30n,
      "sol", ["eth", "sol"], solanaId
    ]);

    await contract.write.donateETHForSol([solanaId], {
      account: walletClients[1].account,
      value: 100_000_000_000_000_000n // 0.1 ETH
    });

    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.amountRaisedLocal, 200_000_000n); // 200 USDC
  });

  it("getCampaignBySolanaId returneaza campania corecta", async function () {
    const { contract } = await deployAll();
    const solanaId = "5bgwcbaeK9LCjpiPCvMTdvVxvLGTUKrhBH6ZtBhhyq1C";
    await contract.write.createCampaign([
      "Test SOL", "Desc", 100_000_000n, 30n,
      "sol", ["eth", "sol"], solanaId
    ]);
    const [campaign, id] = await contract.read.getCampaignBySolanaId([solanaId]);
    assert.equal(campaign.title, "Test SOL");
    assert.equal(id, 0n);
  });

  it("goalReached cand total local + extern >= goal", async function () {
    const { usdc, contract } = await deployAll();
    await contract.write.createCampaign([
      "Test", "Desc", 100_000_000n, 30n,
      "eth", ["eth", "sol"], ""
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
      "eth", ["eth"], ""
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

  it("esueaza donateForSolCampaign daca solanaId nu exista", async function () {
    const { usdc, contract } = await deployAll();
    await usdc.write.mint([walletClients[1].account.address, 200_000_000n]);
    await usdc.write.approve([contract.address, 50_000_000n], {
      account: walletClients[1].account
    });
    await assert.rejects(
      contract.write.donateForSolCampaign(["invalidSolanaId", 50_000_000n], {
        account: walletClients[1].account
      }),
      /Campania Solana nu exista pe ETH/
    );
  });
});
