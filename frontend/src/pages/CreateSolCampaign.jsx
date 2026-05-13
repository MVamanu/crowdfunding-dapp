import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Connection, SystemProgram, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import "./CreateCampaign.css";
import { SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../config/chains";

const SOL_PROGRAM_ID = SOLANA_PROGRAM_ID;

export default function CreateSolCampaign({ solWallet, solConnected }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", goal: "" });

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    if (!solConnected || !solWallet) { setError("Conecteaza Phantom sau Solflare mai intai."); return; }
    if (!form.title || !form.description || !form.goal) { setError("Toate campurile sunt obligatorii."); return; }
    if (parseFloat(form.goal) <= 0) { setError("Goalul trebuie sa fie pozitiv."); return; }

    setLoading(true);
    try {
      const connection = new Connection(SOLANA_RPC_URL, "confirmed");
      const provider = new anchor.AnchorProvider(connection, solWallet, { commitment: "confirmed" });
      anchor.setProvider(provider);
      const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, provider);
      if (!idl) { setError("Nu s-a putut obtine IDL-ul programului."); setLoading(false); return; }

      const program = new anchor.Program(idl, provider);
      const campaignKeypair = Keypair.generate();
      const goalLamports = new anchor.BN(parseFloat(form.goal) * 1e9);

      await program.methods
        .createCampaign(form.title, form.description, goalLamports)
        .accounts({
          campaign: campaignKeypair.publicKey,
          owner: solWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([campaignKeypair])
        .rpc();

      navigate("/ong");
    } catch (e) {
      setError(e.message || "Tranzactie esuata.");
    }
    setLoading(false);
  };

  return (
    <div className="create-page">
      <div className="container">
        <div className="create-header">
          <div className="create-label">Solana — Campanie Simpla</div>
          <h1 className="create-title">Creeaza Campanie SOL</h1>
          <div className="divider"></div>
          <p className="create-desc">Accepta donatii in SOL direct in wallet-ul tau Solana.</p>
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
                <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleChange} placeholder="Descrierea campaniei..." rows={5} />
              </div>
              <div className="form-group">
                <label className="form-label">Goal (SOL)</label>
                <input className="form-input" name="goal" type="number" step="0.01" value={form.goal} onChange={handleChange} placeholder="0.00" />
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Wallet Solana</h3>
              <div style={{display:"flex", alignItems:"center", gap:"12px", padding:"14px 16px", borderRadius:"var(--radius-lg)", border:`1.5px solid ${solConnected ? "#9945ff" : "var(--border)"}`, background:"var(--cream)"}}>
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
              {loading ? "Se proceseaza..." : "Lanseaza Campania SOL"}
            </button>
          </div>

          <div className="create-sidebar">
            <div className="info-card card">
              <h4 className="info-title">Cum functioneaza?</h4>
              <div className="info-steps">
                {[
                  ["01", "Conecteaza wallet", "Phantom sau Solflare pe Solana Devnet."],
                  ["02", "Seteaza goalul", "Defineste suma in SOL pe care vrei sa o strangi."],
                  ["03", "Lansezi campania", "Campania e deployed ca program Anchor pe Solana."],
                  ["04", "Primesti donatii", "Donatorii pot contribui direct in SOL."],
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
