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

    const badgeConfig = {
      ready: {
        class: "bg-success/10 text-success",
        text: "Ready",
        dotColor: "bg-success"
      },
      registered: {
        class: "bg-warning/10 text-warning",
        text: "Needs Initialization",
        dotColor: "bg-warning"
      },
      not_registered: {
        class: "bg-error/10 text-error",
        text: "Not Registered",
        dotColor: "bg-error"
      }
    };

    const config = badgeConfig[status.status];

    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${config.class}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
        {config.text}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="animate-pulse space-y-8">
          <div className="flex justify-between items-center">
            <div className="h-8 bg-base-300 rounded w-1/4"></div>
            <div className="flex gap-2">
              <div className="h-10 bg-base-300 rounded w-32"></div>
              <div className="h-10 bg-base-300 rounded w-32"></div>
            </div>
          </div>
          <div className="card bg-base-200">
            <div className="card-body space-y-6">
              <div className="h-6 bg-base-300 rounded w-1/3"></div>
              <div className="h-24 bg-base-300 rounded"></div>
              <div className="grid grid-cols-3 gap-6">
                <div className="h-24 bg-base-300 rounded"></div>
                <div className="h-24 bg-base-300 rounded"></div>
                <div className="h-24 bg-base-300 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Agent Details</h1>
            {getStatusBadge()}
          </div>
          <div className="flex flex-wrap gap-2">
            {status?.status === "ready" && !hasActiveChallenge && (
              <button 
                className="btn btn-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-200 border-none" 
                onClick={() => setShowChallengeModal(true)}
              >
                Challenge Agent
              </button>
            )}
            {hasActiveChallenge && (
              <button 
                className="btn btn-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-200 border-none" 
                onClick={() => setShowVoteChallengeModal(true)}
              >
                Vote on Challenge
              </button>
            )}
            {status?.status === "ready" && !hasActiveProposal && (
              <button 
                className="btn btn-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-200 border-none" 
                onClick={() => setShowCreateProposalModal(true)}
              >
                Propose Strategy Change
              </button>
            )}
            {hasActiveProposal && (
              <button 
                className="btn btn-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-200 border-none" 
                onClick={() => setShowVoteProposalModal(true)}
              >
                Vote on Proposal
              </button>
            )}
          </div>
        </div>

        <div className="card bg-base-200 shadow-xl">
          <div className="card-body p-6">
            <div className="space-y-4">
              <div>
                <span className="text-sm text-base-content/60 block mb-1">Address</span>
                <p className="font-mono text-base bg-base-300/50 rounded-lg px-4 py-2">{address}</p>
              </div>

              <div>
                <span className="text-sm text-base-content/60 block mb-1">Strategy</span>
                <div className="bg-base-300/50 rounded-lg px-4 py-2">
                  <p className="text-sm whitespace-pre-wrap">{strategy}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-base-300/30 rounded-lg px-3 py-2 text-center">
                  <p className="text-2xl font-semibold">{stats.totalFeedbacks.toString()}</p>
                  <p className="text-xs text-base-content/60">Total Feedback</p>
                </div>
                <div className="bg-base-300/30 rounded-lg px-3 py-2 text-center">
                  <p className="text-2xl font-semibold">{stats.positiveAlignments.toString()}</p>
                  <p className="text-xs text-base-content/60">Positive</p>
                </div>
                <div className="bg-base-300/30 rounded-lg px-3 py-2 text-center">
                  <p className="text-2xl font-semibold">{(Number(stats.averageRating) / 100).toFixed(1)}</p>
                  <p className="text-xs text-base-content/60">Avg Rating</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-error/10 text-error rounded-lg p-4 flex gap-3 mt-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}

            {status?.status === "registered" && (
              <button 
                className="btn btn-warning w-full mt-4" 
                onClick={initializeAgent} 
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "Initialize Agent"
                )}
              </button>
            )}
          </div>
        </div>

        {status?.status === "ready" && (
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body p-6">
              <h3 className="text-sm text-base-content/60 mb-3">Chat with Agent</h3>
              <ChatInterface agentAddress={address} />
            </div>
          </div>
        )}
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
