import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import "./MilestoneCampaigns.css";
import { CONTRACTS, SEPOLIA_RPC_URL } from "../config/chains";

const MILESTONE_CONTRACT = CONTRACTS.milestone;
const MILESTONE_ABI = [
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 totalGoal,uint256 amountRaised,bool isActive,uint256 deadline,uint256 milestoneCount,uint256 currentMilestone))",
  "function getMilestone(uint256,uint256) view returns (tuple(string title,string description,uint256 amount,bool completed,bool approved,uint256 votesFor,uint256 votesAgainst,uint256 votingDeadline,bool votingActive))",
  "function campaignCount() view returns (uint256)",
];
const SEPOLIA_RPC = SEPOLIA_RPC_URL;

export default function MilestoneCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
        const contract = new ethers.Contract(MILESTONE_CONTRACT, MILESTONE_ABI, provider);
        const count = await contract.campaignCount();
        const results = [];
        for (let i = 0; i < Number(count); i++) {
          const c = await contract.getCampaign(i);
          results.push({
            id: i, title: c.title, description: c.description,
            totalGoal: c.totalGoal, amountRaised: c.amountRaised,
            isActive: c.isActive, milestoneCount: Number(c.milestoneCount),
            currentMilestone: Number(c.currentMilestone),
            deadline: new Date(Number(c.deadline) * 1000),
          });
        }
        setCampaigns(results);
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
            <div className="create-label">Inovatie</div>
            <h1 className="section-title">Campanii Milestone</h1>
            <div className="divider"></div>
            <p className="milestone-list-desc">Campanii cu finantare etapizata — fondurile sunt eliberate doar dupa aprobarea prin vot a fiecarei etape.</p>
          </div>
          <Link to="/create-milestone" className="btn-gold">+ Campanie Noua</Link>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Se incarca campaniile...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◇</div>
            <h3>Nicio campanie milestone</h3>
            <p>Fii primul care lanseaza o campanie cu finantare etapizata.</p>
            <Link to="/create-milestone" className="btn-primary" style={{display:"inline-block", marginTop:"16px"}}>Creeaza prima campanie</Link>
          </div>
        ) : (
          <div className="campaigns-grid">
            {campaigns.map(c => (
              <Link to={`/milestone/${c.id}`} key={c.id} className="milestone-card card">
                <div className="milestone-card-header">
                  <span className="badge badge-eth">ETH</span>
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
                    <span className="stat-value">{ethers.formatEther(c.amountRaised)} ETH</span>
                    <span className="stat-label">strans</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span className="stat-value">{ethers.formatEther(c.totalGoal)} ETH</span>
                    <span className="stat-label">goal</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
