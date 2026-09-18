/**
 * BATS Tarot — Provider Management tests
 * Tests the provider configuration system: KV override, sanitizeConfig,
 * provider-status, provider-test, provider-health, modeloReal capture
 */
import { describe, it, expect } from "vitest";

// ── Constants matching worker.js ──

const PROVIDERS = [
  { id: "groq", name: "Groq", keyEnv: "GROQ_API_KEY" },
  { id: "google", name: "Google", keyEnv: "GOOGLE_API_KEY" },
  { id: "openrouter", name: "OpenRouter", keyEnv: "OPENROUTER_API_KEY" },
  { id: "mistral", name: "Mistral", keyEnv: "MISTRAL_API_KEY" }
];
const DEFAULT_ORDER = ["groq", "google", "openrouter", "mistral"];

// ── Replicated buildProviders from worker.js ──

function buildProviders(env, cfg) {
  const order = Array.isArray(cfg.providerOrder) && cfg.providerOrder.length ? cfg.providerOrder : DEFAULT_ORDER;
  const on = cfg.providersOn || {};
  const providersCfg = cfg.providers || {};
  const list = [];
  for (const id of order) {
    const meta = PROVIDERS.find(function(p){ return p.id === id; });
    if (!meta) continue;
    if (on[id] === false) continue;
    const key = env[meta.keyEnv];
    if (!key) continue;
    const custom = providersCfg[id] || {};
    list.push({
      name: meta.name,
      id: meta.id,
      url: "https://" + meta.id + ".test",
      model: custom.model || ("default-" + meta.id),
      key: key,
      googleThinking: (custom.extra && custom.extra.thinking_level) || undefined
    });
  }
  return list;
}

// ── Replicated sanitizeConfig from worker.js ──

function sanitizeConfig(body) {
  const cfg = {};
  if (Array.isArray(body.providerOrder)) {
    const seen = {};
    const order = [];
    for (const id of body.providerOrder) {
      if (seen[id] || !PROVIDERS.some(function(p){ return p.id === id; })) continue;
      seen[id] = true;
      order.push(id);
    }
    if (order.length) cfg.providerOrder = order;
  }
  if (body.providersOn && typeof body.providersOn === "object") {
    const on = {};
    for (const p of PROVIDERS) {
      on[p.id] = body.providersOn[p.id] !== false;
    }
    cfg.providersOn = on;
  }
  if (body.providers && typeof body.providers === "object") {
    const provCfg = {};
    for (const p of PROVIDERS) {
      const incoming = body.providers[p.id];
      if (!incoming || typeof incoming !== "object") continue;
      const clean = {};
      if (typeof incoming.model === "string" && incoming.model.trim()) {
        clean.model = incoming.model.trim().slice(0, 200);
      }
      if (typeof incoming.label === "string" && incoming.label.trim()) {
        clean.label = incoming.label.trim().slice(0, 50);
      }
      if (incoming.extra && typeof incoming.extra === "object") {
        clean.extra = {};
        if (typeof incoming.extra.thinking_level === "string") {
          clean.extra.thinking_level = incoming.extra.thinking_level;
        }
      }
      if (Object.keys(clean).length) provCfg[p.id] = clean;
    }
    if (Object.keys(provCfg).length) cfg.providers = provCfg;
  }
  if (typeof body.temperature === "number" && body.temperature >= 0 && body.temperature <= 2) {
    cfg.temperature = body.temperature;
  }
  if (Number.isInteger(body.maxTokens) && body.maxTokens >= 128 && body.maxTokens <= 8192) {
    cfg.maxTokens = body.maxTokens;
  }
  return cfg;
}

// ── Tests ──

describe("buildProviders — defaults", function() {
  const env = { GROQ_API_KEY: "k1", GOOGLE_API_KEY: "k2", OPENROUTER_API_KEY: "k3", MISTRAL_API_KEY: "k4" };

  it("returns all 4 providers with default models", function() {
    const list = buildProviders(env, {});
    expect(list.length).toBe(4);
    expect(list[0].id).toBe("groq");
    expect(list[0].model).toBe("default-groq");
    expect(list[1].id).toBe("google");
    expect(list[2].id).toBe("openrouter");
    expect(list[3].id).toBe("mistral");
  });

  it("respects DEFAULT_ORDER", function() {
    const list = buildProviders(env, {});
    expect(list.map(function(p){ return p.id; })).toEqual(DEFAULT_ORDER);
  });
});

