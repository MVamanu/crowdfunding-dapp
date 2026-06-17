// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title CrowdfundingStableV2 - Campanie USDC cross-chain cu swap ETH->USDC via Uniswap V2
/// @author Marian Dumitru Vamanu
/// @notice Accepta donatii in ETH (swap automat la USDC) sau direct in USDC
/// @dev Integreaza Uniswap V2 Router pentru conversie ETH->USDC on-chain

/// @notice Interfata Uniswap V2 Router pentru swap ETH->USDC
interface IUniswapV2Router {
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts);

    function WETH() external pure returns (address);
}

contract CrowdfundingStableV2 {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IUniswapV2Router public immutable uniswapRouter;
    address public immutable weth;

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
    mapping(string => uint256) public solanaToCampaign;
    mapping(string => bool) public solanaIdExists;
    uint256 public campaignCount;

    event CampaignCreated(uint256 indexed id, address indexed owner, string title, uint256 goalUSDC, string mainChain, string solanaId);
    event DonationReceived(uint256 indexed id, address indexed donor, uint256 amount, string chain);
    event DonationETHSwapped(uint256 indexed id, address indexed donor, uint256 ethAmount, uint256 usdcReceived);
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

    /// @param _usdc Adresa contractului USDC
    /// @param _uniswapRouter Adresa Uniswap V2 Router
    constructor(address _usdc, address _uniswapRouter) {
        require(_usdc != address(0), "Adresa USDC invalida");
        require(_uniswapRouter != address(0), "Adresa Router invalida");
        usdc = IERC20(_usdc);
        uniswapRouter = IUniswapV2Router(_uniswapRouter);
        weth = IUniswapV2Router(_uniswapRouter).WETH();
    }

    /// @notice Creeaza o campanie USDC cross-chain
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

        if (bytes(_solanaId).length > 0) {
            solanaToCampaign[_solanaId] = id;
            solanaIdExists[_solanaId] = true;
        }

        emit CampaignCreated(id, msg.sender, _title, _goalUSDC, _mainChain, _solanaId);
        return id;
    }

    /// @notice Doneaza ETH direct - swap automat ETH->USDC via Uniswap V2
    /// @dev Donatorul trimite ETH, contractul face swap pe Uniswap si primeste USDC
    /// @dev Slippage: acceptam minim 95% din suma estimata (5% slippage maxim)
    /// @param _id ID-ul campaniei
    function donateETH(uint256 _id) external payable campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(block.timestamp < campaign.deadline, "Campania a expirat");
        require(msg.value > 0, "Trimite ETH pentru donatie");

        // Calculam suma minima USDC acceptata (95% din estimare - 5% slippage)
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = address(usdc);

        uint[] memory amountsOut = uniswapRouter.getAmountsOut(msg.value, path);
        uint256 amountOutMin = (amountsOut[1] * 95) / 100;

        // Swap ETH -> USDC via Uniswap V2
        uint[] memory amounts = uniswapRouter.swapExactETHForTokens{value: msg.value}(
            amountOutMin,
            path,
            address(this),
            block.timestamp + 300
        );

        uint256 usdcReceived = amounts[1];

        // Inregistram donatia in USDC
        donations[_id][msg.sender] += usdcReceived;
        campaign.amountRaisedLocal += usdcReceived;
        _checkGoal(campaign);

        emit DonationETHSwapped(_id, msg.sender, msg.value, usdcReceived);
        emit DonationReceived(_id, msg.sender, usdcReceived, "eth-swap");
    }

    /// @notice Doneaza USDC direct (fara swap)
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

        usdc.safeTransferFrom(msg.sender, address(this), _amount);
        emit DonationReceived(_id, msg.sender, _amount, "eth-usdc");
    }

    /// @notice Doneaza ETH pentru o campanie SOL (swap ETH->USDC)
    function donateETHForSol(string memory _solanaId) external payable {
        require(solanaIdExists[_solanaId], "Campania Solana nu exista pe ETH");
        uint256 _id = solanaToCampaign[_solanaId];
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(msg.value > 0, "Trimite ETH pentru donatie");

        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = address(usdc);

        uint[] memory amountsOut = uniswapRouter.getAmountsOut(msg.value, path);
        uint256 amountOutMin = (amountsOut[1] * 95) / 100;

        uint[] memory amounts = uniswapRouter.swapExactETHForTokens{value: msg.value}(
            amountOutMin,
            path,
            address(this),
            block.timestamp + 300
        );

        uint256 usdcReceived = amounts[1];
        donations[_id][msg.sender] += usdcReceived;
        campaign.amountRaisedLocal += usdcReceived;
        _checkGoal(campaign);

        emit DonationETHSwapped(_id, msg.sender, msg.value, usdcReceived);
    }

    /// @notice Doneaza USDC pentru campanie SOL prin solanaId
    function donateForSolCampaign(string memory _solanaId, uint256 _amount) external {
        require(solanaIdExists[_solanaId], "Campania Solana nu exista pe ETH");
        uint256 _id = solanaToCampaign[_solanaId];
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(_amount > 0, "Suma invalida");
        require(
            usdc.allowance(msg.sender, address(this)) >= _amount,
            "Aproba USDC mai intai"
        );

        donations[_id][msg.sender] += _amount;
        campaign.amountRaisedLocal += _amount;
        _checkGoal(campaign);

        usdc.safeTransferFrom(msg.sender, address(this), _amount);
        emit DonationReceived(_id, msg.sender, _amount, "eth-usdc");
    }

    /// @notice Returneaza estimarea USDC pentru o suma ETH
    /// @param _ethAmount Suma ETH in wei
    /// @return Suma estimata USDC (cu 6 zecimale)
    function getUSDCForETH(uint256 _ethAmount) external view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = address(usdc);
        uint[] memory amounts = uniswapRouter.getAmountsOut(_ethAmount, path);
        return amounts[1];
    }

    /// @notice Inregistreaza o donatie externa (SOL)
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

    /// @notice Retrage USDC dupa atingerea goalului
    function withdraw(uint256 _id) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(campaign.goalReached, "Goalul nu a fost atins");
        require(campaign.amountRaisedLocal > 0, "Nu sunt fonduri locale");

        campaign.isActive = false;
        uint256 amount = campaign.amountRaisedLocal;

        usdc.safeTransfer(msg.sender, amount);
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
        usdc.safeTransfer(msg.sender, amount);
        emit RefundIssued(_id, msg.sender, amount);
    }

    function _checkGoal(Campaign storage campaign) internal {
        uint256 total = campaign.amountRaisedLocal + campaign.amountRaisedExternal;
        if (total >= campaign.goalUSDC) {
            campaign.goalReached = true;
        }
    }

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
