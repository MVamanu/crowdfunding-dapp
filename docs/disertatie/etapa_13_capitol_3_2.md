## 3.2. Rust, Anchor și Solana Devnet

Componenta Solana a aplicației FundChain este dezvoltată în Rust, folosind framework-ul Anchor. Spre deosebire de Ethereum, unde logica este exprimată prin contracte inteligente care conțin atât cod, cât și stare proprie, Solana separă codul executabil de conturile care păstrează datele aplicației. Din acest motiv, în cadrul lucrării, componenta Solana este descrisă ca program on-chain, nu ca smart contract în sensul strict al modelului Ethereum. Această distincție este importantă pentru înțelegerea arhitecturii aplicației.

Rust este limbajul folosit pentru implementarea programului Solana. Documentația oficială Rust evidențiază caracteristici precum siguranța memoriei, controlul asupra performanței și absența unui garbage collector tradițional. Pentru aplicațiile blockchain, aceste proprietăți sunt relevante deoarece programele on-chain trebuie să fie eficiente, predictibile și cât mai sigure. În cazul Solana, Rust este una dintre alegerile principale pentru dezvoltarea programelor, iar Anchor oferă un strat suplimentar de structurare peste modelul nativ.

Programul Solana al aplicației FundChain este implementat în fișierul `programs/crowdfunding/src/lib.rs` și conține instrucțiuni pentru mai multe fluxuri funcționale. Sunt incluse campanii simple cu donații în SOL, campanii cu milestone-uri în SOL, campanii USDC și campanii USDC cu milestone-uri. Această acoperire permite aplicației să reproducă pe Solana concepte similare celor implementate pe Ethereum, dar adaptate la modelul tehnic al rețelei Solana.

Anchor este framework-ul utilizat pentru a simplifica dezvoltarea programelor Solana. Documentația Solana descrie Anchor ca un framework pentru construirea de programe on-chain în Rust, care oferă macro-uri, validare standardizată a conturilor și generarea unui IDL pentru interfața programului. În FundChain, Anchor este util deoarece reduce codul repetitiv necesar pentru definirea instrucțiunilor, validarea conturilor și interacțiunea cu frontend-ul TypeScript.

Un element central în Anchor este definirea contextelor de conturi. Fiecare instrucțiune primește un `Context`, care precizează ce conturi sunt necesare, cine semnează tranzacția, ce conturi sunt mutabile și ce PDA-uri trebuie validate. Această abordare corespunde modelului Solana, unde programul nu își accesează implicit propria stare, ci primește explicit toate conturile relevante. Pentru FundChain, acest lucru este vizibil în instrucțiuni precum `create_campaign`, `donate`, `create_usdc_campaign`, `donate_usdc`, `create_usdc_milestone_campaign` și `vote_usdc_milestone`.

Program Derived Addresses, prescurtate PDA, au un rol important în componenta Solana. Documentația Solana definește PDA-urile ca adrese derivate determinist din seed-uri și din ID-ul programului, care nu au cheie privată asociată și pot fi controlate de program. În FundChain, PDA-urile sunt folosite pentru conturi de campanie, vault-uri USDC, înregistrări ale donatorilor și înregistrări de vot. Această abordare permite programului să creeze și să gestioneze conturi cu adrese predictibile, fără ca utilizatorul să dețină cheia privată a acelor conturi.

Pentru donațiile în SOL, programul utilizează instrucțiuni de transfer ale sistemului Solana. În fluxul simplu, donatorul trimite lamports către contul campaniei, iar programul actualizează suma strânsă. Retragerea fondurilor este permisă doar proprietarului campaniei și doar după atingerea obiectivului. Acest model demonstrează mecanismul de bază al unei campanii Solana și oferă echivalentul funcțional al campaniilor simple de pe Ethereum.

Pentru donațiile în USDC, programul folosește SPL Token prin `anchor_spl::token`. În acest caz, fondurile nu sunt transferate ca lamports, ci ca tokenuri SPL din contul token al donatorului către un vault asociat campaniei. Programul păstrează informații despre mint-ul USDC, vault, suma strânsă și statusul campaniei. Această diferență tehnică este importantă deoarece pe Solana tokenurile sunt gestionate prin token accounts, nu prin contracte ERC-20 ca pe Ethereum.

