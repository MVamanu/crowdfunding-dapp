import { SOLANA_CLUSTER, SOLANA_PROGRAM_ID } from "../config/chains";
import "./PublicStatus.css";

const STABLE_V2_CONTRACT = "0xe3222De4403B1B48C687a60449C6Bd9c31f5Cb87";

export default function PublicStatus() {
  return (
    <div className="public-status">
      <div className="container public-status-inner">
        <div className="status-message">
          <span className="status-pill">Live testnet</span>
          <span>FundChain este online pentru demo pe Sepolia si Solana Devnet.</span>
        </div>
        <div className="status-network-links">
          <a
            href={`https://sepolia.etherscan.io/address/${STABLE_V2_CONTRACT}`}
            target="_blank"
            rel="noreferrer"
          >
            Contract USDC
          </a>
          <a
            href={`https://explorer.solana.com/address/${SOLANA_PROGRAM_ID.toString()}?cluster=${SOLANA_CLUSTER}`}
            target="_blank"
            rel="noreferrer"
          >
            Program Solana
          </a>
        </div>
      </div>
    </div>
  );
}
