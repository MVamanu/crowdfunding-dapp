import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("Crowdfunding", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();

  describe("createCampaign", async function () {
    it("creeaza o campanie cu succes", async function () {
      const contract = await viem.deployContract("Crowdfunding");
      await contract.write.createCampaign(["Test", "Descriere", 1000000000000000000n, 30n]);
      const campaign = await contract.read.getCampaign([0n]);
      assert.equal(campaign.title, "Test");
      assert.equal(campaign.goal, 1000000000000000000n);
      assert.equal(campaign.isActive, true);
    });

    it("esueaza daca goal este 0", async function () {
      const contract = await viem.deployContract("Crowdfunding");
      await assert.rejects(
        contract.write.createCampaign(["Test", "Descriere", 0n, 30n]),
        /Goalul trebuie sa fie pozitiv/
      );
    });

    it("esueaza daca durata este 0", async function () {
      const contract = await viem.deployContract("Crowdfunding");
      await assert.rejects(
        contract.write.createCampaign(["Test", "Descriere", 1000000000000000000n, 0n]),
        /Durata trebuie sa fie pozitiva/
      );
    });
  });

  describe("donate", async function () {
    it("accepta donatii cu succes", async function () {
      const contract = await viem.deployContract("Crowdfunding");
      await contract.write.createCampaign(["Test", "Descriere", 1000000000000000000n, 30n]);
      await contract.write.donate([0n], { value: 500000000000000000n, account: walletClients[1].account });
      const campaign = await contract.read.getCampaign([0n]);
      assert.equal(campaign.amountRaised, 500000000000000000n);
    });

    it("esueaza daca donatie este 0", async function () {
      const contract = await viem.deployContract("Crowdfunding");
      await contract.write.createCampaign(["Test", "Descriere", 1000000000000000000n, 30n]);
      await assert.rejects(
        contract.write.donate([0n], { value: 0n, account: walletClients[1].account }),
        /Donatie invalida/
      );
    });
  });

  describe("withdraw", async function () {
    it("owner poate retrage fondurile dupa atingerea goalului", async function () {
      const contract = await viem.deployContract("Crowdfunding");
      await contract.write.createCampaign(["Test", "Descriere", 1000000000000000000n, 30n]);
      await contract.write.donate([0n], { value: 1000000000000000000n, account: walletClients[1].account });
      const balanceBefore = await publicClient.getBalance({ address: walletClients[0].account.address });
      await contract.write.withdraw([0n]);
      const balanceAfter = await publicClient.getBalance({ address: walletClients[0].account.address });
      assert.ok(balanceAfter > balanceBefore);
    });

    it("esueaza daca goal nu e atins", async function () {
      const contract = await viem.deployContract("Crowdfunding");
      await contract.write.createCampaign(["Test2", "Descriere", 10000000000000000000n, 30n]);
      await contract.write.donate([0n], { value: 1000000000000000000n, account: walletClients[1].account });
      await assert.rejects(
        contract.write.withdraw([0n]),
        /Goalul nu a fost atins/
      );
    });

    it("esueaza daca nu esti owner", async function () {
      const contract = await viem.deployContract("Crowdfunding");
      await contract.write.createCampaign(["Test", "Descriere", 1000000000000000000n, 30n]);
      await contract.write.donate([0n], { value: 1000000000000000000n, account: walletClients[1].account });
      await assert.rejects(
        contract.write.withdraw([0n], { account: walletClients[1].account }),
        /Nu esti proprietarul/
      );
    });
  });
});
