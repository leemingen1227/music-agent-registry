// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IAIAgentRegistry {
    function aiAgents(address) external view returns (
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

    function updateAgentStrategy(address modelAddress, string memory strategy) external;
}

contract AgentGovernance is Ownable, ReentrancyGuard {
    IERC20 public musicToken;
    IAIAgentRegistry public agentRegistry;
    
    struct Proposal {
        uint256 id;
        address proposer;
        address agentAddress;      // Which agent to modify
        string description;        // e.g., "recommend more rnb music"
        string ipfsMetadata;       // Additional details about the proposal
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        string newStrategy;        // New strategy string
        mapping(address => bool) hasVoted;
    }
    
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant MIN_TOKENS_TO_PROPOSE = 100 * 10**18; // 100 tokens
    
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    
    event ProposalCreated(
        uint256 indexed proposalId,
        address agentAddress,
        string description,
        string newStrategy,
        address proposer
    );
    event VoteCast(
        uint256 indexed proposalId,
        address voter,
        bool support
    );
    event ProposalExecuted(
        uint256 indexed proposalId,
        address agentAddress,
        bool accepted
    );
    
    constructor(address _musicToken, address _agentRegistry) {
        musicToken = IERC20(_musicToken);
        agentRegistry = IAIAgentRegistry(_agentRegistry);
    }
    
    function createProposal(
        address agentAddress,
        string memory description,
        string memory ipfsMetadata,
        string memory newStrategy
    ) external nonReentrant {
        require(
            musicToken.balanceOf(msg.sender) >= MIN_TOKENS_TO_PROPOSE,
            "Not enough tokens to propose"
        );
        
        // Check if agent exists and is listed in the TCR
        (,, bool isListed,,,,,,) = agentRegistry.aiAgents(agentAddress);
        require(isListed, "Agent not listed in TCR");
        require(bytes(newStrategy).length > 0, "Strategy required");
        
        proposalCount++;
        Proposal storage proposal = proposals[proposalCount];
        
        proposal.id = proposalCount;
        proposal.proposer = msg.sender;
        proposal.agentAddress = agentAddress;
        proposal.description = description;
        proposal.ipfsMetadata = ipfsMetadata;
        proposal.newStrategy = newStrategy;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + VOTING_PERIOD;
        
        emit ProposalCreated(
            proposalCount,
            agentAddress,
            description,
            newStrategy,
            msg.sender
        );
    }
    
    function vote(uint256 proposalId, bool support) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        // Check if agent is still listed when voting
        (,, bool isListed,,,,,,) = agentRegistry.aiAgents(proposal.agentAddress);
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
        (,, bool isListed,,,,,,) = agentRegistry.aiAgents(proposal.agentAddress);
        require(isListed, "Agent no longer listed in TCR");
        
        bool accepted = proposal.votesFor > proposal.votesAgainst;
        proposal.executed = true;

        if (accepted) {
            // Update the agent's strategy if proposal is accepted
            agentRegistry.updateAgentStrategy(
                proposal.agentAddress,
                proposal.newStrategy
            );
        }
        
        emit ProposalExecuted(proposalId, proposal.agentAddress, accepted);
    }
    
    // View functions
    function getProposal(uint256 proposalId) external view returns (
        address proposer,
        address agentAddress,
        string memory description,
        string memory ipfsMetadata,
        string memory newStrategy,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 endTime,
        bool executed
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.agentAddress,
            proposal.description,
            proposal.ipfsMetadata,
            proposal.newStrategy,
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