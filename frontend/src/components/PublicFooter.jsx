import "./PublicFooter.css";

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="container public-footer-inner">
        <div>
          <div className="footer-brand">FundChain</div>
          <p>Crowdfunding descentralizat pe Ethereum si Solana</p>
        </div>
        <div className="footer-meta">
          <span>Dezvoltat de VMD</span>
          <span>v2 USDC</span>
          <span>Sepolia + Solana Devnet</span>
        </div>
      </div>
    </footer>
  );
}
