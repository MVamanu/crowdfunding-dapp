## 3.5. Integrarea Uniswap pentru conversia ETH în USDC

Integrarea Uniswap în aplicația FundChain are rolul de a susține obiectivul versiunii v2: păstrarea valorii donațiilor în USDC, chiar și atunci când utilizatorul pornește din ETH. Într-o aplicație de crowdfunding, stabilitatea valorii este importantă deoarece campaniile au obiective financiare clare, iar fluctuațiile activelor native pot afecta interpretarea progresului. Prin conversia ETH în USDC, aplicația permite utilizatorului să folosească moneda nativă a ecosistemului Ethereum, dar campania să acumuleze o valoare stabilă.

Uniswap este un protocol de schimb descentralizat construit pentru ecosistemul Ethereum. Documentația Uniswap descrie protocolul ca un sistem bazat pe pool-uri de lichiditate, în care utilizatorii pot schimba tokenuri fără un registru centralizat de ordine. În loc ca un cumpărător și un vânzător să fie potriviți direct, schimbul are loc împotriva lichidității disponibile într-un pool. Prețul este determinat de starea pool-ului și de regulile protocolului. Această arhitectură este relevantă pentru FundChain deoarece permite integrarea conversiei direct într-un flux Web3.

În versiunile moderne ale Uniswap, precum Uniswap v3, lichiditatea poate fi concentrată pe intervale de preț, ceea ce îmbunătățește eficiența capitalului față de modelele anterioare. Pentru aplicația FundChain, detaliile interne ale mecanismului de lichiditate nu sunt scopul principal, dar înțelegerea generală a modelului este utilă. Aplicația nu implementează propriul DEX, ci folosește infrastructura Uniswap existentă pentru a obține USDC din ETH.

Integrarea este realizată în frontend-ul aplicației, în special în fluxul Kickstart v2. Utilizatorul nu introduce direct cantitatea de ETH pe care dorește să o trimită, ci suma de USDC pe care dorește să o doneze. Această alegere este importantă din perspectiva experienței utilizatorului: campania are obiectiv în USDC, milestone-urile sunt exprimate în USDC, iar donatorul gândește contribuția în aceeași unitate. Aplicația calculează apoi cât ETH este necesar pentru obținerea sumei de USDC dorite.

Pentru estimarea ETH-ului necesar, frontend-ul folosește contractul QuoterV2 configurat pentru Sepolia. Quoter-ul permite obținerea unei estimări pentru swap înainte de trimiterea tranzacției efective. În FundChain, se folosește un apel de tip `quoteExactOutputSingle`, deoarece utilizatorul stabilește suma de USDC dorită, iar aplicația trebuie să afle cât ETH trebuie trimis pentru a obține exact acea sumă. Acest model este potrivit pentru crowdfunding, deoarece valoarea donației trebuie să fie stabilă și exprimată clar în USDC.

După obținerea estimării, aplicația adaugă un buffer de slippage. Slippage-ul reprezintă diferența posibilă dintre prețul estimat și prețul efectiv al tranzacției în momentul execuției. Deoarece starea pool-ului poate fi modificată de alte tranzacții, suma de ETH necesară poate varia. În FundChain, buffer-ul reduce riscul ca tranzacția să eșueze din cauza unei mici variații de preț. În același timp, folosirea unui swap de tip exact-output limitează donația finală la suma de USDC aleasă de utilizator.

Execuția swap-ului se face prin routerul Uniswap configurat pentru Sepolia. Frontend-ul construiește apelul `exactOutputSingle`, indicând tokenul de intrare WETH, tokenul de ieșire USDC, fee tier-ul pool-ului, destinatarul, suma de USDC dorită și suma maximă de ETH acceptată. Deoarece utilizatorul trimite ETH nativ, routerul gestionează conversia prin mecanismele asociate WETH. După swap, aplicația apelează și `refundETH`, pentru ca ETH-ul nefolosit din suma maximă să fie returnat.

În implementarea FundChain, această operație este realizată printr-un `multicall` către router. Aplicația encodează apelul de swap și apelul de refund, apoi le trimite împreună într-o singură tranzacție. Această abordare simplifică fluxul pentru utilizator și reduce numărul de confirmări necesare. Utilizatorul semnează tranzacția în MetaMask, iar după confirmare primește USDC în wallet, în limita rezultatului swap-ului.

