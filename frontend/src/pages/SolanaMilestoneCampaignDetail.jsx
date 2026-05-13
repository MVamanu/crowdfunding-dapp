import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import ConnectWalletModal from "../components/ConnectWalletModal";
import "./MilestoneCampaignDetail.css";
import { SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../config/chains";

const SOL_PROGRAM_ID = SOLANA_PROGRAM_ID;
const textEncoder = new TextEncoder();

export default function SolanaMilestoneCampaignDetail({ solWallet, solConnected, solAddress, onConnectEth, onConnectSol, onConnectSolflare }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [donating, setDonating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);

  async function getProgram(wallet) {
    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    const w = wallet || { publicKey: PublicKey.default, signTransaction: async t => t, signAllTransactions: async t => t };
    const provider = new anchor.AnchorProvider(connection, w, { commitment: "confirmed" });
    anchor.setProvider(provider);
    const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, provider);
    return new anchor.Program(idl, provider);
  }

  async function loadData() {
    try {
      const program = await getProgram(null);
      const pubkey = new PublicKey(id);
      const acc = await program.account.milestoneCampaign.fetch(pubkey);
      setCampaign({
        id, pubkey,
        owner: acc.owner.toString(),
        title: acc.title,
        description: acc.description,
        totalGoal: acc.totalGoal,
        amountRaised: acc.amountRaised,
        isActive: acc.isActive,
        currentMilestone: acc.currentMilestone,
        milestoneCount: acc.milestoneCount,
        milestones: acc.milestones.slice(0, acc.milestoneCount),
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [id]);

  async function handleDonate() {
    setError(""); setSuccess("");
    if (!solWallet) { setShowModal(true); return; }
    if (!amount || Number(amount) <= 0) { setError("Introdu o suma valida."); return; }
    setDonating(true);
    try {
      const program = await getProgram(solWallet);
      const campaignPubkey = new PublicKey(id);
      const lamports = new anchor.BN(parseFloat(amount) * 1e9);
      const [donorPDA] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("donor"), campaignPubkey.toBuffer(), solWallet.publicKey.toBuffer()],
        SOL_PROGRAM_ID
      );
      await program.methods.donateMilestone(lamports)
        .accounts({
          milestoneCampaign: campaignPubkey,
          donor: solWallet.publicKey,
          donorAccount: donorPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      setSuccess("Donatie efectuata cu succes!");
      setAmount("");
      await loadData();
    } catch (e) { setError(e.message || "Tranzactie esuata."); }
    setDonating(false);
  }

  async function handleSubmitMilestone() {
    setError(""); setSuccess("");
    setSubmitting(true);
    try {
      const program = await getProgram(solWallet);
      const campaignPubkey = new PublicKey(id);
      await program.methods.submitMilestone()
        .accounts({ milestoneCampaign: campaignPubkey, owner: solWallet.publicKey })
        .rpc();
      setSuccess("Milestone submis pentru vot!");
      await loadData();
    } catch (e) { setError(e.message || "Eroare."); }
    setSubmitting(false);
  }

  async function handleVote(milestoneIdx, approve) {
    setError(""); setSuccess("");
    setVoting(true);
    try {
      const program = await getProgram(solWallet);
      const campaignPubkey = new PublicKey(id);
      const [donorPDA] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("donor"), campaignPubkey.toBuffer(), solWallet.publicKey.toBuffer()],
        SOL_PROGRAM_ID
      );
      const [votePDA] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("vote"), campaignPubkey.toBuffer(), solWallet.publicKey.toBuffer(), Uint8Array.of(milestoneIdx)],
        SOL_PROGRAM_ID
      );
      await program.methods.voteMilestone(milestoneIdx, approve)
        .accounts({
          milestoneCampaign: campaignPubkey,
          voter: solWallet.publicKey,
          donorAccount: donorPDA,
          voteRecord: votePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      setSuccess(approve ? "Ai votat pentru aprobare!" : "Ai votat pentru respingere!");
      await loadData();
    } catch (e) { setError(e.message || "Eroare vot."); }
    setVoting(false);
  }

  async function handleFinalize(milestoneIdx) {
    setError(""); setSuccess("");
    try {
      const program = await getProgram(solWallet);
      const campaignPubkey = new PublicKey(id);
      await program.methods.finalizeMilestone(milestoneIdx)
        .accounts({ milestoneCampaign: campaignPubkey, owner: solWallet.publicKey })
        .rpc();
      setSuccess("Milestone finalizat!");
      await loadData();
    } catch (e) { setError(e.message || "Eroare finalizare."); }
  }

  if (loading) return <div className="detail-loading"><div className="loading-spinner"></div><p>Se incarca...</p></div>;
  if (!campaign) return <div className="detail-loading"><p>Campanie negasita.</p></div>;

  const progress = Math.min((Number(campaign.amountRaised) / Number(campaign.totalGoal)) * 100, 100);
  const goalSol = (Number(campaign.totalGoal) / 1e9).toFixed(4);
  const raisedSol = (Number(campaign.amountRaised) / 1e9).toFixed(4);
  const isOwner = solAddress === campaign.owner;
  const goalReached = Number(campaign.amountRaised) >= Number(campaign.totalGoal);
  const currentM = campaign.milestones[campaign.currentMilestone];
  const isConnected = solConnected || !!solWallet;

  return (
    <div className="detail-page">
      {showModal && <ConnectWalletModal onClose={() => setShowModal(false)} onConnectEth={onConnectEth} onConnectSol={() => { onConnectSol(); setShowModal(false); }} onConnectSolflare={() => { onConnectSolflare(); setShowModal(false); }} />}
      <div className="container">
        <button className="back-btn" onClick={() => navigate("/solana-milestones")}>Back to SOL Milestones</button>
        <div className="detail-layout">
          <div className="detail-main">
            <div className="detail-badges">
              <span className="badge badge-sol">SOL</span>
              <span className="badge" style={{background:"rgba(153,69,255,0.15)", color:"#9945ff"}}>MILESTONE</span>
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
                <div><span className="progress-raised">{raisedSol} SOL</span><span className="progress-label"> strans din {goalSol} SOL</span></div>
                <span className="progress-pct">{progress.toFixed(1)}%</span>
              </div>
              <div className="progress-bar" style={{height:"10px", margin:"16px 0"}}><div className="progress-fill" style={{width:`${progress}%`}}></div></div>
              <div className="progress-stats">
                <div className="pstat"><span className="pstat-value">{raisedSol} SOL</span><span className="pstat-label">Strans</span></div>
                <div className="pstat"><span className="pstat-value">{goalSol} SOL</span><span className="pstat-label">Goal</span></div>
                <div className="pstat"><span className="pstat-value">{campaign.currentMilestone}/{campaign.milestoneCount}</span><span className="pstat-label">Etape</span></div>
              </div>
            </div>
            <div className="milestones-timeline">
              <h3 className="milestones-title">Etape Campanie</h3>
              {campaign.milestones.map((m, i) => (
                <div key={i} className={`timeline-item ${m.completed && m.approved ? "approved" : m.votingActive ? "voting" : i === campaign.currentMilestone ? "current" : ""}`}>
                  <div className="timeline-marker">{m.completed && m.approved ? "OK" : m.votingActive ? "?" : i + 1}</div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <h4 className="timeline-title">{m.title}</h4>
                      <span className="timeline-amount">{(Number(m.amount) / 1e9).toFixed(4)} SOL</span>
                    </div>
                    <p className="timeline-desc">{m.description}</p>
                    {m.votingActive && (
                      <div className="voting-panel">
                        <div className="voting-stats">
                          <div className="vote-bar-wrap">
                            <div className="vote-bar-for" style={{width: Number(m.votesFor) + Number(m.votesAgainst) > 0 ? `${Number(m.votesFor) * 100 / (Number(m.votesFor) + Number(m.votesAgainst))}%` : "0%"}}></div>
                          </div>
                          <div className="vote-numbers">
                            <span className="vote-for">Pentru: {(Number(m.votesFor) / 1e9).toFixed(4)} SOL</span>
                            <span className="vote-against">Contra: {(Number(m.votesAgainst) / 1e9).toFixed(4)} SOL</span>
                          </div>
                        </div>
                        {isConnected && (
                          <div className="vote-actions">
                            <button className="vote-btn approve" onClick={() => handleVote(i, true)} disabled={voting}>Aproba</button>
                            <button className="vote-btn reject" onClick={() => handleVote(i, false)} disabled={voting}>Respinge</button>
                          </div>
                        )}
                        {isOwner && <button className="finalize-btn" onClick={() => handleFinalize(i)}>Finalizeaza votul</button>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="detail-sidebar">
            {campaign.isActive && (
              <div className="donate-card card">
                <h3 className="donate-title">Sustine aceasta campanie</h3>
                <p className="donate-desc">Doneaza SOL - fondurile sunt eliberate etapizat prin vot.</p>
                <div className="donate-input-wrap">
                  <input className="form-input donate-input" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                  <span className="donate-currency">SOL</span>
                </div>
                <div className="donate-presets">
                  {["0.01","0.05","0.1"].map(v => (
                    <button key={v} className="preset-btn" onClick={() => setAmount(v)}>{v} SOL</button>
                  ))}
                </div>
                {error && <div className="form-error">{error}</div>}
                {success && <div className="form-success">{success}</div>}
                <button className="btn-gold donate-btn" onClick={handleDonate} disabled={donating}>
                  {donating ? "Se proceseaza..." : isConnected ? "Doneaza SOL" : "Conecteaza si Doneaza"}
                </button>
              </div>
            )}
            {isOwner && campaign.isActive && goalReached && currentM && !currentM.votingActive && !currentM.completed && (
              <div className="withdraw-card card">
                <h3 className="withdraw-title">Etapa {campaign.currentMilestone + 1} gata?</h3>
                <p>Submite milestone-ul pentru aprobare prin vot.</p>
                <button className="btn-primary withdraw-btn" onClick={handleSubmitMilestone} disabled={submitting}>
                  {submitting ? "Se proceseaza..." : "Submite Milestone"}
                </button>
              </div>
            )}
            <div className="contract-card card">
              <h4 className="contract-title">Program Info</h4>
              <div className="contract-item"><span className="contract-label">Network</span><span className="contract-value">Solana Devnet</span></div>
              <div className="contract-item"><span className="contract-label">Etapa curenta</span><span className="contract-value">{campaign.currentMilestone + 1}/{campaign.milestoneCount}</span></div>
              <div className="contract-item">
                <span className="contract-label">Explorer</span>
                <a href={`https://explorer.solana.com/address/${id}?cluster=devnet`} target="_blank" rel="noreferrer" style={{color:"var(--gold)", fontSize:"11px"}}>View on Solana Explorer</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
