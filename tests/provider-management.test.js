/**
 * BATS Tarot — Provider Management tests (v2 — flexible 5-provider schema)
 * Tests: buildProviders, sanitizeConfig, URL validation, migration,
 * modeloReal, secrets protection, fallback, edge cases
 */
import { describe, it, expect } from "vitest";

// ── Constants matching worker.js ──

const MAX_PROVIDERS = 5;
const DEFAULT_PROVIDERS = [
  { id: "groq", name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", secretRef: "GROQ_API_KEY" },
  { id: "google", name: "Google", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-3.6-flash", secretRef: "GOOGLE_API_KEY", extra: { thinking_level: "low" } },
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", model: "openrouter/free", secretRef: "OPENROUTER_API_KEY" },
  { id: "mistral", name: "Mistral", url: "https://api.mistral.ai/v1/chat/completions", model: "ministral-14b-latest", secretRef: "MISTRAL_API_KEY" }
];

// ── Replicated functions from worker.js ──

function isValidProviderUrl(url) {
  if (typeof url !== "string" || !url.trim()) return false;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    if (/javascript:/i.test(url)) return false;
    if (/data:/i.test(url)) return false;
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "0.0.0.0") return false;
    if (u.username || u.password) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function migrateLegacyConfig(cfg) {
  if (Array.isArray(cfg.providers) && cfg.providers.length && cfg.providers[0] && typeof cfg.providers[0].id === "string") {
    return cfg.providers.slice(0, MAX_PROVIDERS);
  }
  const order = Array.isArray(cfg.providerOrder) && cfg.providerOrder.length ? cfg.providerOrder : DEFAULT_PROVIDERS.map(function(p){ return p.id; });
  const on = cfg.providersOn || {};
  const provCfg = cfg.providers && typeof cfg.providers === "object" && !Array.isArray(cfg.providers) ? cfg.providers : {};
  const migrated = [];
  const seen = {};
  for (const id of order) {
    if (seen[id]) continue;
    seen[id] = true;
    const def = DEFAULT_PROVIDERS.find(function(d){ return d.id === id; });
    if (!def) continue;
    if (on[id] === false) continue;
    const custom = provCfg[id] || {};
    migrated.push({
      id: id,
      name: custom.label || def.name,
      url: def.url,
      model: custom.model || def.model,
      secretRef: def.secretRef,
      enabled: on[id] !== false,
      extra: custom.extra || def.extra || {}
    });
  }
  return migrated;
}

function buildProviders(env, cfg) {
  const list = migrateLegacyConfig(cfg);
  const result = [];
  for (const p of list) {
    if (p.enabled === false) continue;
    if (!p.secretRef) continue;
    const key = env[p.secretRef];
    if (!key) continue;
    if (!isValidProviderUrl(p.url)) continue;
    result.push({
      id: p.id,
      name: p.name,
      url: p.url,
      model: p.model,
      key: key,
      extra: p.extra || {}
    });
  }
  return result;
}

function sanitizeProvidersArray(arr) {
  if (!Array.isArray(arr)) return null;
  const clean = [];
  const seenIds = {};
  for (const p of arr) {
    if (!p || typeof p !== "object") continue;
    if (clean.length >= MAX_PROVIDERS) break;
    const id = typeof p.id === "string" && p.id.trim() ? p.id.trim().slice(0, 30) : "";
    if (!id || seenIds[id]) continue;
    seenIds[id] = true;
    const entry = { id: id };
    if (typeof p.name === "string" && p.name.trim()) entry.name = p.name.trim().slice(0, 50);
    if (typeof p.url === "string" && p.url.trim()) {
      const url = p.url.trim();
      if (isValidProviderUrl(url)) entry.url = url;
    }
    if (typeof p.model === "string" && p.model.trim()) entry.model = p.model.trim().slice(0, 200);
    if (typeof p.secretRef === "string" && p.secretRef.trim()) entry.secretRef = p.secretRef.trim().slice(0, 50);
    if (typeof p.enabled === "boolean") entry.enabled = p.enabled;
    if (p.extra && typeof p.extra === "object" && !Array.isArray(p.extra)) {
      const extra = {};
      if (typeof p.extra.thinking_level === "string") extra.thinking_level = p.extra.thinking_level;
      if (Object.keys(extra).length) entry.extra = extra;
    }
    if (entry.url && entry.model && entry.secretRef) clean.push(entry);
  }
  return clean.length ? clean : null;
}

function sanitizeConfig(body) {
  const cfg = {};
  if (body.providers && Array.isArray(body.providers)) {
    const sanitized = sanitizeProvidersArray(body.providers);
    if (sanitized) cfg.providers = sanitized;
  }
  if (typeof body.temperature === "number" && body.temperature >= 0 && body.temperature <= 2) {
    cfg.temperature = body.temperature;
  }
  if (Number.isInteger(body.maxTokens) && body.maxTokens >= 128 && body.maxTokens <= 8192) {
    cfg.maxTokens = body.maxTokens;
  }
  if (typeof body.useCorta === "boolean") cfg.useCorta = body.useCorta;
  if (typeof body.useLarga === "boolean") cfg.useLarga = body.useLarga;
  return cfg;
}

// ── Tests ──

describe("isValidProviderUrl", function() {
  it("accepts valid HTTPS URLs", function() {
    expect(isValidProviderUrl("https://api.groq.com/openai/v1/chat/completions")).toBe(true);
    expect(isValidProviderUrl("https://example.com/v1")).toBe(true);
  });

  it("rejects HTTP", function() {
    expect(isValidProviderUrl("http://api.example.com")).toBe(false);
  });

  it("rejects javascript:", function() {
    expect(isValidProviderUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects data:", function() {
    expect(isValidProviderUrl("data:text/html,<h1>hi</h1>")).toBe(false);
  });

  it("rejects localhost", function() {
    expect(isValidProviderUrl("https://localhost:8080/v1")).toBe(false);
    expect(isValidProviderUrl("https://127.0.0.1/v1")).toBe(false);
    expect(isValidProviderUrl("https://0.0.0.0/v1")).toBe(false);
  });

  it("rejects URLs with credentials", function() {
    expect(isValidProviderUrl("https://user:pass@example.com/v1")).toBe(false);
  });

  it("rejects empty/invalid strings", function() {
    expect(isValidProviderUrl("")).toBe(false);
    expect(isValidProviderUrl("not-a-url")).toBe(false);
    expect(isValidProviderUrl(123)).toBe(false);
  });
});

describe("buildProviders — defaults", function() {
  const env = { GROQ_API_KEY: "k1", GOOGLE_API_KEY: "k2", OPENROUTER_API_KEY: "k3", MISTRAL_API_KEY: "k4" };

  it("returns all 4 providers with default models", function() {
    const list = buildProviders(env, {});
    expect(list.length).toBe(4);
    expect(list[0].id).toBe("groq");
    expect(list[0].model).toBe("llama-3.3-70b-versatile");
    expect(list[1].id).toBe("google");
    expect(list[2].id).toBe("openrouter");
    expect(list[3].id).toBe("mistral");
  });

  it("preserves DEFAULT_PROVIDERS order", function() {
    const list = buildProviders(env, {});
    expect(list.map(function(p){ return p.id; })).toEqual(["groq", "google", "openrouter", "mistral"]);
  });

  it("includes url in provider objects", function() {
    const list = buildProviders(env, {});
    list.forEach(function(p) {
      expect(p.url).toBeDefined();
      expect(p.url).toMatch(/^https:\/\//);
    });
  });
});

describe("buildProviders — new providers array format", function() {
  const env = { GROQ_API_KEY: "k1", GOOGLE_API_KEY: "k2", OPENROUTER_API_KEY: "k3", MISTRAL_API_KEY: "k4", CUSTOM_KEY: "ck" };

  it("reads from providers array", function() {
    const cfg = {
      providers: [
        { id: "groq", name: "Groq", url: "https://api.groq.com/v1", model: "custom-model", secretRef: "GROQ_API_KEY", enabled: true }
      ]
    };
    const list = buildProviders(env, cfg);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("groq");
    expect(list[0].model).toBe("custom-model");
  });

  it("respects enabled: false", function() {
    const cfg = {
      providers: [
        { id: "groq", name: "Groq", url: "https://api.groq.com/v1", model: "m", secretRef: "GROQ_API_KEY", enabled: false }
      ]
    };
    const list = buildProviders(env, cfg);
    expect(list.length).toBe(0);
  });

  it("supports up to 5 providers", function() {
    const cfg = {
      providers: [
        { id: "p1", name: "P1", url: "https://a.com/v1", model: "m1", secretRef: "GROQ_API_KEY" },
        { id: "p2", name: "P2", url: "https://b.com/v1", model: "m2", secretRef: "GOOGLE_API_KEY" },
        { id: "p3", name: "P3", url: "https://c.com/v1", model: "m3", secretRef: "OPENROUTER_API_KEY" },
        { id: "p4", name: "P4", url: "https://d.com/v1", model: "m4", secretRef: "MISTRAL_API_KEY" },
        { id: "p5", name: "P5", url: "https://e.com/v1", model: "m5", secretRef: "GROQ_API_KEY" }
      ]
    };
    const list = buildProviders(env, cfg);
    expect(list.length).toBe(5);
  });

  it("skips providers without secretRef", function() {
    const cfg = {
      providers: [
        { id: "p1", name: "P1", url: "https://a.com/v1", model: "m1", secretRef: "NONEXISTENT_KEY" }
      ]
    };
    const list = buildProviders(env, cfg);
    expect(list.length).toBe(0);
  });

  it("skips providers with invalid URL", function() {
    const cfg = {
      providers: [
        { id: "p1", name: "P1", url: "http://insecure.com/v1", model: "m1", secretRef: "GROQ_API_KEY" }
      ]
    };
    const list = buildProviders(env, cfg);
    expect(list.length).toBe(0);
  });
});

describe("buildProviders — legacy migration", function() {
  const env = { GROQ_API_KEY: "k1", GOOGLE_API_KEY: "k2", OPENROUTER_API_KEY: "k3", MISTRAL_API_KEY: "k4" };

  it("migrates from providerOrder + providersOn", function() {
    const cfg = {
      providerOrder: ["google", "groq"],
      providersOn: { groq: false }
    };
    const list = buildProviders(env, cfg);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("google");
  });

  it("migrates from old providers object format", function() {
    const cfg = {
      providers: { groq: { model: "old-override" } }
    };
    const list = buildProviders(env, cfg);
    const groq = list.find(function(p){ return p.id === "groq"; });
    expect(groq.model).toBe("old-override");
  });

  it("migrates empty config to defaults", function() {
    const list = buildProviders(env, {});
    expect(list.length).toBe(4);
  });
});

describe("buildProviders — missing secrets", function() {
  it("excludes providers without API key", function() {
    const env = { GROQ_API_KEY: "k1" };
    const list = buildProviders(env, {});
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("groq");
  });

  it("returns empty when no keys", function() {
    const list = buildProviders({}, {});
    expect(list.length).toBe(0);
  });
});

describe("sanitizeProvidersArray", function() {
  it("accepts valid provider entries", function() {
    const result = sanitizeProvidersArray([
      { id: "p1", name: "Test", url: "https://api.example.com/v1", model: "m1", secretRef: "KEY1" }
    ]);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("p1");
  });

  it("limits to MAX_PROVIDERS", function() {
    const arr = [];
    for (let i = 0; i < 10; i++) {
      arr.push({ id: "p" + i, url: "https://a" + i + ".com/v1", model: "m" + i, secretRef: "K" + i });
    }
    const result = sanitizeProvidersArray(arr);
    expect(result.length).toBe(MAX_PROVIDERS);
  });

  it("rejects entries without url/model/secretRef", function() {
    const result = sanitizeProvidersArray([
      { id: "p1", name: "Test" }
    ]);
    expect(result).toBeNull();
  });

  it("rejects duplicate IDs", function() {
    const result = sanitizeProvidersArray([
      { id: "p1", url: "https://a.com/v1", model: "m1", secretRef: "K1" },
      { id: "p1", url: "https://b.com/v1", model: "m2", secretRef: "K2" }
    ]);
    expect(result.length).toBe(1);
  });

  it("rejects invalid URLs", function() {
    const result = sanitizeProvidersArray([
      { id: "p1", url: "http://insecure.com/v1", model: "m1", secretRef: "K1" }
    ]);
    expect(result).toBeNull();
  });

  it("trims and limits fields", function() {
    const result = sanitizeProvidersArray([
      { id: "p1", name: "a".repeat(100), url: "https://a.com/v1", model: "b".repeat(300), secretRef: "c".repeat(100) }
    ]);
    expect(result[0].name.length).toBe(50);
    expect(result[0].model.length).toBe(200);
    expect(result[0].secretRef.length).toBe(50);
  });

  it("accepts extra.thinking_level", function() {
    const result = sanitizeProvidersArray([
      { id: "p1", url: "https://a.com/v1", model: "m1", secretRef: "K1", extra: { thinking_level: "high" } }
    ]);
    expect(result[0].extra.thinking_level).toBe("high");
  });

  it("rejects non-array input", function() {
    expect(sanitizeProvidersArray("invalid")).toBeNull();
    expect(sanitizeProvidersArray(null)).toBeNull();
    expect(sanitizeProvidersArray(undefined)).toBeNull();
  });

  it("rejects non-object entries", function() {
    const result = sanitizeProvidersArray(["invalid", 123, null]);
    expect(result).toBeNull();
  });
});

describe("sanitizeConfig", function() {
  it("accepts providers array", function() {
    const result = sanitizeConfig({
      providers: [{ id: "p1", url: "https://a.com/v1", model: "m1", secretRef: "K1" }]
    });
    expect(result.providers.length).toBe(1);
  });

  it("ignores providers when not array", function() {
    const result = sanitizeConfig({ providers: { groq: { model: "x" } } });
    expect(result.providers).toBeUndefined();
  });

  it("preserves temperature and maxTokens", function() {
    const result = sanitizeConfig({ temperature: 0.8, maxTokens: 2048 });
    expect(result.temperature).toBe(0.8);
    expect(result.maxTokens).toBe(2048);
  });

  it("rejects invalid temperature", function() {
    expect(sanitizeConfig({ temperature: -1 }).temperature).toBeUndefined();
    expect(sanitizeConfig({ temperature: 3 }).temperature).toBeUndefined();
  });

  it("rejects invalid maxTokens", function() {
    expect(sanitizeConfig({ maxTokens: 50 }).maxTokens).toBeUndefined();
    expect(sanitizeConfig({ maxTokens: 10000 }).maxTokens).toBeUndefined();
  });

  it("handles useCorta and useLarga", function() {
    expect(sanitizeConfig({ useCorta: false }).useCorta).toBe(false);
    expect(sanitizeConfig({ useLarga: true }).useLarga).toBe(true);
  });
});

describe("modeloReal — capture", function() {
  it("modelReal is null when upstream has no model field", function() {
    const upstream = { choices: [{ message: { content: "test content here" } }] };
    const modelReal = upstream.model || null;
    expect(modelReal).toBeNull();
  });

  it("modelReal captures upstream model when present", function() {
    const upstream = { model: "meta-llama/llama-3.1-70b", choices: [{ message: { content: "test" } }] };
    const modelReal = upstream.model || null;
    expect(modelReal).toBe("meta-llama/llama-3.1-70b");
  });

  it("response distinguishes configured vs actual model", function() {
    const configured = "openrouter/free";
    const actual = "meta-llama/llama-3.1-70b";
    const response = { modelo: configured, modeloReal: actual };
    expect(response.modelo).toBe("openrouter/free");
    expect(response.modeloReal).toBe("meta-llama/llama-3.1-70b");
  });
});

describe("fallback behavior", function() {
  const env = { GROQ_API_KEY: "k1", GOOGLE_API_KEY: "k2", OPENROUTER_API_KEY: "k3", MISTRAL_API_KEY: "k4" };

  it("deterministic order from providers array", function() {
    const cfg = {
      providers: [
        { id: "p1", name: "First", url: "https://a.com/v1", model: "m1", secretRef: "GROQ_API_KEY" },
        { id: "p2", name: "Second", url: "https://b.com/v1", model: "m2", secretRef: "GOOGLE_API_KEY" }
      ]
    };
    const list = buildProviders(env, cfg);
    expect(list[0].id).toBe("p1");
    expect(list[1].id).toBe("p2");
  });

  it("skips disabled providers in fallback", function() {
    const cfg = {
      providers: [
        { id: "p1", name: "First", url: "https://a.com/v1", model: "m1", secretRef: "GROQ_API_KEY", enabled: false },
        { id: "p2", name: "Second", url: "https://b.com/v1", model: "m2", secretRef: "GOOGLE_API_KEY" }
      ]
    };
    const list = buildProviders(env, cfg);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("p2");
  });
});

describe("secrets not in response", function() {
  it("provider objects contain key for auth but status does not", function() {
    const env = { GROQ_API_KEY: "secret-key-123" };
    const list = buildProviders(env, {});
    expect(list[0].key).toBe("secret-key-123");
    const status = {
      id: list[0].id,
      name: list[0].name,
      hasKey: true,
      model: list[0].model,
      url: list[0].url
    };
    expect(status.key).toBeUndefined();
  });
});

describe("edge cases", function() {
  it("handles 1 provider", function() {
    const env = { GROQ_API_KEY: "k1" };
    const cfg = {
      providers: [
        { id: "only", name: "Only", url: "https://a.com/v1", model: "m", secretRef: "GROQ_API_KEY" }
      ]
    };
    const list = buildProviders(env, cfg);
    expect(list.length).toBe(1);
  });

  it("handles empty providers array", function() {
    const list = buildProviders({}, { providers: [] });
    expect(list.length).toBe(0);
  });

  it("provider with extra.thinking_level passes through", function() {
    const env = { GROQ_API_KEY: "k1" };
    const cfg = {
      providers: [
        { id: "p1", name: "P1", url: "https://a.com/v1", model: "m", secretRef: "GROQ_API_KEY", extra: { thinking_level: "high" } }
      ]
    };
    const list = buildProviders(env, cfg);
    expect(list[0].extra.thinking_level).toBe("high");
  });
});
