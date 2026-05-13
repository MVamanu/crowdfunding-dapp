import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useCryptoPrices } from "../hooks/useCryptoPrices";
import "./UnifiedCampaigns.css";
import { CONTRACTS, SEPOLIA_RPC_URL } from "../config/chains";
import { getDaysLeft } from "../utils/time";

const UNIFIED_CONTRACT = CONTRACTS.unified;
const UNIFIED_ABI = [
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goalUSD,uint256 amountRaisedETH,bool isActive,uint256 deadline,string solanaAddress))",
  "function campaignCount() view returns (uint256)",
];
const SEPOLIA_RPC = SEPOLIA_RPC_URL;

export default function UnifiedCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const { prices } = useCryptoPrices();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
        const contract = new ethers.Contract(UNIFIED_CONTRACT, UNIFIED_ABI, provider);
        const count = await contract.campaignCount();
        const results = [];
        for (let i = 0; i < Number(count); i++) {
          const c = await contract.getCampaign(i);
          results.push({
            id: i, title: c.title, description: c.description,
            goalUSD: Number(c.goalUSD), amountRaisedETH: c.amountRaisedETH,
            isActive: c.isActive, owner: c.owner,
            deadline: new Date(Number(c.deadline) * 1000),
            solanaAddress: c.solanaAddress,
          });
        }
        setCampaigns(results);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="unified-page">
      <div className="container">
        <div className="unified-header">
          <div>
            <div className="create-label">Inovatie — Cross-Chain</div>
            <h1 className="section-title">Campanii Cross-Chain</h1>
            <div className="divider"></div>
            <p className="unified-desc">Campanii care accepta atat ETH cat si SOL. Goalul e in USD, progresul e unificat.</p>
          </div>
          <Link to="/create-unified" className="btn-gold">+ Campanie Noua</Link>
        </div>

        {loading ? (
          <div className="loading-state"><div className="loading-spinner"></div><p>Se incarca...</p></div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◇</div>
            <h3>Nicio campanie cross-chain</h3>
            <p>Fii primul care lanseaza o campanie care accepta ETH si SOL.</p>
            <Link to="/create-unified" className="btn-primary" style={{display:"inline-block", marginTop:"16px"}}>Creeaza prima campanie</Link>
          </div>
        ) : (
          <div className="campaigns-grid">
            {campaigns.map(c => {
              const raisedUSD = (Number(c.amountRaisedETH) / 1e18) * prices.eth;
              const progress = Math.min((raisedUSD / c.goalUSD) * 100, 100);
              const daysLeft = getDaysLeft(c.deadline);
              return (
                <Link to={`/unified/${c.id}`} key={c.id} className="unified-card card">
                  <div className="unified-card-header">
                    <div className="chain-badges">
                      <span className="badge badge-eth">ETH</span>
                      {c.solanaAddress && <span className="badge badge-sol">SOL</span>}
                    </div>
                    <span className={`badge badge-${c.isActive ? "active" : "inactive"}`}>{c.isActive ? "Activa" : "Inchisa"}</span>
                    <span className="days-left">{daysLeft}d left</span>
                  </div>
                  <h3 className="card-title">{c.title}</h3>
                  <div className="divider"></div>
                  <p className="card-desc">{c.description?.slice(0, 100)}{c.description?.length > 100 ? "..." : ""}</p>
                  <div className="progress-bar" style={{margin:"16px 0 8px"}}>
                    <div className="progress-fill" style={{width:`${progress}%`}}></div>
                  </div>
                  <div className="card-stats">
                    <div>
                      <span className="stat-value">{progress.toFixed(1)}%</span>
                      <span className="stat-label">funded</span>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <span className="stat-value">${raisedUSD.toFixed(2)}</span>
                      <span className="stat-label">of ${c.goalUSD} USD goal</span>
                    </div>
                  </div>
                  <div className="card-owner">
                    <span className="owner-label">by</span>
                    <span className="owner-addr">{c.owner?.slice(0,6)}...{c.owner?.slice(-4)}</span>
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
