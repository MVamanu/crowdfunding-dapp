import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import ConnectWalletModal from "../../components/ConnectWalletModal";
import "../CampaignDetail.css";
import "./V2.css";

const STABLE_CONTRACT = "0x8FA441B88BC346427E34baf5B1b1E09ed1700f3c";
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const SEPOLIA_RPC = "https://eth-sepolia.g.alchemy.com/v2/FnqvmZrEEWYvwZaX3dk0zPlUNi7_Ggdm";
const STABLE_ABI = [
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goal,uint256 amountRaised,bool isActive,uint256 deadline,bool goalReached))",
  "function donate(uint256,uint256)",
  "function withdraw(uint256)",
  "function refund(uint256)",
  "function getDonation(uint256,address) view returns (uint256)",
];
const USDC_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

export default function CampaignDetailV2({ ethConnected, ethAddress, onConnectEth, onConnectSol, onConnectSolflare }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [donating, setDonating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [userDonation, setUserDonation] = useState("0");
  const [step, setStep] = useState("approve");

  async function loadData() {
    try {
      const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
      const contract = new ethers.Contract(STABLE_CONTRACT, STABLE_ABI, provider);
      const c = await contract.getCampaign(Number(id));
      setCampaign({
        id: Number(id), owner: c.owner, title: c.title, description: c.description,
        goal: c.goal, amountRaised: c.amountRaised, isActive: c.isActive,
        deadline: new Date(Number(c.deadline) * 1000), goalReached: c.goalReached,
      });
      if (ethAddress) {
        const donation = await contract.getDonation(Number(id), ethAddress);
        setUserDonation(donation.toString());
        const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
        const allow = await usdc.allowance(ethAddress, STABLE_CONTRACT);
        if (BigInt(allow) > 0n) setStep("donate");
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [id, ethAddress]);

  async function getSigner() {
    const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
    const provider = new ethers.BrowserProvider(metamask);
    return provider.getSigner();
  }

  async function handleApprove() {
    setError(""); setSuccess("");
    if (!ethConnected) { setShowModal(true); return; }
    if (!amount || Number(amount) <= 0) { setError("Introdu o suma valida."); return; }
    setApproving(true);
    try {
      const signer = await getSigner();
      const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const amountInUsdc = BigInt(Math.round(parseFloat(amount) * 1_000_000));
      const tx = await usdc.approve(STABLE_CONTRACT, amountInUsdc);
      await tx.wait();
      setSuccess("Approve reusit! Acum poti dona.");
      setStep("donate");
    } catch (e) { setError(e.reason || e.message || "Eroare approve."); }
    setApproving(false);
  }

  async function handleDonate() {
    setError(""); setSuccess("");
    if (!ethConnected) { setShowModal(true); return; }
    if (!amount || Number(amount) <= 0) { setError("Introdu o suma valida."); return; }
    setDonating(true);
    try {
      const signer = await getSigner();
      const contract = new ethers.Contract(STABLE_CONTRACT, STABLE_ABI, signer);
      const amountInUsdc = BigInt(Math.round(parseFloat(amount) * 1_000_000));
      const tx = await contract.donate(Number(id), amountInUsdc);
      await tx.wait();
      setSuccess("Donatie USDC efectuata cu succes!");
      setAmount(""); setStep("approve");
      await loadData();
    } catch (e) { setError(e.reason || e.message || "Eroare donatie."); }
    setDonating(false);
  }

  async function handleWithdraw() {
    try {
      const signer = await getSigner();
      const contract = new ethers.Contract(STABLE_CONTRACT, STABLE_ABI, signer);
      const tx = await contract.withdraw(Number(id));
      await tx.wait();
      setSuccess("Fonduri USDC retrase cu succes!");
      await loadData();
    } catch (e) { setError(e.reason || e.message); }
  }

  async function handleRefund() {
    try {
      const signer = await getSigner();
      const contract = new ethers.Contract(STABLE_CONTRACT, STABLE_ABI, signer);
      const tx = await contract.refund(Number(id));
      await tx.wait();
      setSuccess("Refund USDC efectuat!");
      await loadData();
    } catch (e) { setError(e.reason || e.message); }
  }

  if (loading) return <div className="detail-loading"><div className="loading-spinner"></div><p>Se incarca...</p></div>;
  if (!campaign) return <div className="detail-loading"><p>Campanie negasita.</p></div>;

  const progress = Math.min(Number(campaign.goal) > 0 ? (Number(campaign.amountRaised) / Number(campaign.goal)) * 100 : 0, 100);
  const goalUSDC = (Number(campaign.goal) / 1_000_000).toFixed(2);
  const raisedUSDC = (Number(campaign.amountRaised) / 1_000_000).toFixed(2);
  const daysLeft = Math.max(0, Math.ceil((campaign.deadline - Date.now()) / 86400000));
  const isOwner = ethAddress?.toLowerCase() === campaign.owner?.toLowerCase();
  const isDonor = BigInt(userDonation) > 0n;
  const isExpired = campaign.deadline < Date.now();

  return (
    <div className="detail-page">
      {showModal && <ConnectWalletModal onClose={() => setShowModal(false)} onConnectEth={() => { onConnectEth(); setShowModal(false); }} onConnectSol={onConnectSol} onConnectSolflare={onConnectSolflare} />}
      <div className="container">
        <button className="back-btn" onClick={() => navigate("/v2")}>Back to USDC Campaigns</button>
        <div className="detail-layout">
          <div className="detail-main">
            <div className="detail-badges">
              <span className="badge badge-usdc">USDC</span>
              <span className="badge badge-eth">Ethereum Sepolia</span>
              <span className={`badge badge-${campaign.isActive ? "active" : "inactive"}`}>
                {campaign.goalReached ? "Goal Atins" : campaign.isActive ? "Activa" : "Inchisa"}
              </span>
            </div>
            <h1 className="detail-title">{campaign.title}</h1>
            <div className="divider"></div>
            <div className="detail-meta">
              <div className="meta-item"><span className="meta-label">Owner</span><span className="meta-value mono">{campaign.owner}</span></div>
              <div className="meta-item"><span className="meta-label">Deadline</span><span className="meta-value">{campaign.deadline.toLocaleDateString("en-GB")} - {daysLeft} zile</span></div>
            </div>
            <div className="detail-description"><h3>Despre aceasta campanie</h3><p>{campaign.description}</p></div>
            <div className="detail-progress card">
              <div className="progress-header">
                <div><span className="progress-raised">${raisedUSDC} USDC</span><span className="progress-label"> strans din ${goalUSDC} USDC</span></div>
                <span className="progress-pct">{progress.toFixed(1)}%</span>
              </div>
              <div className="progress-bar v2-progress" style={{height:"10px", margin:"16px 0"}}>
                <div className="progress-fill v2-fill" style={{width:`${progress}%`}}></div>
              </div>
              <div className="progress-stats">
                <div className="pstat"><span className="pstat-value">${raisedUSDC}</span><span className="pstat-label">Strans USDC</span></div>
                <div className="pstat"><span className="pstat-value">${goalUSDC}</span><span className="pstat-label">Goal USDC</span></div>
                <div className="pstat"><span className="pstat-value">{daysLeft}</span><span className="pstat-label">Zile ramase</span></div>
              </div>
            </div>
          </div>
          <div className="detail-sidebar">
            {campaign.isActive && !campaign.goalReached && (
              <div className="donate-card card">
                <h3 className="donate-title">Sustine cu USDC</h3>
                <div className="usdc-note">
                  <span>{step === "approve" ? "Pas 1/2: Aproba suma" : "Pas 2/2: Doneaza"}</span>
                </div>
                <div className="donate-input-wrap">
                  <input className="form-input donate-input" type="number" step="1" min="0" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
                  <span className="donate-currency">USDC</span>
                </div>
                <div className="donate-presets">
                  {["10","50","100"].map(v => (
                    <button key={v} className="preset-btn" onClick={() => setAmount(v)}>${v}</button>
                  ))}
                </div>
                {error && <div className="form-error">{error}</div>}
                {success && <div className="form-success">{success}</div>}
                {step === "approve" ? (
                  <button className="btn-usdc donate-btn" style={{width:"100%", justifyContent:"center"}} onClick={handleApprove} disabled={approving}>
                    {approving ? "Se proceseaza..." : ethConnected ? "1. Aproba USDC" : "Conecteaza MetaMask"}
                  </button>
                ) : (
                  <button className="btn-usdc donate-btn" style={{width:"100%", justifyContent:"center"}} onClick={handleDonate} disabled={donating}>
                    {donating ? "Se proceseaza..." : "2. Doneaza USDC"}
                  </button>
                )}
                <p style={{fontSize:"11px", color:"var(--text-muted)", marginTop:"8px", textAlign:"center"}}>Doua tranzactii: Approve + Donate</p>
              </div>
            )}
            {isOwner && campaign.goalReached && campaign.isActive && (
              <div className="withdraw-card card">
                <h3 className="withdraw-title">Goal atins! 🎉</h3>
                <p>Retrage ${raisedUSDC} USDC catre wallet-ul tau.</p>
                <button className="btn-usdc" style={{width:"100%", justifyContent:"center"}} onClick={handleWithdraw}>Retrage USDC</button>
              </div>
            )}
            {isDonor && isExpired && !campaign.goalReached && (
              <div className="withdraw-card card">
                <h3 className="withdraw-title">Campanie expirata</h3>
                <p>Goalul nu a fost atins. Recupereaza ${(Number(userDonation) / 1_000_000).toFixed(2)} USDC.</p>
                <button className="btn-usdc" style={{width:"100%", justifyContent:"center", background:"#e53e3e"}} onClick={handleRefund}>Recupereaza USDC</button>
              </div>
            )}
            <div className="contract-card card">
              <h4 className="contract-title">Contract Info</h4>
              <div className="contract-item"><span className="contract-label">Token</span><span className="contract-value">USDC (6 decimale)</span></div>
              <div className="contract-item"><span className="contract-label">Network</span><span className="contract-value">Ethereum Sepolia</span></div>
              <div className="contract-item">
                <span className="contract-label">Etherscan</span>
                <a href={`https://sepolia.etherscan.io/address/${STABLE_CONTRACT}`} target="_blank" rel="noreferrer" style={{color:"#2775CA", fontSize:"11px"}}>View Contract</a>
              </div>
              {isDonor && <div className="contract-item"><span className="contract-label">Donatia ta</span><span className="contract-value">${(Number(userDonation) / 1_000_000).toFixed(2)} USDC</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
