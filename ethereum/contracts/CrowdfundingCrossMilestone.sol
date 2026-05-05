// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CrowdfundingCrossMilestone {

    struct Milestone {
        string title;
        string description;
        uint256 amountUSD;
        bool completed;
        bool approved;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 votingDeadline;
        bool votingActive;
    }

    struct Campaign {
        address owner;
        string title;
        string description;
        uint256 goalUSD;
        uint256 amountRaisedETH;
        uint256 amountRaisedSOLusd;
        bool isActive;
        uint256 deadline;
        string solanaAddress;
        uint256 milestoneCount;
        uint256 currentMilestone;
        string primaryChain;
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => mapping(address => uint256)) public donations;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVoted;
    uint256 public campaignCount;

    event CampaignCreated(uint256 indexed id, address owner, string title, uint256 goalUSD);
    event DonationETH(uint256 indexed id, address donor, uint256 amount);
    event SolDonationRecorded(uint256 indexed id, uint256 amountUSD);
    event MilestoneSubmitted(uint256 indexed id, uint256 milestoneId);
    event VoteCast(uint256 indexed id, uint256 milestoneId, address voter, bool approve);
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
        require(_goalUSD > 0, "Goal invalid");

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

    function donateETH(uint256 _id) external payable campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(msg.value > 0, "Donatie invalida");

        donations[_id][msg.sender] += msg.value;
        campaign.amountRaisedETH += msg.value;

        emit DonationETH(_id, msg.sender, msg.value);
    }

    function recordSolDonation(uint256 _id, uint256 _amountUSD) external campaignExists(_id) onlyOwner(_id) {
        campaigns[_id].amountRaisedSOLusd += _amountUSD;
        emit SolDonationRecorded(_id, _amountUSD);
    }

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

    function finalizeMilestone(uint256 _id, uint256 _milestoneId) external campaignExists(_id) {
        Milestone storage milestone = milestones[_id][_milestoneId];
        require(milestone.votingActive, "Votul nu este activ");

        milestone.votingActive = false;

        if (milestone.votesFor > milestone.votesAgainst) {
            milestone.completed = true;
            milestone.approved = true;
            campaigns[_id].currentMilestone++;

            if (campaigns[_id].amountRaisedETH > 0) {
                uint256 share = campaigns[_id].amountRaisedETH / campaigns[_id].milestoneCount;
                (bool success, ) = payable(campaigns[_id].owner).call{value: share}("");
                require(success, "Transfer esuat");
            }

            if (campaigns[_id].currentMilestone >= campaigns[_id].milestoneCount) {
                campaigns[_id].isActive = false;
            }

            emit MilestoneApproved(_id, _milestoneId);
        } else {
            milestone.completed = false;
            milestone.approved = false;
            emit MilestoneRejected(_id, _milestoneId);
        }
    }

    function getCampaign(uint256 _id) external view campaignExists(_id) returns (Campaign memory) {
        return campaigns[_id];
    }

    function getMilestone(uint256 _id, uint256 _milestoneId) external view returns (Milestone memory) {
        return milestones[_id][_milestoneId];
    }

    function getDonation(uint256 _id, address _donor) external view returns (uint256) {
        return donations[_id][_donor];
    }
}