Campaniile USDC cu milestone-uri reprezintă partea avansată a programului Solana. Instrucțiunea `create_usdc_milestone_campaign` primește titluri, descrieri și sume pentru milestone-uri, calculează obiectivul total și inițializează structura campaniei. Donațiile sunt înregistrate în USDC, iar atingerea obiectivului activează posibilitatea de a trimite milestone-uri la vot. Donatorii pot vota pentru sau împotriva unui milestone, iar puterea de vot este legată de suma donată.

Această logică de vot este relevantă pentru obiectivul lucrării, deoarece transpune pe Solana mecanismul de control comunitar asupra eliberării fondurilor. Programul verifică dacă votantul este donator, dacă nu a votat deja și dacă milestone-ul curent se află într-o perioadă de vot activă. După finalizare, dacă voturile favorabile depășesc voturile împotrivă, milestone-ul este aprobat, iar o parte din fonduri poate fi eliberată. Astfel, programul Solana nu gestionează doar donații, ci și reguli de guvernanță aplicate fondurilor.

Configurarea proiectului folosește Anchor `0.31.1`, iar programul are același Program ID pentru localnet și devnet: `HueY3M7RaNwcZGo9Qbg1J88Qmx2nBTtAcxQSU7W1TPLD`. Acest Program ID este declarat și în cod prin macro-ul `declare_id!`, fiind necesar ca programul compilat, IDL-ul și frontend-ul să se refere la aceeași adresă. În timpul dezvoltării, această corelare este esențială, deoarece o nepotrivire între ID-ul declarat și programul deployat poate produce erori de tip `DeclaredProgramIdMismatch`.

Solana Devnet este utilizată pentru testarea publică a programului fără folosirea fondurilor reale de pe mainnet. Documentația Solana descrie devnet ca un cluster destinat dezvoltării și testării aplicațiilor. În cadrul lucrării, devnet permite verificarea instrucțiunilor Anchor, a conturilor PDA, a donațiilor USDC SPL și a integrării cu wallet-uri precum Phantom sau Solflare. Testarea locală este utilă pentru rapiditate, dar devnet oferă o verificare mai apropiată de utilizarea reală a aplicației.

În practică, testarea pe Solana Devnet a evidențiat și anumite constrângeri. RPC-ul public poate aplica rate limiting, iar anumite fluxuri DeFi disponibile pe mainnet nu sunt reproduse complet pe devnet. De exemplu, conversia SOL în USDC printr-un agregator de swap este fezabilă pe mainnet, dar nu a fost tratată ca funcționalitate validată în devnet în cadrul lucrării. Din acest motiv, aplicația acceptă donații directe în USDC SPL pe Solana devnet, iar conversia SOL în USDC este menționată ca direcție realistă de extindere.

Integrarea frontend-ului cu programul Solana se realizează prin IDL-ul generat de Anchor și prin biblioteci precum `@coral-xyz/anchor` și `@solana/web3.js`. IDL-ul descrie instrucțiunile, conturile și tipurile programului, permițând clientului TypeScript să construiască tranzacții într-un mod mai structurat. În FundChain, frontend-ul derivă PDA-uri, pregătește conturile necesare, apelează instrucțiuni precum `donate_usdc_milestone` sau `vote_usdc_milestone` și afișează datele campaniei către utilizator.

Comparativ cu Ethereum, componenta Solana impune un mod de gândire mai explicit. Pe Ethereum, contractul are storage propriu și metode apelabile prin ABI. Pe Solana, programul primește conturile necesare, validează relațiile dintre ele și modifică starea stocată în conturi separate. Această diferență a influențat atât implementarea backend on-chain, cât și frontend-ul, care trebuie să derive și să transmită corect conturile pentru fiecare operație.

Prin utilizarea Rust, Anchor și Solana Devnet, aplicația FundChain demonstrează că logica de crowdfunding poate fi implementată și într-un ecosistem diferit de Ethereum. Componenta Solana extinde aplicația cu donații SOL, donații USDC SPL, milestone-uri, voturi și vault-uri controlate de program. Această parte completează arhitectura multi-chain a lucrării și pregătește discuția despre integrarea frontend-ului, wallet-uri și comunicarea cu cele două ecosisteme blockchain.

Surse utilizate în redactarea subcapitolului:

- Rust Documentation. The Rust Programming Language.
- Solana Documentation. Program Derived Addresses.
- Solana Documentation. Clusters and Public RPC Endpoints.
- Solana Documentation. Tokens on Solana.
- Anchor Documentation. Introduction and Program Structure.
- Documentația proprie a aplicației FundChain, README.md.
- Programul Solana al aplicației FundChain, `programs/crowdfunding/src/lib.rs`.
