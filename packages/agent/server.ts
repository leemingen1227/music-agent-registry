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
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "X-User-Address"]
}));

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
      return res.status(401).json({ error: "Wallet not found or unauthorized" });
    }

    //check if agent is already registered
    const isRegistered = await agentRegistry.checkAgentRegistration(agentAddress);
    if (isRegistered) {
      //check if agent is initialized
      let agentInstance = agents.get(agentAddress);
      if (agentInstance) {
        return res.status(200).json({ message: "Agent already initialized" });
      } else {
        try {
          const requestingAddress = req.headers["x-user-address"] as string;
          const walletData = await agentRegistry.getAgentWallet(agentAddress, requestingAddress);
          if (!walletData) {
            return res.status(401).json({ error: "Unauthorized to interact with this agent" });
          }
          const { agent, config } = await initializeAgent(walletData);
          agentInstance = { agent, config };
          agents.set(agentAddress, agentInstance);
          console.log(`Agent instance spun up on-demand for address: ${agentAddress}`);
          return res.status(200).json({ message: "Agent initialized" });
        } catch (error) {
          console.error("Failed to initialize agent instance:", error);
          return res.status(500).json({ 
            error: "Failed to initialize agent instance",
            details: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }
    }

    // Check balance
    const balance = await agentRegistry.checkAgentBalance(agentAddress);
    if (balance <= 0n) {
      return res.status(400).json({ error: "Agent wallet not funded" });
    }

    // Initialize agent in registry
    const success = await agentRegistry.initializeAgent(agentAddress);
    if (!success) {
      return res.status(500).json({ error: "Failed to initialize agent" });
    }

    // Spin up the agent instance
    try {
      const { agent, config } = await initializeAgent(walletData);
      agents.set(agentAddress, { agent, config });
      console.log(`Agent instance spun up successfully for address: ${agentAddress}`);
    } catch (error) {
      console.error("Failed to spin up agent instance:", error);
      return res.status(500).json({ 
        error: "Agent registered but failed to spin up instance",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }

    res.json({ 
      message: "Agent initialized and spun up successfully",
      status: "ready"
    });
  } catch (error) {
    console.error("Error initializing agent:", error);
    res.status(500).json({ error: "Failed to initialize agent" });
  }
});

// Check agent status endpoint
// app.get("/agent/status", async (req, res) => {
//   try {
//     const agentAddress = req.query.address as string;

//     if (!agentAddress) {
//       return res.status(400).json({ error: "Agent address not provided" });
//     }

//     const isRegistered = await agentRegistry.checkAgentRegistration(agentAddress);
//     const balance = await agentRegistry.checkAgentBalance(agentAddress);

//     res.json({
//       isRegistered,
//       balance: balance.toString(),
//       status: isRegistered ? "registered" : "unregistered"
//     });
//   } catch (error) {
//     console.error("Error checking agent status:", error);
//     res.status(500).json({ error: "Failed to check agent status" });
//   }
// });

// Add this endpoint to check agent status
app.get("/agent/status/:address", async (req, res) => {
  try {
    const agentAddress = req.params.address;
    const isRegistered = await agentRegistry.checkAgentRegistration(agentAddress);
    const isInitialized = agents.has(agentAddress);
    
    res.json({
      isRegistered,
      isInitialized,
      status: isInitialized ? "ready" : (isRegistered ? "registered" : "not_registered")
    });
  } catch (error) {
    console.log("Error checking agent status:", error);
    res.status(500).json({ error: "Failed to check agent status" });
  }
});

// Get or initialize agent instance
// async function getOrInitializeAgent(agentAddress: string) {
//   // Check cache first
//   if (agents.has(agentAddress)) {
//     return agents.get(agentAddress)!;
//   }

//   try {
//     // Check if agent is registered
//     const isRegistered = await agentRegistry.checkAgentRegistration(agentAddress);
//     if (!isRegistered) {
//       throw new Error("Agent not registered");
//     }

//     // Get agent wallet data from the agents directory
//     const walletPath = path.join(process.cwd(), "agents-wallets", `${agentAddress}-wallet.json`);
//     if (!fs.existsSync(walletPath)) {
//       throw new Error("Agent wallet not found");
//     }

//     // Load agent data including wallet and config
//     const agentData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
    
//     // Initialize the agent with the wallet data
//     const { agent, config } = await initializeAgent(agentData.walletData);

//     // Cache the initialized agent
//     agents.set(agentAddress, { agent, config });
//     return { agent, config };
//   } catch (error) {
//     console.error("Error initializing agent:", error);
//     throw error;
//   }
// }

// Chat endpoint with staker verification
app.post("/chat", verifyStaker, async (req, res) => {
  try {
    const { message, agentAddress, feedback } = req.body;

    if (!message || !agentAddress) {
      return res.status(400).json({ error: "Message and agent address are required" });
    }

    // Check if agent is registered and initialized
    const isRegistered = await agentRegistry.checkAgentRegistration(agentAddress);
    if (!isRegistered) {
      return res.status(404).json({ 
        error: "Agent not found",
        details: "This agent is not registered in the AI Agent Registry"
      });
    }

    let agentInstance = agents.get(agentAddress);

    if (!agentInstance) {
      return res.status(500).json({ error: "Agent not initialized" });
    }

    // Construct the message based on whether it's a feedback submission or regular chat
    let userMessage = message;
    if (feedback) {
      userMessage = `Submit feedback for your last recommendation with the following details:
        - Aligns with strategy: ${feedback.alignsWithStrategy}
        - Rating: ${feedback.rating}
        - Comment: ${feedback.comment}`;
    }

    const stream = await agentInstance.agent.stream(
      { messages: [new HumanMessage(userMessage)] }, 
      agentInstance.config
    );

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
