# FundChain — Platformă Cross-Chain de Crowdfunding

> Lucrare de disertație — Universitatea Spiru Haret București
> Student: Marian Dumitru Vamanu  
> Coordonator: Conf. Univ. Dr. Marius Iulian Mihailescu

[![Ethereum](https://img.shields.io/badge/Ethereum-Sepolia-627EEA?logo=ethereum)](https://sepolia.etherscan.io)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana)](https://explorer.solana.com/?cluster=devnet)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)](https://soliditylang.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Descriere

**FundChain** este o platformă descentralizată de crowdfunding care operează simultan pe blockchain-urile **Ethereum** și **Solana**. Spre deosebire de platformele centralizate existente (Kickstarter, Indiegogo), FundChain elimină intermediarii prin utilizarea smart contracts, asigurând transparență completă și control al fondurilor direct pe blockchain.

### Caracteristici principale

- **Campanii simple** — strangere de fonduri ETH sau SOL cu goal definit
- **Milestone funding** — fondurile sunt eliberate etapizat după aprobarea prin vot a fiecărei etape
- **Cross-chain** — campanii care acceptă donații atât în ETH cât și în SOL, cu goal unificat în USD/USDC
- **Vot proporțional** — puterea de vot este proporțională cu suma donată
- **Stable v2 (USDC)** — campaniile v2 folosesc USDC ca unitate principală pentru valoare stabilă
- **Pricing USD** — toate campaniile afișează valorile în USD în timp real (CoinGecko API)
- **Multi-wallet** — suport pentru MetaMask, Phantom și Solflare cu auto-reconnect

---

## Arhitectură

```
┌─────────────────────────────────────────────────────┐
│              Frontend — React + Vite                 │
│   Campanii · ONG/Fundatii · Kickstart · v2 (USDC)   │
├──────────────┬──────────────────────────────────────┤
│  ethers.js   │         @coral-xyz/anchor             │
│  Alchemy RPC │         Solana Web3.js                │
├──────────────┴──────────────────────────────────────┤
│    Ethereum Sepolia    │      Solana Devnet          │
│  7 Smart Contracts     │   1 Anchor Program          │
└────────────────────────┴─────────────────────────────┘
```

---

## Contracte Deployate

### Ethereum — Sepolia Testnet

| Contract | Adresă | Descriere |
|----------|--------|-----------|
| `Crowdfunding` | [`0x53EF...5770`](https://sepolia.etherscan.io/address/0x53EF55468DF1570952b7A07eF46926c3837e5770) | Campanie simplă ETH |
| `CrowdfundingMilestone` | [`0x50B8...1A4E`](https://sepolia.etherscan.io/address/0x50B8de29C8226a85c99b9679060A30a180277a1E) | Milestone cu vot proporțional |
| `CrowdfundingUnified` | [`0x4C6b...6a5e`](https://sepolia.etherscan.io/address/0x4C6b83E06c9B7f83a029312eA9E3E00E7CBC6a5e) | Goal în USD, cross-chain simplu |
| `CrowdfundingCrossMilestone` | [`0x9613...A4E`](https://sepolia.etherscan.io/address/0x96132Dd1FFD9Ef26dbDEd95Dd4e3C2e220C21A4E) | Cross-chain cu milestone-uri |
| `CrowdfundingStableV2` | [`0xE3Ae...C1e40`](https://sepolia.etherscan.io/address/0xE3Ae8c1BF26e6bAfe7EDc5143Cd288B9DF4C1e40) | Campanii v2 cu goal stabil in USDC si mirror Solana |
| `CrowdfundingStableMilestoneV2` | [`0xB0c5...7998`](https://sepolia.etherscan.io/address/0xB0c5218ef966c6EBfEedE21909595cC327267998) | Kickstart v2 USDC cu milestone-uri si mirror cross-chain |

> Notă: `CrowdfundingStable` este contractul de bază USDC reutilizat de versiunea v2; `MockERC20` și `MockUniswapRouter` sunt utilizate exclusiv în suita de teste.

### Solana — Devnet

| Componentă | Adresă |
|-----------|--------|
| Program ID | `HueY3M7RaNwcZGo9Qbg1J88Qmx2nBTtAcxQSU7W1TPLD` |
| IDL Account | `BNUek9Z8uYTx8P26cZmaST9Pkz9id9PnRy9JCVSejFF1` |

---

## FundChain v2 - USDC stabil

Versiunea v2 foloseste USDC ca unitate principala pentru campaniile noi, astfel incat suma donata si progresul campaniei sa ramana stabile indiferent daca utilizatorul intra din ecosistemul Ethereum sau Solana.

### Campanii simple v2

- Campaniile pot avea chain principal Ethereum sau Solana.
- Daca sunt acceptate ambele chain-uri, aplicatia creeaza si un mirror pe celalalt chain.
- Donatiile USDC pe Ethereum sunt inregistrate in contractul `CrowdfundingStableV2`.
- Donatiile USDC pe Solana intra in vault-ul SPL USDC al programului Anchor.
- Pentru campaniile Ethereum care accepta Solana, pagina de detaliu citeste live soldul mirror-ului Solana si il include in progresul afisat.

### Kickstart v2 cu milestone-uri

- Campaniile Kickstart v2 folosesc goal si milestone-uri exprimate in USDC.
- Ethereum accepta doua moduri de donatie:
  - USDC direct.
  - ETH convertit automat in USDC, apoi donat in contract.
- Solana accepta USDC SPL direct pe devnet.
- Pentru campaniile ETH + SOL, aplicatia creeaza mirror-ul Solana si salveaza adresa lui in `campaignChains`.
- Pentru campaniile SOL + ETH, aplicatia creeaza mirror-ul Ethereum si pagina Solana gaseste mirror-ul prin contract sau cache local.
- Progresul cross-chain este afisat in UI prin combinarea sumei locale cu suma din mirror.

### Conversia ETH → USDC (Uniswap)

Conversia ETH→USDC este implementată diferit în funcție de tipul campaniei:

- **Campanii simple** — swap-ul se execută **on-chain**, direct în contractul `CrowdfundingStableV2`, prin **Uniswap V2** (`swapExactETHForTokens`), cu estimarea on-chain prin `getAmountsOut` / `getUSDCForETH` și un slippage de 5%.
- **Campanii Kickstart cu milestone-uri** — swap-ul se execută **în frontend**, prin **Uniswap V3** (`quoteExactOutputSingle` pentru estimare și `multicall([exactOutputSingle, refundETH])`), iar suma rezultată în USDC este înregistrată ulterior prin `donateLocal`.

### Limitari v2 pe devnet

- Pe Solana devnet, donatiile sunt USDC SPL direct. Conversia SOL -> USDC prin Jupiter este planificata pentru mainnet, deoarece rutele si mint-ul USDC principal difera de devnet.
- Votul si release-ul fondurilor raman locale pe chain-ul campaniei/mirror-ului unde sunt donate fondurile. UI-ul afiseaza progresul cross-chain, dar sincronizarea automata de vot/release intre chain-uri necesita un mecanism suplimentar de mesagerie/oracle.

---

## Stack Tehnologic

### Smart Contracts — Ethereum
- **Solidity** 0.8.28 (protecție overflow built-in)
- **Hardhat** 3.x — compilare, testare, deploy
- **Hardhat Ignition** — deployment declarativ
- **OpenZeppelin** — `IERC20`, `SafeERC20`
- **Pattern** Checks-Effects-Interactions (protecție reentrancy)

### Program On-Chain — Solana
- **Rust** + **Anchor** 0.31.1
- **PDA** (Program Derived Addresses) pentru donor/vote records
- Feature `init-if-needed` pentru conturi existente

### Frontend
- **React** 19 + **Vite** — interfață utilizator
- **ethers.js** v6 — interacțiune cu Ethereum
- **@coral-xyz/anchor** — interacțiune cu Solana
- **CoinGecko API** — prețuri ETH/SOL în timp real

---

## Instalare și Rulare

### Cerințe

- Node.js 20 LTS
- Git
- Rust + Cargo (pentru Solana)
- Solana CLI 3.x
- Anchor CLI 0.31.1

### 1. Clonare repository

```bash
git clone https://github.com/MVamanu/crowdfunding-dapp.git
cd crowdfunding-dapp
```

### 2. Ethereum — Compilare și testare

```bash
cd ethereum
npm install
npx hardhat compile
npx hardhat test
```

### 3. Solana — Compilare și deploy

```bash
cd solana/crowdfunding

# Setare variabile de mediu (PowerShell)
$env:ANCHOR_PROVIDER_URL = "https://api.devnet.solana.com"
$env:ANCHOR_WALLET = "C:\Users\<user>\.config\solana\id.json"

anchor build
anchor deploy --provider.cluster devnet
```

### 4. Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Aplicația va fi disponibilă la `http://localhost:5173`

---

## Structura Proiectului

```
crowdfunding-dapp/
├── ethereum/
│   ├── contracts/
│   │   ├── Crowdfunding.sol                   # Campanie simplă ETH
│   │   ├── CrowdfundingMilestone.sol          # Milestone cu vot
│   │   ├── CrowdfundingUnified.sol            # Cross-chain simplu
│   │   ├── CrowdfundingCrossMilestone.sol     # Cross-chain milestone
│   │   ├── CrowdfundingStable.sol             # Campanie USDC (bază v2)
│   │   ├── CrowdfundingStableV2.sol           # Campanie v2 USDC + swap ETH→USDC (Uniswap V2)
│   │   ├── CrowdfundingStableMilestoneV2.sol  # Kickstart v2 USDC cross-chain
│   │   ├── MockERC20.sol                       # USDC simulat (teste)
│   │   └── MockUniswapRouter.sol               # Router Uniswap V2 simulat (teste)
│   ├── test/                                   # 60 teste automate (7 suite)
│   └── ignition/modules/                       # Deploy modules
│
├── solana/crowdfunding/
│   ├── programs/crowdfunding/src/
│   │   └── lib.rs                              # Program Anchor (campanie + milestone + USDC)
│   └── tests/crowdfunding.ts                   # 14 teste automate
│
└── frontend/src/
    ├── pages/
    │   ├── AllCampaigns.jsx                     # Feed unificat (v1)
    │   ├── OngCampaigns.jsx                     # Campanii simple ONG
    │   ├── KickstartCampaigns.jsx              # Campanii milestone
    │   ├── CampaignDetail.jsx                   # Detalii ETH/SOL simplu
    │   ├── MilestoneCampaignDetail.jsx         # Detalii milestone ETH
    │   ├── SolanaMilestoneCampaignDetail.jsx   # Detalii milestone SOL
    │   ├── UnifiedCampaignDetail.jsx           # Detalii cross-chain simplu
    │   ├── CrossMilestoneDetail.jsx            # Detalii cross-chain milestone
    │   └── v2/                                  # Fluxurile v2 (USDC)
    │       ├── AllCampaignsV2.jsx
    │       ├── CreateCampaignV2.jsx
    │       ├── CampaignDetailV2.jsx             # Donație USDC / ETH (swap on-chain Uniswap V2)
    │       ├── CreateKickstartV2.jsx
    │       ├── KickstartCampaignsV2.jsx
    │       ├── KickstartDetailV2.jsx            # Donație Kickstart (swap frontend Uniswap V3)
    │       └── SolanaKickstartDetailV2.jsx
    ├── components/
    │   ├── Navbar.jsx                           # Navigare + wallet connect
    │   └── ConnectWalletModal.jsx               # Modal conectare wallet
    ├── config/
    │   └── chains.js                            # Adrese contracte, Uniswap, USDC, RPC
    └── hooks/
        └── useCryptoPrices.js                   # Prețuri live ETH/SOL
```

---

## Testare

### Ethereum

```bash
cd ethereum
npx hardhat test
```

**60 teste automate** (toate trec), distribuite pe 7 suite:

| Suită | Contract testat | Teste |
|-------|-----------------|-------|
| `Crowdfunding` | Crowdfunding.sol | 8 |
| `CrowdfundingMilestone` | CrowdfundingMilestone.sol | 10 |
| `CrowdfundingCrossMilestone` | CrowdfundingCrossMilestone.sol | 8 |
| `CrowdfundingStable` | CrowdfundingStable.sol | 7 |
| `CrowdfundingStableV2` | CrowdfundingStableV2.sol | 11 |
| `CrowdfundingStableMilestoneV2` | CrowdfundingStableMilestoneV2.sol | 11 |
| `CrowdfundingUnified` | CrowdfundingUnified.sol | 5 |
| **Total** | | **60** |

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

### Solana

```bash
cd solana/crowdfunding
npm install
anchor test
```

Suita curentă acoperă **14 teste** pentru: campanii SOL simple; donații SOL; milestone-uri SOL; vot și finalizare milestone; campanii USDC pe Solana; donații USDC și setarea `goalReached`.

Pe devnet pot aparea mesaje `429 Too Many Requests` de la RPC; acestea sunt retry-uri si nu indica esec daca testele se incheie cu `14 passing`. Pentru o rulare deterministă (validator local), se recomandă `anchor test`.

> **Total: 74 teste automate** (60 Ethereum + 14 Solana), rată de succes 100%.

---

## Securitate

Contractele implementează măsuri de securitate conform standardelor industriei:

| Vulnerabilitate | Protecție implementată |
|----------------|------------------------|
| **Reentrancy** | Pattern Checks-Effects-Interactions în toate funcțiile de transfer |
| **Overflow/Underflow** | Solidity 0.8.28 cu verificări built-in (înlocuiește SafeMath) |
| **Access Control** | Modifier `onlyOwner` pe funcțiile critice (withdraw, submitMilestone) |
| **Transfer tokenuri** | `SafeERC20` pentru transferurile USDC |
| **Double voting** | Mapping `hasVoted[campaignId][milestoneId][address]` |
| **Expired campaigns** | Verificare `block.timestamp` înainte de acceptarea donațiilor |
| **Slippage swap** | Minim 95% din suma estimată (5% slippage maxim) la conversia ETH→USDC |

---

## Fluxuri Principale

### Campanie simplă
```
createCampaign() → donate() → [goalReached] → withdraw()
                                             → [expired] → refund()
```

### Campanie cu Milestone
```
createCampaign() → donate() → [goalReached] → submitMilestone()
                                             → vote() (donatori)
                                             → finalizeMilestone()
                                             → [approved] → transfer ETH/SOL
                                             → [rejected] → retry
```

### Campanie Cross-Chain
```
createCampaign(ETH + solanaAddress) →
  donateETH()        # donatori Ethereum
  donate SOL direct  # donatori Solana → recordSolDonation() înregistrează USD
  → submitMilestone() → vote() (donatori ETH) → finalizeMilestone()
```

---

## Baze tehnice

Acest proiect se bazează pe experiența acumulată în dezvoltarea aplicației [Crypto Wallet](https://crypto-wallet-psi.vercel.app) — o aplicație web pentru gestionarea portofelelor Ethereum, care a constituit fundamentul tehnic pentru implementarea mecanismelor de interacțiune cu blockchain-ul în cadrul FundChain.

---

## Bibliografie

1. Buterin, V. (2014). *A Next-Generation Smart Contract and Decentralized Application Platform*. Ethereum Foundation.
2. Antonopoulos, A. M., & Wood, G. (2018). *Mastering Ethereum*. O'Reilly Media.
3. Schär, F. (2021). *Decentralized Finance: On Blockchain- and Smart Contract-Based Financial Markets*. Federal Reserve Bank of St. Louis Review.
4. Mihailescu, M. I., & Nita, S. L. (2021). *A Novel Authentication Scheme Based on Verifiable Credentials Using Digital Identity in the Context of Web 3.0*.
5. OpenZeppelin. *Smart Contract Security Best Practices*. https://docs.openzeppelin.com
6. Solidity Documentation. https://docs.soliditylang.org
7. Anchor Framework Documentation. https://www.anchor-lang.com

---

## Licență

MIT License — vezi fișierul [LICENSE](LICENSE) pentru detalii.

---

*FundChain — Transparență, Descentralizare, Încredere*
