// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./MusicToken.sol";
import "hardhat/console.sol";

/**
 * @title AIAgentRegistry
 * @dev A decentralized registry for AI music recommendation agents
 */
contract AIAgentRegistry is Ownable, ReentrancyGuard {
    IERC20 public musicToken;
    
    uint256 public constant MIN_STAKE_AMOUNT = 100 * 10**18; // 100 MUSIC tokens
    uint256 public constant CHALLENGE_PERIOD = 3 days;
    uint256 public constant REWARD_PERCENTAGE = 70; // 70% goes to winners, 30% to voters
    
    // Simplified on-chain feedback stats
    struct AIAgent {
        string metadata;        // IPFS hash containing agent details
        uint256 stake;
        bool isListed;
        uint256 challengeEndTime;
        address challenger;
        uint256 challengeStake;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 totalVoterStakes;
        address[] supportVoters;
        address[] againstVoters;
        // Simplified feedback tracking
        uint256 totalRatingPoints;  // Sum of all ratings (1-5)
        uint256 totalFeedbacks;     // Count of feedbacks
        uint256 positiveAlignments; // Count of strategy-aligned feedbacks
    }
    
    // Feedback event with detailed data
    event FeedbackSubmitted(
        address indexed modelAddress,
        bool alignsWithStrategy,
        uint8 rating,
        string comment,        // Direct comment text
        uint256 timestamp
    );

    mapping(address => AIAgent) public aiAgents;
    mapping(address => mapping(address => bool)) public hasVoted;
    mapping(address => mapping(address => uint256)) public voterStakes;
    mapping(address => string) public agentStrategies; // modelAddress => strategy string
    mapping(address => mapping(address => uint256)) public lastFeedbackTime;
    
    // Updated events
    event AgentSubmitted(address modelAddress, uint256 stake, string metadata, string strategy);
    event AgentChallenged(address indexed modelAddress, address challenger, uint256 stake);
    event VoteCast(address indexed modelAddress, address voter, bool support, uint256 stake);
    event ChallengeResolved(address indexed modelAddress, bool accepted, uint256 winnerReward, uint256 voterRewards);
    event StakeIncreased(address indexed modelAddress, uint256 additionalStake);
    event StrategyUpdated(
        address indexed modelAddress,
        string newStrategy
    );
    
    constructor(address _musicToken) {
        musicToken = IERC20(_musicToken);
    }
    
    function submitAgent(
        string memory metadata, 
        string memory strategy,
        uint256 stake
    ) 
        external 
        nonReentrant 
    {
        require(stake >= MIN_STAKE_AMOUNT, "Insufficient stake");
        require(!aiAgents[msg.sender].isListed, "Agent already exists");
        require(bytes(metadata).length > 0, "Metadata required");
        require(bytes(strategy).length > 0, "Strategy required");
        
        musicToken.transferFrom(msg.sender, address(this), stake);
        
        aiAgents[msg.sender] = AIAgent({
            metadata: metadata,
            stake: stake,
            isListed: true,
            challengeEndTime: 0,
            challenger: address(0),
            challengeStake: 0,
            votesFor: 0,
            votesAgainst: 0,
            totalVoterStakes: 0,
            supportVoters: new address[](0),
            againstVoters: new address[](0),
            totalRatingPoints: 0,
            totalFeedbacks: 0,
            positiveAlignments: 0
        });

        agentStrategies[msg.sender] = strategy;
        console.log("Agent submitted by address: %s", msg.sender);
        console.log("Strategy: %s", strategy);
        emit AgentSubmitted(msg.sender, stake, metadata, strategy);
    }
    
    function challengeAgent(address modelAddress, uint256 stake) 
        external 
        nonReentrant 
    {
        require(aiAgents[modelAddress].isListed, "Agent not listed");
        require(stake >= MIN_STAKE_AMOUNT, "Insufficient challenge stake");
        require(aiAgents[modelAddress].challengeEndTime == 0, "Already challenged");
        
        musicToken.transferFrom(msg.sender, address(this), stake);
        
        AIAgent storage agent = aiAgents[modelAddress];
        agent.challenger = msg.sender;
        agent.challengeStake = stake;
        agent.challengeEndTime = block.timestamp + CHALLENGE_PERIOD;
        
        emit AgentChallenged(modelAddress, msg.sender, stake);
    }
    
    function vote(address modelAddress, bool support, uint256 stake) 
        external 
        nonReentrant 
    {
        AIAgent storage agent = aiAgents[modelAddress];
        require(agent.challengeEndTime > 0, "No active challenge");
        require(block.timestamp < agent.challengeEndTime, "Challenge period ended");
        require(!hasVoted[modelAddress][msg.sender], "Already voted");
        require(stake > 0, "Stake must be positive");
        
        musicToken.transferFrom(msg.sender, address(this), stake);
        
        if (support) {
            agent.votesFor += stake;
            agent.supportVoters.push(msg.sender);
        } else {
            agent.votesAgainst += stake;
            agent.againstVoters.push(msg.sender);
        }
        
        agent.totalVoterStakes += stake;
        hasVoted[modelAddress][msg.sender] = true;
        voterStakes[modelAddress][msg.sender] = stake;
        
        emit VoteCast(modelAddress, msg.sender, support, stake);
    }
    
    function resolveChallenge(address modelAddress) 
        external 
        nonReentrant 
    {
        AIAgent storage agent = aiAgents[modelAddress];
        require(agent.challengeEndTime > 0, "No challenge exists");
        require(block.timestamp >= agent.challengeEndTime, "Challenge period not ended");
        
        bool challengeSucceeded = agent.votesAgainst > agent.votesFor;
        uint256 totalStake = agent.stake + agent.challengeStake;
        uint256 winnerReward = (totalStake * REWARD_PERCENTAGE) / 100;
        uint256 voterRewards = totalStake - winnerReward;
        
        // Distribute rewards
        if (challengeSucceeded) {
            musicToken.transfer(agent.challenger, winnerReward);
            distributeVoterRewards(modelAddress, false, voterRewards);
            agent.isListed = false;
        } else {
            musicToken.transfer(modelAddress, winnerReward);
            distributeVoterRewards(modelAddress, true, voterRewards);
        }
        
        // Clear all voter data
        for (uint i = 0; i < agent.supportVoters.length; i++) {
            clearVoterData(modelAddress, agent.supportVoters[i]);
        }
        for (uint i = 0; i < agent.againstVoters.length; i++) {
            clearVoterData(modelAddress, agent.againstVoters[i]);
        }
        
        // Reset challenge data
        agent.challengeEndTime = 0;
        agent.challenger = address(0);
        agent.challengeStake = 0;
        agent.votesFor = 0;
        agent.votesAgainst = 0;
        agent.totalVoterStakes = 0;
        delete agent.supportVoters;
        delete agent.againstVoters;
        
        emit ChallengeResolved(modelAddress, !challengeSucceeded, winnerReward, voterRewards);
    }
    
    function increaseStake(uint256 additionalStake) 
        external 
        nonReentrant 
    {
        AIAgent storage agent = aiAgents[msg.sender];
        require(agent.isListed, "Agent not listed");
        require(agent.challengeEndTime == 0, "Cannot increase stake during challenge");
        
        musicToken.transferFrom(msg.sender, address(this), additionalStake);
        agent.stake += additionalStake;
        
        emit StakeIncreased(msg.sender, additionalStake);
    }
    
    function distributeVoterRewards(address modelAddress, bool forWinners, uint256 rewardPool) 
        private 
    {
        AIAgent storage agent = aiAgents[modelAddress];
        uint256 winningVotes = forWinners ? agent.votesFor : agent.votesAgainst;
        address[] storage voters = forWinners ? agent.supportVoters : agent.againstVoters;
        
        if (winningVotes > 0) {
            // For each voter, calculate their proportion of winning votes
            for (uint i = 0; i < voters.length; i++) {
                address voter = voters[i];
                uint256 voterStake = voterStakes[modelAddress][voter];
                
                // Calculate reward: (voter's stake / total winning votes) * reward pool
                uint256 reward = (voterStake * rewardPool) / winningVotes;
                if (reward > 0) {
                    musicToken.transfer(voter, reward);
                }
            }
        }
    }
    
    // View functions
    function getAgent(address modelAddress) 
        external 
        view 
        returns (
            string memory metadata,
            uint256 stake,
            bool isListed,
            uint256 challengeEndTime,
            address challenger,
            uint256 challengeStake,
            uint256 votesFor,
            uint256 votesAgainst
        ) 
    {
        AIAgent storage agent = aiAgents[modelAddress];
        return (
            agent.metadata,
            agent.stake,
            agent.isListed,
            agent.challengeEndTime,
            agent.challenger,
            agent.challengeStake,
            agent.votesFor,
            agent.votesAgainst
        );
    }

    // Add new function to help clear voter data
    function clearVoterData(address modelAddress, address voter) private {
        hasVoted[modelAddress][voter] = false;
        voterStakes[modelAddress][voter] = 0;
    }

    function submitFeedback(
        bool alignsWithStrategy,
        uint8 rating,
        string memory comment    // Direct comment text
    ) 
        external 
        nonReentrant 
    {
        require(aiAgents[msg.sender].isListed, "Agent not listed");
        require(rating >= 1 && rating <= 5, "Invalid rating range");
        
        AIAgent storage agent = aiAgents[msg.sender];
        
        // Update minimal on-chain stats
        agent.totalFeedbacks++;
        agent.totalRatingPoints += rating;
        if (alignsWithStrategy) {
            agent.positiveAlignments++;
        }
                
        // Emit event with full feedback data including direct comment
        emit FeedbackSubmitted(
            msg.sender,
            alignsWithStrategy,
            rating,
            comment,
            block.timestamp
        );
    }

    // Updated view function for agent stats
    function getAgentStats(address modelAddress) 
        external 
        view 
        returns (
            uint256 totalFeedbacks,
            uint256 positiveAlignments,
            uint256 averageRating  // Scaled by 100
        ) 
    {
        AIAgent storage agent = aiAgents[modelAddress];
        uint256 avgRating = agent.totalFeedbacks > 0 
            ? (agent.totalRatingPoints * 100) / agent.totalFeedbacks 
            : 0;
            
        return (
            agent.totalFeedbacks,
            agent.positiveAlignments,
            avgRating
        );
    }

    function getAgentStrategy(address modelAddress) 
        external 
        view 
        returns (string memory) 
    {
        return agentStrategies[modelAddress];
    }

    function updateAgentStrategy(address modelAddress, string memory strategy) 
        external 
    {
        AIAgent storage agent = aiAgents[modelAddress];
        require(agent.isListed, "Agent not listed");
        require(modelAddress == msg.sender || msg.sender == owner(), "Only agent or governance can update strategy");
        
        agentStrategies[modelAddress] = strategy;
        emit StrategyUpdated(modelAddress, strategy);
    }
}