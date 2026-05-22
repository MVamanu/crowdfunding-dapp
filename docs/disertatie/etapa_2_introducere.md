# Introducere

## Contextul și actualitatea temei

Dezvoltarea aplicațiilor informatice moderne este influențată tot mai puternic de nevoia de transparență, automatizare și reducere a dependenței față de intermediari. În ultimii ani, tehnologiile blockchain au depășit zona strict financiară și au început să fie utilizate în domenii precum identitatea digitală, trasabilitatea datelor, guvernanța descentralizată, managementul activelor digitale și aplicațiile de tip crowdfunding. Caracteristica principală a acestor tehnologii este posibilitatea de a executa reguli prestabilite într-un mod transparent, verificabil și rezistent la modificări neautorizate.

Crowdfunding-ul reprezintă un mecanism prin care persoane, organizații sau echipe de dezvoltare pot obține finanțare de la un număr mare de susținători. Platformele consacrate, precum Kickstarter, Indiegogo sau GoFundMe, au demonstrat utilitatea acestui model, însă funcționează în general într-un cadru centralizat. Într-o astfel de arhitectură, platforma gestionează identitatea utilizatorilor, colectarea fondurilor, validarea campaniilor și procesarea plăților. Deși acest model este matur și ușor de utilizat, el presupune existența unui intermediar de încredere și limitează posibilitatea verificării directe a fluxului financiar.

În acest context, contractele inteligente oferă o alternativă tehnologică relevantă. Acestea permit definirea unor reguli de finanțare care se execută automat pe blockchain, fără intervenția unei autorități centrale. Fondurile pot fi colectate, blocate, eliberate sau returnate conform unor condiții transparente, iar orice participant poate verifica starea campaniei direct în rețea. În plus, integrarea mecanismelor de vot și a milestone-urilor permite un control mai bun asupra utilizării fondurilor, deoarece susținătorii pot valida progresul înainte ca sumele să fie eliberate către inițiatorul campaniei.

O provocare importantă în aplicațiile Web3 este volatilitatea criptomonedelor. Donațiile în ETH sau SOL pot avea valoare diferită de la un moment la altul, ceea ce face dificilă estimarea stabilă a bugetului unei campanii. Din acest motiv, utilizarea unui stablecoin precum USDC devine relevantă pentru aplicațiile de crowdfunding. Denominarea sumelor în USDC permite păstrarea unei valori mai stabile a donațiilor și facilitează comparația între contribuții venite din ecosisteme diferite.

Tema acestei lucrări se încadrează în domeniul tehnologiilor moderne pentru ingineria sistemelor informatice, deoarece presupune proiectarea, implementarea și validarea unei aplicații distribuite care combină contracte inteligente, interfețe web, integrare multi-wallet, testare automată și interacțiune cu două ecosisteme blockchain diferite: Ethereum și Solana.

## Problema abordată

Problema principală abordată în această lucrare este proiectarea unei platforme de crowdfunding care să ofere un grad mai ridicat de transparență și control asupra fondurilor comparativ cu platformele centralizate tradiționale. Într-un sistem centralizat, utilizatorul trebuie să aibă încredere în operatorul platformei pentru gestionarea corectă a donațiilor, respectarea regulilor campaniei și distribuirea fondurilor. Într-un sistem bazat pe smart contracts, aceste reguli pot fi transpuse în cod executat automat și verificabil public.

O a doua problemă este fragmentarea ecosistemelor blockchain. Ethereum și Solana sunt două rețele importante, dar folosesc modele tehnice diferite. Ethereum se bazează pe contracte inteligente scrise în Solidity și pe un model de execuție compatibil cu Ethereum Virtual Machine, în timp ce Solana utilizează programe on-chain, conturi și Program Derived Addresses. O aplicație care dorește să ofere suport pentru ambele ecosisteme trebuie să gestioneze diferențe de arhitectură, wallet-uri, tranzacții, tokenuri și mecanisme de stocare a stării.

O a treia problemă este stabilitatea valorii donate. Campaniile finanțate doar în ETH sau SOL sunt expuse volatilității pieței. Pentru o aplicație de crowdfunding, această volatilitate poate afecta atât obiectivul financiar al campaniei, cât și interpretarea contribuțiilor donatorilor. De aceea, versiunea a doua a aplicației introduce utilizarea USDC ca unitate stabilă pentru campanii și milestone-uri.

Lucrarea urmărește să răspundă acestor probleme prin realizarea unei aplicații demonstrative numite FundChain, care permite crearea de campanii simple și campanii cu milestone-uri, acceptă donații pe Ethereum și Solana, integrează wallet-uri specifice fiecărui ecosistem și introduce mecanisme v2 bazate pe USDC.

## Scopul lucrării

Scopul lucrării este proiectarea și implementarea unei platforme descentralizate de crowdfunding cross-chain, bazată pe contracte inteligente și programe on-chain, care să permită colectarea transparentă a fondurilor, urmărirea progresului campaniilor și validarea etapizată a livrabilelor prin mecanisme de milestone și vot.

Aplicația dezvoltată urmărește să demonstreze cum pot fi combinate tehnologiile Ethereum, Solana și React într-un sistem informatic coerent. Platforma permite utilizatorilor să creeze campanii, să doneze, să urmărească progresul financiar, să participe la voturi pentru milestone-uri și să interacționeze cu contractele prin wallet-uri Web3. În plus, aplicația propune o versiune v2 orientată către donații stabile în USDC, în care campaniile pot avea un chain principal și un mirror pe celălalt ecosistem.

