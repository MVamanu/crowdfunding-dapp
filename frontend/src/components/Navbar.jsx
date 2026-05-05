import { Link, useLocation } from "react-router-dom";
import "./Navbar.css";

export default function Navbar({ ethConnected, solConnected, ethAddress, solAddress, solWalletName, onConnectEth, onConnectSol, onConnectSolflare }) {
  const location = useLocation();
  const isActive = (paths) => paths.some(p => location.pathname === p || location.pathname.startsWith(p));

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="2" width="7" height="7" fill="#c9a84c"/>
            <rect x="11" y="2" width="7" height="7" fill="#c9a84c" opacity="0.6"/>
            <rect x="2" y="11" width="7" height="7" fill="#c9a84c" opacity="0.6"/>
            <rect x="11" y="11" width="7" height="7" fill="#c9a84c"/>
          </svg>
          <span className="brand-name">FundChain</span>
        </Link>
        <div className="navbar-links">
          <Link to="/" className={isActive(["/"]) ? "nav-link active" : "nav-link"}>Campanii</Link>
          <Link to="/ong" className={isActive(["/ong", "/create-ong"]) ? "nav-link active" : "nav-link"}>ONG / Fundatii</Link>
          <Link to="/kickstart" className={isActive(["/kickstart", "/create-kickstart", "/milestone", "/solana-milestone"]) ? "nav-link active" : "nav-link"}>Kickstart</Link>
        </div>
        <div className="navbar-wallets">
          <button className={ethConnected ? "wallet-btn connected" : "wallet-btn"} onClick={onConnectEth}>
            <span className="wallet-dot eth-dot"></span>
            {ethConnected ? ethAddress.slice(0,6) + "..." + ethAddress.slice(-4) : "MetaMask"}
          </button>
          {!solConnected ? (
            <div className="sol-wallet-group">
              <button className="wallet-btn" onClick={onConnectSol}>
                <span className="wallet-dot sol-dot"></span>
                Phantom
              </button>
              <button className="wallet-btn solflare-btn" onClick={onConnectSolflare}>
                <span className="wallet-dot solflare-dot"></span>
                Solflare
              </button>
            </div>
          ) : (
            <button className="wallet-btn connected">
              <span className="wallet-dot sol-dot"></span>
              {solWalletName}: {solAddress.slice(0,4)}...{solAddress.slice(-4)}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
