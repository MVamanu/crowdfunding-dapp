// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title CrowdfundingStableV2 - Campanie USDC cross-chain cu suport ETH mirror pentru campanii SOL
/// @author Marian Dumitru Vamanu
/// @notice Accepta donatii USDC local si inregistreaza donatii externe din alte chain-uri
/// @dev Suporta campanii cu main chain ETH sau SOL
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract CrowdfundingStableV2 {

    IERC20 public immutable usdc;

    struct Campaign {
        address owner;
        string title;
        string description;
        uint256 goalUSDC;
        uint256 amountRaisedLocal;
        uint256 amountRaisedExternal;
        bool isActive;
        uint256 deadline;
        bool goalReached;
        string mainChain;
        string[] acceptedChains;
        string solanaId;
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public donations;
    mapping(uint256 => mapping(string => uint256)) public externalDonations;
    // Mapping solanaId => campaignId pentru campanii cu main=SOL
    mapping(string => uint256) public solanaToCampaign;
    mapping(string => bool) public solanaIdExists;
    uint256 public campaignCount;

    event CampaignCreated(uint256 indexed id, address indexed owner, string title, uint256 goalUSDC, string mainChain, string solanaId);
    event DonationReceived(uint256 indexed id, address indexed donor, uint256 amount, string chain);
    event ExternalDonationRecorded(uint256 indexed id, uint256 amount, string fromChain);
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

    constructor(address _usdc) {
        require(_usdc != address(0), "Adresa invalida");
        usdc = IERC20(_usdc);
    }

    /// @notice Creeaza o campanie USDC cross-chain
    /// @param _title Titlul campaniei
    /// @param _description Descrierea campaniei
    /// @param _goalUSDC Goalul in USDC (6 zecimale)
    /// @param _durationDays Durata in zile
    /// @param _mainChain Blockchain-ul principal ("eth" sau "sol")
    /// @param _acceptedChains Chain-urile acceptate
    /// @param _solanaId ID-ul contului Solana (pubkey) pentru campanii SOL main
    function createCampaign(
        string memory _title,
        string memory _description,
        uint256 _goalUSDC,
        uint256 _durationDays,
        string memory _mainChain,
        string[] memory _acceptedChains,
        string memory _solanaId
    ) external returns (uint256) {
        require(_goalUSDC > 0, "Goalul trebuie sa fie pozitiv");
        require(_durationDays > 0, "Durata trebuie sa fie pozitiva");
        require(_acceptedChains.length > 0, "Cel putin un chain acceptat");

        uint256 id = campaignCount++;
        campaigns[id] = Campaign({
            owner: msg.sender,
            title: _title,
            description: _description,
            goalUSDC: _goalUSDC,
            amountRaisedLocal: 0,
            amountRaisedExternal: 0,
            isActive: true,
            deadline: block.timestamp + (_durationDays * 1 days),
            goalReached: false,
            mainChain: _mainChain,
            acceptedChains: _acceptedChains,
            solanaId: _solanaId
        });

        // Daca main chain e SOL, inregistram mapping-ul solanaId => campaignId
        if (bytes(_solanaId).length > 0) {
            solanaToCampaign[_solanaId] = id;
            solanaIdExists[_solanaId] = true;
        }

        emit CampaignCreated(id, msg.sender, _title, _goalUSDC, _mainChain, _solanaId);
        return id;
    }

    /// @notice Doneaza USDC local pe Ethereum
    /// @dev Necesita approve() inainte
    function donateLocal(uint256 _id, uint256 _amount) external campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(block.timestamp < campaign.deadline, "Campania a expirat");
        require(_amount > 0, "Suma invalida");
        require(
            usdc.allowance(msg.sender, address(this)) >= _amount,
            "Aproba USDC mai intai"
        );

        donations[_id][msg.sender] += _amount;
        campaign.amountRaisedLocal += _amount;
        _checkGoal(campaign);

        require(usdc.transferFrom(msg.sender, address(this), _amount), "Transfer esuat");
        emit DonationReceived(_id, msg.sender, _amount, "eth");
    }

    /// @notice Doneaza USDC pentru o campanie SOL identificata prin solanaId
    /// @dev Permite donatorilor ETH sa doneze la campanii cu main chain SOL
    /// @param _solanaId Pubkey-ul contului Solana al campaniei
    /// @param _amount Suma in USDC (6 zecimale)
    function donateForSolCampaign(string memory _solanaId, uint256 _amount) external {
        require(solanaIdExists[_solanaId], "Campania Solana nu exista pe ETH");
        uint256 _id = solanaToCampaign[_solanaId];
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(block.timestamp < campaign.deadline, "Campania a expirat");
        require(_amount > 0, "Suma invalida");
        require(
            usdc.allowance(msg.sender, address(this)) >= _amount,
            "Aproba USDC mai intai"
        );

        donations[_id][msg.sender] += _amount;
        campaign.amountRaisedLocal += _amount;
        _checkGoal(campaign);

        require(usdc.transferFrom(msg.sender, address(this), _amount), "Transfer esuat");
        emit DonationReceived(_id, msg.sender, _amount, "eth");
    }

    /// @notice Inregistreaza o donatie externa (SOL, etc.)
    function recordExternalDonation(
        uint256 _id,
        uint256 _amount,
        string memory _fromChain
    ) external campaignExists(_id) onlyOwner(_id) {
        require(_amount > 0, "Suma invalida");
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");

        campaign.amountRaisedExternal += _amount;
        externalDonations[_id][_fromChain] += _amount;
        _checkGoal(campaign);

        emit ExternalDonationRecorded(_id, _amount, _fromChain);
    }

    /// @notice Retrage USDC local dupa atingerea goalului
    function withdraw(uint256 _id) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(campaign.goalReached, "Goalul nu a fost atins");
        require(campaign.amountRaisedLocal > 0, "Nu sunt fonduri locale");

        campaign.isActive = false;
        uint256 amount = campaign.amountRaisedLocal;

        require(usdc.transfer(msg.sender, amount), "Transfer esuat");
        emit FundsWithdrawn(_id, msg.sender, amount);
    }

    /// @notice Refund USDC daca campania a expirat
    function refund(uint256 _id) external campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(
            block.timestamp >= campaign.deadline || !campaign.isActive,
            "Campania inca ruleaza"
        );
        require(!campaign.goalReached, "Goalul a fost atins");

        uint256 amount = donations[_id][msg.sender];
        require(amount > 0, "Nu ai donatii de returnat");

        donations[_id][msg.sender] = 0;
        require(usdc.transfer(msg.sender, amount), "Refund esuat");
        emit RefundIssued(_id, msg.sender, amount);
    }

    function _checkGoal(Campaign storage campaign) internal {
        uint256 total = campaign.amountRaisedLocal + campaign.amountRaisedExternal;
        if (total >= campaign.goalUSDC) {
            campaign.goalReached = true;
        }
    }

    /// @notice Returneaza campania dupa solanaId
    function getCampaignBySolanaId(string memory _solanaId) external view returns (Campaign memory, uint256) {
        require(solanaIdExists[_solanaId], "Campania Solana nu exista");
        uint256 id = solanaToCampaign[_solanaId];
        return (campaigns[id], id);
    }

    function getCampaign(uint256 _id) external view campaignExists(_id) returns (Campaign memory) {
        return campaigns[_id];
    }

    function getTotalRaised(uint256 _id) external view campaignExists(_id) returns (uint256) {
        return campaigns[_id].amountRaisedLocal + campaigns[_id].amountRaisedExternal;
    }

    function getExternalDonations(uint256 _id, string memory _chain) external view returns (uint256) {
        return externalDonations[_id][_chain];
    }

    function getDonation(uint256 _id, address _donor) external view returns (uint256) {
        return donations[_id][_donor];
    }

    function getDonationForSol(string memory _solanaId, address _donor) external view returns (uint256) {
        require(solanaIdExists[_solanaId], "Campania Solana nu exista");
        uint256 id = solanaToCampaign[_solanaId];
        return donations[id][_donor];
    }
}
