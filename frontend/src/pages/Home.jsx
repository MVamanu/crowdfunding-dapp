import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import CampaignCard from "../components/CampaignCard";
import { saveCampaignsToCache, loadCampaignsFromCache } from "../utils/campaignCache";
import { useCryptoPrices } from "../hooks/useCryptoPrices";
import "./Home.css";
import { CONTRACTS, SEPOLIA_RPC_URL, SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../config/chains";

const ETH_CONTRACT_ADDRESS = CONTRACTS.eth;
const ETH_ABI = [
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goal,uint256 amountRaised,bool isActive,uint256 deadline))",
  "function campaignCount() view returns (uint256)",
];
const SEPOLIA_RPC = SEPOLIA_RPC_URL;
const SOL_PROGRAM_ID = SOLANA_PROGRAM_ID;

export default function Home({ ethContract, solWallet }) {
  const [campaigns, setCampaigns] = useState(loadCampaignsFromCache());
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { formatUSD, toUSD, prices } = useCryptoPrices();
  const totalUSD = campaigns.reduce((sum, c) => sum + parseFloat(toUSD(c.amountRaised, c.blockchain) || 0), 0);
  

  useEffect(() => {
    async function loadCampaigns() {
      setLoading(true);
      const results = [];

      try {
        const provider = ethContract
          ? ethContract.runner.provider
          : new ethers.JsonRpcProvider(SEPOLIA_RPC);
        const contract = ethContract || new ethers.Contract(ETH_CONTRACT_ADDRESS, ETH_ABI, provider);
        const count = await contract.campaignCount();
        for (let i = 0; i < Number(count); i++) {
          const c = await contract.getCampaign(i);
          results.push({
            id: i, title: c.title, description: c.description,
            goal: c.goal.toString(), amountRaised: c.amountRaised.toString(),
            isActive: c.isActive, owner: c.owner,
            deadline: new Date(Number(c.deadline) * 1000).toISOString(),
            blockchain: "eth"
          });
        }
      } catch (e) { console.error("ETH load error:", e); }

      try {
        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const dummyWallet = {
          publicKey: PublicKey.default,
          signTransaction: async t => t,
          signAllTransactions: async t => t
        };
        const walletToUse = (solWallet && solWallet.publicKey) ? solWallet : dummyWallet;
        const provider = new anchor.AnchorProvider(connection, walletToUse, { commitment: "confirmed" });
        anchor.setProvider(provider);

        const idl = await anchor.Program.fetchIdl(SOL_PROGRAM_ID, provider);
        if (idl) {
          const program = new anchor.Program(idl, provider);
          const accounts = await program.account.campaign.all();
          const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          for (const acc of accounts) {
            const d = acc.account;
            results.push({
              id: acc.publicKey.toString(),
              title: d.title,
              description: d.description,
              goal: d.goal.toString(),
              amountRaised: d.amountRaised.toString(),
              isActive: d.isActive,
              owner: d.owner.toString(),
              deadline: thirtyDays,
              blockchain: "sol"
            });
          }
        }
      } catch (e) { console.error("SOL load error:", e); }

      saveCampaignsToCache(results);
      setCampaigns(results);
      setLoading(false);
    }
    loadCampaigns();
  }, [ethContract, solWallet]);

  const filtered = campaigns.filter(c => filter === "all" || c.blockchain === filter);

  return (
    <div className="home-page">
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-label">Blockchain Crowdfunding</div>
            <h1 className="hero-title">Fund the Future,<br/>On-Chain.</h1>
            <div className="divider"></div>
            <p className="hero-desc">Transparent, decentralized fundraising on Ethereum and Solana. Every transaction verifiable, every contribution immutable.</p>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{campaigns.length}</span>
              <span className="hero-stat-label">Active Campaigns</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat">
              <span className="hero-stat-value">2</span>
              <span className="hero-stat-label">Blockchains</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat">
              <span className="hero-stat-value">${totalUSD.toFixed(0)}</span>
              <span className="hero-stat-label">Total Raised USD</span>
            </div>
          </div>
        </div>
      </section>

      <section className="campaigns-section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="section-title">Active Campaigns</h2>
              <div className="divider"></div>
            </div>
            <div className="filter-tabs">
              {["all","eth","sol"].map(f => (
                <button key={f} className={filter === f ? "filter-tab active" : "filter-tab"} onClick={() => setFilter(f)}>
                  {f === "all" ? "All" : f === "eth" ? "Ethereum" : "Solana"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading campaigns from blockchain...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">EMPTY</div>
              <h3>No campaigns yet</h3>
              <p>Connect your wallet and create the first campaign.</p>
            </div>
          ) : (
            <div className="campaigns-grid">
              {filtered.map(c => <CampaignCard key={`${c.blockchain}-${c.id}`} campaign={c} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
