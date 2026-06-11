# FundChain - Cross-chain Crowdfunding DApp

> Proiect de disertatie: platforma descentralizata de crowdfunding pe Ethereum Sepolia si Solana Devnet.

FundChain combina smart contracts Ethereum, un program Anchor pe Solana si un frontend React/Vite pentru campanii de finantare simple, cu milestone-uri si cu donatii cross-chain. Versiunea curenta include si fluxuri USDC, swap ETH -> USDC prin Uniswap pe Sepolia si interfete V2 pentru campanii simple si Kickstart.

## Status curent

- Frontend React 19 + Vite, cu rute clasice si rute `/v2`.
- Conectare wallet: MetaMask pentru Ethereum, Phantom si Solflare pentru Solana.
- Ethereum Sepolia: contracte pentru ETH, milestone, cross-chain, USDC, USDC V2 si USDC milestone.
- Solana Devnet: program Anchor pentru campanii SOL, campanii USDC si milestone-uri.
- Preturi si conversii: CoinGecko pentru afisare USD, Uniswap Sepolia pentru estimare/swap ETH -> USDC.
- Teste automate: suite Hardhat pentru contractele Ethereum si teste Anchor/ts-mocha pentru programul Solana.

## Arhitectura

```text
crowdfunding-dapp/
|-- frontend/                 React + Vite DApp
|   |-- src/pages/             fluxuri clasice
|   |-- src/pages/v2/          fluxuri V2
|   |-- src/components/        navigatie, wallet modal, cards
|   |-- src/config/chains.js   RPC-uri, adrese contracte, mint-uri
|   `-- src/hooks/             preturi crypto, program Solana
|
|-- ethereum/                  Hardhat 3 + Solidity
|   |-- contracts/             contracte principale si mock-uri
|   |-- test/                  teste automate
|   |-- ignition/modules/      module deployment
|   `-- migration-reports/     rapoarte deploy/migrare V2
|
|-- solana/crowdfunding/       Anchor program
|   |-- programs/crowdfunding/src/lib.rs
|   `-- tests/crowdfunding.ts
|
|-- disertatie_work/           materiale si exporturi pentru lucrare
|-- disertatie_audit/          audit, imagini si scripturi pentru lucrare
`-- tools/                     utilitare pentru documente
```

## Functionalitati principale

- Campanii simple ETH si SOL, cu creare, donatie, retragere si refund.
- Campanii cu milestone-uri, in care fondurile se elibereaza etapizat dupa votul donatorilor.
- Vot proportional cu suma donata.
- Campanii cross-chain cu goal exprimat in USD.
- Campanii USDC pe Ethereum si Solana.
- Campanii V2 cu `mainChain`, `solanaId`, donatii externe si tracking cross-chain.
- Donatii ETH convertite in USDC prin Uniswap pentru fluxurile V2.
- Cache local pentru campanii si rehidratare in frontend.

## Contracte si programe

### Ethereum Sepolia

Adresele implicite sunt definite in `frontend/src/config/chains.js` si pot fi suprascrise prin `.env`.

| Componenta | Adresa implicita | Rol |
| --- | --- | --- |
| `Crowdfunding` | `0x53EF55468DF1570952b7A07eF46926c3837e5770` | Campanii simple ETH |
| `CrowdfundingMilestone` | `0x50B8de29C8226a85c99b9679060A30a180277a1E` | Milestone-uri ETH |
| `CrowdfundingUnified` | `0x4C6b83E06c9B7f83a029312eA9E3E00E7CBC6a5e` | Campanii cross-chain simple |
| `CrowdfundingCrossMilestone` | `0x96132Dd1FFD9Ef26dbDEd95Dd4e3C2e220C21A4E` | Cross-chain cu milestone-uri |
| `CrowdfundingStable` | `0x8FA441B88BC346427E34baf5B1b1E09ed1700f3c` | Campanii USDC |
| `CrowdfundingStableV2` | `0xE3Ae8c1BF26e6bAfe7EDc5143Cd288B9DF4C1e40` | USDC V2, donatii ETH swap si legatura Solana |
| `CrowdfundingStableMilestoneV2` | `0xB0c5218ef966c6EBfEedE21909595cC327267998` | USDC cross-chain cu milestone-uri |
| USDC Sepolia | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Token USDC testnet |
| Uniswap SwapRouter02 | `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E` | Swap ETH -> USDC |
| Uniswap QuoterV2 | `0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3` | Estimare swap |

### Solana Devnet

