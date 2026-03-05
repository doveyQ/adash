import { NextRequest, NextResponse } from "next/server";

/**
 * Verify the API key from the Authorization header.
 * Returns a 401 NextResponse if unauthorized, or null if authorized.
 *
 * Usage:
 *   const authError = requireApiKey(req);
 *   if (authError) return authError;
 */
export function requireApiKey(req: NextRequest): NextResponse | null {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.API_KEY}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
}

/**
 * Add standard cache headers to a response.
 * Default: private, max-age=10 (10 seconds).
 */
export function withCacheHeaders(
    response: NextResponse,
    maxAge: number = 10
): NextResponse {
    response.headers.set(
        "Cache-Control",
        `private, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`
    );
    return response;
}
