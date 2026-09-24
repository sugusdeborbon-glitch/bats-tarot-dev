/**
 * BATS Tarot — Provider Management tests (v3 — draft como única fuente de verdad)
 *
 * Regla de esta suite: NO se reimplementa la lógica del producto.
 *  - El saneado/migración se importa del worker REAL (`worker/worker.js`).
 *  - El Admin se ejecuta extrayendo el chunk real de `app.js` y cargándolo con
 *    un DOM falso + un backend falso que usa TAMBIÉN las funciones reales del
 *    Worker (sanitizeConfig -> "KV" -> providerStatus).
 *
 * Todos los flujos de Admin arrancan EN FRÍO (sin estado precargado a mano):
 * solo se inyecta la respuesta GET del Worker, igual que en producción.
 */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import worker, {
  MAX_PROVIDERS,
  DEFAULT_PROVIDERS,
  MIN_CONTENT_CHARS,
  PROBE_MAX_TOKENS,
  PROBE_MIN_CONTENT_CHARS,
  PROBE_MESSAGE,
  isValidProviderUrl,
  migrateLegacyConfig,
  buildProviders,
  sanitizeProvidersArray,
  sanitizeConfig,
  providerStatus,
  resolveSecretRef,
  redactConfig
} from "../worker/worker.js";

const DEFAULT_IDS = DEFAULT_PROVIDERS.map(function (p) { return p.id; });
const FAKE_ENV = {
  GROQ_API_KEY: "k1",
  GOOGLE_API_KEY: "k2",
  OPENROUTER_API_KEY: "k3",
  MISTRAL_API_KEY: "k4"
};

// ── Worker real: validación de URL ──

describe("isValidProviderUrl (worker real)", function () {
  it("accepts valid HTTPS URLs", function () {
    expect(isValidProviderUrl("https://api.groq.com/openai/v1/chat/completions")).toBe(true);
    expect(isValidProviderUrl("https://example.com/v1")).toBe(true);
  });

  it("rejects HTTP", function () {
    expect(isValidProviderUrl("http://api.example.com")).toBe(false);
  });

  it("rejects javascript: and data:", function () {
    expect(isValidProviderUrl("javascript:alert(1)")).toBe(false);
    expect(isValidProviderUrl("data:text/html,<h1>hi</h1>")).toBe(false);
  });

  it("rejects localhost", function () {
    expect(isValidProviderUrl("https://localhost:8080/v1")).toBe(false);
    expect(isValidProviderUrl("https://127.0.0.1/v1")).toBe(false);
    expect(isValidProviderUrl("https://0.0.0.0/v1")).toBe(false);
  });

  it("rejects URLs with credentials", function () {
    expect(isValidProviderUrl("https://user:pass@example.com/v1")).toBe(false);
  });

  it("rejects empty/invalid strings", function () {
    expect(isValidProviderUrl("")).toBe(false);
    expect(isValidProviderUrl("not-a-url")).toBe(false);
    expect(isValidProviderUrl(123)).toBe(false);
  });
});

// ── Worker real: buildProviders ──

