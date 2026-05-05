import { useState } from "react";
import { Link } from "react-router-dom";
import "./AllCampaigns.css";

export default function OngCampaigns() {
  return (
    <div className="all-campaigns-page">
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-label">ONG si Fundatii</div>
            <h1 className="hero-title">Strangere de Fonduri<br/>pentru Cauze Nobile.</h1>
            <div className="divider"></div>
            <p className="hero-desc">Organizatii non-profit pot crea campanii simple de strangere fonduri pe Ethereum sau Solana.</p>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><span className="hero-stat-value">ETH</span><span className="hero-stat-label">Ethereum</span></div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat"><span className="hero-stat-value">SOL</span><span className="hero-stat-label">Solana</span></div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat"><span className="hero-stat-value">USD</span><span className="hero-stat-label">Goal in USD</span></div>
          </div>
        </div>
      </section>
      <section className="campaigns-section">
        <div className="container">
          <div className="section-header">
            <div><h2 className="section-title">Campanii ONG</h2><div className="divider"></div></div>
            <div style={{display:"flex", gap:"12px"}}>
              <Link to="/create" className="btn-outline">+ ETH Campaign</Link>
              <Link to="/create-unified" className="btn-gold">+ Cross-Chain</Link>
            </div>
          </div>
          <div className="empty-state">
            <div className="empty-icon">◇</div>
            <h3>Sectiune in constructie</h3>
            <p>Inregistreaza organizatia ta si creeaza prima campanie.</p>
            <div style={{display:"flex", gap:"12px", justifyContent:"center", marginTop:"24px"}}>
              <Link to="/create" className="btn-primary">Campanie ETH</Link>
              <Link to="/create-unified" className="btn-gold">Campanie Cross-Chain</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
