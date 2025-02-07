"use client";

import { useState, useEffect } from "react";
import { ChatInterface } from "./ChatInterface";
import { useAgentData } from "~~/hooks/scaffold-eth/useAgentData";
import { useAgentStatus } from "~~/hooks/scaffold-eth/useAgentStatus";

interface AgentCardProps {
  address: string;
  metadata: string;
  initialStrategy: string;
}

export const AgentCard = ({ address, metadata, initialStrategy }: AgentCardProps) => {
  const { stats, strategy, isLoading: isLoadingData } = useAgentData(address);
  const { status, isLoading: isLoadingStatus, error, initializeAgent, checkStatus } = useAgentStatus(address);
  const [showChat, setShowChat] = useState(false);

  const isLoading = isLoadingData || isLoadingStatus;

  // Check status when chat is opened
  useEffect(() => {
    if (showChat) {
      checkStatus();
    }
  }, [showChat]);

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

  const getStatusBadge = () => {
    if (!status) return null;

    const badgeClasses = {
      ready: "badge-success",
      registered: "badge-warning",
      not_registered: "badge-error"
    };

    const statusText = {
      ready: "Ready",
      registered: "Needs Initialization",
      not_registered: "Not Registered"
    };

    return (
      <div className={`badge ${badgeClasses[status.status]} gap-2`}>
        <div className={`w-2 h-2 rounded-full ${status.status === "ready" ? "bg-green-500" : "bg-yellow-500"}`}></div>
        {statusText[status.status]}
      </div>
    );
  };

  const handleInitialize = async () => {
    await initializeAgent();
  };

  const handleToggleChat = () => {
    setShowChat(prev => !prev);
  };

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-start mb-4">
          <h2 className="card-title text-lg font-semibold truncate">Agent: {address}</h2>
          {getStatusBadge()}
        </div>

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

        {error && (
          <div className="alert alert-error mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {status?.status === "registered" && (
          <button 
            className="btn btn-warning w-full mb-4" 
            onClick={handleInitialize}
            disabled={isLoading}
          >
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

        <button 
          className="btn btn-primary w-full" 
          onClick={handleToggleChat}
          disabled={status?.status !== "ready"}
        >
          {showChat ? "Hide Chat" : "Chat with Agent"}
        </button>

        {showChat && status?.status === "ready" && (
          <div className="mt-4">
            <ChatInterface agentAddress={address} />
          </div>
        )}
      </div>
    </div>
  );
};
