"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const SubmitAgentForm = () => {
  const [newAgent, setNewAgent] = useState({
    metadata: "",
    strategy: "",
    stake: "",
  });

  const { writeContractAsync: submitAgent } = useScaffoldWriteContract({
    contractName: "AIAgentRegistry",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitAgent({
        functionName: "submitAgent",
        args: [newAgent.metadata, newAgent.strategy, parseEther(newAgent.stake)],
      });
      setNewAgent({ metadata: "", strategy: "", stake: "" });
    } catch (error) {
      console.error("Error submitting agent:", error);
    }
  };

  return (
    <div className="bg-base-200 rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-semibold mb-4">Submit New Agent</h2>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div>
          <label className="label">
            <span className="label-text">Metadata</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={newAgent.metadata}
            onChange={e => setNewAgent({ ...newAgent, metadata: e.target.value })}
            placeholder="Agent metadata"
          />
        </div>
        <div>
          <label className="label">
            <span className="label-text">Strategy</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            value={newAgent.strategy}
            onChange={e => setNewAgent({ ...newAgent, strategy: e.target.value })}
            placeholder="Agent strategy"
          />
        </div>
        <div>
          <label className="label">
            <span className="label-text">Stake Amount (in ETH)</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={newAgent.stake}
            onChange={e => setNewAgent({ ...newAgent, stake: e.target.value })}
            placeholder="Stake amount"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Submit Agent
        </button>
      </form>
    </div>
  );
};