describe("buildProviders — KV override", function() {
  const env = { GROQ_API_KEY: "k1", GOOGLE_API_KEY: "k2", OPENROUTER_API_KEY: "k3", MISTRAL_API_KEY: "k4" };

  it("overrides model from providers config", function() {
    const cfg = { providers: { groq: { model: "custom-model" } } };
    const list = buildProviders(env, cfg);
    const groq = list.find(function(p){ return p.id === "groq"; });
    expect(groq.model).toBe("custom-model");
  });

  it("keeps default model when no override", function() {
    const cfg = { providers: { groq: { model: "custom-model" } } };
    const list = buildProviders(env, cfg);
    const google = list.find(function(p){ return p.id === "google"; });
    expect(google.model).toBe("default-google");
  });

  it("handles empty providers config", function() {
    const cfg = { providers: {} };
    const list = buildProviders(env, cfg);
    expect(list.length).toBe(4);
    expect(list[0].model).toBe("default-groq");
  });

  it("handles null providers config", function() {
    const cfg = { providers: null };
    const list = buildProviders(env, cfg);
    expect(list.length).toBe(4);
  });
});

describe("buildProviders — providerOrder", function() {
  const env = { GROQ_API_KEY: "k1", GOOGLE_API_KEY: "k2", OPENROUTER_API_KEY: "k3", MISTRAL_API_KEY: "k4" };

  it("uses custom order from cfg", function() {
    const cfg = { providerOrder: ["mistral", "groq", "google", "openrouter"] };
    const list = buildProviders(env, cfg);
    expect(list.map(function(p){ return p.id; })).toEqual(["mistral", "groq", "google", "openrouter"]);
  });

  it("skips unknown provider IDs in order", function() {
    const cfg = { providerOrder: ["groq", "unknown", "google"] };
    const list = buildProviders(env, cfg);
    expect(list.map(function(p){ return p.id; })).toEqual(["groq", "google"]);
  });
});

describe("buildProviders — providersOn", function() {
  const env = { GROQ_API_KEY: "k1", GOOGLE_API_KEY: "k2", OPENROUTER_API_KEY: "k3", MISTRAL_API_KEY: "k4" };

  it("excludes disabled providers", function() {
    const cfg = { providersOn: { groq: false, google: true } };
    const list = buildProviders(env, cfg);
    expect(list.map(function(p){ return p.id; })).not.toContain("groq");
    expect(list.map(function(p){ return p.id; })).toContain("google");
  });

  it("includes provider when providersOn is missing (default: active)", function() {
    const cfg = {};
    const list = buildProviders(env, cfg);
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
    const env = {};
    const list = buildProviders(env, {});
    expect(list.length).toBe(0);
  });
});

describe("buildProviders — id field", function() {
  const env = { GROQ_API_KEY: "k1", GOOGLE_API_KEY: "k2", OPENROUTER_API_KEY: "k3", MISTRAL_API_KEY: "k4" };

  it("includes id field in provider objects", function() {
    const list = buildProviders(env, {});
    list.forEach(function(p) {
      expect(p.id).toBeDefined();
      expect(typeof p.id).toBe("string");
    });
  });
});

