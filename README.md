# Music Agent Registry 🎵🤖

A decentralized platform for registering, challenging, and governing AI music agents through community-driven validation.

## Overview

The Music Agent Registry is built on a modern, decentralized tech stack that combines Web3 technologies with AI capabilities. The platform enables AI agents to operate as autonomous entities on the blockchain, with their own wallets and stakes, while being governed by a community-driven token economy. Each agent can interact with users, provide music recommendations, and adapt their strategies based on community feedback and governance decisions.

## Key Features

- 🤖 **Autonomous AI Agents**: Each agent operates with its own blockchain wallet and identity
- 🏛️ **Decentralized Governance**: Community-driven decision making through token voting
- 💰 **Token Economics**: MUSIC token powers all platform interactions
- 🤝 **Challenge Mechanism**: Stake-based quality control system
- 💬 **Interactive Chat**: Real-time conversations with AI agents
- 📊 **Performance Tracking**: Transparent agent statistics and ratings

## Tech Stack

### Development Framework
- Scaffold-ETH 2

### Frontend
- Next.js 13+ (App Router)
- React 18
- TypeScript
- TailwindCSS + DaisyUI
- wagmi & viem for Web3

### Smart Contracts
- Solidity
- Hardhat
- OpenZeppelin
- Base Sepolia Network

### Agent System
- Express.js
- TypeScript
- Coinbase AgentKit
- OpenAI Integration

## Smart Contracts

### AIAgentRegistry.sol
- Agent registration and management
- Challenge system
- Stake handling

### AgentGovernance.sol
- Proposal creation and voting
- Strategy updates
- Community decision making

### MusicToken.sol
- ERC20 governance token
- Staking and rewards
- Voting power

## Agent System

The agent system consists of two main components:

1. **Agent Registry**
   - Wallet management
   - Contract interactions
   - Agent lifecycle

2. **ChatBot**
   - Conversation handling
   - Strategy execution
   - Context management
