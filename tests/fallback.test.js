/**
 * BATS Tarot — Fallback secuencial y categorización de errores (worker REAL)
 *
 * Regla de esta suite: NO se reimplementa la lógica del producto.
 * Todos los casos se ejecutan contra `worker/worker.js` con `fetch` sustituido
 * por un upstream simulado.
 *
 * Motivo del cambio: la versión anterior de este archivo mantenía una copia a
 * mano del Worker ("Mock provider logic (extracted from worker.js)") con
 * SambaNova/NVIDIA y un DEFAULT_ORDER que ya no existen en el producto, y una
 * clave de configuración (`providersOn`/`providerOrder`) distinta de la real.
 * Esa copia podía pasar en verde aunque `worker/worker.js` estuviera roto
 * (falsa cobertura). La cobertura funcional se conserva íntegra, pero ahora
 * ejecutando el código real.
 */
import { describe, it, expect, afterEach } from "vitest";
import worker, { buildProviders } from "../worker/worker.js";

const FAKE_ENV = {
  GROQ_API_KEY: "k1",
  GOOGLE_API_KEY: "k2",
  OPENROUTER_API_KEY: "k3",
  MISTRAL_API_KEY: "k4"
};

const DEFAULT_IDS = ["groq", "google", "openrouter", "mistral"];

const realFetch = globalThis.fetch;

afterEach(function () {
  globalThis.fetch = realFetch;
});

function workerEnv(extra) {
  return Object.assign(
    {
      ADMIN_TOKEN: "at",
      CONFIG: { get: async function () { return null; }, put: async function () { } }
    },
    FAKE_ENV,
    extra
  );
}

// Upstream compatible con OpenAI: `choices` se entrega tal cual para poder
// simular truncados, errores y cuerpos malformados.
function upstream(choices, status) {
  return {
    ok: (status || 200) < 400,
    status: status || 200,
    json: async function () { return { model: "modelo-upstream-real", choices: choices }; }
  };
}

function successBody(text) {
  return upstream([{ message: { role: "assistant", content: text }, finish_reason: "stop" }]);
}

/** Sustituye fetch. `handler(callNumber, body, url)` decide la respuesta. */
function mockUpstream(handler) {
  const calls = [];
  globalThis.fetch = async function (url, opts) {
    const body = JSON.parse(opts.body);
    calls.push({ url: url, auth: opts.headers.Authorization, body: body });
    return handler(calls.length, body, url);
  };
  return calls;
}

let ipCounter = 0;

/** POST / — camino REAL de generación (loop de fallback). */
async function chat(env) {
  ipCounter++;
  const req = new Request("https://worker.local/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "10.1.0." + ipCounter },
    body: JSON.stringify({ tipo: "diaria", messages: [{ role: "user", content: "una tirada" }] })
  });
  const res = await worker.fetch(req, workerEnv(env));
  return { http: res.status, body: await res.json() };
}

/** POST /api/provider-test — un único proveedor, sin loop. */
async function probe(providerConfig, env) {
  const req = new Request("https://worker.local/api/provider-test", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Token": "at" },
    body: JSON.stringify({ providerConfig: providerConfig })
  });
  const res = await worker.fetch(req, workerEnv(env));
  return { http: res.status, health: await res.json() };
}

