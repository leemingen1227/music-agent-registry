"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AgentCard } from "./_components/AgentCard";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

interface AgentEvent {
  address: string;
  metadata: string;
  strategy: string;
}

const AgentsListPage = () => {
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);

  // Get agent submission events
  const { data: events, isLoading: isLoadingEvents } = useScaffoldEventHistory({
    contractName: "AIAgentRegistry",
    eventName: "AgentSubmitted",
    fromBlock: 0n,
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
        <h1 className="text-4xl font-bold">AI Agents Directory</h1>
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
