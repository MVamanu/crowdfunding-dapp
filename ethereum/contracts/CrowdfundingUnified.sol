// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title CrowdfundingUnified - Campanie cross-chain cu goal in USD
/// @author Marian Dumitru Vamanu
/// @notice Accepta donatii ETH si inregistreaza adresa Solana pentru donatii SOL
/// @dev Goal-ul este in USD; frontend-ul agrega donatiile din ambele blockchain-uri
contract CrowdfundingUnified {

    /// @notice Structura campaniei cross-chain
    struct Campaign {
        address owner;              ///< Proprietarul campaniei (adresa ETH)
        string title;               ///< Titlul campaniei
        string description;         ///< Descrierea campaniei
        uint256 goalUSD;            ///< Obiectivul in USD (fara zecimale)
        uint256 amountRaisedETH;    ///< Suma stransa in wei (ETH)
        bool isActive;              ///< Statusul campaniei
        uint256 deadline;           ///< Termenul limita (timestamp)
        string solanaAddress;       ///< Adresa Solana pentru donatii SOL
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public donations;
    uint256 public campaignCount;

    event CampaignCreated(uint256 indexed id, address indexed owner, string title, uint256 goalUSD, string solanaAddress);
    event DonationReceived(uint256 indexed id, address indexed donor, uint256 amount);
    event FundsWithdrawn(uint256 indexed id, address indexed owner, uint256 amount);
    event RefundIssued(uint256 indexed id, address indexed donor, uint256 amount);

    modifier onlyOwner(uint256 _id) {
        require(campaigns[_id].owner == msg.sender, "Nu esti proprietarul");
        _;
    }

    modifier campaignExists(uint256 _id) {
        require(_id < campaignCount, "Campania nu exista");
        _;
    }

    /// @notice Creeaza o campanie cross-chain cu goal in USD
    /// @param _title Titlul campaniei
    /// @param _description Descrierea campaniei
    /// @param _goalUSD Obiectivul in USD (intreg, fara zecimale)
    /// @param _durationDays Durata in zile
    /// @param _solanaAddress Adresa Solana a proprietarului pentru donatii SOL
    /// @return ID-ul campaniei create
    function createCampaign(
        string memory _title,
        string memory _description,
        uint256 _goalUSD,
        uint256 _durationDays,
        string memory _solanaAddress
    ) external returns (uint256) {
        require(_goalUSD > 0, "Goalul trebuie sa fie pozitiv");
        require(_durationDays > 0, "Durata trebuie sa fie pozitiva");

        uint256 id = campaignCount++;
        campaigns[id] = Campaign({
            owner: msg.sender,
            title: _title,
            description: _description,
            goalUSD: _goalUSD,
            amountRaisedETH: 0,
            isActive: true,
            deadline: block.timestamp + (_durationDays * 1 days),
            solanaAddress: _solanaAddress
        });

        emit CampaignCreated(id, msg.sender, _title, _goalUSD, _solanaAddress);
        return id;
    }

    /// @notice Doneaza ETH la campanie
    /// @param _id ID-ul campaniei
    function donate(uint256 _id) external payable campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(block.timestamp < campaign.deadline, "Campania a expirat");
        require(msg.value > 0, "Donatie invalida");

        donations[_id][msg.sender] += msg.value;
        campaign.amountRaisedETH += msg.value;

        emit DonationReceived(_id, msg.sender, msg.value);
    }

    /// @notice Retrage fondurile ETH stranase
    /// @dev Pattern checks-effects-interactions: isActive = false inainte de transfer
    /// @param _id ID-ul campaniei
    function withdraw(uint256 _id) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(campaign.amountRaisedETH > 0, "Nu sunt fonduri de retras");

        campaign.isActive = false;
        uint256 amount = campaign.amountRaisedETH;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer esuat");

        emit FundsWithdrawn(_id, msg.sender, amount);
    }

    /// @notice Returneaza donatia ETH daca campania a expirat
    /// @param _id ID-ul campaniei
    function refund(uint256 _id) external campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(block.timestamp >= campaign.deadline, "Campania inca ruleaza");

        uint256 amount = donations[_id][msg.sender];
        require(amount > 0, "Nu ai donatii de returnat");

        donations[_id][msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Refund esuat");

        emit RefundIssued(_id, msg.sender, amount);
    }

    /// @notice Returneaza datele campaniei
    function getCampaign(uint256 _id) external view campaignExists(_id) returns (Campaign memory) {
        return campaigns[_id];
    }
}
