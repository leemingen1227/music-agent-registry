import { AIAgentRegistryABI } from "./constant/AIAgentRegistryABI";
import { Abi, Address } from "viem";
import { FundingWallet } from "./funding-wallet";
import { MusicTokenABI } from "./constant/MusicTokenABI";
import { Wallet, Coinbase, readContract } from "@coinbase/coinbase-sdk";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();
Coinbase.configure({
  apiKeyName: process.env.CDP_API_KEY_NAME!,
  privateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n")!
});

export class AgentRegistry {
  private wallet: Wallet | null = null;
  private networkId: string;

  constructor(networkId: string = "base-sepolia") {
    this.networkId = networkId;
  }

  private async initializeWallet(): Promise<Wallet> {
    if (!this.wallet) {
      const walletData = JSON.parse(fs.readFileSync("wallet_data.txt", "utf8"));
      this.wallet = await Wallet.import(walletData, this.networkId);
    }
    return this.wallet;
  }

  async checkAgentRegistration(agentAddress: string): Promise<boolean> {
    try {
      const registryAddress = process.env.AI_AGENT_REGISTRY_ADDRESS! as Address;

      const data = (await readContract({
        networkId: this.networkId,
        abi: AIAgentRegistryABI as Abi,
        contractAddress: registryAddress,
        method: "getAgent",
        args: {
          modelAddress: agentAddress
        }
      })) as { isListed: boolean };

      return data.isListed;
    } catch (error) {
      console.error("Failed to check agent registration:", error);
      return false;
    }
  }

  async approveTokenSpending(amount: bigint): Promise<boolean> {
    try {
      const wallet = await this.initializeWallet();
      const tokenAddress = process.env.MUSIC_TOKEN_ADDRESS! as Address;
      const registryAddress = process.env.AI_AGENT_REGISTRY_ADDRESS! as Address;

      const transferArgs = {
        spender: registryAddress,
        amount: amount.toString()
      };

      console.log("Creating contract invocation with args:", transferArgs);
      const contractInvocation = await wallet.invokeContract({
        contractAddress: tokenAddress,
        method: "approve",
        args: transferArgs,
        abi: MusicTokenABI
      });

      console.log("Contract invocation created, waiting for confirmation...");
      const result = await contractInvocation.wait();
      console.log("Contract invocation result:", result);

      return true;
    } catch (error) {
      console.error("Failed to approve token spending:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);
      }
      return false;
    }
  }

  async registerAgent(metadata: string, strategy: string, stake: bigint): Promise<boolean> {
    try {
      const wallet = await this.initializeWallet();
      const transferArgs = {
        metadata: metadata,
        strategy: strategy,
        stake: stake.toString()
      };

      const contractInvocation = await wallet.invokeContract({
        contractAddress: process.env.AI_AGENT_REGISTRY_ADDRESS! as Address,
        method: "submitAgent",
        args: transferArgs,
        abi: AIAgentRegistryABI
      });

      console.log("Contract invocation created, waiting for confirmation...");
      const result = await contractInvocation.wait();
      console.log("Contract invocation result:", result);

      return true;
    } catch (error) {
      console.error("Failed to register agent:", error);
      return false;
    }
  }

  async fundAgentWithTokens(agentAddress: string, amount: bigint): Promise<boolean> {
    try {
      const fundingWallet = new FundingWallet();
      return await fundingWallet.fundAgent(agentAddress, amount);
    } catch (error) {
      console.error("Failed to fund agent with tokens:", error);
      return false;
    }
  }

  async initializeAgentRegistration(
    agentAddress: string,
    config: {
      metadata: string;
      strategy: string;
      stake: bigint;
      initialFunding: bigint;
    }
  ): Promise<boolean> {
    try {
      // Check if already registered
      const isRegistered = await this.checkAgentRegistration(agentAddress);
      if (isRegistered) {
        console.log("Agent already registered");
        return true;
      }

      // Fund the agent first
      const fundingSuccess = await this.fundAgentWithTokens(agentAddress, config.initialFunding);
      if (!fundingSuccess) {
        throw new Error("Failed to fund agent with initial tokens");
      }

      // Approve token spending
      const approvalSuccess = await this.approveTokenSpending(config.initialFunding);
      if (!approvalSuccess) {
        throw new Error("Failed to approve token spending");
      }

      // Register the agent
      const registrationSuccess = await this.registerAgent(config.metadata, config.strategy, config.stake);
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
}

// Export a default instance for backward compatibility
export const agentRegistry = new AgentRegistry(process.env.NETWORK_ID || "base-sepolia");
