import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useVersion } from "../context/version";
import "./Navbar.css";

export default function Navbar({ ethConnected, solConnected, ethAddress, solAddress, solWalletName, onConnectEth, onConnectSol, onConnectSolflare, onDisconnectEth, onDisconnectSol }) {
  const location = useLocation();
  const { version, switchVersion } = useVersion();
  const navigate = useNavigate();
  const routeVersion = location.pathname.startsWith("/v2") ? "v2" : "v1";

  useEffect(() => {
    if (version !== routeVersion) {
      switchVersion(routeVersion);
    }
  }, [routeVersion, switchVersion, version]);

  function handleVersionSwitch(v) {
    switchVersion(v);
    if (v === "v2") navigate("/v2");
    else navigate("/");
  }

  const isActive = (paths) => paths.some(p => location.pathname === p || location.pathname.startsWith(p));
  const campaignsPath = routeVersion === "v2" ? "/v2" : "/";
  const ongPath = routeVersion === "v2" ? "/v2/ong" : "/ong";
  const kickstartPath = routeVersion === "v2" ? "/v2/kickstart" : "/kickstart";
  const isCampaignsActive = routeVersion === "v2"
    ? location.pathname === "/v2" || location.pathname.startsWith("/v2/campaign")
    : location.pathname === "/" || location.pathname.startsWith("/campaign/");
  const isOngActive = routeVersion === "v2"
    ? location.pathname === "/v2/ong" || location.pathname === "/v2/create"
    : isActive(["/ong", "/create-ong"]);

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
          <Link to={campaignsPath} className={isCampaignsActive ? "nav-link active" : "nav-link"}>
            Campanii
          </Link>
          <Link to={ongPath} className={isOngActive ? "nav-link active" : "nav-link"}>
            ONG / Fundatii
          </Link>
          <Link to={kickstartPath} className={isActive(["/kickstart", "/v2/kickstart", "/create-kickstart", "/milestone", "/solana-milestone"]) ? "nav-link active" : "nav-link"}>
            Kickstart
          </Link>
        </div>

        <div className="version-switcher">
          <button
            className={routeVersion === "v1" ? "version-btn active" : "version-btn"}
            onClick={() => handleVersionSwitch("v1")}
            title="ETH / SOL - Campanii native crypto"
          >
            v1 <span className="version-label">ETH/SOL</span>
          </button>
          <button
            className={routeVersion === "v2" ? "version-btn active v2" : "version-btn v2"}
            onClick={() => handleVersionSwitch("v2")}
            title="USDC - Campanii in stablecoin"
          >
            v2 <span className="version-label">USDC</span>
          </button>
        </div>

        <div className="navbar-wallets">
          <div className="wallet-btn-group">
            <button
              className={ethConnected ? "wallet-btn connected" : "wallet-btn"}
              onClick={!ethConnected ? onConnectEth : undefined}
            >
              <span className="wallet-dot eth-dot"></span>
              {ethConnected ? ethAddress.slice(0,6) + "..." + ethAddress.slice(-4) : "MetaMask"}
            </button>
            {ethConnected && (
              <button className="disconnect-btn" onClick={onDisconnectEth} title="Deconecteaza MetaMask">x</button>
            )}
          </div>

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
            <div className="wallet-btn-group">
              <button className="wallet-btn connected">
                <span className="wallet-dot sol-dot"></span>
                {solWalletName}: {solAddress.slice(0,4)}...{solAddress.slice(-4)}
              </button>
              <button className="disconnect-btn" onClick={onDisconnectSol} title="Deconecteaza Solana">x</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
