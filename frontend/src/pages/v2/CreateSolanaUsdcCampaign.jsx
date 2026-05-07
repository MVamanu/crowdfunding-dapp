import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Connection, PublicKey, clusterApiUrl, SystemProgram, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import "./V2.css";
import "../CreateCampaign.css";

const SOL_PROGRAM_ID = new PublicKey("9Q26M3XJE9pveumjKK4VxMfBu8EQXPnqHHTNXfSU5kEi");
const USDC_MINT_DEVNET = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

export default function CreateSolanaUsdcCampaign({ solWallet, solConnected }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", goal: "", duration: "" });

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setError("");
    if (!solConnected || !solWallet) { setError("Conecteaza Phantom sau Solflare mai intai."); return; }
    if (!form.title || !form.description || !form.goal || !form.duration) {
      setError("Toate campurile sunt obligatorii."); return;
    }
    if (parseFloat(form.goal) <= 0) { setError("Goalul trebuie sa fie pozitiv."); return; }

    setLoading(true);
    try {
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      const provider = new anchor.AnchorProvider(connection, solWallet, { commitment: "confirmed" });
      anchor.setProvider(provider);

      const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, provider);
      if (!idl) { setError("Nu s-a putut obtine IDL-ul."); setLoading(false); return; }

      const program = new anchor.Program(idl, provider);
      const campaignKeypair = Keypair.generate();

      // Goal in USDC cu 6 zecimale
      const goalInUsdc = new anchor.BN(Math.round(parseFloat(form.goal) * 1_000_000));

      // Gasim vault PDA
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), campaignKeypair.publicKey.toBuffer()],
        SOL_PROGRAM_ID
      );

      await program.methods
        .createUsdcCampaign(form.title, form.description, goalInUsdc)
        .accounts({
          usdcCampaign: campaignKeypair.publicKey,
          vault: vaultPDA,
          usdcMint: USDC_MINT_DEVNET,
          owner: solWallet.publicKey,
          tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([campaignKeypair])
        .rpc();

      navigate("/v2");
    } catch (e) {
      setError(e.message || "Tranzactie esuata.");
    }
    setLoading(false);
  };

  return (
    <div className="create-page">
      <div className="container">
        <div className="create-header">
          <div className="v2-badge">v2 — USDC pe Solana</div>
          <h1 className="create-title">Campanie USDC pe Solana</h1>
          <div className="divider"></div>
          <p className="create-desc">Accepta donatii in USDC pe Solana Devnet. Valoare stabila, tranzactii rapide si ieftine.</p>
        </div>

        <div className="create-layout">
          <div className="create-form card">
            <div className="usdc-note">
              <span>💡</span>
              <span>USDC pe Solana — tranzactii sub 1 secunda, costuri de fracțiuni de cent.</span>
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
              <h3 className="form-section-title">Wallet Solana</h3>
              <div style={{display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderRadius:"var(--radius-lg)", border:`1.5px solid ${solConnected ? "#9945ff" : "var(--border)"}`, background:"var(--cream)"}}>
                <span style={{width:"10px", height:"10px", borderRadius:"50%", background: solConnected ? "#9945ff" : "var(--border)", flexShrink:0}}></span>
                <div>
                  <span style={{display:"block", fontSize:"14px", fontWeight:"600", color:"var(--navy)"}}>
                    {solConnected ? "Wallet conectat" : "Wallet neconectat"}
                  </span>
                  <span style={{display:"block", fontSize:"12px", color:"var(--text-muted)"}}>
                    {solConnected ? "Gata pentru Solana Devnet" : "Conecteaza Phantom sau Solflare"}
                  </span>
                </div>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}
            <button className="btn-usdc submit-btn" style={{width:"100%", justifyContent:"center", padding:"14px"}}
              onClick={handleSubmit} disabled={loading || !solConnected}>
              {loading ? "Se proceseaza..." : "Lanseaza Campania USDC pe Solana"}
            </button>
          </div>

          <div className="create-sidebar">
            <div className="info-card card">
              <h4 className="info-title">USDC pe Solana</h4>
              <div className="info-steps">
                {[
                  ["01", "USDC Stabil", "1 USDC = $1 USD intotdeauna pe ambele blockchain-uri."],
                  ["02", "Solana Speed", "Confirmare in mai putin de 1 secunda."],
                  ["03", "Cost minim", "Costuri de fracțiuni de cent per tranzactie."],
                  ["04", "Cross-chain", "Campania ta apare alaturi de campaniile ETH USDC."],
                ].map(([n, t, d]) => (
                  <div key={n} className="info-step">
                    <span className="step-num" style={{background:"rgba(153,69,255,0.15)", color:"#9945ff"}}>{n}</span>
                    <div><strong>{t}</strong><p>{d}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-card card" style={{marginTop:"16px"}}>
              <h4 className="info-title">Obtine USDC de test</h4>
              <p style={{fontSize:"13px", color:"var(--text-secondary)", lineHeight:"1.6", marginBottom:"12px"}}>
                Ai nevoie de USDC pe Solana Devnet pentru a testa donatiile.
              </p>
              <a href="https://faucet.circle.com/" target="_blank" rel="noreferrer"
                className="btn-usdc" style={{width:"100%", justifyContent:"center"}}>
                Circle USDC Faucet
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
