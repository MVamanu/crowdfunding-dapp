import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { Connection, PublicKey, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import "./CreateCampaign.css";

const PROGRAM_ID = new PublicKey("9Q26M3XJE9pveumjKK4VxMfBu8EQXPnqHHTNXfSU5kEi");

export default function CreateCampaign({ ethContract, solWallet, ethConnected, solConnected }) {
  const navigate = useNavigate();
  const [blockchain, setBlockchain] = useState("eth");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", goal: "", duration: "" });

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    if (!form.title || !form.description || !form.goal || !form.duration) {
      setError("All fields are required."); return;
    }
    if (blockchain === "eth" && !ethConnected) {
      setError("Please connect MetaMask first."); return;
    }
    if (blockchain === "sol" && !solConnected) {
      setError("Please connect Phantom first."); return;
    }

    setLoading(true);
    try {
      if (blockchain === "eth" && ethContract) {
        const goal = ethers.parseEther(form.goal);
        const tx = await ethContract.createCampaign(form.title, form.description, goal, Number(form.duration));
        await tx.wait();
        navigate("/");
      } else if (blockchain === "sol" && solWallet) {
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        const provider = new anchor.AnchorProvider(connection, solWallet, { commitment: "confirmed" });
        anchor.setProvider(provider);

        const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
        if (!idl) { setError("Could not fetch Solana program IDL."); setLoading(false); return; }

        const program = new anchor.Program(idl, provider);
        const campaign = anchor.web3.Keypair.generate();
        const goalLamports = new anchor.BN(parseFloat(form.goal) * anchor.web3.LAMPORTS_PER_SOL);

        await program.methods
          .createCampaign(form.title, form.description, goalLamports)
          .accounts({
            campaign: campaign.publicKey,
            owner: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([campaign])
          .rpc();

        navigate("/");
      }
    } catch (e) {
      setError(e.message || "Transaction failed.");
    }
    setLoading(false);
  };

  return (
    <div className="create-page">
      <div className="container">
        <div className="create-header">
          <div className="create-label">New Campaign</div>
          <h1 className="create-title">Launch Your Campaign</h1>
          <div className="divider"></div>
          <p className="create-desc">Create a transparent, on-chain fundraising campaign. All funds are managed by smart contracts.</p>
        </div>

        <div className="create-layout">
          <div className="create-form card">
            <div className="form-section">
              <h3 className="form-section-title">Select Blockchain</h3>
              <div className="chain-selector">
                <button className={blockchain === "eth" ? "chain-btn active" : "chain-btn"} onClick={() => setBlockchain("eth")}>
                  <span className="chain-icon">◈</span>
                  <span className="chain-name">Ethereum</span>
                  <span className="chain-sub">Via MetaMask</span>
                </button>
                <button className={blockchain === "sol" ? "chain-btn active" : "chain-btn"} onClick={() => setBlockchain("sol")}>
                  <span className="chain-icon">◉</span>
                  <span className="chain-name">Solana</span>
                  <span className="chain-sub">Via Phantom</span>
                </button>
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Campaign Details</h3>
              <div className="form-group">
                <label className="form-label">Campaign Title</label>
                <input className="form-input" name="title" value={form.title} onChange={handleChange} placeholder="Enter a compelling title" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleChange} placeholder="Describe your campaign and its goals..." rows={5} />
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Funding Parameters</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Goal Amount ({blockchain === "eth" ? "ETH" : "SOL"})</label>
                  <input className="form-input" name="goal" type="number" step="0.01" value={form.goal} onChange={handleChange} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (days)</label>
                  <input className="form-input" name="duration" type="number" value={form.duration} onChange={handleChange} placeholder="30" />
                </div>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <button className="btn-gold submit-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "Processing..." : "Launch Campaign"}
            </button>
          </div>

          <div className="create-sidebar">
            <div className="info-card card">
              <h4 className="info-title">How it works</h4>
              <div className="info-steps">
                {[
                  ["01", "Connect Wallet", "Link MetaMask or Phantom to authenticate."],
                  ["02", "Set Parameters", "Define your goal, duration, and description."],
                  ["03", "Deploy", "Your campaign is deployed as a smart contract."],
                  ["04", "Receive Funds", "Withdraw when the goal is reached."],
                ].map(([n, t, d]) => (
                  <div key={n} className="info-step">
                    <span className="step-num">{n}</span>
                    <div><strong>{t}</strong><p>{d}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-card card">
              <h4 className="info-title">Network status</h4>
              <div className="network-status">
                <div className="network-item">
                  <span className={`network-dot ${ethConnected ? "connected" : ""}`}></span>
                  <span className="network-name">Ethereum Sepolia</span>
                  <span className={`network-badge ${ethConnected ? "active" : ""}`}>{ethConnected ? "Connected" : "Disconnected"}</span>
                </div>
                <div className="network-item">
                  <span className={`network-dot sol ${solConnected ? "connected" : ""}`}></span>
                  <span className="network-name">Solana Devnet</span>
                  <span className={`network-badge ${solConnected ? "active" : ""}`}>{solConnected ? "Connected" : "Disconnected"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
