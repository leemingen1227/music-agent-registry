"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAgentData } from "~~/hooks/scaffold-eth/useAgentData";
import { useAgentStatus } from "~~/hooks/scaffold-eth/useAgentStatus";

interface AgentCardProps {
  address: string;
  metadata: string;
  initialStrategy: string;
}

export const AgentCard = ({ address, metadata, initialStrategy }: AgentCardProps) => {
  const { stats, strategy, isLoading: isLoadingData } = useAgentData(address);
  const { status, isLoading: isLoadingStatus } = useAgentStatus(address);

  const isLoading = isLoadingData || isLoadingStatus;

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
    <Link href={`/agents/${address}`} className="block">
      <div className="card bg-base-200 shadow-xl hover:shadow-2xl transition-shadow duration-200">
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

          <div className="grid grid-cols-3 gap-2">
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
        </div>
      </div>
    </Link>
  );
};
