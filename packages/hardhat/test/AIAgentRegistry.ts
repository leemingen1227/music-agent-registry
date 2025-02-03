import { expect } from "chai";
import { ethers } from "hardhat";
import { AIAgentRegistry, MusicToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("AIAgentRegistry", function () {
  let aiAgentRegistry: AIAgentRegistry;
  let musicToken: MusicToken;
  let deployer: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let user4: HardhatEthersSigner;

  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens
  const MIN_STAKE = ethers.parseEther("100"); // 100 tokens
  const CHALLENGE_PERIOD = 3 * 24 * 60 * 60; // 3 days in seconds
  const FEEDBACK_COOLDOWN = 7 * 24 * 60 * 60; // 7 days in seconds

  async function deployNewInstance() {
    before("Deploying fresh contracts", async function () {
      console.log("\t", "🛫 Deploying new contracts...");

      const MusicTokenFactory = await ethers.getContractFactory("MusicToken");
      musicToken = await MusicTokenFactory.deploy(INITIAL_SUPPLY);

      const AIAgentRegistryFactory = await ethers.getContractFactory("AIAgentRegistry");
      aiAgentRegistry = await AIAgentRegistryFactory.deploy(await musicToken.getAddress());

      [deployer, user1, user2, user3, user4] = await ethers.getSigners();

      // Transfer tokens to users for testing
      await musicToken.transfer(user1.address, ethers.parseEther("10000"));
      await musicToken.transfer(user2.address, ethers.parseEther("10000"));
      await musicToken.transfer(user3.address, ethers.parseEther("10000"));
      await musicToken.transfer(user4.address, ethers.parseEther("10000"));
      // Approve registry to spend tokens
      await musicToken.connect(user1).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
      await musicToken.connect(user2).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
      await musicToken.connect(user3).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
      await musicToken.connect(user4).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
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
      const tx = await aiAgentRegistry.connect(user1).submitAgent(
        "modelHash1",
        "metadata1",
        "strategy1",
        MIN_STAKE
      );

      const agent = await aiAgentRegistry.aiAgents("modelHash1");
      console.log("\t", "✅ Verifying agent details...");
      expect(agent.owner).to.equal(user1.address);
      expect(agent.isListed).to.be.true;

      await expect(tx)
        .to.emit(aiAgentRegistry, "AgentSubmitted")
        .withArgs("modelHash1", user1.address, MIN_STAKE, "metadata1");
    });

    it("Should fail when stake is insufficient", async function () {
      console.log("\t", "❌ Testing insufficient stake...");
      await expect(
        aiAgentRegistry.connect(user1).submitAgent(
          "modelHash2",
          "metadata2",
          "strategy2",
          ethers.parseEther("99") // Less than MIN_STAKE
        )
      ).to.be.revertedWith("Insufficient stake");
    });
  });

  describe("Challenge Mechanism", function () {
    deployNewInstance();

    before(async function () {
      console.log("\t", "🎯 Setting up test agent...");
      await aiAgentRegistry.connect(user1).submitAgent(
        "modelHash1",
        "metadata1",
        "strategy1",
        MIN_STAKE
      );
    });

    it("Should allow challenging a listed agent", async function () {
      console.log("\t", "🤺 Challenging agent...");
      const tx = await aiAgentRegistry.connect(user2).challengeAgent(
        "modelHash1",
        MIN_STAKE
      );

      const agent = await aiAgentRegistry.aiAgents("modelHash1");
      expect(agent.challenger).to.equal(user2.address);
      expect(agent.challengeStake).to.equal(MIN_STAKE);
      expect(agent.challengeEndTime).to.be.gt(0);

      await expect(tx)
        .to.emit(aiAgentRegistry, "AgentChallenged")
        .withArgs("modelHash1", user2.address, MIN_STAKE);

      // Verify can't challenge again while challenge is active
      await expect(
        aiAgentRegistry.connect(user3).challengeAgent("modelHash1", MIN_STAKE)
      ).to.be.revertedWith("Already challenged");
    });

    it("Should allow voting during challenge period", async function () {
      console.log("\t", "🗳️ Testing voting mechanism...");
      
      const tx = await aiAgentRegistry.connect(user3).vote("modelHash1", false, MIN_STAKE);

      const agent = await aiAgentRegistry.aiAgents("modelHash1");
      expect(agent.votesAgainst).to.equal(MIN_STAKE);
      expect(agent.totalVoterStakes).to.equal(MIN_STAKE);

      await expect(tx)
        .to.emit(aiAgentRegistry, "VoteCast")
        .withArgs("modelHash1", user3.address, false, MIN_STAKE);

      // Verify same user can't vote twice
      await expect(
        aiAgentRegistry.connect(user3).vote("modelHash1", false, MIN_STAKE)
      ).to.be.revertedWith("Already voted");
    });

    it("Should track voting stakes correctly", async function () {
      console.log("\t", "💰 Testing vote stake tracking...");
      
      // Another user votes against
      const tx = await aiAgentRegistry.connect(user1).vote("modelHash1", false, MIN_STAKE);
      const tx2 = await aiAgentRegistry.connect(user4).vote("modelHash1", true, MIN_STAKE);
      
      const agent = await aiAgentRegistry.aiAgents("modelHash1");
      expect(agent.votesAgainst).to.equal(MIN_STAKE * 2n);
      expect(agent.votesFor).to.equal(MIN_STAKE);
      expect(agent.totalVoterStakes).to.equal(MIN_STAKE * 3n);
      
      const voterStake = await aiAgentRegistry.voterStakes("modelHash1", user1.address);
      expect(voterStake).to.equal(MIN_STAKE);
    });

    it("Should distribute rewards correctly after challenge resolution", async function () {
      console.log("\t", "💸 Testing reward distribution...");
      
      // Get initial balances
      const challenger_balance_before = await musicToken.balanceOf(user2.address);
      const voter1_balance_before = await musicToken.balanceOf(user1.address);
      const voter2_balance_before = await musicToken.balanceOf(user3.address);
      const voter4_balance_before = await musicToken.balanceOf(user4.address);
      // Fast forward time to end challenge period
      await ethers.provider.send("evm_increaseTime", [CHALLENGE_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);

      // Resolve challenge
      const tx = await aiAgentRegistry.resolveChallenge("modelHash1");

      // Get final balances
      const challenger_balance_after = await musicToken.balanceOf(user2.address);
      const voter1_balance_after = await musicToken.balanceOf(user1.address);
      const voter2_balance_after = await musicToken.balanceOf(user3.address);
      const voter4_balance_after = await musicToken.balanceOf(user4.address);
      // Calculate expected rewards
      const totalStake = MIN_STAKE * 2n; // agent stake + challenger stake
      const winnerReward = (totalStake * 70n) / 100n; // 70% to winner
      const voterRewards = totalStake - winnerReward; // 30% to voters

      // Verify challenger reward
      console.log("\t", "🏆 Verifying challenger reward...");
      expect(challenger_balance_after - challenger_balance_before).to.equal(winnerReward);

      // Verify voter rewards
      console.log("\t", "🎁 Verifying voter rewards...");
      const voter1_reward = voter1_balance_after - voter1_balance_before;
      const voter2_reward = voter2_balance_after - voter2_balance_before;
      const voter4_reward = voter4_balance_after - voter4_balance_before;
    //   expect(voter4_reward).to.equal(0);
      expect(voter1_reward + voter2_reward).to.equal(voterRewards);

      // Verify challenge resolution event
      await expect(tx)
        .to.emit(aiAgentRegistry, "ChallengeResolved")
        .withArgs("modelHash1", false, winnerReward, voterRewards);

      // Verify agent state after resolution
      const agent = await aiAgentRegistry.aiAgents("modelHash1");
      expect(agent.isListed).to.be.false;
      expect(agent.challengeEndTime).to.equal(0);
      expect(agent.challenger).to.equal(ethers.ZeroAddress);
      expect(agent.votesFor).to.equal(0);
      expect(agent.votesAgainst).to.equal(0);
      expect(agent.totalVoterStakes).to.equal(0);
    });

    it("Should clear voter data after challenge resolution", async function () {
      console.log("\t", "🧹 Verifying voter data cleanup...");
      
      // Check voter data is cleared
      const voter1_stake = await aiAgentRegistry.voterStakes("modelHash1", user1.address);
      const voter2_stake = await aiAgentRegistry.voterStakes("modelHash1", user3.address);
      const voter4_stake = await aiAgentRegistry.voterStakes("modelHash1", user4.address);
      const voter1_hasVoted = await aiAgentRegistry.hasVoted("modelHash1", user1.address);
      const voter2_hasVoted = await aiAgentRegistry.hasVoted("modelHash1", user3.address);
      const voter4_hasVoted = await aiAgentRegistry.hasVoted("modelHash1", user4.address);

      expect(voter1_stake).to.equal(0);
      expect(voter2_stake).to.equal(0);
      expect(voter4_stake).to.equal(0);
      expect(voter1_hasVoted).to.be.false;
      expect(voter2_hasVoted).to.be.false;
      expect(voter4_hasVoted).to.be.false;
    });
  });

  describe("Feedback System", function () {
    deployNewInstance();

    before(async function () {
      console.log("\t", "🎯 Setting up test agent...");
      await aiAgentRegistry.connect(user1).submitAgent(
        "modelHash1",
        "metadata1",
        "strategy1",
        MIN_STAKE
      );
    });

    it("Should record feedback correctly and emit event", async function () {
      console.log("\t", "📊 Submitting feedback...");
      const comment = "Great music recommendations!";
      
      const tx = await aiAgentRegistry.connect(user2).submitFeedback(
        "modelHash1",
        true,
        5,
        comment
      );

      // Check on-chain stats
      const stats = await aiAgentRegistry.getAgentStats("modelHash1");
      console.log("\t", "📈 Verifying feedback stats...");
      expect(stats.totalFeedbacks).to.equal(1);
      expect(stats.positiveAlignments).to.equal(1);
      expect(stats.averageRating).to.equal(500); // 5.00 scaled by 100

      // Verify event emission
      await expect(tx)
        .to.emit(aiAgentRegistry, "FeedbackSubmitted")
        .withArgs(
          "modelHash1",
          user2.address,
          true,
          5,
          comment,
          anyValue // timestamp
        );
    });

    it("Should calculate average rating correctly with multiple feedbacks", async function () {
      console.log("\t", "🧮 Testing average calculation...");
      
      // Fast forward time to bypass cooldown
      await ethers.provider.send("evm_increaseTime", [FEEDBACK_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      // Submit second feedback with different rating
      await aiAgentRegistry.connect(user3).submitFeedback(
        "modelHash1",
        false,
        3,
        "Could be better with more variety"
      );

      const stats = await aiAgentRegistry.getAgentStats("modelHash1");
      expect(stats.totalFeedbacks).to.equal(2);
      expect(stats.positiveAlignments).to.equal(1);
      expect(stats.averageRating).to.equal(400); // (5 + 3) / 2 * 100 = 400
    });

    it("Should enforce feedback cooldown", async function () {
      console.log("\t", "⏲️ Testing feedback cooldown...");
      
      await expect(
        aiAgentRegistry.connect(user3).submitFeedback(
          "modelHash1",
          true,
          4,
          "Another feedback"
        )
      ).to.be.revertedWith("Please wait before submitting another feedback");
    });

    it("Should handle multiple feedbacks and maintain accurate stats", async function () {
      console.log("\t", "📊 Testing multiple feedback handling...");
      
      await ethers.provider.send("evm_increaseTime", [FEEDBACK_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      await aiAgentRegistry.connect(user4).submitFeedback(
        "modelHash1",
        true,
        4,
        "Good recommendations overall"
      );

      const stats = await aiAgentRegistry.getAgentStats("modelHash1");
      expect(stats.totalFeedbacks).to.equal(3);
      expect(stats.positiveAlignments).to.equal(2);
      expect(stats.averageRating).to.equal(400);
    });

    it("Should reject invalid rating values", async function () {
      console.log("\t", "❌ Testing invalid ratings...");
      
      await expect(
        aiAgentRegistry.connect(user1).submitFeedback(
          "modelHash1",
          true,
          0,
          "QmFeedback5"
        )
      ).to.be.revertedWith("Invalid rating range");

      await expect(
        aiAgentRegistry.connect(user1).submitFeedback(
          "modelHash1",
          true,
          6,
          "QmFeedback6"
        )
      ).to.be.revertedWith("Invalid rating range");
    });

    it("Should reject feedback for unlisted agents", async function () {
      console.log("\t", "🚫 Testing feedback for unlisted agent...");
      
      await expect(
        aiAgentRegistry.connect(user1).submitFeedback(
          "nonexistentAgent",
          true,
          5,
          "QmFeedback7"
        )
      ).to.be.revertedWith("Agent not listed");
    });
  });

  describe("Strategy Management", function () {
    deployNewInstance();

    before(async function () {
      await aiAgentRegistry.connect(user1).submitAgent(
        "modelHash1",
        "metadata1",
        "strategy1",
        MIN_STAKE
      );
    });

    it("Should allow governance to update strategy", async function () {
      console.log("\t", "🔄 Updating strategy...");
      const tx = await aiAgentRegistry.updateAgentStrategy("modelHash1", "newStrategy");

      expect(await aiAgentRegistry.agentStrategies("modelHash1")).to.equal("newStrategy");

      await expect(tx)
        .to.emit(aiAgentRegistry, "StrategyUpdated")
        .withArgs("modelHash1", "newStrategy");
    });

    it("Should prevent non-governance from updating strategy", async function () {
      console.log("\t", "🚫 Testing unauthorized strategy update...");
      await expect(
        aiAgentRegistry.connect(user1).updateAgentStrategy("modelHash1", "newStrategy")
      ).to.be.revertedWith("Only governance can update strategy");
    });
  });
});

async function getLatestBlockTimestamp(): Promise<number> {
  const latestBlock = await ethers.provider.getBlock("latest");
  return latestBlock.timestamp;
}
