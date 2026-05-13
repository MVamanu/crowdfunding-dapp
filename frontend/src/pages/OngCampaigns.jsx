import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { useCryptoPrices } from "../hooks/useCryptoPrices";
import "./AllCampaigns.css";
import { CONTRACTS, SEPOLIA_RPC_URL, SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../config/chains";
import { getDaysLeft } from "../utils/time";

const ETH_ADDRESS = CONTRACTS.eth;
const ETH_UNIFIED_ADDRESS = CONTRACTS.unified;
const SEPOLIA_RPC = SEPOLIA_RPC_URL;
const SOL_PROGRAM_ID = SOLANA_PROGRAM_ID;
const ETH_ABI = ["function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goal,uint256 amountRaised,bool isActive,uint256 deadline))", "function campaignCount() view returns (uint256)"];
const ETH_UNIFIED_ABI = ["function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goalUSD,uint256 amountRaisedETH,bool isActive,uint256 deadline,string solanaAddress))", "function campaignCount() view returns (uint256)"];

export default function OngCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const { prices } = useCryptoPrices();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const all = [];
      const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);

      try {
        const contract = new ethers.Contract(ETH_ADDRESS, ETH_ABI, provider);
        const count = await contract.campaignCount();
        for (let i = 0; i < Number(count); i++) {
          const c = await contract.getCampaign(i);
          all.push({
            id: i, title: c.title, description: c.description,
            raisedUSD: (Number(c.amountRaised) / 1e18) * prices.eth,
            goalUSD: (Number(c.goal) / 1e18) * prices.eth,
            isActive: c.isActive, owner: c.owner,
            blockchain: "eth", type: "simple",
            route: `/campaign/eth/${i}`,
            deadline: new Date(Number(c.deadline) * 1000)
          });
        }
      } catch (e) { console.error(e); }

      try {
        const contract = new ethers.Contract(ETH_UNIFIED_ADDRESS, ETH_UNIFIED_ABI, provider);
        const count = await contract.campaignCount();
        for (let i = 0; i < Number(count); i++) {
          const c = await contract.getCampaign(i);
          all.push({
            id: `cross-${i}`, title: c.title, description: c.description,
            raisedUSD: (Number(c.amountRaisedETH) / 1e18) * prices.eth,
            goalUSD: Number(c.goalUSD),
            isActive: c.isActive, owner: c.owner,
            blockchain: "cross", type: "cross",
            route: `/unified/${i}`,
            deadline: new Date(Number(c.deadline) * 1000)
          });
        }
      } catch (e) { console.error(e); }

      try {
        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const dummyWallet = { publicKey: PublicKey.default, signTransaction: async t => t, signAllTransactions: async t => t };
        const prov = new anchor.AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
        anchor.setProvider(prov);
        const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, prov);
        if (idl) {
          const program = new anchor.Program(idl, prov);
          const accounts = await program.account.campaign.all();
          for (const acc of accounts) {
            const d = acc.account;
            all.push({
              id: acc.publicKey.toString(), title: d.title, description: d.description,
              raisedUSD: (Number(d.amountRaised) / 1e9) * prices.sol,
              goalUSD: (Number(d.goal) / 1e9) * prices.sol,
              isActive: d.isActive, owner: d.owner.toString(),
              blockchain: "sol", type: "simple",
              route: `/campaign/sol/${acc.publicKey.toString()}`,
              deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
          }
        }
      } catch (e) { console.error(e); }

      setCampaigns(all);
      setLoading(false);
    }
    if (prices.eth > 0) load();
  }, [prices]);

  const filtered = campaigns.filter(c => filter === "all" || c.blockchain === filter);
  const totalRaised = campaigns.reduce((s, c) => s + c.raisedUSD, 0);
  const activeCampaigns = campaigns.filter(c => c.isActive).length;

  return (
    <div className="all-campaigns-page">
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-label">ONG si Fundatii</div>
            <h1 className="hero-title">Strangere de Fonduri<br/>pentru Cauze Nobile.</h1>
            <div className="divider"></div>
            <p className="hero-desc">Organizatii non-profit pot crea campanii simple de strangere fonduri pe Ethereum, Solana sau Cross-Chain.</p>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{activeCampaigns}</span>
              <span className="hero-stat-label">Campanii Active</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat">
              <span className="hero-stat-value">${totalRaised.toFixed(0)}</span>
              <span className="hero-stat-label">Total Strans USD</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat">
              <span className="hero-stat-value">3</span>
              <span className="hero-stat-label">Tipuri Campanii</span>
            </div>
          </div>
        </div>
      </section>

      <section className="campaigns-section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="section-title">Campanii ONG</h2>
              <div className="divider"></div>
            </div>
            <div style={{display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap"}}>
              <div className="filter-tabs">
                {[["all","Toate"],["eth","Ethereum"],["sol","Solana"],["cross","Cross-Chain"]].map(([v,l]) => (
                  <button key={v} className={filter === v ? "filter-tab active" : "filter-tab"} onClick={() => setFilter(v)}>{l}</button>
                ))}
              </div>
              <Link to="/create" className="btn-outline" style={{whiteSpace:"nowrap"}}>+ ETH</Link>
              <Link to="/create-sol" className="btn-outline" style={{whiteSpace:"nowrap", borderColor:"#9945ff", color:"#9945ff"}}>+ SOL</Link>
              <Link to="/create-unified" className="btn-gold" style={{whiteSpace:"nowrap"}}>+ Cross-Chain</Link>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="loading-spinner"></div><p>Se incarca campaniile...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">EMPTY</div>
              <h3>Nicio campanie</h3>
              <p>Fii primul care lanseaza o campanie pentru organizatia ta.</p>
              <div style={{display:"flex", gap:"12px", justifyContent:"center", marginTop:"24px"}}>
                <Link to="/create" className="btn-primary">Campanie ETH</Link>
                <Link to="/create-unified" className="btn-gold">Campanie Cross-Chain</Link>
              </div>
            </div>
          ) : (
            <div className="campaigns-grid">
              {filtered.map(c => {
                const progress = Math.min(c.goalUSD > 0 ? (c.raisedUSD / c.goalUSD) * 100 : 0, 100);
                const daysLeft = getDaysLeft(c.deadline);
                return (
                  <Link to={c.route} key={c.id} className="campaign-card card">
                    <div className="card-header">
                      <div className="card-badges">
                        <span className={`badge badge-${c.blockchain}`}>{c.blockchain.toUpperCase()}</span>
                        {c.type === "cross" && <span className="badge" style={{background:"rgba(99,102,241,0.15)", color:"#6366f1"}}>CROSS</span>}
                        <span className={`badge badge-${c.isActive ? "active" : "inactive"}`}>{c.isActive ? "Activa" : "Inchisa"}</span>
                      </div>
                      <span className="days-left">{daysLeft}d left</span>
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">{c.title}</h3>
                      <div className="divider"></div>
                      <p className="card-desc">{c.description?.slice(0,100)}{c.description?.length > 100 ? "..." : ""}</p>
                    </div>
                    <div className="card-footer">
                      <div className="progress-bar"><div className="progress-fill" style={{width:`${progress}%`}}></div></div>
                      <div className="card-stats">
                        <div>
                          <span className="stat-value">{progress.toFixed(1)}%</span>
                          <span className="stat-label">funded</span>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <span className="stat-value">${c.raisedUSD.toFixed(2)}</span>
                          <span className="stat-label">of ${c.goalUSD.toFixed(2)} USD</span>
                        </div>
                      </div>
                      <div className="card-owner">
                        <span className="owner-label">by</span>
                        <span className="owner-addr">{c.owner?.slice(0,6)}...{c.owner?.slice(-4)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
