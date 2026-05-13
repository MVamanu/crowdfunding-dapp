import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Connection, PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import "./CreateMilestoneCampaign.css";
import { SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../config/chains";

const SOL_PROGRAM_ID = SOLANA_PROGRAM_ID;

export default function CreateSolanaMilestone({ solWallet, solConnected }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "" });
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
    if (!solConnected || !solWallet) { setError("Conecteaza Phantom sau Solflare mai intai."); return; }
    if (!form.title || !form.description) { setError("Titlul si descrierea sunt obligatorii."); return; }
    for (const m of milestones) {
      if (!m.title || !m.description || !m.amount) { setError("Completeaza toate campurile pentru milestone-uri."); return; }
      if (parseFloat(m.amount) <= 0) { setError("Sumele trebuie sa fie pozitive."); return; }
    }

    setLoading(true);
    try {
      const connection = new Connection(SOLANA_RPC_URL, "confirmed");
      const provider = new anchor.AnchorProvider(connection, solWallet, { commitment: "confirmed" });
      anchor.setProvider(provider);

      const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, provider);
      if (!idl) { setError("Nu s-a putut obtine IDL-ul programului."); setLoading(false); return; }

      const program = new anchor.Program(idl, provider);
      const campaignKeypair = Keypair.generate();

      const titles = milestones.map(m => m.title);
      const descs = milestones.map(m => m.description);
      const amounts = milestones.map(m => new anchor.BN(parseFloat(m.amount) * 1e9));

      await program.methods
        .createMilestoneCampaign(form.title, form.description, titles, descs, amounts)
        .accounts({
          milestoneCampaign: campaignKeypair.publicKey,
          owner: solWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([campaignKeypair])
        .rpc();

      navigate("/solana-milestones");
    } catch (e) {
      setError(e.message || "Tranzactie esuata.");
    }
    setLoading(false);
  };

  return (
    <div className="create-page">
      <div className="container">
        <div className="create-header">
          <div className="create-label">Solana — Milestone Funding</div>
          <h1 className="create-title">Campanie Milestone pe Solana</h1>
          <div className="divider"></div>
          <p className="create-desc">Fondurile SOL sunt eliberate etapizat, dupa aprobarea prin vot a fiecarei etape.</p>
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
                      <label className="form-label">Suma (SOL)</label>
                      <input className="form-input" type="number" step="0.01" value={m.amount} onChange={e => handleMilestoneChange(i, "amount", e.target.value)} placeholder="0.00" />
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
                <span className="total-value">{totalGoal.toFixed(4)} SOL</span>
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Wallet Solana</h3>
              <div className={`wallet-status-item ${solConnected ? "connected" : ""}`} style={{display:"flex", alignItems:"center", gap:"12px", padding:"14px 16px", borderRadius:"var(--radius-lg)", border:"1.5px solid var(--border)", background:"var(--cream)"}}>
                <span style={{width:"10px", height:"10px", borderRadius:"50%", background: solConnected ? "#9945ff" : "var(--border)", flexShrink:0}}></span>
                <div>
                  <span style={{display:"block", fontSize:"14px", fontWeight:"600", color:"var(--navy)"}}>
                    {solConnected ? "Wallet conectat" : "Wallet neconectat"}
                  </span>
                  <span style={{display:"block", fontSize:"12px", color:"var(--text-muted)"}}>
                    {solConnected ? "Gata pentru tranzactii pe Solana Devnet" : "Conecteaza Phantom sau Solflare din navbar"}
                  </span>
                </div>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}
            <button className="btn-gold submit-btn" onClick={handleSubmit} disabled={loading || !solConnected}>
              {loading ? "Se proceseaza..." : "Lanseaza Campania Solana"}
            </button>
          </div>

          <div className="create-sidebar">
            <div className="info-card card">
              <h4 className="info-title">Cum functioneaza?</h4>
              <div className="info-steps">
                {[
                  ["01", "Creezi campania", "Definesti etapele si sumele SOL pentru fiecare."],
                  ["02", "Donatorii contribuie", "SOL sunt blocati in contul programului."],
                  ["03", "Submiti milestone", "Cand termini o etapa, ceri aprobarea."],
                  ["04", "Donatorii voteaza", "Vot proportional cu SOL donat."],
                  ["05", "Primesti SOL", "Daca >50% aproba, primesti transha."],
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