const GROQ_PC = { id: "groq", name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", secretRef: "" };

// ── buildProviders real: orden y filtros ──

describe("buildProviders — orden y filtros (worker real)", function () {
  it("sin configuración usa el orden por defecto del producto", function () {
    const list = buildProviders(FAKE_ENV, {});
    expect(list.map(function (p) { return p.id; })).toEqual(DEFAULT_IDS);
    expect(list.map(function (p) { return p.name; })).toEqual(["Groq", "Google", "OpenRouter", "Mistral"]);
  });

  it("respeta el orden heredado (providerOrder)", function () {
    const list = buildProviders(FAKE_ENV, { providerOrder: ["mistral", "google"] });
    expect(list.map(function (p) { return p.id; })).toEqual(["mistral", "google"]);
  });

  it("excluye los proveedores desactivados (providersOn)", function () {
    const list = buildProviders(FAKE_ENV, { providersOn: { groq: false } });
    expect(list.map(function (p) { return p.id; })).not.toContain("groq");
  });

  it("excluye los proveedores sin clave en el entorno", function () {
    const list = buildProviders({ GROQ_API_KEY: "gk" }, {});
    expect(list.map(function (p) { return p.id; })).toEqual(["groq"]);
  });
});

// ── Loop de fallback real ──

describe("fallback loop (worker real)", function () {
  it("Caso A: el primer proveedor funciona", async function () {
    const calls = mockUpstream(function () { return successBody("A".repeat(100)); });
    const r = await chat();
    expect(r.http).toBe(200);
    expect(r.body.provider).toBe("Groq");
    expect(calls.length).toBe(1);
  });

  it("Caso B: 429 en el primero, responde el segundo", async function () {
    const calls = mockUpstream(function (n) {
      if (n === 1) return upstream([], 429);
      return successBody("B".repeat(100));
    });
    const r = await chat();
    expect(r.http).toBe(200);
    expect(r.body.provider).toBe("Google");
    expect(calls.length).toBe(2);
  });

  it("Caso C: 5xx en el primero, responde el segundo", async function () {
    const calls = mockUpstream(function (n) {
      if (n === 1) return upstream([], 503);
      return successBody("C".repeat(100));
    });
    const r = await chat();
    expect(r.http).toBe(200);
    expect(r.body.provider).toBe("Google");
    expect(calls.length).toBe(2);
  });

  it("Caso D: timeout del primero, responde el segundo", async function () {
    mockUpstream(function (n) {
      if (n === 1) {
        const err = new Error("Aborted");
        err.name = "AbortError";
        throw err;
      }
      return successBody("D".repeat(100));
    });
    const r = await chat();
    expect(r.http).toBe(200);
    expect(r.body.provider).toBe("Google");
  });

  it("Caso E: dos fallos y responde el tercero", async function () {
    const calls = mockUpstream(function (n) {
      if (n === 1) return upstream([], 429);
      if (n === 2) return upstream([], 500);
      return successBody("E".repeat(100));
    });
    const r = await chat();
    expect(r.http).toBe(200);
    expect(r.body.provider).toBe("OpenRouter");
    expect(calls.length).toBe(3);
  });

  it("Caso F: todos fallan ⇒ resumen con el detalle de cada proveedor", async function () {
    const calls = mockUpstream(function () { return upstream([], 500); });
    const r = await chat();
    expect(r.http).toBe(500);
    expect(r.body.error).toMatch(/Todos los proveedores fallaron \(4\)/);
    expect(r.body.error).toContain("Groq");
    expect(r.body.error).toContain("Google");
    expect(calls.length).toBe(4);
  });
});

// ── Categorización de errores del parser real ──

describe("categorización de errores (worker real)", function () {
  async function categoryOf(handler) {
    mockUpstream(handler);
    const r = await probe(GROQ_PC);
    return r.health;
  }

  it("429 ⇒ rate_limited", async function () {
    const health = await categoryOf(function () { return upstream([], 429); });
    expect(health.ok).toBe(false);
    expect(health.category).toBe("rate_limited");
    expect(health.status).toBe(429);
  });

  it("5xx ⇒ server_error", async function () {
    const health = await categoryOf(function () { return upstream([], 503); });
    expect(health.ok).toBe(false);
    expect(health.category).toBe("server_error");
    expect(health.status).toBe(503);
  });

  it("AbortError ⇒ timeout (504)", async function () {
    const health = await categoryOf(function () {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    });
    expect(health.ok).toBe(false);
    expect(health.category).toBe("timeout");
    expect(health.status).toBe(504);
  });

  it("error de red ⇒ network_error", async function () {
    const health = await categoryOf(function () { throw new TypeError("Failed to fetch"); });
    expect(health.ok).toBe(false);
    expect(health.category).toBe("network_error");
  });

  it("respuesta no JSON ⇒ parse_error", async function () {
    const health = await categoryOf(function () {
      return {
        ok: true,
        status: 200,
        json: async function () { throw new Error("Unexpected token < in JSON"); }
      };
    });
    expect(health.ok).toBe(false);
    expect(health.category).toBe("parse_error");
    expect(health.status).toBe(200);
  });
});
