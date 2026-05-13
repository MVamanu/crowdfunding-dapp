import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useCryptoPrices } from "../hooks/useCryptoPrices";
import "./CampaignCard.css";

export default function CampaignCard({ campaign }) {
  const { id, title, description, goal, amountRaised, isActive, blockchain, owner, deadline } = campaign;
  const { formatUSD } = useCryptoPrices();
  const progress = Math.min((Number(amountRaised) / Number(goal)) * 100, 100);
  const daysLeft = deadline ? Math.max(0, Math.ceil((new Date(deadline) - Date.now()) / 86400000)) : null;
  const isSol = blockchain === "sol";
  const raisedNative = isSol ? (Number(amountRaised) / 1e9).toFixed(4) : ethers.formatEther(amountRaised || "0");
  const goalNative = isSol ? (Number(goal) / 1e9).toFixed(4) : ethers.formatEther(goal || "0");
  const currency = isSol ? "SOL" : "ETH";

  return (
    <Link to={`/campaign/${blockchain}/${id}`} className="campaign-card card">
      <div className="card-header">
        <div className="card-badges">
          <span className={`badge badge-${blockchain}`}>{blockchain.toUpperCase()}</span>
          <span className={`badge badge-${isActive ? "active" : "inactive"}`}>{isActive ? "Active" : "Closed"}</span>
        </div>
        {daysLeft !== null && <span className="days-left">{daysLeft}d left</span>}
      </div>
      <div className="card-body">
        <h3 className="card-title">{title}</h3>
        <div className="divider"></div>
        <p className="card-desc">{description?.slice(0, 100)}{description?.length > 100 ? "..." : ""}</p>
      </div>
      <div className="card-footer">
        <div className="progress-bar"><div className="progress-fill" style={{width: `${progress}%`}}></div></div>
        <div className="card-stats">
          <div>
            <span className="stat-value">{progress.toFixed(1)}%</span>
            <span className="stat-label">funded</span>
          </div>
          <div style={{textAlign:"right"}}>
            <span className="stat-value">{formatUSD(amountRaised, blockchain)}</span>
            <span className="stat-label">{raisedNative} {currency} raised</span>
          </div>
        </div>
        <div className="card-goal">
          <span className="goal-label">Goal:</span>
          <span className="goal-value">{formatUSD(goal, blockchain)} <span className="goal-native">({goalNative} {currency})</span></span>
        </div>
        <div className="card-owner">
          <span className="owner-label">by</span>
          <span className="owner-addr">{owner?.slice(0,6)}...{owner?.slice(-4)}</span>
        </div>
      </div>
    </Link>
  );
}
