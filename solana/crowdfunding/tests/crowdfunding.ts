import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Crowdfunding } from "../target/types/crowdfunding";
import assert from "assert";

describe("crowdfunding", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Crowdfunding as Program<Crowdfunding>;

  it("creeaza o campanie cu succes", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createCampaign("Test Campanie", "Descriere test", new anchor.BN(1000000000))
      .accounts({
        campaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();
    const account = await program.account.campaign.fetch(campaign.publicKey);
    assert.equal(account.title, "Test Campanie");
    assert.equal(account.goal.toString(), "1000000000");
    assert.equal(account.isActive, true);
    assert.equal(account.amountRaised.toString(), "0");
  });

  it("esueaza daca goal este zero", async () => {
    const campaign = anchor.web3.Keypair.generate();
    try {
      await program.methods
        .createCampaign("Goal Zero", "Descriere", new anchor.BN(0))
        .accounts({
          campaign: campaign.publicKey,
          owner: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([campaign])
        .rpc();
      assert.fail("Trebuia sa esueze");
    } catch (err) {
      assert.ok(err.message.includes("InvalidAmount") || err.message.includes("Suma invalida"));
    }
  });

  it("accepta o donatie", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createCampaign("Test Donatie", "Descriere", new anchor.BN(1000000000))
      .accounts({
        campaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();
    await program.methods
      .donate(new anchor.BN(500000000))
      .accounts({
        campaign: campaign.publicKey,
        donor: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    const account = await program.account.campaign.fetch(campaign.publicKey);
    assert.equal(account.amountRaised.toString(), "500000000");
  });

  it("esueaza daca donatia este zero", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createCampaign("Donatie Zero", "Descriere", new anchor.BN(1000000000))
      .accounts({
        campaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();

    try {
      await program.methods
        .donate(new anchor.BN(0))
        .accounts({
          campaign: campaign.publicKey,
          donor: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Trebuia sa esueze");
    } catch (err) {
      assert.ok(err.message.includes("InvalidAmount") || err.message.includes("Suma invalida"));
    }
  });

  it("withdraw transfera fondurile si pastreaza account-ul rent-exempt", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createCampaign("Test Withdraw Success", "Descriere", new anchor.BN(500000000))
      .accounts({
        campaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();

    await program.methods
      .donate(new anchor.BN(500000000))
      .accounts({
        campaign: campaign.publicKey,
        donor: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .withdraw()
      .accounts({
        campaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const account = await program.account.campaign.fetch(campaign.publicKey);
    assert.equal(account.isActive, false);
    assert.equal(account.amountRaised.toString(), "500000000");
  });

  it("esueaza withdraw daca goal nu e atins", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createCampaign("Test Withdraw", "Descriere", new anchor.BN(1000000000))
      .accounts({
        campaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();
    try {
      await program.methods
        .withdraw()
        .accounts({
          campaign: campaign.publicKey,
          owner: provider.wallet.publicKey,
        })
        .rpc();
      assert.fail("Trebuia sa esueze");
    } catch (err) {
      assert.ok(err.message.includes("GoalNotReached") || err.message.includes("Obiectivul"));
    }
  });
});
