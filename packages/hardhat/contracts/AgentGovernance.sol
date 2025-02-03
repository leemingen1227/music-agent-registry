// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IAIAgentRegistry {
    function aiAgents(string memory) external view returns (
        address owner,
        string memory modelHash,
        string memory metadata,
        uint256 stake,
        bool isListed,
        uint256 challengeEndTime,
        address challenger,
        uint256 challengeStake,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 totalVoterStakes
    );

    function updateAgentStrategy(string memory modelHash, string memory strategyHash) external;
}

contract AgentGovernance is Ownable, ReentrancyGuard {
    IERC20 public musicToken;
    IAIAgentRegistry public agentRegistry;
    
    struct Proposal {
        uint256 id;
        address proposer;
        string agentHash;          // Which agent to modify
        string description;        // e.g., "recommend more rnb music"
        string ipfsMetadata;       // Additional details about the proposal
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        string newStrategyHash;    // IPFS hash of the new strategy
        ProposalType proposalType; // Type of proposal
        mapping(address => bool) hasVoted;
    }
    
    enum ProposalType {
        GENERAL,
        STRATEGY_UPDATE
    }
    
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant MIN_TOKENS_TO_PROPOSE = 100 * 10**18; // 100 tokens
    
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    
    event ProposalCreated(
        uint256 indexed proposalId,
        string agentHash,
        string description,
        address proposer
    );
    event VoteCast(
        uint256 indexed proposalId,
        address voter,
        bool support
    );
    event ProposalExecuted(
        uint256 indexed proposalId,
        string agentHash,
        bool accepted
    );
    
    constructor(address _musicToken, address _agentRegistry) {
        musicToken = IERC20(_musicToken);
        agentRegistry = IAIAgentRegistry(_agentRegistry);
    }
    
    function createProposal(
        string memory agentHash,
        string memory description,
        string memory ipfsMetadata
    ) external nonReentrant {
        require(
            musicToken.balanceOf(msg.sender) >= MIN_TOKENS_TO_PROPOSE,
            "Not enough tokens to propose"
        );
        
        // Check if agent exists and is listed in the TCR
        (,,,, bool isListed,,,,,,) = agentRegistry.aiAgents(agentHash);
        require(isListed, "Agent not listed in TCR");
        
        proposalCount++;
        Proposal storage proposal = proposals[proposalCount];
        
        proposal.id = proposalCount;
        proposal.proposer = msg.sender;
        proposal.agentHash = agentHash;
        proposal.description = description;
        proposal.ipfsMetadata = ipfsMetadata;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + VOTING_PERIOD;
        
        emit ProposalCreated(
            proposalCount,
            agentHash,
            description,
            msg.sender
        );
    }
    
    function createStrategyProposal(
        string memory agentHash,
        string memory description,
        string memory ipfsMetadata,
        string memory newStrategyHash
    ) external nonReentrant {
        require(
            musicToken.balanceOf(msg.sender) >= MIN_TOKENS_TO_PROPOSE,
            "Not enough tokens to propose"
        );
        
        // Check if agent exists and is listed in the TCR
        (,,,, bool isListed,,,,,,) = agentRegistry.aiAgents(agentHash);
        require(isListed, "Agent not listed in TCR");
        
        proposalCount++;
        Proposal storage proposal = proposals[proposalCount];
        
        proposal.id = proposalCount;
        proposal.proposer = msg.sender;
        proposal.agentHash = agentHash;
        proposal.description = description;
        proposal.ipfsMetadata = ipfsMetadata;
        proposal.newStrategyHash = newStrategyHash;
        proposal.proposalType = ProposalType.STRATEGY_UPDATE;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + VOTING_PERIOD;
        
        emit ProposalCreated(
            proposalCount,
            agentHash,
            description,
            msg.sender
        );
    }
    
    function vote(uint256 proposalId, bool support) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        // Check if agent is still listed when voting
        (,,,, bool isListed,,,,,,) = agentRegistry.aiAgents(proposal.agentHash);
        require(isListed, "Agent no longer listed in TCR");
        
        uint256 voterPower = musicToken.balanceOf(msg.sender);
        require(voterPower > 0, "No voting power");
        
        if (support) {
            proposal.votesFor += voterPower;
        } else {
            proposal.votesAgainst += voterPower;
        }
        
        proposal.hasVoted[msg.sender] = true;
        
        emit VoteCast(proposalId, msg.sender, support);
    }
    
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        
        require(block.timestamp > proposal.endTime, "Voting still active");
        require(!proposal.executed, "Already executed");
        
        // Check if agent is still listed when executing
        (,,,, bool isListed,,,,,,) = agentRegistry.aiAgents(proposal.agentHash);
        require(isListed, "Agent no longer listed in TCR");
        
        bool accepted = proposal.votesFor > proposal.votesAgainst;
        proposal.executed = true;

        if (accepted && proposal.proposalType == ProposalType.STRATEGY_UPDATE) {
            // Update the agent's strategy if proposal is accepted
             IAIAgentRegistry(address(agentRegistry)).updateAgentStrategy(
                proposal.agentHash,
                proposal.newStrategyHash
            );
        }
        
        emit ProposalExecuted(proposalId, proposal.agentHash, accepted);
    }
    
    // View functions
    function getProposal(uint256 proposalId) external view returns (
        address proposer,
        string memory agentHash,
        string memory description,
        string memory ipfsMetadata,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 endTime,
        bool executed
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.agentHash,
            proposal.description,
            proposal.ipfsMetadata,
            proposal.votesFor,
            proposal.votesAgainst,
            proposal.endTime,
            proposal.executed
        );
    }
    
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }
}