import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const userAddress = req.headers.get("x-user-address");
    if (!userAddress) {
      return NextResponse.json({ error: "User address not provided" }, { status: 401 });
    }

    const body = await req.json();
    const { agentAddress } = body;

    if (!agentAddress) {
      return NextResponse.json({ error: "Agent address not provided" }, { status: 400 });
    }

    const response = await fetch(`${process.env.AGENT_SERVER_URL}/agent/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Address": userAddress,
      },
      body: JSON.stringify({ agentAddress }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in agent initialization API route:", error);
    return NextResponse.json(
      { error: "Failed to initialize agent" },
      { status: 500 }
    );
  }
} 