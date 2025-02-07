import { NextRequest, NextResponse } from "next/server";

const AGENT_SERVER_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userAddress = req.headers.get("x-user-address");

    if (!userAddress) {
      return NextResponse.json({ error: "User address not provided" }, { status: 401 });
    }

    // Add feedback data to the request if present
    const requestBody = {
      ...body,
      userAddress,
    };

    const response = await fetch(`${AGENT_SERVER_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Address": userAddress,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in chat API route:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
