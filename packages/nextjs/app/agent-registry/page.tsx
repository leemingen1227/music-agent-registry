"use client";

import { AgentInformation } from "./_components/AgentInformation";
import { SubmitAgentForm } from "./_components/SubmitAgentForm";
import { SubmitFeedbackForm } from "./_components/SubmitFeedbackForm";
import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const AIAgentRegistryPage = () => {
  const { address } = useAccount();

  // Read agent data
  const { data: agentStrategy } = useScaffoldReadContract({
    contractName: "AIAgentRegistry",
    functionName: "getAgentStrategy",
    args: [address],
  });

  const { data: agentStats } = useScaffoldReadContract({
    contractName: "AIAgentRegistry",
    functionName: "getAgentStats",
    args: [address],
  });

  // Destructure the array returned by getAgentStats
  const [totalFeedbacks, positiveAlignments, averageRating] = agentStats || [0n, 0n, 0n];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">AI Agent Registry</h1>

      <AgentInformation
        agentStrategy={agentStrategy}
        totalFeedbacks={totalFeedbacks}
        positiveAlignments={positiveAlignments}
        averageRating={averageRating}
      />

      <SubmitAgentForm />

      <SubmitFeedbackForm />
    </div>
  );
};

export default AIAgentRegistryPage;
