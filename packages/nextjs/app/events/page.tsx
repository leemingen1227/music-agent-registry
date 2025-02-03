"use client";

import type { NextPage } from "next";
import { formatEther } from "viem";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const Events: NextPage = () => {
  // AgentGovernance Events
  const { data: proposalEvents, isLoading: isProposalEventsLoading } = useScaffoldEventHistory({
    contractName: "AgentGovernance",
    eventName: "ProposalCreated",
    fromBlock: 0n,
  });

  const { data: voteEvents, isLoading: isVoteEventsLoading } = useScaffoldEventHistory({
    contractName: "AgentGovernance",
    eventName: "VoteCast",
    fromBlock: 0n,
  });

  const { data: proposalExecutedEvents, isLoading: isProposalExecutedEventsLoading } = useScaffoldEventHistory({
    contractName: "AgentGovernance",
    eventName: "ProposalExecuted",
    fromBlock: 0n,
  });

  // AIAgentRegistry Events
  const { data: agentSubmittedEvents, isLoading: isAgentSubmittedEventsLoading } = useScaffoldEventHistory({
    contractName: "AIAgentRegistry",
    eventName: "AgentSubmitted",
    fromBlock: 0n,
  });

  const { data: feedbackEvents, isLoading: isFeedbackEventsLoading } = useScaffoldEventHistory({
    contractName: "AIAgentRegistry",
    eventName: "FeedbackSubmitted",
    fromBlock: 0n,
  });

  const { data: strategyEvents, isLoading: isStrategyEventsLoading } = useScaffoldEventHistory({
    contractName: "AIAgentRegistry",
    eventName: "StrategyUpdated",
    fromBlock: 0n,
  });

  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        {/* Proposals Section */}
        {isProposalEventsLoading ? (
          <div className="flex justify-center items-center mt-10">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <div>
            <div className="text-center mb-4">
              <span className="block text-2xl font-bold">Governance Proposals</span>
            </div>
            <div className="overflow-x-auto shadow-lg">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th className="bg-primary">Proposal ID</th>
                    <th className="bg-primary">Proposer</th>
                    <th className="bg-primary">Agent Hash</th>
                    <th className="bg-primary">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {!proposalEvents || proposalEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center">No events found</td>
                    </tr>
                  ) : (
                    proposalEvents?.map((event, index) => (
                      <tr key={index}>
                        <td>{event.args.proposalId.toString()}</td>
                        <td><Address address={event.args.proposer} /></td>
                        <td>{event.args.agentHash}</td>
                        <td>{event.args.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Agent Submissions Section */}
        {isAgentSubmittedEventsLoading ? (
          <div className="flex justify-center items-center mt-10">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <div className="mt-8">
            <div className="text-center mb-4">
              <span className="block text-2xl font-bold">Agent Submissions</span>
            </div>
            <div className="overflow-x-auto shadow-lg">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th className="bg-primary">Owner</th>
                    <th className="bg-primary">Model Hash</th>
                    <th className="bg-primary">Metadata</th>
                    <th className="bg-primary">Stake</th>
                  </tr>
                </thead>
                <tbody>
                  {!agentSubmittedEvents || agentSubmittedEvents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center">No events found</td>
                    </tr>
                  ) : (
                    agentSubmittedEvents?.map((event, index) => (
                      <tr key={index}>
                        <td><Address address={event.args.owner} /></td>
                        <td>{event.args.modelHash}</td>
                        <td>{event.args.metadata}</td>
                        <td>{formatEther(event.args.stake)} MUSIC</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Feedback Section */}
        {isFeedbackEventsLoading ? (
          <div className="flex justify-center items-center mt-10">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <div className="mt-8 mb-8">
            <div className="text-center mb-4">
              <span className="block text-2xl font-bold">Agent Feedback</span>
            </div>
            <div className="overflow-x-auto shadow-lg">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th className="bg-primary">Model Hash</th>
                    <th className="bg-primary">User</th>
                    <th className="bg-primary">Aligns with Strategy</th>
                    <th className="bg-primary">Rating</th>
                    <th className="bg-primary">Comment</th>
                    <th className="bg-primary">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {!feedbackEvents || feedbackEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center">No events found</td>
                    </tr>
                  ) : (
                    feedbackEvents?.map((event, index) => (
                      <tr key={index}>
                        <td>{event.args.modelHash}</td>
                        <td>{event.args.user}</td>
                        <td>{event.args.alignsWithStrategy ? "Yes" : "No"}</td>
                        <td>{event.args.rating}/5</td>
                        <td>{event.args.comment}</td>
                        <td>{new Date(Number(event.args.timestamp) * 1000).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Events;
