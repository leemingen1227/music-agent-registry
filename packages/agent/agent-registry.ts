import { AgentKit, EvmWalletProvider, CdpWalletProvider } from "@coinbase/agentkit";
import { Contract, JsonRpcProvider } from "ethers";
import { AIAgentRegistryABI } from "./constant";
import { encodeFunctionData, Abi, Address } from "viem";
import { FundingWallet } from "./funding-wallet";

const MUSIC_TOKEN_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  }
] as const;

export async function checkAgentRegistration(
  walletProvider: EvmWalletProvider,
  agentAddress: string
): Promise<boolean> {
  try {
    const registryAddress = process.env.AI_AGENT_REGISTRY_ADDRESS! as Address;
    const data = await walletProvider.readContract({
      address: registryAddress,
      abi: AIAgentRegistryABI as Abi,
      functionName: "getAgent",
      args: [agentAddress]
    }) as { isListed: boolean };
    
    return data.isListed;
  } catch (error) {
    console.error("Failed to check agent registration:", error);
    return false;
  }
}

export async function approveTokenSpending(
  walletProvider: EvmWalletProvider,
  amount: bigint
): Promise<boolean> {
  try {
    const tokenAddress = process.env.MUSIC_TOKEN_ADDRESS! as Address;
    const registryAddress = process.env.AI_AGENT_REGISTRY_ADDRESS! as Address;
    
    const data = encodeFunctionData({
      abi: MUSIC_TOKEN_ABI,
      functionName: "approve",
      args: [registryAddress, amount]
    });

    const hash = await walletProvider.sendTransaction({
      to: tokenAddress,
      data
    });

    await walletProvider.waitForTransactionReceipt(hash);
    return true;
  } catch (error) {
    console.error("Failed to approve token spending:", error);
    return false;
  }
}

export async function registerAgent(
  walletProvider: EvmWalletProvider,
  metadata: string,
  strategy: string,
  stake: bigint
): Promise<boolean> {
  try {
    // 1. First approve token spending
    const approved = await approveTokenSpending(walletProvider, stake);
    if (!approved) {
      throw new Error("Failed to approve token spending");
    }

    // 2. Submit agent to registry
    const data = encodeFunctionData({
      abi: AIAgentRegistryABI,
      functionName: "submitAgent",
      args: [metadata, strategy, stake]
    });

    const hash = await walletProvider.sendTransaction({
      to: process.env.AI_AGENT_REGISTRY_ADDRESS! as `0x${string}`,
      data
    });

    await walletProvider.waitForTransactionReceipt(hash);
    
    return true;
  } catch (error) {
    console.error("Failed to register agent:", error);
    return false;
  }
}

export async function fundAgentWithTokens(
  walletProvider: EvmWalletProvider,
  agentAddress: string,
  amount: bigint
): Promise<boolean> {
  try {
    const fundingWallet = new FundingWallet();
    return await fundingWallet.fundAgent(agentAddress, amount);
  } catch (error) {
    console.error("Failed to fund agent with tokens:", error);
    return false;
  }
}

export async function initializeAgentRegistration(
  walletProvider: EvmWalletProvider,
  config: {
    metadata: string;
    strategy: string;
    stake: bigint;
    initialFunding: bigint;
  }
): Promise<boolean> {
  try {
    const agentAddress = await walletProvider.getAddress() as Address;
    
    // Check if already registered
    const isRegistered = await checkAgentRegistration(walletProvider, agentAddress);
    if (isRegistered) {
      console.log("Agent already registered");
      return true;
    }

    // Fund the agent first
    const fundingSuccess = await fundAgentWithTokens(
      walletProvider,
      agentAddress,
      config.initialFunding
    );
    if (!fundingSuccess) {
      throw new Error("Failed to fund agent with initial tokens");
    }

    // Approve token spending
    const approvalSuccess = await approveTokenSpending(
      walletProvider,
      config.stake
    );
    if (!approvalSuccess) {
      throw new Error("Failed to approve token spending");
    }

    // Register the agent
    const registrationSuccess = await registerAgent(
      walletProvider,
      config.metadata,
      config.strategy,
      config.stake
    );
    if (!registrationSuccess) {
      throw new Error("Failed to register agent");
    }

    console.log("Agent registration completed successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize agent registration:", error);
    return false;
  }
} 
