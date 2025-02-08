"use client";

import { useEffect, useState } from "react";
import { FeedbackModal } from "./FeedbackModal";
import { useAccount } from "wagmi";

interface Message {
  role: "user" | "agent";
  content: string;
}

interface ChatInterfaceProps {
  agentAddress: string;
}

export const ChatInterface = ({ agentAddress }: ChatInterfaceProps) => {
  const { address } = useAccount();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [lastRecommendation, setLastRecommendation] = useState("");
  const [agentStatus, setAgentStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const checkAgentStatus = async () => {
      if (!address) return;

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_AGENT_SERVER_URL}/agent/status/${agentAddress}`, {
          headers: {
            "X-User-Address": address,
          },
        });

        if (!response.ok) throw new Error("Failed to check agent status");

        const data = await response.json();
        setAgentStatus(data.status === "ready" ? "ready" : "error");
      } catch (error) {
        console.error("Error checking agent status:", error);
        setAgentStatus("error");
      }
    };

    if (address) {
      checkAgentStatus();
    }
  }, [agentAddress, address]);

  if (agentStatus === "loading") {
    return <div className="loading loading-spinner loading-lg"></div>;
  }

  if (agentStatus === "error") {
    return (
      <div className="alert alert-error">
        <p>Failed to initialize agent. Please try again later.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !address) return;

    const userMessage = newMessage;
    setNewMessage("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AGENT_SERVER_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Address": address,
        },
        body: JSON.stringify({
          message: userMessage,
          agentAddress,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      const agentResponse = data.response.join(" ");
      setMessages(prev => [...prev, { role: "agent", content: agentResponse }]);
      setLastRecommendation(agentResponse);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [
        ...prev,
        { role: "agent", content: "Sorry, I encountered an error processing your message." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedbackResponse = (response: string) => {
    setMessages(prev => [...prev, { role: "agent", content: response }]);
  };

  return (
    <>
      <div className="bg-base-200 rounded-lg p-4">
        <div className="flex flex-col space-y-4 h-[400px]">
          <div className="flex-1 overflow-y-auto space-y-4 p-4">
            {messages.map((message, index) => (
              <div key={index} className={`chat ${message.role === "user" ? "chat-end" : "chat-start"}`}>
                <div
                  className={`chat-bubble ${message.role === "user" ? "chat-bubble-primary" : "chat-bubble-secondary"}`}
                >
                  {message.content}
                </div>
                {message.role === "agent" && index === messages.length - 1 && (
                  <div className="chat-footer opacity-50 text-xs flex gap-1 items-center mt-1">
                    <button onClick={() => setShowFeedbackModal(true)} className="btn btn-xs btn-ghost">
                      Give Feedback
                    </button>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="chat chat-start">
                <div className="chat-bubble chat-bubble-secondary">
                  <span className="loading loading-dots loading-sm"></span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="input input-bordered flex-1"
              disabled={isLoading}
            />
            <button
              type="submit"
              className={`btn btn-primary ${isLoading ? "loading" : ""}`}
              disabled={isLoading || !newMessage.trim()}
            >
              Send
            </button>
          </form>
        </div>
      </div>

      <FeedbackModal
        agentAddress={agentAddress}
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        lastRecommendation={lastRecommendation}
        onFeedbackResponse={handleFeedbackResponse}
      />
    </>
  );
};
