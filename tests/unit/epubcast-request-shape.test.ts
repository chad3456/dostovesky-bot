import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Compile-time guard on the request shapes src/lib/epubcast/generate.ts sends.
 *
 * The SDK's types are generated from the API spec, so if these objects stop
 * type-checking after an SDK upgrade, the API has moved and the generator needs
 * updating — a failure we want at build time, not at the first user request.
 */
describe("EpubCast request shapes", () => {
  it("match the SDK's types for a streaming, web-searching Opus 5 call", () => {
    const params: Anthropic.MessageCreateParamsStreaming = {
      model: "claude-opus-5",
      max_tokens: 16000,
      system: "You write a two-host literary podcast.",
      // Adaptive thinking: no budget_tokens, no sampling params on Opus 5.
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      messages: [{ role: "user", content: "Write segment 1." }],
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
      stream: true,
    };
    expect(params.model).toBe("claude-opus-5");
    expect(params.tools?.[0]).toMatchObject({ name: "web_search" });
  });

  it("match the SDK's types for the server-side refusal fallback", () => {
    const params: Anthropic.Beta.Messages.MessageCreateParamsStreaming = {
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      messages: [{ role: "user", content: "Write segment 1." }],
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      stream: true,
    };
    expect(params.fallbacks).toEqual([{ model: "claude-opus-4-8" }]);
  });
});
