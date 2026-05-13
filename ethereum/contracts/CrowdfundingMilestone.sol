// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title CrowdfundingMilestone - Crowdfunding cu finantare etapizata
/// @author Marian Dumitru Vamanu
/// @notice Fondurile sunt eliberate etapizat dupa aprobarea prin vot proportional a fiecarei etape
/// @dev Votul este ponderat proportional cu suma donata de fiecare participant
contract CrowdfundingMilestone {

    /// @notice Structura unui milestone (etapa)
    struct Milestone {
        string title;           ///< Titlul etapei
        string description;     ///< Descrierea etapei
        uint256 amount;         ///< Suma alocata etapei (wei)
        bool completed;         ///< Daca etapa a fost finalizata
        bool approved;          ///< Daca etapa a fost aprobata prin vot
        uint256 votesFor;       ///< Voturi pentru aprobare (ponderate in wei)
        uint256 votesAgainst;   ///< Voturi contra (ponderate in wei)
        bool votingActive;      ///< Daca votul este activ
        uint256 votingDeadline; ///< Termenul limita pentru vot (timestamp)
    }

    /// @notice Structura unei campanii cu milestone-uri
    struct Campaign {
        address owner;              ///< Proprietarul campaniei
        string title;               ///< Titlul campaniei
        string description;         ///< Descrierea campaniei
        uint256 totalGoal;          ///< Obiectivul total (suma milestone-urilor)
        uint256 amountRaised;       ///< Suma stransa
        bool isActive;              ///< Statusul campaniei
        uint256 deadline;           ///< Termenul limita
        uint256 milestoneCount;     ///< Numarul de milestone-uri
        uint256 currentMilestone;   ///< Indexul milestone-ului curent
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => mapping(address => uint256)) public donations;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVoted;
    uint256 public campaignCount;

    event CampaignCreated(uint256 indexed id, address indexed owner, string title);
    event DonationReceived(uint256 indexed id, address indexed donor, uint256 amount);
    event MilestoneSubmitted(uint256 indexed id, uint256 milestoneId);
    event VoteCast(uint256 indexed id, uint256 milestoneId, address indexed voter, bool approve);
    event MilestoneApproved(uint256 indexed id, uint256 milestoneId, uint256 amount);
    event MilestoneRejected(uint256 indexed id, uint256 milestoneId);

    modifier onlyOwner(uint256 _id) {
        require(campaigns[_id].owner == msg.sender, "Nu esti proprietarul");
        _;
    }

    modifier campaignExists(uint256 _id) {
        require(_id < campaignCount, "Campania nu exista");
        _;
    }

    /// @notice Creeaza o campanie cu milestone-uri
    /// @dev Minimum 2 milestone-uri necesare, maximum 10
    /// @param _title Titlul campaniei
    /// @param _description Descrierea campaniei
    /// @param _durationDays Durata campaniei in zile
    /// @param _milestoneTitles Array cu titlurile etapelor
    /// @param _milestoneDescriptions Array cu descrierile etapelor
    /// @param _milestoneAmounts Array cu sumele alocate fiecarei etape (wei)
    /// @return ID-ul campaniei create
    function createCampaign(
        string memory _title,
        string memory _description,
        uint256 _durationDays,
        string[] memory _milestoneTitles,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestoneAmounts
    ) external returns (uint256) {
        require(_milestoneTitles.length >= 2, "Minim 2 milestone-uri");
        require(_milestoneTitles.length == _milestoneAmounts.length, "Date invalide");
        require(_milestoneTitles.length == _milestoneDescriptions.length, "Date invalide");
        require(_durationDays > 0, "Durata trebuie sa fie pozitiva");

        uint256 totalGoal = 0;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            totalGoal += _milestoneAmounts[i];
        }

        uint256 id = campaignCount++;
        campaigns[id] = Campaign({
            owner: msg.sender,
            title: _title,
            description: _description,
            totalGoal: totalGoal,
            amountRaised: 0,
            isActive: true,
            deadline: block.timestamp + (_durationDays * 1 days),
            milestoneCount: _milestoneTitles.length,
            currentMilestone: 0
        });

        for (uint256 i = 0; i < _milestoneTitles.length; i++) {
            milestones[id][i] = Milestone({
                title: _milestoneTitles[i],
                description: _milestoneDescriptions[i],
                amount: _milestoneAmounts[i],
                completed: false,
                approved: false,
                votesFor: 0,
                votesAgainst: 0,
                votingActive: false,
                votingDeadline: 0
            });
        }

        emit CampaignCreated(id, msg.sender, _title);
        return id;
    }

    /// @notice Doneaza ETH la o campanie cu milestone-uri
    /// @dev Donatorii acumuleaza putere de vot proportionala cu suma donata
    /// @param _id ID-ul campaniei
    function donate(uint256 _id) external payable campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(block.timestamp < campaign.deadline, "Campania a expirat");
        require(msg.value > 0, "Donatie invalida");

        donations[_id][msg.sender] += msg.value;
        campaign.amountRaised += msg.value;

        emit DonationReceived(_id, msg.sender, msg.value);
    }

    /// @notice Proprietarul submite milestone-ul curent pentru vot
    /// @dev Activeaza o fereastra de vot de 3 zile
    /// @param _id ID-ul campaniei
    function submitMilestone(uint256 _id) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(campaign.amountRaised >= campaign.totalGoal, "Goalul nu a fost atins");

        uint256 idx = campaign.currentMilestone;
        require(!milestones[_id][idx].votingActive, "Vot deja activ");
        require(!milestones[_id][idx].completed, "Milestone deja completat");

        milestones[_id][idx].votingActive = true;
        milestones[_id][idx].votingDeadline = block.timestamp + 3 days;

        emit MilestoneSubmitted(_id, idx);
    }

    /// @notice Donatorii voteaza pentru sau contra aprobarii unui milestone
    /// @dev Puterea de vot este proportionala cu suma donata (1 wei = 1 vot)
    /// @dev Access control: doar donatorii pot vota, o singura data per milestone
    /// @param _id ID-ul campaniei
    /// @param _milestoneId Indexul milestone-ului supus votului
    /// @param _approve true pentru aprobare, false pentru respingere
    function vote(uint256 _id, uint256 _milestoneId, bool _approve) external campaignExists(_id) {
        require(donations[_id][msg.sender] > 0, "Trebuie sa fii donator");
        require(!hasVoted[_id][_milestoneId][msg.sender], "Ai votat deja");

        Milestone storage milestone = milestones[_id][_milestoneId];
        require(milestone.votingActive, "Votul nu este activ");
        require(block.timestamp < milestone.votingDeadline, "Votul a expirat");

        hasVoted[_id][_milestoneId][msg.sender] = true;
        uint256 votingPower = donations[_id][msg.sender];

        if (_approve) {
            milestone.votesFor += votingPower;
        } else {
            milestone.votesAgainst += votingPower;
        }

        emit VoteCast(_id, _milestoneId, msg.sender, _approve);
    }

    /// @notice Finalizeaza votul si elibereaza fondurile daca e aprobat
    /// @dev Daca votes_for > votes_against: transfera ETH si avanseaza la urmatorul milestone
    /// @dev Pattern checks-effects-interactions respectat
    /// @param _id ID-ul campaniei
    /// @param _milestoneId Indexul milestone-ului de finalizat
    function finalizeMilestone(uint256 _id, uint256 _milestoneId) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage campaign = campaigns[_id];
        require(_milestoneId < campaign.milestoneCount, "Milestone invalid");
        require(_milestoneId == campaign.currentMilestone, "Milestone invalid");

        Milestone storage milestone = milestones[_id][_milestoneId];
        require(milestone.votingActive, "Votul nu este activ");

        // EFFECTS: oprim votul inainte de orice transfer
        milestone.votingActive = false;

        if (milestone.votesFor > milestone.votesAgainst) {
            milestone.completed = true;
            milestone.approved = true;
            campaign.currentMilestone++;

            uint256 amount = milestone.amount;
            address owner = campaign.owner;

            if (campaign.currentMilestone >= campaign.milestoneCount) {
                campaign.isActive = false;
            }

            // INTERACTIONS: transfer dupa actualizarea state-ului
            (bool success, ) = payable(owner).call{value: amount}("");
            require(success, "Transfer esuat");

            emit MilestoneApproved(_id, _milestoneId, amount);
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
}
