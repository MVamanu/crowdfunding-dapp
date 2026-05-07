import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ethers } from "ethers";
import Navbar from "./components/Navbar";
import AllCampaigns from "./pages/AllCampaigns";
import OngCampaigns from "./pages/OngCampaigns";
import KickstartCampaigns from "./pages/KickstartCampaigns";
import CreateCampaign from "./pages/CreateCampaign";
import CampaignDetail from "./pages/CampaignDetail";
import MilestoneCampaigns from "./pages/MilestoneCampaigns";
import MilestoneCampaignDetail from "./pages/MilestoneCampaignDetail";
import CreateMilestoneCampaign from "./pages/CreateMilestoneCampaign";
import UnifiedCampaigns from "./pages/UnifiedCampaigns";
import UnifiedCampaignDetail from "./pages/UnifiedCampaignDetail";
import CreateUnifiedCampaign from "./pages/CreateUnifiedCampaign";
import SolanaMilestoneCampaigns from "./pages/SolanaMilestoneCampaigns";
import SolanaMilestoneCampaignDetail from "./pages/SolanaMilestoneCampaignDetail";
import CreateSolanaMilestone from "./pages/CreateSolanaMilestone";
import CreateSolCampaign from "./pages/CreateSolCampaign";
import CreateCrossMilestone from "./pages/CreateCrossMilestone";
import CrossMilestoneDetail from "./pages/CrossMilestoneDetail";
import { VersionProvider } from "./context/VersionContext";
import AllCampaignsV2 from "./pages/v2/AllCampaignsV2";
import CreateCampaignV2 from "./pages/v2/CreateCampaignV2";
import CampaignDetailV2 from "./pages/v2/CampaignDetailV2";
import CreateSolanaUsdcCampaign from "./pages/v2/CreateSolanaUsdcCampaign";
import "./index.css";

const ETH_CONTRACT_ADDRESS = "0x53EF55468DF1570952b7A07eF46926c3837e5770";
const ETH_ABI = [
  "function createCampaign(string,string,uint256,uint256) returns (uint256)",
  "function donate(uint256) payable",
  "function withdraw(uint256)",
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 goal,uint256 amountRaised,bool isActive,uint256 deadline))",
  "function campaignCount() view returns (uint256)",
];

