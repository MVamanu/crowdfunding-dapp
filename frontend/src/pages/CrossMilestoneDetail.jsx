import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import ConnectWalletModal from "../components/ConnectWalletModal";
import { useCryptoPrices } from "../hooks/useCryptoPrices";
import "./MilestoneCampaignDetail.css";
import { CONTRACTS, SEPOLIA_RPC_URL, SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../config/chains";

const CROSS_CONTRACT = CONTRACTS.crossMilestone;
const CROSS_ABI = [
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goalUSD,uint256 amountRaisedETH,uint256 amountRaisedSOLusd,bool isActive,uint256 deadline,string solanaAddress,uint256 milestoneCount,uint256 currentMilestone,string primaryChain))",
  "function getMilestone(uint256,uint256) view returns (tuple(string title,string description,uint256 amountUSD,bool completed,bool approved,uint256 votesFor,uint256 votesAgainst,uint256 votingDeadline,bool votingActive))",
  "function getDonation(uint256,address) view returns (uint256)",
  "function donateETH(uint256) payable",
  "function recordSolDonation(uint256,uint256)",
  "function submitMilestone(uint256)",
  "function vote(uint256,uint256,bool)",
  "function finalizeMilestone(uint256,uint256)",
];
const SEPOLIA_RPC = SEPOLIA_RPC_URL;
const SOL_PROGRAM_ID = SOLANA_PROGRAM_ID;

