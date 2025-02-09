"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAgentData } from "~~/hooks/scaffold-eth/useAgentData";
import { useAgentStatus } from "~~/hooks/scaffold-eth/useAgentStatus";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";

interface AgentCardProps {
  address: string;
  metadata: string;
  initialStrategy: string;
}

export const AgentCard = ({ address, metadata, initialStrategy }: AgentCardProps) => {
  const { stats, strategy, isLoading: isLoadingData } = useAgentData(address);
  const { status, isLoading: isLoadingStatus } = useAgentStatus(address);
  const [isListed, setIsListed] = useState(true);

  // Get agent info to check if listed
  const { data: agentInfo } = useScaffoldReadContract({
    contractName: "AIAgentRegistry",
    functionName: "getAgent",
    args: [address],
  });

  useEffect(() => {
    if (agentInfo) {
      setIsListed(agentInfo[2]);
    }
  }, [agentInfo]);

  const getStatusBadge = () => {
    if (!status) return null;

    if (!isListed) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-error/10 text-error">
          <div className="w-1.5 h-1.5 rounded-full bg-error" />
          Delisted
        </div>
      );
    }

    const badgeConfig = {
      ready: {
        class: "bg-success/10 text-success",
        text: "Ready",
        dotColor: "bg-success"
      },
      registered: {
        class: "bg-warning/10 text-warning",
        text: "Pending",
        dotColor: "bg-warning"
      },
      not_registered: {
        class: "bg-error/10 text-error",
        text: "Unregistered",
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

  const isLoading = isLoadingData || isLoadingStatus;

  if (isLoading) {
    return (
      <div className="card bg-base-200 shadow-xl animate-pulse">
        <div className="card-body">
          <div className="flex justify-between items-start">
            <div className="h-6 bg-base-300 rounded w-2/3"></div>
            <div className="h-6 bg-base-300 rounded w-20"></div>
          </div>
          <div className="space-y-4 mt-4">
            <div className="h-4 bg-base-300 rounded w-3/4"></div>
            <div className="h-4 bg-base-300 rounded w-1/2"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-8 bg-base-300 rounded"></div>
              <div className="h-8 bg-base-300 rounded"></div>
              <div className="h-8 bg-base-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const shortenedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const CardContent = () => (
    <div className={`card ${isListed ? 'bg-base-200 hover:bg-base-300' : 'bg-base-200/50'} shadow-xl transition-all duration-200`}>
      <div className="card-body p-6">
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col">
            <span className="text-sm text-base-content/60">Agent</span>
            <h2 className="text-base font-mono">{shortenedAddress}</h2>
          </div>
          {getStatusBadge()}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <h3 className="text-sm text-base-content/60 mb-1">Strategy</h3>
            <p className="text-sm">{strategy || initialStrategy}</p>
          </div>

          <div>
            <h3 className="text-sm text-base-content/60 mb-1">Metadata</h3>
            <p className="text-sm">{metadata}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-base-300">
          <div className="text-center">
            <p className="text-2xl font-semibold">{stats.totalFeedbacks.toString()}</p>
            <p className="text-xs text-base-content/60">Total Feedback</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">{stats.positiveAlignments.toString()}</p>
            <p className="text-xs text-base-content/60">Positive</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">{(Number(stats.averageRating) / 100).toFixed(1)}</p>
            <p className="text-xs text-base-content/60">Avg Rating</p>
          </div>
        </div>
      </div>
    </div>
  );

  // If agent is delisted, wrap in div instead of Link
  return isListed ? (
    <Link href={`/agents/${address}`} className="block">
      <CardContent />
    </Link>
  ) : (
    <div className="opacity-75 cursor-not-allowed">
      <CardContent />
    </div>
  );
};
