import { NextRequest, NextResponse } from "next/server";

let latestStats = {};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");

  if (authHeader !== `Bearer ${process.env.API_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await req.json();
    latestStats = { ...data, lastUpdate: new Date().toISOString() };

    console.log("Received data:", latestStats);

    return NextResponse.json({ message: "Data received", status: "ok" });
  } catch (error) {
    console.error("Error processing data:", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json(latestStats);
}