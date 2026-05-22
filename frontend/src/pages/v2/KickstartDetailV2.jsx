import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ethers } from "ethers";
import ConnectWalletModal from "../../components/ConnectWalletModal";
import SocialShare from "../../components/SocialShare";
import "../CampaignDetail.css";
import "./V2.css";
import { CONTRACTS, SEPOLIA_RPC_URL, UNISWAP, USDC } from "../../config/chains";
import { getDaysLeft } from "../../utils/time";

const STABLE_MILESTONE_CONTRACT = CONTRACTS.stableMilestone;
const USDC_ADDRESS = USDC.sepoliaAddress;
const SWAP_ROUTER = UNISWAP.sepoliaSwapRouter02;
const QUOTER_V2 = UNISWAP.sepoliaQuoterV2;
const WETH_ADDRESS = UNISWAP.sepoliaWeth;
const WETH_USDC_FEE = UNISWAP.sepoliaWethUsdcFee;
const SLIPPAGE_BPS = 500n;
const BPS = 10_000n;
const STABLE_MILESTONE_ABI = [
  "function getCampaign(uint256) view returns (tuple(address owner,string title,string description,uint256 totalGoal,uint256 amountRaisedLocal,uint256 amountRaisedExternal,bool isActive,uint256 deadline,bool goalReached,string mainChain,string[] acceptedChains,uint256 milestoneCount,uint256 currentMilestone))",
  "function getMilestone(uint256,uint256) view returns (tuple(string title,string description,uint256 amount,bool completed,bool approved,uint256 votesFor,uint256 votesAgainst,bool votingActive,uint256 votingDeadline))",
  "function getVotingPower(uint256,address) view returns (uint256)",
  "function donateLocal(uint256,uint256)",
  "function submitMilestone(uint256)",
  "function vote(uint256,uint256,bool)",
  "function finalizeMilestone(uint256,uint256)",
  "function recordExternalDonation(uint256,address,uint256,string)",
];
const USDC_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];
const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
  "function exactOutputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountOut,uint256 amountInMaximum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountIn)",
  "function multicall(bytes[] data) payable returns (bytes[] results)",
  "function refundETH() payable",
];
const QUOTER_V2_ABI = [
  "function quoteExactOutputSingle((address tokenIn,address tokenOut,uint256 amount,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountIn,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
];

function formatUsdc(amount) {
  return (Number(amount) / 1_000_000).toFixed(2);
}

function toUsdcAmount(value) {
  return BigInt(Math.round(Number(value) * 1_000_000));
}

function addSlippage(amount) {
  return (amount * (BPS + SLIPPAGE_BPS)) / BPS;
}

