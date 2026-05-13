import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import ConnectWalletModal from "../components/ConnectWalletModal";
import { useCryptoPrices } from "../hooks/useCryptoPrices";
import "./CampaignDetail.css";
import { CONTRACTS, SEPOLIA_RPC_URL, SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../config/chains";
import { getDaysLeft } from "../utils/time";

const UNIFIED_CONTRACT = CONTRACTS.unified;
const UNIFIED_ABI = [
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goalUSD,uint256 amountRaisedETH,bool isActive,uint256 deadline,string solanaAddress))",
  "function donate(uint256) payable",
  "function withdraw(uint256)",
];
const SEPOLIA_RPC = SEPOLIA_RPC_URL;
const SOL_PROGRAM_ID = SOLANA_PROGRAM_ID;

export default function UnifiedCampaignDetail({ ethConnected, ethAddress, solWallet, solConnected, onConnectEth, onConnectSol, onConnectSolflare }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { prices } = useCryptoPrices();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState(false);
  const [amount, setAmount] = useState("");
  const [donateChain, setDonateChain] = useState("eth");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);

  async function loadData() {
    try {
      const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
      const contract = new ethers.Contract(UNIFIED_CONTRACT, UNIFIED_ABI, provider);
      const c = await contract.getCampaign(Number(id));
      setCampaign({
        id: Number(id), owner: c.owner, title: c.title,
        description: c.description, goalUSD: Number(c.goalUSD),
        amountRaisedETH: c.amountRaisedETH, isActive: c.isActive,
        deadline: new Date(Number(c.deadline) * 1000),
        solanaAddress: c.solanaAddress,
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [id]);

  async function handleDonate() {
    setError(""); setSuccess("");
    if (donateChain === "eth" && !ethConnected) { setShowModal(true); return; }
    if (donateChain === "sol" && !solConnected) { setShowModal(true); return; }
    if (!amount || Number(amount) <= 0) { setError("Introdu o suma valida."); return; }

    setDonating(true);
    try {
      if (donateChain === "eth") {
        const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
        const provider = new ethers.BrowserProvider(metamask);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(UNIFIED_CONTRACT, UNIFIED_ABI, signer);
        const tx = await contract.donate(Number(id), { value: ethers.parseEther(amount) });
        await tx.wait();
        setSuccess("Donatie ETH efectuata cu succes!");
      } else if (donateChain === "sol" && campaign.solanaAddress) {
        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const provider = new anchor.AnchorProvider(connection, solWallet, { commitment: "confirmed" });
        anchor.setProvider(provider);
        const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, provider);
        const program = new anchor.Program(idl, provider);
        const campaignPubkey = new PublicKey(campaign.solanaAddress);
        const lamports = new anchor.BN(parseFloat(amount) * 1e9);
        await program.methods.donate(lamports).accounts({
          campaign: campaignPubkey,
          donor: solWallet.publicKey,
          systemProgram: SystemProgram.programId,
        }).rpc();
        setSuccess("Donatie SOL efectuata cu succes!");
      }
      setAmount("");
      await loadData();
    } catch (e) { setError(e.reason || e.message || "Tranzactie esuata."); }
    setDonating(false);
  }

  if (loading) return <div className="detail-loading"><div className="loading-spinner"></div><p>Se incarca...</p></div>;
  if (!campaign) return <div className="detail-loading"><p>Campanie negasita.</p></div>;

  const raisedUSD = (Number(campaign.amountRaisedETH) / 1e18) * prices.eth;
  const progress = Math.min((raisedUSD / campaign.goalUSD) * 100, 100);
  const daysLeft = getDaysLeft(campaign.deadline);
  const isOwner = ethAddress?.toLowerCase() === campaign.owner?.toLowerCase();

  return (
    <div className="detail-page">
      {showModal && <ConnectWalletModal onClose={() => setShowModal(false)} onConnectEth={() => { onConnectEth(); setShowModal(false); }} onConnectSol={() => { onConnectSol(); setShowModal(false); }} onConnectSolflare={() => { onConnectSolflare(); setShowModal(false); }} />}
      <div className="container">
        <button className="back-btn" onClick={() => navigate("/unified-campaigns")}>Back to Cross-Chain Campaigns</button>
        <div className="detail-layout">
          <div className="detail-main">
            <div className="detail-badges">
              <span className="badge badge-eth">ETH</span>
              {campaign.solanaAddress && <span className="badge badge-sol">SOL</span>}
              <span className="badge" style={{background:"rgba(201,168,76,0.15)", color:"var(--gold)"}}>CROSS-CHAIN</span>
              <span className={`badge badge-${campaign.isActive ? "active" : "inactive"}`}>{campaign.isActive ? "Activa" : "Inchisa"}</span>
            </div>
            <h1 className="detail-title">{campaign.title}</h1>
            <div className="divider"></div>
            <div className="detail-meta">
              <div className="meta-item"><span className="meta-label">Owner</span><span className="meta-value mono">{campaign.owner}</span></div>
              <div className="meta-item"><span className="meta-label">Deadline</span><span className="meta-value">{campaign.deadline.toLocaleDateString("en-GB", {day:"numeric", month:"long", year:"numeric"})} - {daysLeft} zile ramase</span></div>
              {campaign.solanaAddress && <div className="meta-item"><span className="meta-label">Solana Address</span><span className="meta-value mono" style={{fontSize:"12px"}}>{campaign.solanaAddress}</span></div>}
            </div>
            <div className="detail-description"><h3>Despre aceasta campanie</h3><p>{campaign.description}</p></div>
            <div className="detail-progress card">
              <div className="progress-header">
                <div>
                  <span className="progress-raised">${raisedUSD.toFixed(2)}</span>
                  <span className="progress-label"> strans din ${campaign.goalUSD} USD goal</span>
                </div>
                <span className="progress-pct">{progress.toFixed(1)}%</span>
              </div>
              <div className="progress-bar" style={{height:"10px", margin:"16px 0"}}><div className="progress-fill" style={{width:`${progress}%`}}></div></div>
              <div className="progress-stats">
                <div className="pstat"><span className="pstat-value">${raisedUSD.toFixed(2)}</span><span className="pstat-label">Strans USD</span></div>
                <div className="pstat"><span className="pstat-value">${campaign.goalUSD}</span><span className="pstat-label">Goal USD</span></div>
                <div className="pstat"><span className="pstat-value">{daysLeft}</span><span className="pstat-label">Zile ramase</span></div>
              </div>
            </div>
          </div>

          <div className="detail-sidebar">
            {campaign.isActive && (
              <div className="donate-card card">
                <h3 className="donate-title">Sustine aceasta campanie</h3>
                <p className="donate-desc">Doneaza in ETH sau SOL — progresul e unificat in USD.</p>

                <div className="chain-selector" style={{marginBottom:"16px"}}>
                  <button className={donateChain === "eth" ? "chain-btn active" : "chain-btn"} onClick={() => setDonateChain("eth")} style={{padding:"12px"}}>
                    <span className="chain-name">ETH</span>
                    <span className="chain-sub">Ethereum</span>
                  </button>
                  <button className={donateChain === "sol" ? "chain-btn active" : "chain-btn"} onClick={() => setDonateChain("sol")} style={{padding:"12px"}} disabled={!campaign.solanaAddress}>
                    <span className="chain-name">SOL</span>
                    <span className="chain-sub">Solana</span>
                  </button>
                </div>

                <div className="donate-input-wrap">
                  <input className="form-input donate-input" type="number" step="0.001" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                  <span className="donate-currency">{donateChain === "eth" ? "ETH" : "SOL"}</span>
                </div>

                {amount && prices[donateChain] > 0 && (
                  <p style={{fontSize:"12px", color:"var(--text-muted)", marginBottom:"12px", textAlign:"right"}}>
                    ≈ ${(parseFloat(amount || 0) * prices[donateChain === "eth" ? "eth" : "sol"]).toFixed(2)} USD
                  </p>
                )}

                <div className="donate-presets">
                  {(donateChain === "sol" ? ["0.01","0.05","0.1"] : ["0.001","0.005","0.01"]).map(v => (
                    <button key={v} className="preset-btn" onClick={() => setAmount(v)}>{v} {donateChain === "eth" ? "ETH" : "SOL"}</button>
                  ))}
                </div>

                {error && <div className="form-error">{error}</div>}
                {success && <div className="form-success">{success}</div>}

                <button className="btn-gold donate-btn" onClick={handleDonate} disabled={donating}>
                  {donating ? "Se proceseaza..." : "Doneaza"}
                </button>
              </div>
            )}

            {isOwner && campaign.isActive && (
              <div className="withdraw-card card">
                <h3 className="withdraw-title">Retrage fondurile ETH</h3>
                <p>Retrage toate donatiile ETH primite.</p>
                <button className="btn-primary withdraw-btn" onClick={async () => {
                  try {
                    const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
                    const provider = new ethers.BrowserProvider(metamask);
                    const signer = await provider.getSigner();
                    const contract = new ethers.Contract(UNIFIED_CONTRACT, UNIFIED_ABI, signer);
                    const tx = await contract.withdraw(Number(id));
                    await tx.wait();
                    setSuccess("Fonduri retrase cu succes!");
                    await loadData();
                  } catch (e) { setError(e.reason || e.message); }
                }}>
                  Retrage ETH
                </button>
              </div>
            )}

            <div className="contract-card card">
              <h4 className="contract-title">Smart Contract</h4>
              <div className="contract-item"><span className="contract-label">ETH Network</span><span className="contract-value">Ethereum Sepolia</span></div>
              {campaign.solanaAddress && <div className="contract-item"><span className="contract-label">SOL Network</span><span className="contract-value">Solana Devnet</span></div>}
              <div className="contract-item">
                <span className="contract-label">Etherscan</span>
                <a href={`https://sepolia.etherscan.io/address/${UNIFIED_CONTRACT}`} target="_blank" rel="noreferrer" style={{color:"var(--gold)", fontSize:"11px"}}>View on Etherscan</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
