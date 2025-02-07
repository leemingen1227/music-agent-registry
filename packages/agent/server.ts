import express from "express";
import { ethers } from "ethers";
import { HumanMessage } from "@langchain/core/messages";
import { initializeAgent } from "./chatbot";
import { AIAgentRegistryABI } from "./constant/AIAgentRegistryABI";
import { MusicTokenABI } from "./constant/MusicTokenABI";
import { agentRegistry } from "./agent-registry";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const app = express();
app.use(express.json());

// Store initialized agents
const agents = new Map<string, { agent: any; config: any }>();

// Middleware to verify if user is a staker
async function verifyStaker(req: express.Request, res: express.Response, next: express.NextFunction) {
  //for testing
  return next();
  const userAddress = req.headers["x-user-address"] as string;

  if (!userAddress) {
    return res.status(401).json({ error: "User address not provided" });
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const musicToken = new ethers.Contract(process.env.MUSIC_TOKEN_ADDRESS!, MusicTokenABI, provider);
    const hasBalance = await musicToken.balanceOf(userAddress);

    if (hasBalance > 0) {
      next();
    } else {
      res.status(403).json({
        error: "Access denied",
        message: "You need to stake MUSIC tokens to interact with this agent"
      });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to verify stake status" });
  }
}

// Create new agent endpoint
app.post("/agent/create", verifyStaker, async (req, res) => {
  try {
    const creatorAddress = req.headers["x-user-address"] as string;
    //check req.body has strategy, stake, metadata
    if (!req.body.strategy || !req.body.stake || !req.body.metadata) {
      return res.status(400).json({ error: "Strategy, stake, and metadata are required" });
    }

    const config = {
      ...req.body,
      creatorAddress
    };

    const { agentAddress, walletData } = await agentRegistry.createNewAgent(config);

    res.json({
      agentAddress,
      walletData,
      message: "Agent created successfully. Please fund this address with the required amount of tokens before initialization."
    });
  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({ error: "Failed to create agent" });
  }
});

// Get agent wallet endpoint
app.get("/agent/wallet", verifyStaker, async (req, res) => {
  try {
    const agentAddress = req.query.address as string;
    const requestingAddress = req.headers["x-user-address"] as string;

    if (!agentAddress) {
      return res.status(400).json({ error: "Agent address not provided" });
    }

    const walletData = await agentRegistry.getAgentWallet(agentAddress, requestingAddress);
    if (!walletData) {
      return res.status(404).json({ error: "Wallet not found or unauthorized" });
    }

    res.json({ walletData });
  } catch (error) {
    console.error("Error retrieving wallet:", error);
    res.status(500).json({ error: "Failed to retrieve wallet" });
  }
});

// Initialize agent endpoint
app.post("/agent/initialize", verifyStaker, async (req, res) => {
  try {
    const { agentAddress } = req.body;
    const requestingAddress = req.headers["x-user-address"] as string;

    if (!agentAddress) {
      return res.status(400).json({ error: "Agent address not provided" });
    }

    // Verify wallet ownership
    const walletData = await agentRegistry.getAgentWallet(agentAddress, requestingAddress);
    if (!walletData) {
      return res.status(401).json({ error: "Unauthorized to initialize this agent" });
    }

    // Check balance
    const balance = await agentRegistry.checkAgentBalance(agentAddress);
    if (balance <= 0n) {
      return res.status(400).json({ error: "Agent wallet not funded" });
    }

    // Initialize agent
    const success = await agentRegistry.initializeAgent(agentAddress);
    if (!success) {
      return res.status(500).json({ error: "Failed to initialize agent" });
    }

    res.json({ message: "Agent initialized successfully" });
  } catch (error) {
    console.error("Error initializing agent:", error);
    res.status(500).json({ error: "Failed to initialize agent" });
  }
});

// Check agent status endpoint
app.get("/agent/status", async (req, res) => {
  try {
    const agentAddress = req.query.address as string;

    if (!agentAddress) {
      return res.status(400).json({ error: "Agent address not provided" });
    }

    const isRegistered = await agentRegistry.checkAgentRegistration(agentAddress);
    const balance = await agentRegistry.checkAgentBalance(agentAddress);

    res.json({
      isRegistered,
      balance: balance.toString(),
      status: isRegistered ? "registered" : "unregistered"
    });
  } catch (error) {
    console.error("Error checking agent status:", error);
    res.status(500).json({ error: "Failed to check agent status" });
  }
});

// Get or initialize agent instance
async function getOrInitializeAgent(agentAddress: string) {
  if (agents.has(agentAddress)) {
    return agents.get(agentAddress)!;
  }

  // Check if agent is registered
  const isRegistered = await agentRegistry.checkAgentRegistration(agentAddress);
  if (!isRegistered) {
    throw new Error("Agent not registered");
  }

  // Get agent wallet data
  const walletPath = path.join(process.cwd(), "agents", `${agentAddress}-wallet.json`);
  if (!fs.existsSync(walletPath)) {
    throw new Error("Agent wallet not found");
  }

  const agentData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  const { agent, config } = await initializeAgent(agentData.walletData);

  agents.set(agentAddress, { agent, config });
  return { agent, config };
}

// Chat endpoint with staker verification
app.post("/chat", verifyStaker, async (req, res) => {
  try {
    const { message, agentAddress, feedback } = req.body;

    if (!message || !agentAddress) {
      return res.status(400).json({ error: "Message and agent address are required" });
    }

    const { agent, config } = await getOrInitializeAgent(agentAddress);

    // Construct the message based on whether it's a feedback submission or regular chat
    let userMessage = message;
    if (feedback) {
      userMessage = `Submit feedback for your last recommendation with the following details:
        - Aligns with strategy: ${feedback.alignsWithStrategy}
        - Rating: ${feedback.rating}
        - Comment: ${feedback.comment}`;
    }

    const stream = await agent.stream({ messages: [new HumanMessage(userMessage)] }, config);

    const response = [];
    for await (const chunk of stream) {
      if ("agent" in chunk) {
        response.push(chunk.agent.messages[0].content);
      } else if ("tools" in chunk) {
        response.push(chunk.tools.messages[0].content);
      }
    }

    res.json({ response });
  } catch (error) {
    console.error("Error processing message:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Agent server running on port ${PORT}`);
});
