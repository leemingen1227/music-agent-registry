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
        address owner;
        string modelHash;
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
        string initialStrategy;  // IPFS hash of initial strategy
        // Simplified feedback tracking
        uint256 totalRatingPoints;  // Sum of all ratings (1-5)
        uint256 totalFeedbacks;     // Count of feedbacks
        uint256 positiveAlignments; // Count of strategy-aligned feedbacks
    }
    
    // Feedback event with detailed data
    event FeedbackSubmitted(
        string indexed modelHash,
        address indexed user,
        bool alignsWithStrategy,
        uint8 rating,
        string comment,        // Direct comment text
        uint256 timestamp
    );

    mapping(string => AIAgent) public aiAgents;
    mapping(string => mapping(address => bool)) public hasVoted;
    mapping(string => mapping(address => uint256)) public voterStakes;
    mapping(string => string) public agentStrategies; // modelHash => IPFS strategy hash
    mapping(string => mapping(address => uint256)) public lastFeedbackTime;
    
    // Updated events
    event AgentSubmitted(string modelHash, address owner, uint256 stake, string metadata);
    event AgentChallenged(string indexed modelHash, address challenger, uint256 stake);
    event VoteCast(string indexed modelHash, address voter, bool support, uint256 stake);
    event ChallengeResolved(string indexed modelHash, bool accepted, uint256 winnerReward, uint256 voterRewards);
    event StakeIncreased(string indexed modelHash, uint256 additionalStake);
    event StrategyUpdated(
        string indexed modelHash,
        string newStrategyHash
    );

    uint256 public constant FEEDBACK_COOLDOWN = 1 days;  // Minimum time between feedbacks from same user
    
    constructor(address _musicToken) {
        musicToken = IERC20(_musicToken);
    }
    
    function submitAgent(
        string memory modelHash, 
        string memory metadata, 
        string memory initialStrategy,
        uint256 stake
    ) 
        external 
        nonReentrant 
    {
        require(stake >= MIN_STAKE_AMOUNT, "Insufficient stake");
        require(!aiAgents[modelHash].isListed, "Agent already exists");
        require(bytes(metadata).length > 0, "Metadata required");
        require(bytes(initialStrategy).length > 0, "Initial strategy required");
        
        musicToken.transferFrom(msg.sender, address(this), stake);
        
        aiAgents[modelHash] = AIAgent({
            owner: msg.sender,
            modelHash: modelHash,
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
            initialStrategy: initialStrategy,
            totalRatingPoints: 0,
            totalFeedbacks: 0,
            positiveAlignments: 0
        });

        agentStrategies[modelHash] = initialStrategy;
        console.log("Agent submitted: %s", modelHash);
        console.log("Initial strategy: %s", initialStrategy);
        emit AgentSubmitted(modelHash, msg.sender, stake, metadata);
        emit StrategyUpdated(modelHash, initialStrategy);
    }
    
    function challengeAgent(string memory modelHash, uint256 stake) 
        external 
        nonReentrant 
    {
        require(aiAgents[modelHash].isListed, "Agent not listed");
        require(stake >= MIN_STAKE_AMOUNT, "Insufficient challenge stake");
        require(aiAgents[modelHash].challengeEndTime == 0, "Already challenged");
        
        musicToken.transferFrom(msg.sender, address(this), stake);
        
        AIAgent storage agent = aiAgents[modelHash];
        agent.challenger = msg.sender;
        agent.challengeStake = stake;
        agent.challengeEndTime = block.timestamp + CHALLENGE_PERIOD;
        
        emit AgentChallenged(modelHash, msg.sender, stake);
    }
    
    function vote(string memory modelHash, bool support, uint256 stake) 
        external 
        nonReentrant 
    {
        AIAgent storage agent = aiAgents[modelHash];
        require(agent.challengeEndTime > 0, "No active challenge");
        require(block.timestamp < agent.challengeEndTime, "Challenge period ended");
        require(!hasVoted[modelHash][msg.sender], "Already voted");
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
        hasVoted[modelHash][msg.sender] = true;
        voterStakes[modelHash][msg.sender] = stake;
        
        emit VoteCast(modelHash, msg.sender, support, stake);
    }
    
    function resolveChallenge(string memory modelHash) 
        external 
        nonReentrant 
    {
        AIAgent storage agent = aiAgents[modelHash];
        require(agent.challengeEndTime > 0, "No challenge exists");
        require(block.timestamp >= agent.challengeEndTime, "Challenge period not ended");
        
        bool challengeSucceeded = agent.votesAgainst > agent.votesFor;
        uint256 totalStake = agent.stake + agent.challengeStake;
        uint256 winnerReward = (totalStake * REWARD_PERCENTAGE) / 100;
        uint256 voterRewards = totalStake - winnerReward;
        
        // Distribute rewards
        if (challengeSucceeded) {
            musicToken.transfer(agent.challenger, winnerReward);
            distributeVoterRewards(modelHash, false, voterRewards);
            agent.isListed = false;
        } else {
            musicToken.transfer(agent.owner, winnerReward);
            distributeVoterRewards(modelHash, true, voterRewards);
        }
        
        // Clear all voter data
        for (uint i = 0; i < agent.supportVoters.length; i++) {
            clearVoterData(modelHash, agent.supportVoters[i]);
        }
        for (uint i = 0; i < agent.againstVoters.length; i++) {
            clearVoterData(modelHash, agent.againstVoters[i]);
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
        
        emit ChallengeResolved(modelHash, !challengeSucceeded, winnerReward, voterRewards);
    }
    
    function increaseStake(string memory modelHash, uint256 additionalStake) 
        external 
        nonReentrant 
    {
        AIAgent storage agent = aiAgents[modelHash];
        require(agent.isListed, "Agent not listed");
        require(msg.sender == agent.owner, "Not agent owner");
        require(agent.challengeEndTime == 0, "Cannot increase stake during challenge");
        
        musicToken.transferFrom(msg.sender, address(this), additionalStake);
        agent.stake += additionalStake;
        
        emit StakeIncreased(modelHash, additionalStake);
    }
    
    function distributeVoterRewards(string memory modelHash, bool forWinners, uint256 rewardPool) 
        private 
    {
        AIAgent storage agent = aiAgents[modelHash];
        uint256 winningVotes = forWinners ? agent.votesFor : agent.votesAgainst;
        address[] storage voters = forWinners ? agent.supportVoters : agent.againstVoters;
        
        if (winningVotes > 0) {
            // For each voter, calculate their proportion of winning votes
            for (uint i = 0; i < voters.length; i++) {
                address voter = voters[i];
                uint256 voterStake = voterStakes[modelHash][voter];
                
                // Calculate reward: (voter's stake / total winning votes) * reward pool
                uint256 reward = (voterStake * rewardPool) / winningVotes;
                if (reward > 0) {
                    musicToken.transfer(voter, reward);
                }
            }
        }
    }
    
    // View functions
    function getAgent(string memory modelHash) 
        external 
        view 
        returns (
            address owner,
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
        AIAgent storage agent = aiAgents[modelHash];
        return (
            agent.owner,
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
    function clearVoterData(string memory modelHash, address voter) private {
        hasVoted[modelHash][voter] = false;
        voterStakes[modelHash][voter] = 0;
    }

    function submitFeedback(
        string memory modelHash,
        bool alignsWithStrategy,
        uint8 rating,
        string memory comment    // Direct comment text
    ) 
        external 
        nonReentrant 
    {
        require(aiAgents[modelHash].isListed, "Agent not listed");
        require(rating >= 1 && rating <= 5, "Invalid rating range");
        require(
            block.timestamp >= lastFeedbackTime[modelHash][msg.sender] + FEEDBACK_COOLDOWN,
            "Please wait before submitting another feedback"
        );
        
        AIAgent storage agent = aiAgents[modelHash];
        
        // Update minimal on-chain stats
        agent.totalFeedbacks++;
        agent.totalRatingPoints += rating;
        if (alignsWithStrategy) {
            agent.positiveAlignments++;
        }
        
        lastFeedbackTime[modelHash][msg.sender] = block.timestamp;
        
        // Emit event with full feedback data including direct comment
        emit FeedbackSubmitted(
            modelHash,
            msg.sender,
            alignsWithStrategy,
            rating,
            comment,
            block.timestamp
        );
    }

    // Updated view function for agent stats
    function getAgentStats(string memory modelHash) 
        external 
        view 
        returns (
            uint256 totalFeedbacks,
            uint256 positiveAlignments,
            uint256 averageRating  // Scaled by 100
        ) 
    {
        AIAgent storage agent = aiAgents[modelHash];
        uint256 avgRating = agent.totalFeedbacks > 0 
            ? (agent.totalRatingPoints * 100) / agent.totalFeedbacks 
            : 0;
            
        return (
            agent.totalFeedbacks,
            agent.positiveAlignments,
            avgRating
        );
    }

    function getAgentStrategy(string memory modelHash) 
        external 
        view 
        returns (string memory) 
    {
        return agentStrategies[modelHash];
    }

    function updateAgentStrategy(string memory modelHash, string memory strategyHash) 
        external 
    {
        AIAgent storage agent = aiAgents[modelHash];
        require(agent.isListed, "Agent not listed");
        // Only allow updates from governance contract
        require(msg.sender == owner(), "Only governance can update strategy");
        
        agentStrategies[modelHash] = strategyHash;
        emit StrategyUpdated(modelHash, strategyHash);
    }
}