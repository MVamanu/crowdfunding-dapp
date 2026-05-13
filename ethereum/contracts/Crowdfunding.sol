// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Crowdfunding - Contract simplu de strangere fonduri pe Ethereum
/// @author Marian Dumitru Vamanu
/// @notice Permite crearea de campanii de crowdfunding si acceptarea donatiilor in ETH
/// @dev Implementeaza pattern-ul checks-effects-interactions pentru protectie reentrancy
contract Crowdfunding {

    /// @notice Structura unei campanii de crowdfunding
    /// @dev Stocata in mapping-ul campaigns indexat dupa ID
    struct Campaign {
        address owner;          ///< Adresa creatorului campaniei
        string title;           ///< Titlul campaniei
        string description;     ///< Descrierea campaniei
        uint256 goal;           ///< Obiectivul de strangere (in wei)
        uint256 amountRaised;   ///< Suma stransa pana in prezent (in wei)
        bool isActive;          ///< Statusul campaniei
        uint256 deadline;       ///< Termenul limita (timestamp Unix)
    }

    /// @notice Mapping de la ID la campanie
    mapping(uint256 => Campaign) public campaigns;

    /// @notice Mapping de la ID campanie si adresa donator la suma donata
    mapping(uint256 => mapping(address => uint256)) public donations;

    /// @notice Numarul total de campanii create
    uint256 public campaignCount;

    /// @notice Emis la crearea unei campanii noi
    event CampaignCreated(uint256 indexed id, address indexed owner, string title, uint256 goal);

    /// @notice Emis la primirea unei donatii
    event DonationReceived(uint256 indexed id, address indexed donor, uint256 amount);

    /// @notice Emis la retragerea fondurilor
    event FundsWithdrawn(uint256 indexed id, address indexed owner, uint256 amount);

    /// @notice Emis la returnarea fondurilor catre donator
    event RefundIssued(uint256 indexed id, address indexed donor, uint256 amount);

    /// @dev Verifica ca apelantul este proprietarul campaniei
    modifier onlyOwner(uint256 _id) {
        require(campaigns[_id].owner == msg.sender, "Nu esti proprietarul campaniei");
        _;
    }

    /// @dev Verifica ca ID-ul campaniei este valid
    modifier campaignExists(uint256 _id) {
        require(_id < campaignCount, "Campania nu exista");
        _;
    }

    /// @notice Creeaza o campanie noua de crowdfunding
    /// @dev ID-ul campaniei este auto-incrementat incepand de la 0
    /// @param _title Titlul campaniei
    /// @param _description Descrierea campaniei
    /// @param _goal Obiectivul in wei (trebuie sa fie > 0)
    /// @param _durationDays Durata in zile (trebuie sa fie > 0)
    /// @return ID-ul campaniei nou create
    function createCampaign(
        string memory _title,
        string memory _description,
        uint256 _goal,
        uint256 _durationDays
    ) external returns (uint256) {
        require(_goal > 0, "Goalul trebuie sa fie pozitiv");
        require(_durationDays > 0, "Durata trebuie sa fie pozitiva");

        uint256 id = campaignCount++;
        campaigns[id] = Campaign({
            owner: msg.sender,
            title: _title,
            description: _description,
            goal: _goal,
            amountRaised: 0,
            isActive: true,
            deadline: block.timestamp + (_durationDays * 1 days)
        });

        emit CampaignCreated(id, msg.sender, _title, _goal);
        return id;
    }

    /// @notice Doneaza ETH catre o campanie activa
    /// @dev Protectie reentrancy: state-ul este actualizat inainte de orice transfer
    /// @param _id ID-ul campaniei catre care se doneaza
    function donate(uint256 _id) external payable campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(block.timestamp < campaign.deadline, "Campania a expirat");
        require(msg.value > 0, "Donatie invalida");

        donations[_id][msg.sender] += msg.value;
        campaign.amountRaised += msg.value;

        emit DonationReceived(_id, msg.sender, msg.value);
    }

    /// @notice Retrage fondurile dupa atingerea goalului
    /// @dev Pattern checks-effects-interactions: isActive = false INAINTE de transfer
    /// @dev Protectie reentrancy implementata prin modificarea state-ului inainte de call
    /// @param _id ID-ul campaniei din care se retrag fondurile
    function withdraw(uint256 _id) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(campaign.amountRaised >= campaign.goal, "Goalul nu a fost atins");

        // EFFECTS: modifica state-ul inainte de transfer (protectie reentrancy)
        campaign.isActive = false;
        uint256 amount = campaign.amountRaised;

        // INTERACTIONS: transfer dupa modificarea state-ului
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer esuat");

        emit FundsWithdrawn(_id, msg.sender, amount);
    }

    /// @notice Returneaza donatia daca campania a expirat fara a atinge goalul
    /// @param _id ID-ul campaniei
    function refund(uint256 _id) external campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(block.timestamp >= campaign.deadline, "Campania inca ruleaza");
        require(campaign.amountRaised < campaign.goal, "Goalul a fost atins");

        uint256 amount = donations[_id][msg.sender];
        require(amount > 0, "Nu ai donatii de returnat");

        // EFFECTS: resetam donatia inainte de transfer
        donations[_id][msg.sender] = 0;

        // INTERACTIONS: transfer dupa modificarea state-ului
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Refund esuat");

        emit RefundIssued(_id, msg.sender, amount);
    }

    /// @notice Returneaza datele complete ale unei campanii
    /// @param _id ID-ul campaniei
    /// @return Structura Campaign cu toate datele
    function getCampaign(uint256 _id) external view campaignExists(_id) returns (Campaign memory) {
        return campaigns[_id];
    }
}
