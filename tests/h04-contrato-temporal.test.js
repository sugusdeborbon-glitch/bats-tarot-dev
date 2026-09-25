/**
 * H-04 — Contrato temporal end-to-end (worker real + frontend real).
 *
 * Regla de esta suite: NO se reimplementa la lógica del producto. Los casos del
 * worker se ejecutan contra `worker/worker.js` con `fetch` sustituido por un
 * upstream simulado y relojes de prueba (fake timers) para avanzar segundos sin
 * dormir: nunca se esperan 40-90 s reales.
 *
 * Los casos de frontend extraen las funciones reales de `ai.js` y `app.js`
 * (slicing por marcadores, sin copias) y las ejecutan con stubs de DOM/fetch
 * para verificar el contrato: timeout duro con AbortController, timeout blando
 * sin él, failsafe sin error terminal a los 30 s y filtro de respuestas tardías
 * de tiradas obsoletas (reqId).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import worker, { llamarProveedor, BUDGET } from "../worker/worker.js";

const FAKE_ENV = {
  GROQ_API_KEY: "k1",
  GOOGLE_API_KEY: "k2",
  OPENROUTER_API_KEY: "k3",
  MISTRAL_API_KEY: "k4"
};

const realFetch = globalThis.fetch;

afterEach(function () {
  globalThis.fetch = realFetch;
  vi.useRealTimers();
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

function upstream(choices, status) {
  return {
    ok: (status || 200) < 400,
    status: status || 200,
    json: async function () { return { model: "modelo-upstream-real", choices: choices }; }
  };
}

function upstreamOk(text) {
  return upstream([{ message: { role: "assistant", content: text }, finish_reason: "stop" }], 200);
}

const HANG = Symbol("hang");

/**
 * Sustituye fetch. El handler recibe (callNumber, body, opts). Si devuelve HANG,
 * la petición queda pendiente hasta que el AbortController del worker la corte
 * (AbortError), que es justo lo que disparan los fake timers.
 */
function mockUpstream2(handler) {
  const calls = [];
  globalThis.fetch = async function (url, opts) {
    const body = JSON.parse(opts.body);
    calls.push({ url: String(url), opts: opts, body: body });
    const out = handler(calls.length, body, opts);
    if (out === HANG) {
      return new Promise(function (resolve, reject) {
        opts.signal.addEventListener("abort", function () {
          const e = new Error("Aborted");
          e.name = "AbortError";
          reject(e);
        });
      });
    }
    return out;
  };
  return calls;
}

let ipCounter = 0;

/** POST / — camino REAL de generación (loop de fallback con presupuesto). */
async function postIA(tipo, body, env) {
  ipCounter++;
  const req = new Request("https://worker.local/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "10.4.0." + ipCounter },
    body: JSON.stringify(Object.assign({ tipo: tipo, messages: [{ role: "user", content: "una tirada" }] }, body || {}))
  });
  const res = await worker.fetch(req, workerEnv(env));
  return { http: res.status, body: await res.json() };
}

// ── Worker: contrato temporal ──

