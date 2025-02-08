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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Create New Agent</h1>

        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            {step === "create" ? (
              <form onSubmit={handleCreateAgent} className="space-y-6">
                <div>
                  <label className="label">
                    <span className="label-text">Strategy</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered w-full h-32"
                    value={formData.strategy}
                    onChange={e => setFormData({ ...formData, strategy: e.target.value })}
                    placeholder="Enter the agent's strategy..."
                    required
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">Initial Stake (MUSIC tokens)</span>
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="1"
                    className="input input-bordered w-full"
                    value={formData.stake}
                    onChange={e => setFormData({ ...formData, stake: e.target.value })}
                    placeholder="Minimum 100 MUSIC tokens"
                    required
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">Metadata</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.metadata}
                    onChange={e => setFormData({ ...formData, metadata: e.target.value })}
                    placeholder="IPFS hash or other metadata"
                    required
                  />
                </div>

                <div className="alert alert-info">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-current shrink-0 w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <div>
                    <p>Creating an agent requires a minimum stake of 100 MUSIC tokens.</p>
                    <p>You'll need to fund the agent's wallet after creation.</p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isSubmitting || !address}
                >
                  {isSubmitting ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    "Create Agent Wallet"
                  )}
                </button>
              </form>
            ) : step === "fund" ? (
              <div className="space-y-6">
                <div className="alert alert-success">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current shrink-0 h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-bold">Agent Wallet Created!</h3>
                    <p>Agent Address: {walletData?.agentAddress}</p>
                    <button
                      onClick={handleDownloadWallet}
                      className="btn btn-sm btn-ghost mt-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Wallet
                    </button>
                  </div>
                </div>

                <div className="alert alert-info">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-current shrink-0 w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <div>
                    <p>Please fund the agent's wallet with:</p>
                    <ul className="list-disc list-inside mt-2">
                      <li>
                        {formData.stake} MUSIC tokens (current: {agentBalance?.formatted || "0"})
                      </li>
                      <li>Some ETH for gas (current: {agentEthBalance?.formatted || "0"})</li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={handleTransferTokens}
                    className={`btn btn-primary ${isSubmitting ? "loading" : ""}`}
                    disabled={isSubmitting}
                  >
                    Transfer MUSIC Tokens
                  </button>

                  <button onClick={() => setStep("initialize")} className="btn btn-primary" disabled={!hasEnoughFunds}>
                    Continue to Initialize
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="alert alert-info">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-current shrink-0 w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <div>
                    <p>Your agent's wallet has been funded.</p>
                    <p>Click below to initialize the agent and register it on the blockchain.</p>
                  </div>
                </div>

                <button
                  onClick={handleInitializeAgent}
                  className="btn btn-primary w-full"
                  disabled={isSubmitting || !address}
                >
                  {isSubmitting ? (
                    <span className="loading loading-spinner loading-xs"></span>
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
