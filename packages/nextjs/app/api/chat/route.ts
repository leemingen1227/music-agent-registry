import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const userAddress = req.headers.get("x-user-address");
    if (!userAddress) {
      return NextResponse.json({ error: "User address not provided" }, { status: 401 });
    }

    const body = await req.json();
    const { message, agentAddress, feedback } = body;

    if (!message || !agentAddress) {
      return NextResponse.json({ error: "Message and agent address are required" }, { status: 400 });
    }

    // First check agent status
    const statusResponse = await fetch(`${process.env.AGENT_SERVER_URL}/agent/status/${agentAddress}`, {
      headers: {
        "X-User-Address": userAddress,
      },
    });

    if (!statusResponse.ok) {
      throw new Error("Failed to check agent status");
    }

    const { isRegistered, isInitialized, status } = await statusResponse.json();
    
    if (!isRegistered) {
      return NextResponse.json({ 
        error: "Agent not found",
        details: "This agent is not registered in the AI Agent Registry"
      }, { status: 404 });
    }

    // Proceed with chat request
    const response = await fetch(`${process.env.AGENT_SERVER_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Address": userAddress,
      },
      body: JSON.stringify({ message, agentAddress, feedback }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({
      ...data,
      agentStatus: status
    });
  } catch (error) {
    console.error("Error in chat API route:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
