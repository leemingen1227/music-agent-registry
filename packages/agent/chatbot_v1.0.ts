import { CdpAgentkit } from "@coinbase/cdp-agentkit-core";
import { CdpToolkit } from "@coinbase/cdp-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { CdpTool } from "@coinbase/cdp-langchain";
import { JsonRpcProvider, Contract } from "ethers";
import { z } from "zod";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as readline from "readline";
import { readContract, Wallet } from "@coinbase/coinbase-sdk";

dotenv.config();

// Contract ABI interfaces
interface AbiParameter {
  name: string;
  type: string;
  indexed?: boolean;
}

interface AbiEvent {
  name: string;
  type: string;
  inputs: AbiParameter[];
  anonymous?: boolean;
}

interface AbiFunction {
  name: string;
  type: string;
  inputs: AbiParameter[];
  outputs?: AbiParameter[];
  stateMutability?: string;
}

type AbiItem = AbiFunction | AbiEvent;

// Contract ABI for the AI Agent Registry
const AI_AGENT_REGISTRY_ABI: AbiItem[] = [
  {
    name: "getAgentStrategy",
    type: "function",
    inputs: [{ name: "modelHash", type: "string" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view"
  },
  {
    name: "submitFeedback",
    type: "function",
    inputs: [
      { name: "modelHash", type: "string" },
      { name: "alignsWithStrategy", type: "bool" },
      { name: "rating", type: "uint8" },
      { name: "comment", type: "string" }
    ],
    stateMutability: "nonpayable"
  },
  {
    name: "FeedbackSubmitted",
    type: "event",
    inputs: [
      { name: "modelHash", type: "string", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "alignsWithStrategy", type: "bool", indexed: false },
      { name: "rating", type: "uint8", indexed: false },
      { name: "comment", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false }
    ]
  }
];

// Define the prompts for tools
const SUBMIT_FEEDBACK_PROMPT = `
Submits feedback for an AI agent's recommendation, including whether it aligns with the strategy,
a rating (1-5), and a comment explaining the rating.
`;

const REFRESH_DATA_PROMPT = `
Updates your knowledge of your current strategy and recent feedback from the blockchain.
Use this when you want to ensure you have the latest information about your performance and strategy.
`;

// Define the input schemas
const SubmitFeedbackInput = z.object({
  modelHash: z.string().describe("The model hash of the AI agent. e.g. 'QmHash123'"),
  alignsWithStrategy: z.boolean().describe("Whether the recommendation aligns with the agent's strategy"),
  rating: z.number().int().min(1).max(5).describe("Rating from 1-5, where 5 is best"),
  comment: z.string().describe("Detailed feedback comment explaining the rating")
});

const RefreshDataInput = z.object({});

interface FeedbackEvent {
  user: string;
  alignsWithStrategy: boolean;
  rating: number;
  comment: string;
  timestamp: bigint;
}

// Tool functions
async function invokeContract(wallet: any, contractAddress: string, method: string, abi: Array<AbiFunction>, args: Record<string, any>): Promise<string> {
  try {
    const methodAbi = abi.find((func) => func.name === method);
    if (!methodAbi) {
      throw new Error(`Method ${method} not found in ABI`);
    }

    const contractInvocation = await wallet.invokeContract({
      contractAddress,
      method,
      args,
      abi
    });

    const receipt = await contractInvocation.wait();
    const txHash = receipt.getTransactionHash();

    if (!txHash) {
      return `Contract invocation of ${method} completed, but transaction hash is not available`;
    }

    return `Successfully invoked ${method}. Transaction hash:${txHash}`;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error invoking ${method}:`, error);
      return `Failed to invoke ${method}: ${error.message}`;
    }
    return `Failed to invoke ${method} due to an unknown error`;
  }
}

async function refreshAgentData(wallet: any, args: {}): Promise<string> {
  try {
    const provider = new JsonRpcProvider(process.env.RPC_URL);
    const contract = new Contract(process.env.AI_AGENT_REGISTRY_ADDRESS!, AI_AGENT_REGISTRY_ABI, provider);

    // Get agent's strategy
    const strategy = await contract.getAgentStrategy(process.env.AGENT_MODEL_HASH!);

    // Get recent feedback using event logs
    const eventFilter = contract.filters["FeedbackSubmitted(string,address,bool,uint8,string,uint256)"](process.env.AGENT_MODEL_HASH);
    const events = await contract.queryFilter(eventFilter);
    const recentEvents = events.slice(-5); // Get last 5 feedback events

    let feedbackStr = "Recent feedback:\n";
    for (const event of recentEvents) {
      // Type assertion for event log
      const log = event as unknown as {
        args: [string, string, boolean, number, string, bigint];
      };

      if (log.args) {
        const [modelHash, user, alignsWithStrategy, rating, comment, timestamp] = log.args;
        const date = new Date(Number(timestamp) * 1000);
        feedbackStr += `\n- User: ${user}\n  Rating: ${rating}/5\n  Aligns with strategy: ${alignsWithStrategy}\n  Comment: ${comment}\n  Time: ${date.toISOString()}\n`;
      }
    }

    return `Updated agent data:\n\nCurrent strategy: ${strategy}\n\n${feedbackStr}`;
  } catch (error) {
    console.error("Error refreshing agent data:", error);
    return "Failed to refresh agent data. Please try again later.";
  }
}

// Create AI Agent Registry Tools
function createAIAgentRegistryTools(agentkit: CdpAgentkit) {
  const submitFeedbackTool = new CdpTool(
    {
      name: "submit_feedback",
      description: SUBMIT_FEEDBACK_PROMPT,
      argsSchema: SubmitFeedbackInput,
      func: async (wallet: any, params: z.infer<typeof SubmitFeedbackInput>) => {
        return invokeContract(wallet, process.env.AI_AGENT_REGISTRY_ADDRESS!, "submitFeedback", AI_AGENT_REGISTRY_ABI as Array<AbiFunction>, {
          modelHash: params.modelHash,
          alignsWithStrategy: params.alignsWithStrategy,
          rating: params.rating.toString(),
          comment: params.comment
        });
      }
    },
    agentkit
  );

  const refreshDataTool = new CdpTool(
    {
      name: "refresh_agent_data",
      description: REFRESH_DATA_PROMPT,
      argsSchema: RefreshDataInput,
      func: refreshAgentData
    },
    agentkit
  );

  return [submitFeedbackTool, refreshDataTool];
}

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  const requiredVars = [
    "OPENAI_API_KEY",
    "CDP_API_KEY_NAME",
    "CDP_API_KEY_PRIVATE_KEY",
    "AI_AGENT_REGISTRY_ADDRESS",
    "RPC_URL",
    "AGENT_MODEL_HASH",
    "NETWORK_ID" // Make NETWORK_ID required
  ];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach((varName) => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

validateEnvironment();

// Configure files to persist data
const WALLET_DATA_FILE = "wallet_data.txt";

/**
 * Get the agent's own strategy and recent feedback
 *
 * @param agentkit - CDP agentkit instance
 * @returns Promise containing the agent's strategy and recent feedback
 */
async function getAgentData(agentkit: CdpAgentkit): Promise<{ strategy: string; feedback: string }> {
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const contract = new Contract(process.env.AI_AGENT_REGISTRY_ADDRESS!, AI_AGENT_REGISTRY_ABI, provider);

  try {
    // Get agent's strategy
    const strategy = await contract.getAgentStrategy(process.env.AGENT_MODEL_HASH!);

    // Get recent feedback
    const filter = contract.filters.FeedbackSubmitted(process.env.AGENT_MODEL_HASH);
    const events = await contract.queryFilter(filter);
    const recentEvents = events.slice(-5); // Get last 5 feedback events

    let feedbackStr = "Recent feedback:\n";
    for (const event of recentEvents) {
      const eventData = event as unknown as { args: FeedbackEvent };
      const { user, alignsWithStrategy, rating, comment, timestamp } = eventData.args;
      const date = new Date(Number(timestamp) * 1000);
      feedbackStr += `\n- User: ${user}\n  Rating: ${rating}/5\n  Aligns with strategy: ${alignsWithStrategy}\n  Comment: ${comment}\n  Time: ${date.toISOString()}\n`;
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
 * Initialize the agent with CDP Agentkit and AI Agent Registry tools
 *
 * @returns Agent executor and config
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
      cdpWalletData: walletDataStr || undefined,
      networkId: process.env.NETWORK_ID || "base-sepolia"
    };

    const agentkit = await CdpAgentkit.configureWithWallet(config);

    // Get agent's own data from the registry
    const agentData = await getAgentData(agentkit);
    console.log("\nInitializing agent with model hash:", process.env.AGENT_MODEL_HASH);
    console.log("Network ID:", process.env.NETWORK_ID);
    console.log("Current strategy:", agentData.strategy);
    console.log(agentData.feedback);

    // Get base CDP tools
    const cdpToolkit = new CdpToolkit(agentkit);
    const cdpTools = cdpToolkit.getTools();

    // Get AI Agent Registry tools
    const aiAgentTools = createAIAgentRegistryTools(agentkit);

    // Combine all tools
    const tools = [...cdpTools, ...aiAgentTools];

    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot with AI Registry!" } };

    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit and the AI Agent Registry. 
        You can interact with AI agents on the blockchain and submit feedback for their recommendations.
        
        Your model hash is ${process.env.AGENT_MODEL_HASH}
        Your current strategy is: ${agentData.strategy}
        You are running on network: ${process.env.NETWORK_ID} (${process.env.NETWORK_ID === "31337" ? "Local Hardhat" : "Base Sepolia"})
        
        Recent feedback on your performance:
        ${agentData.feedback}
        
        Before making any music recommendations:
        1. Make sure your recommendation aligns with your current strategy shown above
        2. Learn from your recent feedback shown above
        3. After the user responds to your recommendation, submit feedback using submit_feedback
        
        You can use refresh_agent_data at any time to update your knowledge of your current strategy
        and recent feedback from the blockchain. This is useful when you want to ensure you have
        the latest information before making recommendations.
        
        If you ever need funds and you're on base-sepolia, you can request them from the faucet.
        If you're on the local Hardhat network, funds should be available from the test accounts.
        
        Before executing your first action, get the wallet details to see what network you're on.
        If there is a 5XX (internal) HTTP error code, ask the user to try again later.
        
        If someone asks you to do something you can't do with your currently available tools,
        you must say so, and encourage them to implement it themselves using the CDP SDK + Agentkit,
        recommend they go to docs.cdp.coinbase.com for more information.
        
        Be concise and helpful with your responses.
        Refrain from restating your tools' descriptions unless it is explicitly requested.
      `
    });

    const exportedWallet = await agentkit.exportWallet();
    fs.writeFileSync(WALLET_DATA_FILE, exportedWallet);

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

/**
 * Run the agent autonomously with specified intervals
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 * @param interval - Time interval between actions in seconds
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
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
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
 *
 * @returns Selected mode
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
 * Start the chatbot agent
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
