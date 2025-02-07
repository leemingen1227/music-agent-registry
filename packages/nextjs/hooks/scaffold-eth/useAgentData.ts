"use client";

import { useScaffoldReadContract } from "./useScaffoldReadContract";

export const useAgentData = (address: string | undefined) => {
  const { data: stats, isLoading: isLoadingStats } = useScaffoldReadContract({
    contractName: "AIAgentRegistry",
    functionName: "getAgentStats",
    args: [address],
  });

  const { data: strategy, isLoading: isLoadingStrategy } = useScaffoldReadContract({
    contractName: "AIAgentRegistry",
    functionName: "getAgentStrategy",
    args: [address],
  });

  const [totalFeedbacks, positiveAlignments, averageRating] = stats || [0n, 0n, 0n];

  return {
    stats: {
      totalFeedbacks,
      positiveAlignments,
      averageRating,
    },
    strategy,
    isLoading: isLoadingStats || isLoadingStrategy,
  };
};
