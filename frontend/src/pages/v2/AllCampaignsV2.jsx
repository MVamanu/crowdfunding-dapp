import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import "../AllCampaigns.css";
import "./V2.css";
import { getDaysLeft } from "../../utils/time";
import { CONTRACTS, SEPOLIA_RPC_URL, SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../../config/chains";

const STABLE_V2_CONTRACT = CONTRACTS.stableV2;
const STABLE_MILESTONE_CONTRACT = CONTRACTS.stableMilestone;

const STABLE_V2_ABI = [
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goalUSDC,uint256 amountRaisedLocal,uint256 amountRaisedExternal,bool isActive,uint256 deadline,bool goalReached,string mainChain,string[] acceptedChains))",
  "function campaignCount() view returns (uint256)",
  "function getTotalRaised(uint256) view returns (uint256)",
];

const STABLE_MILESTONE_ABI = [
  "function campaignCount() view returns (uint256)",
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 totalGoal,uint256 amountRaisedLocal,uint256 amountRaisedExternal,bool isActive,uint256 deadline,bool goalReached,string mainChain,string[] acceptedChains,uint256 milestoneCount,uint256 currentMilestone))",
];

export default function AllCampaignsV2() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const all = [];

      // ETH USDC campanii - CrowdfundingStableV2
      try {
        const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
        const contract = new ethers.Contract(STABLE_V2_CONTRACT, STABLE_V2_ABI, provider);
        const count = await contract.campaignCount();
        for (let i = 0; i < Number(count); i++) {
          const c = await contract.getCampaign(i);
          const total = await contract.getTotalRaised(i);
          all.push({
            id: `eth-${i}`,
            title: c.title,
            description: c.description,
            goal: Number(c.goalUSDC),
            amountRaised: Number(total),
            isActive: c.isActive,
            owner: c.owner,
            deadline: new Date(Number(c.deadline) * 1000),
            goalReached: c.goalReached,
            mainChain: c.mainChain,
            acceptedChains: c.acceptedChains,
            blockchain: "eth",
            campaignType: "simple",
            route: `/v2/campaign/eth/${i}`,
          });
        }
      } catch (e) { console.error("ETH USDC error:", e); }

      // ETH USDC Kickstart / milestone campanii
      try {
        const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
        const contract = new ethers.Contract(STABLE_MILESTONE_CONTRACT, STABLE_MILESTONE_ABI, provider);
        const count = await contract.campaignCount();
        for (let i = 0; i < Number(count); i++) {
          const c = await contract.getCampaign(i);
          all.push({
            id: `eth-kickstart-${i}`,
            title: c.title,
            description: c.description,
            goal: Number(c.totalGoal),
            amountRaised: Number(c.amountRaisedLocal) + Number(c.amountRaisedExternal),
            isActive: c.isActive,
            owner: c.owner,
            deadline: new Date(Number(c.deadline) * 1000),
            goalReached: c.goalReached,
            mainChain: c.mainChain,
            acceptedChains: c.acceptedChains,
            blockchain: "eth",
            campaignType: "milestone",
            milestoneCount: Number(c.milestoneCount),
            currentMilestone: Number(c.currentMilestone),
            route: `/v2/kickstart/${i}`,
          });
        }
      } catch (e) { console.error("ETH USDC milestone error:", e); }

      // Solana USDC campanii
      try {
        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const dummyWallet = {
          publicKey: PublicKey.default,
          signTransaction: async t => t,
          signAllTransactions: async t => t
        };
        const prov = new anchor.AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
        anchor.setProvider(prov);
        const idl = await anchor.Program.fetchIdl(SOLANA_PROGRAM_ID, prov);
        if (idl) {
          const program = new anchor.Program(idl, prov);

          if (program.account.usdcCampaign) {
            const accounts = await program.account.usdcCampaign.all();
            for (const acc of accounts) {
              const d = acc.account;
              let vaultBalance = Number(d.amountRaised);
              try {
                const [vaultPDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from("vault"), acc.publicKey.toBuffer()], SOLANA_PROGRAM_ID
                );
                const tokenAccInfo = await connection.getTokenAccountBalance(vaultPDA);
                vaultBalance = Number(tokenAccInfo.value.amount);
              } catch {
                vaultBalance = Number(d.amountRaised);
              }
              all.push({
                id: `sol-${acc.publicKey.toString()}`,
                title: d.title,
                description: d.description,
                goal: Number(d.goal),
                amountRaised: vaultBalance,
                isActive: d.isActive,
                owner: d.owner.toString(),
                deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                goalReached: d.goalReached,
                mainChain: "sol",
                acceptedChains: ["sol", "eth"],
                blockchain: "sol",
                campaignType: "simple",
                route: `/v2/campaign/sol/${acc.publicKey.toString()}`,
              });
            }
          }

          if (program.account.usdcMilestoneCampaign) {
            const accounts = await program.account.usdcMilestoneCampaign.all();
            for (const acc of accounts) {
              const d = acc.account;
              all.push({
                id: `sol-kickstart-${acc.publicKey.toString()}`,
                title: d.title,
                description: d.description,
                goal: Number(d.totalGoal),
                amountRaised: Number(d.amountRaised),
                isActive: d.isActive,
                owner: d.owner.toString(),
                deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                goalReached: d.goalReached,
                mainChain: "sol",
                acceptedChains: ["sol"],
                blockchain: "sol",
                campaignType: "milestone",
                milestoneCount: Number(d.milestoneCount),
                currentMilestone: Number(d.currentMilestone),
                route: `/v2/kickstart/sol/${acc.publicKey.toString()}`,
              });
            }
          }
        }
      } catch (e) { console.error("SOL USDC error:", e); }

      setCampaigns(all);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = campaigns.filter(c => filter === "all" || c.blockchain === filter);
  const totalRaised = campaigns.reduce((s, c) => s + c.amountRaised, 0);

  return (
    <div className="all-campaigns-page">
      <section className="hero v2-hero">
        <div className="container">
          <div className="hero-content">
            <div className="v2-badge">v2 - USDC Cross-Chain</div>
            <h1 className="hero-title">Crowdfunding Stabil,<br/>pe ETH si SOL.</h1>
            <div className="divider"></div>
            <p className="hero-desc">Campanii in USDC pe Ethereum si Solana. Valoare stabila, fara volatilitate crypto.</p>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{campaigns.filter(c => c.isActive).length}</span>
              <span className="hero-stat-label">Campanii Active</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat">
              <span className="hero-stat-value">${(totalRaised / 1_000_000).toFixed(2)}</span>
              <span className="hero-stat-label">Total Strans USDC</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat">
              <span className="hero-stat-value">2</span>
              <span className="hero-stat-label">Blockchain-uri</span>
            </div>
          </div>
        </div>
      </section>

      <section className="campaigns-section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="section-title">Campanii USDC</h2>
              <div className="divider"></div>
            </div>
            <div style={{display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap"}}>
              <div className="filter-tabs">
                {[["all","Toate"],["eth","Ethereum"],["sol","Solana"]].map(([v,l]) => (
                  <button key={v} className={filter === v ? "filter-tab active" : "filter-tab"}
                    onClick={() => setFilter(v)}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Se incarca...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">o</div>
              <h3>Nicio campanie USDC</h3>
              <p>Campaniile USDC create vor aparea aici.</p>
            </div>
          ) : (
            <div className="campaigns-grid">
              {filtered.map(c => {
                const progress = Math.min(c.goal > 0 ? (c.amountRaised / c.goal) * 100 : 0, 100);
                const daysLeft = getDaysLeft(c.deadline);
                const goalUSDC = (c.goal / 1_000_000).toFixed(2);
                const raisedUSDC = (c.amountRaised / 1_000_000).toFixed(2);
                const chainColor = c.blockchain === "sol" ? "#9945FF" : "#2775CA";
                return (
                  <Link to={c.route} key={c.id} className="campaign-card card v2-card">
                    <div className="card-header">
                      <div className="card-badges">
                        <span className="badge badge-usdc">USDC</span>
                        <span className="badge badge-active">
                          {c.campaignType === "milestone" ? "Milestone" : "Simpla"}
                        </span>
                        <span className="badge" style={{
                          background:`${chainColor}20`,
                          color:chainColor,
                          border:`1px solid ${chainColor}40`
                        }}>
                          {c.blockchain.toUpperCase()}
                        </span>
                        <span className={`badge badge-${c.isActive ? "active" : "inactive"}`}>
                          {c.goalReached ? "Goal Atins" : c.isActive ? "Activa" : "Inchisa"}
                        </span>
                      </div>
                      <span className="days-left">{daysLeft}d left</span>
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">{c.title}</h3>
                      <div className="divider"></div>
                      <p className="card-desc">
                        {c.description?.slice(0,100)}{c.description?.length > 100 ? "..." : ""}
                      </p>
                    </div>
                    <div className="card-footer">
                      <div className="progress-bar v2-progress">
                        <div className="progress-fill v2-fill" style={{width:`${progress}%`}}></div>
                      </div>
                      <div className="card-stats">
                        <div>
                          <span className="stat-value">{progress.toFixed(1)}%</span>
                          <span className="stat-label">funded</span>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <span className="stat-value">${raisedUSDC}</span>
                          <span className="stat-label">of ${goalUSDC} USDC</span>
                        </div>
                      </div>
                      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"8px"}}>
                        <div className="card-owner">
                          <span className="owner-label">by</span>
                          <span className="owner-addr">{c.owner?.slice(0,6)}...{c.owner?.slice(-4)}</span>
                        </div>
                        <span style={{fontSize:"11px", color:"var(--text-muted)"}}>
                          {c.campaignType === "milestone" && c.milestoneCount
                            ? `Milestone: ${Math.min((c.currentMilestone || 0) + 1, c.milestoneCount)}/${c.milestoneCount}`
                            : `Main: ${c.mainChain?.toUpperCase()}`}
                        </span>
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
