"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, useBalance } from "wagmi";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";

interface ChallengeAgentModalProps {
  agentAddress: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ChallengeAgentModal = ({ agentAddress, isOpen, onClose }: ChallengeAgentModalProps) => {
  const { address } = useAccount();
  const [stakeAmount, setStakeAmount] = useState("100");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: musicTokenContract } = useScaffoldContract({
    contractName: "MusicToken",
  });

  const { data: balance } = useBalance({
    address,
    token: musicTokenContract?.address,
  });

  const { writeContractAsync: challengeAgent } = useScaffoldWriteContract({
    contractName: "AIAgentRegistry",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setIsSubmitting(true);
    try {
      await challengeAgent({
        functionName: "challengeAgent",
        args: [agentAddress, parseEther(stakeAmount)],
      });
      onClose();
    } catch (error) {
      console.error("Error challenging agent:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-200 rounded-lg p-6 max-w-lg w-full">
        <h2 className="text-2xl font-semibold mb-4">Challenge Agent</h2>

        <div className="mb-4">
          <h3 className="font-medium mb-2">Agent Address:</h3>
          <p className="text-sm bg-base-300 p-3 rounded">{agentAddress}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text">Stake Amount (MUSIC tokens)</span>
            </label>
            <div className="join w-full">
              <input
                type="number"
                min="100"
                step="1"
                className="input input-bordered w-full join-item"
                value={stakeAmount}
                onChange={e => setStakeAmount(e.target.value)}
                placeholder="Minimum 100 MUSIC tokens"
              />
              <button
                type="button"
                className="btn join-item"
                onClick={() => setStakeAmount(balance?.formatted || "100")}
              >
                Max
              </button>
            </div>
            <label className="label">
              <span className="label-text-alt">Your balance: {balance?.formatted || "0"} MUSIC</span>
            </label>
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
              <p>Challenging an agent requires a minimum stake of 100 MUSIC tokens.</p>
              <p>The challenge period lasts for 10 minutes during which token holders can vote.</p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={isSubmitting || !address || parseFloat(stakeAmount) < 100}
            >
              {isSubmitting ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                "Challenge Agent"
              )}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
