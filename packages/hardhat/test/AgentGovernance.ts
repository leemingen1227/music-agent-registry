import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentGovernance, MusicToken, AIAgentRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AgentGovernance", function () {
  let agentGovernance: AgentGovernance;
  let musicToken: MusicToken;
  let aiAgentRegistry: AIAgentRegistry;
  let deployer: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let user4: HardhatEthersSigner;

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
        await aiAgentRegistry.getAddress()
      );

      // Transfer ownership of AIAgentRegistry to AgentGovernance
      await aiAgentRegistry.transferOwnership(await agentGovernance.getAddress());

      [deployer, user1, user2, user3, user4] = await ethers.getSigners();

      // Transfer tokens to users for testing
      await musicToken.transfer(user1.address, ethers.parseEther("10000"));
      await musicToken.transfer(user2.address, ethers.parseEther("10000"));
      await musicToken.transfer(user3.address, ethers.parseEther("10000"));
      await musicToken.transfer(user4.address, ethers.parseEther("10000"));

      // Submit an agent to the registry for testing
      await musicToken.connect(user1).approve(await aiAgentRegistry.getAddress(), ethers.MaxUint256);
      await aiAgentRegistry.connect(user1).submitAgent(
        "modelHash1",
        "metadata1",
        "strategy1",
        ethers.parseEther("100")
      );
    });
  }

  // Quick fix to let gas reporter fetch data from gas station & coinmarketcap
  before(done => {
    setTimeout(done, 2000);
  });

  describe("Proposal Creation", function () {
    deployNewInstance();

    it("Should allow creating a general proposal with sufficient tokens", async function () {
      console.log("\t", "📝 Creating general proposal...");
      await musicToken.connect(user1).approve(await agentGovernance.getAddress(), ethers.MaxUint256);

      const tx = await agentGovernance.connect(user1).createProposal(
        "modelHash1",
        "Recommend more jazz music",
        "QmProposalMetadata1"
      );

      const proposal = await agentGovernance.getProposal(1);
      console.log("\t", "✅ Verifying proposal details...");
      expect(proposal.proposer).to.equal(user1.address);
      expect(proposal.description).to.equal("Recommend more jazz music");

      await expect(tx)
        .to.emit(agentGovernance, "ProposalCreated")
        .withArgs(1, "modelHash1", "Recommend more jazz music", user1.address);
    });

    it("Should allow creating a strategy update proposal", async function () {
      console.log("\t", "📝 Creating strategy update proposal...");
      const tx = await agentGovernance.connect(user1).createStrategyProposal(
        "modelHash1",
        "Update recommendation strategy",
        "QmProposalMetadata2",
        "QmNewStrategyHash1"
      );

      const proposal = await agentGovernance.getProposal(2);
      expect(proposal.proposer).to.equal(user1.address);
      expect(proposal.description).to.equal("Update recommendation strategy");

      await expect(tx)
        .to.emit(agentGovernance, "ProposalCreated")
        .withArgs(2, "modelHash1", "Update recommendation strategy", user1.address);
    });

    it("Should fail when proposer has insufficient tokens", async function () {
      console.log("\t", "❌ Testing insufficient tokens...");
      // Transfer all tokens away from user2
      const balance = await musicToken.balanceOf(user2.address);
      await musicToken.connect(user2).transfer(user3.address, balance);

      await expect(
        agentGovernance.connect(user2).createProposal(
          "modelHash1",
          "Should fail",
          "QmProposalMetadata3"
        )
      ).to.be.revertedWith("Not enough tokens to propose");
    });
  });

  describe("Voting Mechanism", function () {
    deployNewInstance();

    before(async function () {
      console.log("\t", "🎯 Setting up test proposal...");
      await musicToken.connect(user1).approve(await agentGovernance.getAddress(), ethers.MaxUint256);
      await agentGovernance.connect(user1).createProposal(
        "modelHash1",
        "Test proposal",
        "QmProposalMetadata4"
      );
    });

    it("Should allow voting on active proposals", async function () {
      console.log("\t", "🗳️ Testing voting mechanism...");
      await musicToken.connect(user2).approve(await agentGovernance.getAddress(), ethers.MaxUint256);
      
      const tx = await agentGovernance.connect(user2).vote(1, true);

      const proposal = await agentGovernance.getProposal(1);
      expect(proposal.votesFor).to.be.gt(0);

      await expect(tx)
        .to.emit(agentGovernance, "VoteCast")
        .withArgs(1, user2.address, true);
    });

    it("Should prevent double voting", async function () {
      console.log("\t", "🚫 Testing double voting prevention...");

      await expect(
        agentGovernance.connect(user2).vote(1, false)
      ).to.be.revertedWith("Already voted");
    });
      

    it("Should prevent voting after voting period", async function () {
      console.log("\t", "⏲️ Testing voting period...");
      
      // Fast forward time past voting period
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        agentGovernance.connect(user2).vote(1, true)
      ).to.be.revertedWith("Voting ended");
    });

    
  });

  describe("Proposal Execution", function () {
    deployNewInstance();

    before(async function () {
      console.log("\t", "🎯 Setting up test proposal...");
      await musicToken.connect(user1).approve(await agentGovernance.getAddress(), ethers.MaxUint256);
      await agentGovernance.connect(user1).createStrategyProposal(
        "modelHash1",
        "Strategy update proposal",
        "QmProposalMetadata5",
        "QmNewStrategyHash2"
      );

      // Multiple users vote
      await agentGovernance.connect(user2).vote(1, true);
      await agentGovernance.connect(user3).vote(1, true);
      await agentGovernance.connect(user4).vote(1, false);
    });

    it("Should prevent executing proposal before voting period ends", async function () {
      console.log("\t", "⏲️ Testing early execution prevention...");
      
      await expect(
        agentGovernance.executeProposal(1)
      ).to.be.revertedWith("Voting still active");
    });

    it("Should execute accepted proposal after voting period", async function () {
      console.log("\t", "✅ Testing proposal execution...");
      
      // Fast forward time past voting period
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);

      const tx = await agentGovernance.executeProposal(1);

      const proposal = await agentGovernance.getProposal(1);
      expect(proposal.executed).to.be.true;

      await expect(tx)
        .to.emit(agentGovernance, "ProposalExecuted")
        .withArgs(1, "modelHash1", true);
    });

    it("Should prevent executing already executed proposal", async function () {
      console.log("\t", "🚫 Testing double execution prevention...");
      
      await expect(
        agentGovernance.executeProposal(1)
      ).to.be.revertedWith("Already executed");
    });
  });

  describe("View Functions", function () {
    deployNewInstance();

    before(async function () {
      await musicToken.connect(user1).approve(await agentGovernance.getAddress(), ethers.MaxUint256);
      await agentGovernance.connect(user1).createProposal(
        "modelHash1",
        "Test proposal",
        "QmProposalMetadata6"
      );
      await agentGovernance.connect(user2).vote(1, true);
    });

    it("Should correctly return proposal details", async function () {
      console.log("\t", "📊 Testing view functions...");
      
      const proposal = await agentGovernance.getProposal(1);
      expect(proposal.proposer).to.equal(user1.address);
      expect(proposal.description).to.equal("Test proposal");
      expect(proposal.executed).to.be.false;
    });

    it("Should correctly track voter status", async function () {
      console.log("\t", "👥 Testing voter tracking...");
      
      expect(await agentGovernance.hasVoted(1, user2.address)).to.be.true;
      expect(await agentGovernance.hasVoted(1, user3.address)).to.be.false;
    });
  });
}); 