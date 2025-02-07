import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

interface AgentStatus {
  isRegistered: boolean;
  isInitialized: boolean;
  status: "ready" | "registered" | "not_registered";
}

export const useAgentStatus = (agentAddress: string) => {
  const { address: userAddress } = useAccount();
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    if (!agentAddress || !userAddress) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_AGENT_SERVER_URL}/agent/status/${agentAddress}`, {
        headers: {
          "X-User-Address": userAddress,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch agent status");
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check agent status");
    } finally {
      setIsLoading(false);
    }
  };

  // Only check status once when component mounts or when address/userAddress changes
  useEffect(() => {
    checkStatus();
  }, [agentAddress, userAddress]);

  const initializeAgent = async () => {
    if (!agentAddress || !userAddress) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_AGENT_SERVER_URL}/agent/initialize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Address": userAddress,
        },
        body: JSON.stringify({ agentAddress }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to initialize agent");
      }

      // Refresh status after initialization
      await checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize agent");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    status,
    isLoading,
    error,
    initializeAgent,
    checkStatus, // Export checkStatus for manual refresh when needed
  };
}; 
