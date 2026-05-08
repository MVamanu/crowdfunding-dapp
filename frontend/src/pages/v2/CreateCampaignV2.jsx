import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { Connection, PublicKey, clusterApiUrl, SystemProgram, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import "./V2.css";
import "../CreateCampaign.css";

const STABLE_V2_CONTRACT = "0x5Bf218455583dDC56213e3603D3d304D1B0dD006";
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const SOL_PROGRAM_ID = new PublicKey("9Q26M3XJE9pveumjKK4VxMfBu8EQXPnqHHTNXfSU5kEi");
const USDC_MINT_DEVNET = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

const STABLE_V2_ABI = [
  "function createCampaign(string,string,uint256,uint256,string,string[],string) returns (uint256)",
  "function campaignCount() view returns (uint256)",
];

const CHAINS = [
  { id: "eth", name: "Ethereum", symbol: "ETH", color: "#627EEA", desc: "Sepolia Testnet" },
  { id: "sol", name: "Solana", symbol: "SOL", color: "#9945FF", desc: "Devnet" },
];

export default function CreateCampaignV2({ ethConnected, ethAddress, solWallet, solConnected }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", goal: "", duration: "" });
  const [mainChain, setMainChain] = useState("eth");
  const [acceptedChains, setAcceptedChains] = useState(["eth", "sol"]);
  const [step, setStep] = useState(1);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const toggleChain = (chainId) => {
    if (acceptedChains.includes(chainId)) {
      if (acceptedChains.length > 1) {
        setAcceptedChains(acceptedChains.filter(c => c !== chainId));
      }
    } else {
      setAcceptedChains([...acceptedChains, chainId]);
    }
  };

  const isConnectedForMain = mainChain === "eth" ? ethConnected : (solConnected || !!solWallet);

  async function createOnEth(goalInUsdc, solanaId = "") {
    const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
    const provider = new ethers.BrowserProvider(metamask);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(STABLE_V2_CONTRACT, STABLE_V2_ABI, signer);
    const tx = await contract.createCampaign(
      form.title, form.description, goalInUsdc,
      BigInt(form.duration), mainChain,
      acceptedChains, solanaId
    );
    await tx.wait();
  }

  async function createOnSol(goalInUsdc) {
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const provider = new anchor.AnchorProvider(connection, solWallet, { commitment: "confirmed" });
    anchor.setProvider(provider);
    const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, provider);
    if (!idl) throw new Error("Nu s-a putut obtine IDL-ul Solana.");
    const program = new anchor.Program(idl, provider);
    const campaignKeypair = Keypair.generate();
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), campaignKeypair.publicKey.toBuffer()],
      SOL_PROGRAM_ID
    );
    await program.methods
      .createUsdcCampaign(form.title, form.description, new anchor.BN(goalInUsdc.toString()))
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
  }

  const handleSubmit = async () => {
    setError("");
    if (!form.title || !form.description || !form.goal || !form.duration) {
      setError("Toate campurile sunt obligatorii."); return;
    }
    if (!isConnectedForMain) {
      setError(`Conecteaza wallet-ul pentru ${mainChain === "eth" ? "Ethereum (MetaMask)" : "Solana (Phantom/Solflare)"}.`);
      return;
    }

    setLoading(true);
    try {
      const goalInUsdc = BigInt(Math.round(parseFloat(form.goal) * 1_000_000));

      if (mainChain === "eth") {
        // ETH main â€” solanaId gol
        await createOnEth(goalInUsdc, "");
      } else {
        // SOL main â€” cream mai intai pe Solana, obtinem pubkey, apoi cream mirror pe ETH
        const solanaCampaignId = await createOnSol(goalInUsdc);
        if (solanaCampaignId) {
          await createOnEth(goalInUsdc, solanaCampaignId);
        }
      }

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
          <div className="v2-badge">v2 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â USDC Cross-Chain</div>
          <h1 className="create-title">Creeaza Campanie USDC</h1>
          <div className="divider"></div>
          <p className="create-desc">Goal in USDC, donatii acceptate din multiple blockchain-uri. Tu alegi unde e principala logica.</p>
        </div>

        <div className="create-layout">
          <div className="create-form card">

            <div className="usdc-note">
              <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¡</span>
              <span>1 USDC = $1 USD intotdeauna, pe orice blockchain.</span>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">1. Alege Blockchain-ul Principal</h3>
              <p style={{fontSize:"13px", color:"var(--text-muted)", marginBottom:"12px"}}>
                Pe acest blockchain se va gestiona logica campaniei (retragere fonduri, milestone-uri viitoare).
              </p>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px"}}>
                {CHAINS.map(chain => (
                  <button
                    key={chain.id}
                    onClick={() => setMainChain(chain.id)}
                    style={{
                      padding:"16px", borderRadius:"var(--radius-lg)", cursor:"pointer",
                      border:`2px solid ${mainChain === chain.id ? chain.color : "var(--border)"}`,
                      background: mainChain === chain.id ? `${chain.color}15` : "var(--cream)",
                      textAlign:"left", transition:"all 0.2s"
                    }}
                  >
                    <div style={{fontWeight:"700", fontSize:"16px", color: mainChain === chain.id ? chain.color : "var(--navy)"}}>
                      {chain.name}
                    </div>
                    <div style={{fontSize:"12px", color:"var(--text-muted)", marginTop:"4px"}}>{chain.desc}</div>
                    {mainChain === chain.id && (
                      <div style={{fontSize:"11px", color:chain.color, marginTop:"6px", fontWeight:"600"}}>ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ Principal</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">2. Chain-uri care accepta donatii</h3>
              <p style={{fontSize:"13px", color:"var(--text-muted)", marginBottom:"12px"}}>
                Donatorii pot contribui din oricare dintre aceste blockchain-uri.
              </p>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px"}}>
                {CHAINS.map(chain => (
                  <button
                    key={chain.id}
                    onClick={() => toggleChain(chain.id)}
                    style={{
                      padding:"12px 16px", borderRadius:"var(--radius-lg)", cursor:"pointer",
                      border:`2px solid ${acceptedChains.includes(chain.id) ? chain.color : "var(--border)"}`,
                      background: acceptedChains.includes(chain.id) ? `${chain.color}15` : "var(--cream)",
                      textAlign:"left", transition:"all 0.2s", display:"flex", alignItems:"center", gap:"10px"
                    }}
                  >
                    <span style={{
                      width:"20px", height:"20px", borderRadius:"4px", flexShrink:0,
                      background: acceptedChains.includes(chain.id) ? chain.color : "var(--border)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      color:"white", fontSize:"12px", fontWeight:"700"
                    }}>
                      {acceptedChains.includes(chain.id) ? "ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“" : ""}
                    </span>
                    <div>
                      <div style={{fontWeight:"600", fontSize:"14px", color:"var(--navy)"}}>{chain.name}</div>
                      <div style={{fontSize:"11px", color:"var(--text-muted)"}}>{chain.symbol} USDC</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">3. Detalii Campanie</h3>
              <div className="form-group">
                <label className="form-label">Titlu</label>
                <input className="form-input" name="title" value={form.title} onChange={handleChange} placeholder="Titlul campaniei" />
              </div>
              <div className="form-group">
                <label className="form-label">Descriere</label>
                <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleChange} placeholder="Descrierea campaniei..." rows={4} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Goal (USDC)</label>
                  <input className="form-input" name="goal" type="number" step="1" value={form.goal} onChange={handleChange} placeholder="1000" />
                  <span style={{fontSize:"12px", color:"var(--text-muted)", marginTop:"4px", display:"block"}}>
                    = ${parseFloat(form.goal || 0).toFixed(2)} USD exact
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">Durata (zile)</label>
                  <input className="form-input" name="duration" type="number" value={form.duration} onChange={handleChange} placeholder="30" />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">4. Wallet-uri conectate</h3>
              <div style={{display:"flex", flexDirection:"column", gap:"8px"}}>
                <div style={{display:"flex", alignItems:"center", gap:"12px", padding:"10px 14px", borderRadius:"var(--radius-lg)", border:`1.5px solid ${ethConnected ? "#627EEA" : "var(--border)"}`, background:"var(--cream)"}}>
                  <span style={{width:"8px", height:"8px", borderRadius:"50%", background: ethConnected ? "#627EEA" : "var(--border)", flexShrink:0}}></span>
                  <span style={{fontSize:"13px", color:"var(--navy)", fontWeight:"600"}}>
                    MetaMask {ethConnected ? "conectat" : "neconectat"}
                    {mainChain === "eth" && <span style={{color:"#627EEA", marginLeft:"6px", fontSize:"11px"}}>ÃƒÂ¢Ã¢â‚¬Â Ã‚Â Principal</span>}
                  </span>
                </div>
                <div style={{display:"flex", alignItems:"center", gap:"12px", padding:"10px 14px", borderRadius:"var(--radius-lg)", border:`1.5px solid ${(solConnected || !!solWallet) ? "#9945FF" : "var(--border)"}`, background:"var(--cream)"}}>
                  <span style={{width:"8px", height:"8px", borderRadius:"50%", background: (solConnected || !!solWallet) ? "#9945FF" : "var(--border)", flexShrink:0}}></span>
                  <span style={{fontSize:"13px", color:"var(--navy)", fontWeight:"600"}}>
                    Solana {(solConnected || !!solWallet) ? "conectat" : "neconectat"}
                    {mainChain === "sol" && <span style={{color:"#9945FF", marginLeft:"6px", fontSize:"11px"}}>ÃƒÂ¢Ã¢â‚¬Â Ã‚Â Principal</span>}
                  </span>
                </div>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <button
              className="btn-usdc submit-btn"
              style={{
                width:"100%", justifyContent:"center", padding:"14px",
                background: mainChain === "eth" ? "#2775CA" : "#9945FF"
              }}
              onClick={handleSubmit}
              disabled={loading || !isConnectedForMain}
            >
              {loading ? "Se proceseaza..." : `Lanseaza pe ${mainChain === "eth" ? "Ethereum" : "Solana"}`}
            </button>
          </div>

          <div className="create-sidebar">
            <div className="info-card card">
              <h4 className="info-title">Cum functioneaza?</h4>
              <div className="info-steps">
                {[
                  ["01", "Alegi main chain", "Logica campaniei si retragerea fondurilor se fac pe acest blockchain."],
                  ["02", "Accepti donatii", "Din ETH, SOL sau ambele ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â tu decizi."],
                  ["03", "Donatorii contribuie", "Din orice chain acceptat, in USDC."],
                  ["04", "Progress unificat", "Totalul in USDC e agregat din toate chain-urile."],
                  ["05", "Retragi fondurile", "De pe fiecare chain separat, dupa atingerea goalului."],
                ].map(([n, t, d]) => (
                  <div key={n} className="info-step">
                    <span className="step-num" style={{
                      background: mainChain === "eth" ? "rgba(39,117,202,0.15)" : "rgba(153,69,255,0.15)",
                      color: mainChain === "eth" ? "#2775CA" : "#9945FF"
                    }}>{n}</span>
                    <div><strong>{t}</strong><p>{d}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-card card" style={{marginTop:"16px"}}>
              <h4 className="info-title">Rezumat configuratie</h4>
              <div style={{fontSize:"13px", lineHeight:"1.8"}}>
                <div><strong>Main chain:</strong> <span style={{color: mainChain === "eth" ? "#627EEA" : "#9945FF", fontWeight:"600"}}>{mainChain === "eth" ? "Ethereum Sepolia" : "Solana Devnet"}</span></div>
                <div><strong>Donatii acceptate:</strong> {acceptedChains.map(c => c.toUpperCase()).join(" + ")} USDC</div>
                <div><strong>Goal:</strong> ${parseFloat(form.goal || 0).toFixed(2)} USDC</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