| Componenta | Valoare |
| --- | --- |
| Program ID | `9Q26M3XJE9pveumjKK4VxMfBu8EQXPnqHHTNXfSU5kEi` |
| Cluster implicit frontend | `devnet` |
| USDC Devnet mint | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| SPL Token Program | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
| Associated Token Program | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` |

Programul Anchor implementeaza:

- `create_campaign`, `donate`, `withdraw`
- `create_milestone_campaign`, `donate_milestone`, `submit_milestone`, `vote_milestone`, `finalize_milestone`
- `create_usdc_campaign`, `donate_usdc`, `withdraw_usdc`
- `create_usdc_milestone_campaign`, `donate_usdc_milestone`, `submit_usdc_milestone`, `vote_usdc_milestone`, `finalize_usdc_milestone`

## Stack tehnologic

- Frontend: React 19, Vite 8, React Router 7, TanStack Query, ethers v6.
- Solana frontend: `@solana/web3.js`, wallet adapters, `@coral-xyz/anchor`.
- Ethereum: Solidity 0.8.28, Hardhat 3, Hardhat Ignition, viem.
- Solana program: Rust + Anchor 0.31.1.
- Token/DeFi: USDC testnet, SPL Token, Uniswap Sepolia.

## Cerinte locale

- Node.js 20+
- npm si/sau yarn
- Git
- Rust + Cargo
- Solana CLI
- Anchor CLI 0.31.1
- Wallet-uri de test: MetaMask, Phantom si/sau Solflare

## Instalare

### 1. Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Aplicatia ruleaza implicit la `http://localhost:5173`.

### 2. Ethereum

```bash
cd ethereum
npm install
copy .env.example .env
npx hardhat compile
npm test
```

Pentru deploy pe Sepolia, seteaza in `ethereum/.env`:

```text
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
SEPOLIA_PRIVATE_KEY=
```

Exemplu deploy cu Ignition:

```bash
npx hardhat ignition deploy --network sepolia ignition/modules/CrowdfundingStableV2.ts
```

### 3. Solana

```bash
cd solana/crowdfunding
npm install
anchor build
anchor test
```

Pentru Devnet:

```bash
solana config set --url https://api.devnet.solana.com
anchor deploy --provider.cluster devnet
```

## Variabile frontend

`frontend/.env.example` contine valorile active folosite de aplicatie:

```text
VITE_SEPOLIA_RPC_URL=
VITE_SOLANA_CLUSTER=devnet
VITE_SOLANA_RPC_URL=
VITE_ETH_CONTRACT_ADDRESS=
VITE_ETH_MILESTONE_CONTRACT_ADDRESS=
VITE_ETH_UNIFIED_CONTRACT_ADDRESS=
VITE_ETH_CROSS_MILESTONE_CONTRACT_ADDRESS=
VITE_ETH_STABLE_CONTRACT_ADDRESS=
VITE_ETH_STABLE_V2_CONTRACT_ADDRESS=
VITE_ETH_STABLE_MILESTONE_CONTRACT_ADDRESS=
VITE_USDC_SEPOLIA_ADDRESS=
VITE_UNISWAP_SEPOLIA_SWAP_ROUTER_02=
VITE_UNISWAP_SEPOLIA_QUOTER_V2=
VITE_UNISWAP_SEPOLIA_WETH=
VITE_UNISWAP_SEPOLIA_WETH_USDC_FEE=3000
VITE_USDC_SOLANA_DEVNET_MINT=
VITE_SOLANA_PROGRAM_ID=
```

Daca o variabila lipseste, frontend-ul foloseste fallback-urile din `frontend/src/config/chains.js`.

## Rute frontend

### Fluxuri clasice

- `/` - feed unificat de campanii
- `/ong` - campanii simple
- `/kickstart` - campanii milestone/Kickstart
- `/create` - creare campanie clasica
- `/campaign/:blockchain/:id` - detaliu campanie ETH/SOL
- `/milestone/:id` - detaliu milestone ETH
- `/solana-milestone/:id` - detaliu milestone Solana
- `/unified/:id` - detaliu cross-chain simplu
- `/cross-milestone/:id` - detaliu cross-chain milestone

### Fluxuri V2

- `/v2` - campanii V2
- `/v2/create` - creare campanie V2
- `/v2/campaign/:blockchain/:id` - detaliu campanie V2
- `/v2/kickstart` - campanii Kickstart V2
- `/v2/kickstart/create` - creare Kickstart V2
- `/v2/kickstart/:id` - detaliu Kickstart Ethereum
- `/v2/kickstart/sol/:id` - detaliu Kickstart Solana

## Testare

Ethereum:

```bash
cd ethereum
npm test
```

Solana:

```bash
cd solana/crowdfunding
anchor test
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Note de securitate

- Contractele folosesc Solidity 0.8.28, cu verificari built-in pentru overflow/underflow.
- Transferurile urmeaza modelul Checks-Effects-Interactions unde este relevant.
- Functiile critice sunt restrictionate la owner.
- Voturile milestone sunt inregistrate pentru a preveni votarea multipla.
- Programul Solana foloseste PDA-uri pentru vault-uri, donatori si voturi.
- Retragerea SOL pastreaza conturile rent-exempt.

## Materiale auxiliare

Directoarele `disertatie_work/`, `disertatie_audit/`, `docx_render_review/` si `tools/` contin documente, exporturi, imagini si scripturi folosite pentru redactarea si auditarea lucrarii. Ele nu sunt necesare pentru rularea DApp-ului.

## Licenta

Fisierul `LICENSE` nu este prezent in starea curenta a repository-ului. Daca proiectul trebuie publicat, adauga explicit licenta dorita si actualizeaza aceasta sectiune.
