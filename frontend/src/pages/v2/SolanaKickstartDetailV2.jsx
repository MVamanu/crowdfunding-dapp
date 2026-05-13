import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import ConnectWalletModal from "../../components/ConnectWalletModal";
import "../CampaignDetail.css";
import "./V2.css";
import { SOLANA_PROGRAM_ID, SOLANA_RPC_URL, SPL_TOKEN_PROGRAM_ID, USDC } from "../../config/chains";
import { createAtaInstructionIfMissing } from "../../utils/solanaToken";

const textEncoder = new TextEncoder();

function formatUsdc(amount) {
  return (Number(amount) / 1_000_000).toFixed(2);
}

function toUsdcAmount(value) {
  return new anchor.BN(Math.round(Number(value) * 1_000_000));
}

export default function SolanaKickstartDetailV2({ solWallet, solConnected, solAddress, onConnectEth, onConnectSol, onConnectSolflare }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);

  async function getProgram(wallet) {
    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    const w = wallet || {
      publicKey: PublicKey.default,
      signTransaction: async tx => tx,
      signAllTransactions: async txs => txs,
    };
    const provider = new anchor.AnchorProvider(connection, w, { commitment: "confirmed" });
    const idl = await anchor.Program.fetchIdl(SOLANA_PROGRAM_ID, provider);
    if (!idl) throw new Error("Nu s-a putut obtine IDL-ul Solana.");
    return { connection, program: new anchor.Program(idl, provider) };
  }

  function getProgramMethod(program, methodName) {
    const method = program.methods[methodName];
    if (!method) {
      throw new Error(
        `IDL-ul Solana de pe devnet nu contine ${methodName}. Redeploy/upgrade programul si IDL-ul pentru campaniile USDC milestone pe Solana.`
      );
    }
    return method;
  }

  async function loadData() {
    setLoading(true);
    try {
      const { program } = await getProgram(null);
      const pubkey = new PublicKey(id);
      const account = await program.account.usdcMilestoneCampaign.fetch(pubkey);
      setCampaign({
        id,
        pubkey,
        owner: account.owner.toString(),
        title: account.title,
        description: account.description,
        totalGoal: account.totalGoal,
        amountRaised: account.amountRaised,
        releasedLocal: account.releasedLocal,
        isActive: account.isActive,
        goalReached: account.goalReached,
        vault: account.vault,
        usdcMint: account.usdcMint,
        currentMilestone: Number(account.currentMilestone),
        milestoneCount: Number(account.milestoneCount),
        milestones: account.milestones.slice(0, Number(account.milestoneCount)),
      });
    } catch (e) {
      console.error(e);
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => loadData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runAction(action, message) {
    setError("");
    setSuccess("");
    if (!solWallet) {
      setShowModal(true);
      return;
    }
    setBusy(true);
    try {
      await action();
      setSuccess(message);
      await loadData();
    } catch (e) {
      setError(e.message || "Tranzactie esuata.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDonate() {
    if (!amount || Number(amount) <= 0) {
      setError("Introdu o suma USDC valida.");
      return;
    }

    await runAction(async () => {
      const { connection, program } = await getProgram(solWallet);
      const campaignPubkey = new PublicKey(id);
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("usdc_milestone_vault"), campaignPubkey.toBuffer()],
        SOLANA_PROGRAM_ID
      );
      const [donorPDA] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("donor_usdc_milestone"), campaignPubkey.toBuffer(), solWallet.publicKey.toBuffer()],
        SOLANA_PROGRAM_ID
      );
      const { ata: donorTokenAccount, instruction } = await createAtaInstructionIfMissing(
        connection,
        solWallet.publicKey,
        solWallet.publicKey,
        USDC.solanaDevnetMint
      );

      const builder = getProgramMethod(program, "donateUsdcMilestone")(toUsdcAmount(amount))
        .accounts({
          usdcMilestoneCampaign: campaignPubkey,
          vault: vaultPDA,
          donorTokenAccount,
          donor: solWallet.publicKey,
          donorUsdcMilestoneAccount: donorPDA,
          tokenProgram: SPL_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        });

      if (instruction) builder.preInstructions([instruction]);
      await builder.rpc();
      setAmount("");
    }, "Donatie USDC pe Solana efectuata.");
  }

  async function handleSubmitMilestone() {
    await runAction(async () => {
      const { program } = await getProgram(solWallet);
      await getProgramMethod(program, "submitUsdcMilestone")()
        .accounts({
          usdcMilestoneCampaign: new PublicKey(id),
          owner: solWallet.publicKey,
        })
        .rpc();
    }, "Milestone trimis la vot.");
  }

  async function handleVote(approve) {
    await runAction(async () => {
      const { program } = await getProgram(solWallet);
      const campaignPubkey = new PublicKey(id);
      const milestoneIdx = campaign.currentMilestone;
      const [donorPDA] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("donor_usdc_milestone"), campaignPubkey.toBuffer(), solWallet.publicKey.toBuffer()],
        SOLANA_PROGRAM_ID
      );
      const [votePDA] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("vote_usdc_milestone"), campaignPubkey.toBuffer(), solWallet.publicKey.toBuffer(), Uint8Array.of(milestoneIdx)],
        SOLANA_PROGRAM_ID
      );
      await getProgramMethod(program, "voteUsdcMilestone")(milestoneIdx, approve)
        .accounts({
          usdcMilestoneCampaign: campaignPubkey,
          voter: solWallet.publicKey,
          donorUsdcMilestoneAccount: donorPDA,
          voteRecord: votePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }, approve ? "Vot pentru aprobare inregistrat." : "Vot contra inregistrat.");
  }

  async function handleFinalize() {
    await runAction(async () => {
      const { connection, program } = await getProgram(solWallet);
      const campaignPubkey = new PublicKey(id);
      const milestoneIdx = campaign.currentMilestone;
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("usdc_milestone_vault"), campaignPubkey.toBuffer()],
        SOLANA_PROGRAM_ID
      );
      const { ata: ownerTokenAccount, instruction } = await createAtaInstructionIfMissing(
        connection,
        solWallet.publicKey,
        solWallet.publicKey,
        USDC.solanaDevnetMint
      );
      const builder = getProgramMethod(program, "finalizeUsdcMilestone")(milestoneIdx)
        .accounts({
          usdcMilestoneCampaign: campaignPubkey,
          vault: vaultPDA,
          ownerTokenAccount,
          owner: solWallet.publicKey,
          tokenProgram: SPL_TOKEN_PROGRAM_ID,
        });

      if (instruction) builder.preInstructions([instruction]);
      await builder.rpc();
    }, "Milestone finalizat.");
  }

  if (loading) return <div className="detail-loading"><div className="loading-spinner"></div><p>Se incarca...</p></div>;
  if (!campaign) return <div className="detail-loading"><p>Campanie Solana negasita.</p></div>;

  const progress = Math.min(Number(campaign.totalGoal) > 0 ? (Number(campaign.amountRaised) / Number(campaign.totalGoal)) * 100 : 0, 100);
  const isOwner = solAddress === campaign.owner;
  const currentMilestone = campaign.milestones[campaign.currentMilestone];
  const canDonate = campaign.isActive;
  const canSubmit = isOwner && campaign.isActive && campaign.goalReached && currentMilestone && !currentMilestone.votingActive && !currentMilestone.completed;
  const canVote = solConnected && currentMilestone?.votingActive;

  return (
    <div className="detail-page">
      {showModal && (
        <ConnectWalletModal
          onClose={() => setShowModal(false)}
          onConnectEth={onConnectEth}
          onConnectSol={() => { onConnectSol(); setShowModal(false); }}
          onConnectSolflare={() => { onConnectSolflare(); setShowModal(false); }}
        />
      )}
      <div className="container">
        <button className="back-btn" onClick={() => navigate("/v2/kickstart")}>Back to Kickstart USDC</button>
        <div className="detail-layout">
          <div className="detail-main">
            <div className="detail-badges">
              <span className="badge badge-usdc">USDC</span>
              <span className="badge badge-sol">Solana</span>
              <span className="badge badge-active">Milestone</span>
              <span className={`badge badge-${campaign.isActive ? "active" : "inactive"}`}>{campaign.isActive ? "Activa" : "Inchisa"}</span>
            </div>
            <h1 className="detail-title">{campaign.title}</h1>
            <div className="divider"></div>
            <div className="detail-meta">
              <div className="meta-item"><span className="meta-label">Owner</span><span className="meta-value mono">{campaign.owner}</span></div>
              <div className="meta-item"><span className="meta-label">Network</span><span className="meta-value">Solana Devnet</span></div>
            </div>
            <div className="detail-description"><h3>Despre aceasta campanie</h3><p>{campaign.description}</p></div>

            <div className="detail-progress card">
              <div className="progress-header">
                <div>
                  <span className="progress-raised">${formatUsdc(campaign.amountRaised)} USDC</span>
                  <span className="progress-label"> strans din ${formatUsdc(campaign.totalGoal)} USDC</span>
                </div>
                <span className="progress-pct">{progress.toFixed(1)}%</span>
              </div>
              <div className="progress-bar v2-progress" style={{ height: "10px", margin: "16px 0" }}>
                <div className="progress-fill v2-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="progress-stats">
                <div className="pstat"><span className="pstat-value">${formatUsdc(campaign.amountRaised)}</span><span className="pstat-label">Vault USDC</span></div>
                <div className="pstat"><span className="pstat-value">${formatUsdc(campaign.releasedLocal)}</span><span className="pstat-label">Eliberat</span></div>
                <div className="pstat"><span className="pstat-value">{campaign.currentMilestone + 1}/{campaign.milestoneCount}</span><span className="pstat-label">Milestone</span></div>
              </div>
            </div>

            <div className="detail-progress card">
              <h3>Milestone-uri</h3>
              <div className="v2-milestones">
                {campaign.milestones.map((milestone, index) => (
                  <div key={index} className={index === campaign.currentMilestone ? "v2-milestone current" : "v2-milestone"}>
                    <div>
                      <strong>{index + 1}. {milestone.title}</strong>
                      <p>{milestone.description}</p>
                    </div>
                    <div className="v2-milestone-side">
                      <strong>${formatUsdc(milestone.amount)}</strong>
                      <span>{milestone.approved ? "Aprobat" : milestone.votingActive ? "La vot" : "In asteptare"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="detail-sidebar">
            {canDonate && (
              <div className="donate-card card">
                <h3 className="donate-title">Sustine cu USDC</h3>
                <div className="donate-input-wrap">
                  <input className="form-input donate-input" type="number" step="1" min="0" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
                  <span className="donate-currency">USDC</span>
                </div>
                <div className="donate-presets">
                  {[1, 2, 5].map(value => (
                    <button key={value} className="preset-btn" onClick={() => setAmount(value.toFixed(2))}>${value.toFixed(2)}</button>
                  ))}
                </div>
                <button className="btn-usdc donate-btn" style={{ width: "100%", justifyContent: "center" }} onClick={handleDonate} disabled={busy}>
                  {busy ? "Se proceseaza..." : "Doneaza USDC pe Solana"}
                </button>
              </div>
            )}

            {currentMilestone && (
              <div className="withdraw-card card">
                <h3 className="withdraw-title">Milestone curent</h3>
                <p>{currentMilestone.title}</p>
                <div className="milestone-votes">
                  <span>Pentru: ${formatUsdc(currentMilestone.votesFor)}</span>
                  <span>Contra: ${formatUsdc(currentMilestone.votesAgainst)}</span>
                </div>
                {canSubmit && <button className="btn-usdc" style={{ width: "100%", justifyContent: "center" }} onClick={handleSubmitMilestone} disabled={busy}>Trimite la vot</button>}
                {canVote && (
                  <div className="vote-actions">
                    <button className="btn-usdc" onClick={() => handleVote(true)} disabled={busy}>Aproba</button>
                    <button className="btn-usdc danger" onClick={() => handleVote(false)} disabled={busy}>Respinge</button>
                  </div>
                )}
                {isOwner && currentMilestone.votingActive && <button className="btn-usdc" style={{ width: "100%", justifyContent: "center", marginTop: "10px" }} onClick={handleFinalize} disabled={busy}>Finalizeaza</button>}
              </div>
            )}

            {error && <div className="form-error">{error}</div>}
            {success && <div className="form-success">{success}</div>}

            <div className="contract-card card">
              <h4 className="contract-title">Program Info</h4>
              <div className="contract-item"><span className="contract-label">Mint</span><span className="contract-value">USDC Devnet</span></div>
              <div className="contract-item"><span className="contract-label">Vault</span><span className="contract-value">{campaign.vault.toString().slice(0, 4)}...{campaign.vault.toString().slice(-4)}</span></div>
              <div className="contract-item">
                <span className="contract-label">Explorer</span>
                <a href={`https://explorer.solana.com/address/${id}?cluster=devnet`} target="_blank" rel="noreferrer" style={{ color: "#2775CA", fontSize: "11px" }}>View Campaign</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
