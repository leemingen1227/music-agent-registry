"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useBalance } from "wagmi";
import { AgentCard } from "./_components/AgentCard";
import { useScaffoldEventHistory, useScaffoldContract } from "~~/hooks/scaffold-eth";

interface AgentEvent {
  address: string;
  metadata: string;
  strategy: string;
}

const AgentsListPage = () => {
  const { address } = useAccount();
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);

  // Get agent submission events
  const { data: events, isLoading: isLoadingEvents } = useScaffoldEventHistory({
    contractName: "AIAgentRegistry",
    eventName: "AgentSubmitted",
    fromBlock: 0n,
  });

  // Get registry's MUSIC token balance
  const { data: musicTokenContract } = useScaffoldContract({
    contractName: "MusicToken",
  });

  const { data: registryContract } = useScaffoldContract({
    contractName: "AIAgentRegistry",
  });

  const { data: registryBalance } = useBalance({
    address: registryContract?.address,
    token: musicTokenContract?.address,
  });

  const { data: userBalance } = useBalance({
    address,
    token: musicTokenContract?.address,
  });

  // Process events into agents list
  useEffect(() => {
    if (!events) return;

    const processedEvents = events.map(event => ({
      address: event.args.modelAddress,
      metadata: event.args.metadata,
      strategy: event.args.strategy,
    }));

    setAgentEvents(processedEvents as AgentEvent[]);
  }, [events]);

  if (isLoadingEvents) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">AI Agents Directory</h1>
          <Link href="/agents/create" className="btn btn-primary">
            Create Agent
          </Link>
        </div>
        <div className="text-center py-10">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4">Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">AI Agents Directory</h1>
          <div className="mt-2 space-y-1">
            <div className="text-base-content/70">
              Registry Balance: {registryBalance ? Number(registryBalance.value) / 1e18 : "0"} MUSIC
            </div>
            {address && (
              <div className="text-base-content/70">
                Your Balance: {userBalance ? Number(userBalance.value) / 1e18 : "0"} MUSIC
              </div>
            )}
          </div>
        </div>
        <Link href="/agents/create" className="btn btn-primary">
          Create Agent
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agentEvents.map(agent => (
          <AgentCard
            key={agent.address}
            address={agent.address}
            metadata={agent.metadata}
            initialStrategy={agent.strategy}
          />
        ))}
      </div>

      {agentEvents.length === 0 && (
        <div className="text-center py-10">
          <p className="text-lg mb-4">No agents registered yet.</p>
          <Link href="/agents/create" className="btn btn-primary">
            Create Your First Agent
          </Link>
        </div>
      )}
    </div>
  );
};

export default AgentsListPage;
