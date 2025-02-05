import { expect } from "chai";
import { ethers } from "hardhat";
import { AIAgentRegistry, MusicToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("AIAgentRegistry", function () {
  let aiAgentRegistry: AIAgentRegistry;
  let musicToken: MusicToken;
  let deployer: HardhatEthersSigner;
  let agent1: HardhatEthersSigner;
  let agent2: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let user4: HardhatEthersSigner;
  let user5: HardhatEthersSigner;

  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens
  const MIN_STAKE = ethers.parseEther("100"); // 100 tokens
  const CHALLENGE_PERIOD = 3 * 24 * 60 * 60; // 3 days in seconds

  async function deployNewInstance() {
    before("Deploying fresh contracts", async function () {
      console.log("\t", "🛫 Deploying new contracts...");

      const MusicTokenFactory = await ethers.getContractFactory("MusicToken");
      musicToken = await MusicTokenFactory.deploy(INITIAL_SUPPLY);

      const AIAgentRegistryFactory = await ethers.getContractFactory("AIAgentRegistry");
      aiAgentRegistry = await AIAgentRegistryFactory.deploy(await musicToken.getAddress());

      [deployer, agent1, agent2, user1, user2, user3, user4, user5] = await ethers.getSigners();

      // Transfer tokens to users for testing
      await musicToken.transfer(agent1.address, ethers.parseEther("10000"));
      await musicToken.transfer(agent2.address, ethers.parseEther("10000"));
      await musicToken.transfer(user1.address, ethers.parseEther("10000"));
      await musicToken.transfer(user2.address, ethers.parseEther("10000"));
      await musicToken.transfer(user3.address, ethers.parseEther("10000"));
      await musicToken.transfer(user4.address, ethers.parseEther("10000"));
      await musicToken.transfer(user5.address, ethers.parseEther("10000"));

      // Approve registry to spend tokens
      await musicToken.connect(agent1).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
      await musicToken.connect(agent2).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
      await musicToken.connect(user1).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
      await musicToken.connect(user2).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
      await musicToken.connect(user3).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
      await musicToken.connect(user4).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
      await musicToken.connect(user5).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
    });
  }

  // Quick fix to let gas reporter fetch data from gas station & coinmarketcap
  before(done => {
    setTimeout(done, 2000);
  });

  describe("Agent Submission and Listing", function () {
    deployNewInstance();

    it("Should allow submitting a new agent with sufficient stake", async function () {
      console.log("\t", "📝 Submitting new agent...");
      const tx = await aiAgentRegistry.connect(agent1).submitAgent("metadata1", "strategy1", MIN_STAKE);

      const agent = await aiAgentRegistry.aiAgents(agent1.address);
      console.log("\t", "✅ Verifying agent details...");
      expect(agent.isListed).to.be.true;
      expect(agent.metadata).to.equal("metadata1");
      expect(await aiAgentRegistry.agentStrategies(agent1.address)).to.equal("strategy1");

      await expect(tx)
        .to.emit(aiAgentRegistry, "AgentSubmitted")
        .withArgs(agent1.address, MIN_STAKE, "metadata1", "strategy1");
    });

    it("Should fail when stake is insufficient", async function () {
      console.log("\t", "❌ Testing insufficient stake...");
      await expect(
        aiAgentRegistry.connect(agent2).submitAgent(
          "metadata2",
          "strategy2",
          ethers.parseEther("99"), // Less than MIN_STAKE
        ),
      ).to.be.revertedWith("Insufficient stake");
    });
  });

  describe("Challenge Mechanism", function () {
    deployNewInstance();

    before(async function () {
      console.log("\t", "🎯 Setting up test agent...");
      await aiAgentRegistry.connect(agent1).submitAgent("metadata1", "strategy1", MIN_STAKE);
    });

    it("Should allow user to challenge a listed agent", async function () {
      console.log("\t", "🤺 Challenging agent...");
      const tx = await aiAgentRegistry.connect(user1).challengeAgent(agent1.address, MIN_STAKE);

      const agent = await aiAgentRegistry.aiAgents(agent1.address);
      expect(agent.challenger).to.equal(user1.address);
      expect(agent.challengeStake).to.equal(MIN_STAKE);
      expect(agent.challengeEndTime).to.be.gt(0);

      await expect(tx).to.emit(aiAgentRegistry, "AgentChallenged").withArgs(agent1.address, user1.address, MIN_STAKE);

      // Verify can't challenge again while challenge is active
      await expect(aiAgentRegistry.connect(user2).challengeAgent(agent1.address, MIN_STAKE)).to.be.revertedWith(
        "Already challenged",
      );
    });

    it("Should allow multiple users to vote during challenge period", async function () {
      console.log("\t", "🗳️ Testing voting mechanism with multiple users...");

      // Users voting against
      const voteAgainst1 = await aiAgentRegistry.connect(user2).vote(agent1.address, false, MIN_STAKE);
      const voteAgainst2 = await aiAgentRegistry.connect(user3).vote(agent1.address, false, MIN_STAKE * 2n);

      // Users voting for
      const voteFor1 = await aiAgentRegistry.connect(user4).vote(agent1.address, true, MIN_STAKE);
      const voteFor2 = await aiAgentRegistry.connect(user5).vote(agent1.address, true, MIN_STAKE * 3n);

      const agent = await aiAgentRegistry.aiAgents(agent1.address);
      expect(agent.votesAgainst).to.equal(MIN_STAKE * 3n); // 1x + 2x stakes
      expect(agent.votesFor).to.equal(MIN_STAKE * 4n); // 1x + 3x stakes
      expect(agent.totalVoterStakes).to.equal(MIN_STAKE * 7n); // Total 7x stakes

      // Verify vote events
      await expect(voteAgainst1)
        .to.emit(aiAgentRegistry, "VoteCast")
        .withArgs(agent1.address, user2.address, false, MIN_STAKE);
      await expect(voteAgainst2)
        .to.emit(aiAgentRegistry, "VoteCast")
        .withArgs(agent1.address, user3.address, false, MIN_STAKE * 2n);
      await expect(voteFor1)
        .to.emit(aiAgentRegistry, "VoteCast")
        .withArgs(agent1.address, user4.address, true, MIN_STAKE);
      await expect(voteFor2)
        .to.emit(aiAgentRegistry, "VoteCast")
        .withArgs(agent1.address, user5.address, true, MIN_STAKE * 3n);

      // Verify same user can't vote twice
      await expect(aiAgentRegistry.connect(user2).vote(agent1.address, false, MIN_STAKE)).to.be.revertedWith(
        "Already voted",
      );
    });

    it("Should track voting stakes correctly for multiple users", async function () {
      console.log("\t", "💰 Testing vote stake tracking for multiple users...");

      // Verify individual stakes
      expect(await aiAgentRegistry.voterStakes(agent1.address, user2.address)).to.equal(MIN_STAKE);
      expect(await aiAgentRegistry.voterStakes(agent1.address, user3.address)).to.equal(MIN_STAKE * 2n);
      expect(await aiAgentRegistry.voterStakes(agent1.address, user4.address)).to.equal(MIN_STAKE);
      expect(await aiAgentRegistry.voterStakes(agent1.address, user5.address)).to.equal(MIN_STAKE * 3n);

      // Verify all users have voted
      expect(await aiAgentRegistry.hasVoted(agent1.address, user2.address)).to.be.true;
      expect(await aiAgentRegistry.hasVoted(agent1.address, user3.address)).to.be.true;
      expect(await aiAgentRegistry.hasVoted(agent1.address, user4.address)).to.be.true;
      expect(await aiAgentRegistry.hasVoted(agent1.address, user5.address)).to.be.true;
    });

    it("Should distribute rewards correctly after challenge resolution", async function () {
      console.log("\t", "💸 Testing reward distribution for multiple users...");

      // Get initial balances
      const challenger_balance_before = await musicToken.balanceOf(user1.address);
      const voter_balances_before = await Promise.all([
        musicToken.balanceOf(user2.address),
        musicToken.balanceOf(user3.address),
        musicToken.balanceOf(user4.address),
        musicToken.balanceOf(user5.address),
      ]);

      // Fast forward time to end challenge period
      await ethers.provider.send("evm_increaseTime", [CHALLENGE_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);

      // Resolve challenge
      const tx = await aiAgentRegistry.resolveChallenge(agent1.address);

      // Get final balances
      const challenger_balance_after = await musicToken.balanceOf(user1.address);
      const voter_balances_after = await Promise.all([
        musicToken.balanceOf(user2.address),
        musicToken.balanceOf(user3.address),
        musicToken.balanceOf(user4.address),
        musicToken.balanceOf(user5.address),
      ]);

      // Calculate expected rewards
      const totalStake = MIN_STAKE * 2n; // agent stake + challenger stake
      const winnerReward = (totalStake * 70n) / 100n; // 70% to winner
      const voterRewards = totalStake - winnerReward; // 30% to voters

      // Since votesFor (4x) > votesAgainst (3x), the agent wins
      // Verify challenger doesn't get reward
      expect(challenger_balance_after).to.equal(challenger_balance_before);

      // Calculate voter rewards
      const voter_rewards = voter_balances_after.map((after, i) => after - voter_balances_before[i]);
      const total_voter_rewards = voter_rewards.reduce((a, b) => a + b, 0n);

      // Verify total rewards distributed
      expect(total_voter_rewards).to.equal(voterRewards);

      // Verify challenge resolution event
      await expect(tx)
        .to.emit(aiAgentRegistry, "ChallengeResolved")
        .withArgs(agent1.address, true, winnerReward, voterRewards);

      // Verify agent state after resolution
      const agent = await aiAgentRegistry.aiAgents(agent1.address);
      expect(agent.isListed).to.be.true; // Agent won the challenge
      expect(agent.challengeEndTime).to.equal(0);
      expect(agent.challenger).to.equal(ethers.ZeroAddress);
      expect(agent.votesFor).to.equal(0);
      expect(agent.votesAgainst).to.equal(0);
      expect(agent.totalVoterStakes).to.equal(0);
    });

    it("Should clear all voter data after challenge resolution", async function () {
      console.log("\t", "🧹 Verifying voter data cleanup for all users...");

      // Check voter data is cleared for all users
      for (const user of [user2, user3, user4, user5]) {
        const stake = await aiAgentRegistry.voterStakes(agent1.address, user.address);
        const hasVoted = await aiAgentRegistry.hasVoted(agent1.address, user.address);
        expect(stake).to.equal(0);
        expect(hasVoted).to.be.false;
      }
    });
  });

  describe("Feedback System", function () {
    deployNewInstance();

    before(async function () {
      console.log("\t", "🎯 Setting up test agent...");
      await aiAgentRegistry.connect(agent1).submitAgent("metadata1", "strategy1", MIN_STAKE);
    });

    it("Should record feedback correctly and emit event", async function () {
      console.log("\t", "📊 Submitting feedback...");
      const comment = "Great music recommendations!";

      const tx = await aiAgentRegistry.connect(agent1).submitFeedback(true, 5, comment);

      // Check on-chain stats
      const stats = await aiAgentRegistry.getAgentStats(agent1.address);
      console.log("\t", "📈 Verifying feedback stats...");
      expect(stats.totalFeedbacks).to.equal(1);
      expect(stats.positiveAlignments).to.equal(1);
      expect(stats.averageRating).to.equal(500); // 5.00 scaled by 100

      // Verify event emission
      await expect(tx).to.emit(aiAgentRegistry, "FeedbackSubmitted").withArgs(
        agent1.address,
        true,
        5,
        comment,
        anyValue, // timestamp
      );
    });

    it("Should calculate average rating correctly with multiple feedbacks", async function () {
      console.log("\t", "🧮 Testing average calculation...");

      // Submit second feedback with different rating
      await aiAgentRegistry.connect(agent1).submitFeedback(false, 3, "Could be better with more variety");

      const stats = await aiAgentRegistry.getAgentStats(agent1.address);
      expect(stats.totalFeedbacks).to.equal(2);
      expect(stats.positiveAlignments).to.equal(1);
      expect(stats.averageRating).to.equal(400); // (5 + 3) / 2 * 100 = 400
    });

    it("Should reject invalid rating values", async function () {
      console.log("\t", "❌ Testing invalid ratings...");

      await expect(aiAgentRegistry.connect(agent1).submitFeedback(true, 0, "Invalid rating")).to.be.revertedWith(
        "Invalid rating range",
      );

      await expect(aiAgentRegistry.connect(agent1).submitFeedback(true, 6, "Invalid rating")).to.be.revertedWith(
        "Invalid rating range",
      );
    });

    it("Should reject feedback for unlisted agents", async function () {
      console.log("\t", "🚫 Testing feedback for unlisted agent...");

      await expect(
        aiAgentRegistry.connect(agent2).submitFeedback(true, 5, "Feedback from unlisted agent"),
      ).to.be.revertedWith("Agent not listed");
    });
  });

  describe("Strategy Management", function () {
    deployNewInstance();

    before(async function () {
      await aiAgentRegistry.connect(agent1).submitAgent("metadata1", "strategy1", MIN_STAKE);
    });

    it("Should allow agent to update their own strategy", async function () {
      console.log("\t", "🔄 Updating strategy...");
      const tx = await aiAgentRegistry.connect(agent1).updateAgentStrategy(agent1.address, "newStrategy");

      expect(await aiAgentRegistry.agentStrategies(agent1.address)).to.equal("newStrategy");

      await expect(tx).to.emit(aiAgentRegistry, "StrategyUpdated").withArgs(agent1.address, "newStrategy");
    });

    it("Should allow governance to update strategy", async function () {
      console.log("\t", "🔄 Governance updating strategy...");
      const tx = await aiAgentRegistry.connect(deployer).updateAgentStrategy(agent1.address, "governanceStrategy");

      expect(await aiAgentRegistry.agentStrategies(agent1.address)).to.equal("governanceStrategy");

      await expect(tx).to.emit(aiAgentRegistry, "StrategyUpdated").withArgs(agent1.address, "governanceStrategy");
    });

    it("Should prevent other addresses from updating strategy", async function () {
      console.log("\t", "🚫 Testing unauthorized strategy update...");
      await expect(
        aiAgentRegistry.connect(agent2).updateAgentStrategy(agent1.address, "newStrategy"),
      ).to.be.revertedWith("Only agent or governance can update strategy");
    });
  });
});

async function getLatestBlockTimestamp(): Promise<number> {
  const latestBlock = await ethers.provider.getBlock("latest");
  if (!latestBlock) throw new Error("Failed to get latest block");
  return latestBlock.timestamp;
}