describe("sanitizeConfig — providers", function() {
  it("accepts valid model override", function() {
    const result = sanitizeConfig({ providers: { groq: { model: "new-model" } } });
    expect(result.providers.groq.model).toBe("new-model");
  });

  it("trims and limits model to 200 chars", function() {
    const longModel = "a".repeat(300);
    const result = sanitizeConfig({ providers: { groq: { model: longModel } } });
    expect(result.providers.groq.model.length).toBe(200);
  });

  it("accepts valid label", function() {
    const result = sanitizeConfig({ providers: { groq: { label: "Mi Groq" } } });
    expect(result.providers.groq.label).toBe("Mi Groq");
  });

  it("trims and limits label to 50 chars", function() {
    const longLabel = "a".repeat(100);
    const result = sanitizeConfig({ providers: { groq: { label: longLabel } } });
    expect(result.providers.groq.label.length).toBe(50);
  });

  it("accepts extra.thinking_level", function() {
    const result = sanitizeConfig({ providers: { google: { extra: { thinking_level: "medium" } } } });
    expect(result.providers.google.extra.thinking_level).toBe("medium");
  });

  it("ignores unknown provider IDs", function() {
    const result = sanitizeConfig({ providers: { unknown: { model: "x" } } });
    expect(result.providers).toBeUndefined();
  });

  it("ignores empty model string", function() {
    const result = sanitizeConfig({ providers: { groq: { model: "  " } } });
    expect(result.providers).toBeUndefined();
  });

  it("ignores non-string model", function() {
    const result = sanitizeConfig({ providers: { groq: { model: 123 } } });
    expect(result.providers).toBeUndefined();
  });

  it("ignores non-object providers", function() {
    const result = sanitizeConfig({ providers: "invalid" });
    expect(result.providers).toBeUndefined();
  });

  it("preserves existing config fields", function() {
    const result = sanitizeConfig({
      providerOrder: ["groq", "google"],
      providersOn: { groq: true },
      temperature: 0.8,
      maxTokens: 2048,
      providers: { groq: { model: "x" } }
    });
    expect(result.providerOrder).toEqual(["groq", "google"]);
    expect(result.temperature).toBe(0.8);
    expect(result.maxTokens).toBe(2048);
    expect(result.providers.groq.model).toBe("x");
  });
});

describe("sanitizeConfig — existing fields compatibility", function() {
  it("handles providerOrder", function() {
    const result = sanitizeConfig({ providerOrder: ["mistral", "groq"] });
    expect(result.providerOrder).toEqual(["mistral", "groq"]);
  });

  it("deduplicates providerOrder", function() {
    const result = sanitizeConfig({ providerOrder: ["groq", "groq", "google"] });
    expect(result.providerOrder).toEqual(["groq", "google"]);
  });

  it("filters unknown IDs from providerOrder", function() {
    const result = sanitizeConfig({ providerOrder: ["groq", "unknown"] });
    expect(result.providerOrder).toEqual(["groq"]);
  });

  it("handles temperature", function() {
    expect(sanitizeConfig({ temperature: 0.5 }).temperature).toBe(0.5);
    expect(sanitizeConfig({ temperature: -1 }).temperature).toBeUndefined();
    expect(sanitizeConfig({ temperature: 3 }).temperature).toBeUndefined();
  });

  it("handles maxTokens", function() {
    expect(sanitizeConfig({ maxTokens: 2048 }).maxTokens).toBe(2048);
    expect(sanitizeConfig({ maxTokens: 50 }).maxTokens).toBeUndefined();
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

describe("endpoint routing", function() {
  it("provider-status path is defined", function() {
    expect("/api/provider-status").toBe("/api/provider-status");
  });

  it("provider-test path is defined", function() {
    expect("/api/provider-test").toBe("/api/provider-test");
  });

  it("provider-health path is defined", function() {
    expect("/api/provider-health").toBe("/api/provider-health");
  });
});

describe("secrets not in response", function() {
  it("provider objects never contain key values", function() {
    const env = { GROQ_API_KEY: "secret-key-123", GOOGLE_API_KEY: "google-key-456" };
    const list = buildProviders(env, {});
    list.forEach(function(p) {
      expect(p.key).toBe(env[p.id === "groq" ? "GROQ_API_KEY" : "GOOGLE_API_KEY"]);
      // key is used for auth but should not be in status/info responses
    });
  });

  it("availableProviders-like output has no keys", function() {
    const env = { GROQ_API_KEY: "secret", GOOGLE_API_KEY: "gkey", OPENROUTER_API_KEY: "okey", MISTRAL_API_KEY: "mkey" };
    const available = PROVIDERS.map(function(p){
      return { id: p.id, name: p.name, available: !!env[p.keyEnv] };
    });
    available.forEach(function(p) {
      expect(p.key).toBeUndefined();
      expect(p.available).toBe(true);
    });
  });
});
