import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import "../AllCampaigns.css";
import "./V2.css";

const STABLE_CONTRACT = "0x8FA441B88BC346427E34baf5B1b1E09ed1700f3c";
const SEPOLIA_RPC = "https://eth-sepolia.g.alchemy.com/v2/FnqvmZrEEWYvwZaX3dk0zPlUNi7_Ggdm";
const STABLE_ABI = [
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goal,uint256 amountRaised,bool isActive,uint256 deadline,bool goalReached))",
  "function campaignCount() view returns (uint256)",
];

export default function AllCampaignsV2() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
        const contract = new ethers.Contract(STABLE_CONTRACT, STABLE_ABI, provider);
        const count = await contract.campaignCount();
        const results = [];
        for (let i = 0; i < Number(count); i++) {
          const c = await contract.getCampaign(i);
          results.push({
            id: i, title: c.title, description: c.description,
            goal: c.goal, amountRaised: c.amountRaised,
            isActive: c.isActive, owner: c.owner,
            deadline: new Date(Number(c.deadline) * 1000),
            goalReached: c.goalReached,
          });
        }
        setCampaigns(results);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  const totalRaised = campaigns.reduce((s, c) => s + Number(c.amountRaised), 0);

  return (
    <div className="all-campaigns-page">
      <section className="hero v2-hero">
        <div className="container">
          <div className="hero-content">
            <div className="v2-badge">v2 — USDC Stablecoin</div>
            <h1 className="hero-title">Crowdfunding Stabil,<br/>Fara Volatilitate.</h1>
            <div className="divider"></div>
            <p className="hero-desc">Campanii in USDC — valoarea donata este exact valoarea primita. Fara riscul deprecierii crypto.</p>
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
              <span className="hero-stat-value">USDC</span>
              <span className="hero-stat-label">Stablecoin</span>
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
            <Link to="/v2/create" className="btn-usdc">+ Campanie Noua</Link>
          </div>

          {loading ? (
            <div className="loading-state"><div className="loading-spinner"></div><p>Se incarca...</p></div>
          ) : campaigns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◇</div>
              <h3>Nicio campanie USDC</h3>
              <p>Fii primul care lanseaza o campanie in stablecoin.</p>
              <Link to="/v2/create" className="btn-usdc" style={{display:"inline-block", marginTop:"16px"}}>Creeaza prima campanie</Link>
            </div>
          ) : (
            <div className="campaigns-grid">
              {campaigns.map(c => {
                const progress = Math.min(Number(c.goal) > 0 ? (Number(c.amountRaised) / Number(c.goal)) * 100 : 0, 100);
                const daysLeft = Math.max(0, Math.ceil((c.deadline - Date.now()) / 86400000));
                const goalUSDC = (Number(c.goal) / 1_000_000).toFixed(2);
                const raisedUSDC = (Number(c.amountRaised) / 1_000_000).toFixed(2);
                return (
                  <Link to={`/v2/campaign/${c.id}`} key={c.id} className="campaign-card card v2-card">
                    <div className="card-header">
                      <div className="card-badges">
                        <span className="badge badge-usdc">USDC</span>
                        <span className="badge badge-eth">ETH</span>
                        <span className={`badge badge-${c.isActive ? "active" : "inactive"}`}>
                          {c.goalReached ? "Goal Atins" : c.isActive ? "Activa" : "Inchisa"}
                        </span>
                      </div>
                      <span className="days-left">{daysLeft}d left</span>
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">{c.title}</h3>
                      <div className="divider"></div>
                      <p className="card-desc">{c.description?.slice(0,100)}{c.description?.length > 100 ? "..." : ""}</p>
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
