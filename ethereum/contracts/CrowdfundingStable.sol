// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IERC20 - Interfata minima pentru token ERC-20
/// @dev Folosita pentru interactiunea cu USDC pe Sepolia
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

/// @title CrowdfundingStable - Crowdfunding cu stablecoin (USDC)
/// @author Marian Dumitru Vamanu
/// @notice Campanii de strangere fonduri in USDC - elimina riscul de volatilitate crypto
/// @dev Foloseste ERC-20 transferFrom pattern: donator trebuie sa apeleze approve() inainte de donate()
/// @dev USDC pe Sepolia: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
contract CrowdfundingStable {

    /// @notice Token-ul stablecoin acceptat (USDC)
    IERC20 public immutable stableToken;

    /// @notice Numarul de zecimale al token-ului (USDC = 6 zecimale)
    uint8 public immutable tokenDecimals;

    /// @notice Structura unei campanii USDC
    struct Campaign {
        address owner;          ///< Proprietarul campaniei
        string title;           ///< Titlul campaniei
        string description;     ///< Descrierea campaniei
        uint256 goal;           ///< Obiectivul in USDC (cu 6 zecimale: 100 USDC = 100_000_000)
        uint256 amountRaised;   ///< Suma stransa in USDC
        bool isActive;          ///< Statusul campaniei
        uint256 deadline;       ///< Termenul limita (timestamp Unix)
        bool goalReached;       ///< Daca goalul a fost atins
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public donations;
    uint256 public campaignCount;

    event CampaignCreated(uint256 indexed id, address indexed owner, string title, uint256 goal);
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

    /// @notice Initializeaza contractul cu adresa token-ului stablecoin
    /// @param _stableToken Adresa contractului USDC pe reteaua curenta
    /// @param _tokenDecimals Numarul de zecimale (6 pentru USDC)
    constructor(address _stableToken, uint8 _tokenDecimals) {
        require(_stableToken != address(0), "Adresa invalida");
        stableToken = IERC20(_stableToken);
        tokenDecimals = _tokenDecimals;
    }

    /// @notice Creeaza o campanie noua cu goal in USDC
    /// @param _title Titlul campaniei
    /// @param _description Descrierea campaniei
    /// @param _goal Obiectivul in unitati USDC (ex: 100 USDC = 100_000_000 cu 6 zecimale)
    /// @param _durationDays Durata campaniei in zile
    /// @return ID-ul campaniei create
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
            deadline: block.timestamp + (_durationDays * 1 days),
            goalReached: false
        });

        emit CampaignCreated(id, msg.sender, _title, _goal);
        return id;
    }

    /// @notice Doneaza USDC la o campanie activa
    /// @dev Donatorul trebuie sa apeleze USDC.approve(contractAddress, amount) inainte
    /// @dev Pattern ERC-20: transferFrom muta tokens de la donator la contract
    /// @param _id ID-ul campaniei
    /// @param _amount Suma in USDC (cu 6 zecimale)
    function donate(uint256 _id, uint256 _amount) external campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(block.timestamp < campaign.deadline, "Campania a expirat");
        require(_amount > 0, "Suma invalida");
        require(
            stableToken.allowance(msg.sender, address(this)) >= _amount,
            "Allowance insuficient. Apeleaza approve() mai intai."
        );

        // CHECKS-EFFECTS-INTERACTIONS
        donations[_id][msg.sender] += _amount;
        campaign.amountRaised += _amount;

        if (campaign.amountRaised >= campaign.goal) {
            campaign.goalReached = true;
        }

        // INTERACTIONS: transfer ERC-20
        require(
            stableToken.transferFrom(msg.sender, address(this), _amount),
            "Transfer USDC esuat"
        );

        emit DonationReceived(_id, msg.sender, _amount);
    }

    /// @notice Retrage fondurile USDC dupa atingerea goalului
    /// @dev Pattern CEI: stare actualizata inainte de transfer
    /// @param _id ID-ul campaniei
    function withdraw(uint256 _id) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(campaign.goalReached, "Goalul nu a fost atins");

        // EFFECTS
        campaign.isActive = false;
        uint256 amount = campaign.amountRaised;

        // INTERACTIONS
        require(
            stableToken.transfer(msg.sender, amount),
            "Transfer USDC esuat"
        );

        emit FundsWithdrawn(_id, msg.sender, amount);
    }

    /// @notice Returneaza donatia USDC daca campania a expirat fara goal
    /// @param _id ID-ul campaniei
    function refund(uint256 _id) external campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(
            block.timestamp >= campaign.deadline || !campaign.isActive,
            "Campania inca ruleaza"
        );
        require(!campaign.goalReached, "Goalul a fost atins - nu se poate face refund");

        uint256 amount = donations[_id][msg.sender];
        require(amount > 0, "Nu ai donatii de returnat");

        // EFFECTS
        donations[_id][msg.sender] = 0;

        // INTERACTIONS
        require(
            stableToken.transfer(msg.sender, amount),
            "Refund USDC esuat"
        );

        emit RefundIssued(_id, msg.sender, amount);
    }

    /// @notice Returneaza datele complete ale campaniei
    function getCampaign(uint256 _id) external view campaignExists(_id) returns (Campaign memory) {
        return campaigns[_id];
    }

    /// @notice Returneaza suma donata de o adresa specifica
    function getDonation(uint256 _id, address _donor) external view returns (uint256) {
        return donations[_id][_donor];
    }

    /// @notice Returneaza balanta USDC a contractului
    function getContractBalance() external view returns (uint256) {
        return stableToken.balanceOf(address(this));
    }
}
