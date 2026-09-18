/**
 * BATS Tarot — Ollama suspended state tests
 * Verifies Ollama is hidden from UI and not in active provider lists.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const indexHtml = readFileSync("C:/BAPA_Factory/bats-tarot/index.html", "utf8");

describe("Ollama — UI visibility", () => {
  it("ollama option is disabled and hidden in index.html", () => {
    const match = indexHtml.match(/<option[^>]*value="ollama"[^>]*>/i);
    expect(match).not.toBeNull();
    expect(match[0]).toContain("disabled");
    expect(match[0]).toContain("hidden");
  });

  it("ollama option text indicates disabled state", () => {
    const match = indexHtml.match(/<option[^>]*value="ollama"[^>]*>[^<]*/i);
    expect(match).not.toBeNull();
    expect(match[0].toLowerCase()).toContain("desactivado");
  });

  it("other providers are NOT disabled", () => {
    const providers = ["openai", "nvidia", "groq", "openrouter", "mistral"];
    for (const p of providers) {
      const re = new RegExp('<option[^>]*value="' + p + '"[^>]*>', "i");
      const match = indexHtml.match(re);
      expect(match).not.toBeNull();
      expect(match[0]).not.toContain("disabled");
      expect(match[0]).not.toContain("hidden");
    }
  });
});

describe("Ollama — Worker provider list", () => {
  it("DEFAULT_ORDER does not include ollama", async () => {
    const workerSrc = readFileSync("C:/BAPA_Factory/bats-tarot/worker/worker.js", "utf8");
    const orderMatch = workerSrc.match(/DEFAULT_ORDER\s*=\s*\[([^\]]+)\]/);
    expect(orderMatch).not.toBeNull();
    expect(orderMatch[1]).not.toContain("ollama");
  });

  it("PROVIDERS array does not include ollama", async () => {
    const workerSrc = readFileSync("C:/BAPA_Factory/bats-tarot/worker/worker.js", "utf8");
    const providersMatch = workerSrc.match(/const PROVIDERS\s*=\s*\[([\s\S]*?)\];/);
    expect(providersMatch).not.toBeNull();
    expect(providersMatch[1]).not.toContain("ollama");
  });
});

describe("Ollama — AI_PROVIDERS client list", () => {
  it("AI_PROVIDERS contains ollama entry for future use", async () => {
    const aiSrc = readFileSync("C:/BAPA_Factory/bats-tarot/ai.js", "utf8");
    expect(aiSrc).toContain('"ollama"');
    expect(aiSrc).toContain("Ollama");
  });
});

describe("Ollama — no active calls in normal flow", () => {
  it("no fetch() call to localhost:11434 in ai.js", async () => {
    const aiSrc = readFileSync("C:/BAPA_Factory/bats-tarot/ai.js", "utf8");
    // Check there's no fetch/POST to localhost:11434 (only the AI_PROVIDERS definition is allowed)
    const lines = aiSrc.split("\n");
    const fetchLines = lines.filter(l => /fetch\s*\(/.test(l) && l.includes("localhost:11434"));
    expect(fetchLines).toHaveLength(0);
  });

  it("no fetch to localhost:11434 in ai-pipeline.js", async () => {
    const pipelineSrc = readFileSync("C:/BAPA_Factory/bats-tarot/js/ai-pipeline.js", "utf8");
    expect(pipelineSrc).not.toContain("localhost:11434");
  });

  it("no fetch to localhost:11434 in app.js", async () => {
    const appSrc = readFileSync("C:/BAPA_Factory/bats-tarot/app.js", "utf8");
    expect(appSrc).not.toContain("localhost:11434");
  });
});
