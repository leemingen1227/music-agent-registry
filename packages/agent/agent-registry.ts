import { AIAgentRegistryABI } from "./constant/AIAgentRegistryABI";
import { Abi, Address } from "viem";
import { MusicTokenABI } from "./constant/MusicTokenABI";
import { Wallet, Coinbase, readContract, WalletAddress } from "@coinbase/coinbase-sdk";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { ethers } from "ethers";
dotenv.config();

Coinbase.configure({
  apiKeyName: process.env.CDP_API_KEY_NAME!,
  privateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n")!
});

interface AgentConfig {
  metadata: string;
  strategy: string;
  stake: bigint;
  initialFunding: bigint;
  creatorAddress: string;
}

export class AgentRegistry {
  private networkId: string;
  private agentsDir: string;

  constructor(networkId: string = "base-sepolia") {
    this.networkId = networkId;
    this.agentsDir = path.join(process.cwd(), "agents-wallets");
    if (!fs.existsSync(this.agentsDir)) {
      fs.mkdirSync(this.agentsDir, { recursive: true });
    }
  }

  private getAgentWalletPath(agentAddress: string | WalletAddress): string {
    return path.join(this.agentsDir, `${agentAddress}-wallet.json`);
  }

  async createNewAgent(config: AgentConfig): Promise<{ agentAddress: string; walletData: any }> {
    try {
      // Create a new wallet for the agent
      const wallet = await Wallet.create({
        networkId: this.networkId
      });
      const walletData = wallet.export();

      //fund the wallet with eth
      const faucet = await wallet.faucet();
      console.log("faucet", faucet);

      // Get the first (default) address
      const addresses = await wallet.listAddresses();
      const defaultAddress = addresses[0];
      console.log("defaultAddress", defaultAddress);
      if (!defaultAddress) {
        throw new Error("Failed to get wallet address");
      }

      // Save wallet data with creator address
      const agentData = {
        walletData,
        agentAddress: defaultAddress.getId(),
        creatorAddress: config.creatorAddress,
        config
      };

      fs.writeFileSync(this.getAgentWalletPath(defaultAddress.getId()), JSON.stringify(agentData, null, 2));

      return {
        agentAddress: defaultAddress.getId(),
        walletData
      };
    } catch (error) {
      console.error("Failed to create new agent:", error);
      throw error;
    }
  }

  async getAgentWallet(agentAddress: string, requestingAddress: string): Promise<any | null> {
    try {
      const walletPath = this.getAgentWalletPath(agentAddress);
      if (!fs.existsSync(walletPath)) {
        return null;
      }

      const agentData = JSON.parse(fs.readFileSync(walletPath, "utf8"));

      // Only return wallet data if requested by creator
      // if (agentData.creatorAddress.toLowerCase() !== requestingAddress.toLowerCase()) {
      //   return null;
      // }

      return agentData.walletData;
    } catch (error) {
      console.error("Failed to get agent wallet:", error);
      return null;
    }
  }

  async checkAgentBalance(agentAddress: string): Promise<bigint> {
    try {
      const tokenAddress = process.env.MUSIC_TOKEN_ADDRESS! as Address;

      const balance = (await readContract({
        networkId: this.networkId,
        abi: MusicTokenABI as Abi,
        contractAddress: tokenAddress,
        method: "balanceOf",
        args: {
          account: agentAddress
        }
      })) as bigint;

      return balance;
    } catch (error) {
      console.error("Failed to check agent balance:", error);
      return 0n;
    }
  }

  async initializeAgent(agentAddress: string): Promise<boolean> {
    try {
      const walletPath = this.getAgentWalletPath(agentAddress);
      if (!fs.existsSync(walletPath)) {
        throw new Error("Agent wallet not found");
      }

      const agentData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
      const wallet = await Wallet.import(agentData.walletData, this.networkId);
      console.log("success importing wallet");
      const config = agentData.config;

      // Check if agent has enough balance for minimum stake
      const minimumStake = ethers.parseEther("100");
      const balance = await this.checkAgentBalance(agentAddress);
      if (balance < minimumStake) {
        throw new Error(`Insufficient balance. Has: ${balance}, Needs: ${minimumStake}`);
      }

      const parseStake = ethers.parseEther(config.stake.toString());


      // Approve token spending
      const tokenAddress = process.env.MUSIC_TOKEN_ADDRESS! as Address;
      const registryAddress = process.env.AI_AGENT_REGISTRY_ADDRESS! as Address;

      const approvalInvocation = await wallet.invokeContract({
        contractAddress: tokenAddress,
        method: "approve",
        args: {
          spender: registryAddress,
          amount: parseStake.toString()
        },
        abi: MusicTokenABI
      });

      await approvalInvocation.wait();

      // Register the agent
      const registrationInvocation = await wallet.invokeContract({
        contractAddress: registryAddress,
        method: "submitAgent",
        args: {
          metadata: config.metadata,
          strategy: config.strategy,
          stake: parseStake.toString()
        },
        abi: AIAgentRegistryABI
      });

      await registrationInvocation.wait();

      console.log("Agent initialization completed successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize agent:", error);
      return false;
    }
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
}

// Export a default instance for backward compatibility
export const agentRegistry = new AgentRegistry(process.env.NETWORK_ID || "base-sepolia");