describe("H-04 worker — presupuesto, slices y deadline (worker real)", function () {

  it("A) P1 agota su slice (24 s) y el segundo proveedor entra dentro del presupuesto", async function () {
    vi.useFakeTimers();
    const calls = mockUpstream2(function (n) {
      if (n === 1) return HANG;
      return upstreamOk("A".repeat(100));
    });
    const p = postIA("diaria", {});
    await vi.advanceTimersByTimeAsync(BUDGET.corta.p1 - 4000);
    // Aún no se abandona a P1: el primer slice es p1, no pk.
    expect(calls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(4000);
    const r = await p;
    expect(r.http).toBe(200);
    expect(r.body.provider).toBe("Google");
    expect(calls.length).toBe(2);
  });

  it("B) presupuesto corta agotado ⇒ el 4º proveedor NO se inicia (deadline)", async function () {
    vi.useFakeTimers();
    const calls = mockUpstream2(function () { return HANG; });
    const p = postIA("diaria", {});
    await vi.advanceTimersByTimeAsync(BUDGET.corta.p1);
    await vi.advanceTimersByTimeAsync(BUDGET.corta.pk);
    await vi.advanceTimersByTimeAsync(BUDGET.corta.pk);
    const r = await p;
    expect(calls.length).toBe(3);
    expect(r.http).toBe(504);
    expect(r.body.error).toContain("(" + Math.round(BUDGET.corta.p1 / 1000) + "s)");
    expect(r.body.error).toContain("(" + Math.round(BUDGET.corta.pk / 1000) + "s)");
    expect(r.body.error).toMatch(/deadline/);
    expect(r.body.error).toContain("Mistral: no iniciado");
    expect(r.body.error).toContain("presupuesto de tiempo agotado");
  });

  it("C) fallos rápidos liberan presupuesto: los 4 proveedores se intentan", async function () {
    const calls = mockUpstream2(function (n) {
      if (n === 1) return upstream([], 429);
      if (n === 4) return upstreamOk("C".repeat(100));
      return upstream([], 500);
    });
    const r = await postIA("diaria", {});
    expect(r.http).toBe(200);
    expect(r.body.provider).toBe("Mistral");
    expect(calls.length).toBe(4);
    expect(r.body.error).toBeUndefined();
  });

  it("D1) llamarProveedor respeta timeoutMs exacto y mensaje dinámico", async function () {
    vi.useFakeTimers();
    const calls = mockUpstream2(function () { return HANG; });
    const p = llamarProveedor(
      { id: "x", name: "X", url: "https://x.example/v1", model: "m", key: "k", extra: {} },
      [{ role: "user", content: "hola" }],
      { temperature: 0.7, max_tokens: 100, minChars: 80, timeoutMs: 5000 }
    );
    await vi.advanceTimersByTimeAsync(5000);
    const res = await p;
    expect(calls.length).toBe(1);
    expect(res).toMatchObject({ ok: false, status: 504, category: "timeout" });
    expect(res.err).toContain("5s");
  });

  it("D2) sin timeoutMs usa el límite de defensa (40 s) con mensaje dinámico", async function () {
    vi.useFakeTimers();
    const calls = mockUpstream2(function () { return HANG; });
    const p = llamarProveedor(
      { id: "x", name: "X", url: "https://x.example/v1", model: "m", key: "k", extra: {} },
      [{ role: "user", content: "hola" }],
      { temperature: 0.7, max_tokens: 100, minChars: 80 }
    );
    await vi.advanceTimersByTimeAsync(40000);
    const res = await p;
    expect(calls.length).toBe(1);
    expect(res).toMatchObject({ ok: false, status: 504, category: "timeout" });
    expect(res.err).toContain("40s");
  });

  it("E) el proveedor propio respeta el deadline (40 s) y categoriza timeout", async function () {
    vi.useFakeTimers();
    mockUpstream2(function () { return HANG; });
    ipCounter++;
    const req = new Request("https://worker.local/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "10.4.0." + ipCounter,
        "Authorization": "Bearer clave-propia"
      },
      body: JSON.stringify({
        mode: "propia",
        tipo: "corta",
        base: "https://miapi.example/v1",
        model: "gpt-test",
        messages: [{ role: "user", content: "hola" }]
      })
    });
    const p = worker.fetch(req, workerEnv());
    await vi.advanceTimersByTimeAsync(40000);
    const res = await p;
    const body = await res.json();
    expect(res.status).toBe(504);
    expect(body.error).toBe("El proveedor propio tard\u00f3 demasiado");
  });

  it("F) larga: 5 proveedores caben en 75 s con slices 35 s/10 s", async function () {
    vi.useFakeTimers();
    const cfg = {
      providers: [
        { id: "groq", name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama", secretRef: "GROQ_API_KEY", enabled: true },
        { id: "google", name: "Google", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini", secretRef: "GOOGLE_API_KEY", enabled: true },
        { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", model: "free", secretRef: "OPENROUTER_API_KEY", enabled: true },
        { id: "mistral", name: "Mistral", url: "https://api.mistral.ai/v1/chat/completions", model: "ministral", secretRef: "MISTRAL_API_KEY", enabled: true },
        { id: "nova", name: "Nova", url: "https://nova.example/v1", model: "nova-m", secretRef: "NOVA_API_KEY", enabled: true }
      ]
    };
    const calls = mockUpstream2(function () { return HANG; });
    const p = postIA("larga", {}, {
      NOVA_API_KEY: "nk",
      CONFIG: { get: async function () { return JSON.stringify(cfg); }, put: async function () { } }
    });
    await vi.advanceTimersByTimeAsync(BUDGET.larga.p1);
    for (let i = 0; i < 4; i++) await vi.advanceTimersByTimeAsync(BUDGET.larga.pk);
    const r = await p;
    expect(calls.length).toBe(5);
    expect(r.http).toBe(504);
    expect(r.body.error).toContain("Todos los proveedores fallaron (5)");
    expect(r.body.error).toContain("(" + Math.round(BUDGET.larga.p1 / 1000) + "s)");
    expect(r.body.error).toContain("(" + Math.round(BUDGET.larga.pk / 1000) + "s)");
    expect(r.body.error).not.toMatch(/no iniciado/);
  });
});

// ── Frontend: extracción de las funciones REALES de ai.js ──

function leerProd(rel) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const CHUNK_AI_SRC = (function () {
  const src = leerProd("../ai.js");
  const ini = src.indexOf("function fetchConTimeout");
  const fin = src.indexOf("function esEntornoDev");
  return src.slice(ini, fin);
})();

const makeIA = new Function(
  "window", "fetch",
  CHUNK_AI_SRC + "; return { fetchConTimeout: fetchConTimeout, parseAIRespuesta: parseAIRespuesta, leerUltimaIA: function(){ return _ultimaIA; } };"
);

describe("H-04 ai.js — fetchConTimeout: duro con AbortController, blando sin él", function () {

  it("G1) con AbortController: aborta en el límite y rechaza con el mensaje pactado", async function () {
    vi.useFakeTimers();
    const statuses = [];
    const win = { _iaStatus: function (s) { statuses.push(s); }, AbortController: globalThis.AbortController };
    const fetchStub = function (url, opts) {
      return new Promise(function (resolve, reject) {
        opts.signal.addEventListener("abort", function () {
          const e = new Error("Aborted");
          e.name = "AbortError";
          reject(e);
        });
      });
    };
    const api = makeIA(win, fetchStub);
    const p = api.fetchConTimeout("https://worker.example/", { tipo: "diaria" }, { token: "t" });
    // Se suscribe la aserción ANTES de disparar el abort para evitar un
    // rechazo sin manejador durante el avance del reloj.
    const assertion = expect(p).rejects.toThrow("La IA tard\u00f3 demasiado. Reintenta.");
    await vi.advanceTimersByTimeAsync(60000);
    await assertion;
    expect(statuses).toContain("error");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("G2) sin AbortController: timeout blando, la respuesta tardía se acepta y el timer se limpia", async function () {
    vi.useFakeTimers();
    let resolveFetch;
    const win = { _iaStatus: function () { } };
    const fetchStub = function () {
      return new Promise(function (resolve) { resolveFetch = resolve; });
    };
    const api = makeIA(win, fetchStub);
    const p = api.fetchConTimeout("https://worker.example/", { tipo: "diaria" }, { timeoutMs: 2000 });
    await vi.advanceTimersByTimeAsync(3000);
    resolveFetch({ ok: true, status: 200, text: async function () { return JSON.stringify({ content: "Respuesta tardía" }); } });
    await expect(p).resolves.toBe("Respuesta tardía");
    expect(api.leerUltimaIA().provider).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });
});

// ── Frontend: extracción de las funciones REALES de app.js ──

const CHUNK_APP_SRC = (function () {
  const src = leerProd("../app.js");
  const ini = src.indexOf("var _iaReq=0;");
  const fin = src.indexOf("function valPanel(id){");
  return src.slice(ini, fin);
})();

const makeApp = new Function(
  "window", "document", "generarInterpretacionLarga", "etiquetaIA", "vozSoporte",
  "vozBarHTML", "vozTextoDe", "vozPoblarSelect", "vozActualizarBarras", "BATS_VERSION",
  CHUNK_APP_SRC + "; return { renderInterpLarga: renderInterpLarga, interpParaHTML: interpParaHTML, escHTML: escHTML };"
);

class FakeEl {
  constructor() {
    this.tagName = "div";
    this.style = {};
    this.className = "";
    this.id = "";
    this.parentNode = null;
    this.nextSibling = null;
    this.textContent = "";
    this._html = "";
    this.writes = [];
    this._children = {};
  }
  querySelector(sel) {
    if (!this._children[sel]) this._children[sel] = new FakeEl();
    return this._children[sel];
  }
  querySelectorAll() { return []; }
  insertAdjacentHTML(pos, html) { this.writes.push(html); }
  insertBefore(child, ref) {}
  set innerHTML(v) { this._html = v; this.writes.push(v); }
  get innerHTML() { return this._html; }
}

function makeDoc() {
  const reg = new Map();
  const doc = {
    getElementById: function (id) {
      if (!reg.has(id)) reg.set(id, new FakeEl());
      return reg.get(id);
    },
    createElement: function (tag) { return new FakeEl(tag); }
  };
  return { doc: doc, reg: reg };
}

function deferred() {
  let res, rej;
  const promise = new Promise(function (resolve, reject) { res = resolve; rej = reject; });
  return { promise: promise, resolve: res, reject: rej };
}

const NOOP = function () { return function () { }; };

function makeAppHarness(overrides) {
  overrides = overrides || {};
  const win = { _ult: null };
  const docK = overrides.doc ? overrides.doc : makeDoc();
  const pending = [];
  const gen = overrides.gen || function () {
    const d = deferred();
    pending.push(d);
    return d.promise;
  };
  const app = makeApp(
    win,
    docK.doc,
    gen,
    overrides.etiquetaIA || function () { return ""; },
    function () { return false; },
    {},
    NOOP(),
    NOOP(),
    NOOP(),
    NOOP(),
    "1.0.0-test"
  );
  return { app: app, win: win, pending: pending, reg: docK.reg, doc: docK.doc };
}

describe("H-04 app.js — failsafe sin error terminal y filtro de respuestas tardías", function () {

  it("H1) no hay error terminal a los 30 s: el éxito posterior sigue contando", async function () {
    vi.useFakeTimers();
    const hd = makeAppHarness({});
    const { reg, app, pending } = hd;
    const cartas = {};
    app.renderInterpLarga("tirada", cartas, {});
    // Avanza más allá del antiguo failsafe de 30 s (pero antes del nuevo 75 s).
    await vi.advanceTimersByTimeAsync(45000);
    const cont = reg.get("ai-interp-tirada");
    const body = cont._children[".ai-interp-body"];
    expect(body.innerHTML).not.toContain("No se pudo generar la interpretaci\u00f3n");
    pending[0].resolve("texto-ok");
    await vi.advanceTimersByTimeAsync(0);
    expect(cartas._interp).toBe("texto-ok");
    expect(body.innerHTML).toContain("ai-interp-texto");
  });

  it("H2) a los 75 s aparece progreso suave y luego la promesa real decide el error", async function () {
    vi.useFakeTimers();
    const hd = makeAppHarness({});
    const { reg, app, pending } = hd;
    app.renderInterpLarga("tirada", {}, {});
    await vi.advanceTimersByTimeAsync(75000);
    const cont = reg.get("ai-interp-tirada");
    const body = cont._children[".ai-interp-body"];
    const sEl = body._children[".ai-interp-status"];
    expect(sEl.textContent).toContain("La IA sigue procesando (l\u00edmite 90 s)");
    pending[0].reject(new Error("upstream ca\u00eddo"));
    await vi.advanceTimersByTimeAsync(0);
    expect(body.innerHTML).toContain("No se pudo generar la interpretaci\u00f3n: upstream ca\u00eddo");
  });

  it("H3) una respuesta tardía de una tirada obsoleta no pisa la actual (reqId)", async function () {
    vi.useFakeTimers();
    const hd = makeAppHarness({});
    const { reg, app, pending } = hd;
    const win = hd.win;
    const cartas = {};
    app.renderInterpLarga("tirada", cartas, {});
    // Estatus de la tirada que va a quedar obsoleta (reqId 1).
    const staleStatus = win._iaStatus;
    app.renderInterpLarga("tirada", cartas, {});
    const cont = reg.get("ai-interp-tirada");
    const body = cont._children[".ai-interp-body"];
    // Éxito de la tirada actual.
    pending[1].resolve("segunda-lectura");
    await vi.advanceTimersByTimeAsync(0);
    expect(cartas._interp).toBe("segunda-lectura");
    // La tirada obsoleta falla DESPUÉS: su guarda reqId debe bloquearla.
    pending[0].reject(new Error("viejo"));
    await vi.advanceTimersByTimeAsync(0);
    expect(body.innerHTML).toContain("segunda-lectura");
    expect(body.innerHTML).not.toContain("No se pudo generar la interpretaci\u00f3n");
    staleStatus("statobsoleto");
    expect(body._children[".ai-interp-status"].textContent).not.toContain("statobsoleto");
  });
});