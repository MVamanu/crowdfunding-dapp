import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import "../AllCampaigns.css";
import "./V2.css";
import { CONTRACTS, SEPOLIA_RPC_URL, SOLANA_PROGRAM_ID, SOLANA_RPC_URL } from "../../config/chains";

const STABLE_MILESTONE_CONTRACT = CONTRACTS.stableMilestone;
const STABLE_MILESTONE_ABI = [
  "function campaignCount() view returns (uint256)",
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 totalGoal,uint256 amountRaisedLocal,uint256 amountRaisedExternal,bool isActive,uint256 deadline,bool goalReached,string mainChain,string[] acceptedChains,uint256 milestoneCount,uint256 currentMilestone))",
  "function getMilestone(uint256,uint256) view returns (tuple(string title,string description,uint256 amount,bool completed,bool approved,uint256 votesFor,uint256 votesAgainst,bool votingActive,uint256 votingDeadline))",
];

function formatUsdc(amount) {
  return (Number(amount) / 1_000_000).toFixed(2);
}

export default function KickstartCampaignsV2() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCampaigns() {
      setLoading(true);

      if (!STABLE_MILESTONE_CONTRACT) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      try {
        const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
        const contract = new ethers.Contract(
          STABLE_MILESTONE_CONTRACT,
          STABLE_MILESTONE_ABI,
          provider
        );
        const count = await contract.campaignCount();
        const loaded = [];

        for (let i = 0; i < Number(count); i++) {
          const campaign = await contract.getCampaign(i);
          const milestoneCount = Number(campaign.milestoneCount);
          const currentMilestone = Number(campaign.currentMilestone);
          const activeMilestone =
            milestoneCount > 0 && currentMilestone < milestoneCount
              ? await contract.getMilestone(i, currentMilestone)
              : null;

          loaded.push({
            id: i,
            owner: campaign.owner,
            title: campaign.title,
            description: campaign.description,
            goal: Number(campaign.totalGoal),
            amountRaised: Number(campaign.amountRaisedLocal) + Number(campaign.amountRaisedExternal),
            amountRaisedLocal: Number(campaign.amountRaisedLocal),
            amountRaisedExternal: Number(campaign.amountRaisedExternal),
            isActive: campaign.isActive,
            goalReached: campaign.goalReached,
            deadline: Number(campaign.deadline),
            acceptedChains: campaign.acceptedChains,
            milestoneCount,
            currentMilestone,
            activeMilestone,
          });
        }

        try {
          const connection = new Connection(SOLANA_RPC_URL, "confirmed");
          const dummyWallet = {
            publicKey: PublicKey.default,
            signTransaction: async tx => tx,
            signAllTransactions: async txs => txs,
          };
          const provider = new anchor.AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
          const idl = await anchor.Program.fetchIdl(SOLANA_PROGRAM_ID, provider);
          if (idl) {
            const program = new anchor.Program(idl, provider);
            const accounts = await program.account.usdcMilestoneCampaign.all();
            for (const account of accounts) {
              const campaign = account.account;
              const milestoneCount = Number(campaign.milestoneCount);
              const currentMilestone = Number(campaign.currentMilestone);
              const activeMilestone =
                milestoneCount > 0 && currentMilestone < milestoneCount
                  ? campaign.milestones[currentMilestone]
                  : null;

              loaded.push({
                id: account.publicKey.toString(),
                owner: campaign.owner.toString(),
                title: campaign.title,
                description: campaign.description,
                goal: Number(campaign.totalGoal),
                amountRaised: Number(campaign.amountRaised),
                amountRaisedLocal: Number(campaign.amountRaised),
                amountRaisedExternal: 0,
                isActive: campaign.isActive,
                goalReached: campaign.goalReached,
                acceptedChains: ["sol"],
                milestoneCount,
                currentMilestone,
                activeMilestone,
                route: `/v2/kickstart/sol/${account.publicKey.toString()}`,
              });
            }
          }
        } catch (error) {
          console.error("SOL USDC milestone campaigns:", error);
        }

        setCampaigns(loaded);
      } catch (error) {
        console.error("USDC milestone campaigns:", error);
        setCampaigns([]);
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
  }, []);

  const totalRaised = campaigns.reduce((sum, campaign) => sum + campaign.amountRaised, 0);

  return (
    <div className="all-campaigns-page">
      <section className="hero v2-hero">
        <div className="container">
          <div className="hero-content">
            <div className="v2-badge">v2 - USDC Milestones</div>
            <h1 className="hero-title">Kickstart USDC,<br />cu milestone-uri.</h1>
            <div className="divider"></div>
            <p className="hero-desc">
              Campanii cu finantare in USDC si eliberare etapizata pe baza milestone-urilor.
            </p>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{campaigns.filter(c => c.isActive).length}</span>
              <span className="hero-stat-label">Active</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat">
              <span className="hero-stat-value">${formatUsdc(totalRaised)}</span>
              <span className="hero-stat-label">USDC Strans</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat">
              <span className="hero-stat-value">{campaigns.reduce((sum, c) => sum + c.milestoneCount, 0)}</span>
              <span className="hero-stat-label">Milestone-uri</span>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="container trust-strip-inner">
          <div>
            <span className="trust-kicker">Milestone-uri</span>
            <strong>Fonduri eliberate etapizat, dupa progres verificabil.</strong>
          </div>
          <div>
            <span className="trust-kicker">Token</span>
            <strong>USDC pe testnet, fara expunere la volatilitate crypto.</strong>
          </div>
          <div>
            <span className="trust-kicker">Demo public</span>
            <strong>Flux creat pentru verificare online si prezentare.</strong>
          </div>
        </div>
      </section>

      <section className="campaigns-section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="section-title">Kickstart USDC</h2>
              <div className="divider"></div>
            </div>
            <Link to="/v2/kickstart/create" className="btn-usdc">+ Campanie Noua</Link>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Se incarca...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">USDC</div>
              <h3>Nu exista campanii USDC cu milestone-uri</h3>
              <p>Configureaza contractul nou si lanseaza prima campanie.</p>
              <Link to="/v2/kickstart/create" className="btn-usdc" style={{ display: "inline-flex", marginTop: "16px" }}>+ Campanie Noua</Link>
            </div>
          ) : (
            <div className="campaigns-grid">
              {campaigns.map(campaign => {
                const progress = Math.min(
                  campaign.goal > 0 ? (campaign.amountRaised / campaign.goal) * 100 : 0,
                  100
                );
                const milestoneLabel =
                  campaign.milestoneCount > 0
                    ? `${Math.min(campaign.currentMilestone + 1, campaign.milestoneCount)}/${campaign.milestoneCount}`
                    : "0/0";

                return (
                  <Link
                    to={campaign.route || `/v2/kickstart/${campaign.id}`}
                    key={campaign.id}
                    className="campaign-card card v2-card"
                  >
                    <div className="card-header">
                      <div className="card-badges">
                        <span className="badge badge-usdc">USDC</span>
                        <span className="badge badge-active">Milestone</span>
                        <span className="badge badge-eth">{campaign.acceptedChains.join("+").toUpperCase()}</span>
                        <span className={`badge badge-${campaign.isActive ? "active" : "inactive"}`}>
                          {campaign.goalReached ? "Goal Atins" : campaign.isActive ? "Activa" : "Inchisa"}
                        </span>
                      </div>
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">{campaign.title}</h3>
                      <div className="divider"></div>
                      <p className="card-desc">
                        {campaign.description?.slice(0, 100)}
                        {campaign.description?.length > 100 ? "..." : ""}
                      </p>
                    </div>
                    <div className="card-footer">
                      <div className="milestone-summary">
                        <span>Milestone curent</span>
                        <strong>{milestoneLabel}</strong>
                      </div>
                      {campaign.activeMilestone && (
                        <div className="usdc-note">
                          <span>{campaign.activeMilestone.title}</span>
                          <strong>${formatUsdc(campaign.activeMilestone.amount)}</strong>
                        </div>
                      )}
                      <div className="progress-bar v2-progress">
                        <div className="progress-fill v2-fill" style={{ width: `${progress}%` }}></div>
                      </div>
                      <div className="card-stats">
                        <div>
                          <span className="stat-value">{progress.toFixed(1)}%</span>
                          <span className="stat-label">finantat</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span className="stat-value">${formatUsdc(campaign.amountRaised)}</span>
                          <span className="stat-label">din ${formatUsdc(campaign.goal)} USDC</span>
                        </div>
                      </div>
                      <div className="card-stats compact">
                        <div><span className="stat-label">ETH local ${formatUsdc(campaign.amountRaisedLocal)}</span></div>
                        <div style={{ textAlign: "right" }}><span className="stat-label">Extern ${formatUsdc(campaign.amountRaisedExternal)}</span></div>
                      </div>
                      <div className="card-owner">
                        <span className="owner-label">Creat de</span>
                        <span className="owner-addr">
                          {campaign.owner?.slice(0, 6)}...{campaign.owner?.slice(-4)}
                        </span>
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
