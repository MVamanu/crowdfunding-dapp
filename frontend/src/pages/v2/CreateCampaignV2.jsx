import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import "../CreateCampaign.css";
import "./V2.css";

const STABLE_CONTRACT = "0x8FA441B88BC346427E34baf5B1b1E09ed1700f3c";
const STABLE_ABI = [
  "function createCampaign(string,string,uint256,uint256) returns (uint256)",
];

export default function CreateCampaignV2({ ethConnected }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", goal: "", duration: "" });

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    if (!ethConnected) { setError("Conecteaza MetaMask mai intai."); return; }
    if (!form.title || !form.description || !form.goal || !form.duration) {
      setError("Toate campurile sunt obligatorii."); return;
    }
    setLoading(true);
    try {
      const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
      const provider = new ethers.BrowserProvider(metamask);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(STABLE_CONTRACT, STABLE_ABI, signer);
      const goalInUsdc = BigInt(Math.round(parseFloat(form.goal) * 1_000_000));
      const tx = await contract.createCampaign(
        form.title, form.description, goalInUsdc, BigInt(form.duration)
      );
      await tx.wait();
      navigate("/v2");
    } catch (e) {
      setError(e.reason || e.message || "Tranzactie esuata.");
    }
    setLoading(false);
  };

  return (
    <div className="create-page">
      <div className="container">
        <div className="create-header">
          <div className="v2-badge">v2 — USDC Stablecoin</div>
          <h1 className="create-title">Creeaza Campanie USDC</h1>
          <div className="divider"></div>
          <p className="create-desc">Goalul si donatiile sunt in USDC — valoare stabila, fara volatilitate crypto.</p>
        </div>
        <div className="create-layout">
          <div className="create-form card">
            <div className="usdc-note">
              <span>💡</span>
              <span>Donatiile sunt in USDC (stablecoin). 1 USDC = $1 USD intotdeauna.</span>
            </div>
            <div className="form-section">
              <h3 className="form-section-title">Detalii Campanie</h3>
              <div className="form-group">
                <label className="form-label">Titlu</label>
                <input className="form-input" name="title" value={form.title} onChange={handleChange} placeholder="Titlul campaniei" />
              </div>
              <div className="form-group">
                <label className="form-label">Descriere</label>
                <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleChange} placeholder="Descrierea campaniei..." rows={5} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Goal (USDC)</label>
                  <input className="form-input" name="goal" type="number" step="1" value={form.goal} onChange={handleChange} placeholder="1000" />
                  <span style={{fontSize:"12px", color:"var(--text-muted)", marginTop:"4px", display:"block"}}>= ${parseFloat(form.goal || 0).toFixed(2)} USD exact</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Durata (zile)</label>
                  <input className="form-input" name="duration" type="number" value={form.duration} onChange={handleChange} placeholder="30" />
                </div>
              </div>
            </div>
            <div className="form-section">
              <h3 className="form-section-title">Wallet</h3>
              <div style={{display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderRadius:"var(--radius-lg)", border:`1.5px solid ${ethConnected ? "#2775CA" : "var(--border)"}`, background:"var(--cream)"}}>
                <span style={{width:"10px", height:"10px", borderRadius:"50%", background: ethConnected ? "#2775CA" : "var(--border)", flexShrink:0}}></span>
                <div>
                  <span style={{display:"block", fontSize:"14px", fontWeight:"600", color:"var(--navy)"}}>MetaMask {ethConnected ? "conectat" : "neconectat"}</span>
                  <span style={{display:"block", fontSize:"12px", color:"var(--text-muted)"}}>Ethereum Sepolia Testnet</span>
                </div>
              </div>
            </div>
            {error && <div className="form-error">{error}</div>}
            <button className="btn-usdc submit-btn" style={{width:"100%", justifyContent:"center", padding:"14px"}} onClick={handleSubmit} disabled={loading || !ethConnected}>
              {loading ? "Se proceseaza..." : "Lanseaza Campania USDC"}
            </button>
          </div>
          <div className="create-sidebar">
            <div className="info-card card">
              <h4 className="info-title">De ce USDC?</h4>
              <div className="info-steps">
                {[
                  ["01", "Valoare stabila", "1 USDC = $1 USD intotdeauna."],
                  ["02", "Transparenta totala", "Toate tranzactiile verificabile pe Etherscan."],
                  ["03", "Approve + Donate", "Doua tranzactii simple pentru donatori."],
                  ["04", "Refund automat", "Daca goalul nu e atins, banii se returneaza."],
                ].map(([n, t, d]) => (
                  <div key={n} className="info-step">
                    <span className="step-num" style={{background:"rgba(39,117,202,0.15)", color:"#2775CA"}}>{n}</span>
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
