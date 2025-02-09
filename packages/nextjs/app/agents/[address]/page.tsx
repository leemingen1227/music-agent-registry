"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChallengeAgentModal } from "../_components/ChallengeAgentModal";
import { ChatInterface } from "../_components/ChatInterface";
import { CreateProposalModal } from "../_components/CreateProposalModal";
import { VoteChallengeModal } from "../_components/VoteChallengeModal";
import { VoteProposalModal } from "../_components/VoteProposalModal";
import { useAccount, useBalance } from "wagmi";
import { useAgentData } from "~~/hooks/scaffold-eth/useAgentData";
import { useAgentStatus } from "~~/hooks/scaffold-eth/useAgentStatus";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { formatDistanceToNow } from "date-fns";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";
import { useScaffoldContract } from "~~/hooks/scaffold-eth/useScaffoldContract";

interface AgentPageProps {
  params: {
    address: string;
  };
}

interface Proposal {
  id: number;
  proposer: string;
  agentAddress: string;
  description: string;
  ipfsMetadata: string;
  newStrategy: string;
  votesFor: bigint;
  votesAgainst: bigint;
  endTime: bigint;
  executed: boolean;
}

const AgentPage = ({ params: { address } }: AgentPageProps) => {
  const router = useRouter();
  const { address: userAddress } = useAccount();
  const { stats, strategy, isLoading: isLoadingData } = useAgentData(address);
  const { status, isLoading: isLoadingStatus, error, initializeAgent } = useAgentStatus(address);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [showVoteChallengeModal, setShowVoteChallengeModal] = useState(false);
  const [showCreateProposalModal, setShowCreateProposalModal] = useState(false);
  const [showVoteProposalModal, setShowVoteProposalModal] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [activeProposal, setActiveProposal] = useState<Proposal | null>(null);
  const { data: proposalEvents } = useScaffoldEventHistory({
    contractName: "AgentGovernance",
    eventName: "ProposalCreated",
    fromBlock: 0n,
    filters: { agentAddress: address }
  });
  const [isCheckingAgent, setIsCheckingAgent] = useState(true);
  const [agentError, setAgentError] = useState<string | null>(null);

  // Get all proposal IDs from events
  const proposalIds = proposalEvents?.map(event => event.args.proposalId) || [];

  // Track which proposal we're currently fetching
  const [currentProposalIndex, setCurrentProposalIndex] = useState(0);
  const currentProposalId = proposalIds[currentProposalIndex];

  // Fetch current proposal
  const { data: proposalData, isLoading: isLoadingProposal } = useScaffoldReadContract({
    contractName: "AgentGovernance",
    functionName: "getProposal",
    args: [currentProposalId],
  });

  // Process current proposal and move to next
  useEffect(() => {
    if (!proposalEvents?.length || !proposalData || currentProposalIndex >= proposalIds.length) {
      return;
    }

    const proposal = {
      id: Number(currentProposalId),
      proposer: proposalData[0],
      agentAddress: proposalData[1],
      description: proposalData[2],
      ipfsMetadata: proposalData[3],
      newStrategy: proposalData[4],
      votesFor: proposalData[5],
      votesAgainst: proposalData[6],
      endTime: proposalData[7],
      executed: proposalData[8]
    };

    setProposals(prev => {
      const existing = prev.find(p => p.id === proposal.id);
      if (existing) return prev;
      return [...prev, proposal].sort((a, b) => b.id - a.id);
    });

    // Move to next proposal
    if (currentProposalIndex < proposalIds.length - 1) {
      setCurrentProposalIndex(currentProposalIndex + 1);
    }
  }, [proposalEvents, proposalData, currentProposalId, currentProposalIndex, proposalIds]);

  // Reset index when events change
  useEffect(() => {
    setCurrentProposalIndex(0);
    setProposals([]);
  }, [proposalEvents]);

  // Update active proposal when proposals list changes
  useEffect(() => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const active = proposals.find(p => !p.executed && p.endTime > now);
    setActiveProposal(active || null);
  }, [proposals]);

  const { data: agentInfo, refetch: refetchAgentInfo } = useScaffoldReadContract({
    contractName: "AIAgentRegistry",
    functionName: "getAgent",
    args: [address],
  });

  const { writeContractAsync: resolveChallenge } = useScaffoldWriteContract({
    contractName: "AIAgentRegistry",
  });

  const { data: agentStrategy } = useScaffoldReadContract({
    contractName: "AIAgentRegistry",
    functionName: "getAgent",
    args: [address],
  });

  const { writeContractAsync: executeProposal } = useScaffoldWriteContract({
    contractName: "AgentGovernance",
  });

  const { data: musicTokenContract } = useScaffoldContract({
    contractName: "MusicToken",
  });

  const { data: agentBalance } = useBalance({
    address: address as `0x${string}`,
    token: musicTokenContract?.address,
  });

  const handleExecuteProposal = async (proposalId: number) => {
    try {
      await executeProposal({
        functionName: "executeProposal",
        args: [BigInt(proposalId)],
      });
      // Refresh the proposals after execution
      setCurrentProposalIndex(0);
      setProposals([]);
    } catch (error) {
      console.error("Error executing proposal:", error);
    }
  };

  const isLoading = isLoadingData || 
    isLoadingStatus || 
    (isLoadingProposal && currentProposalIndex < proposalIds.length);

  const hasActiveChallenge = agentInfo && agentInfo[4] !== "0x0000000000000000000000000000000000000000";
  const challengeEnded = agentInfo && Number(agentInfo[3]) <= Math.floor(Date.now() / 1000);
  const hasActiveProposal = activeProposal !== null;
  const isListed = agentInfo && agentInfo[2];

  // Improved agent existence check with longer delays and better checks
  useEffect(() => {
    const checkAgent = async () => {
      if (!isLoading) {
        if (!agentInfo) {
          // First delay to ensure data is fully loaded
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Refetch agent info after first delay
          await refetchAgentInfo();
          
          // Second check after refetch
          if (!agentInfo) {
            // Additional delay before final check
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Final refetch
            const result = await refetchAgentInfo();
            
            // Only set error and redirect if still no agent info after multiple attempts
            if (!result.data) {
              setAgentError("Agent not found or not registered");
              // Longer delay before redirect
              setTimeout(() => {
                router.push('/agents');
              }, 5000); // 5 seconds to read the error
            }
          }
        }
        setIsCheckingAgent(false);
      }
    };

    checkAgent();
  }, [isLoading, agentInfo, router, refetchAgentInfo]);

  const getStatusBadge = () => {
    if (!status) return null;

    // if (!isListed) {
    //   return (
    //     <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-error/10 text-error">
    //       <div className="w-1.5 h-1.5 rounded-full bg-error" />
    //       Delisted
    //     </div>
    //   );
    // }

    const badgeConfig: Record<string, { class: string; text: string; dotColor: string }> = {
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

  // Loading state with more detailed message
  if (isLoading || isCheckingAgent) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <div className="mt-4 space-y-2">
            <p className="text-lg font-medium">Loading agent details...</p>
            <p className="text-sm text-base-content/70">
              {isCheckingAgent ? "Verifying agent existence..." : "Fetching agent information..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state with more context and longer display
  if (agentError) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-bold">Agent Not Found</h3>
            <div className="text-sm">{agentError}</div>
            <div className="text-sm mt-2">Redirecting to agents list in 5 seconds...</div>
            <button 
              className="btn btn-sm btn-outline mt-3"
              onClick={() => router.push('/agents')}
            >
              Return to Agents List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Agent Details</h1>
          {getStatusBadge()}
        </div>
        <div className="flex flex-wrap gap-2">
          {status?.status === "ready" && !hasActiveChallenge && isListed && (
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
          {hasActiveProposal && isListed && (
            <button 
              className="btn btn-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-200 border-none" 
              onClick={() => setShowVoteProposalModal(true)}
            >
              Vote on Proposal
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Agent Info & Governance */}
        <div className="lg:col-span-3 space-y-6">
          <div className={`card ${isListed ? 'bg-base-200' : 'bg-base-200/50'} shadow-xl`}>
            <div className="card-body p-6">
              {/* {!isListed && (
                <div className="alert alert-error mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h3 className="font-bold">Agent Delisted</h3>
                    <div className="text-sm">This agent has been delisted due to a successful challenge and is no longer active.</div>
                  </div>
                </div>
              )} */}
              <div className={`space-y-4`}>
                <div>
                  <span className="text-sm text-base-content/60 block mb-1">Address</span>
                  <p className="font-mono text-base bg-base-300/50 rounded-lg px-4 py-2">{address}</p>
                </div>

                <div>
                  <span className="text-sm text-base-content/60 block mb-1">Balance</span>
                  <p className="font-mono text-base bg-base-300/50 rounded-lg px-4 py-2">
                    {agentBalance ? Number(agentBalance.value) / 1e18 : "0"} MUSIC
                  </p>
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

              {agentInfo && agentInfo[4] !== "0x0000000000000000000000000000000000000000" && (
                <div className={`mt-4 p-4 rounded-lg ${
                  !challengeEnded 
                    ? "bg-warning/10 border border-warning/20" 
                    : "bg-base-300/50 border border-base-300"
                }`}>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">Challenge Status</h4>
                    <span className={`badge ${hasActiveChallenge ? "badge-warning" : "badge-neutral"}`}>
                      {hasActiveChallenge ? "Active" : "Ended"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-base-content/70">Challenger:</span>
                      <span className="font-mono">{`${agentInfo[4].slice(0, 6)}...${agentInfo[4].slice(-4)}`}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-base-content/70">Challenge Stake:</span>
                      <span>{Number(agentInfo[5]) / 1e18} MUSIC</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-base-content/70">Votes For:</span>
                      <span>{Number(agentInfo[6]) / 1e18} MUSIC</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-base-content/70">Votes Against:</span>
                      <span>{Number(agentInfo[7]) / 1e18} MUSIC</span>
                    </div>
                    {hasActiveChallenge && !challengeEnded && (
                      <div className="flex justify-between text-sm">
                        <span className="text-base-content/70">Time Remaining:</span>
                        <span>{formatDistanceToNow(new Date(Number(agentInfo[3]) * 1000), { addSuffix: true })}</span>
                      </div>
                    )}
                    {challengeEnded && hasActiveChallenge && (
                      <button
                        className="btn btn-warning btn-sm w-full mt-2"
                        onClick={async () => {
                          try {
                            await resolveChallenge({
                              functionName: "resolveChallenge",
                              args: [address],
                            });
                            await refetchAgentInfo();
                          } catch (error) {
                            console.error("Error resolving challenge:", error);
                          }
                        }}
                      >
                        Resolve Challenge
                      </button>
                    )}
                  </div>
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

          {status?.status === "ready" && isListed && (
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">Governance</h3>
                    <p className="text-sm text-base-content/60">Proposals to modify agent strategy</p>
                  </div>
                  <button 
                    className="btn btn-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-200 border-none"
                    onClick={() => setShowCreateProposalModal(true)}
                  >
                    Create Proposal
                  </button>
                </div>

                {proposals.length === 0 ? (
                  <div className="text-center py-8 text-base-content/60">
                    No proposals found for this agent
                  </div>
                ) : (
                  <div className="space-y-4">
                    {proposals.map((proposal) => {
                      const totalVotes = proposal.votesFor + proposal.votesAgainst;
                      const forPercentage = totalVotes > 0n ? Number((proposal.votesFor * 100n) / totalVotes) : 0;
                      const isActive = proposal.endTime > BigInt(Math.floor(Date.now() / 1000));
                      const hasPassed = proposal.votesFor > proposal.votesAgainst;

                      // Convert wei to ether for display
                      const votesForEther = Number(proposal.votesFor) / 1e18;
                      const votesAgainstEther = Number(proposal.votesAgainst) / 1e18;
                      const totalVotesEther = Number(totalVotes) / 1e18;

                      // Determine card and badge styles based on status
                      const cardStyle = proposal.executed
                        ? "bg-base-300/50"
                        : isActive
                        ? "bg-primary/10 border border-primary/20"
                        : hasPassed
                        ? "bg-success/10 border border-success/20"
                        : "bg-error/10 border border-error/20";

                      const badgeStyle = proposal.executed
                        ? "badge-neutral"
                        : isActive
                        ? "badge-primary"
                        : hasPassed
                        ? "badge-success"
                        : "badge-error";

                      return (
                        <div key={proposal.id} className={`rounded-lg p-4 ${cardStyle}`}>
                          <div className="flex justify-between items-start gap-4 mb-3">
                            <div>
                              <h4 className="font-medium mb-1">{proposal.description}</h4>
                              <p className="text-sm text-base-content/60">
                                Proposed by: {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`badge ${badgeStyle}`}>
                                {isActive 
                                  ? "Active"
                                  : proposal.executed 
                                  ? "Executed" 
                                  : hasPassed
                                  ? "Passed"
                                  : "Failed"}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="bg-base-300/50 rounded-lg p-3">
                              <p className="text-sm mb-2">Proposed Strategy:</p>
                              <p className="text-sm font-mono whitespace-pre-wrap">{proposal.newStrategy}</p>
                            </div>

                            <div className="w-full bg-base-300/50 rounded-lg p-3">
                              <div className="flex justify-between mb-1 text-sm">
                                <span>Support: {forPercentage}%</span>
                                <span>Total Votes: {totalVotesEther.toFixed(2)} MUSIC</span>
                              </div>
                              <div className="w-full bg-base-100 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all ${
                                    proposal.executed
                                      ? "bg-neutral"
                                      : isActive
                                      ? "bg-primary"
                                      : hasPassed
                                      ? "bg-success"
                                      : "bg-error"
                                  }`}
                                  style={{ width: `${forPercentage}%` }}
                                />
                                </div>
                              <div className="flex justify-between mt-1 text-xs text-base-content/60">
                                <span>For: {votesForEther.toFixed(2)} MUSIC</span>
                                  <span>Against: {votesAgainstEther.toFixed(2)} MUSIC</span>
                                </div>
                              </div>

                            {isActive ? (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-base-content/60">
                                  Ends {formatDistanceToNow(new Date(Number(proposal.endTime) * 1000), { addSuffix: true })}
                                </span>
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => {
                                    setActiveProposal(proposal);
                                    setShowVoteProposalModal(true);
                                  }}
                                >
                                  Vote
                                </button>
                              </div>
                            ) : !proposal.executed && (
                              <div className="flex justify-between items-center">
                                <span className={`text-sm ${hasPassed ? "text-success/70" : "text-error/70"}`}>
                                  {hasPassed
                                    ? "Proposal passed - ready to execute" 
                                    : "Proposal failed - insufficient support"}
                                </span>
                                {hasPassed && (
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => handleExecuteProposal(proposal.id)}
                                  >
                                    Execute Proposal
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Chat */}
        {status?.status === "ready" && isListed && (
          <div className="lg:col-span-2">
            <div className="card bg-base-200 shadow-xl sticky top-6">
              <div className="card-body p-6 h-[calc(100vh-8rem)] flex flex-col">
                <h3 className="text-lg font-semibold mb-4">Chat with Agent</h3>
                <div className="flex-grow overflow-hidden">
                  <ChatInterface agentAddress={address} />
                </div>
              </div>
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
          proposalId={activeProposal.id}
          description={activeProposal.description}
          agentAddress={activeProposal.agentAddress}
          newStrategy={activeProposal.newStrategy}
          votesFor={activeProposal.votesFor}
          votesAgainst={activeProposal.votesAgainst}
          endTime={Number(activeProposal.endTime)}
          isOpen={showVoteProposalModal}
          onClose={() => setShowVoteProposalModal(false)}
        />
      )}
    </div>
  );
};

export default AgentPage;
