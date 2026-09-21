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
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  MAX_PROVIDERS,
  DEFAULT_PROVIDERS,
  isValidProviderUrl,
  migrateLegacyConfig,
  buildProviders,
  sanitizeProvidersArray,
  sanitizeConfig,
  providerStatus
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
      { id: "ok", url: "https://a.com/v1", model: "m", secretRef: "K" },
      { id: "sin-modelo", url: "https://b.com/v1", secretRef: "K" },
      { id: "sin-url", model: "m", secretRef: "K" },
      { id: "url-http", url: "http://b.com/v1", model: "m", secretRef: "K" }
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

  it("trims and limits fields", function () {
    const res = sanitizeProvidersArray([
      { id: "p1", name: "a".repeat(100), url: "https://a.com/v1", model: "b".repeat(300), secretRef: "c".repeat(100) }
    ]);
    expect(res.providers[0].name.length).toBe(50);
    expect(res.providers[0].model.length).toBe(200);
    expect(res.providers[0].secretRef.length).toBe(50);
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
        { id: "bueno", url: "https://a.com/v1", model: "m", secretRef: "K" },
        { id: "vacio", url: "https://", model: "", secretRef: "" }
      ]
    });
    expect(res.cfg.providers.map(function (p) { return p.id; })).toEqual(["bueno"]);
    expect(res.warnings.length).toBe(1);
    expect(res.warnings[0]).toMatchObject({ index: 1, id: "vacio", reason: "incompleto" });
    expect(res.warnings[0].missing).toEqual(["url", "model", "secretRef"]);
  });
});