export default function CrossMilestoneDetail({ ethConnected, ethAddress, ethContract, solWallet, solConnected, onConnectEth, onConnectSol, onConnectSolflare }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { prices } = useCryptoPrices();
  const [campaign, setCampaign] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState(false);
  const [voting, setVoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [donateChain, setDonateChain] = useState("eth");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [userDonationETH, setUserDonationETH] = useState("0");

  async function loadData() {
    try {
      const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
      const contract = new ethers.Contract(CROSS_CONTRACT, CROSS_ABI, provider);
      const c = await contract.getCampaign(Number(id));
      const camp = {
        id: Number(id), owner: c.owner, title: c.title, description: c.description,
        goalUSD: Number(c.goalUSD), amountRaisedETH: c.amountRaisedETH,
        amountRaisedSOLusd: Number(c.amountRaisedSOLusd),
        isActive: c.isActive, deadline: new Date(Number(c.deadline) * 1000),
        solanaAddress: c.solanaAddress, milestoneCount: Number(c.milestoneCount),
        currentMilestone: Number(c.currentMilestone), primaryChain: c.primaryChain,
      };
      setCampaign(camp);

      const ms = [];
      for (let i = 0; i < camp.milestoneCount; i++) {
        const m = await contract.getMilestone(Number(id), i);
        ms.push({ index: i, title: m.title, description: m.description,
          amountUSD: Number(m.amountUSD), completed: m.completed, approved: m.approved,
          votesFor: m.votesFor, votesAgainst: m.votesAgainst,
          votingDeadline: Number(m.votingDeadline), votingActive: m.votingActive });
      }
      setMilestones(ms);

      if (ethAddress) {
        const donation = await contract.getDonation(Number(id), ethAddress);
        setUserDonationETH(donation.toString());
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [id, ethAddress, prices]);

  async function getSignerContract() {
    const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
    const provider = new ethers.BrowserProvider(metamask);
    const signer = await provider.getSigner();
    return new ethers.Contract(CROSS_CONTRACT, CROSS_ABI, signer);
  }

  async function handleDonate() {
    setError(""); setSuccess("");

    if (donateChain === "eth") {
      if (!ethConnected) { setShowModal(true); return; }
      if (!amount || Number(amount) <= 0) { setError("Introdu o suma valida."); return; }
      setDonating(true);
      try {
        const contract = await getSignerContract();
        const tx = await contract.donateETH(Number(id), { value: ethers.parseEther(amount) });
        await tx.wait();
        setSuccess("Donatie ETH efectuata cu succes!");
        setAmount("");
        await loadData();
      } catch (e) { setError(e.reason || e.message || "Eroare."); }
      setDonating(false);
    } else if (donateChain === "sol") {
      if (!solConnected || !solWallet) { setShowModal(true); return; }
      if (!amount || Number(amount) <= 0) { setError("Introdu o suma valida."); return; }
      if (!campaign.solanaAddress) { setError("Aceasta campanie nu accepta donatii SOL."); return; }
      setDonating(true);
      try {
        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const provider = new anchor.AnchorProvider(connection, solWallet, { commitment: "confirmed" });
        anchor.setProvider(provider);
        const connection2 = new Connection(SOLANA_RPC_URL, "confirmed");
        const ownerPubkey = new PublicKey(campaign.solanaAddress);
        const lamports = Math.round(parseFloat(amount) * 1e9);

        const transaction = new anchor.web3.Transaction().add(
          anchor.web3.SystemProgram.transfer({
            fromPubkey: solWallet.publicKey,
            toPubkey: ownerPubkey,
            lamports,
          })
        );
        transaction.recentBlockhash = (await connection2.getLatestBlockhash()).blockhash;
        transaction.feePayer = solWallet.publicKey;
        const signed = await solWallet.signTransaction(transaction);
        await connection2.sendRawTransaction(signed.serialize());

        const amountUSD = Math.round(parseFloat(amount) * prices.sol);
        const ethContract = await getSignerContract();
        const tx = await ethContract.recordSolDonation(Number(id), BigInt(amountUSD));
        await tx.wait();

        setSuccess(`Donatie SOL efectuata! ~$${amountUSD} USD inregistrat on-chain.`);
        setAmount("");
        await loadData();
      } catch (e) { setError(e.message || "Eroare donatie SOL."); }
      setDonating(false);
    }
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
    } catch (e) { setError(e.reason || e.message || "Eroare."); }
  }

  if (loading) return <div className="detail-loading"><div className="loading-spinner"></div><p>Se incarca...</p></div>;
  if (!campaign) return <div className="detail-loading"><p>Campanie negasita.</p></div>;

  const raisedETHusd = (Number(campaign.amountRaisedETH) / 1e18) * prices.eth;
  const totalRaisedUSD = raisedETHusd + campaign.amountRaisedSOLusd;
  const progress = Math.min((totalRaisedUSD / campaign.goalUSD) * 100, 100);
  const daysLeft = Math.max(0, Math.ceil((campaign.deadline - Date.now()) / 86400000));
  const isOwner = ethAddress?.toLowerCase() === campaign.owner?.toLowerCase();
  const isDonorETH = BigInt(userDonationETH) > 0n;
  const currentM = milestones[campaign.currentMilestone];

  return (
    <div className="detail-page">
      {showModal && <ConnectWalletModal onClose={() => setShowModal(false)} onConnectEth={() => { onConnectEth(); setShowModal(false); }} onConnectSol={() => { onConnectSol(); setShowModal(false); }} onConnectSolflare={() => { onConnectSolflare(); setShowModal(false); }} />}
      <div className="container">
        <button className="back-btn" onClick={() => navigate("/kickstart")}>Back to Kickstart</button>
        <div className="detail-layout">
          <div className="detail-main">
            <div className="detail-badges">
              <span className="badge badge-eth">ETH</span>
              {campaign.solanaAddress && <span className="badge badge-sol">SOL</span>}
              <span className="badge" style={{background:"rgba(201,168,76,0.15)", color:"var(--gold)"}}>CROSS MILESTONE</span>
              <span className={`badge badge-${campaign.isActive ? "active" : "inactive"}`}>{campaign.isActive ? "Activa" : "Inchisa"}</span>
            </div>
            <h1 className="detail-title">{campaign.title}</h1>
            <div className="divider"></div>
            <div className="detail-meta">
              <div className="meta-item"><span className="meta-label">Owner</span><span className="meta-value mono">{campaign.owner}</span></div>
              <div className="meta-item"><span className="meta-label">Deadline</span><span className="meta-value">{campaign.deadline.toLocaleDateString("en-GB", {day:"numeric", month:"long", year:"numeric"})} - {daysLeft} zile</span></div>
              {campaign.solanaAddress && <div className="meta-item"><span className="meta-label">Solana Address</span><span className="meta-value mono" style={{fontSize:"11px"}}>{campaign.solanaAddress}</span></div>}
            </div>
            <div className="detail-description"><h3>Despre aceasta campanie</h3><p>{campaign.description}</p></div>

            <div className="detail-progress card">
              <div className="progress-header">
                <div>
                  <span className="progress-raised">${totalRaisedUSD.toFixed(2)}</span>
                  <span className="progress-label"> strans din ${campaign.goalUSD} USD</span>
                </div>
                <span className="progress-pct">{progress.toFixed(1)}%</span>
              </div>
              <div className="progress-bar" style={{height:"10px", margin:"16px 0"}}><div className="progress-fill" style={{width:`${progress}%`}}></div></div>
              <div className="progress-stats">
                <div className="pstat"><span className="pstat-value">${raisedETHusd.toFixed(2)}</span><span className="pstat-label">Din ETH</span></div>
                <div className="pstat"><span className="pstat-value">${campaign.amountRaisedSOLusd.toFixed(2)}</span><span className="pstat-label">Din SOL</span></div>
                <div className="pstat"><span className="pstat-value">{campaign.currentMilestone}/{campaign.milestoneCount}</span><span className="pstat-label">Etape</span></div>
              </div>
            </div>

            <div className="milestones-timeline">
              <h3 className="milestones-title">Etape Campanie</h3>
              {milestones.map((m, i) => (
                <div key={i} className={`timeline-item ${m.completed && m.approved ? "approved" : m.votingActive ? "voting" : i === campaign.currentMilestone ? "current" : ""}`}>
                  <div className="timeline-marker">{m.completed && m.approved ? "OK" : m.votingActive ? "?" : i + 1}</div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <h4 className="timeline-title">{m.title}</h4>
                      <span className="timeline-amount">${m.amountUSD} USD</span>
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
                        {isDonorETH && (
                          <div className="vote-actions">
                            <button className="vote-btn approve" onClick={() => handleVote(i, true)} disabled={voting}>Aproba</button>
                            <button className="vote-btn reject" onClick={() => handleVote(i, false)} disabled={voting}>Respinge</button>
                          </div>
                        )}
                        <button className="finalize-btn" onClick={() => handleFinalize(i)}>Finalizeaza votul</button>
                        {!isDonorETH && <p style={{fontSize:"12px", color:"var(--text-muted)", marginTop:"8px"}}>Doar donatorii ETH pot vota direct.</p>}
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
                <p className="donate-desc">Doneaza in ETH sau SOL - progresul e unificat in USD.</p>

                <div className="chain-selector" style={{marginBottom:"16px"}}>
                  <button className={donateChain === "eth" ? "chain-btn active" : "chain-btn"} onClick={() => setDonateChain("eth")} style={{padding:"12px"}}>
                    <span className="chain-name">ETH</span>
                    <span className="chain-sub">+ Drept de vot</span>
                  </button>
                  <button className={donateChain === "sol" ? "chain-btn active" : "chain-btn"} onClick={() => setDonateChain("sol")} style={{padding:"12px"}} disabled={!campaign.solanaAddress}>
                    <span className="chain-name">SOL</span>
                    <span className="chain-sub">{campaign.solanaAddress ? "Acceptat" : "Indisponibil"}</span>
                  </button>
                </div>

                <div className="donate-input-wrap">
                  <input className="form-input donate-input" type="number" step="0.001" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                  <span className="donate-currency">{donateChain === "eth" ? "ETH" : "SOL"}</span>
                </div>

                {amount && prices[donateChain] > 0 && (
                  <p style={{fontSize:"12px", color:"var(--text-muted)", marginBottom:"12px", textAlign:"right"}}>
                    aprox. ${(parseFloat(amount || 0) * (donateChain === "eth" ? prices.eth : prices.sol)).toFixed(2)} USD
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

                {donateChain === "eth" && isDonorETH && (
                  <p className="donor-badge">Ai donat {ethers.formatEther(userDonationETH)} ETH - Poti vota!</p>
                )}
                {donateChain === "sol" && <p style={{fontSize:"11px", color:"var(--text-muted)", marginTop:"8px", textAlign:"center"}}>Donatiile SOL sunt convertite in USD si inregistrate pe ETH.</p>}
              </div>
            )}

            {isOwner && campaign.isActive && currentM && !currentM.votingActive && !currentM.completed && (
              <div className="withdraw-card card">
                <h3 className="withdraw-title">Etapa {campaign.currentMilestone + 1} gata?</h3>
                <p>Submite pentru aprobare prin vot ETH.</p>
                <button className="btn-primary withdraw-btn" onClick={handleSubmitMilestone} disabled={submitting}>
                  {submitting ? "Se proceseaza..." : "Submite Milestone"}
                </button>
              </div>
            )}

            <div className="contract-card card">
              <h4 className="contract-title">Cross-Chain Info</h4>
              <div className="contract-item"><span className="contract-label">ETH Network</span><span className="contract-value">Ethereum Sepolia</span></div>
              {campaign.solanaAddress && <div className="contract-item"><span className="contract-label">SOL Network</span><span className="contract-value">Solana Devnet</span></div>}
              <div className="contract-item"><span className="contract-label">Vot pe</span><span className="contract-value">Ethereum</span></div>
              <div className="contract-item"><span className="contract-label">Etapa curenta</span><span className="contract-value">{campaign.currentMilestone + 1}/{campaign.milestoneCount}</span></div>
              <div className="contract-item">
                <span className="contract-label">Contract</span>
                <a href={`https://sepolia.etherscan.io/address/${CROSS_CONTRACT}`} target="_blank" rel="noreferrer" style={{color:"var(--gold)", fontSize:"11px"}}>View on Etherscan</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
