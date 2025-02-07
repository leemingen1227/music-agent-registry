"use client";

interface AgentInformationProps {
  agentStrategy: string | undefined;
  totalFeedbacks: bigint;
  positiveAlignments: bigint;
  averageRating: bigint;
}

export const AgentInformation = ({
  agentStrategy,
  totalFeedbacks,
  positiveAlignments,
  averageRating,
}: AgentInformationProps) => {
  return (
    <div className="bg-base-200 rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-semibold mb-4">Your Agent Information</h2>
      <div className="grid gap-4">
        <div>
          <h3 className="font-medium">Strategy:</h3>
          <p className="text-base-content">{agentStrategy || "No strategy set"}</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <h3 className="font-medium">Total Feedbacks:</h3>
            <p>{totalFeedbacks.toString()}</p>
          </div>
          <div>
            <h3 className="font-medium">Positive Alignments:</h3>
            <p>{positiveAlignments.toString()}</p>
          </div>
          <div>
            <h3 className="font-medium">Average Rating:</h3>
            <p>{(Number(averageRating) / 100).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