Scopul nu este doar realizarea unei interfețe grafice, ci construirea unei aplicații complete, cu logică on-chain, testare automată și validare practică. Din acest motiv, lucrarea acordă atenție atât aspectelor teoretice, cât și celor inginerești: arhitectură, proiectare, implementare, testare și limitări.

## Obiectivele lucrării

Pentru atingerea scopului propus, lucrarea urmărește următoarele obiective:

- analiza conceptelor de blockchain, smart contracts, crowdfunding descentralizat și stablecoins;
- prezentarea stadiului actual al soluțiilor existente de crowdfunding centralizat și descentralizat;
- identificarea limitărilor soluțiilor existente și definirea plusului adus de aplicația FundChain;
- proiectarea unei arhitecturi software care integrează frontend web, contracte Ethereum și program Solana;
- implementarea contractelor inteligente pentru campanii simple, campanii cu milestone-uri și campanii v2 cu USDC;
- implementarea unui program Solana cu Anchor pentru campanii și donații în ecosistemul Solana;
- integrarea wallet-urilor MetaMask, Phantom și Solflare;
- implementarea mecanismelor de donație în ETH, SOL și USDC;
- integrarea conversiei ETH în USDC prin Uniswap pentru campaniile v2;
- validarea aplicației prin teste automate și scenarii practice de utilizare.

Aceste obiective au rolul de a demonstra atât fezabilitatea tehnică a platformei, cât și caracterul său aplicativ. Aplicația rezultată nu este tratată ca un simplu prototip vizual, ci ca un sistem software demonstrativ, cu logică distribuită și interacțiune reală cu rețele de test.

## Metodologia de realizare

Metodologia utilizată în realizarea lucrării combină cercetarea teoretică, analiza soluțiilor existente, proiectarea software și implementarea incrementală. În prima etapă, au fost analizate conceptele fundamentale necesare înțelegerii aplicației: blockchain, contracte inteligente, crowdfunding, stablecoins și aplicații descentralizate. Această etapă oferă cadrul conceptual necesar pentru justificarea soluției propuse.

În a doua etapă, au fost analizate soluțiile existente pe piață, atât centralizate, cât și descentralizate. Scopul acestei analize este identificarea limitărilor actuale și formularea contribuției proprii. Platforma FundChain se diferențiază prin combinarea mai multor elemente într-o singură aplicație: suport multi-chain, campanii cu milestone-uri, donații stabile în USDC și integrare cu wallet-uri specifice Ethereum și Solana.

În etapa de proiectare, aplicația a fost împărțită în trei componente principale: contractele Ethereum, programul Solana și interfața web. Contractele Ethereum au fost implementate în Solidity și testate cu Hardhat. Componenta Solana a fost implementată în Rust folosind framework-ul Anchor. Interfața web a fost realizată în React și Vite, cu integrare prin ethers.js și Anchor.

În etapa de implementare, funcționalitățile au fost dezvoltate incremental. Inițial au fost realizate campaniile simple și mecanismele de donație. Ulterior au fost adăugate campaniile cu milestone-uri, votul donatorilor, mecanismele cross-chain și versiunea v2 bazată pe USDC. Integrarea finală a urmărit ca utilizatorul să poată interacționa cu aplicația printr-o interfață unitară, indiferent dacă folosește Ethereum sau Solana.

În etapa de validare, aplicația a fost testată prin suite automate pentru contractele Ethereum și prin teste Anchor pentru programul Solana. De asemenea, frontend-ul a fost verificat prin linting și build de producție. Testarea a urmărit scenarii precum crearea campaniilor, realizarea donațiilor, atingerea obiectivului financiar, votarea milestone-urilor, finalizarea etapelor și funcționarea mecanismelor USDC.

## Structura lucrării

Lucrarea este organizată în șase capitole principale, la care se adaugă introducerea, concluziile, bibliografia și anexele.

Primul capitol prezintă fundamentele teoretice ale tehnologiilor utilizate, incluzând conceptele de blockchain, smart contracts, aplicații descentralizate, crowdfunding și stablecoins. Acest capitol oferă baza conceptuală necesară pentru înțelegerea aplicației dezvoltate.

Al doilea capitol analizează stadiul actual al soluțiilor existente în domeniul crowdfunding-ului. Sunt prezentate atât platforme centralizate, cât și soluții Web3, fiind evidențiate limitările acestora și contribuția propusă prin platforma FundChain.

Al treilea capitol descrie tehnologiile utilizate în dezvoltarea aplicației. Sunt prezentate Solidity, Hardhat, Rust, Anchor, React, Vite, ethers.js, wallet-urile Web3 și integrarea Uniswap pentru conversia ETH în USDC.

Al patrulea capitol este dedicat analizei și proiectării aplicației. Sunt definite cerințele funcționale și nefuncționale, arhitectura generală, rolurile utilizatorilor, modelele de date și fluxurile principale ale platformei.

Al cincilea capitol prezintă implementarea aplicației FundChain. Sunt descrise contractele Ethereum, programul Solana, interfața web, mecanismele de donație, campaniile cu milestone-uri și funcționalitățile v2 bazate pe USDC.

Al șaselea capitol tratează testarea și validarea aplicației. Sunt prezentate testele Ethereum, testele Solana, verificările frontend și scenariile de utilizare validate.

În final, lucrarea include concluziile, în care sunt sintetizate rezultatele obținute, contribuțiile personale, limitările actuale și direcțiile viitoare de dezvoltare.
