"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { BoltIcon, ChatBubbleBottomCenterIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  return (
    <div className="flex flex-col min-h-screen bg-base-300">
      {/* Hero Section */}
      <div className="flex-grow flex flex-col items-center justify-center px-4 py-24">
        <div className="max-w-3xl text-center">
          <h1 className="text-6xl font-bold mb-8 text-base-content">
            AI Agent Registry
          </h1>
          <p className="text-xl mb-12 text-base-content/80">
            A decentralized platform for registering, challenging, and governing AI agents through community-driven validation.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link 
              href="/agents" 
              className="btn btn-lg px-8 bg-secondary hover:bg-secondary/80 text-secondary-content border-none"
            >
              Explore Agents
            </Link>
            <Link 
              href="/agents/create" 
              className="btn btn-lg px-8 bg-primary hover:bg-primary/80 text-primary-content border-none"
            >
              Create Agent
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 px-4 bg-base-200">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16 text-base-content">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card bg-base-100 shadow-xl hover:bg-base-200 transition-colors duration-300">
              <div className="card-body items-center text-center">
                <BoltIcon className="w-12 h-12 text-primary mb-6" />
                <h3 className="text-xl font-bold mb-4 text-base-content">Agent Registration</h3>
                <p className="text-base-content/70">
                  Register your AI agents with customizable strategies and secure token staking mechanisms.
                </p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl hover:bg-base-200 transition-colors duration-300">
              <div className="card-body items-center text-center">
                <ShieldCheckIcon className="w-12 h-12 text-secondary mb-6" />
                <h3 className="text-xl font-bold mb-4 text-base-content">Community Governance</h3>
                <p className="text-base-content/70">
                  Participate in agent validation through challenges and voting with token-based governance.
                </p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl hover:bg-base-200 transition-colors duration-300">
              <div className="card-body items-center text-center">
                <ChatBubbleBottomCenterIcon className="w-12 h-12 text-accent mb-6" />
                <h3 className="text-xl font-bold mb-4 text-base-content">Interactive Chat</h3>
                <p className="text-base-content/70">
                  Engage with registered agents through a direct chat interface and provide feedback.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 px-4 bg-base-100">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6 text-base-content">Ready to Get Started?</h2>
          <p className="mb-12 text-base-content/70 text-lg">
            Join our community of AI agents and contribute to the future of decentralized AI governance.
          </p>
          <Link 
            href="/agents/create" 
            className="btn btn-lg px-8 bg-primary hover:bg-primary/80 text-primary-content border-none"
          >
            Create Your First Agent
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
