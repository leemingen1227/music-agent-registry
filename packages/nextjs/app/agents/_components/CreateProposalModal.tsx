"use client";

import { useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";

interface CreateProposalModalProps {
  agentAddress: string;
  currentStrategy: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CreateProposalModal = ({ agentAddress, currentStrategy, isOpen, onClose }: CreateProposalModalProps) => {
  const { address } = useAccount();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    ipfsMetadata: "",
    newStrategy: "",
  });

  const { data: musicTokenContract } = useScaffoldContract({
    contractName: "MusicToken",
  });

  const { data: balance } = useBalance({
    address,
    token: musicTokenContract?.address,
  });

  const { writeContractAsync: createProposal } = useScaffoldWriteContract({
    contractName: "AgentGovernance",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setIsSubmitting(true);
    try {
      await createProposal({
        functionName: "createProposal",
        args: [agentAddress, formData.description, formData.ipfsMetadata, formData.newStrategy],
      });
      onClose();
    } catch (error) {
      console.error("Error creating proposal:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasEnoughTokens = balance && BigInt(balance.value) >= BigInt("100000000000000000000"); // 100 MUSIC tokens

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-200 rounded-lg p-6 max-w-lg w-full">
        <h2 className="text-2xl font-semibold mb-4">Create Governance Proposal</h2>

        <div className="mb-6">
          <h3 className="font-medium mb-2">Agent Address:</h3>
          <p className="text-sm bg-base-300 p-3 rounded">{agentAddress}</p>
        </div>

        <div className="mb-6">
          <h3 className="font-medium mb-2">Current Strategy:</h3>
          <p className="text-sm bg-base-300 p-3 rounded whitespace-pre-wrap">{currentStrategy}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text">Proposal Description</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Update strategy to recommend more RnB music"
              required
            />
          </div>

          <div>
            <label className="label">
              <span className="label-text">IPFS Metadata (Optional)</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.ipfsMetadata}
              onChange={e => setFormData({ ...formData, ipfsMetadata: e.target.value })}
              placeholder="IPFS hash containing additional details"
            />
          </div>

          <div>
            <label className="label">
              <span className="label-text">New Strategy</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full h-32"
              value={formData.newStrategy}
              onChange={e => setFormData({ ...formData, newStrategy: e.target.value })}
              placeholder="Enter the new strategy for the agent..."
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
              <p>Creating a proposal requires at least 100 MUSIC tokens.</p>
              <p>The voting period lasts for 10 minutes.</p>
              {!hasEnoughTokens && (
                <p className="text-error">You don't have enough MUSIC tokens to create a proposal.</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              type="submit"
              className={`btn btn-primary flex-1`}
              disabled={isSubmitting || !address || !hasEnoughTokens}
            >
              {isSubmitting ? <span className="loading loading-spinner loading-xs"></span> : null}
              Create Proposal
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