După conversie, aplicația verifică allowance-ul USDC acordat contractului `CrowdfundingStableMilestoneV2`. Dacă allowance-ul este insuficient, utilizatorul aprobă contractul să transfere suma de USDC necesară. Ulterior, aplicația apelează funcția `donateLocal`, iar contractul înregistrează donația în campania v2. Astfel, fluxul complet este format din trei etape logice: estimare ETH necesar, conversie ETH în USDC, donație USDC către contractul de crowdfunding.

Această separare are un avantaj important: contractul de crowdfunding milestone v2 rămâne concentrat pe logica donațiilor, milestone-urilor și voturilor, iar conversia este tratată ca etapă de frontend prin infrastructura Uniswap. Prin această arhitectură, aplicația păstrează contractul mai simplu și mai ușor de verificat, în timp ce folosește un protocol DeFi consacrat pentru partea de schimb. În același timp, utilizatorul beneficiază de o experiență integrată, deoarece nu trebuie să meargă manual într-o aplicație DEX înainte de donație.

Integrarea Uniswap este configurată în fișierul `src/config/chains.js`, unde sunt definite adresele pentru Swap Router, QuoterV2, WETH, USDC și fee tier-ul pool-ului WETH/USDC. Aceste valori pot fi suprascrise prin variabile de mediu, ceea ce permite adaptarea aplicației la alte deploy-uri sau la alte rețele de test. Centralizarea acestor adrese este importantă deoarece evită duplicarea configurației și reduce riscul de inconsistență între componente.

Din punct de vedere al securității și al experienței utilizatorului, aplicația trebuie să trateze mai multe situații. Dacă estimarea nu poate fi obținută, donația prin swap nu este permisă. Dacă utilizatorul nu are suficient ETH pentru swap și gas, interfața afișează eroare. Dacă allowance-ul USDC este insuficient, se cere aprobare. Dacă tranzacția eșuează sau este respinsă în MetaMask, aplicația afișează mesajul de eroare. Aceste verificări sunt necesare deoarece fluxurile DeFi implică mai multe contracte și pot eșua în mai multe puncte.

În contextul aplicației, Uniswap nu este folosit pentru speculație sau tranzacționare, ci ca mecanism de normalizare a valorii donației. Utilizatorul poate avea ETH în wallet, dar campania poate primi USDC. Astfel, aplicația reduce fricțiunea pentru utilizator și păstrează obiectivul financiar al campaniei într-o unitate stabilă. Această abordare este aliniată cu direcția generală a FundChain v2, unde USDC devine unitatea comună pentru campanii și milestone-uri.

Este important de menționat că această integrare este validată pentru ecosistemul Ethereum/Sepolia. Pentru Solana, o logică similară ar putea fi implementată pe mainnet prin agregatoare de swap precum Jupiter, unde utilizatorul ar putea porni din SOL și aplicația ar putea obține USDC. Totuși, în cadrul lucrării, această funcționalitate nu este tratată ca implementare validată pe devnet, deoarece lichiditatea, rutele și mint-urile disponibile în devnet diferă de cele din mainnet. Din acest motiv, pe Solana devnet aplicația acceptă donații directe în USDC SPL, iar conversia SOL în USDC rămâne direcție de dezvoltare.

Prin integrarea Uniswap, FundChain demonstrează că o aplicație de crowdfunding poate combina contracte proprii cu protocoale DeFi existente. Contractele aplicației gestionează regulile campaniei, iar Uniswap gestionează conversia de active. Această combinație susține obiectivul lucrării: construirea unei platforme descentralizate în care donațiile sunt transparente, verificabile și exprimate într-o valoare stabilă.

Surse utilizate în redactarea subcapitolului:

- Uniswap Documentation. How Uniswap works.
- Uniswap Documentation. Single-hop swaps.
- Uniswap Documentation. Quoting swaps.
- Uniswap Documentation. Concentrated liquidity.
- Jupiter Documentation. Swap documentation.
- Documentația proprie a aplicației FundChain, README.md.
- Codul frontend al aplicației FundChain, `frontend/src/pages/v2/KickstartDetailV2.jsx`.
- Configurarea aplicației FundChain, `frontend/src/config/chains.js`.
