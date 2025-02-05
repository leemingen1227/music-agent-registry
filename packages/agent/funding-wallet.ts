import { JsonRpcProvider, Wallet } from "ethers";
import { encodeFunctionData, Address } from "viem";

const MUSIC_TOKEN_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  }
] as const;

export class FundingWallet {
  private wallet: Wallet;
  private provider: JsonRpcProvider;

  constructor() {
    if (!process.env.FUNDING_WALLET_PRIVATE_KEY) {
      throw new Error("FUNDING_WALLET_PRIVATE_KEY not set");
    }
    if (!process.env.RPC_URL) {
      throw new Error("RPC_URL not set");
    }
    
    this.provider = new JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new Wallet(process.env.FUNDING_WALLET_PRIVATE_KEY, this.provider);
  }

  async checkBalance(): Promise<bigint> {
    const tokenAddress = process.env.MUSIC_TOKEN_ADDRESS! as Address;
    const data = encodeFunctionData({
      abi: MUSIC_TOKEN_ABI,
      functionName: "balanceOf",
      args: [this.wallet.address as Address]
    });

    const balance = await this.provider.call({
      to: tokenAddress,
      data
    });

    return BigInt(balance);
  }

  async fundAgent(agentAddress: string, amount: bigint): Promise<boolean> {
    try {
      const tokenAddress = process.env.MUSIC_TOKEN_ADDRESS! as Address;
      
      // Check if funding wallet has enough balance
      const balance = await this.checkBalance();
      if (balance < amount) {
        throw new Error(`Insufficient balance. Has: ${balance}, Needs: ${amount}`);
      }

      const data = encodeFunctionData({
        abi: MUSIC_TOKEN_ABI,
        functionName: "transfer",
        args: [agentAddress as Address, amount]
      });

      // Send transaction
      const tx = await this.wallet.sendTransaction({
        to: tokenAddress,
        data
      });

      // Wait for confirmation
      await tx.wait();
      
      console.log(`Successfully funded agent ${agentAddress} with ${amount} tokens`);
      return true;
    } catch (error) {
      console.error("Failed to fund agent:", error);
      return false;
    }
  }
} 