describe("buildProviders — defaults (worker real)", function () {
  it("returns all 4 providers with default models", function () {
    const list = buildProviders(FAKE_ENV, {});
    expect(list.length).toBe(4);
    expect(list[0].id).toBe("groq");
    expect(list[0].model).toBe("llama-3.3-70b-versatile");
    expect(list.map(function (p) { return p.id; })).toEqual(DEFAULT_IDS);
  });

  it("defaults use a valid https URL", function () {
    buildProviders(FAKE_ENV, {}).forEach(function (p) {
      expect(p.url).toMatch(/^https:\/\//);
    });
  });
});

describe("buildProviders — providers array (worker real)", function () {
  it("reads from providers array", function () {
    const list = buildProviders(FAKE_ENV, {
      providers: [{ id: "groq", name: "Groq", url: "https://api.groq.com/v1", model: "custom-model", secretRef: "GROQ_API_KEY", enabled: true }]
    });
    expect(list.length).toBe(1);
    expect(list[0].model).toBe("custom-model");
  });

  it("respects enabled: false", function () {
    const list = buildProviders(FAKE_ENV, {
      providers: [{ id: "groq", name: "Groq", url: "https://api.groq.com/v1", model: "m", secretRef: "GROQ_API_KEY", enabled: false }]
    });
    expect(list.length).toBe(0);
  });

  it("supports up to 5 providers", function () {
    const many = [];
    for (let i = 1; i <= 7; i++) {
      many.push({ id: "p" + i, name: "P" + i, url: "https://a" + i + ".com/v1", model: "m" + i, secretRef: "GROQ_API_KEY" });
    }
    expect(buildProviders(FAKE_ENV, { providers: many }).length).toBe(MAX_PROVIDERS);
  });

  it("skips providers without key or with invalid URL", function () {
    expect(buildProviders(FAKE_ENV, {
      providers: [{ id: "p1", url: "https://a.com/v1", model: "m", secretRef: "NONEXISTENT_KEY" }]
    }).length).toBe(0);
    expect(buildProviders(FAKE_ENV, {
      providers: [{ id: "p1", url: "http://insecure.com/v1", model: "m", secretRef: "GROQ_API_KEY" }]
    }).length).toBe(0);
  });

  it("preserves the array order (fallback determinista)", function () {
    const list = buildProviders(FAKE_ENV, {
      providers: [
        { id: "p2", url: "https://b.com/v1", model: "m2", secretRef: "GOOGLE_API_KEY" },
        { id: "p1", url: "https://a.com/v1", model: "m1", secretRef: "GROQ_API_KEY" }
      ]
    });
    expect(list.map(function (p) { return p.id; })).toEqual(["p2", "p1"]);
  });
});

describe("migrateLegacyConfig — array vacío es explícito (worker real)", function () {
  it("migrates a legacy providers object", function () {
    const list = buildProviders(FAKE_ENV, { providers: { groq: { model: "old-override" } } });
    expect(list.find(function (p) { return p.id === "groq"; }).model).toBe("old-override");
  });

  it("migrates from providerOrder + providersOn", function () {
    const list = buildProviders(FAKE_ENV, { providerOrder: ["google", "groq"], providersOn: { groq: false } });
    expect(list.map(function (p) { return p.id; })).toEqual(["google"]);
  });

  it("empty config falls back to DEFAULT_PROVIDERS", function () {
    expect(migrateLegacyConfig({}).length).toBe(4);
  });

  it("providers: [] significa CERO proveedores (no resucita los defaults)", function () {
    expect(migrateLegacyConfig({ providers: [] }).length).toBe(0);
    expect(buildProviders(FAKE_ENV, { providers: [] }).length).toBe(0);
  });

  it("una lista guardada sobrevive intacta", function () {
    const cfg = {
      providers: [{ id: "only", name: "Only", url: "https://a.com/v1", model: "m", secretRef: "GROQ_API_KEY" }]
    };
    expect(migrateLegacyConfig(cfg).length).toBe(1);
  });
});

// ── Worker real: sanitizeProvidersArray / sanitizeConfig ──

describe("sanitizeProvidersArray (worker real)", function () {
  it("accepts valid provider entries", function () {
    const res = sanitizeProvidersArray([{ id: "p1", name: "Test", url: "https://api.example.com/v1", model: "m1", secretRef: "KEY1" }]);
    expect(res.ok).toBe(true);
    expect(res.providers.length).toBe(1);
    expect(res.dropped).toEqual([]);
  });

  it("limits to MAX_PROVIDERS and reports the dropped ones", function () {
    const arr = [];
    for (let i = 0; i < 8; i++) arr.push({ id: "p" + i, url: "https://a" + i + ".com/v1", model: "m" + i, secretRef: "K" + i });
    const res = sanitizeProvidersArray(arr);
    expect(res.providers.length).toBe(MAX_PROVIDERS);
    expect(res.dropped.length).toBe(3);
    res.dropped.forEach(function (d) { expect(d.reason).toBe("max-proveedores"); });
  });

  it("reports incomplete entries instead of dropping them silently", function () {
    const res = sanitizeProvidersArray([
      { id: "ok", url: "https://a.com/v1", model: "m", secretRef: "API_KEY" },
      { id: "sin-modelo", url: "https://b.com/v1", secretRef: "API_KEY" },
      { id: "sin-url", model: "m", secretRef: "API_KEY" },
      { id: "url-http", url: "http://b.com/v1", model: "m", secretRef: "API_KEY" }
    ]);
    expect(res.providers.map(function (p) { return p.id; })).toEqual(["ok"]);
    expect(res.dropped.length).toBe(3);
    expect(res.dropped[0]).toMatchObject({ id: "sin-modelo", reason: "incompleto", missing: ["model"] });
    expect(res.dropped[1].missing).toEqual(["url"]);
    expect(res.dropped[2].missing).toEqual(["url"]);
  });

  it("reports duplicate ids, non-objects and missing ids", function () {
    const res = sanitizeProvidersArray([
      { id: "p1", url: "https://a.com/v1", model: "m1", secretRef: "K1" },
      { id: "p1", url: "https://b.com/v1", model: "m2", secretRef: "K2" },
      "invalid",
      { url: "https://c.com/v1", model: "m", secretRef: "K" }
    ]);
    expect(res.providers.length).toBe(1);
    expect(res.dropped.map(function (d) { return d.reason; })).toEqual(["id-duplicado", "entrada-no-objeto", "sin-id"]);
  });

  it("trims/limits name y model; un secretRef que no es identificador se descarta", function () {
    const res = sanitizeProvidersArray([
      { id: "p1", name: "a".repeat(100), url: "https://a.com/v1", model: "b".repeat(300), secretRef: "c".repeat(100) }
    ]);
    // "c".repeat(100) no respeta el contrato de identificador -> dropped.
    expect(res.providers.length).toBe(0);
    expect(res.dropped.length).toBe(1);
    expect(res.dropped[0]).toMatchObject({ id: "p1", reason: "secretref-no-identificador" });
    const ok = sanitizeProvidersArray([
      { id: "p2", name: "a".repeat(100), url: "https://b.com/v1", model: "b".repeat(300), secretRef: "KEY1" }
    ]);
    expect(ok.providers[0].name.length).toBe(50);
    expect(ok.providers[0].model.length).toBe(200);
    expect(ok.providers[0].secretRef).toBe("KEY1");
  });

  it("accepts extra.thinking_level and enabled", function () {
    const res = sanitizeProvidersArray([
      { id: "p1", url: "https://a.com/v1", model: "m1", secretRef: "K1", extra: { thinking_level: "high" }, enabled: false }
    ]);
    expect(res.providers[0].extra.thinking_level).toBe("high");
    expect(res.providers[0].enabled).toBe(false);
  });

  it("non-array input is an explicit error", function () {
    expect(sanitizeProvidersArray("invalid").ok).toBe(false);
    expect(sanitizeProvidersArray(null).error).toMatch(/array/);
    expect(sanitizeProvidersArray(undefined).ok).toBe(false);
  });
});

describe("sanitizeConfig — los 4 casos del campo providers (worker real)", function () {
  const VALID = [{ id: "p1", url: "https://a.com/v1", model: "m1", secretRef: "K1" }];

  it("1. ausente: no toca providers", function () {
    const res = sanitizeConfig({ temperature: 0.8 });
    expect(res.error).toBeUndefined();
    expect(res.cfg.providers).toBeUndefined();
    expect(res.cfg.temperature).toBe(0.8);
  });

  it("2. array válido: se persiste saneado", function () {
    const res = sanitizeConfig({ providers: VALID });
    expect(res.error).toBeUndefined();
    expect(res.cfg.providers.length).toBe(1);
    expect(res.warnings).toEqual([]);
  });

  it("2b. array parcialmente válido: persiste lo válido y avisa de lo descartado", function () {
    const res = sanitizeConfig({ providers: VALID.concat([{ id: "roto", url: "https://b.com/v1" }]) });
    expect(res.error).toBeUndefined();
    expect(res.cfg.providers.length).toBe(1);
    expect(res.warnings.length).toBe(1);
    expect(res.warnings[0].id).toBe("roto");
    expect(res.warnings[0].missing).toContain("model");
  });

  it("3. array vacío: se persiste como vacío explícito", function () {
    const res = sanitizeConfig({ providers: [] });
    expect(res.error).toBeUndefined();
    expect(res.cfg.providers).toEqual([]);
  });

  it("3b. array vacío sobrevive el ciclo KV -> migrateLegacyConfig", function () {
    const res = sanitizeConfig({ providers: [] });
    expect(migrateLegacyConfig(res.cfg).length).toBe(0);
  });

  it("4. array inválido (no array): error explícito, no se persiste", function () {
    expect(sanitizeConfig({ providers: { groq: { model: "x" } } }).error).toMatch(/array/);
    expect(sanitizeConfig({ providers: "nope" }).error).toMatch(/array/);
    expect(sanitizeConfig({ providers: 7 }).error).toMatch(/array/);
  });

  it("4b. todas las entradas inválidas: error con el detalle de lo descartado", function () {
    const res = sanitizeConfig({ providers: [{ id: "roto", name: "Roto" }] });
    expect(res.error).toMatch(/Ningún proveedor válido/);
    expect(res.warnings.length).toBe(1);
    expect(res.warnings[0].id).toBe("roto");
  });

  it("preserva temperature / maxTokens / useCorta / useLarga y rechaza valores inválidos", function () {
    const res = sanitizeConfig({ temperature: 0.8, maxTokens: 2048, useCorta: false, useLarga: true });
    expect(res.cfg.temperature).toBe(0.8);
    expect(res.cfg.maxTokens).toBe(2048);
    expect(res.cfg.useCorta).toBe(false);
    expect(res.cfg.useLarga).toBe(true);
    expect(sanitizeConfig({ temperature: -1 }).cfg.temperature).toBeUndefined();
    expect(sanitizeConfig({ temperature: 3 }).cfg.temperature).toBeUndefined();
    expect(sanitizeConfig({ maxTokens: 50 }).cfg.maxTokens).toBeUndefined();
    expect(sanitizeConfig({ maxTokens: 10000 }).cfg.maxTokens).toBeUndefined();
  });
});

describe("secrets not exposed by providerStatus (worker real)", function () {
  it("status objects contain hasKey but never the key", function () {
    const status = providerStatus(FAKE_ENV, {});
    expect(status.length).toBe(4);
    status.forEach(function (p) {
      expect(p.hasKey).toBe(true);
      expect(p.key).toBeUndefined();
    });
  });

  it("providerStatus nunca incluye el campo secretRef", function () {
    const cfg = { providers: [{ id: "groq", name: "Groq", url: "https://api.groq.com/v1", model: "m", secretRef: "GROQ_API_KEY", enabled: true }] };
    const status = providerStatus(FAKE_ENV, cfg);
    expect(status.length).toBe(1);
    expect(Object.keys(status[0]).sort()).toEqual(["active", "extra", "hasKey", "id", "model", "name", "url"]);
    expect(status[0].secretRef).toBeUndefined();
  });

  it("aunque la KV venga contaminada, providerStatus no repite el valor", function () {
    const cfg = { providers: [{ id: "groq", name: "Groq", url: "https://api.groq.com/v1", model: "m", secretRef: "gsk_TEST_SECRET_DO_NOT_USE", enabled: true }] };
    const status = providerStatus(FAKE_ENV, cfg);
    expect(status[0].secretRef).toBeUndefined();
    expect(JSON.stringify(status)).not.toMatch(/gsk_/);
    expect(status[0].hasKey).toBe(false);
  });
});

// ── CONTRATO DE CREDENCIALES: secretRef = NOMBRE del Cloudflare Secret ──

describe("resolveSecretRef (worker real)", function () {
  it("valores de credencial reales no se resuelven como nombre de secret", function () {
    expect(resolveSecretRef("groq", "gsk_TEST_SECRET_DO_NOT_USE")).toBeNull();
    expect(resolveSecretRef("groq", "sk-abc123")).toBeNull();
    expect(resolveSecretRef("groq", "Bearer eyJhbGciOiJI")).toBeNull();
    expect(resolveSecretRef("groq", "eyJhbGciOiJIUzI1NiJ9")).toBeNull();
    expect(resolveSecretRef("groq", "AIzaSyTEST")).toBeNull();
  });

  it("nombres válidos se devuelven tal cual", function () {
    expect(resolveSecretRef("groq", "GROQ_API_KEY")).toBe("GROQ_API_KEY");
    expect(resolveSecretRef("custom", "MI_CLAVE_2")).toBe("MI_CLAVE_2");
  });

  it("ids por defecto sin nombre usan el secretRef de fábrica", function () {
    expect(resolveSecretRef("groq", "")).toBe("GROQ_API_KEY");
    expect(resolveSecretRef("mistral", "  ")).toBe("MISTRAL_API_KEY");
    expect(resolveSecretRef("groq", undefined)).toBe("GROQ_API_KEY");
  });

  it("un id desconocido sin nombre no tiene secret que resolver", function () {
    expect(resolveSecretRef("custom", "")).toBeNull();
    expect(resolveSecretRef("custom", undefined)).toBeNull();
  });
});

describe("redactConfig (worker real)", function () {
  it("elimina secretRef de config.providers sin mutar el original", function () {
    const cfg = { providers: [{ id: "groq", name: "Groq", url: "https://api.groq.com/v1", model: "m", secretRef: "GROQ_API_KEY", enabled: true }], temperature: 0.8 };
    const out = redactConfig(cfg);
    expect(out.providers[0].secretRef).toBeUndefined();
    expect(out.providers[0].id).toBe("groq");
    expect(out.temperature).toBe(0.8);
    expect(cfg.providers[0].secretRef).toBe("GROQ_API_KEY");
  });

  it("toler config sin providers", function () {
    expect(redactConfig({ temperature: 0.5 }).providers).toBeUndefined();
    expect(redactConfig({})).toEqual({});
  });

  it("una config legada (objeto) no expone secretRef (no la tiene)", function () {
    const legacy = { providers: { groq: { model: "x" } } };
    expect(redactConfig(legacy)).toEqual(legacy);
  });
});

describe("sanitizeProvidersArray — contrato de identificador (worker real)", function () {
  it("cada valor de credencial real se descarta con secretref-no-identificador", function () {
    ["gsk_TEST_SECRET_DO_NOT_USE", "sk-abc123", "Bearer eyJhbGci", "eyJhbGciOiJIUzI1NiJ9", "AIzaSyTEST"].forEach(function (v) {
      const res = sanitizeProvidersArray([{ id: "p1", url: "https://a.com/v1", model: "m1", secretRef: v }]);
      expect(res.providers.length).toBe(0);
      expect(res.dropped.length).toBe(1);
      expect(res.dropped[0]).toMatchObject({ id: "p1", reason: "secretref-no-identificador" });
    });
  });

  it("acepta identificadores válidos y rechaza minúsculas/símbolos", function () {
    ["GROQ_API_KEY", "OPENROUTER_API_KEY_2"].forEach(function (v) {
      const res = sanitizeProvidersArray([{ id: "p1", url: "https://a.com/v1", model: "m1", secretRef: v }]);
      expect(res.providers.length).toBe(1);
      expect(res.providers[0].secretRef).toBe(v);
    });
    expect(sanitizeProvidersArray([{ id: "p1", url: "https://a.com/v1", model: "m1", secretRef: "groq_api_key" }]).dropped[0].reason).toBe("secretref-no-identificador");
    expect(sanitizeProvidersArray([{ id: "p1", url: "https://a.com/v1", model: "m1", secretRef: "GROQ_API-KEY" }]).dropped[0].reason).toBe("secretref-no-identificador");
  });

  it("inyecta el secretRef de fábrica para ids por defecto sin nombre", function () {
    const res = sanitizeProvidersArray([{ id: "groq", url: "https://a.com/v1", model: "m1", secretRef: "" }]);
    expect(res.providers.length).toBe(1);
    expect(res.providers[0].secretRef).toBe("GROQ_API_KEY");
  });

  it("un id desconocido sin secretRef sigue siendo incompleto", function () {
    const res = sanitizeProvidersArray([{ id: "custom", url: "https://a.com/v1", model: "m1", secretRef: "" }]);
    expect(res.providers.length).toBe(0);
    expect(res.dropped[0].missing).toContain("secretRef");
  });

  it("un id por defecto con nombre válido conserva ESE nombre (no sobreescribe)", function () {
    const res = sanitizeProvidersArray([{ id: "groq", url: "https://a.com/v1", model: "m1", secretRef: "GROQ_CLAVE_2" }]);
    expect(res.providers[0].secretRef).toBe("GROQ_CLAVE_2");
  });
});

describe("sanitizeConfig — PUT contaminado no persiste (worker real)", function () {
  it("sólo entradas contaminadas: error y nada se llega a persistir", function () {
    const res = sanitizeConfig({ providers: [{ id: "groq", url: "https://a.com/v1", model: "m", secretRef: "gsk_TEST_SECRET_DO_NOT_USE" }] });
    expect(res.error).toBeTruthy();
    expect(res.cfg).toBeUndefined();
    expect(JSON.stringify(res)).not.toMatch(/gsk_TEST_SECRET_DO_NOT_USE/);
  });

  it("contaminada + válida: sólo persiste la válida con warning secretref-no-identificador", function () {
    const res = sanitizeConfig({ providers: [
      { id: "groq", url: "https://a.com/v1", model: "m", secretRef: "GROQ_API_KEY" },
      { id: "custom", url: "https://b.com/v1", model: "m2", secretRef: "gsk_TEST_SECRET_DO_NOT_USE" }
    ] });
    expect(res.error).toBeUndefined();
    expect(res.cfg.providers.length).toBe(1);
    expect(res.cfg.providers[0].id).toBe("groq");
    expect(res.warnings[0]).toMatchObject({ id: "custom", reason: "secretref-no-identificador" });
  });

  it("la KV escrita nunca contiene el valor contaminado", function () {
    const backend = makeFakeBackend({});
    const r = backend.put({ providers: [
      { id: "groq", url: "https://a.com/v1", model: "m", secretRef: "GROQ_API_KEY" },
      { id: "custom", url: "https://b.com/v1", model: "m2", secretRef: "gsk_TEST_SECRET_DO_NOT_USE" }
    ] });
    expect(r.status).toBe(200);
    expect(JSON.stringify(backend.getKv())).not.toMatch(/gsk_TEST_SECRET_DO_NOT_USE/);
    expect(backend.getKv().providers.map(function (p) { return p.id; })).toEqual(["groq"]);
  });
});

describe("worker — /api/provider-test sin eco de credenciales", function () {
  function envOnly(extra) {
    return Object.assign({ ADMIN_TOKEN: "at", CONFIG: { get: async function () { return null; }, put: async function () { } } }, extra);
  }
  function callTest(body, env) {
    const req = new Request("http://worker.local/api/provider-test", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": "at" },
      body: JSON.stringify(body)
    });
    return worker.fetch(req, env);
  }

  it("un secretRef contaminado no llega a resolverse y el error no lo repite", async function () {
    const res = await callTest(
      { providerConfig: { id: "groq", name: "Groq", url: "https://api.groq.com/v1", model: "m", secretRef: "gsk_TEST_SECRET_DO_NOT_USE" } },
      envOnly()
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Credencial no configurada para groq");
    expect(data.error).not.toMatch(/gsk_TEST_SECRET_DO_NOT_USE/);
  });

  it("proveedor por defecto sin nombre: solo usa la env real y el error no repite el nombre recibido", async function () {
    const res = await callTest(
      { providerConfig: { id: "groq", name: "Groq", url: "https://api.groq.com/v1", model: "m", secretRef: "" } },
      envOnly()
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Credencial no configurada para groq");
  });

  it("una URL inválida se rechaza antes de tocar credenciales", async function () {
    const res = await callTest(
      { providerConfig: { id: "groq", url: "http://insecure.com/v1", model: "m", secretRef: "GROQ_API_KEY" } },
      envOnly({ GROQ_API_KEY: "k1" })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("URL inválida");
  });
});

describe("round-trip PUT -> GET redactado (worker real)", function () {
  it("KV guarda solo el nombre; el cliente nunca recibe el nombre ni el valor", function () {
    const backend = makeFakeBackend();
    const r = backend.put({ providers: [{ id: "groq", url: "https://api.groq.com/v1", model: "m", secretRef: "GROQ_API_KEY", enabled: true }], temperature: 0.7 });
    expect(r.status).toBe(200);
    expect(r.body.config.providers[0].secretRef).toBe("GROQ_API_KEY");
    const snap = backend.snapshot();
    expect(redactConfig(snap.config).providers[0].secretRef).toBeUndefined();
    expect(snap.providerInfo[0].secretRef).toBeUndefined();
    expect(JSON.stringify(snap)).not.toMatch(/gsk_/);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  ADMIN — flujos reales de app.js ejecutados desde estado EN FRÍO
// ══════════════════════════════════════════════════════════════════════════

const APP_JS_PATH = new URL("../app.js", import.meta.url);
const LECTURA_POR_VOZ = "/* ============ LECTURA POR VOZ";

/**
 * DOM falso mínimo. `innerHTML=""` desregistra SOLO el subárbol del contenedor
 * (como el DOM real), para que un re-render de los cards no borre el resto del
 * panel (p. ej. #admin-msg).
 */
function makeFakeDoc() {
  const reg = new Map();

  function unregister(el) {
    (el.children || []).forEach(function (child) {
      if (child.id) reg.delete(child.id);
      unregister(child);
    });
  }

  function fakeEl(tag) {
    const el = {
      tag: tag, id: undefined, type: "", value: "", checked: false,
      placeholder: "", className: "", disabled: false,
      textContent: "", children: [],
      onchange: null, oninput: null, onblur: null, onclick: null,
      _html: "", style: {},
      appendChild(child) {
        this.children.push(child);
        if (child.id) reg.set(child.id, child);
        return child;
      }
    };
    Object.defineProperty(el, "innerHTML", {
      get() { return this._html; },
      set(v) {
        this._html = v;
        if (v === "") {
          unregister(this);
          this.children = [];
        }
      }
    });
    return el;
  }

  return {
    createElement: fakeEl,
    getElementById(id) {
      if (!reg.has(id) && /^admin-/.test(id)) {
        const el = fakeEl(id);
        if (id === "admin-temp") el.value = "0.7";
        if (id === "admin-maxtok") el.value = "4096";
        if (id === "admin-len") el.value = "media";
        reg.set(id, el);
      }
      return reg.get(id);
    }
  };
}

/**
 * Backend falso que usa el Worker REAL: sanitizeConfig -> "KV" -> providerStatus.
 * Reproduce exactamente lo que ve el Admin: PUT /api/config y GET /api/config.
 */
function makeFakeBackend(initialKv) {
  let kv = initialKv ? JSON.parse(JSON.stringify(initialKv)) : {};
  const state = { putCalls: 0, lastPayload: null, lastStatus: null };
  return {
    state: state,
    getKv() { return JSON.parse(JSON.stringify(kv)); },
    setKv(next) { kv = JSON.parse(JSON.stringify(next)); },
    put(body) {
      state.putCalls++;
      state.lastPayload = JSON.parse(JSON.stringify(body));
      const res = sanitizeConfig(body);
      if (res.error) {
        state.lastStatus = 400;
        return { status: 400, body: { error: res.error, warnings: res.warnings || [] } };
      }
      kv = res.cfg;
      state.lastStatus = 200;
      return { status: 200, body: { ok: true, config: JSON.parse(JSON.stringify(kv)), warnings: res.warnings || [] } };
    },
    snapshot() {
      return {
        config: JSON.parse(JSON.stringify(kv)),
        defaults: DEFAULT_IDS,
        available: [],
        providerInfo: providerStatus(FAKE_ENV, kv),
        providerHealth: {},
        systemDefaults: {},
        maxProviders: MAX_PROVIDERS,
        aiFlags: { useCorta: kv.useCorta !== false, useLarga: kv.useLarga !== false }
      };
    }
  };
}

/**
 * Carga el chunk REAL del Admin de app.js con las dependencias inyectadas.
 * Solo se exponen funciones que existen en el producto: si una falta, el test
 * falla con ReferenceError en vez de pasar en falso.
 */
function loadAdminModule(doc, deps) {
  const src = readFileSync(APP_JS_PATH, "utf8");
  const start = src.indexOf("var _adminState=");
  const end = src.indexOf(LECTURA_POR_VOZ);
  if (start < 0 || end < 0 || end <= start) throw new Error("admin chunk not found in app.js");
  const chunk = src.slice(start, end);
  const factory = new Function(
    "document", "window", "location", "URLSearchParams", "confirm",
    "adminGetToken", "adminSetToken", "adminClearToken",
    "adminGetConfig", "adminSaveConfig", "adminFetch", "toast",
    chunk +
    "\nreturn {adminEntrar:adminEntrar,adminRefresh:adminRefresh,adminGuardar:adminGuardar," +
    "adminPoblar:adminPoblar,adminMover:adminMover,adminQuitar:adminQuitar,adminAnadir:adminAnadir," +
    "adminTestProvider:adminTestProvider,adminTestAll:adminTestAll,_adminState:_adminState};"
  );
  deps = deps || {};
  return factory(
    doc, {}, { search: "" }, class {}, deps.confirm || (() => true),
    deps.adminGetToken || (() => "tok"),
    deps.adminSetToken || (() => {}),
    deps.adminClearToken || (() => {}),
    deps.adminGetConfig || (() => Promise.reject(new Error("no config"))),
    deps.adminSaveConfig || (() => Promise.resolve({ config: {} })),
    deps.adminFetch || (() => Promise.resolve({})),
    deps.toast || (() => {})
  );
}

/** Monta Admin con backend real-en-falso y arranca EN FRÍO (como producción). */
function mountAdmin(options) {
  options = options || {};
  const doc = makeFakeDoc();
  const backend = makeFakeBackend(options.kv);
  const calls = [];
  const api = loadAdminModule(doc, {
    adminGetConfig: () => Promise.resolve(backend.snapshot()),
    adminSaveConfig: (tok, cfg) => {
      const r = backend.put(cfg);
      if (r.status !== 200) {
        const err = new Error(r.body.error);
        err.details = r.body.warnings;
        return Promise.reject(err);
      }
      return Promise.resolve(r.body);
    },
    adminFetch: (method, tok, opts) => {
      calls.push({ method: method, endpoint: opts && opts.endpoint, body: opts && opts.body });
      // Respuesta fiel a /api/provider-test del worker (incluye lastTest).
      return Promise.resolve(options.testResponse || {
        lastTest: new Date().toISOString(), ok: true, status: 200, latency: 7,
        model: opts.body.providerConfig.model, modelReal: opts.body.providerConfig.model,
        provider: opts.body.providerConfig.name
      });
    },
    confirm: () => true
  });
  return { doc, backend, calls, api };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function typeInto(doc, id, value) {
  const el = doc.getElementById(id);
  expect(el, id + " debe existir").toBeTruthy();
  el.value = value;
  if (typeof el.oninput === "function") el.oninput.call(el);
  return el;
}

/** Simula blur/change del navegador (dispara lo que exista, como el real). */
function blurElement(el) {
  if (typeof el.onchange === "function") el.onchange.call(el);
  if (typeof el.onblur === "function") el.onblur.call(el);
}

describe("Admin — arranque en frío: siembra del draft", function () {
  it("el snapshot con 4 proveedores produce un draft con 4", async function () {
    const { api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    expect(Array.isArray(api._adminState.draft)).toBe(true);
    expect(api._adminState.draft.length).toBe(4);
    expect(api._adminState.draft.map(function (p) { return p.id; })).toEqual(DEFAULT_IDS);
    expect(api._adminState.draft[0].model).toBe("llama-3.3-70b-versatile");
  });

  it("normaliza `active` del Worker a `enabled` del draft", async function () {
    const { api } = mountAdmin({
      kv: { providers: [{ id: "groq", name: "Groq", url: "https://api.groq.com/v1", model: "m", secretRef: "GROQ_API_KEY", enabled: false }] }
    });
    api.adminEntrar("tok");
    await flush();
    expect(api._adminState.draft.length).toBe(1);
    expect(api._adminState.draft[0].enabled).toBe(false);
  });

  it("el DOM renderiza exactamente tantos cards como elementos tiene el draft", async function () {
    const { doc, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    expect(doc.getElementById("admin-proveedores").children.length).toBe(5); // 4 cards + contenedor de "Añadir"
    expect(doc.getElementById("prov-model-0").value).toBe("llama-3.3-70b-versatile");
    expect(doc.getElementById("prov-model-3")).toBeTruthy();
    expect(doc.getElementById("prov-model-4")).toBeFalsy();
  });
});

describe("Admin — edición: el draft es la única fuente de verdad", function () {
  it("editar el modelo escribe en el draft", async function () {
    const { doc, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b");
    expect(api._adminState.draft[0].model).toBe("qwen/qwen3.8-27b");
  });

  it("blur NO revierte el valor editado y no toca el resto del draft", async function () {
    const { doc, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    const before = JSON.parse(JSON.stringify(api._adminState.draft));
    const el = typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b");
    blurElement(el);
    expect(doc.getElementById("prov-model-0").value).toBe("qwen/qwen3.8-27b");
    expect(api._adminState.draft.length).toBe(before.length);
    expect(api._adminState.draft[0].model).toBe("qwen/qwen3.8-27b");
    expect(api._adminState.draft[0].name).toBe(before[0].name);
    expect(api._adminState.draft[1]).toEqual(before[1]);
    expect(api._adminState.draft[3]).toEqual(before[3]);
  });

  it("blur no revierte ningún campo editable (name/url/model/secret)", async function () {
    const { doc, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    const els = [
      typeInto(doc, "prov-name-0", "GroqEditado"),
      typeInto(doc, "prov-url-0", "https://edge.groq.com/v1"),
      typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b"),
      typeInto(doc, "prov-secret-0", "GROQ_API_KEY_2")
    ];
    els.forEach(blurElement);
    expect(doc.getElementById("prov-name-0").value).toBe("GroqEditado");
    expect(doc.getElementById("prov-url-0").value).toBe("https://edge.groq.com/v1");
    expect(doc.getElementById("prov-model-0").value).toBe("qwen/qwen3.8-27b");
    expect(doc.getElementById("prov-secret-0").value).toBe("GROQ_API_KEY_2");
    expect(api._adminState.draft[0]).toMatchObject({
      name: "GroqEditado", url: "https://edge.groq.com/v1", model: "qwen/qwen3.8-27b", secretRef: "GROQ_API_KEY_2"
    });
  });

  it("REGRESIÓN: llama -> qwen -> blur (bug original)", async function () {
    const { doc, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    expect(api._adminState.draft[0].model).toBe("llama-3.3-70b-versatile");
    const el = typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b");
    blurElement(el);
    expect(doc.getElementById("prov-model-0").value).toBe("qwen/qwen3.8-27b");
    expect(api._adminState.draft[0].model).toBe("qwen/qwen3.8-27b");
    expect(api._adminState.draft[0].model).not.toBe("llama-3.3-70b-versatile");
  });

  it("el toggle de activación escribe en el draft y no re-renderiza", async function () {
    const { doc, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b");
    const chk = doc.getElementById("prov-enabled-0");
    expect(chk.checked).toBe(true);
    chk.checked = false;
    chk.onchange.call(chk);
    expect(api._adminState.draft[0].enabled).toBe(false);
    expect(doc.getElementById("prov-status-0").textContent).toBe("off");
    expect(doc.getElementById("prov-model-0").value).toBe("qwen/qwen3.8-27b");
    expect(api._adminState.draft[0].model).toBe("qwen/qwen3.8-27b");
  });
});

describe("Admin — Guardar serializa el draft", function () {
  it("payload contiene los 4 proveedores y el modelo editado", async function () {
    const { doc, backend, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b");
    api.adminGuardar();
    await flush();
    const payload = backend.state.lastPayload;
    expect(backend.state.putCalls).toBe(1);
    expect(payload.providers.length).toBe(4);
    expect(payload.providers[0].model).toBe("qwen/qwen3.8-27b");
    expect(payload.providers[1].model).toBe("gemini-3.6-flash");
    expect(payload.providers.map(function (p) { return p.id; })).toEqual(DEFAULT_IDS);
  });

  it("REGRESIÓN: Guardar -> KV -> GET no devuelve llama-3.3-70b-versatile", async function () {
    const { doc, backend, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b");
    api.adminGuardar();
    await flush();
    await flush();
    expect(backend.getKv().providers[0].model).toBe("qwen/qwen3.8-27b");
    expect(api._adminState.draft[0].model).toBe("qwen/qwen3.8-27b");
    expect(api._adminState.draft.length).toBe(4);
    expect(doc.getElementById("prov-model-0").value).toBe("qwen/qwen3.8-27b");
  });

  it("guardar sin cambios conserva los 4 proveedores y el enabled del toggle", async function () {
    const { doc, backend, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    const chk = doc.getElementById("prov-enabled-2");
    chk.checked = false;
    chk.onchange.call(chk);
    api.adminGuardar();
    await flush();
    const payload = backend.state.lastPayload;
    expect(payload.providers.length).toBe(4);
    expect(payload.providers[2].enabled).toBe(false);
    expect(payload.providers[0].enabled).toBe(true);
  });

  it("un proveedor habilitado incompleto BLOQUEA el guardado con un mensaje explícito", async function () {
    const { doc, backend, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-1", "");
    api.adminGuardar();
    await flush();
    expect(backend.state.putCalls).toBe(0);
    const msg = doc.getElementById("admin-msg").textContent;
    expect(msg).toMatch(/Proveedor 2/);
    expect(msg).toMatch(/Modelo/);
    expect(api._adminState.draft.length).toBe(4);
  });

  it("una URL inválida (http) bloquea el guardado del proveedor habilitado", async function () {
    const { doc, backend, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-url-2", "http://insecure.example.com/v1");
    api.adminGuardar();
    await flush();
    expect(backend.state.putCalls).toBe(0);
    expect(doc.getElementById("admin-msg").textContent).toMatch(/URL/);
  });

  it("un rechazo del Worker deja el draft intacto y avisa", async function () {
    const doc = makeFakeDoc();
    const api = loadAdminModule(doc, {
      adminGetConfig: () => Promise.resolve({ config: {}, providerInfo: providerStatus(FAKE_ENV, {}), providerHealth: {}, maxProviders: MAX_PROVIDERS }),
      adminSaveConfig: () => Promise.reject(new Error("providers debe ser un array"))
    });
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b");
    api.adminGuardar();
    await flush();
    expect(api._adminState.draft.length).toBe(4);
    expect(api._adminState.draft[0].model).toBe("qwen/qwen3.8-27b");
    expect(doc.getElementById("admin-msg").textContent).toMatch(/array/);
  });
});

describe("Admin — Probar serializa el draft", function () {
  it("REGRESIÓN: Probar en frío SÍ llama al Worker", async function () {
    const { calls, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    api.adminTestProvider(0);
    await flush();
    expect(calls.length).toBe(1);
    expect(calls[0].endpoint).toBe("/api/provider-test");
    expect(calls[0].body.providerConfig.id).toBe("groq");
  });

  it("providerConfig.model es el modelo editado", async function () {
    const { doc, calls, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b");
    api.adminTestProvider(0);
    await flush();
    expect(calls[0].body.providerConfig.model).toBe("qwen/qwen3.8-27b");
    expect(calls[0].body.providerConfig.url).toBe("https://api.groq.com/openai/v1/chat/completions");
  });

  it("tras Probar el valor editado sigue en el draft y en pantalla", async function () {
    const { doc, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b");
    api.adminTestProvider(0);
    await flush();
    await flush();
    expect(api._adminState.draft[0].model).toBe("qwen/qwen3.8-27b");
    expect(doc.getElementById("prov-model-0").value).toBe("qwen/qwen3.8-27b");
    expect(api._adminState.providerHealth["groq"].ok).toBe(true);
    expect(doc.getElementById("prov-status-0").textContent).toMatch(/OK/);
  });

  it("Probar otro proveedor usa los valores de ESE card", async function () {
    const { doc, calls, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-2", "openrouter/custom-model");
    api.adminTestProvider(2);
    await flush();
    expect(calls[0].body.providerConfig.id).toBe("openrouter");
    expect(calls[0].body.providerConfig.model).toBe("openrouter/custom-model");
  });

  it("Probar todos recorre el draft y no pierde proveedores", async function () {
    const { doc, calls, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b");
    api.adminTestAll();
    await flush();
    await flush();
    expect(calls.length).toBe(4);
    expect(calls.map(function (c) { return c.body.providerConfig.id; })).toEqual(DEFAULT_IDS);
    expect(calls[0].body.providerConfig.model).toBe("qwen/qwen3.8-27b");
    expect(doc.getElementById("prov-model-0").value).toBe("qwen/qwen3.8-27b");
  });
});

describe("Admin — añadir / quitar / mover sobre el draft", function () {
  it("añadir conserva los 4 existentes y añade al final", async function () {
    const { doc, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b");
    api.adminAnadir();
    expect(api._adminState.draft.length).toBe(5);
    expect(api._adminState.draft.slice(0, 4).map(function (p) { return p.id; })).toEqual(DEFAULT_IDS);
    expect(api._adminState.draft[0].model).toBe("qwen/qwen3.8-27b");
    expect(doc.getElementById("prov-name-4").value).toBe("Proveedor 5");
  });

  it("quitar elimina únicamente el seleccionado y conserva el resto", async function () {
    const { doc, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-1", "modelo-editado-1");
    api.adminQuitar(1);
    expect(api._adminState.draft.map(function (p) { return p.id; })).toEqual(["groq", "openrouter", "mistral"]);
    expect(api._adminState.draft[0].model).toBe("llama-3.3-70b-versatile");
    expect(api._adminState.draft[1].model).toBe("openrouter/free");
    expect(doc.getElementById("prov-model-2").value).toBe("ministral-14b-latest");
    expect(doc.getElementById("prov-model-3")).toBeFalsy();
  });

  it("mover conserva todos y cambia únicamente el orden", async function () {
    const { api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    api.adminMover(1, -1);
    expect(api._adminState.draft.map(function (p) { return p.id; })).toEqual(["google", "groq", "openrouter", "mistral"]);
    expect(api._adminState.draft.length).toBe(4);
    api.adminMover(3, -1);
    expect(api._adminState.draft.map(function (p) { return p.id; })).toEqual(["google", "groq", "mistral", "openrouter"]);
  });

  it("el orden nuevo se guarda tal cual", async function () {
    const { backend, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    api.adminMover(1, -1);
    api.adminGuardar();
    await flush();
    expect(backend.state.lastPayload.providers.map(function (p) { return p.id; })).toEqual(["google", "groq", "openrouter", "mistral"]);
  });
});

describe("Admin — refresh reemplaza el draft con el snapshot nuevo", function () {
  it("refresh reconstruye el draft desde el Worker y descarta ediciones locales", async function () {
    const { doc, backend, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-model-0", "qwen/qwen3.8-27b");
    backend.setKv({ providers: [{ id: "solo", name: "Solo", url: "https://solo.example.com/v1", model: "modelo-servidor", secretRef: "GROQ_API_KEY" }] });
    api.adminRefresh();
    await flush();
    expect(api._adminState.draft.length).toBe(1);
    expect(api._adminState.draft[0].id).toBe("solo");
    expect(api._adminState.draft[0].model).toBe("modelo-servidor");
    expect(doc.getElementById("prov-model-0").value).toBe("modelo-servidor");
    expect(doc.getElementById("prov-model-1")).toBeFalsy();
  });

  it("tras Guardar, el draft se re-siembra desde el Worker (no queda huérfano)", async function () {
    const { backend, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    api.adminGuardar();
    await flush();
    await flush();
    expect(api._adminState.draft.length).toBe(4);
    expect(api._adminState.draft.map(function (p) { return p.id; })).toEqual(backend.getKv().providers.map(function (p) { return p.id; }));
  });
});

describe("Admin <-> Worker — round-trip real con sanitizeConfig", function () {
  it("edición + Guardar + reinicio: el modelo editado sobrevive el ciclo completo", async function () {
    const first = mountAdmin();
    first.api.adminEntrar("tok");
    await flush();
    typeInto(first.doc, "prov-model-0", "qwen/qwen3.8-27b");
    typeInto(first.doc, "prov-url-0", "https://edge.groq.com/v1");
    first.api.adminGuardar();
    await flush();
    await flush();
    const saved = first.backend.getKv();
    expect(saved.providers.length).toBe(4);
    expect(saved.providers[0].model).toBe("qwen/qwen3.8-27b");
    expect(saved.providers[0].url).toBe("https://edge.groq.com/v1");

    // "reinicio": una sesión nueva que solo recibe el snapshot del Worker
    const second = mountAdmin({ kv: saved });
    second.api.adminEntrar("tok");
    await flush();
    expect(second.api._adminState.draft.length).toBe(4);
    expect(second.api._adminState.draft[0].model).toBe("qwen/qwen3.8-27b");
    expect(second.api._adminState.draft[0].url).toBe("https://edge.groq.com/v1");
    expect(second.doc.getElementById("prov-model-0").value).toBe("qwen/qwen3.8-27b");
  });

  it("un array ilegible nunca llega a KV como 'sin proveedores' silencioso", async function () {
    const first = mountAdmin();
    first.api.adminEntrar("tok");
    await flush();
    const res = sanitizeConfig({ providers: { groq: { model: "x" } } });
    expect(res.error).toBeTruthy();
    expect(res.cfg).toBeUndefined();
    // El backend falso solo escribe en KV si sanitizeConfig no da error.
    first.backend.put({ providers: { groq: { model: "x" } } });
    expect(first.backend.state.putCalls).toBe(1);
    expect(first.backend.state.lastStatus).toBe(400);
    expect(first.backend.getKv().providers).toBeUndefined();
  });

  it("proveedor incompleto: el Worker lo reporta en warnings, no desaparece en silencio", function () {
    const res = sanitizeConfig({
      providers: [
        { id: "bueno", url: "https://a.com/v1", model: "m", secretRef: "API_KEY" },
        { id: "vacio", url: "https://", model: "", secretRef: "" }
      ]
    });
    expect(res.cfg.providers.map(function (p) { return p.id; })).toEqual(["bueno"]);
    expect(res.warnings.length).toBe(1);
    expect(res.warnings[0]).toMatchObject({ index: 1, id: "vacio", reason: "incompleto" });
    expect(res.warnings[0].missing).toEqual(["url", "model", "secretRef"]);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  SEGURIDAD: el valor de la credencial jamás aparece en draft, payload, DOM
//  ni mensajes (solo el NOMBRE del Cloudflare Secret).
// ══════════════════════════════════════════════════════════════════════════

describe("Admin — el draft solo contiene nombres, nunca valores", function () {
  it("arranque en frío: input vacío y chip de estado por hasKey", async function () {
    const { doc, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    expect(api._adminState.draft[0].secretRef).toBe("");
    expect(doc.getElementById("prov-secret-0").value).toBe("");
    expect(doc.getElementById("prov-key-0").textContent).toBe("configurada");
  });

  it("escribir un nombre válido persiste SOLO ese nombre", async function () {
    const { doc, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-secret-0", "GROQ_API_KEY_2");
    expect(api._adminState.draft[0].secretRef).toBe("GROQ_API_KEY_2");
    expect(api._adminState.draft[0].secretRef).not.toMatch(/gsk_/);
  });

  it("un proveedor sin clave muestra «no configurada» sin más detalle", async function () {
    const kv = { providers: [{ id: "custom", name: "Custom", url: "https://custom.example.com/v1", model: "m", secretRef: "NO_EXISTE_ESTA_KEY", enabled: true }] };
    const { doc, api } = mountAdmin({ kv: kv });
    api.adminEntrar("tok");
    await flush();
    expect(doc.getElementById("prov-key-0").textContent).toBe("no configurada");
    expect(JSON.stringify(api._adminState.draft)).not.toMatch(/NO_EXISTE_ESTA_KEY/);
  });
});

describe("Admin — contaminación global gsk_TEST_SECRET_DO_NOT_USE", function () {
  it("nunca aparece en draft, payload, DOM ni mensajes", async function () {
    const kv = { providers: [{ id: "groq", name: "Groq", url: "https://api.groq.com/v1", model: "m", secretRef: "gsk_TEST_SECRET_DO_NOT_USE", enabled: true }] };
    const { doc, backend, api } = mountAdmin({ kv: kv });
    api.adminEntrar("tok");
    await flush();
    expect(JSON.stringify(api._adminState.draft)).not.toMatch(/gsk_TEST_SECRET_DO_NOT_USE/);
    expect(api._adminState.draft[0].secretRef).toBe("");
    expect(doc.getElementById("prov-secret-0").value).toBe("");
    api.adminGuardar();
    await flush();
    await flush();
    expect(JSON.stringify(backend.state.lastPayload || {})).not.toMatch(/gsk_TEST_SECRET_DO_NOT_USE/);
    expect(JSON.stringify(backend.getKv())).not.toMatch(/gsk_TEST_SECRET_DO_NOT_USE/);
    expect(doc.getElementById("prov-secret-0").value).toBe("");
    expect(JSON.stringify(api._adminState.draft)).not.toMatch(/gsk_TEST_SECRET_DO_NOT_USE/);
  });

  it("Guardar de un proveedor inválido en el campo de secret se bloquea sin eco del valor", async function () {
    const { doc, backend, api } = mountAdmin();
    api.adminEntrar("tok");
    await flush();
    typeInto(doc, "prov-secret-0", "gsk_TEST_SECRET_DO_NOT_USE");
    api.adminGuardar();
    await flush();
    expect(backend.state.putCalls).toBe(0);
    const msg = doc.getElementById("admin-msg").textContent;
    expect(msg).not.toMatch(/gsk_TEST_SECRET_DO_NOT_USE/);
    expect(msg).toMatch(/Nombre del Cloudflare Secret/);
  });
});

describe("Admin — Probar propaga el error del Worker sin eco", function () {
  it("el mensaje usa el error redactado del Worker", async function () {
    const { doc, api } = mountAdmin({
      testResponse: { lastTest: new Date().toISOString(), ok: false, status: 400, error: "Credencial no configurada para groq", category: "sin-key", model: "m", provider: "Groq" }
    });
    api.adminEntrar("tok");
    await flush();
    api.adminTestProvider(0);
    await flush();
    const msg = doc.getElementById("admin-msg").textContent;
    expect(msg).toMatch(/Credencial no configurada para groq/);
    expect(msg).not.toMatch(/gsk_/);
  });
});

describe("Admin — arranque en frío sin estado presembrado", function () {
  it("el draft nace exclusivamente del snapshot del Worker (cero estado manual)", async function () {
    const { doc, backend, api } = mountAdmin();
    expect(api._adminState.draft).toBeNull();
    api.adminEntrar("tok");
    await flush();
    expect(backend.state.putCalls).toBe(0);
    expect(api._adminState.draft.length).toBe(4);
    expect(api._adminState.draft.map(function (p) { return p.id; })).toEqual(DEFAULT_IDS);
    expect(JSON.stringify(api._adminState.draft)).not.toMatch(/gsk_/);
  });
});

// ── Worker real: /api/provider-test — veredicto del SONDEO ──
// El sondeo comprueba credencial + URL + modelo. NO mide longitud de lectura.
// Regresión de origen: max_tokens:5 + guard de 80 caracteres ⇒ empty_response
// determinista en cualquier proveedor sano.

describe("worker — /api/provider-test: veredicto del sondeo (worker real)", function () {
  const realFetch = globalThis.fetch;

  function probeEnv(extra) {
    return Object.assign(
      { ADMIN_TOKEN: "at", CONFIG: { get: async function () { return null; }, put: async function () { } } },
      FAKE_ENV,
      extra
    );
  }

  // Upstream compatible con OpenAI. `choices` se pasa tal cual para poder
  // simular respuestas vacías, truncadas o malformadas.
  function upstream(choices, status) {
    return {
      ok: (status || 200) < 400,
      status: status || 200,
      json: async function () {
        return { model: "modelo-upstream-real", choices: choices };
      }
    };
  }

  function captureCalls(response) {
    const calls = [];
    globalThis.fetch = async function (url, opts) {
      calls.push({ url: url, auth: opts.headers.Authorization, body: JSON.parse(opts.body) });
      return typeof response === "function" ? response(calls.length) : response;
    };
    return calls;
  }

  async function probe(pc, env) {
    const req = new Request("https://worker.local/api/provider-test", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": "at" },
      body: JSON.stringify({ providerConfig: pc })
    });
    const res = await worker.fetch(req, env || probeEnv());
    return { http: res.status, health: await res.json() };
  }

  const GOOGLE = {
    id: "google",
    name: "Google",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-3.6-flash",
    secretRef: "",
    extra: { thinking_level: "low" }
  };

  afterEach(function () {
    globalThis.fetch = realFetch;
  });

  it("contenido corto pero válido (\"ok\") ⇒ ok:true (regresión del empty_response)", async function () {
    captureCalls(upstream([{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }]));
    const r = await probe(GOOGLE);
    expect(r.http).toBe(200);
    expect(r.health.ok).toBe(true);
    expect(r.health.category).toBeUndefined();
    expect(r.health.status).toBe(200);
    expect(r.health.modelReal).toBe("modelo-upstream-real");
  });

  it("content vacío ⇒ empty_response con diagnóstico de ausencia de texto", async function () {
    captureCalls(upstream([{ message: { role: "assistant", content: "" }, finish_reason: "length" }]));
    const r = await probe(GOOGLE);
    expect(r.health.ok).toBe(false);
    expect(r.health.category).toBe("empty_response");
    expect(r.health.error).toMatch(/sin contenido de texto/);
  });

  it("choices: [] ⇒ empty_response y no revienta", async function () {
    captureCalls(upstream([]));
    const r = await probe(GOOGLE);
    expect(r.health.ok).toBe(false);
    expect(r.health.category).toBe("empty_response");
    expect(r.health.error).toMatch(/sin contenido de texto/);
  });

  it("message ausente ⇒ empty_response", async function () {
    captureCalls(upstream([{ finish_reason: "length" }]));
    const r = await probe(GOOGLE);
    expect(r.health.ok).toBe(false);
    expect(r.health.category).toBe("empty_response");
  });

  it("content: null ⇒ empty_response", async function () {
    captureCalls(upstream([{ message: { role: "assistant", content: null }, finish_reason: "stop" }]));
    const r = await probe(GOOGLE);
    expect(r.health.ok).toBe(false);
    expect(r.health.category).toBe("empty_response");
  });

  it("content de solo espacios ⇒ empty_response (no cuenta como contenido)", async function () {
    captureCalls(upstream([{ message: { role: "assistant", content: "   " }, finish_reason: "stop" }]));
    const r = await probe(GOOGLE);
    expect(r.health.ok).toBe(false);
    expect(r.health.category).toBe("empty_response");
  });

  it("finish_reason viaja al healthEntry (diagnóstico de truncado)", async function () {
    captureCalls(upstream([{ message: { role: "assistant", content: "ok" }, finish_reason: "length" }]));
    const r = await probe(GOOGLE);
    expect(r.health.ok).toBe(true);
    expect(r.health.finishReason).toBe("length");
  });

  it("el sondeo usa un presupuesto suficiente, manda PING y NO filtra minChars al upstream", async function () {
    const calls = captureCalls(upstream([{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }]));
    await probe(GOOGLE);
    expect(PROBE_MAX_TOKENS).toBeGreaterThan(5);
    expect(PROBE_MIN_CONTENT_CHARS).toBeLessThan(MIN_CONTENT_CHARS);
    expect(calls.length).toBe(1);
    expect(calls[0].body.max_tokens).toBe(PROBE_MAX_TOKENS);
    expect(calls[0].body.messages).toEqual([{ role: "user", content: PROBE_MESSAGE }]);
    expect(calls[0].body.model).toBe("gemini-3.6-flash");
    expect(calls[0].body.minChars).toBeUndefined();
  });

  it("la credencial se resuelve y viaja como Bearer, sin eco en la respuesta", async function () {
    const calls = captureCalls(upstream([{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }]));
    const r = await probe(GOOGLE);
    expect(calls[0].auth).toBe("Bearer " + FAKE_ENV.GOOGLE_API_KEY);
    expect(JSON.stringify(r.health)).not.toMatch(new RegExp(FAKE_ENV.GOOGLE_API_KEY));
  });

  it("Google: extra.thinking_level viaja como extra_body y no impide ok", async function () {
    const calls = captureCalls(upstream([{ message: { role: "assistant", content: "Pong." }, finish_reason: "stop" }]));
    const r = await probe(GOOGLE);
    expect(calls[0].body.extra_body.google.thinking_config.thinking_level).toBe("low");
    expect(r.health.ok).toBe(true);
  });
});

// ── Worker real: camino REAL de generación — la frontera >=80 se conserva ──

describe("worker — generación real: la frontera de 80 caracteres no se relaja", function () {
  const realFetch = globalThis.fetch;

  afterEach(function () {
    globalThis.fetch = realFetch;
  });

  function captureContent(content) {
    const calls = [];
    globalThis.fetch = async function (url, opts) {
      calls.push(JSON.parse(opts.body));
      return {
        ok: true,
        status: 200,
        json: async function () {
          return { model: "modelo-upstream-real", choices: [{ message: { content: content }, finish_reason: "stop" }] };
        }
      };
    };
    return calls;
  }

  let ipCounter = 0;

  async function chat() {
    ipCounter++;
    const req = new Request("https://worker.local/", {
      method: "POST",
      // IP distinta por prueba: el rate-limit del Worker es por IP y no debe
      // acoplar el resultado de estos tests a su propia contabilidad.
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "10.2.0." + ipCounter },
      body: JSON.stringify({ tipo: "diaria", messages: [{ role: "user", content: "una tirada" }] })
    });
    const res = await worker.fetch(req, Object.assign({
      CONFIG: { get: async function () { return null; }, put: async function () { } }
    }, FAKE_ENV));
    return { http: res.status, body: await res.json() };
  }

  it("79 caracteres ⇒ rechazado por el guard de producción", async function () {
    captureContent("x".repeat(MIN_CONTENT_CHARS - 1));
    const r = await chat();
    expect(r.http).toBe(502);
    expect(r.body.error).toMatch(/Todos los proveedores fallaron/);
    expect(r.body.error).toMatch(/empty_response/);
    expect(r.body.error).toMatch(/79 < 80/);
  });

  it("80 caracteres ⇒ aceptado", async function () {
    const calls = captureContent("x".repeat(MIN_CONTENT_CHARS));
    const r = await chat();
    expect(r.http).toBe(200);
    expect(r.body.content.length).toBe(MIN_CONTENT_CHARS);
    expect(r.body.provider).toBe("Groq");
    expect(calls[0].minChars).toBeUndefined();
  });
});

// ── H-01: Comodín — el mazo respeta la activación del usuario (app.js REAL) ──

describe("H-01 — añadirComodin (app.js): solo incorpora el Comodín si está activo", function () {
  /** Cabecera real de app.js (hasta antes de la lógica de numerología): pura y
   * auto-contenida. La carga con `new Function` igual que el resto del arnés. */
  function loadComodinChunk() {
    const src = readFileSync(APP_JS_PATH, "utf8");
    const start = src.indexOf("function añadirComodin");
    if (start < 0) throw new Error("añadirComodin not found in app.js");
    const end = src.indexOf("function normalizarNombre");
    if (end < 0 || end <= start) throw new Error("comodin chunk not found in app.js");
    const factory = new Function("window", src.slice(0, end) + "\nreturn {añadirComodin:añadirComodin,COMODIN:COMODIN};");
    return factory({});
  }

  it("desactivado ⇒ no se añade Comodín", function () {
    const mod = loadComodinChunk();
    const mazo = [{ nombre: "Arcano" }];
    const out = mod.añadirComodin(mazo, false);
    expect(out).toBe(mazo);
    expect(out.length).toBe(1);
    expect(out.some(function (c) { return c.tipo === "comodin"; })).toBe(false);
  });

  it("activado ⇒ se añade una copia del Comodín", function () {
    const mod = loadComodinChunk();
    const mazo = [{ nombre: "Arcano" }];
    const out = mod.añadirComodin(mazo, true);
    expect(out.length).toBe(2);
    expect(out.some(function (c) { return c.tipo === "comodin"; })).toBe(true);
    expect(mod.COMODIN.tipo).toBe("comodin");
  });
});
