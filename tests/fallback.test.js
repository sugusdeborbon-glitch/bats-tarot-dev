/**
 * BATS Tarot — Fallback provider tests
 * Tests the sequential fallback logic from worker/worker.js
 * Simulates provider responses with mocked fetch
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock provider logic (extracted from worker.js for testability) ──

function buildProviders(env, cfg) {
  const PROVIDERS = [
    { id: "groq", name: "Groq", keyEnv: "GROQ_API_KEY" },
    { id: "sambanova", name: "SambaNova", keyEnv: "SAMBANOVA_API_KEY" },
    { id: "google", name: "Google", keyEnv: "GOOGLE_API_KEY" },
    { id: "openrouter", name: "OpenRouter", keyEnv: "OPENROUTER_API_KEY" },
    { id: "nvidia", name: "NVIDIA", keyEnv: "NVIDIA_API_KEY" },
    { id: "mistral", name: "Mistral", keyEnv: "MISTRAL_API_KEY" }
  ];
  const DEFAULT_ORDER = ["groq", "sambanova", "google", "openrouter", "nvidia"];
  const order = Array.isArray(cfg.providerOrder) && cfg.providerOrder.length ? cfg.providerOrder : DEFAULT_ORDER;
  const on = cfg.providersOn || {};
  const list = [];
  for (const id of order) {
    const meta = PROVIDERS.find(function(p){ return p.id === id; });
    if (!meta) continue;
    if (on[id] === false) continue;
    const key = env[meta.keyEnv];
    if (!key) continue;
    list.push({ name: meta.name, key: key, model: "test-model", url: "https://" + meta.id + ".test" });
  }
  return list;
}

async function llamarProveedor(provider, messages, payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, 40000);
  try {
    const upstream = await fetch(provider.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + provider.key },
      body: JSON.stringify({ model: provider.model, messages, temperature: payload.temperature, max_tokens: payload.max_tokens }),
      signal: ctrl.signal
    });
    let data;
    try {
      data = await upstream.json();
    } catch (parseErr) {
      return { ok: false, status: upstream.status, err: provider.name + " (" + upstream.status + "): respuesta no JSON", category: "parse_error" };
    }
    if (!upstream.ok) {
      const detalle = data && data.error ? (data.error.message || data.error.status || JSON.stringify(data.error)) : JSON.stringify(data).slice(0, 300);
      let category = "provider_error";
      if (upstream.status === 429) category = "rate_limited";
      else if (upstream.status >= 500) category = "server_error";
      else if (upstream.status === 408) category = "timeout";
      return { ok: false, status: upstream.status, err: provider.name + " (" + upstream.status + "): " + detalle, category };
    }
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content || content.length < 80) {
      return { ok: false, status: 502, err: "Respuesta vacía de " + provider.name, category: "empty_response" };
    }
    return { ok: true, status: upstream.status, content };
  } catch (e) {
    if (e && e.name === "AbortError") {
      return { ok: false, status: 504, err: provider.name + ": timeout (40s)", category: "timeout" };
    }
    return { ok: false, status: 502, err: provider.name + ": error de red — " + (e && e.message || "desconocido"), category: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

async function fallbackLoop(providers, msgs, payload) {
  let last = null;
  const errors = [];
  for (const provider of providers) {
    const res = await llamarProveedor(provider, msgs, payload);
    if (res.ok) {
      return { ok: true, content: res.content, provider: provider.name };
    }
    last = res;
    errors.push(provider.name + ": " + res.err + " [" + (res.category || "unknown") + "]");
  }
  if (last) {
    const status = last.status && last.status >= 400 ? last.status : 502;
    return { ok: false, status, error: "Todos los proveedores fallaron (" + providers.length + "): " + errors.join(" | ") };
  }
  return { ok: false, status: 502, error: "Error desconocido" };
}

// ── Tests ──

describe("buildProviders() — provider ordering", () => {
  const env = { GROQ_API_KEY: "gk", SAMBANOVA_API_KEY: "sk", GOOGLE_API_KEY: "gk2", OPENROUTER_API_KEY: "ok", NVIDIA_API_KEY: "nk", MISTRAL_API_KEY: "mk" };

  it("returns default order when no config", () => {
    const list = buildProviders(env, {});
    expect(list.map(function(p){ return p.name; })).toEqual(["Groq", "SambaNova", "Google", "OpenRouter", "NVIDIA"]);
  });

  it("respects custom order", () => {
    const list = buildProviders(env, { providerOrder: ["nvidia", "google"] });
    expect(list.map(function(p){ return p.name; })).toEqual(["NVIDIA", "Google"]);
  });

  it("excludes disabled providers", () => {
    const list = buildProviders(env, { providersOn: { groq: false } });
    expect(list.map(function(p){ return p.name; })).not.toContain("Groq");
  });

  it("excludes providers with missing keys", () => {
    const env2 = { GROQ_API_KEY: "gk" };
    const list = buildProviders(env2, {});
    expect(list.map(function(p){ return p.name; })).toEqual(["Groq"]);
  });
});

describe("fallback loop — Caso A: primer proveedor funciona", () => {
  let origFetch;
  beforeEach(() => { origFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = origFetch; });

  it("returns first provider on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: "A".repeat(100) } }] })
    });
    const providers = [{ name: "Groq", key: "gk", model: "m", url: "https://groq.test" }];
    const result = await fallbackLoop(providers, [], { temperature: 0.7, max_tokens: 1000 });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("Groq");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("fallback loop — Caso B: P1 429, P2 funciona", () => {
  let origFetch;
  beforeEach(() => { origFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = origFetch; });

  it("skips rate-limited provider and returns second", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 429, json: async () => ({ error: { message: "Rate limited" } }) };
      }
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "B".repeat(100) } }] }) };
    });
    const providers = [
      { name: "Groq", key: "gk", model: "m", url: "https://groq.test" },
      { name: "Google", key: "gk2", model: "m", url: "https://google.test" }
    ];
    const result = await fallbackLoop(providers, [], { temperature: 0.7, max_tokens: 1000 });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("Google");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("fallback loop — Caso C: P1 5xx, P2 funciona", () => {
  let origFetch;
  beforeEach(() => { origFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = origFetch; });

  it("skips server-error provider and returns second", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 503, json: async () => ({ error: { message: "Service unavailable" } }) };
      }
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "C".repeat(100) } }] }) };
    });
    const providers = [
      { name: "Groq", key: "gk", model: "m", url: "https://groq.test" },
      { name: "Google", key: "gk2", model: "m", url: "https://google.test" }
    ];
    const result = await fallbackLoop(providers, [], { temperature: 0.7, max_tokens: 1000 });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("Google");
  });
});

describe("fallback loop — Caso D: P1 timeout, P2 funciona", () => {
  let origFetch;
  beforeEach(() => { origFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = origFetch; });

  it("skips timed-out provider and returns second", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        const err = new Error("Aborted");
        err.name = "AbortError";
        throw err;
      }
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "D".repeat(100) } }] }) };
    });
    const providers = [
      { name: "Groq", key: "gk", model: "m", url: "https://groq.test" },
      { name: "Google", key: "gk2", model: "m", url: "https://google.test" }
    ];
    const result = await fallbackLoop(providers, [], { temperature: 0.7, max_tokens: 1000 });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("Google");
  });
});

describe("fallback loop — Caso E: P1 error, P2 error, P3 funciona", () => {
  let origFetch;
  beforeEach(() => { origFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = origFetch; });

  it("skips two failed providers and returns third", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 429, json: async () => ({ error: { message: "Rate limited" } }) };
      }
      if (callCount === 2) {
        return { ok: false, status: 500, json: async () => ({ error: { message: "Internal error" } }) };
      }
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "E".repeat(100) } }] }) };
    });
    const providers = [
      { name: "Groq", key: "gk", model: "m", url: "https://groq.test" },
      { name: "Google", key: "gk2", model: "m", url: "https://google.test" },
      { name: "NVIDIA", key: "nk", model: "m", url: "https://nvidia.test" }
    ];
    const result = await fallbackLoop(providers, [], { temperature: 0.7, max_tokens: 1000 });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("NVIDIA");
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
});

describe("fallback loop — Caso F: todos fallan", () => {
  let origFetch;
  beforeEach(() => { origFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = origFetch; });

  it("returns error with all provider details", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return { ok: false, status: 500, json: async () => ({ error: { message: "Server error" } }) };
    });
    const providers = [
      { name: "Groq", key: "gk", model: "m", url: "https://groq.test" },
      { name: "Google", key: "gk2", model: "m", url: "https://google.test" },
      { name: "NVIDIA", key: "nk", model: "m", url: "https://nvidia.test" }
    ];
    const result = await fallbackLoop(providers, [], { temperature: 0.7, max_tokens: 1000 });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toContain("Todos los proveedores fallaron");
    expect(result.error).toContain("Groq");
    expect(result.error).toContain("Google");
    expect(result.error).toContain("NVIDIA");
  });
});

describe("llamarProveedor — error categorization", () => {
  let origFetch;
  beforeEach(() => { origFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = origFetch; });

  it("categorizes 429 as rate_limited", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ error: { message: "Rate limited" } })
    });
    const result = await llamarProveedor({ name: "Test", key: "k", model: "m", url: "https://test" }, [], { temperature: 0.7, max_tokens: 100 });
    expect(result.ok).toBe(false);
    expect(result.category).toBe("rate_limited");
    expect(result.status).toBe(429);
  });

  it("categorizes 5xx as server_error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 503,
      json: async () => ({ error: { message: "Unavailable" } })
    });
    const result = await llamarProveedor({ name: "Test", key: "k", model: "m", url: "https://test" }, [], { temperature: 0.7, max_tokens: 100 });
    expect(result.ok).toBe(false);
    expect(result.category).toBe("server_error");
  });

  it("categorizes AbortError as timeout", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    });
    const result = await llamarProveedor({ name: "Test", key: "k", model: "m", url: "https://test" }, [], { temperature: 0.7, max_tokens: 100 });
    expect(result.ok).toBe(false);
    expect(result.category).toBe("timeout");
    expect(result.status).toBe(504);
  });

  it("categorizes network error as network_error", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await llamarProveedor({ name: "Test", key: "k", model: "m", url: "https://test" }, [], { temperature: 0.7, max_tokens: 100 });
    expect(result.ok).toBe(false);
    expect(result.category).toBe("network_error");
  });

  it("categorizes non-JSON response as parse_error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => { throw new Error("Unexpected token"); }
    });
    const result = await llamarProveedor({ name: "Test", key: "k", model: "m", url: "https://test" }, [], { temperature: 0.7, max_tokens: 100 });
    expect(result.ok).toBe(false);
    expect(result.category).toBe("parse_error");
  });
});
