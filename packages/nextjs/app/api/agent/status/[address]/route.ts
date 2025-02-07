import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const userAddress = req.headers.get("x-user-address");
    if (!userAddress) {
      return NextResponse.json({ error: "User address not provided" }, { status: 401 });
    }

    const agentAddress = params.address;
    if (!agentAddress) {
      return NextResponse.json({ error: "Agent address not provided" }, { status: 400 });
    }

    const response = await fetch(`${process.env.AGENT_SERVER_URL}/agent/status/${agentAddress}`, {
      headers: {
        "X-User-Address": userAddress,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in agent status API route:", error);
    return NextResponse.json(
      { error: "Failed to check agent status" },
      { status: 500 }
    );
  }
} 