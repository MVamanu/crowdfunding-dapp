import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { useCryptoPrices } from "../hooks/useCryptoPrices";
import "./Home.css";
import "./AllCampaigns.css";
import "../components/CampaignCard.css";
import { CONTRACTS, SEPOLIA_RPC_URL, SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../config/chains";

const ETH_ADDRESS = CONTRACTS.eth;
const ETH_MILESTONE_ADDRESS = CONTRACTS.milestone;
const ETH_UNIFIED_ADDRESS = CONTRACTS.unified;
const SEPOLIA_RPC = SEPOLIA_RPC_URL;
const SOL_PROGRAM_ID = SOLANA_PROGRAM_ID;

const ETH_ABI = ["function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goal,uint256 amountRaised,bool isActive,uint256 deadline))", "function campaignCount() view returns (uint256)"];
const ETH_MILESTONE_ABI = ["function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 totalGoal,uint256 amountRaised,bool isActive,uint256 deadline,uint256 milestoneCount,uint256 currentMilestone))", "function campaignCount() view returns (uint256)"];
const ETH_UNIFIED_ABI = ["function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goalUSD,uint256 amountRaisedETH,bool isActive,uint256 deadline,string solanaAddress))", "function campaignCount() view returns (uint256)"];

export default function AllCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const { prices } = useCryptoPrices();

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const all = [];
      const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);

      try {
        const contract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
        const count = await contract.campaignCount();
        for (let i = 0; i < Number(count); i++) {
          const c = await contract.getCampaign(i);
          const raisedUSD = (Number(c.amountRaised) / 1e18) * prices.eth;
          const goalUSD = (Number(c.goal) / 1e18) * prices.eth;
          all.push({ id: i, title: c.title, description: c.description,
            raisedUSD, goalUSD, isActive: c.isActive, owner: c.owner,
            blockchain: "eth", type: "simple",
            route: `/campaign/eth/${i}`,
            deadline: new Date(Number(c.deadline) * 1000) });
        }
      } catch (e) { console.error("ETH simple:", e); }

      try {
        const contract = new ethers.Contract(ETH_MILESTONE_ADDRESS, ETH_MILESTONE_ABI, provider);
        const count = await contract.campaignCount();
        for (let i = 0; i < Number(count); i++) {
          const c = await contract.getCampaign(i);
          const raisedUSD = (Number(c.amountRaised) / 1e18) * prices.eth;
          const goalUSD = (Number(c.totalGoal) / 1e18) * prices.eth;
          all.push({ id: `eth-ms-${i}`, title: c.title, description: c.description,
            raisedUSD, goalUSD, isActive: c.isActive, owner: c.owner,
            blockchain: "eth", type: "milestone",
            milestoneCount: Number(c.milestoneCount),
            currentMilestone: Number(c.currentMilestone),
            route: `/milestone/${i}`,
            deadline: new Date(Number(c.deadline) * 1000) });
        }
      } catch (e) { console.error("ETH milestone:", e); }

      try {
        const contract = new ethers.Contract(ETH_UNIFIED_ADDRESS, ETH_UNIFIED_ABI, provider);
        const count = await contract.campaignCount();
        for (let i = 0; i < Number(count); i++) {
          const c = await contract.getCampaign(i);
          const raisedUSD = (Number(c.amountRaisedETH) / 1e18) * prices.eth;
          all.push({ id: `cross-${i}`, title: c.title, description: c.description,
            raisedUSD, goalUSD: Number(c.goalUSD), isActive: c.isActive, owner: c.owner,
            blockchain: "cross", type: "cross",
            route: `/unified/${i}`,
            deadline: new Date(Number(c.deadline) * 1000) });
        }
      } catch (e) { console.error("ETH unified:", e); }

      try {
        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const dummyWallet = { publicKey: PublicKey.default, signTransaction: async t => t, signAllTransactions: async t => t };
        const prov = new anchor.AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
        anchor.setProvider(prov);
        const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, prov);
        if (idl) {
          const program = new anchor.Program(idl, prov);

          const simpleAccounts = await program.account.campaign.all();
          for (const acc of simpleAccounts) {
            const d = acc.account;
            const raisedUSD = (Number(d.amountRaised) / 1e9) * prices.sol;
            const goalUSD = (Number(d.goal) / 1e9) * prices.sol;
            all.push({ id: acc.publicKey.toString(), title: d.title, description: d.description,
              raisedUSD, goalUSD, isActive: d.isActive, owner: d.owner.toString(),
              blockchain: "sol", type: "simple",
              route: `/campaign/sol/${acc.publicKey.toString()}`,
              deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
          }

          const milestoneAccounts = await program.account.milestoneCampaign.all();
          for (const acc of milestoneAccounts) {
            const d = acc.account;
            const raisedUSD = (Number(d.amountRaised) / 1e9) * prices.sol;
            const goalUSD = (Number(d.totalGoal) / 1e9) * prices.sol;
            all.push({ id: acc.publicKey.toString(), title: d.title, description: d.description,
              raisedUSD, goalUSD, isActive: d.isActive, owner: d.owner.toString(),
              blockchain: "sol", type: "milestone",
              milestoneCount: d.milestoneCount,
              currentMilestone: d.currentMilestone,
              route: `/solana-milestone/${acc.publicKey.toString()}`,
              deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
          }
        }
      } catch (e) { console.error("SOL:", e); }

      setCampaigns(all);
      setLoading(false);
    }
    if (prices.eth > 0) loadAll();
  }, [prices]);

  const filtered = campaigns.filter(c => {
    if (filter !== "all" && c.blockchain !== filter) return false;
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    return true;
  });

  const totalUSD = campaigns.reduce((s, c) => s + (c.raisedUSD || 0), 0);

  return (
    <div className="all-campaigns-page">
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-label">Blockchain Crowdfunding</div>
            <h1 className="hero-title">Fund the Future,<br/>On-Chain.</h1>
            <div className="divider"></div>
            <p className="hero-desc">Transparent, decentralized fundraising on Ethereum and Solana.</p>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{campaigns.filter(c => c.isActive).length}</span>
              <span className="hero-stat-label">Campanii Active</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat">
              <span className="hero-stat-value">2</span>
              <span className="hero-stat-label">Blockchain-uri</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat">
              <span className="hero-stat-value">${totalUSD.toFixed(0)}</span>
              <span className="hero-stat-label">Total Strans USD</span>
            </div>
          </div>
        </div>
      </section>

      <section className="campaigns-section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="section-title">Toate Campaniile</h2>
              <div className="divider"></div>
            </div>
            <div className="filters-wrap">
              <div className="filter-tabs">
                {[["all","Toate"],["eth","Ethereum"],["sol","Solana"],["cross","Cross-Chain"]].map(([v,l]) => (
                  <button key={v} className={filter === v ? "filter-tab active" : "filter-tab"} onClick={() => setFilter(v)}>{l}</button>
                ))}
              </div>
              <div className="filter-tabs" style={{marginLeft:"8px"}}>
                {[["all","Tip: Toate"],["simple","Simple"],["milestone","Milestone"],["cross","Cross"]].map(([v,l]) => (
                  <button key={v} className={typeFilter === v ? "filter-tab active" : "filter-tab"} onClick={() => setTypeFilter(v)}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="loading-spinner"></div><p>Se incarca toate campaniile...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">EMPTY</div><h3>Nicio campanie</h3><p>Incearca alt filtru.</p></div>
          ) : (
            <div className="campaigns-grid">
              {filtered.map(c => {
                const progress = Math.min(c.goalUSD > 0 ? (c.raisedUSD / c.goalUSD) * 100 : 0, 100);
                const daysLeft = Math.max(0, Math.ceil((c.deadline - Date.now()) / 86400000));
                return (
                  <Link to={c.route} key={c.id} className="campaign-card card">
                    <div className="card-header">
                      <div className="card-badges">
                        <span className={`badge badge-${c.blockchain}`}>{c.blockchain.toUpperCase()}</span>
                        {c.type === "milestone" && <span className="badge" style={{background:"rgba(201,168,76,0.15)", color:"var(--gold)"}}>MILESTONE</span>}
                        {c.type === "cross" && <span className="badge" style={{background:"rgba(99,102,241,0.15)", color:"#6366f1"}}>CROSS</span>}
                        <span className={`badge badge-${c.isActive ? "active" : "inactive"}`}>{c.isActive ? "Activa" : "Inchisa"}</span>
                      </div>
                      <span className="days-left">{daysLeft}d left</span>
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">{c.title}</h3>
                      <div className="divider"></div>
                      <p className="card-desc">{c.description?.slice(0,100)}{c.description?.length > 100 ? "..." : ""}</p>
                    </div>
                    <div className="card-footer">
                      <div className="progress-bar"><div className="progress-fill" style={{width:`${progress}%`}}></div></div>
                      <div className="card-stats">
                        <div>
                          <span className="stat-value">{progress.toFixed(1)}%</span>
                          <span className="stat-label">funded</span>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <span className="stat-value">${c.raisedUSD.toFixed(2)}</span>
                          <span className="stat-label">of ${c.goalUSD.toFixed(2)} USD</span>
                        </div>
                      </div>
                      {c.type === "milestone" && (
                        <div className="milestone-steps" style={{margin:"8px 0 4px"}}>
                          {Array.from({length: c.milestoneCount}).map((_, i) => (
                            <div key={i} className={`milestone-step ${i < c.currentMilestone ? "done" : i === c.currentMilestone ? "active" : ""}`}></div>
                          ))}
                        </div>
                      )}
                      <div className="card-owner">
                        <span className="owner-label">by</span>
                        <span className="owner-addr">{c.owner?.slice(0,6)}...{c.owner?.slice(-4)}</span>
                      </div>
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
