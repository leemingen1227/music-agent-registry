import {
  AgentKit,
  CdpWalletProvider,
  EvmWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  pythActionProvider,
  customActionProvider
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as readline from "readline";
import { Contract, JsonRpcProvider } from "ethers";
import { AIAgentRegistryABI } from "./constant";
import { encodeFunctionData, Hex } from "viem";

dotenv.config();

// Define the input schemas
const SubmitFeedbackSchema = z.object({
  modelHash: z.string().describe("The model hash of the AI agent"),
  alignsWithStrategy: z.boolean().describe("Whether the recommendation aligns with the agent's strategy"),
  rating: z.number().int().min(1).max(5).describe("Rating from 1-5, where 5 is best"),
  comment: z.string().describe("Detailed feedback comment explaining the rating")
});

const GetAgentDataSchema = z.object({
  modelHash: z.string().describe("The model hash of the AI agent to get data for")
});

// Add type definitions
interface FeedbackEvent {
  args?: {
    user: string;
    alignsWithStrategy: boolean;
    rating: number;
    comment: string;
    timestamp: bigint;
  };
}

interface AgentStats {
  totalFeedbacks: bigint;
  positiveAlignments: bigint;
  averageRating: bigint;
}

const SUBMIT_FEEDBACK_PROMPT = `
Submits feedback for an AI agent's recommendation, including whether it aligns with the strategy,
a rating (1-5), and a comment explaining the rating.
`;

// Custom actions for AI Agent Registry
const submitFeedbackProvider = customActionProvider<EvmWalletProvider>({
  name: "submit_feedback",
  description: SUBMIT_FEEDBACK_PROMPT,
  schema: SubmitFeedbackSchema,
  invoke: async (walletProvider, args) => {
    try {
      const data = encodeFunctionData({
        abi: AIAgentRegistryABI,
        functionName: "submitFeedback",
        args: [process.env.AGENT_MODEL_HASH!, args.alignsWithStrategy, args.rating.toString(), args.comment]
      });

      const hash = await walletProvider.sendTransaction({
        to: process.env.AI_AGENT_REGISTRY_ADDRESS! as `0x${string}`,
        data
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `Successfully submitted feedback for agent ${args.modelHash}. Transaction hash: ${hash}`;
    } catch (error) {
      console.error("Error submitting feedback:", error);
      return `Failed to submit feedback: ${error}`;
    }
  }
});

const REFRESH_DATA_PROMPT = `
Updates your knowledge of your current strategy and recent feedback from the blockchain.
Use this when you want to ensure you have the latest information about your performance and strategy.
`;

const getAgentDataProvider = customActionProvider<EvmWalletProvider>({
  name: "get_agent_data",
  description: REFRESH_DATA_PROMPT,
  schema: GetAgentDataSchema,
  invoke: async () => {
    try {
      const provider = new JsonRpcProvider(process.env.RPC_URL);
      const contract = new Contract(process.env.AI_AGENT_REGISTRY_ADDRESS!, AIAgentRegistryABI, provider);

      // Get agent's strategy
      const strategy = await contract.getAgentStrategy(process.env.AGENT_MODEL_HASH!);

      // Get agent stats
      const stats = (await contract.getAgentStats(process.env.AGENT_MODEL_HASH!)) as AgentStats;
      const { totalFeedbacks, positiveAlignments, averageRating } = stats;

      // Get recent feedback using event logs
      const filter = contract.filters.FeedbackSubmitted(process.env.AGENT_MODEL_HASH!);
      const events = (await contract.queryFilter(filter)) as FeedbackEvent[];
      const recentEvents = events.slice(-5); // Get last 5 feedback events

      let feedbackStr = `Stats:\n- Total Feedbacks: ${totalFeedbacks}\n- Positive Alignments: ${positiveAlignments}\n- Average Rating: ${Number(averageRating) / 100}\n\nRecent feedback:\n`;

      for (const event of recentEvents) {
        const { user, alignsWithStrategy, rating, comment, timestamp } = event.args || {};
        if (timestamp) {
          const date = new Date(Number(timestamp) * 1000);
          feedbackStr += `\n- User: ${user}\n  Rating: ${rating}/5\n  Aligns with strategy: ${alignsWithStrategy}\n  Comment: ${comment}\n  Time: ${date.toISOString()}\n`;
        }
      }

      return `Current strategy: ${strategy}\n\n${feedbackStr}`;
    } catch (error) {
      console.error("Error getting agent data:", error);
      return `Failed to get agent data: ${error}`;
    }
  }
});

/**
 * Validates that required environment variables are set
 */
function validateEnvironment(): void {
  const requiredVars = ["OPENAI_API_KEY", "CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY", "AI_AGENT_REGISTRY_ADDRESS", "RPC_URL", "AGENT_MODEL_HASH", "NETWORK_ID"];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach((varName) => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }
}

validateEnvironment();

// Configure files to persist data
const WALLET_DATA_FILE = "wallet_data.txt";

async function getAgentData(agentkit: AgentKit): Promise<{ strategy: string; feedback: string }> {
  try {
    // Get agent's strategy
    const provider = new JsonRpcProvider(process.env.RPC_URL);
    const contract = new Contract(process.env.AI_AGENT_REGISTRY_ADDRESS!, AIAgentRegistryABI, provider);

    // Get agent's strategy
    const strategy = await contract.getAgentStrategy(process.env.AGENT_MODEL_HASH!);

    // Get agent stats
    const stats = (await contract.getAgentStats(process.env.AGENT_MODEL_HASH!)) as AgentStats;
    const { totalFeedbacks, positiveAlignments, averageRating } = stats;

    // Get recent feedback using event logs
    const filter = contract.filters.FeedbackSubmitted(process.env.AGENT_MODEL_HASH!);
    const events = (await contract.queryFilter(filter)) as FeedbackEvent[];
    const recentEvents = events.slice(-5); // Get last 5 feedback events

    let feedbackStr = `Stats:\n- Total Feedbacks: ${totalFeedbacks}\n- Positive Alignments: ${positiveAlignments}\n- Average Rating: ${Number(averageRating) / 100}\n\nRecent feedback:\n`;

    for (const event of recentEvents) {
      const { user, alignsWithStrategy, rating, comment, timestamp } = event.args || {};
      if (timestamp) {
        const date = new Date(Number(timestamp) * 1000);
        feedbackStr += `\n- User: ${user}\n  Rating: ${rating}/5\n  Aligns with strategy: ${alignsWithStrategy}\n  Comment: ${comment}\n  Time: ${date.toISOString()}\n`;
      }
    }

    return {
      strategy,
      feedback: feedbackStr
    };
  } catch (error) {
    console.error("Error getting agent data:", error);
    return {
      strategy: "Failed to get strategy",
      feedback: "Failed to get feedback"
    };
  }
}

/**
 * Initialize the agent with CDP Agentkit and AI Agent Registry actions
 */
async function initializeAgent() {
  try {
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini"
    });

    let walletDataStr: string | null = null;

    if (fs.existsSync(WALLET_DATA_FILE)) {
      try {
        walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
      } catch (error) {
        console.error("Error reading wallet data:", error);
      }
    }

    const config = {
      apiKeyName: process.env.CDP_API_KEY_NAME,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      cdpWalletData: walletDataStr || undefined,
      networkId: process.env.NETWORK_ID || "base-sepolia"
    };

    const walletProvider = await CdpWalletProvider.configureWithWallet(config);

    // Initialize AgentKit with all providers including our custom actions
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        wethActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n")
        }),
        cdpWalletActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n")
        }),
        submitFeedbackProvider,
        getAgentDataProvider
      ]
    });

    const tools = await getLangChainTools(agentkit);

    // Get initial agent data using the provider's method
    const agentData = await getAgentData(agentkit);

    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "AI Agent Registry Bot!" } };

    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a helpful agent that can interact with the AI Agent Registry on the blockchain.
        You can submit feedback for AI agents and retrieve their current strategies and performance data.
        
        Your model hash is ${process.env.AGENT_MODEL_HASH}
        You are running on network: ${process.env.NETWORK_ID}
        
        Current agent data:
        ${agentData}
        
        Before making any music recommendations:
        1. Make sure your recommendation aligns with your current strategy
        2. Learn from your recent feedback
        3. After the user responds to your recommendation, submit feedback using submit_feedback if the prompt contains both rating, comment, and alignsWithStrategy
        4. If the feedback do not align with your strategy, still submit the feedback but tell the user that it does not align with your strategy
        
        You can use get_agent_data at any time to update your knowledge of your current strategy
        and recent feedback from the blockchain.
        
        If you ever need funds and you're on base-sepolia, you can request them from the faucet.
        If you're on the local Hardhat network, funds should be available from the test accounts.
        
        Before executing your first action, get the wallet details to see what network you're on.
        If there is a 5XX (internal) HTTP error code, ask the user to try again later.
        
        Be concise and helpful with your responses.
        Refrain from restating your tools' descriptions unless explicitly requested.
      `
    });

    // Save wallet data
    const exportedWallet = await walletProvider.exportWallet();
    fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

/**
 * Run the agent autonomously with specified intervals
 */
async function runAutonomousMode(agent: any, config: any, interval = 10) {
  console.log("Starting autonomous mode...");

  while (true) {
    try {
      const thought = "Be creative and do something interesting with AI agents on the blockchain. " + "Choose an action or set of actions that highlights your abilities with the AI Agent Registry.";

      const stream = await agent.stream({ messages: [new HumanMessage(thought)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }

      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      }
      process.exit(1);
    }
  }
}

/**
 * Run the agent interactively based on user input
 */
async function runChatMode(agent: any, config: any) {
  console.log("Starting chat mode... Type 'exit' to end.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => new Promise((resolve) => rl.question(prompt, resolve));

  try {
    while (true) {
      const userInput = await question("\nPrompt: ");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

/**
 * Choose whether to run in autonomous or chat mode based on user input
 */
async function chooseMode(): Promise<"chat" | "auto"> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => new Promise((resolve) => rl.question(prompt, resolve));

  while (true) {
    console.log("\nAvailable modes:");
    console.log("1. chat    - Interactive chat mode");
    console.log("2. auto    - Autonomous action mode");

    const choice = (await question("\nChoose a mode (enter number or name): ")).toLowerCase().trim();

    if (choice === "1" || choice === "chat") {
      rl.close();
      return "chat";
    } else if (choice === "2" || choice === "auto") {
      rl.close();
      return "auto";
    }
    console.log("Invalid choice. Please try again.");
  }
}

/**
 * Start the agent
 */
async function main() {
  try {
    const { agent, config } = await initializeAgent();
    const mode = await chooseMode();

    if (mode === "chat") {
      await runChatMode(agent, config);
    } else {
      await runAutonomousMode(agent, config);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("Starting Agent...");
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
