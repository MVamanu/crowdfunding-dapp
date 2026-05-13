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
- **Cross-chain** — campanii care acceptă donații atât în ETH cât și în SOL, cu goal unificat în USD
- **Vot proporțional** — puterea de vot este proporțională cu suma donată (1 wei = 1 vot)
- **Pricing USD** — toate campaniile afișează valorile în USD în timp real (CoinGecko API)
- **Multi-wallet** — suport pentru MetaMask, Phantom și Solflare cu auto-reconnect

---

## Arhitectură

```
┌─────────────────────────────────────────────────────┐
│              Frontend — React + Vite                 │
│   Campanii · ONG/Fundatii · Kickstart (Milestone)   │
├──────────────┬──────────────────────────────────────┤
│  ethers.js   │         @coral-xyz/anchor             │
│  Alchemy RPC │         Solana Web3.js                │
├──────────────┴──────────────────────────────────────┤
│    Ethereum Sepolia    │      Solana Devnet          │
│  4 Smart Contracts     │   1 Anchor Program          │
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
  - ETH convertit in USDC prin Uniswap Sepolia, apoi donat in contract.
- Solana accepta USDC SPL direct pe devnet.
- Pentru campaniile ETH + SOL, aplicatia creeaza mirror-ul Solana si salveaza adresa lui in `campaignChains`.
- Pentru campaniile SOL + ETH, aplicatia creeaza mirror-ul Ethereum si pagina Solana gaseste mirror-ul prin contract sau cache local.
- Progresul cross-chain este afisat in UI prin combinarea sumei locale cu suma din mirror.

### Limitari v2 pe devnet

- Pe Solana devnet, donatiile sunt USDC SPL direct. Conversia SOL -> USDC prin Jupiter este planificata pentru mainnet, deoarece rutele si mint-ul USDC principal difera de devnet.
- Votul si release-ul fondurilor raman locale pe chain-ul campaniei/mirror-ului unde sunt donate fondurile. UI-ul afiseaza progresul cross-chain, dar sincronizarea automata de vot/release intre chain-uri necesita un mecanism suplimentar de mesagerie/oracle.

---

## Stack Tehnologic

### Smart Contracts — Ethereum
- **Solidity** 0.8.28 (protecție overflow built-in)
- **Hardhat** 3.x — compilare, testare, deploy
- **Hardhat Ignition** — deployment declarativ
- **Pattern** Checks-Effects-Interactions (protecție reentrancy)

### Program On-Chain — Solana
- **Rust** 1.95 + **Anchor** 0.31.1
- **PDA** (Program Derived Addresses) pentru donor/vote records
- Feature `init-if-needed` pentru conturi existente

### Frontend
- **React** 19 + **Vite** — interfață utilizator
- **ethers.js** v6 — interacțiune cu Ethereum
- **@coral-xyz/anchor** 0.32.x în frontend / 0.31.1 pentru programul Anchor — interacțiune cu Solana
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

# Setare variabile de mediu
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
│   │   ├── Crowdfunding.sol              # Campanie simplă ETH
│   │   ├── CrowdfundingMilestone.sol     # Milestone cu vot
│   │   ├── CrowdfundingUnified.sol       # Cross-chain simplu
│   │   └── CrowdfundingCrossMilestone.sol # Cross-chain milestone
│   ├── test/                             # 30 teste automate
│   └── ignition/modules/                 # Deploy modules
│
├── solana/crowdfunding/
│   └── programs/crowdfunding/src/
│       └── lib.rs                        # Program Anchor (campanie + milestone)
│
└── frontend/src/
    ├── pages/
    │   ├── AllCampaigns.jsx              # Feed unificat toate campaniile
    │   ├── OngCampaigns.jsx              # Campanii simple ONG
    │   ├── KickstartCampaigns.jsx        # Campanii milestone
    │   ├── CampaignDetail.jsx            # Detalii ETH/SOL simplu
    │   ├── MilestoneCampaignDetail.jsx   # Detalii milestone ETH
    │   ├── SolanaMilestoneCampaignDetail.jsx # Detalii milestone SOL
    │   ├── UnifiedCampaignDetail.jsx     # Detalii cross-chain simplu
    │   └── CrossMilestoneDetail.jsx      # Detalii cross-chain milestone
    ├── components/
    │   ├── Navbar.jsx                    # Navigare + wallet connect
    │   └── ConnectWalletModal.jsx        # Modal conectare wallet
    └── hooks/
        └── useCryptoPrices.js            # Prețuri live ETH/SOL
```

---

## Testare

### Ethereum

```bash
cd ethereum
npx hardhat test
```

**30 teste automate** acoperind:

| Modul | Teste |
|-------|-------|
| `Crowdfunding` | createCampaign, donate, withdraw, refund |
| `CrowdfundingMilestone` | create, donate, submitMilestone, vote, finalize |
| `CrowdfundingUnified` | create, donate, withdraw |
| `CrowdfundingCrossMilestone` | create, donateETH, recordSolDonation, vote |

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

### Solana

Testele Solana se ruleaza local/manual din workspace-ul Anchor:

```bash
cd solana/crowdfunding
npm run test:devnet
```

Suite-ul curent acopera 14 teste pentru:

- campanii SOL simple;
- donatii SOL;
- milestone-uri SOL;
- vot si finalizare milestone;
- campanii USDC pe Solana;
- donatii USDC si setarea `goalReached`.

Pe devnet pot aparea mesaje `429 Too Many Requests` de la RPC; acestea sunt retry-uri si nu indica esec daca testele se incheie cu `14 passing`.

---

## Securitate

Contractele implementează măsuri de securitate conform standardelor industriei:

| Vulnerabilitate | Protecție implementată |
|----------------|------------------------|
| **Reentrancy** | Pattern Checks-Effects-Interactions în toate funcțiile de transfer |
| **Overflow/Underflow** | Solidity 0.8.28 cu verificări built-in (înlocuiește SafeMath) |
| **Access Control** | Modifier `onlyOwner` pe funcțiile critice (withdraw, submitMilestone) |
| **Double voting** | Mapping `hasVoted[campaignId][milestoneId][address]` |
| **Expired campaigns** | Verificare `block.timestamp` înainte de acceptarea donațiilor |

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
