"use client";

import { useEffect, useRef, useState } from "react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-y-auto mb-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} w-full`}
          >
            <div className="flex flex-col max-w-[80%]">
              <div
                className={`break-words rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-primary text-primary-content"
                    : "bg-secondary text-secondary-content"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              </div>
              {message.role === "agent" && index === messages.length - 1 && (
                <div className="mt-1 ml-2">
                  <button 
                    onClick={() => setShowFeedbackModal(true)} 
                    className="btn btn-xs btn-ghost text-base-content/60 hover:text-base-content"
                  >
                    Give Feedback
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-neutral text-neutral-content max-w-[80%] rounded-lg px-4 py-2">
              <span className="loading loading-dots loading-sm"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="input input-bordered flex-grow bg-base-100"
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

      <FeedbackModal
        agentAddress={agentAddress}
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        lastRecommendation={lastRecommendation}
        onFeedbackResponse={handleFeedbackResponse}
      />
    </div>
  );
};
