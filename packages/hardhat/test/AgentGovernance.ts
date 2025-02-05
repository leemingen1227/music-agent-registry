import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentGovernance, MusicToken, AIAgentRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AgentGovernance", function () {
  let agentGovernance: AgentGovernance;
  let musicToken: MusicToken;
  let aiAgentRegistry: AIAgentRegistry;
  let deployer: HardhatEthersSigner;
  let agent1: HardhatEthersSigner;
  let agent2: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let user4: HardhatEthersSigner;
  let user5: HardhatEthersSigner;

  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens
  const MIN_TOKENS_TO_PROPOSE = ethers.parseEther("100"); // 100 tokens
  const VOTING_PERIOD = 3 * 24 * 60 * 60; // 3 days in seconds

  async function deployNewInstance() {
    before("Deploying fresh contracts", async function () {
      console.log("\t", "🛫 Deploying new contracts...");

      const MusicTokenFactory = await ethers.getContractFactory("MusicToken");
      musicToken = await MusicTokenFactory.deploy(INITIAL_SUPPLY);

      const AIAgentRegistryFactory = await ethers.getContractFactory("AIAgentRegistry");
      aiAgentRegistry = await AIAgentRegistryFactory.deploy(await musicToken.getAddress());

      const AgentGovernanceFactory = await ethers.getContractFactory("AgentGovernance");
      agentGovernance = await AgentGovernanceFactory.deploy(
        await musicToken.getAddress(),
        await aiAgentRegistry.getAddress(),
      );

      // Transfer ownership of AIAgentRegistry to AgentGovernance
      await aiAgentRegistry.transferOwnership(await agentGovernance.getAddress());

      [deployer, agent1, agent2, user1, user2, user3, user4, user5] = await ethers.getSigners();

      // Transfer tokens to users for testing
      await musicToken.transfer(agent1.address, ethers.parseEther("10000"));
      await musicToken.transfer(agent2.address, ethers.parseEther("10000"));
      await musicToken.transfer(user1.address, ethers.parseEther("10000"));
      await musicToken.transfer(user2.address, ethers.parseEther("10000"));
      await musicToken.transfer(user3.address, ethers.parseEther("10000"));
      await musicToken.transfer(user4.address, ethers.parseEther("10000"));
      await musicToken.transfer(user5.address, ethers.parseEther("10000"));

      // Submit an agent to the registry for testing
      await musicToken.connect(agent1).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
      await aiAgentRegistry.connect(agent1).submitAgent("metadata1", "strategy1", ethers.parseEther("100"));
    });
  }

  // Quick fix to let gas reporter fetch data from gas station & coinmarketcap
  before(done => {
    setTimeout(done, 2000);
  });

  describe("Proposal Creation", function () {
    deployNewInstance();

    it("Should allow creating a strategy update proposal with sufficient tokens", async function () {
      console.log("\t", "📝 Creating strategy update proposal...");
      await musicToken.connect(user1).approve(await agentGovernance.getAddress(), ethers.MaxUint256);

      const tx = await agentGovernance
        .connect(user1)
        .createProposal(agent1.address, "Update recommendation strategy", "ipfsMetadata1", "newStrategy1");

      const proposal = await agentGovernance.getProposal(1);
      console.log("\t", "✅ Verifying proposal details...");
      expect(proposal.proposer).to.equal(user1.address);
      expect(proposal.agentAddress).to.equal(agent1.address);
      expect(proposal.description).to.equal("Update recommendation strategy");
      expect(proposal.newStrategy).to.equal("newStrategy1");

      await expect(tx)
        .to.emit(agentGovernance, "ProposalCreated")
        .withArgs(1, agent1.address, "Update recommendation strategy", "newStrategy1", user1.address);
    });

    it("Should fail when proposer has insufficient tokens", async function () {
      console.log("\t", "❌ Testing insufficient tokens...");
      // Transfer all tokens away from user2
      const balance = await musicToken.balanceOf(user2.address);
      await musicToken.connect(user2).transfer(user3.address, balance);

      await expect(
        agentGovernance.connect(user2).createProposal(agent1.address, "Should fail", "ipfsMetadata2", "newStrategy2"),
      ).to.be.revertedWith("Not enough tokens to propose");
    });

    it("Should fail when agent is not listed", async function () {
      console.log("\t", "❌ Testing proposal for unlisted agent...");
      await expect(
        agentGovernance.connect(user1).createProposal(agent2.address, "Should fail", "ipfsMetadata3", "newStrategy3"),
      ).to.be.revertedWith("Agent not listed in TCR");
    });
  });

  describe("Voting Mechanism", function () {
    deployNewInstance();

    before(async function () {
      console.log("\t", "🎯 Setting up test proposal...");
      await musicToken.connect(user1).approve(await agentGovernance.getAddress(), ethers.MaxUint256);
      await agentGovernance
        .connect(user1)
        .createProposal(agent1.address, "Test strategy update", "ipfsMetadata4", "newStrategy4");
    });

    it("Should allow multiple users to vote on proposal", async function () {
      console.log("\t", "🗳️ Testing voting mechanism with multiple users...");

      // Users voting for
      const voteFor1 = await agentGovernance.connect(user2).vote(1, true);
      const voteFor2 = await agentGovernance.connect(user3).vote(1, true);

      // Users voting against
      const voteAgainst1 = await agentGovernance.connect(user4).vote(1, false);
      const voteAgainst2 = await agentGovernance.connect(user5).vote(1, false);

      const proposal = await agentGovernance.getProposal(1);
      expect(proposal.votesFor).to.be.gt(0);
      expect(proposal.votesAgainst).to.be.gt(0);

      // Verify vote events
      await expect(voteFor1).to.emit(agentGovernance, "VoteCast").withArgs(1, user2.address, true);
      await expect(voteFor2).to.emit(agentGovernance, "VoteCast").withArgs(1, user3.address, true);
      await expect(voteAgainst1).to.emit(agentGovernance, "VoteCast").withArgs(1, user4.address, false);
      await expect(voteAgainst2).to.emit(agentGovernance, "VoteCast").withArgs(1, user5.address, false);
    });

    it("Should prevent double voting", async function () {
      console.log("\t", "🚫 Testing double voting prevention...");
      await expect(agentGovernance.connect(user2).vote(1, false)).to.be.revertedWith("Already voted");
    });

    it("Should prevent voting after voting period", async function () {
      console.log("\t", "⏲️ Testing voting period...");
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(agentGovernance.connect(user1).vote(1, true)).to.be.revertedWith("Voting ended");
    });
  });

  describe("Proposal Execution", function () {
    deployNewInstance();

    before(async function () {
      console.log("\t", "🎯 Setting up test proposal...");
      await musicToken.connect(user1).approve(await agentGovernance.getAddress(), ethers.MaxUint256);
      await agentGovernance
        .connect(user1)
        .createProposal(agent1.address, "Strategy update proposal", "ipfsMetadata5", "newStrategy5");

      // Multiple users vote
      await agentGovernance.connect(user2).vote(1, true);
      await agentGovernance.connect(user3).vote(1, true);
      await agentGovernance.connect(user4).vote(1, false);
    });

    it("Should prevent executing proposal before voting period ends", async function () {
      console.log("\t", "⏲️ Testing early execution prevention...");
      await expect(agentGovernance.executeProposal(1)).to.be.revertedWith("Voting still active");
    });

    it("Should execute accepted proposal and update strategy", async function () {
      console.log("\t", "✅ Testing proposal execution...");

      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);

      const tx = await agentGovernance.executeProposal(1);

      const proposal = await agentGovernance.getProposal(1);
      expect(proposal.executed).to.be.true;

      // Verify strategy was updated in registry
      expect(await aiAgentRegistry.getAgentStrategy(agent1.address)).to.equal("newStrategy5");

      await expect(tx).to.emit(agentGovernance, "ProposalExecuted").withArgs(1, agent1.address, true);
    });

    it("Should prevent executing already executed proposal", async function () {
      console.log("\t", "🚫 Testing double execution prevention...");
      await expect(agentGovernance.executeProposal(1)).to.be.revertedWith("Already executed");
    });
  });

  describe("View Functions", function () {
    deployNewInstance();

    before(async function () {
      await musicToken.connect(user1).approve(await agentGovernance.getAddress(), ethers.MaxUint256);
      await agentGovernance
        .connect(user1)
        .createProposal(agent1.address, "Test proposal", "ipfsMetadata6", "newStrategy6");
      await agentGovernance.connect(user2).vote(1, true);
    });

    it("Should correctly return proposal details", async function () {
      console.log("\t", "📊 Testing view functions...");

      const proposal = await agentGovernance.getProposal(1);
      expect(proposal.proposer).to.equal(user1.address);
      expect(proposal.agentAddress).to.equal(agent1.address);
      expect(proposal.description).to.equal("Test proposal");
      expect(proposal.newStrategy).to.equal("newStrategy6");
      expect(proposal.executed).to.be.false;
    });

    it("Should correctly track voter status", async function () {
      console.log("\t", "👥 Testing voter tracking...");

      expect(await agentGovernance.hasVoted(1, user2.address)).to.be.true;
      expect(await agentGovernance.hasVoted(1, user3.address)).to.be.false;
    });
  });
});
