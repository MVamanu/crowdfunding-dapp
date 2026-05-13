// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title CrowdfundingCrossMilestone - Milestone funding cross-chain ETH + SOL
/// @author Marian Dumitru Vamanu
/// @notice Campanie cu etape (milestones) care accepta donatii ETH direct si SOL inregistrat in USD
/// @dev Votul se desfasoara pe Ethereum; donatiile SOL sunt agregate off-chain in frontend
/// @dev Arhitectura: doua contracte separate + frontend agregator (fara oracle cross-chain)
contract CrowdfundingCrossMilestone {

    /// @notice Structura unui milestone cross-chain
    struct Milestone {
        string title;               ///< Titlul etapei
        string description;         ///< Descrierea etapei
        uint256 amountUSD;          ///< Suma alocata in USD
        bool completed;             ///< Status finalizare
        bool approved;              ///< Status aprobare prin vot
        uint256 votesFor;           ///< Voturi pentru (in wei ETH donat)
        uint256 votesAgainst;       ///< Voturi contra (in wei ETH donat)
        uint256 votingDeadline;     ///< Termenul votului (timestamp)
        bool votingActive;          ///< Status vot activ
    }

    /// @notice Structura campaniei cross-chain cu milestone-uri
    struct Campaign {
        address owner;                  ///< Proprietarul campaniei (adresa ETH)
        string title;                   ///< Titlul campaniei
        string description;             ///< Descrierea campaniei
        uint256 goalUSD;                ///< Obiectivul total in USD
        uint256 amountRaisedETH;        ///< Suma stransa in ETH (wei)
        uint256 amountRaisedSOLusd;     ///< Echivalentul USD al donatiilor SOL
        bool isActive;                  ///< Statusul campaniei
        uint256 deadline;               ///< Termenul limita
        string solanaAddress;           ///< Adresa Solana pentru donatii SOL
        uint256 milestoneCount;         ///< Numarul de milestone-uri
        uint256 currentMilestone;       ///< Indexul milestone-ului curent
        string primaryChain;            ///< Blockchain-ul principal ("eth" sau "sol")
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => mapping(address => uint256)) public donations;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVoted;
    uint256 public campaignCount;

    event CampaignCreated(uint256 indexed id, address indexed owner, string title, uint256 goalUSD);
    event DonationETH(uint256 indexed id, address indexed donor, uint256 amount);
    event SolDonationRecorded(uint256 indexed id, uint256 amountUSD);
    event MilestoneSubmitted(uint256 indexed id, uint256 milestoneId);
    event VoteCast(uint256 indexed id, uint256 milestoneId, address indexed voter, bool approve);
    event MilestoneApproved(uint256 indexed id, uint256 milestoneId);
    event MilestoneRejected(uint256 indexed id, uint256 milestoneId);

    modifier onlyOwner(uint256 _id) {
        require(campaigns[_id].owner == msg.sender, "Nu esti proprietarul");
        _;
    }

    modifier campaignExists(uint256 _id) {
        require(_id < campaignCount, "Campania nu exista");
        _;
    }

    /// @notice Creeaza o campanie cross-chain cu milestone-uri
    /// @dev Minimum 2 milestone-uri, goal in USD independent de volatilitatea crypto
    /// @param _title Titlul campaniei
    /// @param _description Descrierea campaniei
    /// @param _goalUSD Obiectivul total in USD
    /// @param _durationDays Durata in zile
    /// @param _solanaAddress Adresa Solana pentru acceptarea donatiilor SOL
    /// @param _primaryChain Blockchain-ul principal pentru vot ("eth")
    /// @param _milestoneTitles Titlurile etapelor
    /// @param _milestoneDescriptions Descrierile etapelor
    /// @param _milestoneAmountsUSD Sumele in USD pentru fiecare etapa
    /// @return ID-ul campaniei create
    function createCampaign(
        string memory _title,
        string memory _description,
        uint256 _goalUSD,
        uint256 _durationDays,
        string memory _solanaAddress,
        string memory _primaryChain,
        string[] memory _milestoneTitles,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestoneAmountsUSD
    ) external returns (uint256) {
        require(_milestoneTitles.length >= 2, "Minim 2 milestone-uri");
        require(_milestoneTitles.length == _milestoneAmountsUSD.length, "Date invalide");
        require(_milestoneTitles.length == _milestoneDescriptions.length, "Date invalide");
        require(_goalUSD > 0, "Goal invalid");
        require(_durationDays > 0, "Durata trebuie sa fie pozitiva");

        uint256 id = campaignCount++;
        campaigns[id] = Campaign({
            owner: msg.sender,
            title: _title,
            description: _description,
            goalUSD: _goalUSD,
            amountRaisedETH: 0,
            amountRaisedSOLusd: 0,
            isActive: true,
            deadline: block.timestamp + (_durationDays * 1 days),
            solanaAddress: _solanaAddress,
            milestoneCount: _milestoneTitles.length,
            currentMilestone: 0,
            primaryChain: _primaryChain
        });

        for (uint256 i = 0; i < _milestoneTitles.length; i++) {
            milestones[id][i] = Milestone({
                title: _milestoneTitles[i],
                description: _milestoneDescriptions[i],
                amountUSD: _milestoneAmountsUSD[i],
                completed: false,
                approved: false,
                votesFor: 0,
                votesAgainst: 0,
                votingDeadline: 0,
                votingActive: false
            });
        }

        emit CampaignCreated(id, msg.sender, _title, _goalUSD);
        return id;
    }

    /// @notice Doneaza ETH la campania cross-chain
    /// @dev Donatorii ETH acumuleaza putere de vot pentru milestone-uri
    /// @param _id ID-ul campaniei
    function donateETH(uint256 _id) external payable campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(block.timestamp < campaign.deadline, "Campania a expirat");
        require(msg.value > 0, "Donatie invalida");

        donations[_id][msg.sender] += msg.value;
        campaign.amountRaisedETH += msg.value;

        emit DonationETH(_id, msg.sender, msg.value);
    }

    /// @notice Inregistreaza o donatie SOL ca echivalent USD pe Ethereum
    /// @dev Apelat de proprietar dupa ce donatia SOL a fost confirmata pe Solana
    /// @dev Arhitectura off-chain: proprietarul verifica tranzactia Solana si inregistreaza USD-ul
    /// @param _id ID-ul campaniei
    /// @param _amountUSD Echivalentul USD al donatiei SOL (calculat de frontend)
    function recordSolDonation(uint256 _id, uint256 _amountUSD) external campaignExists(_id) onlyOwner(_id) {
        campaigns[_id].amountRaisedSOLusd += _amountUSD;
        emit SolDonationRecorded(_id, _amountUSD);
    }

    /// @notice Proprietarul submite milestone-ul curent pentru vot
    /// @param _id ID-ul campaniei
    function submitMilestone(uint256 _id) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");

        uint256 milestoneId = campaign.currentMilestone;
        require(milestoneId < campaign.milestoneCount, "Toate milestone-urile completate");
        require(!milestones[_id][milestoneId].votingActive, "Vot deja activ");

        milestones[_id][milestoneId].votingActive = true;
        milestones[_id][milestoneId].votingDeadline = block.timestamp + 3 days;

        emit MilestoneSubmitted(_id, milestoneId);
    }

    /// @notice Voteaza pentru sau contra aprobarii unui milestone
    /// @dev Doar donatorii ETH pot vota; puterea de vot = suma donata in wei
    /// @dev Donatorii SOL sunt informati prin frontend dar nu voteaza on-chain
    /// @param _id ID-ul campaniei
    /// @param _milestoneId Indexul milestone-ului
    /// @param _approve true = aprobare, false = respingere
    function vote(uint256 _id, uint256 _milestoneId, bool _approve) external campaignExists(_id) {
        require(donations[_id][msg.sender] > 0, "Trebuie sa fii donator ETH");
        require(!hasVoted[_id][_milestoneId][msg.sender], "Ai votat deja");

        Milestone storage milestone = milestones[_id][_milestoneId];
        require(milestone.votingActive, "Votul nu este activ");
        require(block.timestamp < milestone.votingDeadline, "Votul a expirat");

        hasVoted[_id][_milestoneId][msg.sender] = true;
        uint256 votingPower = donations[_id][msg.sender];

        if (_approve) { milestone.votesFor += votingPower; }
        else { milestone.votesAgainst += votingPower; }

        emit VoteCast(_id, _milestoneId, msg.sender, _approve);
    }

    /// @notice Finalizeaza votul si elibereaza cota ETH daca e aprobat
    /// @dev Elibereaza proportia ETH corespunzatoare milestone-ului (total / nr_milestone-uri)
    /// @dev Pattern checks-effects-interactions respectat
    /// @param _id ID-ul campaniei
    /// @param _milestoneId Indexul milestone-ului
    function finalizeMilestone(uint256 _id, uint256 _milestoneId) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage campaign = campaigns[_id];
        require(_milestoneId < campaign.milestoneCount, "Milestone invalid");
        require(_milestoneId == campaign.currentMilestone, "Milestone invalid");

        Milestone storage milestone = milestones[_id][_milestoneId];
        require(milestone.votingActive, "Votul nu este activ");

        // EFFECTS
        milestone.votingActive = false;

        if (milestone.votesFor > milestone.votesAgainst) {
            milestone.completed = true;
            milestone.approved = true;
            campaign.currentMilestone++;

            if (campaign.amountRaisedETH > 0) {
                uint256 share = campaign.amountRaisedETH / campaign.milestoneCount;

                if (campaign.currentMilestone >= campaign.milestoneCount) {
                    campaign.isActive = false;
                }

                // INTERACTIONS
                (bool success, ) = payable(campaign.owner).call{value: share}("");
                require(success, "Transfer esuat");
            }

            emit MilestoneApproved(_id, _milestoneId);
        } else {
            milestone.completed = false;
            milestone.approved = false;
            emit MilestoneRejected(_id, _milestoneId);
        }
    }

    /// @notice Returneaza datele campaniei
    function getCampaign(uint256 _id) external view campaignExists(_id) returns (Campaign memory) {
        return campaigns[_id];
    }

    /// @notice Returneaza datele unui milestone
    function getMilestone(uint256 _id, uint256 _milestoneId) external view returns (Milestone memory) {
        return milestones[_id][_milestoneId];
    }

    /// @notice Returneaza suma donata de o adresa ETH specifica
    function getDonation(uint256 _id, address _donor) external view returns (uint256) {
        return donations[_id][_donor];
    }
}
