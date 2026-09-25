/**
 * H-03 — Uso explícito de la pregunta y el contexto en el prompt corto.
 *
 * Regla de esta suite: NO se reimplementa el prompt ni se duplica a mano.
 * Se ejecuta el camino REAL del Worker (`worker.fetch` con `fetch` sustituido,
 * igual que fallback.test.js) y se inspecciona el mensaje de sistema que
 * realmente viaja al upstream.
 */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import worker, {
  buildProviders,
  sanitizeProvidersArray,
  resolveSecretRef,
  redactConfig
} from "../worker/worker.js";

const FAKE_ENV = {
  GROQ_API_KEY: "g",
  GOOGLE_API_KEY: "o",
  OPENROUTER_API_KEY: "or",
  MISTRAL_API_KEY: "m"
};

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

function upstreamOk(content) {
  return {
    ok: true,
    status: 200,
    json: async function () {
      return { model: "modelo-upstream", choices: [{ message: { role: "assistant", content: content }, finish_reason: "stop" }] };
    }
  };
}

let ipCounter = 0;

/** Ejecuta el camino REAL de generación y devuelve el prompt de sistema enviado al upstream. */
async function captureSystemPrompt(tipo, user) {
  ipCounter++;
  const calls = [];
  globalThis.fetch = async function (url, opts) {
    const body = JSON.parse(opts.body);
    calls.push({ url: url, body: body });
    return upstreamOk("Respuesta de prueba suficientemente larga para superar la frontera de caracteres mínimos del camino de generación.");
  };
  const req = new Request("https://worker.local/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "10.3.0." + ipCounter },
    body: JSON.stringify({ tipo: tipo, messages: [], user: user })
  });
  const res = await worker.fetch(req, workerEnv());
  const body = await res.json();
  const sysMsg = calls[0] && calls[0].body.messages && calls[0].body.messages.find(function (m) { return m && m.role === "system"; });
  const usrMsg = calls[0] && calls[0].body.messages && calls[0].body.messages.find(function (m) { return m && m.role === "user"; });
  return { http: res.status, body: body, system: sysMsg ? sysMsg.content : null, user: usrMsg ? usrMsg.content : null };
}

const USUARIO_NORMAL =
  "Tirada: Cruz Diaria\n" +
  "Descripción: D\n" +
  "\n" +
  "Posiciones y cartas (con referencia BATS):\n" +
  "1. [0] Centro: energía del día: El Sol\n" +
  "   Referencia BATS: R1\n" +
  "2. [1] Izquierda: qué frenar: La Luna (INVERTIDA)\n" +
  "   Referencia BATS: R2\n" +
  "\n" +
  "Quintaesencia calculada: La Fuerza\n" +
  "Referencia BATS de la quintaesencia: Ref quinta";

describe("H-03 — prompt corto usa la pregunta y el contexto (worker real)", function () {

  it("A). El prompt corto instruye explícitamente a usar la pregunta", async function () {
    const capture = await captureSystemPrompt("diaria", USUARIO_NORMAL);
    expect(capture.http).toBe(200);
    expect(capture.system).toBeTypeOf("string");
    expect(capture.system).toContain("la pregunta del consultante");
    expect(capture.system).toContain("la pregunta, el contexto proporcionado, la función de la posición");
  });

  it("B). El prompt corto instruye explícitamente a usar el contexto del usuario", async function () {
    const capture = await captureSystemPrompt("pers", USUARIO_NORMAL);
    expect(capture.system).toBeTypeOf("string");
    expect(capture.system).toContain("su contexto y notas");
    expect(capture.system).toContain("contexto proporcionado");
  });

  it("C). El prompt corto mantiene la relevancia de posición/función", async function () {
    const capture = await captureSystemPrompt("diaria", USUARIO_NORMAL);
    expect(capture.system).toContain("fíltrala por el sentido de la posición");
    expect(capture.system).toContain("- Centro: la energía del día (el núcleo de la jornada).");
    expect(capture.system).toContain("no se interpreta de forma aislada");
  });

  it("D). Una lectura normal sigue generando la misma estructura de datos", async function () {
    const capture = await captureSystemPrompt("diaria", USUARIO_NORMAL);
    expect(capture.http).toBe(200);
    // El contenido del usuario viaja VERBATIM al upstream (estructura intacta).
    expect(capture.user).toBe(USUARIO_NORMAL);
    // Y el Worker responde con la estructura de datos esperada.
    expect(capture.body).toBeTypeOf("object");
    expect(capture.body.content).toBeTypeOf("string");
  });

  it("E). El prompt largo NO cambia", async function () {
    const capture = await captureSystemPrompt("larga", USUARIO_NORMAL);
    expect(capture.system).toBeTypeOf("string");
    expect(capture.system).toContain("El significado nace de la pregunta y de la posición");
    expect(capture.system).not.toContain("la pregunta del consultante");
    expect(capture.system).not.toContain("la carta no se interpreta de forma aislada.");
  });

  it("F). El Comodín/H-02 NO cambia", function () {
    const aiSrc = readFileSync(new URL("../ai.js", import.meta.url), "utf8");
    // En el fuente de ai.js los acentos van como escapes literales (\u00cd...).
    expect(aiSrc).toContain("COMOD\\u00cdN resuelto con una extensi\\u00f3n de 3 cartas");
    expect(aiSrc).toContain("La Salida reemplaza al Comod\\u00edn en su posici\\u00f3n original");
  });

  it("G). Provider Manager NO cambia", async function () {
    // Comportamientos exportados del Worker real intactos.
    expect(buildProviders).toBeTypeOf("function");
    expect(sanitizeProvidersArray).toBeTypeOf("function");
    expect(resolveSecretRef).toBeTypeOf("function");
    expect(redactConfig).toBeTypeOf("function");
    // Y el camino de generación sigue funcionando con ellos.
    const capture = await captureSystemPrompt("diaria", USUARIO_NORMAL);
    expect(capture.http).toBe(200);
  });
});