import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("CrowdfundingStableMilestoneV2", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();

  const milestoneTitles = ["Prototype", "Audit", "Launch"];
  const milestoneDescs = ["Build MVP", "Security review", "Public release"];
  const milestoneAmounts = [30_000_000n, 30_000_000n, 40_000_000n];
  const totalGoal = 100_000_000n;

  async function deployAll() {
    const usdc = await viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
    const contract = await viem.deployContract("CrowdfundingStableMilestoneV2", [usdc.address]);
    return { usdc, contract };
  }

  async function createCampaign(contract) {
    await contract.write.createCampaign([
      "USDC Milestone",
      "Cross-chain milestone campaign",
      30n,
      "eth",
      ["eth", "sol"],
      ["", "SolanaProgram"],
      milestoneTitles,
      milestoneDescs,
      milestoneAmounts,
    ]);
  }

  it("creeaza campanie USDC cross-chain cu milestone-uri", async function () {
    const { contract } = await deployAll();
    await createCampaign(contract);

    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.title, "USDC Milestone");
    assert.equal(campaign.mainChain, "eth");
    assert.equal(campaign.totalGoal, totalGoal);
    assert.equal(campaign.milestoneCount, 3n);
    assert.equal(campaign.currentMilestone, 0n);
    assert.equal(campaign.goalReached, false);

    const milestone = await contract.read.getMilestone([0n, 1n]);
    assert.equal(milestone.title, "Audit");
    assert.equal(milestone.amount, 30_000_000n);
  });

  it("accepta donatii USDC locale si marcheaza goalul", async function () {
    const { usdc, contract } = await deployAll();
    await createCampaign(contract);

    await usdc.write.mint([walletClients[1].account.address, totalGoal]);
    await usdc.write.approve([contract.address, totalGoal], {
      account: walletClients[1].account,
    });
    await contract.write.donateLocal([0n, totalGoal], {
      account: walletClients[1].account,
    });

    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.amountRaisedLocal, totalGoal);
    assert.equal(campaign.amountRaisedExternal, 0n);
    assert.equal(campaign.goalReached, true);
    assert.equal(await contract.read.getVotingPower([0n, walletClients[1].account.address]), totalGoal);
  });

  it("inregistreaza donatie externa Solana cu putere de vot", async function () {
    const { contract } = await deployAll();
    await createCampaign(contract);

    await contract.write.recordExternalDonation([
      0n,
      walletClients[2].account.address,
      40_000_000n,
      "sol",
    ]);

    const campaign = await contract.read.getCampaign([0n]);
    assert.equal(campaign.amountRaisedExternal, 40_000_000n);
    assert.equal(await contract.read.getExternalDonations([0n, "sol"]), 40_000_000n);
    assert.equal(await contract.read.getVotingPower([0n, walletClients[2].account.address]), 40_000_000n);
  });

  it("elibereaza USDC etapizat dupa votul milestone-ului curent", async function () {
    const { usdc, contract } = await deployAll();
    await createCampaign(contract);

    await usdc.write.mint([walletClients[1].account.address, 70_000_000n]);
    await usdc.write.approve([contract.address, 70_000_000n], {
      account: walletClients[1].account,
    });
    await contract.write.donateLocal([0n, 70_000_000n], {
      account: walletClients[1].account,
    });
    await contract.write.recordExternalDonation([
      0n,
      walletClients[2].account.address,
      30_000_000n,
      "sol",
    ]);

    await contract.write.submitMilestone([0n]);
    await contract.write.vote([0n, 0n, true], {
      account: walletClients[1].account,
    });
    await contract.write.vote([0n, 0n, true], {
      account: walletClients[2].account,
    });

    const ownerBalanceBefore = await usdc.read.balanceOf([walletClients[0].account.address]);
    await contract.write.finalizeMilestone([0n, 0n]);
    const ownerBalanceAfter = await usdc.read.balanceOf([walletClients[0].account.address]);

    const campaign = await contract.read.getCampaign([0n]);
    const milestone = await contract.read.getMilestone([0n, 0n]);
    assert.equal(ownerBalanceAfter - ownerBalanceBefore, 30_000_000n);
    assert.equal(campaign.currentMilestone, 1n);
    assert.equal(campaign.isActive, true);
    assert.equal(milestone.approved, true);
  });

  it("permite overfunding si elibereaza surplusul local la ultimul milestone", async function () {
    const { usdc, contract } = await deployAll();
    await createCampaign(contract);

    await usdc.write.mint([walletClients[1].account.address, 150_000_000n]);
    await usdc.write.approve([contract.address, 150_000_000n], {
      account: walletClients[1].account,
    });
    await contract.write.donateLocal([0n, 150_000_000n], {
      account: walletClients[1].account,
    });

    const ownerBalanceBefore = await usdc.read.balanceOf([walletClients[0].account.address]);

    for (let milestoneId = 0n; milestoneId < 3n; milestoneId++) {
      await contract.write.submitMilestone([0n]);
      await contract.write.vote([0n, milestoneId, true], {
        account: walletClients[1].account,
      });
      await contract.write.finalizeMilestone([0n, milestoneId]);
    }

    const ownerBalanceAfter = await usdc.read.balanceOf([walletClients[0].account.address]);
    const campaign = await contract.read.getCampaign([0n]);
    const released = await contract.read.releasedLocal([0n]);
    assert.equal(ownerBalanceAfter - ownerBalanceBefore, 150_000_000n);
    assert.equal(released, 150_000_000n);
    assert.equal(campaign.isActive, false);
    assert.equal(campaign.currentMilestone, 3n);
  });

  it("nu esueaza release-ul daca goalul include donatii externe mai mari decat localul", async function () {
    const { usdc, contract } = await deployAll();
    await createCampaign(contract);

    await usdc.write.mint([walletClients[1].account.address, 20_000_000n]);
    await usdc.write.approve([contract.address, 20_000_000n], {
      account: walletClients[1].account,
    });
    await contract.write.donateLocal([0n, 20_000_000n], {
      account: walletClients[1].account,
    });
    await contract.write.recordExternalDonation([
      0n,
      walletClients[2].account.address,
      80_000_000n,
      "sol",
    ]);

    await contract.write.submitMilestone([0n]);
    await contract.write.vote([0n, 0n, true], {
      account: walletClients[1].account,
    });
    await contract.write.vote([0n, 0n, true], {
      account: walletClients[2].account,
    });

    const ownerBalanceBefore = await usdc.read.balanceOf([walletClients[0].account.address]);
    await contract.write.finalizeMilestone([0n, 0n]);
    const ownerBalanceAfter = await usdc.read.balanceOf([walletClients[0].account.address]);
    const released = await contract.read.releasedLocal([0n]);
    assert.equal(ownerBalanceAfter - ownerBalanceBefore, 20_000_000n);
    assert.equal(released, 20_000_000n);
  });

  it("respinge milestone-ul daca voturile contra castiga", async function () {
    const { usdc, contract } = await deployAll();
    await createCampaign(contract);

    await usdc.write.mint([walletClients[1].account.address, totalGoal]);
    await usdc.write.approve([contract.address, totalGoal], {
      account: walletClients[1].account,
    });
    await contract.write.donateLocal([0n, totalGoal], {
      account: walletClients[1].account,
    });

    await contract.write.submitMilestone([0n]);
    await contract.write.vote([0n, 0n, false], {
      account: walletClients[1].account,
    });
    await contract.write.finalizeMilestone([0n, 0n]);

    const campaign = await contract.read.getCampaign([0n]);
    const milestone = await contract.read.getMilestone([0n, 0n]);
    assert.equal(campaign.currentMilestone, 0n);
    assert.equal(milestone.approved, false);
    assert.equal(milestone.completed, false);
  });

  it("valideaza inputurile campaniei", async function () {
    const { contract } = await deployAll();

    await assert.rejects(
      contract.write.createCampaign([
        "Invalid",
        "Desc",
        30n,
        "eth",
        ["eth"],
        [""],
        ["Only one"],
        ["Desc"],
        [totalGoal],
      ]),
      /Minim 2 milestone-uri/
    );

    await assert.rejects(
      contract.write.createCampaign([
        "Invalid",
        "Desc",
        30n,
        "eth",
        ["eth"],
        [""],
        milestoneTitles,
        ["Only one"],
        milestoneAmounts,
      ]),
      /Date invalide/
    );

    await assert.rejects(
      contract.write.createCampaign([
        "Invalid",
        "Desc",
        30n,
        "eth",
        ["eth"],
        [""],
        milestoneTitles,
        milestoneDescs,
        [30_000_000n, 0n, 40_000_000n],
      ]),
      /Suma milestone invalida/
    );
  });

  it("restrictioneaza donatiile externe la owner si chain-uri acceptate", async function () {
    const { contract } = await deployAll();
    await createCampaign(contract);

    await assert.rejects(
      contract.write.recordExternalDonation([
        0n,
        walletClients[2].account.address,
        10_000_000n,
        "sol",
      ], {
        account: walletClients[1].account,
      }),
      /Nu esti proprietarul/
    );

    await assert.rejects(
      contract.write.recordExternalDonation([
        0n,
        walletClients[2].account.address,
        10_000_000n,
        "polygon",
      ]),
      /Chain neacceptat/
    );
  });

  it("nu permite finalizarea de catre non-owner sau milestone gresit", async function () {
    const { usdc, contract } = await deployAll();
    await createCampaign(contract);

    await usdc.write.mint([walletClients[1].account.address, totalGoal]);
    await usdc.write.approve([contract.address, totalGoal], {
      account: walletClients[1].account,
    });
    await contract.write.donateLocal([0n, totalGoal], {
      account: walletClients[1].account,
    });
    await contract.write.submitMilestone([0n]);
    await contract.write.vote([0n, 0n, true], {
      account: walletClients[1].account,
    });

    await assert.rejects(
      contract.write.finalizeMilestone([0n, 0n], {
        account: walletClients[1].account,
      }),
      /Nu esti proprietarul/
    );

    await assert.rejects(
      contract.write.finalizeMilestone([0n, 1n]),
      /Milestone invalid/
    );
  });

  it("permite refund local daca deadline-ul trece fara goal", async function () {
    const { usdc, contract } = await deployAll();
    await createCampaign(contract);

    await usdc.write.mint([walletClients[1].account.address, 10_000_000n]);
    await usdc.write.approve([contract.address, 10_000_000n], {
      account: walletClients[1].account,
    });
    await contract.write.donateLocal([0n, 10_000_000n], {
      account: walletClients[1].account,
    });

    await publicClient.request({
      method: "evm_increaseTime",
      params: [31 * 24 * 60 * 60],
    });
    await publicClient.request({ method: "evm_mine", params: [] });

    const donorBefore = await usdc.read.balanceOf([walletClients[1].account.address]);
    await contract.write.refund([0n], {
      account: walletClients[1].account,
    });
    const donorAfter = await usdc.read.balanceOf([walletClients[1].account.address]);
    assert.equal(donorAfter - donorBefore, 10_000_000n);
  });
});
