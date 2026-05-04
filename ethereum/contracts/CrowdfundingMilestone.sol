// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CrowdfundingMilestone {

    struct Milestone {
        string title;
        string description;
        uint256 amount;
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
        uint256 totalGoal;
        uint256 amountRaised;
        bool isActive;
        uint256 deadline;
        uint256 milestoneCount;
        uint256 currentMilestone;
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => mapping(address => uint256)) public donations;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVoted;
    uint256 public campaignCount;

    event CampaignCreated(uint256 indexed id, address owner, string title, uint256 goal);
    event DonationReceived(uint256 indexed id, address donor, uint256 amount);
    event MilestoneSubmitted(uint256 indexed campaignId, uint256 milestoneId);
    event VoteCast(uint256 indexed campaignId, uint256 milestoneId, address voter, bool vote);
    event MilestoneApproved(uint256 indexed campaignId, uint256 milestoneId, uint256 amount);
    event MilestoneRejected(uint256 indexed campaignId, uint256 milestoneId);
    event RefundIssued(uint256 indexed campaignId, address donor, uint256 amount);

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
        uint256 _durationDays,
        string[] memory _milestoneTitles,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestoneAmounts
    ) external returns (uint256) {
        require(_milestoneTitles.length >= 2, "Minim 2 milestone-uri");
        require(_milestoneTitles.length == _milestoneDescriptions.length, "Date invalide");
        require(_milestoneTitles.length == _milestoneAmounts.length, "Sume invalide");

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
                votingDeadline: 0,
                votingActive: false
            });
        }

        emit CampaignCreated(id, msg.sender, _title, totalGoal);
        return id;
    }

    function donate(uint256 _id) external payable campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(block.timestamp < campaign.deadline, "Campania a expirat");
        require(msg.value > 0, "Donatie invalida");

        donations[_id][msg.sender] += msg.value;
        campaign.amountRaised += msg.value;

        emit DonationReceived(_id, msg.sender, msg.value);
    }

    function submitMilestone(uint256 _id) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage campaign = campaigns[_id];
        require(campaign.isActive, "Campania nu este activa");
        require(campaign.amountRaised >= campaign.totalGoal, "Goalul nu a fost atins");

        uint256 milestoneId = campaign.currentMilestone;
        require(milestoneId < campaign.milestoneCount, "Toate milestone-urile completate");

        Milestone storage milestone = milestones[_id][milestoneId];
        require(!milestone.votingActive, "Votul este deja activ");
        require(!milestone.completed, "Milestone deja completat");

        milestone.votingActive = true;
        milestone.votingDeadline = block.timestamp + 3 days;

        emit MilestoneSubmitted(_id, milestoneId);
    }

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

    function finalizeMilestone(uint256 _id, uint256 _milestoneId) external campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        Milestone storage milestone = milestones[_id][_milestoneId];
        require(milestone.votingActive, "Votul nu este activ");
        require(
            block.timestamp >= milestone.votingDeadline ||
            milestone.votesFor + milestone.votesAgainst >= campaign.amountRaised,
            "Votul nu s-a incheiat"
        );

        milestone.votingActive = false;

        if (milestone.votesFor > milestone.votesAgainst) {
            milestone.completed = true;
            milestone.approved = true;
            campaign.currentMilestone++;

            (bool success, ) = payable(campaign.owner).call{value: milestone.amount}("");
            require(success, "Transfer esuat");

            emit MilestoneApproved(_id, _milestoneId, milestone.amount);

            if (campaign.currentMilestone >= campaign.milestoneCount) {
                campaign.isActive = false;
            }
        } else {
            milestone.completed = false;
            milestone.approved = false;
            emit MilestoneRejected(_id, _milestoneId);
        }
    }

    function refund(uint256 _id) external campaignExists(_id) {
        Campaign storage campaign = campaigns[_id];
        require(
            block.timestamp >= campaign.deadline && campaign.amountRaised < campaign.totalGoal,
            "Conditiile de refund nu sunt indeplinite"
        );

        uint256 amount = donations[_id][msg.sender];
        require(amount > 0, "Nu ai donatii de returnat");

        uint256 milestonesPaid = campaign.currentMilestone;
        uint256 paidAmount = 0;
        for (uint256 i = 0; i < milestonesPaid; i++) {
            paidAmount += milestones[_id][i].amount;
        }

        uint256 remainingRatio = (campaign.amountRaised - paidAmount) * 1e18 / campaign.amountRaised;
        uint256 refundAmount = amount * remainingRatio / 1e18;

        donations[_id][msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "Refund esuat");

        emit RefundIssued(_id, msg.sender, refundAmount);
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