export default function App() {
  const [ethConnected, setEthConnected] = useState(false);
  const [ethAddress, setEthAddress] = useState("");
  const [ethContract, setEthContract] = useState(null);
  const [solConnected, setSolConnected] = useState(false);
  const [solAddress, setSolAddress] = useState("");
  const [solWallet, setSolWallet] = useState(null);
  const [solWalletName, setSolWalletName] = useState("");

  useEffect(() => {
    async function autoConnect() {
      await new Promise(r => setTimeout(r, 500));
      if (window.solflare && window.solflare.isConnected) {
        setSolAddress(window.solflare.publicKey.toString());
        setSolWallet(window.solflare);
        setSolWalletName("Solflare");
        setSolConnected(true);
      } else if (window.solana && window.solana.isConnected) {
        setSolAddress(window.solana.publicKey.toString());
        setSolWallet(window.solana);
        setSolWalletName("Phantom");
        setSolConnected(true);
      }
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" });
          if (accounts.length > 0) {
            const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
            const provider = new ethers.BrowserProvider(metamask);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            const contract = new ethers.Contract(ETH_CONTRACT_ADDRESS, ETH_ABI, signer);
            setEthAddress(address);
            setEthContract(contract);
            setEthConnected(true);
          }
        } catch (e) { console.error(e); }
      }
    }
    autoConnect();
  }, []);

  async function connectEth() {
    if (!window.ethereum) { alert("MetaMask not found!"); return; }
    try {
      const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
      const provider = new ethers.BrowserProvider(metamask);
      await provider.send("eth_requestAccounts", []);
      await provider.send("wallet_switchEthereumChain", [{ chainId: "0xaa36a7" }]);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const contract = new ethers.Contract(ETH_CONTRACT_ADDRESS, ETH_ABI, signer);
      setEthAddress(address);
      setEthContract(contract);
      setEthConnected(true);
    } catch (e) { console.error(e); }
  }

  async function connectSol() {
    if (!window.solana || !window.solana.isPhantom) { alert("Phantom not found!"); return; }
    try {
      const resp = await window.solana.connect();
      setSolAddress(resp.publicKey.toString());
      setSolWallet(window.solana);
      setSolWalletName("Phantom");
      setSolConnected(true);
    } catch (e) { console.error(e); }
  }

  async function connectSolflare() {
    if (!window.solflare) { alert("Solflare not found!"); return; }
    try {
      await window.solflare.connect();
      if (window.solflare.isConnected) {
        setSolAddress(window.solflare.publicKey.toString());
        setSolWallet(window.solflare);
        setSolWalletName("Solflare");
        setSolConnected(true);
      }
    } catch (e) { console.error(e); }
  }

  const commonProps = {
    ethConnected, ethAddress, ethContract, solConnected, solAddress, solWallet,
    onConnectEth: connectEth, onConnectSol: connectSol, onConnectSolflare: connectSolflare
  };

  return (
    <VersionProvider>
    <BrowserRouter>
      <Navbar
        ethConnected={ethConnected} solConnected={solConnected}
        ethAddress={ethAddress} solAddress={solAddress}
        solWalletName={solWalletName}
        onConnectEth={connectEth} onConnectSol={connectSol}
        onConnectSolflare={connectSolflare}
      />
      <Routes>
        <Route path="/" element={<AllCampaigns solWallet={solWallet} />} />
        <Route path="/ong" element={<OngCampaigns solWallet={solWallet} />} />
        <Route path="/kickstart" element={<KickstartCampaigns />} />
        <Route path="/campaign/:blockchain/:id" element={<CampaignDetail {...commonProps} />} />
        <Route path="/milestone/:id" element={<MilestoneCampaignDetail {...commonProps} />} />
        <Route path="/milestone-campaigns" element={<MilestoneCampaigns />} />
        <Route path="/solana-milestones" element={<SolanaMilestoneCampaigns />} />
        <Route path="/solana-milestone/:id" element={<SolanaMilestoneCampaignDetail {...commonProps} />} />
        <Route path="/create-solana-milestone" element={<CreateSolanaMilestone solWallet={solWallet} solConnected={solConnected} />} />
        <Route path="/unified-campaigns" element={<UnifiedCampaigns />} />
        <Route path="/unified/:id" element={<UnifiedCampaignDetail {...commonProps} />} />
        <Route path="/create-unified" element={<CreateUnifiedCampaign ethConnected={ethConnected} solAddress={solAddress} />} />
        <Route path="/create-milestone" element={<CreateMilestoneCampaign ethContract={ethContract} ethConnected={ethConnected} />} />
        <Route path="/create-sol" element={<CreateSolCampaign solWallet={solWallet} solConnected={solConnected} />} />
        <Route path="/create-cross-milestone" element={<CreateCrossMilestone ethConnected={ethConnected} solAddress={solAddress} />} />
        <Route path="/cross-milestone/:id" element={<CrossMilestoneDetail {...commonProps} />} />
        <Route path="/v2" element={<AllCampaignsV2 />} />
        <Route path="/v2/create" element={<CreateCampaignV2 ethConnected={ethConnected} ethAddress={ethAddress} solWallet={solWallet} solConnected={solConnected} />} />
        <Route path="/v2/campaign/:blockchain/:id" element={<CampaignDetailV2 ethConnected={ethConnected} ethAddress={ethAddress} onConnectEth={connectEth} onConnectSol={connectSol} onConnectSolflare={connectSolflare} />} />
        <Route path="/create" element={
          <CreateCampaign ethContract={ethContract} ethConnected={ethConnected}
            solConnected={solConnected} solWallet={solWallet} solWalletName={solWalletName} />
        } />
      </Routes>
    </BrowserRouter>
    </VersionProvider>
  );
}
