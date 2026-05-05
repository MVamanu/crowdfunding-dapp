import "./ConnectWalletModal.css";

export default function ConnectWalletModal({ onClose, onConnectEth, onConnectSol, onConnectSolflare }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>X</button>
        <div className="modal-header">
          <div className="modal-icon">◆</div>
          <h2 className="modal-title">Connect Your Wallet</h2>
          <p className="modal-desc">Connect a wallet to donate to this campaign. Your contribution is secured by a smart contract.</p>
        </div>

        <div className="modal-wallets">
          <button className="modal-wallet-btn eth" onClick={() => { onConnectEth(); onClose(); }}>
            <div className="wallet-logo eth-logo">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
                <path d="M12 2L4 12.5L12 16L20 12.5L12 2Z" fill="#627EEA" opacity="0.8"/>
                <path d="M12 16L4 12.5L12 22L20 12.5L12 16Z" fill="#627EEA"/>
                <path d="M12 2L12 16L20 12.5L12 2Z" fill="#627EEA" opacity="0.6"/>
                <path d="M12 16L12 22L20 12.5L12 16Z" fill="#627EEA" opacity="0.6"/>
              </svg>
            </div>
            <div className="wallet-info">
              <span className="wallet-name">MetaMask</span>
              <span className="wallet-network">Ethereum Sepolia</span>
            </div>
            <span className="wallet-arrow">→</span>
          </button>

          <button className="modal-wallet-btn sol" onClick={() => { onConnectSol(); onClose(); }}>
            <div className="wallet-logo sol-logo">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
                <path d="M4 16.5H17.5L20 14H6.5L4 16.5Z" fill="#9945FF"/>
                <path d="M4 10H17.5L20 7.5H6.5L4 10Z" fill="#9945FF" opacity="0.8"/>
                <path d="M6.5 13.25H20L17.5 10.75H4L6.5 13.25Z" fill="#9945FF" opacity="0.6"/>
              </svg>
            </div>
            <div className="wallet-info">
              <span className="wallet-name">Phantom</span>
              <span className="wallet-network">Solana Devnet</span>
            </div>
            <span className="wallet-arrow">→</span>
          </button>

          <button className="modal-wallet-btn solflare" onClick={() => { onConnectSolflare(); onClose(); }}>
            <div className="wallet-logo solflare-logo">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
                <circle cx="12" cy="12" r="10" fill="#FC8B00" opacity="0.15"/>
                <path d="M12 4L15 9H9L12 4Z" fill="#FC8B00"/>
                <path d="M12 20L9 15H15L12 20Z" fill="#FC8B00" opacity="0.7"/>
                <path d="M4 12L9 9V15L4 12Z" fill="#FC8B00" opacity="0.5"/>
                <path d="M20 12L15 15V9L20 12Z" fill="#FC8B00" opacity="0.5"/>
              </svg>
            </div>
            <div className="wallet-info">
              <span className="wallet-name">Solflare</span>
              <span className="wallet-network">Solana Devnet</span>
            </div>
            <span className="wallet-arrow">→</span>
          </button>
        </div>

        <p className="modal-footer">
          New to crypto wallets? <a href="https://metamask.io" target="_blank" rel="noreferrer">Learn more →</a>
        </p>
      </div>
    </div>
  );
}
