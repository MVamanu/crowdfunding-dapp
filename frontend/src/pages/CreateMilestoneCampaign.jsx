import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import "./CreateMilestoneCampaign.css";
import { CONTRACTS } from "../config/chains";

const MILESTONE_CONTRACT = CONTRACTS.milestone;
const MILESTONE_ABI = [
  "function createCampaign(string,string,uint256,string[],string[],uint256[]) returns (uint256)",
  "function campaignCount() view returns (uint256)",
];

export default function CreateMilestoneCampaign({ ethContract, ethConnected }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", duration: "" });
  const [milestones, setMilestones] = useState([
    { title: "", description: "", amount: "" },
    { title: "", description: "", amount: "" },
  ]);

  const handleFormChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleMilestoneChange = (index, field, value) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  const addMilestone = () => {
    if (milestones.length < 5) {
      setMilestones([...milestones, { title: "", description: "", amount: "" }]);
    }
  };

  const removeMilestone = (index) => {
    if (milestones.length > 2) {
      setMilestones(milestones.filter((_, i) => i !== index));
    }
  };

  const totalGoal = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);

  const handleSubmit = async () => {
    setError("");
    if (!ethConnected) { setError("Connect MetaMask first."); return; }
    if (!form.title || !form.description || !form.duration) { setError("All fields required."); return; }
    for (const m of milestones) {
      if (!m.title || !m.description || !m.amount) { setError("Complete all milestone fields."); return; }
      if (parseFloat(m.amount) <= 0) { setError("Milestone amounts must be positive."); return; }
    }

    setLoading(true);
    try {
      const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
      const provider = new ethers.BrowserProvider(metamask);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(MILESTONE_CONTRACT, MILESTONE_ABI, signer);

      const titles = milestones.map(m => m.title);
      const descs = milestones.map(m => m.description);
      const amounts = milestones.map(m => ethers.parseEther(m.amount.toString()));

      const tx = await contract.createCampaign(
        form.title, form.description, Number(form.duration),
        titles, descs, amounts
      );
      await tx.wait();
      navigate("/milestone-campaigns");
    } catch (e) {
      setError(e.reason || e.message || "Transaction failed.");
    }
    setLoading(false);
  };

  return (
    <div className="create-page">
      <div className="container">
        <div className="create-header">
          <div className="create-label">Inovatie - Milestone Funding</div>
          <h1 className="create-title">Campanie cu Milestone-uri</h1>
          <div className="divider"></div>
          <p className="create-desc">Fondurile sunt eliberate treptat, pe masura ce fiecare etapa este aprobata prin vot de catre donatori.</p>
        </div>

        <div className="create-layout">
          <div className="create-form card">
            <div className="form-section">
              <h3 className="form-section-title">Detalii Campanie</h3>
              <div className="form-group">
                <label className="form-label">Titlu Campanie</label>
                <input className="form-input" name="title" value={form.title} onChange={handleFormChange} placeholder="Titlul campaniei" />
              </div>
              <div className="form-group">
                <label className="form-label">Descriere</label>
                <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleFormChange} placeholder="Descrierea campaniei..." rows={4} />
              </div>
              <div className="form-group">
                <label className="form-label">Durata (zile)</label>
                <input className="form-input" name="duration" type="number" value={form.duration} onChange={handleFormChange} placeholder="30" />
              </div>
            </div>

            <div className="form-section">
              <div className="milestones-header">
                <h3 className="form-section-title">Milestone-uri ({milestones.length}/5)</h3>
                {milestones.length < 5 && (
                  <button className="add-milestone-btn" onClick={addMilestone}>+ Adauga</button>
                )}
              </div>

              {milestones.map((m, i) => (
                <div key={i} className="milestone-item">
                  <div className="milestone-header">
                    <span className="milestone-num">Etapa {i + 1}</span>
                    {milestones.length > 2 && (
                      <button className="remove-milestone-btn" onClick={() => removeMilestone(i)}>X</button>
                    )}
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Titlu etapa</label>
                      <input className="form-input" value={m.title} onChange={e => handleMilestoneChange(i, "title", e.target.value)} placeholder="ex: Dezvoltare MVP" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Suma (ETH)</label>
                      <input className="form-input" type="number" step="0.001" value={m.amount} onChange={e => handleMilestoneChange(i, "amount", e.target.value)} placeholder="0.00" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descriere etapa</label>
                    <input className="form-input" value={m.description} onChange={e => handleMilestoneChange(i, "description", e.target.value)} placeholder="Ce vei livra in aceasta etapa?" />
                  </div>
                </div>
              ))}

              <div className="total-goal">
                <span className="total-label">Goal Total:</span>
                <span className="total-value">{totalGoal.toFixed(4)} ETH</span>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}
            <button className="btn-gold submit-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "Se proceseaza..." : "Lanseaza Campania"}
            </button>
          </div>

          <div className="create-sidebar">
            <div className="info-card card">
              <h4 className="info-title">Cum functioneaza?</h4>
              <div className="info-steps">
                {[
                  ["01", "Creezi campania", "Definesti etapele si sumele pentru fiecare."],
                  ["02", "Donatorii contribuie", "Fondurile sunt blocate in smart contract."],
                  ["03", "Submiti milestone", "Cand termini o etapa, ceri aprobarea."],
                  ["04", "Donatorii voteaza", "Vot proportional cu suma donata."],
                  ["05", "Primesti fondurile", "Daca >50% aproba, primesti transha."],
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
