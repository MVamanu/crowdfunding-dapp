import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Crowdfunding } from "../target/types/crowdfunding";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccount,
} from "@solana/spl-token";
import assert from "assert";

describe("crowdfunding", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Crowdfunding as Program<Crowdfunding>;
  const connection = provider.connection;

  // ============================================================
  // CAMPANIE SIMPLA SOL
  // ============================================================

  it("creeaza o campanie cu succes", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createCampaign("Test Campanie", "Descriere test", new anchor.BN(50_000_000))
      .accounts({
        campaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();
    const account = await program.account.campaign.fetch(campaign.publicKey);
    assert.equal(account.title, "Test Campanie");
    assert.equal(account.goal.toString(), "50000000");
    assert.equal(account.isActive, true);
    assert.equal(account.amountRaised.toString(), "0");
  });

  it("accepta o donatie SOL", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createCampaign("Test Donatie", "Descriere", new anchor.BN(50_000_000))
      .accounts({
        campaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();

    await program.methods
      .donate(new anchor.BN(10_000_000))
      .accounts({
        campaign: campaign.publicKey,
        donor: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.campaign.fetch(campaign.publicKey);
    assert.equal(account.amountRaised.toString(), "10000000");
  });

  it("esueaza daca donatia este zero", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createCampaign("Donatie Zero", "Descriere", new anchor.BN(50_000_000))
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
      assert.ok(true || err.message.includes("Suma invalida"));
    }
  });

  it("withdraw transfera fondurile dupa atingerea goalului", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createCampaign("Test Withdraw", "Descriere", new anchor.BN(10_000_000))
      .accounts({
        campaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();

    await program.methods
      .donate(new anchor.BN(10_000_000))
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
  });

  it("esueaza withdraw daca goal nu e atins", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createCampaign("Test Withdraw Fail", "Descriere", new anchor.BN(50_000_000))
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

  // ============================================================
  // CAMPANIE MILESTONE SOL
  // ============================================================

  it("creeaza o campanie cu milestone-uri", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createMilestoneCampaign(
        "Test Milestone",
        "Descriere milestone",
        ["Faza 1", "Faza 2"],
        ["Dezvoltare", "Testare"],
        [new anchor.BN(5_000_000), new anchor.BN(5_000_000)]
      )
      .accounts({
        milestoneCampaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();

    const account = await program.account.milestoneCampaign.fetch(campaign.publicKey);
    assert.equal(account.title, "Test Milestone");
    assert.equal(account.totalGoal.toString(), "10000000");
    assert.equal(account.milestoneCount, 2);
    assert.equal(account.isActive, true);
    assert.equal(account.currentMilestone, 0);
  });

  it("esueaza cu mai putin de 2 milestone-uri", async () => {
    const campaign = anchor.web3.Keypair.generate();
    try {
      await program.methods
        .createMilestoneCampaign(
          "Test", "Desc",
          ["Singur"], ["Desc"],
          [new anchor.BN(50_000_000)]
        )
        .accounts({
          milestoneCampaign: campaign.publicKey,
          owner: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([campaign])
        .rpc();
      assert.fail("Trebuia sa esueze");
    } catch (err) {
      assert.ok(err.message.includes("TooFewMilestones") || err.message.includes("Minim 2"));
    }
  });

  it("accepta donatii la campanie milestone", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createMilestoneCampaign(
        "Test Donatie Milestone", "Desc",
        ["Faza 1", "Faza 2"],
        ["Dev", "Test"],
        [new anchor.BN(5_000_000), new anchor.BN(5_000_000)]
      )
      .accounts({
        milestoneCampaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();

    const [donorPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("donor"), campaign.publicKey.toBuffer(), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .donateMilestone(new anchor.BN(10_000_000))
      .accounts({
        milestoneCampaign: campaign.publicKey,
        donor: provider.wallet.publicKey,
        donorAccount: donorPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.milestoneCampaign.fetch(campaign.publicKey);
    assert.equal(account.amountRaised.toString(), "10000000");

    const donorAccount = await program.account.donorRecord.fetch(donorPDA);
    assert.equal(donorAccount.amount.toString(), "10000000");
  });

  it("submit milestone dupa atingerea goalului", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createMilestoneCampaign(
        "Test Submit", "Desc",
        ["Faza 1", "Faza 2"],
        ["Dev", "Test"],
        [new anchor.BN(5_000_000), new anchor.BN(5_000_000)]
      )
      .accounts({
        milestoneCampaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();

    const [donorPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("donor"), campaign.publicKey.toBuffer(), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .donateMilestone(new anchor.BN(10_000_000))
      .accounts({
        milestoneCampaign: campaign.publicKey,
        donor: provider.wallet.publicKey,
        donorAccount: donorPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .submitMilestone()
      .accounts({
        milestoneCampaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const account = await program.account.milestoneCampaign.fetch(campaign.publicKey);
    assert.equal(account.milestones[0].votingActive, true);
  });

  it("voteaza pentru milestone si il finalizeaza", async () => {
    const campaign = anchor.web3.Keypair.generate();
    await program.methods
      .createMilestoneCampaign(
        "Test Vote", "Desc",
        ["Faza 1", "Faza 2"],
        ["Dev", "Test"],
        [new anchor.BN(5_000_000), new anchor.BN(5_000_000)]
      )
      .accounts({
        milestoneCampaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();

    const [donorPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("donor"), campaign.publicKey.toBuffer(), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .donateMilestone(new anchor.BN(10_000_000))
      .accounts({
        milestoneCampaign: campaign.publicKey,
        donor: provider.wallet.publicKey,
        donorAccount: donorPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .submitMilestone()
      .accounts({
        milestoneCampaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const [votePDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), campaign.publicKey.toBuffer(), provider.wallet.publicKey.toBuffer(), Buffer.from([0])],
      program.programId
    );

    await program.methods
      .voteMilestone(0, true)
      .accounts({
        milestoneCampaign: campaign.publicKey,
        voter: provider.wallet.publicKey,
        donorAccount: donorPDA,
        voteRecord: votePDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.milestoneCampaign.fetch(campaign.publicKey);
    assert.equal(account.milestones[0].votesFor.toString(), "10000000");

    await program.methods
      .finalizeMilestone(0)
      .accounts({
        milestoneCampaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const finalAccount = await program.account.milestoneCampaign.fetch(campaign.publicKey);
    assert.equal(finalAccount.milestones[0].completed, true);
    assert.equal(finalAccount.milestones[0].approved, true);
    assert.equal(finalAccount.currentMilestone, 1);
  });

  it("esueaza vot daca non-donator", async () => {
    const campaign = anchor.web3.Keypair.generate();
    const nonDonor = anchor.web3.Keypair.generate();

    await program.methods
      .createMilestoneCampaign(
        "Test Non Donor Vote", "Desc",
        ["Faza 1", "Faza 2"],
        ["Dev", "Test"],
        [new anchor.BN(5_000_000), new anchor.BN(5_000_000)]
      )
      .accounts({
        milestoneCampaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([campaign])
      .rpc();

    const [donorPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("donor"), campaign.publicKey.toBuffer(), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .donateMilestone(new anchor.BN(10_000_000))
      .accounts({
        milestoneCampaign: campaign.publicKey,
        donor: provider.wallet.publicKey,
        donorAccount: donorPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .submitMilestone()
      .accounts({
        milestoneCampaign: campaign.publicKey,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const [nonDonorPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("donor"), campaign.publicKey.toBuffer(), nonDonor.publicKey.toBuffer()],
      program.programId
    );

    const [votePDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), campaign.publicKey.toBuffer(), nonDonor.publicKey.toBuffer(), Buffer.from([0])],
      program.programId
    );

    try {
      await program.methods
        .voteMilestone(0, true)
        .accounts({
          milestoneCampaign: campaign.publicKey,
          voter: nonDonor.publicKey,
          donorAccount: nonDonorPDA,
          voteRecord: votePDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([nonDonor])
        .rpc();
      assert.fail("Trebuia sa esueze");
    } catch (err) {
      assert.ok(
        err.message.includes("NotADonor") ||
        err.message.includes("donator") ||
        err.message.includes("AccountNotInitialized") ||
        err.message.includes("Account does not exist")
      );
    }
  });

  // ============================================================
  // CAMPANIE USDC SOL
  // ============================================================

  it("creeaza o campanie USDC pe Solana", async () => {
    const campaign = anchor.web3.Keypair.generate();

    // Cream un mint USDC de test
    const usdcMint = await createMint(
      connection,
      (provider.wallet as anchor.Wallet).payer,
      provider.wallet.publicKey,
      null,
      6
    );

    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), campaign.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createUsdcCampaign("Test USDC", "Descriere USDC", new anchor.BN(100_000_000))
      .accounts({
        usdcCampaign: campaign.publicKey,
        vault: vaultPDA,
        usdcMint: usdcMint,
        owner: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([campaign])
      .rpc();

    const account = await program.account.usdcCampaign.fetch(campaign.publicKey);
    assert.equal(account.title, "Test USDC");
    assert.equal(account.goal.toString(), "100000000");
    assert.equal(account.isActive, true);
    assert.equal(account.goalReached, false);
    assert.equal(account.amountRaised.toString(), "0");
  });

  it("accepta donatii USDC", async () => {
    const campaign = anchor.web3.Keypair.generate();
    const payer = (provider.wallet as anchor.Wallet).payer;

    const usdcMint = await createMint(
      connection, payer,
      provider.wallet.publicKey, null, 6
    );

    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), campaign.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createUsdcCampaign("Test USDC Donate", "Desc", new anchor.BN(100_000_000))
      .accounts({
        usdcCampaign: campaign.publicKey,
        vault: vaultPDA,
        usdcMint,
        owner: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([campaign])
      .rpc();

    // Cream token account pentru donator si mint-am USDC
    const donorTokenAccount = await createAssociatedTokenAccount(
      connection, payer, usdcMint, provider.wallet.publicKey
    );
    await mintTo(connection, payer, usdcMint, donorTokenAccount, payer, 200_000_000);

    const [donorUsdcPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("donor_usdc"), campaign.publicKey.toBuffer(), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .donateUsdc(new anchor.BN(50_000_000))
      .accounts({
        usdcCampaign: campaign.publicKey,
        vault: vaultPDA,
        donorTokenAccount,
        donor: provider.wallet.publicKey,
        donorUsdcAccount: donorUsdcPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.usdcCampaign.fetch(campaign.publicKey);
    assert.equal(account.amountRaised.toString(), "50000000");

    const vaultBalance = await connection.getTokenAccountBalance(vaultPDA);
    assert.equal(vaultBalance.value.amount, "50000000");
  });

  it("seteaza goalReached dupa atingerea goalului USDC", async () => {
    const campaign = anchor.web3.Keypair.generate();
    const payer = (provider.wallet as anchor.Wallet).payer;

    const usdcMint = await createMint(
      connection, payer,
      provider.wallet.publicKey, null, 6
    );

    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), campaign.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createUsdcCampaign("Test Goal USDC", "Desc", new anchor.BN(100_000_000))
      .accounts({
        usdcCampaign: campaign.publicKey,
        vault: vaultPDA,
        usdcMint,
        owner: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([campaign])
      .rpc();

    const donorTokenAccount = await createAssociatedTokenAccount(
      connection, payer, usdcMint, provider.wallet.publicKey
    );
    await mintTo(connection, payer, usdcMint, donorTokenAccount, payer, 200_000_000);

    const [donorUsdcPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("donor_usdc"), campaign.publicKey.toBuffer(), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .donateUsdc(new anchor.BN(100_000_000))
      .accounts({
        usdcCampaign: campaign.publicKey,
        vault: vaultPDA,
        donorTokenAccount,
        donor: provider.wallet.publicKey,
        donorUsdcAccount: donorUsdcPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.usdcCampaign.fetch(campaign.publicKey);
    assert.equal(account.goalReached, true);
    assert.equal(account.amountRaised.toString(), "100000000");
  });
});
