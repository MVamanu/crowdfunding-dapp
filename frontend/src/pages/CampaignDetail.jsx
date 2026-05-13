import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import ConnectWalletModal from "../components/ConnectWalletModal";
import "./CampaignDetail.css";
import { CONTRACTS, SEPOLIA_RPC_URL, SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../config/chains";
import { getDaysLeft } from "../utils/time";

const ETH_CONTRACT_ADDRESS = CONTRACTS.eth;
const ETH_ABI = [
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goal,uint256 amountRaised,bool isActive,uint256 deadline))",
  "function donate(uint256) payable",
  "function withdraw(uint256)",
];
const SEPOLIA_RPC = SEPOLIA_RPC_URL;
const SOL_PROGRAM_ID = SOLANA_PROGRAM_ID;

export default function CampaignDetail({ ethContract, ethConnected, ethAddress, onConnectEth, onConnectSol, onConnectSolflare, solWallet, solConnected }) {
  const { blockchain, id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (blockchain === "eth") {
          const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
          const contract = new ethers.Contract(ETH_CONTRACT_ADDRESS, ETH_ABI, provider);
          const c = await contract.getCampaign(Number(id));
          setCampaign({
            id: Number(id), title: c.title, description: c.description,
            goal: c.goal, amountRaised: c.amountRaised, isActive: c.isActive,
            owner: c.owner, deadline: new Date(Number(c.deadline) * 1000),
            blockchain: "eth"
          });
        } else if (blockchain === "sol") {
          const connection = new Connection(SOLANA_RPC_URL, "confirmed");
          const dummyWallet = { publicKey: PublicKey.default, signTransaction: async t => t, signAllTransactions: async t => t };
          const provider = new anchor.AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
          anchor.setProvider(provider);
          const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, provider);
          if (idl) {
            const program = new anchor.Program(idl, provider);
            const pubkey = new PublicKey(id);
            const acc = await program.account.campaign.fetch(pubkey);
            setCampaign({
              id, title: acc.title, description: acc.description,
              goal: acc.goal, amountRaised: acc.amountRaised,
              isActive: acc.isActive, owner: acc.owner.toString(),
              deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              blockchain: "sol", pubkey
            });
          }
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [blockchain, id]);

  async function handleDonate() {
    setError(""); setSuccess("");
    if (blockchain === "eth") {
      if (!ethConnected) { setShowModal(true); return; }
      if (!amount || Number(amount) <= 0) { setError("Enter a valid amount."); return; }
      setDonating(true);
      try {
        const tx = await ethContract.donate(Number(id), { value: ethers.parseEther(amount) });
        await tx.wait();
        setSuccess("Donation successful! Thank you.");
        setAmount("");
        const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
        const contract = new ethers.Contract(ETH_CONTRACT_ADDRESS, ETH_ABI, provider);
        const c = await contract.getCampaign(Number(id));
        setCampaign(prev => ({ ...prev, amountRaised: c.amountRaised }));
      } catch (e) { setError(e.reason || e.message || "Transaction failed."); }
      setDonating(false);
    } else if (blockchain === "sol") {
      if (!solConnected || !solWallet) { setShowModal(true); return; }
      if (!amount || Number(amount) <= 0) { setError("Enter a valid amount."); return; }
      setDonating(true);
      try {
        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const provider = new anchor.AnchorProvider(connection, solWallet, { commitment: "confirmed" });
        anchor.setProvider(provider);
        const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, provider);
        const program = new anchor.Program(idl, provider);
        const campaignPubkey = new PublicKey(id);
        const lamports = new anchor.BN(parseFloat(amount) * 1e9);
        await program.methods.donate(lamports).accounts({
          campaign: campaignPubkey,
          donor: solWallet.publicKey,
          systemProgram: SystemProgram.programId,
        }).rpc();
        setSuccess("Donation successful! Thank you.");
        setAmount("");
        const acc = await program.account.campaign.fetch(campaignPubkey);
        setCampaign(prev => ({ ...prev, amountRaised: acc.amountRaised }));
      } catch (e) { setError(e.reason || e.message || "Transaction failed."); }
      setDonating(false);
    }
  }

  async function handleWithdraw() {
    setError(""); setSuccess("");
    setWithdrawing(true);
    try {
      const tx = await ethContract.withdraw(Number(id));
      await tx.wait();
      setSuccess("Funds withdrawn successfully!");
      setCampaign(prev => ({ ...prev, isActive: false }));
    } catch (e) { setError(e.reason || e.message || "Withdraw failed."); }
    setWithdrawing(false);
  }

  if (loading) return <div className="detail-loading"><div className="loading-spinner"></div><p>Loading campaign...</p></div>;
  if (!campaign) return <div className="detail-loading"><p>Campaign not found.</p><button className="btn-outline" onClick={() => navigate("/")}>Back to campaigns</button></div>;

  const isSol = blockchain === "sol";
  const currency = isSol ? "SOL" : "ETH";
  const goalFormatted = isSol ? (Number(campaign.goal) / 1e9).toFixed(4) : ethers.formatEther(campaign.goal);
  const raisedFormatted = isSol ? (Number(campaign.amountRaised) / 1e9).toFixed(4) : ethers.formatEther(campaign.amountRaised);
  const progress = Math.min((Number(campaign.amountRaised) / Number(campaign.goal)) * 100, 100);
  const daysLeft = getDaysLeft(campaign.deadline);
  const isOwner = isSol
    ? solWallet?.publicKey?.toString() === campaign.owner
    : ethAddress?.toLowerCase() === campaign.owner?.toLowerCase();
  const goalReached = Number(campaign.amountRaised) >= Number(campaign.goal);

  return (
    <div className="detail-page">
      {showModal && <ConnectWalletModal onClose={() => setShowModal(false)} onConnectEth={() => { onConnectEth(); setShowModal(false); }} onConnectSol={() => { onConnectSol(); setShowModal(false); }} onConnectSolflare={() => { onConnectSolflare(); setShowModal(false); }} />}
      <div className="container">
        <button className="back-btn" onClick={() => navigate("/")}>Back to campaigns</button>
        <div className="detail-layout">
          <div className="detail-main">
            <div className="detail-badges">
              <span className={`badge badge-${blockchain}`}>{blockchain.toUpperCase()}</span>
              <span className={`badge badge-${campaign.isActive ? "active" : "inactive"}`}>{campaign.isActive ? "Active" : "Closed"}</span>
            </div>
            <h1 className="detail-title">{campaign.title}</h1>
            <div className="divider"></div>
            <div className="detail-meta">
              <div className="meta-item"><span className="meta-label">Campaign owner</span><span className="meta-value mono">{campaign.owner}</span></div>
              <div className="meta-item"><span className="meta-label">Deadline</span><span className="meta-value">{campaign.deadline.toLocaleDateString("en-GB", {day:"numeric", month:"long", year:"numeric"})} - {daysLeft} days left</span></div>
            </div>
            <div className="detail-description"><h3>About this campaign</h3><p>{campaign.description}</p></div>
            <div className="detail-progress card">
              <div className="progress-header">
                <div><span className="progress-raised">{raisedFormatted} {currency}</span><span className="progress-label"> raised of {goalFormatted} {currency} goal</span></div>
                <span className="progress-pct">{progress.toFixed(1)}%</span>
              </div>
              <div className="progress-bar" style={{height:"10px", margin:"16px 0"}}><div className="progress-fill" style={{width:`${progress}%`}}></div></div>
              <div className="progress-stats">
                <div className="pstat"><span className="pstat-value">{raisedFormatted} {currency}</span><span className="pstat-label">Raised</span></div>
                <div className="pstat"><span className="pstat-value">{goalFormatted} {currency}</span><span className="pstat-label">Goal</span></div>
                <div className="pstat"><span className="pstat-value">{daysLeft}</span><span className="pstat-label">Days left</span></div>
              </div>
            </div>
          </div>
          <div className="detail-sidebar">
            {campaign.isActive && (
              <div className="donate-card card">
                <h3 className="donate-title">Support this campaign</h3>
                <p className="donate-desc">Your contribution is secured by a {isSol ? "Solana" : "Ethereum"} smart contract.</p>
                <div className="donate-input-wrap">
                  <input className="form-input donate-input" type="number" step="0.001" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                  <span className="donate-currency">{currency}</span>
                </div>
                <div className="donate-presets">
                  {(isSol ? ["0.01","0.05","0.1"] : ["0.001","0.005","0.01"]).map(v => (
                    <button key={v} className="preset-btn" onClick={() => setAmount(v)}>{v} {currency}</button>
                  ))}
                </div>
                {error && <div className="form-error">{error}</div>}
                {success && <div className="form-success">{success}</div>}
                <button className="btn-gold donate-btn" onClick={handleDonate} disabled={donating}>
                  {donating ? "Processing..." : (isSol ? solConnected : ethConnected) ? "Donate Now" : "Connect & Donate"}
                </button>
                {!(isSol ? solConnected : ethConnected) && <p className="connect-hint">Click the button to connect your wallet</p>}
              </div>
            )}
            {isOwner && campaign.isActive && goalReached && !isSol && (
              <div className="withdraw-card card">
                <h3 className="withdraw-title">Goal reached!</h3>
                <p>You can now withdraw the funds to your wallet.</p>
                <button className="btn-primary withdraw-btn" onClick={handleWithdraw} disabled={withdrawing}>
                  {withdrawing ? "Processing..." : "Withdraw Funds"}
                </button>
              </div>
            )}
            <div className="contract-card card">
              <h4 className="contract-title">Smart Contract</h4>
              <div className="contract-item"><span className="contract-label">Network</span><span className="contract-value">{isSol ? "Solana Devnet" : "Ethereum Sepolia"}</span></div>
              <div className="contract-item"><span className="contract-label">Campaign ID</span><span className="contract-value mono" style={{fontSize:"11px"}}>{typeof id === "number" ? `#${id}` : id.slice(0,12) + "..."}</span></div>
              <div className="contract-item">
                <span className="contract-label">Explorer</span>
                <a className="contract-value" href={isSol ? `https://explorer.solana.com/address/${id}?cluster=devnet` : `https://sepolia.etherscan.io/address/${ETH_CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" style={{color:"var(--gold)", fontSize:"11px"}}>
                  {isSol ? "View on Solana Explorer" : "View on Etherscan"}
                </a>
              </div>
              <div className="contract-item"><span className="contract-label">Verified</span><span className="contract-value verified">On-chain</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
