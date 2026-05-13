import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { useCryptoPrices } from "../hooks/useCryptoPrices";
import "./AllCampaigns.css";
import { CONTRACTS, SEPOLIA_RPC_URL, SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../config/chains";

const CROSS_CONTRACT = CONTRACTS.crossMilestone;
const CROSS_ABI = ["function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goalUSD,uint256 amountRaisedETH,uint256 amountRaisedSOLusd,bool isActive,uint256 deadline,string solanaAddress,uint256 milestoneCount,uint256 currentMilestone,string primaryChain))", "function campaignCount() view returns (uint256)"];
const ETH_MILESTONE_ADDRESS = CONTRACTS.milestone;
const SEPOLIA_RPC = SEPOLIA_RPC_URL;
const SOL_PROGRAM_ID = SOLANA_PROGRAM_ID;
const ETH_MILESTONE_ABI = ["function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 totalGoal,uint256 amountRaised,bool isActive,uint256 deadline,uint256 milestoneCount,uint256 currentMilestone))", "function campaignCount() view returns (uint256)"];

export default function KickstartCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const { prices } = useCryptoPrices();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const all = [];
      const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);

      try {
        const contract = new ethers.Contract(ETH_MILESTONE_ADDRESS, ETH_MILESTONE_ABI, provider);
        const count = await contract.campaignCount();
        for (let i = 0; i < Number(count); i++) {
          const c = await contract.getCampaign(i);
          all.push({ id: i, title: c.title, description: c.description,
            raisedUSD: (Number(c.amountRaised) / 1e18) * prices.eth,
            goalUSD: (Number(c.totalGoal) / 1e18) * prices.eth,
            isActive: c.isActive, owner: c.owner, blockchain: "eth",
            milestoneCount: Number(c.milestoneCount),
            currentMilestone: Number(c.currentMilestone),
            route: `/milestone/${i}` });
        }
      } catch (e) { console.error(e); }

      try {
        const crossContract = new ethers.Contract(CROSS_CONTRACT, CROSS_ABI, provider);
        const crossCount = await crossContract.campaignCount();
        for (let i = 0; i < Number(crossCount); i++) {
          const c = await crossContract.getCampaign(i);
          const raisedUSD = (Number(c.amountRaisedETH) / 1e18) * prices.eth + Number(c.amountRaisedSOLusd);
          all.push({ id: `cross-ms-${i}`, title: c.title, description: c.description,
            raisedUSD, goalUSD: Number(c.goalUSD),
            isActive: c.isActive, owner: c.owner, blockchain: "cross",
            milestoneCount: Number(c.milestoneCount),
            currentMilestone: Number(c.currentMilestone),
            route: `/cross-milestone/${i}` });
        }
      } catch (e) { console.error(e); }

      try {
        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const dummyWallet = { publicKey: PublicKey.default, signTransaction: async t => t, signAllTransactions: async t => t };
        const prov = new anchor.AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
        anchor.setProvider(prov);
        const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, prov);
        if (idl) {
          const program = new anchor.Program(idl, prov);
          const accounts = await program.account.milestoneCampaign.all();
          for (const acc of accounts) {
            const d = acc.account;
            all.push({ id: acc.publicKey.toString(), title: d.title, description: d.description,
              raisedUSD: (Number(d.amountRaised) / 1e9) * prices.sol,
              goalUSD: (Number(d.totalGoal) / 1e9) * prices.sol,
              isActive: d.isActive, owner: d.owner.toString(), blockchain: "sol",
              milestoneCount: d.milestoneCount, currentMilestone: d.currentMilestone,
              route: `/solana-milestone/${acc.publicKey.toString()}` });
          }
        }
      } catch (e) { console.error(e); }

      setCampaigns(all);
      setLoading(false);
    }
    if (prices.eth > 0) load();
  }, [prices]);

  return (
    <div className="all-campaigns-page">
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-label">Kickstart - Milestone Funding</div>
            <h1 className="hero-title">Lanseaza Proiectul Tau<br/>cu Incredere.</h1>
            <div className="divider"></div>
            <p className="hero-desc">Campanii cu finantare etapizata. Fondurile sunt eliberate doar dupa aprobarea prin vot a fiecarei etape.</p>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><span className="hero-stat-value">{campaigns.length}</span><span className="hero-stat-label">Proiecte Active</span></div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat"><span className="hero-stat-value">${campaigns.reduce((s,c) => s + c.raisedUSD, 0).toFixed(0)}</span><span className="hero-stat-label">Total Strans</span></div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat"><span className="hero-stat-value">100%</span><span className="hero-stat-label">Transparent</span></div>
          </div>
        </div>
      </section>

      <section className="campaigns-section">
        <div className="container">
          <div className="section-header">
            <div><h2 className="section-title">Proiecte Kickstart</h2><div className="divider"></div></div>
            <div style={{display:"flex", gap:"12px"}}>
              <Link to="/create-milestone" className="btn-outline">+ ETH Milestone</Link>
              <Link to="/create-solana-milestone" className="btn-outline">+ SOL Milestone</Link>
              <Link to="/create-cross-milestone" className="btn-gold">+ Cross Milestone</Link>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="loading-spinner"></div><p>Se incarca...</p></div>
          ) : campaigns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">EMPTY</div>
              <h3>Niciun proiect Kickstart</h3>
              <p>Fii primul care lanseaza un proiect cu milestone-uri.</p>
              <div style={{display:"flex", gap:"12px", justifyContent:"center", marginTop:"24px"}}>
                <Link to="/create-milestone" className="btn-primary">Milestone ETH</Link>
                <Link to="/create-solana-milestone" className="btn-gold">Milestone SOL</Link>
              </div>
            </div>
          ) : (
            <div className="campaigns-grid">
              {campaigns.map(c => {
                const progress = Math.min(c.goalUSD > 0 ? (c.raisedUSD / c.goalUSD) * 100 : 0, 100);
                return (
                  <Link to={c.route} key={c.id} className="campaign-card card">
                    <div className="card-header">
                      <div className="card-badges">
                        <span className={`badge badge-${c.blockchain}`}>{c.blockchain.toUpperCase()}</span>
                        <span className="badge" style={{background:"rgba(201,168,76,0.15)", color:"var(--gold)"}}>MILESTONE</span>
                        <span className={`badge badge-${c.isActive ? "active" : "inactive"}`}>{c.isActive ? "Activ" : "Inchis"}</span>
                      </div>
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">{c.title}</h3>
                      <div className="divider"></div>
                      <p className="card-desc">{c.description?.slice(0,100)}{c.description?.length > 100 ? "..." : ""}</p>
                    </div>
                    <div className="card-footer">
                      <div className="progress-bar"><div className="progress-fill" style={{width:`${progress}%`}}></div></div>
                      <div className="milestone-steps" style={{margin:"8px 0 4px"}}>
                        {Array.from({length: c.milestoneCount}).map((_, i) => (
                          <div key={i} className={`milestone-step ${i < c.currentMilestone ? "done" : i === c.currentMilestone ? "active" : ""}`}></div>
                        ))}
                      </div>
                      <div className="card-stats">
                        <div><span className="stat-value">{c.currentMilestone}/{c.milestoneCount}</span><span className="stat-label">etape</span></div>
                        <div style={{textAlign:"right"}}><span className="stat-value">${c.raisedUSD.toFixed(2)}</span><span className="stat-label">of ${c.goalUSD.toFixed(2)} USD</span></div>
                      </div>
                      <div className="card-owner"><span className="owner-label">by</span><span className="owner-addr">{c.owner?.slice(0,6)}...{c.owner?.slice(-4)}</span></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
