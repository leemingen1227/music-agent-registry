"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

interface FeedbackModalProps {
  agentAddress: string;
  isOpen: boolean;
  onClose: () => void;
  lastRecommendation: string;
  onFeedbackResponse: (response: string) => void;
}

export const FeedbackModal = ({
  agentAddress,
  isOpen,
  onClose,
  lastRecommendation,
  onFeedbackResponse,
}: FeedbackModalProps) => {
  const { address } = useAccount();
  const [feedback, setFeedback] = useState({
    alignsWithStrategy: true,
    rating: 5,
    comment: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AGENT_SERVER_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Address": address,
        },
        body: JSON.stringify({
          message: `Submit feedback for your last recommendation with the following details:
            - Aligns with strategy: ${feedback.alignsWithStrategy}
            - Rating: ${feedback.rating}
            - Comment: ${feedback.comment}`,
          agentAddress,
          feedback: {
            alignsWithStrategy: feedback.alignsWithStrategy,
            rating: feedback.rating,
            comment: feedback.comment,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      const data = await response.json();
      const agentResponse = data.response.join(" ");
      onFeedbackResponse(agentResponse);

      setFeedback({ alignsWithStrategy: true, rating: 5, comment: "" });
      onClose();
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-200 rounded-lg p-6 max-w-lg w-full">
        <h2 className="text-2xl font-semibold mb-4">Give Feedback</h2>

        <div className="mb-4">
          <h3 className="font-medium mb-2">Last Recommendation:</h3>
          <p className="text-sm bg-base-300 p-3 rounded">{lastRecommendation}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label cursor-pointer">
              <span className="label-text">Aligns with Strategy</span>
              <input
                type="checkbox"
                className="toggle"
                checked={feedback.alignsWithStrategy}
                onChange={e => setFeedback({ ...feedback, alignsWithStrategy: e.target.checked })}
              />
            </label>
          </div>

          <div>
            <label className="label">
              <span className="label-text">Rating (1-5)</span>
            </label>
            <input
              type="number"
              min="1"
              max="5"
              className="input input-bordered w-full"
              value={feedback.rating}
              onChange={e => setFeedback({ ...feedback, rating: Math.min(5, Math.max(1, parseInt(e.target.value))) })}
            />
          </div>

          <div>
            <label className="label">
              <span className="label-text">Comment</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              value={feedback.comment}
              onChange={e => setFeedback({ ...feedback, comment: e.target.value })}
              placeholder="Your feedback"
            />
          </div>

          <div className="flex gap-2 mt-6">
            <button
              type="submit"
              className={`btn btn-primary flex-1`}
              disabled={isSubmitting || !address}
            >
              {isSubmitting ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                "Submit Feedback"
              )}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
