import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import "./CreateUnifiedCampaign.css";

const UNIFIED_CONTRACT = "0x4C6b83E06c9B7f83a029312eA9E3E00E7CBC6a5e";
const UNIFIED_ABI = [
  "function createCampaign(string,string,uint256,uint256,string) returns (uint256)",
  "function campaignCount() view returns (uint256)",
];

export default function CreateUnifiedCampaign({ ethConnected, solAddress }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "", description: "", goalUSD: "", duration: ""
  });

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    if (!ethConnected) { setError("Connect MetaMask first."); return; }
    if (!form.title || !form.description || !form.goalUSD || !form.duration) {
      setError("All fields are required."); return;
    }
    if (Number(form.goalUSD) <= 0) { setError("Goal must be positive."); return; }

    setLoading(true);
    try {
      const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
      const provider = new ethers.BrowserProvider(metamask);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(UNIFIED_CONTRACT, UNIFIED_ABI, signer);

      const tx = await contract.createCampaign(
        form.title,
        form.description,
        BigInt(Math.round(Number(form.goalUSD))),
        Number(form.duration),
        solAddress || ""
      );
      await tx.wait();
      navigate("/unified-campaigns");
    } catch (e) {
      setError(e.reason || e.message || "Transaction failed.");
    }
    setLoading(false);
  };

  return (
    <div className="create-page">
      <div className="container">
        <div className="create-header">
          <div className="create-label">Inovatie — Cross-Chain</div>
          <h1 className="create-title">Campanie Cross-Chain</h1>
          <div className="divider"></div>
          <p className="create-desc">Accepta donatii atat in ETH cat si in SOL. Goalul e definit in USD si progresul e calculat unificat.</p>
        </div>

        <div className="create-layout">
          <div className="create-form card">
            <div className="form-section">
              <h3 className="form-section-title">Detalii Campanie</h3>
              <div className="form-group">
                <label className="form-label">Titlu</label>
                <input className="form-input" name="title" value={form.title} onChange={handleChange} placeholder="Titlul campaniei" />
              </div>
              <div className="form-group">
                <label className="form-label">Descriere</label>
                <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleChange} placeholder="Descrierea campaniei..." rows={4} />
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Parametri Financiari</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Goal (USD)</label>
                  <input className="form-input" name="goalUSD" type="number" value={form.goalUSD} onChange={handleChange} placeholder="1000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Durata (zile)</label>
                  <input className="form-input" name="duration" type="number" value={form.duration} onChange={handleChange} placeholder="30" />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Wallet-uri conectate</h3>
              <div className="wallets-status">
                <div className={`wallet-status-item ${ethConnected ? "connected" : ""}`}>
                  <span className="wallet-status-dot"></span>
                  <div>
                    <span className="wallet-status-name">Ethereum (MetaMask)</span>
                    <span className="wallet-status-desc">{ethConnected ? "Conectat - va primi donatii ETH" : "Neconectat"}</span>
                  </div>
                </div>
                <div className={`wallet-status-item ${solAddress ? "connected" : ""}`}>
                  <span className="wallet-status-dot sol"></span>
                  <div>
                    <span className="wallet-status-name">Solana (Phantom/Solflare)</span>
                    <span className="wallet-status-desc">{solAddress ? `${solAddress.slice(0,8)}... - va primi donatii SOL` : "Neconectat - optional"}</span>
                  </div>
                </div>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}
            <button className="btn-gold submit-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "Se proceseaza..." : "Lanseaza Campania Cross-Chain"}
            </button>
          </div>

          <div className="create-sidebar">
            <div className="info-card card">
              <h4 className="info-title">De ce Cross-Chain?</h4>
              <div className="info-steps">
                {[
                  ["01", "Goal in USD", "Stabileste un target financiar real, independent de volatilitatea crypto."],
                  ["02", "Donatii in ETH", "Sustinatorii Ethereum pot dona direct din MetaMask."],
                  ["03", "Donatii in SOL", "Sustinatorii Solana pot dona direct din Phantom sau Solflare."],
                  ["04", "Progres unificat", "Toate donatiile sunt convertite in USD si agregate."],
                ].map(([n, t, d]) => (
                  <div key={n} className="info-step">
                    <span className="step-num">{n}</span>
                    <div><strong>{t}</strong><p>{d}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
