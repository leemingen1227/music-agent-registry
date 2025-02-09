"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseEther } from "viem";
import { useAccount, useBalance } from "wagmi";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { notification } from "~~/utils/scaffold-eth";

interface WalletData {
  agentAddress: string;
  walletData: {
    walletId: string;
    seed: string;
    networkId: string;
  };
  message: string;
}

const CreateAgentPage = () => {
  const router = useRouter();
  const { address } = useAccount();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"create" | "fund" | "initialize">("create");
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [formData, setFormData] = useState({
    strategy: "",
    stake: "100",
    metadata: "",
  });

  const { writeContractAsync: transfer } = useScaffoldWriteContract({
    contractName: "MusicToken",
  });

  const { data: musicTokenContract } = useScaffoldContract({
    contractName: "MusicToken",
  });

  // Get agent's token balance
  const { data: agentBalance, refetch: refetchBalance } = useBalance({
    address: walletData?.agentAddress as `0x${string}`,
    token: musicTokenContract?.address,
  });

  // Get agent's ETH balance
  const { data: agentEthBalance, refetch: refetchEthBalance } = useBalance({
    address: walletData?.agentAddress as `0x${string}`,
  });

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setIsSubmitting(true);
    try {
      // Create agent wallet
      const response = await fetch(`${process.env.NEXT_PUBLIC_AGENT_SERVER_URL}/agent/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Address": address,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to create agent");
      }

      const data = await response.json();
      setWalletData(data);
      notification.success("Agent wallet created successfully!");
      setStep("fund");
    } catch (error) {
      console.error("Error creating agent:", error);
      notification.error("Failed to create agent wallet");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferTokens = async () => {
    if (!address || !walletData) return;

    setIsSubmitting(true);
    try {
      await transfer({
        functionName: "transfer",
        args: [walletData.agentAddress, parseEther(formData.stake)],
      });
      await Promise.all([refetchBalance(), refetchEthBalance()]);
      notification.success("Tokens transferred successfully!");
    } catch (error) {
      console.error("Error transferring tokens:", error);
      notification.error("Failed to transfer tokens");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitializeAgent = async () => {
    if (!address || !walletData) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AGENT_SERVER_URL}/agent/initialize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Address": address,
        },
        body: JSON.stringify({ agentAddress: walletData.agentAddress }),
      });

      if (!response.ok) {
        throw new Error("Failed to initialize agent");
      }

      notification.success("Agent initialized successfully!");
      router.push(`/agents/${walletData.agentAddress}`);
    } catch (error) {
      console.error("Error initializing agent:", error);
      notification.error("Failed to initialize agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadWallet = () => {
    if (!walletData) return;
    
    const dataStr = JSON.stringify(walletData.walletData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agent-wallet-${walletData.agentAddress}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasEnoughFunds =
    agentBalance &&
    agentEthBalance &&
    BigInt(agentBalance.value) >= parseEther(formData.stake) &&
    BigInt(agentEthBalance.value) > 0n;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4 text-base-content">Create New Agent</h1>
          <p className="text-base-content/70 max-w-2xl mx-auto">Register your AI agent with a strategy and stake to join the decentralized music recommendation network.</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <ul className="steps steps-horizontal w-full">
            <li className={`step ${step === "create" ? "step-primary" : step === "fund" || step === "initialize" ? "step-primary step-success" : ""}`}>Configure</li>
            <li className={`step ${step === "fund" ? "step-primary" : step === "initialize" ? "step-primary step-success" : ""}`}>Fund</li>
            <li className={`step ${step === "initialize" ? "step-primary" : ""}`}>Initialize</li>
          </ul>
        </div>

        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body p-8">
            {step === "create" ? (
              <form onSubmit={handleCreateAgent} className="space-y-8">
                <div className="form-control">
                  <label className="label">
                    <div>
                      <span className="label-text text-base font-semibold">Strategy</span>
                      <p className="text-sm text-base-content/60 mt-1">Define how your agent will handle music recommendations and user interactions</p>
                    </div>
                  </label>
                  <textarea
                    className="textarea textarea-bordered min-h-[200px] bg-base-100 font-mono text-sm rounded-3xl"
                    value={formData.strategy}
                    onChange={e => setFormData({ ...formData, strategy: e.target.value })}
                    placeholder="Example: 1. When receiving music recommendations: - Analyze user's previous interactions - Consider genre preferences - Factor in current trends 2. For user interactions: - Maintain conversational context - Provide detailed explanations - Adapt to feedback"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <div>
                      <span className="label-text text-base font-semibold">Initial Stake</span>
                      <p className="text-sm text-base-content/60 mt-1">Minimum requirement: 100 MUSIC tokens</p>
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="100"
                      step="1"
                      className="input input-bordered w-full bg-base-100 font-mono rounded-3xl pr-24"
                      value={formData.stake}
                      onChange={e => setFormData({ ...formData, stake: e.target.value })}
                      placeholder="Enter stake amount"
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-base-content/70">
                      MUSIC
                    </span>
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <div>
                      <span className="label-text text-base font-semibold">Metadata</span>
                      <p className="text-sm text-base-content/60 mt-1">IPFS hash or additional configuration data</p>
                    </div>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered bg-base-100 font-mono text-sm rounded-3xl"
                    value={formData.metadata}
                    onChange={e => setFormData({ ...formData, metadata: e.target.value })}
                    placeholder="ipfs://..."
                    required
                  />
                </div>

                <div className="alert bg-info/10 text-info border-info/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div>
                    <h3 className="font-medium mb-1">Important Information</h3>
                    <p className="text-sm opacity-90">Creating an agent requires a minimum stake of 100 MUSIC tokens. After creation, you'll need to fund the agent's wallet.</p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isSubmitting || !address}
                >
                  {isSubmitting ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Creating Wallet...
                    </>
                  ) : (
                    "Create Agent Wallet"
                  )}
                </button>
              </form>
            ) : step === "fund" ? (
              <div className="space-y-8">
                <div className="alert bg-success/10 border border-success/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-success shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="font-semibold text-success mb-2">Agent Wallet Created Successfully</h3>
                    <div className="p-3 bg-base-200 rounded-lg font-mono text-sm break-all">
                      {walletData?.agentAddress}
                    </div>
                    <button
                      onClick={handleDownloadWallet}
                      className="btn btn-sm btn-ghost gap-2 mt-3 text-success"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Wallet Configuration
                    </button>
                  </div>
                </div>

                <div className="card bg-base-200">
                  <div className="card-body">
                    <h3 className="card-title text-base-content">Required Funding</h3>
                    <div className="divider my-2"></div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-base-100 rounded-xl">
                        <div>
                          <h4 className="font-medium">MUSIC Tokens</h4>
                          <p className="text-sm text-base-content/60">Required for agent registration</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-lg">{formData.stake} MUSIC</p>
                          <p className="text-sm text-base-content/60">Current: {agentBalance?.formatted || "0"}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-base-100 rounded-xl">
                        <div>
                          <h4 className="font-medium">ETH Balance</h4>
                          <p className="text-sm text-base-content/60">Required for transaction fees</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-lg">{agentEthBalance?.formatted || "0"} ETH</p>
                          <p className="text-sm text-base-content/60">For gas fees</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={handleTransferTokens}
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Transferring Tokens...
                      </>
                    ) : (
                      "Transfer MUSIC Tokens"
                    )}
                  </button>

                  <button 
                    onClick={() => setStep("initialize")} 
                    className="btn btn-primary btn-outline" 
                    disabled={!hasEnoughFunds}
                  >
                    Continue to Initialization
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="alert bg-info/10 border-info/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-info shrink-0 w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div>
                    <h3 className="font-semibold mb-2">Ready for Initialization</h3>
                    <p className="text-sm opacity-90">Your agent's wallet has been successfully funded and is ready to be initialized on the blockchain. This final step will register your agent in the network.</p>
                  </div>
                </div>

                <button
                  onClick={handleInitializeAgent}
                  className="btn btn-primary w-full"
                  disabled={isSubmitting || !address}
                >
                  {isSubmitting ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Initializing Agent...
                    </>
                  ) : (
                    "Initialize Agent"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAgentPage;
