import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import "../CreateCampaign.css";
import "../CreateMilestoneCampaign.css";
import "./V2.css";
import { CONTRACTS, SOLANA_PROGRAM_ID, SOLANA_RPC_URL, SPL_TOKEN_PROGRAM_ID, USDC } from "../../config/chains";

const STABLE_MILESTONE_CONTRACT = CONTRACTS.stableMilestone;
const STABLE_MILESTONE_ABI = [
  "function createCampaign(string,string,uint256,string,string[],string[],string[],string[],uint256[]) returns (uint256)",
];

const CHAINS = [
  { id: "eth", name: "Ethereum", color: "#627EEA" },
  { id: "sol", name: "Solana", color: "#9945FF" },
];
const textEncoder = new TextEncoder();

function toUsdcAmount(value) {
  return BigInt(Math.round(Number(value) * 1_000_000));
}

export default function CreateKickstartV2({ ethConnected, solConnected, solWallet }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", duration: "" });
  const [mainChain, setMainChain] = useState("eth");
  const [acceptedChains, setAcceptedChains] = useState(["eth", "sol"]);
  const [milestones, setMilestones] = useState([
    { title: "", description: "", amount: "" },
    { title: "", description: "", amount: "" },
  ]);

  const totalGoal = milestones.reduce((sum, milestone) => sum + (Number(milestone.amount) || 0), 0);

  function handleFormChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function handleMilestoneChange(index, field, value) {
    const next = [...milestones];
    next[index][field] = value;
    setMilestones(next);
  }

  function toggleChain(chainId) {
    if (acceptedChains.includes(chainId)) {
      if (acceptedChains.length > 1) {
        setAcceptedChains(acceptedChains.filter(chain => chain !== chainId));
      }
      return;
    }
    setAcceptedChains([...acceptedChains, chainId]);
  }

  function addMilestone() {
    if (milestones.length < 10) {
      setMilestones([...milestones, { title: "", description: "", amount: "" }]);
    }
  }

  function removeMilestone(index) {
    if (milestones.length > 2) {
      setMilestones(milestones.filter((_, i) => i !== index));
    }
  }

  async function handleSubmit() {
    setError("");

    if (mainChain === "eth" && !STABLE_MILESTONE_CONTRACT) {
      setError("Contractul USDC milestone nu este configurat.");
      return;
    }
    if (mainChain === "eth" && !ethConnected) {
      setError("Conecteaza MetaMask pentru a crea campania.");
      return;
    }
    if (mainChain === "sol" && (!solConnected || !solWallet)) {
      setError("Conecteaza Phantom sau Solflare pentru a crea campania pe Solana.");
      return;
    }
    if (!form.title || !form.description || !form.duration) {
      setError("Completeaza detaliile campaniei.");
      return;
    }
    if (Number(form.duration) <= 0) {
      setError("Durata trebuie sa fie pozitiva.");
      return;
    }
    for (const milestone of milestones) {
      if (!milestone.title || !milestone.description || !milestone.amount) {
        setError("Completeaza toate milestone-urile.");
        return;
      }
      if (Number(milestone.amount) <= 0) {
        setError("Sumele milestone-urilor trebuie sa fie pozitive.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mainChain === "eth") {
        const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
        const provider = new ethers.BrowserProvider(metamask);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(STABLE_MILESTONE_CONTRACT, STABLE_MILESTONE_ABI, signer);
        const externalAddresses = acceptedChains.map(() => "");

        const tx = await contract.createCampaign(
          form.title,
          form.description,
          BigInt(form.duration),
          "eth",
          acceptedChains,
          externalAddresses,
          milestones.map(milestone => milestone.title),
          milestones.map(milestone => milestone.description),
          milestones.map(milestone => toUsdcAmount(milestone.amount))
        );
        await tx.wait();
      } else {
        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const provider = new anchor.AnchorProvider(connection, solWallet, { commitment: "confirmed" });
        anchor.setProvider(provider);
        const idl = await anchor.Program.fetchIdl(SOLANA_PROGRAM_ID, provider);
        if (!idl) throw new Error("Nu s-a putut obtine IDL-ul Solana.");
        const program = new anchor.Program(idl, provider);
        const campaignKeypair = Keypair.generate();
        const [vaultPDA] = PublicKey.findProgramAddressSync(
          [textEncoder.encode("usdc_milestone_vault"), campaignKeypair.publicKey.toBuffer()],
          SOLANA_PROGRAM_ID
        );

        await program.methods
          .createUsdcMilestoneCampaign(
            form.title,
            form.description,
            milestones.map(milestone => milestone.title),
            milestones.map(milestone => milestone.description),
            milestones.map(milestone => new anchor.BN(toUsdcAmount(milestone.amount).toString()))
          )
          .accounts({
            usdcMilestoneCampaign: campaignKeypair.publicKey,
            vault: vaultPDA,
            usdcMint: USDC.solanaDevnetMint,
            owner: solWallet.publicKey,
            tokenProgram: SPL_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([campaignKeypair])
          .rpc();
      }
      navigate("/v2/kickstart");
    } catch (e) {
      setError(e.reason || e.message || "Tranzactie esuata.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="create-page">
      <div className="container">
        <div className="create-header">
          <div className="v2-badge">v2 - USDC Milestones</div>
          <h1 className="create-title">Campanie Kickstart USDC</h1>
          <div className="divider"></div>
          <p className="create-desc">Finantare in USDC, milestone-uri si tracking pentru donatii cross-chain.</p>
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
              <div className="form-group">
                <label className="form-label">Durata (zile)</label>
                <input className="form-input" name="duration" type="number" value={form.duration} onChange={handleFormChange} placeholder="30" />
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Main chain</h3>
              <div className="chain-grid">
                {CHAINS.map(chain => (
                  <button
                    key={chain.id}
                    type="button"
                    className={mainChain === chain.id ? "chain-option selected" : "chain-option"}
                    style={{ borderColor: mainChain === chain.id ? chain.color : undefined }}
                    onClick={() => setMainChain(chain.id)}
                  >
                    <strong style={{ color: mainChain === chain.id ? chain.color : undefined }}>{chain.name}</strong>
                    <span>{mainChain === chain.id ? "principal" : "selecteaza"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Chain-uri acceptate</h3>
              <div className="chain-grid">
                {CHAINS.map(chain => (
                  <button
                    key={chain.id}
                    type="button"
                    className={acceptedChains.includes(chain.id) ? "chain-option selected" : "chain-option"}
                    style={{ borderColor: acceptedChains.includes(chain.id) ? chain.color : undefined }}
                    onClick={() => toggleChain(chain.id)}
                  >
                    <strong style={{ color: acceptedChains.includes(chain.id) ? chain.color : undefined }}>{chain.name}</strong>
                    <span>USDC {acceptedChains.includes(chain.id) ? "activ" : "inactiv"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <div className="milestones-header">
                <h3 className="form-section-title">Milestone-uri ({milestones.length}/10)</h3>
                {milestones.length < 10 && (
                  <button type="button" className="add-milestone-btn" onClick={addMilestone}>+ Adauga</button>
                )}
              </div>

              {milestones.map((milestone, index) => (
                <div key={index} className="milestone-item">
                  <div className="milestone-header">
                    <span className="milestone-num">Etapa {index + 1}</span>
                    {milestones.length > 2 && (
                      <button type="button" className="remove-milestone-btn" onClick={() => removeMilestone(index)}>X</button>
                    )}
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Titlu etapa</label>
                      <input className="form-input" value={milestone.title} onChange={e => handleMilestoneChange(index, "title", e.target.value)} placeholder="ex: Prototype" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Suma (USDC)</label>
                      <input className="form-input" type="number" step="1" value={milestone.amount} onChange={e => handleMilestoneChange(index, "amount", e.target.value)} placeholder="1000" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descriere etapa</label>
                    <input className="form-input" value={milestone.description} onChange={e => handleMilestoneChange(index, "description", e.target.value)} placeholder="Ce livrezi in aceasta etapa?" />
                  </div>
                </div>
              ))}

              <div className="total-goal">
                <span className="total-label">Goal Total:</span>
                <span className="total-value">${totalGoal.toFixed(2)} USDC</span>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}
            <button className="btn-usdc submit-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? "Se proceseaza..." : `Lanseaza pe ${mainChain === "eth" ? "Ethereum" : "Solana"}`}
            </button>
          </div>

          <div className="create-sidebar">
            <div className="info-card card">
              <h4 className="info-title">Flow V2</h4>
              <div className="info-steps">
                {[
                  ["01", "Milestone-uri in USDC", "Goalul total este suma etapelor."],
                  ["02", "Donatii locale", "Donatorii contribuie cu USDC pe Ethereum."],
                  ["03", "Tracking extern", "Ownerul poate inregistra donatii confirmate pe Solana."],
                  ["04", "Vot ponderat", "Puterea de vot include contributiile locale si externe."],
                  ["05", "Release etapizat", "USDC-ul local se elibereaza pe milestone aprobat."],
                ].map(([number, title, desc]) => (
                  <div key={number} className="info-step">
                    <span className="step-num">{number}</span>
                    <div><strong>{title}</strong><p>{desc}</p></div>
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
