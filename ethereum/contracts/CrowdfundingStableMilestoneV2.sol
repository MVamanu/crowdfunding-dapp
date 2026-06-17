// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title CrowdfundingStableMilestoneV2 - USDC milestone crowdfunding with cross-chain tracking
/// @notice Accepts local USDC donations and lets the owner record externally verified USDC donations.
contract CrowdfundingStableMilestoneV2 {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    struct Campaign {
        address owner;
        string title;
        string description;
        uint256 totalGoal;
        uint256 amountRaisedLocal;
        uint256 amountRaisedExternal;
        bool isActive;
        uint256 deadline;
        bool goalReached;
        string mainChain;
        string[] acceptedChains;
        uint256 milestoneCount;
        uint256 currentMilestone;
    }

    struct Milestone {
        string title;
        string description;
        uint256 amount;
        bool completed;
        bool approved;
        uint256 votesFor;
        uint256 votesAgainst;
        bool votingActive;
        uint256 votingDeadline;
    }

    struct ExternalChain {
        string chainName;
        string contractAddress;
        bool active;
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => mapping(address => uint256)) public donationsLocal;
    mapping(uint256 => mapping(address => uint256)) public donationsExternalByDonor;
    mapping(uint256 => mapping(string => uint256)) public externalDonations;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVoted;
    mapping(uint256 => ExternalChain[]) public campaignChains;
    mapping(uint256 => uint256) public releasedLocal;
    uint256 public campaignCount;

    event CampaignCreated(uint256 indexed id, address indexed owner, string title, uint256 totalGoal, string mainChain);
    event DonationReceived(uint256 indexed id, address indexed donor, uint256 amount, string chain);
    event ExternalDonationRecorded(uint256 indexed id, address indexed donor, uint256 amount, string fromChain);
    event MilestoneSubmitted(uint256 indexed id, uint256 indexed milestoneId);
    event VoteCast(uint256 indexed id, uint256 indexed milestoneId, address indexed voter, bool approve, uint256 votingPower);
    event MilestoneApproved(uint256 indexed id, uint256 indexed milestoneId, uint256 amount);
    event MilestoneRejected(uint256 indexed id, uint256 indexed milestoneId);
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

    function createCampaign(
        string memory _title,
        string memory _description,
        uint256 _durationDays,
        string memory _mainChain,
        string[] memory _acceptedChains,
        string[] memory _externalAddresses,
        string[] memory _milestoneTitles,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestoneAmounts
    ) external returns (uint256) {
        require(_durationDays > 0, "Durata trebuie sa fie pozitiva");
        require(_acceptedChains.length > 0, "Cel putin un chain acceptat");
        require(_milestoneTitles.length >= 2, "Minim 2 milestone-uri");
        require(_milestoneTitles.length == _milestoneDescriptions.length, "Date invalide");
        require(_milestoneTitles.length == _milestoneAmounts.length, "Date invalide");

        uint256 totalGoal = 0;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            require(_milestoneAmounts[i] > 0, "Suma milestone invalida");
            totalGoal += _milestoneAmounts[i];
        }

        uint256 id = campaignCount++;
        campaigns[id] = Campaign({
            owner: msg.sender,
            title: _title,
            description: _description,
            totalGoal: totalGoal,
            amountRaisedLocal: 0,
            amountRaisedExternal: 0,
            isActive: true,
            deadline: block.timestamp + (_durationDays * 1 days),
            goalReached: false,
            mainChain: _mainChain,
            acceptedChains: _acceptedChains,
            milestoneCount: _milestoneTitles.length,
            currentMilestone: 0
        });

        for (uint256 i = 0; i < _acceptedChains.length; i++) {
            string memory externalAddress = i < _externalAddresses.length ? _externalAddresses[i] : "";
            campaignChains[id].push(ExternalChain({
                chainName: _acceptedChains[i],
                contractAddress: externalAddress,
                active: true
            }));
        }

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

        emit CampaignCreated(id, msg.sender, _title, totalGoal, _mainChain);
        return id;
    }

    function donateLocal(uint256 _id, uint256 _amount) external campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(block.timestamp < campaign.deadline, "Campania a expirat");
        require(_amount > 0, "Suma invalida");
        require(usdc.allowance(msg.sender, address(this)) >= _amount, "Aproba USDC mai intai");

        donationsLocal[_id][msg.sender] += _amount;
        campaign.amountRaisedLocal += _amount;
        _checkGoal(campaign);

        usdc.safeTransferFrom(msg.sender, address(this), _amount);
        emit DonationReceived(_id, msg.sender, _amount, "eth");
    }

    function recordExternalDonation(
        uint256 _id,
        address _donor,
        uint256 _amount,
        string memory _fromChain
    ) external campaignExists(_id) onlyOwner(_id) {
        require(_donor != address(0), "Donator invalid");
        require(_amount > 0, "Suma invalida");
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(_isAcceptedChain(campaign.acceptedChains, _fromChain), "Chain neacceptat");

        donationsExternalByDonor[_id][_donor] += _amount;
        campaign.amountRaisedExternal += _amount;
        externalDonations[_id][_fromChain] += _amount;
        _checkGoal(campaign);

        emit ExternalDonationRecorded(_id, _donor, _amount, _fromChain);
    }

    function submitMilestone(uint256 _id) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(campaign.goalReached, "Goalul nu a fost atins");

        uint256 idx = campaign.currentMilestone;
        require(idx < campaign.milestoneCount, "Milestone invalid");

        Milestone storage milestone = milestones[_id][idx];
        require(!milestone.votingActive, "Vot deja activ");
        require(!milestone.completed, "Milestone deja completat");

        milestone.votingActive = true;
        milestone.votingDeadline = block.timestamp + 3 days;

        emit MilestoneSubmitted(_id, idx);
    }

    function vote(uint256 _id, uint256 _milestoneId, bool _approve) external campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(_milestoneId < campaign.milestoneCount, "Milestone invalid");
        require(_milestoneId == campaign.currentMilestone, "Milestone invalid");
        require(!hasVoted[_id][_milestoneId][msg.sender], "Ai votat deja");

        uint256 votingPower = getVotingPower(_id, msg.sender);
        require(votingPower > 0, "Trebuie sa fii donator");

        Milestone storage milestone = milestones[_id][_milestoneId];
        require(milestone.votingActive, "Votul nu este activ");
        require(block.timestamp < milestone.votingDeadline, "Votul a expirat");

        hasVoted[_id][_milestoneId][msg.sender] = true;
        if (_approve) {
            milestone.votesFor += votingPower;
        } else {
            milestone.votesAgainst += votingPower;
        }

        emit VoteCast(_id, _milestoneId, msg.sender, _approve, votingPower);
    }

    function finalizeMilestone(uint256 _id, uint256 _milestoneId) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage campaign = campaigns[_id];
        require(_milestoneId < campaign.milestoneCount, "Milestone invalid");
        require(_milestoneId == campaign.currentMilestone, "Milestone invalid");

        Milestone storage milestone = milestones[_id][_milestoneId];
        require(milestone.votingActive, "Votul nu este activ");

        milestone.votingActive = false;

        if (milestone.votesFor > milestone.votesAgainst) {
            milestone.completed = true;
            milestone.approved = true;
            campaign.currentMilestone++;

            uint256 releaseAmount = _getReleaseAmount(_id, campaign, milestone.amount);

            if (campaign.currentMilestone >= campaign.milestoneCount) {
                campaign.isActive = false;
            }

            if (releaseAmount > 0) {
                releasedLocal[_id] += releaseAmount;
                usdc.safeTransfer(campaign.owner, releaseAmount);
            }
            emit MilestoneApproved(_id, _milestoneId, releaseAmount);
        } else {
            milestone.completed = false;
            milestone.approved = false;
            emit MilestoneRejected(_id, _milestoneId);
        }
    }

    function refund(uint256 _id) external campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(block.timestamp >= campaign.deadline || !campaign.isActive, "Campania inca ruleaza");
        require(!campaign.goalReached, "Goalul a fost atins");

        uint256 amount = donationsLocal[_id][msg.sender];
        require(amount > 0, "Nu ai donatii de returnat");

        donationsLocal[_id][msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit RefundIssued(_id, msg.sender, amount);
    }

    function getCampaign(uint256 _id) external view campaignExists(_id) returns (Campaign memory) {
        return campaigns[_id];
    }

    function getMilestone(uint256 _id, uint256 _milestoneId) external view campaignExists(_id) returns (Milestone memory) {
        require(_milestoneId < campaigns[_id].milestoneCount, "Milestone invalid");
        return milestones[_id][_milestoneId];
    }

    function getTotalRaised(uint256 _id) external view campaignExists(_id) returns (uint256) {
        Campaign storage campaign = campaigns[_id];
        return campaign.amountRaisedLocal + campaign.amountRaisedExternal;
    }

    function getVotingPower(uint256 _id, address _donor) public view campaignExists(_id) returns (uint256) {
        return donationsLocal[_id][_donor] + donationsExternalByDonor[_id][_donor];
    }

    function getExternalDonations(uint256 _id, string memory _chain) external view returns (uint256) {
        return externalDonations[_id][_chain];
    }

    function _checkGoal(Campaign storage campaign) internal {
        if (campaign.amountRaisedLocal + campaign.amountRaisedExternal >= campaign.totalGoal) {
            campaign.goalReached = true;
        }
    }

    function _getReleaseAmount(
        uint256 _id,
        Campaign storage campaign,
        uint256 milestoneAmount
    ) internal view returns (uint256) {
        uint256 unreleasedLocal = campaign.amountRaisedLocal - releasedLocal[_id];
        if (campaign.currentMilestone >= campaign.milestoneCount) {
            return unreleasedLocal;
        }
        return unreleasedLocal < milestoneAmount ? unreleasedLocal : milestoneAmount;
    }

    function _isAcceptedChain(string[] storage chains, string memory chain) internal view returns (bool) {
        bytes32 chainHash = keccak256(bytes(chain));
        for (uint256 i = 0; i < chains.length; i++) {
            if (keccak256(bytes(chains[i])) == chainHash) {
                return true;
            }
        }
        return false;
    }
}
