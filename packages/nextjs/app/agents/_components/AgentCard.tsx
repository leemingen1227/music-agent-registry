"use client";

import { useState } from "react";
import { ChatInterface } from "./ChatInterface";
import { useAgentData } from "~~/hooks/scaffold-eth/useAgentData";

interface AgentCardProps {
  address: string;
  metadata: string;
  initialStrategy: string;
}

export const AgentCard = ({ address, metadata, initialStrategy }: AgentCardProps) => {
  const { stats, strategy, isLoading } = useAgentData(address);
  const [showChat, setShowChat] = useState(false);

  if (isLoading) {
    return (
      <div className="card bg-base-200 shadow-xl animate-pulse">
        <div className="card-body">
          <h2 className="card-title text-lg font-semibold mb-2 truncate">Agent: {address}</h2>
          <div className="space-y-4">
            <div className="h-4 bg-base-300 rounded w-3/4"></div>
            <div className="h-4 bg-base-300 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-lg font-semibold mb-2 truncate">Agent: {address}</h2>

        <div className="mb-4">
          <h3 className="font-medium mb-1">Strategy:</h3>
          <p className="text-sm">{strategy || initialStrategy}</p>
        </div>

        <div className="mb-4">
          <h3 className="font-medium mb-1">Metadata:</h3>
          <p className="text-sm">{metadata}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div>
            <h3 className="font-medium text-sm">Total Feedback</h3>
            <p>{stats.totalFeedbacks.toString()}</p>
          </div>
          <div>
            <h3 className="font-medium text-sm">Positive Alignments</h3>
            <p>{stats.positiveAlignments.toString()}</p>
          </div>
          <div>
            <h3 className="font-medium text-sm">Average Rating</h3>
            <p>{(Number(stats.averageRating) / 100).toFixed(2)}</p>
          </div>
        </div>

        <button className="btn btn-primary w-full" onClick={() => setShowChat(prev => !prev)}>
          {showChat ? "Hide Chat" : "Chat with Agent"}
        </button>

        {showChat && (
          <div className="mt-4">
            <ChatInterface agentAddress={address} />
          </div>
        )}
      </div>
    </div>
  );
};
