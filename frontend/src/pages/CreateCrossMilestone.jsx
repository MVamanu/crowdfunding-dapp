import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import "./CreateMilestoneCampaign.css";

const CROSS_MILESTONE_CONTRACT = "0x96132Dd1FFD9Ef26dbDEd95Dd4e3C2e220C21A4E";
const CROSS_MILESTONE_ABI = [
  "function createCampaign(string,string,uint256,uint256,string,string,string[],string[],uint256[]) returns (uint256)",
  "function campaignCount() view returns (uint256)",
];

export default function CreateCrossMilestone({ ethConnected, solAddress }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", goalUSD: "", duration: "" });
  const [milestones, setMilestones] = useState([
    { title: "", description: "", amountUSD: "" },
    { title: "", description: "", amountUSD: "" },
  ]);

  const handleFormChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleMilestoneChange = (index, field, value) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  const addMilestone = () => {
    if (milestones.length < 5) setMilestones([...milestones, { title: "", description: "", amountUSD: "" }]);
  };

  const removeMilestone = (index) => {
    if (milestones.length > 2) setMilestones(milestones.filter((_, i) => i !== index));
  };

  const totalUSD = milestones.reduce((sum, m) => sum + (parseFloat(m.amountUSD) || 0), 0);

  const handleSubmit = async () => {
    setError("");
    if (!ethConnected) { setError("Conecteaza MetaMask mai intai."); return; }
    if (!form.title || !form.description || !form.goalUSD || !form.duration) { setError("Toate campurile sunt obligatorii."); return; }
    for (const m of milestones) {
      if (!m.title || !m.description || !m.amountUSD) { setError("Completeaza toate milestone-urile."); return; }
    }

    setLoading(true);
    try {
      const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
      const provider = new ethers.BrowserProvider(metamask);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CROSS_MILESTONE_CONTRACT, CROSS_MILESTONE_ABI, signer);

      const titles = milestones.map(m => m.title);
      const descs = milestones.map(m => m.description);
      const amounts = milestones.map(m => BigInt(Math.round(parseFloat(m.amountUSD))));

      const tx = await contract.createCampaign(
        form.title, form.description,
        BigInt(Math.round(parseFloat(form.goalUSD))),
        BigInt(form.duration),
        solAddress || "",
        "eth",
        titles, descs, amounts
      );
      await tx.wait();
      navigate("/kickstart");
    } catch (e) {
      setError(e.reason || e.message || "Tranzactie esuata.");
    }
    setLoading(false);
  };

  return (
    <div className="create-page">
      <div className="container">
        <div className="create-header">
          <div className="create-label">Cross-Chain — Milestone Funding</div>
          <h1 className="create-title">Campanie Cross Milestone</h1>
          <div className="divider"></div>
          <p className="create-desc">Goal in USD, donatii in ETH si SOL, milestone-uri aprobate prin vot. Blockchain principal: Ethereum.</p>
        </div>

        <div className="create-layout">
          <div className="create-form card">
            <div className="form-section">
              <h3 className="form-section-title">Detalii Campanie</h3>
              <div className="form-group">
                <label className="form-label">Titlu</label>
                <input className="form-input" name="title" value={form.title} onChange={handleFormChange} placeholder="Titlul campaniei" />
              </div>
              <div className="form-group">
                <label className="form-label">Descriere</label>
                <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleFormChange} placeholder="Descrierea campaniei..." rows={4} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Goal Total (USD)</label>
                  <input className="form-input" name="goalUSD" type="number" value={form.goalUSD} onChange={handleFormChange} placeholder="1000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Durata (zile)</label>
                  <input className="form-input" name="duration" type="number" value={form.duration} onChange={handleFormChange} placeholder="30" />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Wallet-uri conectate</h3>
              <div style={{display:"flex", flexDirection:"column", gap:"10px"}}>
                <div style={{display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderRadius:"var(--radius-lg)", border:`1.5px solid ${ethConnected ? "var(--navy)" : "var(--border)"}`, background:"var(--cream)"}}>
                  <span style={{width:"10px", height:"10px", borderRadius:"50%", background: ethConnected ? "#627eea" : "var(--border)", flexShrink:0}}></span>
                  <div>
                    <span style={{display:"block", fontSize:"14px", fontWeight:"600", color:"var(--navy)"}}>Ethereum (MetaMask) — Blockchain Principal</span>
                    <span style={{display:"block", fontSize:"12px", color:"var(--text-muted)"}}>{ethConnected ? "Conectat - gestioneaza milestone-urile si votul" : "Neconectat"}</span>
                  </div>
                </div>
                <div style={{display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderRadius:"var(--radius-lg)", border:`1.5px solid ${solAddress ? "#9945ff" : "var(--border)"}`, background:"var(--cream)"}}>
                  <span style={{width:"10px", height:"10px", borderRadius:"50%", background: solAddress ? "#9945ff" : "var(--border)", flexShrink:0}}></span>
                  <div>
                    <span style={{display:"block", fontSize:"14px", fontWeight:"600", color:"var(--navy)"}}>Solana (Phantom/Solflare) — Optional</span>
                    <span style={{display:"block", fontSize:"12px", color:"var(--text-muted)"}}>{solAddress ? `${solAddress.slice(0,8)}... - accepta donatii SOL` : "Neconectat - donatiile SOL nu vor fi acceptate"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="milestones-header">
                <h3 className="form-section-title">Milestone-uri ({milestones.length}/5)</h3>
                {milestones.length < 5 && <button className="add-milestone-btn" onClick={addMilestone}>+ Adauga</button>}
              </div>

              {milestones.map((m, i) => (
                <div key={i} className="milestone-item">
                  <div className="milestone-header">
                    <span className="milestone-num">Etapa {i + 1}</span>
                    {milestones.length > 2 && <button className="remove-milestone-btn" onClick={() => removeMilestone(i)}>X</button>}
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Titlu etapa</label>
                      <input className="form-input" value={m.title} onChange={e => handleMilestoneChange(i, "title", e.target.value)} placeholder="ex: Dezvoltare MVP" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Suma (USD)</label>
                      <input className="form-input" type="number" value={m.amountUSD} onChange={e => handleMilestoneChange(i, "amountUSD", e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descriere etapa</label>
                    <input className="form-input" value={m.description} onChange={e => handleMilestoneChange(i, "description", e.target.value)} placeholder="Ce vei livra in aceasta etapa?" />
                  </div>
                </div>
              ))}

              <div className="total-goal">
                <span className="total-label">Total Milestone-uri:</span>
                <span className="total-value">${totalUSD.toFixed(0)} USD</span>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}
            <button className="btn-gold submit-btn" onClick={handleSubmit} disabled={loading || !ethConnected}>
              {loading ? "Se proceseaza..." : "Lanseaza Campania Cross Milestone"}
            </button>
          </div>

          <div className="create-sidebar">
            <div className="info-card card">
              <h4 className="info-title">Cum functioneaza?</h4>
              <div className="info-steps">
                {[
                  ["01", "Goal in USD", "Stabilesti un target financiar real, indiferent de volatilitate."],
                  ["02", "Donatii ETH + SOL", "Ambele blockchain-uri accepta contributii."],
                  ["03", "Milestone-uri", "Fondurile sunt eliberate pe etape."],
                  ["04", "Vot ETH", "Donatorii ETH voteaza aprobarea etapelor."],
                  ["05", "Transparent", "Totul e verificabil on-chain."],
                ].map(([n, t, d]) => (
                  <div key={n} className="info-step">
                    <span className="step-num">{n}</span>
                    <div><strong>{t}</strong><p>{d}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-card card" style={{marginTop:"16px"}}>
              <h4 className="info-title">Nota tehnica</h4>
              <p style={{fontSize:"13px", color:"var(--text-secondary)", lineHeight:"1.6"}}>
                Votul si milestone-urile sunt gestionate pe <strong>Ethereum</strong> (blockchain principal).
                Donatiile SOL sunt inregistrate in USD si agregate in totalul campaniei.
                Donatorii SOL sunt informati despre rezultatul votului prin frontend.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
