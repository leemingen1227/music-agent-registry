"use client";

import { useState } from "react";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const SubmitFeedbackForm = () => {
  const [feedback, setFeedback] = useState({
    alignsWithStrategy: true,
    rating: 5,
    comment: "",
  });

  const { writeContractAsync: submitFeedback } = useScaffoldWriteContract({
    contractName: "AIAgentRegistry",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitFeedback({
        functionName: "submitFeedback",
        args: [feedback.alignsWithStrategy, feedback.rating, feedback.comment],
      });
      setFeedback({ alignsWithStrategy: true, rating: 5, comment: "" });
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  };

  return (
    <div className="bg-base-200 rounded-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">Submit Feedback</h2>
      <form onSubmit={handleSubmit} className="grid gap-4">
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
        <button type="submit" className="btn btn-primary">
          Submit Feedback
        </button>
      </form>
    </div>
  );
};
