import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import ConnectWalletModal from "../components/ConnectWalletModal";
import "./MilestoneCampaignDetail.css";
import { CONTRACTS, SEPOLIA_RPC_URL } from "../config/chains";
import { getDaysLeft } from "../utils/time";

const MILESTONE_CONTRACT = CONTRACTS.milestone;
const MILESTONE_ABI = [
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 totalGoal,uint256 amountRaised,bool isActive,uint256 deadline,uint256 milestoneCount,uint256 currentMilestone))",
  "function getMilestone(uint256,uint256) view returns (tuple(string title,string description,uint256 amount,bool completed,bool approved,uint256 votesFor,uint256 votesAgainst,uint256 votingDeadline,bool votingActive))",
  "function getDonation(uint256,address) view returns (uint256)",
  "function donate(uint256) payable",
  "function submitMilestone(uint256)",
  "function vote(uint256,uint256,bool)",
  "function finalizeMilestone(uint256,uint256)",
];
const SEPOLIA_RPC = SEPOLIA_RPC_URL;

export default function MilestoneCampaignDetail({ ethConnected, ethAddress, onConnectEth, onConnectSol, onConnectSolflare }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [donating, setDonating] = useState(false);
  const [voting, setVoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [userDonation, setUserDonation] = useState("0");

  async function loadData() {
    try {
      const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
      const contract = new ethers.Contract(MILESTONE_CONTRACT, MILESTONE_ABI, provider);
      const c = await contract.getCampaign(Number(id));
      const camp = {
        id: Number(id),
        owner: c.owner, title: c.title, description: c.description,
        totalGoal: c.totalGoal, amountRaised: c.amountRaised,
        isActive: c.isActive, milestoneCount: Number(c.milestoneCount),
        currentMilestone: Number(c.currentMilestone),
        deadline: new Date(Number(c.deadline) * 1000),
      };
      setCampaign(camp);

      const ms = [];
      for (let i = 0; i < camp.milestoneCount; i++) {
        const m = await contract.getMilestone(Number(id), i);
        ms.push({
          index: i, title: m.title, description: m.description,
          amount: m.amount, completed: m.completed, approved: m.approved,
          votesFor: m.votesFor, votesAgainst: m.votesAgainst,
          votingDeadline: Number(m.votingDeadline), votingActive: m.votingActive,
        });
      }
      setMilestones(ms);

      if (ethAddress) {
        const donation = await contract.getDonation(Number(id), ethAddress);
        setUserDonation(donation.toString());
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => loadData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ethAddress]);

  async function getSignerContract() {
    const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
    const provider = new ethers.BrowserProvider(metamask);
    const signer = await provider.getSigner();
    return new ethers.Contract(MILESTONE_CONTRACT, MILESTONE_ABI, signer);
  }

  async function handleDonate() {
    setError(""); setSuccess("");
    if (!ethConnected) { setShowModal(true); return; }
    if (!amount || Number(amount) <= 0) { setError("Introdu o suma valida."); return; }
    setDonating(true);
    try {
      const contract = await getSignerContract();
      const tx = await contract.donate(Number(id), { value: ethers.parseEther(amount) });
      await tx.wait();
      setSuccess("Donatie efectuata cu succes!");
      setAmount("");
      await loadData();
    } catch (e) { setError(e.reason || e.message || "Tranzactie esuata."); }
    setDonating(false);
  }

  async function handleSubmitMilestone() {
    setError(""); setSuccess("");
    setSubmitting(true);
    try {
      const contract = await getSignerContract();
      const tx = await contract.submitMilestone(Number(id));
      await tx.wait();
      setSuccess("Milestone submis pentru vot!");
      await loadData();
    } catch (e) { setError(e.reason || e.message || "Eroare."); }
    setSubmitting(false);
  }

  async function handleVote(milestoneId, approve) {
    setError(""); setSuccess("");
    setVoting(true);
    try {
      const contract = await getSignerContract();
      const tx = await contract.vote(Number(id), milestoneId, approve);
      await tx.wait();
      setSuccess(approve ? "Ai votat pentru aprobare!" : "Ai votat pentru respingere!");
      await loadData();
    } catch (e) { setError(e.reason || e.message || "Eroare vot."); }
    setVoting(false);
  }

  async function handleFinalize(milestoneId) {
    setError(""); setSuccess("");
    try {
      const contract = await getSignerContract();
      const tx = await contract.finalizeMilestone(Number(id), milestoneId);
      await tx.wait();
      setSuccess("Milestone finalizat!");
      await loadData();
    } catch (e) { setError(e.reason || e.message || "Eroare finalizare."); }
  }

  if (loading) return <div className="detail-loading"><div className="loading-spinner"></div><p>Se incarca...</p></div>;
  if (!campaign) return <div className="detail-loading"><p>Campanie negasita.</p></div>;

  const progress = Math.min((Number(campaign.amountRaised) / Number(campaign.totalGoal)) * 100, 100);
  const goalEth = ethers.formatEther(campaign.totalGoal);
  const raisedEth = ethers.formatEther(campaign.amountRaised);
  const daysLeft = getDaysLeft(campaign.deadline);
  const isOwner = ethAddress?.toLowerCase() === campaign.owner?.toLowerCase();
  const isDonor = BigInt(userDonation) > 0n;
  const goalReached = Number(campaign.amountRaised) >= Number(campaign.totalGoal);
  const currentM = milestones[campaign.currentMilestone];

  return (
    <div className="detail-page">
      {showModal && <ConnectWalletModal onClose={() => setShowModal(false)} onConnectEth={() => { onConnectEth(); setShowModal(false); }} onConnectSol={() => { onConnectSol(); setShowModal(false); }} onConnectSolflare={() => { onConnectSolflare(); setShowModal(false); }} />}

      <div className="container">
        <button className="back-btn" onClick={() => navigate("/milestone-campaigns")}>Back to Milestones</button>

        <div className="detail-layout">
          <div className="detail-main">
            <div className="detail-badges">
              <span className="badge badge-eth">ETH</span>
              <span className="badge" style={{background:"rgba(201,168,76,0.15)", color:"var(--gold)"}}>MILESTONE</span>
              <span className={`badge badge-${campaign.isActive ? "active" : "inactive"}`}>{campaign.isActive ? "Activa" : "Inchisa"}</span>
            </div>

            <h1 className="detail-title">{campaign.title}</h1>
            <div className="divider"></div>

            <div className="detail-meta">
              <div className="meta-item">
                <span className="meta-label">Owner</span>
                <span className="meta-value mono">{campaign.owner}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Deadline</span>
                <span className="meta-value">{campaign.deadline.toLocaleDateString("en-GB", {day:"numeric", month:"long", year:"numeric"})} - {daysLeft} zile ramase</span>
              </div>
            </div>

            <div className="detail-description">
              <h3>Despre aceasta campanie</h3>
              <p>{campaign.description}</p>
            </div>

            <div className="detail-progress card">
              <div className="progress-header">
                <div>
                  <span className="progress-raised">{raisedEth} ETH</span>
                  <span className="progress-label"> strans din {goalEth} ETH</span>
                </div>
                <span className="progress-pct">{progress.toFixed(1)}%</span>
              </div>
              <div className="progress-bar" style={{height:"10px", margin:"16px 0"}}>
                <div className="progress-fill" style={{width:`${progress}%`}}></div>
              </div>
              <div className="progress-stats">
                <div className="pstat"><span className="pstat-value">{raisedEth} ETH</span><span className="pstat-label">Strans</span></div>
                <div className="pstat"><span className="pstat-value">{goalEth} ETH</span><span className="pstat-label">Goal</span></div>
                <div className="pstat"><span className="pstat-value">{daysLeft}</span><span className="pstat-label">Zile ramase</span></div>
              </div>
            </div>

            <div className="milestones-timeline">
              <h3 className="milestones-title">Etape Campanie</h3>
              {milestones.map((m, i) => (
                <div key={i} className={`timeline-item ${m.completed && m.approved ? "approved" : m.completed && !m.approved ? "rejected" : m.votingActive ? "voting" : i === campaign.currentMilestone ? "current" : i < campaign.currentMilestone ? "passed" : ""}`}>
                  <div className="timeline-marker">
                    {m.completed && m.approved ? "✓" : m.votingActive ? "?" : i + 1}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <h4 className="timeline-title">{m.title}</h4>
                      <span className="timeline-amount">{ethers.formatEther(m.amount)} ETH</span>
                    </div>
                    <p className="timeline-desc">{m.description}</p>

                    {m.votingActive && (
                      <div className="voting-panel">
                        <div className="voting-stats">
                          <div className="vote-bar-wrap">
                            <div className="vote-bar-for" style={{width: Number(m.votesFor) + Number(m.votesAgainst) > 0 ? `${Number(m.votesFor) * 100 / (Number(m.votesFor) + Number(m.votesAgainst))}%` : "0%"}}></div>
                          </div>
                          <div className="vote-numbers">
                            <span className="vote-for">Pentru: {ethers.formatEther(m.votesFor)} ETH</span>
                            <span className="vote-against">Contra: {ethers.formatEther(m.votesAgainst)} ETH</span>
                          </div>
                        </div>
                        {isDonor && (
                          <div className="vote-actions">
                            <button className="vote-btn approve" onClick={() => handleVote(i, true)} disabled={voting}>Aproba</button>
                            <button className="vote-btn reject" onClick={() => handleVote(i, false)} disabled={voting}>Respinge</button>
                          </div>
                        )}
                        <button className="finalize-btn" onClick={() => handleFinalize(i)}>Finalizeaza votul</button>
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
                <p className="donate-desc">Fondurile sunt eliberate etapizat prin vot.</p>
                <div className="donate-input-wrap">
                  <input className="form-input donate-input" type="number" step="0.001" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                  <span className="donate-currency">ETH</span>
                </div>
                <div className="donate-presets">
                  {["0.001","0.005","0.01"].map(v => (
                    <button key={v} className="preset-btn" onClick={() => setAmount(v)}>{v} ETH</button>
                  ))}
                </div>
                {error && <div className="form-error">{error}</div>}
                {success && <div className="form-success">{success}</div>}
                <button className="btn-gold donate-btn" onClick={handleDonate} disabled={donating}>
                  {donating ? "Se proceseaza..." : ethConnected ? "Doneaza" : "Conecteaza & Doneaza"}
                </button>
                {isDonor && <p className="donor-badge">Ai donat: {ethers.formatEther(userDonation)} ETH - Poti vota!</p>}
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
              <h4 className="contract-title">Smart Contract</h4>
              <div className="contract-item"><span className="contract-label">Network</span><span className="contract-value">Ethereum Sepolia</span></div>
              <div className="contract-item"><span className="contract-label">Etapa curenta</span><span className="contract-value">{campaign.currentMilestone + 1}/{campaign.milestoneCount}</span></div>
              <div className="contract-item">
                <span className="contract-label">Contract</span>
                <a className="contract-value" href={`https://sepolia.etherscan.io/address/${MILESTONE_CONTRACT}`} target="_blank" rel="noreferrer" style={{color:"var(--gold)", fontSize:"11px"}}>View on Etherscan</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