export default function KickstartDetailV2({ ethConnected, ethAddress, onConnectEth, onConnectSol, onConnectSolflare }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [swapUsdcAmount, setSwapUsdcAmount] = useState("");
  const [quotedEth, setQuotedEth] = useState(0n);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [donateMode, setDonateMode] = useState("usdc");
  const [external, setExternal] = useState({ donor: "", amount: "", chain: "sol" });
  const [allowance, setAllowance] = useState(0n);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [votingPower, setVotingPower] = useState(0n);
  const [usdcBalance, setUsdcBalance] = useState(0n);
  const [ethBalance, setEthBalance] = useState(0n);

  async function loadData() {
    setLoading(true);
    try {
      if (!STABLE_MILESTONE_CONTRACT) {
        setCampaign(null);
        return;
      }

      const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
      const contract = new ethers.Contract(STABLE_MILESTONE_CONTRACT, STABLE_MILESTONE_ABI, provider);
      const rawCampaign = await contract.getCampaign(Number(id));
      const loadedMilestones = [];

      for (let i = 0; i < Number(rawCampaign.milestoneCount); i++) {
        const milestone = await contract.getMilestone(Number(id), i);
        loadedMilestones.push({
          title: milestone.title,
          description: milestone.description,
          amount: milestone.amount,
          completed: milestone.completed,
          approved: milestone.approved,
          votesFor: milestone.votesFor,
          votesAgainst: milestone.votesAgainst,
          votingActive: milestone.votingActive,
          votingDeadline: Number(milestone.votingDeadline),
        });
      }

      if (ethAddress) {
        const power = await contract.getVotingPower(Number(id), ethAddress);
        setVotingPower(BigInt(power));
        const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
        const currentAllowance = await usdc.allowance(ethAddress, STABLE_MILESTONE_CONTRACT);
        const balance = await usdc.balanceOf(ethAddress);
        const nativeBalance = await provider.getBalance(ethAddress);
        setAllowance(BigInt(currentAllowance));
        setUsdcBalance(BigInt(balance));
        setEthBalance(BigInt(nativeBalance));
      }

      setCampaign({
        owner: rawCampaign.owner,
        title: rawCampaign.title,
        description: rawCampaign.description,
        totalGoal: rawCampaign.totalGoal,
        amountRaisedLocal: rawCampaign.amountRaisedLocal,
        amountRaisedExternal: rawCampaign.amountRaisedExternal,
        isActive: rawCampaign.isActive,
        deadline: Number(rawCampaign.deadline),
        goalReached: rawCampaign.goalReached,
        mainChain: rawCampaign.mainChain,
        acceptedChains: rawCampaign.acceptedChains,
        milestoneCount: Number(rawCampaign.milestoneCount),
        currentMilestone: Number(rawCampaign.currentMilestone),
      });
      setMilestones(loadedMilestones);
    } catch (e) {
      console.error(e);
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => loadData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ethAddress]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      if (!swapUsdcAmount || Number(swapUsdcAmount) <= 0) {
        setQuotedEth(0n);
        return;
      }

      setQuoteLoading(true);
      try {
        const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
        const quoter = new ethers.Contract(QUOTER_V2, QUOTER_V2_ABI, provider);
        const quote = await quoter.quoteExactOutputSingle.staticCall({
          tokenIn: WETH_ADDRESS,
          tokenOut: USDC_ADDRESS,
          amount: toUsdcAmount(swapUsdcAmount),
          fee: WETH_USDC_FEE,
          sqrtPriceLimitX96: 0,
        });
        if (!cancelled) {
          setQuotedEth(BigInt(quote[0]));
        }
      } catch (e) {
        console.error("Uniswap quote:", e);
        if (!cancelled) {
          setQuotedEth(0n);
        }
      } finally {
        if (!cancelled) {
          setQuoteLoading(false);
        }
      }
    }

    const timeout = setTimeout(loadQuote, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [swapUsdcAmount]);

  async function getSigner() {
    const metamask = window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum;
    const provider = new ethers.BrowserProvider(metamask);
    return provider.getSigner();
  }

  async function runTx(action, successMessage) {
    setError("");
    setSuccess("");
    if (!ethConnected) {
      setShowModal(true);
      return;
    }
    setBusy(true);
    try {
      await action();
      setSuccess(successMessage);
      await loadData();
    } catch (e) {
      setError(e.reason || e.message || "Tranzactie esuata.");
    } finally {
      setBusy(false);
    }
  }

  async function handleContribute() {
    if (!amount || Number(amount) <= 0) {
      setError("Introdu o suma valida.");
      return;
    }
    if (!campaign.isActive) {
      setError("Campania este finalizata.");
      return;
    }
    await runTx(async () => {
      const signer = await getSigner();
      const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const contract = new ethers.Contract(STABLE_MILESTONE_CONTRACT, STABLE_MILESTONE_ABI, signer);
      const amountInUsdc = toUsdcAmount(amount);
      const signerAddress = await signer.getAddress();
      const currentAllowance = BigInt(await usdc.allowance(signerAddress, STABLE_MILESTONE_CONTRACT));

      if (currentAllowance < amountInUsdc) {
        const approveTx = await usdc.approve(STABLE_MILESTONE_CONTRACT, amountInUsdc);
        await approveTx.wait();
      }

      const donateTx = await contract.donateLocal(Number(id), amountInUsdc);
      await donateTx.wait();
      setAmount("");
    }, "Donatie USDC efectuata.");
  }

  async function handleSwapEthAndDonate() {
    if (!swapUsdcAmount || Number(swapUsdcAmount) <= 0) {
      setError("Introdu suma USDC pe care vrei sa o donezi.");
      return;
    }
    const amountOut = toUsdcAmount(swapUsdcAmount);
    if (!campaign.isActive) {
      setError("Campania este finalizata.");
      return;
    }
    if (quotedEth <= 0n) {
      setError("Nu pot calcula ETH-ul necesar pentru swap.");
      return;
    }

    await runTx(async () => {
      const signer = await getSigner();
      const signerAddress = await signer.getAddress();
      const provider = signer.provider;
      const amountInMaximum = addSlippage(quotedEth);

      if (amountInMaximum >= await provider.getBalance(signerAddress)) {
        throw new Error("ETH insuficient pentru swap si gas.");
      }

      const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const router = new ethers.Contract(SWAP_ROUTER, SWAP_ROUTER_ABI, signer);
      const contract = new ethers.Contract(STABLE_MILESTONE_CONTRACT, STABLE_MILESTONE_ABI, signer);

      const swapCall = router.interface.encodeFunctionData(
        "exactOutputSingle",
        [{
          tokenIn: WETH_ADDRESS,
          tokenOut: USDC_ADDRESS,
          fee: WETH_USDC_FEE,
          recipient: signerAddress,
          amountOut,
          amountInMaximum,
          sqrtPriceLimitX96: 0,
        }]
      );
      const refundCall = router.interface.encodeFunctionData("refundETH");
      const swapTx = await router.multicall(
        [swapCall, refundCall],
        { value: amountInMaximum }
      );
      await swapTx.wait();

      const currentAllowance = BigInt(await usdc.allowance(signerAddress, STABLE_MILESTONE_CONTRACT));
      if (currentAllowance < amountOut) {
        const approveTx = await usdc.approve(STABLE_MILESTONE_CONTRACT, amountOut);
        await approveTx.wait();
      }

      const donateTx = await contract.donateLocal(Number(id), amountOut);
      await donateTx.wait();
      setSwapUsdcAmount("");
    }, "ETH schimbat in USDC si donat.");
  }

  async function handleSubmitMilestone() {
    await runTx(async () => {
      const signer = await getSigner();
      const contract = new ethers.Contract(STABLE_MILESTONE_CONTRACT, STABLE_MILESTONE_ABI, signer);
      const tx = await contract.submitMilestone(Number(id));
      await tx.wait();
    }, "Milestone trimis la vot.");
  }

  async function handleVote(approve) {
    await runTx(async () => {
      const signer = await getSigner();
      const contract = new ethers.Contract(STABLE_MILESTONE_CONTRACT, STABLE_MILESTONE_ABI, signer);
      const tx = await contract.vote(Number(id), campaign.currentMilestone, approve);
      await tx.wait();
    }, approve ? "Vot pentru aprobare inregistrat." : "Vot contra inregistrat.");
  }

  async function handleFinalize() {
    await runTx(async () => {
      const signer = await getSigner();
      const contract = new ethers.Contract(STABLE_MILESTONE_CONTRACT, STABLE_MILESTONE_ABI, signer);
      const tx = await contract.finalizeMilestone(Number(id), campaign.currentMilestone);
      await tx.wait();
    }, "Milestone finalizat.");
  }

  async function handleRecordExternal() {
    if (!ethers.isAddress(external.donor)) {
      setError("Adresa donatorului extern nu este valida.");
      return;
    }
    if (!external.amount || Number(external.amount) <= 0) {
      setError("Introdu o suma externa valida.");
      return;
    }
    await runTx(async () => {
      const signer = await getSigner();
      const contract = new ethers.Contract(STABLE_MILESTONE_CONTRACT, STABLE_MILESTONE_ABI, signer);
      const tx = await contract.recordExternalDonation(
        Number(id),
        external.donor,
        toUsdcAmount(external.amount),
        external.chain
      );
      await tx.wait();
      setExternal({ donor: "", amount: "", chain: "sol" });
    }, "Donatie externa inregistrata.");
  }

  if (loading) return <div className="detail-loading"><div className="loading-spinner"></div><p>Se incarca...</p></div>;
  if (!campaign) return <div className="detail-loading"><p>Campanie negasita sau contract neconfigurat.</p></div>;

  const totalRaised = Number(campaign.amountRaisedLocal) + Number(campaign.amountRaisedExternal);
  const progress = Math.min(Number(campaign.totalGoal) > 0 ? (totalRaised / Number(campaign.totalGoal)) * 100 : 0, 100);
  const remainingUsdc = Math.max(0, (Number(campaign.totalGoal) - totalRaised) / 1_000_000);
  const donateAmountInvalid = !amount || Number(amount) <= 0;
  const donateAmount = donateAmountInvalid ? 0n : toUsdcAmount(amount);
  const insufficientUsdc = donateAmount > usdcBalance;
  const swapUsdcInvalid = !swapUsdcAmount || Number(swapUsdcAmount) <= 0;
  const maxEthForSwap = quotedEth > 0n ? addSlippage(quotedEth) : 0n;
  const insufficientEth = maxEthForSwap >= ethBalance;
  const daysLeft = getDaysLeft(campaign.deadline * 1000);
  const isOwner = ethAddress?.toLowerCase() === campaign.owner?.toLowerCase();
  const currentMilestone = milestones[campaign.currentMilestone];
  const canVote = currentMilestone?.votingActive && votingPower > 0n;

  return (
    <div className="detail-page">
      {showModal && (
        <ConnectWalletModal
          onClose={() => setShowModal(false)}
          onConnectEth={() => { onConnectEth(); setShowModal(false); }}
          onConnectSol={onConnectSol}
          onConnectSolflare={onConnectSolflare}
        />
      )}
      <div className="container">
        <button className="back-btn" onClick={() => navigate("/v2/kickstart")}>Back to Kickstart USDC</button>
        <div className="detail-layout">
          <div className="detail-main">
            <div className="detail-badges">
              <span className="badge badge-usdc">USDC</span>
              <span className="badge badge-active">Milestone</span>
              <span className={`badge badge-${campaign.isActive ? "active" : "inactive"}`}>
                {campaign.goalReached ? "Goal Atins" : campaign.isActive ? "Activa" : "Inchisa"}
              </span>
            </div>
            <h1 className="detail-title">{campaign.title}</h1>
            <div className="divider"></div>
            <div className="detail-meta">
              <div className="meta-item"><span className="meta-label">Owner</span><span className="meta-value mono">{campaign.owner}</span></div>
              <div className="meta-item"><span className="meta-label">Chain-uri</span><span className="meta-value">{campaign.acceptedChains.join(" + ").toUpperCase()}</span></div>
              <div className="meta-item"><span className="meta-label">Deadline</span><span className="meta-value">{daysLeft} zile ramase</span></div>
            </div>

            <div className="detail-description"><h3>Despre aceasta campanie</h3><p>{campaign.description}</p></div>
            <SocialShare title={campaign.title} description={campaign.description} />

            <div className="detail-progress card">
              <div className="progress-header">
                <div>
                  <span className="progress-raised">${formatUsdc(totalRaised)} USDC</span>
                  <span className="progress-label"> strans din ${formatUsdc(campaign.totalGoal)} USDC</span>
                </div>
                <span className="progress-pct">{progress.toFixed(1)}%</span>
              </div>
              <div className="progress-bar v2-progress" style={{ height: "10px", margin: "16px 0" }}>
                <div className="progress-fill v2-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="progress-stats">
                <div className="pstat"><span className="pstat-value">${formatUsdc(campaign.amountRaisedLocal)}</span><span className="pstat-label">Local ETH</span></div>
                <div className="pstat"><span className="pstat-value">${formatUsdc(campaign.amountRaisedExternal)}</span><span className="pstat-label">Extern</span></div>
                <div className="pstat"><span className="pstat-value">{campaign.currentMilestone + 1}/{campaign.milestoneCount}</span><span className="pstat-label">Milestone</span></div>
              </div>
            </div>

            <div className="detail-progress card">
              <h3>Milestone-uri</h3>
              <div className="v2-milestones">
                {milestones.map((milestone, index) => (
                  <div key={index} className={index === campaign.currentMilestone ? "v2-milestone current" : "v2-milestone"}>
                    <div>
                      <strong>{index + 1}. {milestone.title}</strong>
                      <p>{milestone.description}</p>
                    </div>
                    <div className="v2-milestone-side">
                      <strong>${formatUsdc(milestone.amount)}</strong>
                      <span>{milestone.approved ? "Aprobat" : milestone.votingActive ? "La vot" : "In asteptare"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="detail-sidebar">
            <div className="donate-card card">
              <h3 className="donate-title">Sustine cu USDC</h3>
              <p className="donate-helper">Mai sunt necesari ${remainingUsdc.toFixed(2)} USDC.</p>
              {campaign.goalReached && campaign.isActive && <div className="form-success">Goalul a fost atins. Donatiile suplimentare raman deschise pana la finalizarea campaniei.</div>}
              {!campaign.isActive && <div className="form-success">Campania este finalizata.</div>}
              <p className="donate-helper">Balance wallet: ${formatUsdc(usdcBalance)} USDC.</p>
              <p className="donate-helper">ETH wallet: {Number(ethers.formatEther(ethBalance)).toFixed(4)} ETH.</p>
              <div className="donate-mode-tabs">
                <button className={donateMode === "usdc" ? "filter-tab active" : "filter-tab"} onClick={() => setDonateMode("usdc")}>USDC</button>
                <button className={donateMode === "eth" ? "filter-tab active" : "filter-tab"} onClick={() => setDonateMode("eth")}>ETH {"->"} USDC</button>
              </div>

              {donateMode === "usdc" ? (
                <>
                  <div className="donate-input-wrap">
                    <input className="form-input donate-input" type="number" step="1" min="0" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
                    <span className="donate-currency">USDC</span>
                  </div>
                  <div className="donate-presets">
                    {[1, 2, remainingUsdc].filter(value => value > 0).map((value, index) => (
                      <button key={`${value}-${index}`} className="preset-btn" onClick={() => setAmount(value.toFixed(2))}>
                        ${value.toFixed(2)}
                      </button>
                    ))}
                  </div>
                  <button className="btn-usdc donate-btn" style={{ width: "100%", justifyContent: "center" }} onClick={handleContribute} disabled={busy || !campaign.isActive || donateAmountInvalid || insufficientUsdc}>
                    {busy ? "Se proceseaza..." : !campaign.isActive ? "Campanie finalizata" : donateAmountInvalid ? "Introdu suma USDC" : insufficientUsdc ? "USDC insuficient" : allowance >= donateAmount ? "Doneaza USDC" : "Aproba si doneaza USDC"}
                  </button>
                  {insufficientUsdc && !donateAmountInvalid && <div className="form-error">Walletul conectat are doar ${formatUsdc(usdcBalance)} USDC.</div>}
                </>
              ) : (
                <>
                  <div className="donate-input-wrap">
                    <input className="form-input donate-input" type="number" step="1" min="0" placeholder="2.00" value={swapUsdcAmount} onChange={e => setSwapUsdcAmount(e.target.value)} />
                    <span className="donate-currency">USDC</span>
                  </div>
                  <div className="donate-presets">
                    {[1, 2, remainingUsdc].filter(value => value > 0).map((value, index) => (
                      <button key={`${value}-${index}`} className="preset-btn" onClick={() => setSwapUsdcAmount(value.toFixed(2))}>
                        ${value.toFixed(2)}
                      </button>
                    ))}
                  </div>
                  <div className="swap-quote">
                    {quoteLoading ? "Calculez ETH necesar..." : quotedEth > 0n ? `Estimare: ${ethers.formatEther(quotedEth)} ETH, max ${ethers.formatEther(maxEthForSwap)} ETH cu buffer.` : "Introdu suma USDC pentru estimare."}
                  </div>
                  <button className="btn-usdc donate-btn" style={{ width: "100%", justifyContent: "center" }} onClick={handleSwapEthAndDonate} disabled={busy || !campaign.isActive || swapUsdcInvalid || quotedEth <= 0n || insufficientEth}>
                    {busy ? "Se proceseaza..." : !campaign.isActive ? "Campanie finalizata" : swapUsdcInvalid ? "Introdu suma USDC" : quoteLoading ? "Calculez quote..." : insufficientEth ? "ETH insuficient" : "Schimba ETH necesar si doneaza"}
                  </button>
                  <p className="donate-helper">Swap exact-output prin Uniswap Sepolia: tu alegi USDC, aplicatia calculeaza ETH-ul necesar.</p>
                  {insufficientEth && !swapUsdcInvalid && <div className="form-error">Pastreaza ETH pentru gas.</div>}
                </>
              )}
              {error && <div className="form-error">{error}</div>}
              {success && <div className="form-success">{success}</div>}
            </div>

            {currentMilestone && (
              <div className="withdraw-card card">
                <h3 className="withdraw-title">Milestone curent</h3>
                <p>{currentMilestone.title}</p>
                <div className="milestone-votes">
                  <span>Pentru: ${formatUsdc(currentMilestone.votesFor)}</span>
                  <span>Contra: ${formatUsdc(currentMilestone.votesAgainst)}</span>
                </div>
                {isOwner && campaign.goalReached && !currentMilestone.votingActive && (
                  <button className="btn-usdc" style={{ width: "100%", justifyContent: "center" }} onClick={handleSubmitMilestone} disabled={busy}>Trimite la vot</button>
                )}
                {canVote && (
                  <div className="vote-actions">
                    <button className="btn-usdc" onClick={() => handleVote(true)} disabled={busy}>Aproba</button>
                    <button className="btn-usdc danger" onClick={() => handleVote(false)} disabled={busy}>Respinge</button>
                  </div>
                )}
                {isOwner && currentMilestone.votingActive && (
                  <button className="btn-usdc" style={{ width: "100%", justifyContent: "center", marginTop: "10px" }} onClick={handleFinalize} disabled={busy}>Finalizeaza</button>
                )}
              </div>
            )}

            {isOwner && (
              <div className="contract-card card">
                <h4 className="contract-title">Donatie externa</h4>
                <input className="form-input" placeholder="Adresa donor EVM" value={external.donor} onChange={e => setExternal({ ...external, donor: e.target.value })} />
                <input className="form-input" type="number" placeholder="Suma USDC" value={external.amount} onChange={e => setExternal({ ...external, amount: e.target.value })} />
                <select className="form-input" value={external.chain} onChange={e => setExternal({ ...external, chain: e.target.value })}>
                  {campaign.acceptedChains.filter(chain => chain !== "eth").map(chain => (
                    <option key={chain} value={chain}>{chain.toUpperCase()}</option>
                  ))}
                </select>
                <button className="btn-usdc" style={{ width: "100%", justifyContent: "center" }} onClick={handleRecordExternal} disabled={busy}>Inregistreaza</button>
              </div>
            )}

            <div className="contract-card card">
              <h4 className="contract-title">Contract Info</h4>
              <div className="contract-item"><span className="contract-label">Token</span><span className="contract-value">USDC</span></div>
              <div className="contract-item"><span className="contract-label">Voting power</span><span className="contract-value">${formatUsdc(votingPower)}</span></div>
              <div className="contract-item">
                <span className="contract-label">Etherscan</span>
                <a href={`https://sepolia.etherscan.io/address/${STABLE_MILESTONE_CONTRACT}`} target="_blank" rel="noreferrer" style={{ color: "#2775CA", fontSize: "11px" }}>View Contract</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
