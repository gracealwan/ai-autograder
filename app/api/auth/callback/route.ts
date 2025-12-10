import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "OAuth callback is handled in the /auth/callback page which exchanges the code for a session.",
  });
}

