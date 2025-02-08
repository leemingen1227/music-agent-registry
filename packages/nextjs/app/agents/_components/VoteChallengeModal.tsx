"use client";

import { useEffect, useState } from "react";
import { parseEther } from "viem";
import { useAccount, useBalance } from "wagmi";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";

interface VoteChallengeModalProps {
  agentAddress: string;
  isOpen: boolean;
  onClose: () => void;
  challengeEndTime: number;
  votesFor: bigint;
  votesAgainst: bigint;
}

export const VoteChallengeModal = ({
  agentAddress,
  isOpen,
  onClose,
  challengeEndTime,
  votesFor: initialVotesFor,
  votesAgainst: initialVotesAgainst,
}: VoteChallengeModalProps) => {
  const { address } = useAccount();
  const [stakeAmount, setStakeAmount] = useState("1");
  const [support, setSupport] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [votesFor, setVotesFor] = useState(initialVotesFor);
  const [votesAgainst, setVotesAgainst] = useState(initialVotesAgainst);

  const { data: musicTokenContract } = useScaffoldContract({
    contractName: "MusicToken",
  });

  const { data: balance } = useBalance({
    address,
    token: musicTokenContract?.address,
  });

  const { writeContractAsync: vote } = useScaffoldWriteContract({
    contractName: "AIAgentRegistry",
  });

  // Fetch updated challenge state
  const { data: agentInfo, refetch: refetchAgentInfo } = useScaffoldReadContract({
    contractName: "AIAgentRegistry",
    functionName: "getAgent",
    args: [agentAddress],
  });

  // Check if user has already voted
  const { data: hasUserVoted } = useScaffoldReadContract({
    contractName: "AIAgentRegistry",
    functionName: "hasVoted",
    args: [agentAddress, address],
  });

  useEffect(() => {
    if (hasUserVoted) {
      setHasVoted(true);
    }
  }, [hasUserVoted]);

  useEffect(() => {
    if (agentInfo) {
      setVotesFor(agentInfo[6]);
      setVotesAgainst(agentInfo[7]);
    }
  }, [agentInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || hasVoted) return;

    setIsSubmitting(true);
    try {
      await vote({
        functionName: "vote",
        args: [agentAddress, support, parseEther(stakeAmount)],
      });
      setHasVoted(true);
      await refetchAgentInfo();
    } catch (error) {
      console.error("Error voting on challenge:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalVotes = votesFor + votesAgainst;
  const forPercentage = totalVotes > 0n ? Number((votesFor * 100n) / totalVotes) : 0;
  const againstPercentage = totalVotes > 0n ? Number((votesAgainst * 100n) / totalVotes) : 0;
  const timeLeft = Math.max(0, challengeEndTime - Math.floor(Date.now() / 1000));
  const daysLeft = Math.floor(timeLeft / (24 * 60 * 60));
  const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-200 rounded-lg p-6 max-w-lg w-full">
        <h2 className="text-2xl font-semibold mb-4">Vote on Challenge</h2>

        <div className="mb-6">
          <h3 className="font-medium mb-2">Agent Address:</h3>
          <p className="text-sm bg-base-300 p-3 rounded">{agentAddress}</p>
        </div>

        <div className="mb-6">
          <h3 className="font-medium mb-2">Current Votes:</h3>
          <div className="w-full bg-base-300 rounded-lg p-4">
            <div className="flex justify-between mb-2">
              <span>Support: {forPercentage}%</span>
              <span>Against: {againstPercentage}%</span>
            </div>
            <div className="w-full bg-base-100 rounded-full h-2.5">
              <div className="bg-success h-2.5 rounded-full" style={{ width: `${forPercentage}%` }}></div>
            </div>
            <div className="mt-2 text-sm">
              <p>Support: {votesFor.toString()} votes</p>
              <p>Against: {votesAgainst.toString()} votes</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-medium mb-2">Time Remaining:</h3>
          <p className="text-sm">
            {daysLeft}d {hoursLeft}h
          </p>
        </div>

        {hasVoted ? (
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
              <h3 className="font-bold">Already Voted</h3>
              <p>You have already cast your vote on this challenge.</p>
            </div>
            <button type="button" className="btn btn-ghost ml-auto" onClick={onClose}>
              Close
            </button>
          </div>
        ) : timeLeft <= 0 ? (
          <div className="alert alert-warning">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="font-bold">Voting Ended</h3>
              <p>The voting period for this challenge has ended.</p>
            </div>
            <button type="button" className="btn btn-ghost ml-auto" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">
                <span className="label-text">Your Vote</span>
              </label>
              <div className="btn-group w-full">
                <button
                  type="button"
                  className={`btn flex-1 ${support ? "btn-active" : ""}`}
                  onClick={() => setSupport(true)}
                >
                  Support Agent
                </button>
                <button
                  type="button"
                  className={`btn flex-1 ${!support ? "btn-active" : ""}`}
                  onClick={() => setSupport(false)}
                >
                  Remove Agent
                </button>
              </div>
            </div>

            <div>
              <label className="label">
                <span className="label-text">Stake Amount (MUSIC tokens)</span>
              </label>
              <div className="join w-full">
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input input-bordered w-full join-item"
                  value={stakeAmount}
                  onChange={e => setStakeAmount(e.target.value)}
                  placeholder="Enter stake amount"
                />
                <button
                  type="button"
                  className="btn join-item"
                  onClick={() => setStakeAmount(balance?.formatted || "1")}
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
                <p>Your voting power is proportional to your stake.</p>
                <p>If your side wins, you'll receive a portion of the rewards.</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                type="submit"
                className={`btn btn-primary flex-1 ${isSubmitting ? "loading" : ""}`}
                disabled={isSubmitting || !address || parseFloat(stakeAmount) < 1 || timeLeft <= 0}
              >
                Cast Vote
              </button>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
