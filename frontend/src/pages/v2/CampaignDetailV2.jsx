import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import ConnectWalletModal from "../../components/ConnectWalletModal";
import "../CampaignDetail.css";
import "./V2.css";

const STABLE_V2_CONTRACT = "0xE3Ae8c1BF26e6bAfe7EDc5143Cd288B9DF4C1e40";
const STABLE_V2_ABI = [
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goalUSDC,uint256 amountRaisedLocal,uint256 amountRaisedExternal,bool isActive,uint256 deadline,bool goalReached,string mainChain,string[] acceptedChains))",
  "function donateLocal(uint256,uint256)",
  "function withdraw(uint256)",
  "function refund(uint256)",
  "function recordExternalDonation(uint256,uint256,string)",
  "function getDonation(uint256,address) view returns (uint256)",
  "function getTotalRaised(uint256) view returns (uint256)",
  "function getExternalDonations(uint256,string) view returns (uint256)",
];
const USDC_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const USDC_DEVNET = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const SOL_PROGRAM_ID = new PublicKey("9Q26M3XJE9pveumjKK4VxMfBu8EQXPnqHHTNXfSU5kEi");
const SEPOLIA_RPC = "https://eth-sepolia.g.alchemy.com/v2/FnqvmZrEEWYvwZaX3dk0zPlUNi7_Ggdm";
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export default function CampaignDetailV2({ ethConnected, ethAddress, solWallet, solConnected, onConnectEth, onConnectSol, onConnectSolflare }) {
  const { blockchain, id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [donating, setDonating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [userDonation, setUserDonation] = useState("0");
  const [step, setStep] = useState("approve");
  const [solDonations, setSolDonations] = useState("0");
  const [donateChain, setDonateChain] = useState(blockchain || "eth");

  async function loadEthCampaign() {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const contract = new ethers.Contract(STABLE_V2_CONTRACT, STABLE_V2_ABI, provider);
    const c = await contract.getCampaign(Number(id));
    const total = await contract.getTotalRaised(Number(id));
    const solExt = await contract.getExternalDonations(Number(id), "sol");
    setSolDonations(solExt.toString());
    if (ethAddress) {
      const donation = await contract.getDonation(Number(id), ethAddress);
      setUserDonation(donation.toString());
      const usdc = new ethers.Contract(USDC_SEPOLIA, USDC_ABI, provider);
      const allow = await usdc.allowance(ethAddress, STABLE_V2_CONTRACT);
      if (BigInt(allow) > 0n) setStep("donate");
    }
    return {
      id: Number(id), owner: c.owner, title: c.title, description: c.description,
      goalUSDC: c.goalUSDC, amountRaisedLocal: c.amountRaisedLocal,
      amountRaisedExternal: c.amountRaisedExternal, totalRaised: total,
      isActive: c.isActive, deadline: new Date(Number(c.deadline) * 1000),
      goalReached: c.goalReached, mainChain: c.mainChain,
      acceptedChains: c.acceptedChains, blockchain: "eth",
    };
  }

  async function loadSolCampaign() {
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const dummyWallet = { publicKey: PublicKey.default, signTransaction: async t => t, signAllTransactions: async t => t };
    const prov = new anchor.AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
    anchor.setProvider(prov);
    const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, prov);
    if (!idl) throw new Error("IDL nu a putut fi obtinut");
    const program = new anchor.Program(idl, prov);
    const pubkey = new PublicKey(id);
    const c = await program.account.usdcCampaign.fetch(pubkey);
    return {
      id, owner: c.owner.toString(), title: c.title, description: c.description,
      goalUSDC: BigInt(c.goal.toString()), amountRaisedLocal: BigInt(c.amountRaised.toString()),
      amountRaisedExternal: 0n, totalRaised: BigInt(c.amountRaised.toString()),
      isActive: c.isActive, deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      goalReached: c.goalReached, mainChain: "sol",
      acceptedChains: ["sol", "eth"], blockchain: "sol",
    };
  }

  async function loadData() {
    setLoading(true);
    try {
      const data = blockchain === "sol" ? await loadSolCampaign() : await loadEthCampaign();
      setCampaign(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [id, blockchain, ethAddress]);

  async function getEthSigner() {
    const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
    const provider = new ethers.BrowserProvider(metamask);
    return provider.getSigner();
  }

  async function handleApproveEth() {
    setError(""); setSuccess("");
    if (!ethConnected) { setShowModal(true); return; }
    if (!amount || Number(amount) <= 0) { setError("Introdu o suma valida."); return; }
    setApproving(true);
    try {
      const signer = await getEthSigner();
      const usdc = new ethers.Contract(USDC_SEPOLIA, USDC_ABI, signer);
      const amountInUsdc = BigInt(Math.round(parseFloat(amount) * 1_000_000));
      const tx = await usdc.approve(STABLE_V2_CONTRACT, amountInUsdc);
      await tx.wait();
      setSuccess("Approve reusit! Acum poti dona.");
      setStep("donate");
    } catch (e) { setError(e.reason || e.message || "Eroare approve."); }
    setApproving(false);
  }

  async function handleDonateEth() {
    setError(""); setSuccess("");
    if (!ethConnected) { setShowModal(true); return; }
    if (!amount || Number(amount) <= 0) { setError("Introdu o suma valida."); return; }
    setDonating(true);
    try {
      const signer = await getEthSigner();
      const contract = new ethers.Contract(STABLE_V2_CONTRACT, STABLE_V2_ABI, signer);
      const amountInUsdc = BigInt(Math.round(parseFloat(amount) * 1_000_000));
      const tx = await contract.donateLocal(Number(id), amountInUsdc);
      await tx.wait();
      setSuccess("Donatie ETH USDC efectuata!");
      setAmount(""); setStep("approve");
      await loadData();
    } catch (e) { setError(e.reason || e.message || "Eroare donatie."); }
    setDonating(false);
  }

  async function handleDonateSol() {
    setError(""); setSuccess("");
    if (!solConnected || !solWallet) { setShowModal(true); return; }
    if (!amount || Number(amount) <= 0) { setError("Introdu o suma valida."); return; }
    setDonating(true);
    try {
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      const provider = new anchor.AnchorProvider(connection, solWallet, { commitment: "confirmed" });
      anchor.setProvider(provider);
      const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, provider);
      const program = new anchor.Program(idl, provider);
      const campaignPubkey = new PublicKey(blockchain === "sol" ? id : campaign.solanaAddress);
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), campaignPubkey.toBuffer()], SOL_PROGRAM_ID
      );
      const donorTokenAccount = await anchor.utils.token.associatedAddress({
        mint: USDC_DEVNET, owner: solWallet.publicKey
      });
      const amountBN = new anchor.BN(Math.round(parseFloat(amount) * 1_000_000));
      await program.methods.donateUsdc(amountBN)
        .accounts({
          usdcCampaign: campaignPubkey,
          vault: vaultPDA,
          donorTokenAccount,
          donor: solWallet.publicKey,
          donorUsdcAccount: (await PublicKey.findProgramAddressSync(
            [Buffer.from("donor_usdc"), campaignPubkey.toBuffer(), solWallet.publicKey.toBuffer()],
            SOL_PROGRAM_ID
          ))[0],
          tokenProgram: TOKEN_PROGRAM,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      setSuccess("Donatie SOL USDC efectuata!");
      setAmount("");
      await loadData();
    } catch (e) { setError(e.message || "Eroare donatie SOL."); }
    setDonating(false);
  }

  async function handleWithdraw() {
    setError(""); setSuccess("");
    try {
      const signer = await getEthSigner();
      const contract = new ethers.Contract(STABLE_V2_CONTRACT, STABLE_V2_ABI, signer);
      const tx = await contract.withdraw(Number(id));
      await tx.wait();
      setSuccess("Fonduri USDC retrase!");
      await loadData();
    } catch (e) { setError(e.reason || e.message); }
  }

  async function handleRecordSol() {
    setError(""); setSuccess("");
    if (!amount || Number(amount) <= 0) { setError("Introdu suma SOL USDC de inregistrat."); return; }
    setRecording(true);
    try {
      const signer = await getEthSigner();
      const contract = new ethers.Contract(STABLE_V2_CONTRACT, STABLE_V2_ABI, signer);
      const amountInUsdc = BigInt(Math.round(parseFloat(amount) * 1_000_000));
      const tx = await contract.recordExternalDonation(Number(id), amountInUsdc, "sol");
      await tx.wait();
      setSuccess("Donatie SOL inregistrata pe ETH!");
      setAmount("");
      await loadData();
    } catch (e) { setError(e.reason || e.message); }
    setRecording(false);
  }

  async function handleRefund() {
    try {
      const signer = await getEthSigner();
      const contract = new ethers.Contract(STABLE_V2_CONTRACT, STABLE_V2_ABI, signer);
      const tx = await contract.refund(Number(id));
      await tx.wait();
      setSuccess("Refund USDC efectuat!");
      await loadData();
    } catch (e) { setError(e.reason || e.message); }
  }

  if (loading) return <div className="detail-loading"><div className="loading-spinner"></div><p>Se incarca...</p></div>;
  if (!campaign) return <div className="detail-loading"><p>Campanie negasita.</p></div>;

  const totalRaised = Number(campaign.totalRaised || 0n);
  const goal = Number(campaign.goalUSDC || 0n);
  const progress = Math.min(goal > 0 ? (totalRaised / goal) * 100 : 0, 100);
  const goalUSDC = (goal / 1_000_000).toFixed(2);
  const raisedUSDC = (totalRaised / 1_000_000).toFixed(2);
  const raisedLocal = (Number(campaign.amountRaisedLocal || 0n) / 1_000_000).toFixed(2);
  const raisedExternal = (Number(campaign.amountRaisedExternal || 0n) / 1_000_000).toFixed(2);
  const daysLeft = Math.max(0, Math.ceil((campaign.deadline - Date.now()) / 86400000));
  const isOwner = blockchain === "eth"
    ? ethAddress?.toLowerCase() === campaign.owner?.toLowerCase()
    : solWallet?.publicKey?.toString() === campaign.owner;
  const isDonor = BigInt(userDonation) > 0n;
  const isExpired = campaign.deadline < Date.now();
  const chainColor = blockchain === "sol" ? "#9945FF" : "#2775CA";

  return (
    <div className="detail-page">
      {showModal && <ConnectWalletModal onClose={() => setShowModal(false)}
        onConnectEth={() => { onConnectEth(); setShowModal(false); }}
        onConnectSol={onConnectSol} onConnectSolflare={onConnectSolflare} />}
      <div className="container">
        <button className="back-btn" onClick={() => navigate("/v2")}>← Campanii USDC</button>
        <div className="detail-layout">
          <div className="detail-main">
            <div className="detail-badges">
              <span className="badge badge-usdc">USDC</span>
              <span className="badge" style={{background:`${chainColor}20`, color:chainColor, border:`1px solid ${chainColor}40`}}>
                {blockchain === "sol" ? "Solana" : "Ethereum"}
              </span>
              <span className="badge" style={{background: campaign.mainChain === blockchain ? "rgba(39,117,202,0.1)" : "rgba(153,69,255,0.1)", color: campaign.mainChain === blockchain ? "#2775CA" : "#9945FF", border:"1px solid rgba(0,0,0,0.1)"}}>
                {campaign.mainChain === blockchain ? "Main Chain" : "Secondary Chain"}
              </span>
              <span className={`badge badge-${campaign.isActive ? "active" : "inactive"}`}>
                {campaign.goalReached ? "Goal Atins" : campaign.isActive ? "Activa" : "Inchisa"}
              </span>
            </div>

            <h1 className="detail-title">{campaign.title}</h1>
            <div className="divider"></div>

            <div className="detail-meta">
              <div className="meta-item"><span className="meta-label">Owner</span><span className="meta-value mono">{campaign.owner?.slice(0,8)}...{campaign.owner?.slice(-6)}</span></div>
              <div className="meta-item"><span className="meta-label">Main Chain</span><span className="meta-value" style={{color:chainColor, fontWeight:"600"}}>{campaign.mainChain?.toUpperCase()}</span></div>
              <div className="meta-item"><span className="meta-label">Deadline</span><span className="meta-value">{campaign.deadline.toLocaleDateString("en-GB")} — {daysLeft} zile</span></div>
              <div className="meta-item"><span className="meta-label">Accepta donatii din</span><span className="meta-value">{campaign.acceptedChains?.join(", ").toUpperCase()} USDC</span></div>
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
                <div className="pstat"><span className="pstat-value">${raisedLocal}</span><span className="pstat-label">ETH USDC</span></div>
                <div className="pstat"><span className="pstat-value">${raisedExternal}</span><span className="pstat-label">SOL USDC</span></div>
                <div className="pstat"><span className="pstat-value">${goalUSDC}</span><span className="pstat-label">Goal</span></div>
                <div className="pstat"><span className="pstat-value">{daysLeft}</span><span className="pstat-label">Zile</span></div>
              </div>
            </div>
          </div>

          <div className="detail-sidebar">
            {campaign.isActive && !campaign.goalReached && (
              <div className="donate-card card">
                <h3 className="donate-title">Sustine cu USDC</h3>

                {campaign.acceptedChains?.length > 1 && (
                  <div style={{display:"flex", gap:"6px", marginBottom:"12px"}}>
                    {campaign.acceptedChains.map(c => (
                      <button key={c} onClick={() => setDonateChain(c)} style={{
                        flex:1, padding:"8px", borderRadius:"var(--radius-lg)", cursor:"pointer",
                        border:`2px solid ${donateChain === c ? (c === "eth" ? "#2775CA" : "#9945FF") : "var(--border)"}`,
                        background: donateChain === c ? (c === "eth" ? "rgba(39,117,202,0.1)" : "rgba(153,69,255,0.1)") : "var(--cream)",
                        fontWeight:"600", fontSize:"13px",
                        color: donateChain === c ? (c === "eth" ? "#2775CA" : "#9945FF") : "var(--text-muted)"
                      }}>
                        {c.toUpperCase()} USDC
                      </button>
                    ))}
                  </div>
                )}

                {donateChain === "eth" && (
                  <div className="usdc-note" style={{marginBottom:"12px"}}>
                    <span>{step === "approve" ? "Pas 1/2: Aproba USDC" : "Pas 2/2: Doneaza"}</span>
                  </div>
                )}

                <div className="donate-input-wrap">
                  <input className="form-input donate-input" type="number" step="1" min="0"
                    placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
                  <span className="donate-currency">USDC</span>
                </div>

                <div className="donate-presets">
                  {["10","50","100"].map(v => (
                    <button key={v} className="preset-btn" onClick={() => setAmount(v)}>${v}</button>
                  ))}
                </div>

                {error && <div className="form-error">{error}</div>}
                {success && <div className="form-success">{success}</div>}

                {donateChain === "eth" ? (
                  step === "approve" ? (
                    <button className="btn-usdc donate-btn" style={{width:"100%", justifyContent:"center"}}
                      onClick={handleApproveEth} disabled={approving}>
                      {approving ? "Se proceseaza..." : ethConnected ? "1. Aproba ETH USDC" : "Conecteaza MetaMask"}
                    </button>
                  ) : (
                    <button className="btn-usdc donate-btn" style={{width:"100%", justifyContent:"center"}}
                      onClick={handleDonateEth} disabled={donating}>
                      {donating ? "Se proceseaza..." : "2. Doneaza ETH USDC"}
                    </button>
                  )
                ) : (
                  <button className="btn-usdc donate-btn" style={{width:"100%", justifyContent:"center", background:"#9945FF"}}
                    onClick={handleDonateSol} disabled={donating}>
                    {donating ? "Se proceseaza..." : solConnected ? "Doneaza SOL USDC" : "Conecteaza Phantom/Solflare"}
                  </button>
                )}
              </div>
            )}

            {isOwner && campaign.isActive && !campaign.goalReached && blockchain === "eth" && (
              <div className="withdraw-card card" style={{marginTop:"12px"}}>
                <h3 className="withdraw-title" style={{fontSize:"14px"}}>Inregistreaza donatie SOL</h3>
                <p style={{fontSize:"12px", color:"var(--text-muted)", marginBottom:"8px"}}>
                  Dupa confirmarea donatiei SOL pe Solana Explorer, inregistreaz-o aici.
                </p>
                <div className="donate-input-wrap">
                  <input className="form-input donate-input" type="number" step="1" min="0"
                    placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
                  <span className="donate-currency">USDC</span>
                </div>
                <button className="btn-usdc" style={{width:"100%", justifyContent:"center", marginTop:"8px", background:"#9945FF"}}
                  onClick={handleRecordSol} disabled={recording}>
                  {recording ? "Se proceseaza..." : "Inregistreaza SOL USDC"}
                </button>
              </div>
            )}

            {isOwner && campaign.goalReached && campaign.isActive && blockchain === "eth" && (
              <div className="withdraw-card card">
                <h3 className="withdraw-title">Goal atins! 🎉</h3>
                <p>Retrage ${raisedLocal} USDC din Ethereum.</p>
                <button className="btn-usdc" style={{width:"100%", justifyContent:"center"}} onClick={handleWithdraw}>
                  Retrage ETH USDC
                </button>
              </div>
            )}

            {isDonor && isExpired && !campaign.goalReached && blockchain === "eth" && (
              <div className="withdraw-card card">
                <h3 className="withdraw-title">Campanie expirata</h3>
                <p>Recupereaza ${(Number(userDonation) / 1_000_000).toFixed(2)} USDC.</p>
                <button className="btn-usdc" style={{width:"100%", justifyContent:"center", background:"#e53e3e"}}
                  onClick={handleRefund}>Recupereaza USDC</button>
              </div>
            )}

            <div className="contract-card card">
              <h4 className="contract-title">Contract Info</h4>
              <div className="contract-item"><span className="contract-label">Token</span><span className="contract-value">USDC (6 decimale)</span></div>
              <div className="contract-item"><span className="contract-label">Main Chain</span><span className="contract-value" style={{color:chainColor}}>{campaign.mainChain?.toUpperCase()}</span></div>
              <div className="contract-item"><span className="contract-label">Accepta</span><span className="contract-value">{campaign.acceptedChains?.join(" + ").toUpperCase()}</span></div>
              {blockchain === "eth" && (
                <div className="contract-item">
                  <span className="contract-label">Etherscan</span>
                  <a href={`https://sepolia.etherscan.io/address/${STABLE_V2_CONTRACT}`} target="_blank" rel="noreferrer" style={{color:"#2775CA", fontSize:"11px"}}>View Contract</a>
                </div>
              )}
              {blockchain === "sol" && (
                <div className="contract-item">
                  <span className="contract-label">Explorer</span>
                  <a href={`https://explorer.solana.com/address/${id}?cluster=devnet`} target="_blank" rel="noreferrer" style={{color:"#9945FF", fontSize:"11px"}}>View on Solana</a>
                </div>
              )}
              {isDonor && <div className="contract-item"><span className="contract-label">Donatia ta</span><span className="contract-value">${(Number(userDonation) / 1_000_000).toFixed(2)} USDC</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
