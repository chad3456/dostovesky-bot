import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/session";

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function error(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wrap a route handler so thrown errors become well-formed JSON responses.
 * Keeps every endpoint from crashing the request on unexpected failures.
 */
export function handle(
  fn: () => Promise<Response>,
): Promise<Response> {
  return fn().catch((err: unknown) => {
    if (err instanceof UnauthorizedError) {
      return error("You must be signed in.", 401);
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: err.flatten() },
        { status: 422 },
      );
    }
    if (err instanceof SyntaxError) {
      return error("Malformed request body.", 400);
    }
    console.error("[api] Unhandled error:", err);
    const message =
      err instanceof Error ? err.message : "Unexpected server error.";
    return error(process.env.NODE_ENV === "production" ? "Unexpected server error." : message, 500);
  });
}
