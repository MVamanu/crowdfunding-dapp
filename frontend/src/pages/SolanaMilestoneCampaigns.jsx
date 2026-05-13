import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import "./MilestoneCampaigns.css";
import { SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../config/chains";

const SOL_PROGRAM_ID = SOLANA_PROGRAM_ID;

export default function SolanaMilestoneCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const dummyWallet = {
          publicKey: PublicKey.default,
          signTransaction: async t => t,
          signAllTransactions: async t => t
        };
        const provider = new anchor.AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
        anchor.setProvider(provider);
        const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, provider);
        if (idl) {
          const program = new anchor.Program(idl, provider);
          const accounts = await program.account.milestoneCampaign.all();
          setCampaigns(accounts.map(acc => ({
            id: acc.publicKey.toString(),
            ...acc.account,
            milestones: acc.account.milestones.slice(0, acc.account.milestoneCount),
          })));
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="milestone-list-page">
      <div className="container">
        <div className="milestone-list-header">
          <div>
            <div className="create-label">Solana — Milestone</div>
            <h1 className="section-title">Campanii Milestone Solana</h1>
            <div className="divider"></div>
            <p className="milestone-list-desc">Campanii cu finantare etapizata pe Solana. Fondurile SOL sunt eliberate prin vot.</p>
          </div>
          <Link to="/create-solana-milestone" className="btn-gold">+ Campanie Noua</Link>
        </div>

        {loading ? (
          <div className="loading-state"><div className="loading-spinner"></div><p>Se incarca de pe Solana Devnet...</p></div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◇</div>
            <h3>Nicio campanie milestone Solana</h3>
            <p>Fii primul care lanseaza o campanie milestone pe Solana.</p>
            <Link to="/create-solana-milestone" className="btn-primary" style={{display:"inline-block", marginTop:"16px"}}>Creeaza prima campanie</Link>
          </div>
        ) : (
          <div className="campaigns-grid">
            {campaigns.map(c => {
              const progress = Math.min((Number(c.amountRaised) / Number(c.totalGoal)) * 100, 100);
              return (
                <Link to={`/solana-milestone/${c.id}`} key={c.id} className="milestone-card card">
                  <div className="milestone-card-header">
                    <span className="badge badge-sol">SOL</span>
                    <span className={`badge badge-${c.isActive ? "active" : "inactive"}`}>{c.isActive ? "Activa" : "Inchisa"}</span>
                    <span className="milestone-progress-badge">{c.currentMilestone}/{c.milestoneCount} etape</span>
                  </div>
                  <h3 className="card-title">{c.title}</h3>
                  <div className="divider"></div>
                  <p className="card-desc">{c.description?.slice(0, 100)}{c.description?.length > 100 ? "..." : ""}</p>
                  <div className="milestone-steps">
                    {Array.from({length: c.milestoneCount}).map((_, i) => (
                      <div key={i} className={`milestone-step ${i < c.currentMilestone ? "done" : i === c.currentMilestone ? "active" : ""}`}></div>
                    ))}
                  </div>
                  <div className="card-stats">
                    <div>
                      <span className="stat-value">{progress.toFixed(1)}%</span>
                      <span className="stat-label">funded</span>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <span className="stat-value">{(Number(c.amountRaised) / 1e9).toFixed(4)} SOL</span>
                      <span className="stat-label">raised</span>
                    </div>
                  </div>
                  <div className="card-owner">
                    <span className="owner-label">by</span>
                    <span className="owner-addr">{c.owner?.toString().slice(0,6)}...{c.owner?.toString().slice(-4)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
