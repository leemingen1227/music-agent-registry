import express from "express";
import { ethers } from "ethers";
import { HumanMessage } from "@langchain/core/messages";
import { initializeAgent } from "./chatbot";
import { AIAgentRegistryABI } from "./constant/AIAgentRegistryABI";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Initialize agent once
let agent: any;
let config: any;

// Initialize the agent when starting the server
async function setup() {
  const result = await initializeAgent();
  agent = result.agent;
  config = result.config;
}

// Middleware to verify if user is a staker
async function verifyStaker(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userAddress = req.headers["x-user-address"] as string;

  if (!userAddress) {
    return res.status(401).json({ error: "User address not provided" });
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const registry = new ethers.Contract(process.env.AI_AGENT_REGISTRY_ADDRESS!, AIAgentRegistryABI, provider);

    // Check if user has staked by looking up if they're an agent owner or have voted
    const hasStaked = await registry.aiAgents(process.env.AGENT_MODEL_HASH!);

    if (hasStaked.owner === userAddress || hasStaked.votesFor > 0) {
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

// Chat endpoint with staker verification
app.post("/chat", verifyStaker, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const stream = await agent.stream({ messages: [new HumanMessage(message)] }, config);

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
    res.status(500).json({ error: "Failed to process message" });
  }
});

const PORT = process.env.PORT || 3001;

setup()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Agent server running on port ${PORT}`);
    });
  })
  .catch(console.error);
