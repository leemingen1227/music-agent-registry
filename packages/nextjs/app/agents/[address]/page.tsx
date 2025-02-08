"use client";

import { useEffect, useState } from "react";
import { ChallengeAgentModal } from "../_components/ChallengeAgentModal";
import { ChatInterface } from "../_components/ChatInterface";
import { CreateProposalModal } from "../_components/CreateProposalModal";
import { VoteChallengeModal } from "../_components/VoteChallengeModal";
import { VoteProposalModal } from "../_components/VoteProposalModal";
import { useAccount } from "wagmi";
import { useAgentData } from "~~/hooks/scaffold-eth/useAgentData";
import { useAgentStatus } from "~~/hooks/scaffold-eth/useAgentStatus";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";

interface AgentPageProps {
  params: {
    address: string;
  };
}

const AgentPage = ({ params: { address } }: AgentPageProps) => {
  const { address: userAddress } = useAccount();
  const { stats, strategy, isLoading: isLoadingData } = useAgentData(address);
  const { status, isLoading: isLoadingStatus, error, initializeAgent } = useAgentStatus(address);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [showVoteChallengeModal, setShowVoteChallengeModal] = useState(false);
  const [showCreateProposalModal, setShowCreateProposalModal] = useState(false);
  const [showVoteProposalModal, setShowVoteProposalModal] = useState(false);

  const { data: agentInfo, isLoading: isLoadingAgent } = useScaffoldReadContract({
    contractName: "AIAgentRegistry",
    functionName: "getAgent",
    args: [address],
  });

  const { data: activeProposal, isLoading: isLoadingProposal } = useScaffoldReadContract({
    contractName: "AgentGovernance",
    functionName: "getProposal",
    args: [1n], // For simplicity, we're just checking the first proposal. In a real app, you'd track all proposals
  });

  const isLoading = isLoadingData || isLoadingStatus || isLoadingAgent || isLoadingProposal;
  const hasActiveChallenge = agentInfo && agentInfo[3] > BigInt(Math.floor(Date.now() / 1000));
  const hasActiveProposal =
    activeProposal && !activeProposal[8] && activeProposal[7] > BigInt(Math.floor(Date.now() / 1000));

  const getStatusBadge = () => {
    if (!status) return null;

    const badgeClasses = {
      ready: "badge-success",
      registered: "badge-warning",
      not_registered: "badge-error",
    };

    const statusText = {
      ready: "Ready",
      registered: "Needs Initialization",
      not_registered: "Not Registered",
    };

    return (
      <div className={`badge ${badgeClasses[status.status]} gap-2`}>
        <div className={`w-2 h-2 rounded-full ${status.status === "ready" ? "bg-green-500" : "bg-yellow-500"}`}></div>
        {statusText[status.status]}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-10">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4">Loading agent details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-4xl font-bold">Agent Details</h1>
          <div className="flex gap-2">
            {status?.status === "ready" && !hasActiveChallenge && (
              <button className="btn btn-warning" onClick={() => setShowChallengeModal(true)}>
                Challenge Agent
              </button>
            )}
            {hasActiveChallenge && (
              <button className="btn btn-primary" onClick={() => setShowVoteChallengeModal(true)}>
                Vote on Challenge
              </button>
            )}
            {status?.status === "ready" && !hasActiveProposal && (
              <button className="btn btn-info" onClick={() => setShowCreateProposalModal(true)}>
                Propose Strategy Change
              </button>
            )}
            {hasActiveProposal && (
              <button className="btn btn-primary" onClick={() => setShowVoteProposalModal(true)}>
                Vote on Proposal
              </button>
            )}
          </div>
        </div>

        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-lg font-semibold mb-4">Address: {address}</h2>

            <div className="mb-6">
              <h3 className="font-medium mb-2">Strategy:</h3>
              <p className="text-sm bg-base-300 p-3 rounded">{strategy}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="stat bg-base-300 rounded-box p-4">
                <div className="stat-title">Total Feedback</div>
                <div className="stat-value text-2xl">{stats.totalFeedbacks.toString()}</div>
              </div>
              <div className="stat bg-base-300 rounded-box p-4">
                <div className="stat-title">Positive Alignments</div>
                <div className="stat-value text-2xl">{stats.positiveAlignments.toString()}</div>
              </div>
              <div className="stat bg-base-300 rounded-box p-4">
                <div className="stat-title">Average Rating</div>
                <div className="stat-value text-2xl">{(Number(stats.averageRating) / 100).toFixed(2)}</div>
              </div>
            </div>

            {error && (
              <div className="alert alert-error mb-6">
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
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {status?.status === "registered" && (
              <button className="btn btn-warning w-full mb-6" onClick={initializeAgent} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Initializing...
                  </>
                ) : (
                  "Initialize Agent"
                )}
              </button>
            )}

            {status?.status === "ready" && (
              <div className="mt-6">
                <h3 className="font-medium mb-4">Chat with Agent</h3>
                <ChatInterface agentAddress={address} />
              </div>
            )}
          </div>
        </div>
      </div>

      <ChallengeAgentModal
        agentAddress={address}
        isOpen={showChallengeModal}
        onClose={() => setShowChallengeModal(false)}
      />

      {hasActiveChallenge && agentInfo && (
        <VoteChallengeModal
          agentAddress={address}
          isOpen={showVoteChallengeModal}
          onClose={() => setShowVoteChallengeModal(false)}
          challengeEndTime={Number(agentInfo[3])}
          votesFor={agentInfo[6]}
          votesAgainst={agentInfo[7]}
        />
      )}

      <CreateProposalModal
        agentAddress={address}
        currentStrategy={strategy || ""}
        isOpen={showCreateProposalModal}
        onClose={() => setShowCreateProposalModal(false)}
      />

      {hasActiveProposal && activeProposal && (
        <VoteProposalModal
          proposalId={1}
          description={activeProposal[2]}
          agentAddress={activeProposal[1]}
          newStrategy={activeProposal[4]}
          votesFor={activeProposal[5]}
          votesAgainst={activeProposal[6]}
          endTime={Number(activeProposal[7])}
          isOpen={showVoteProposalModal}
          onClose={() => setShowVoteProposalModal(false)}
        />
      )}
    </div>
  );
};

export default AgentPage;
