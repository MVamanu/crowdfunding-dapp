import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("CrowdfundingUnified", async function () {
  const { viem } = await network.create();
  const walletClients = await viem.getWalletClients();

  it("creeaza o campanie cross-chain cu succes", async function () {
    const contract = await viem.deployContract("CrowdfundingUnified");
    await contract.write.createCampaign([
      "Test Cross-Chain", "Descriere", 1000n, 30n, "SolanaAddressHere"
    ]);
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.title, "Test Cross-Chain");
    assert.equal(campaign.goalUSD, 1000n);
    assert.equal(campaign.solanaAddress, "SolanaAddressHere");
    assert.equal(campaign.isActive, true);
  });

  it("accepta donatii ETH", async function () {
    const contract = await viem.deployContract("CrowdfundingUnified");
    await contract.write.createCampaign(["Test", "Desc", 1000n, 30n, "SolAddr"]);
    await contract.write.donate([0n], {
      value: 500000000000000000n,
      account: walletClients[1].account
    });
    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.amountRaisedETH, 500000000000000000n);
  });

  it("esueaza daca goal USD este 0", async function () {
    const contract = await viem.deployContract("CrowdfundingUnified");
    await assert.rejects(
      contract.write.createCampaign(["Test", "Desc", 0n, 30n, "SolAddr"]),
      /Goalul trebuie sa fie pozitiv/
    );
  });

  it("owner poate retrage fondurile", async function () {
    const contract = await viem.deployContract("CrowdfundingUnified");
    await contract.write.createCampaign(["Test", "Desc", 1000n, 30n, "SolAddr"]);
    await contract.write.donate([0n], {
      value: 500000000000000000n,
      account: walletClients[1].account
    });
    const publicClient = await viem.getPublicClient();
    const balanceBefore = await publicClient.getBalance({ address: walletClients[0].account.address });
    await contract.write.withdraw([0n]);
    const balanceAfter = await publicClient.getBalance({ address: walletClients[0].account.address });
    assert.ok(balanceAfter > balanceBefore);
  });

  it("esueaza daca non-owner incearca withdraw", async function () {
    const contract = await viem.deployContract("CrowdfundingUnified");
    await contract.write.createCampaign(["Test", "Desc", 1000n, 30n, "SolAddr"]);
    await contract.write.donate([0n], {
      value: 500000000000000000n,
      account: walletClients[1].account
    });
    await assert.rejects(
      contract.write.withdraw([0n], { account: walletClients[1].account }),
      /Nu esti proprietarul/
    );
  });
});
