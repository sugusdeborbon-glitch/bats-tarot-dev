import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const AI_SRC = readFileSync(new URL("../ai.js", import.meta.url), "utf8");

function extractFunction(defName) {
  const start = AI_SRC.indexOf("function " + defName);
  if (start < 0) throw new Error(defName + " no encontrada en ai.js");
  const open = AI_SRC.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < AI_SRC.length; i++) {
    if (AI_SRC[i] === "{") depth++;
    else if (AI_SRC[i] === "}") {
      depth--;
      if (depth === 0) return AI_SRC.slice(start, i + 1);
    }
  }
  throw new Error(defName + " llaves sin cerrar");
}

const stubs = {
  esComodin: (c) => !!(c && c.tipo === "comodin"),
  comodinResuelto: (cs) => {
    for (let i = 0; i < cs.length; i++) {
      const it = cs[i];
      if (it && it.carta && it.carta.tipo === "comodin" && it.extensionResuelta && it.extension) return it;
    }
    return null;
  },
  txt: (c, inv) => (c && c.nombre || "") + (inv ? " (inv)" : ""),
  QUINTA_BATS: { "La Fuerza": "Ref quinta" },
  calcQuinta: () => ({ nombre: "La Fuerza" })
};

function construirUserContent(cartas, ctx) {
  const body = extractFunction("construirUserContent") + "\nreturn construirUserContent(cartas,ctx);";
  const fn = new Function("txt", "QUINTA_BATS", "comodinResuelto", "esComodin", "calcQuinta", "cartas", "ctx", body);
  return fn(stubs.txt, stubs.QUINTA_BATS, stubs.comodinResuelto, stubs.esComodin, stubs.calcQuinta, cartas, ctx);
}

const COMODIN = { nombre: "Comod\u00edn", valor: 0, tipo: "comodin", nucleo: "Comod\u00edn" };

function cartasNormales() {
  const c = [
    { carta: { nombre: "El Sol", valor: 19, tipo: "arcano" }, invertida: false, posicion: "Centro: energ\u00eda del d\u00eda", texto: "R1" },
    { carta: { nombre: "La Luna", valor: 18, tipo: "arcano" }, invertida: true, posicion: "Izquierda: qu\u00e9 frenar", texto: "R2" },
    { carta: { nombre: "La Estrella", valor: 17, tipo: "arcano" }, invertida: false, posicion: "Derecha: qu\u00e9 impulsar", texto: "R3" }
  ];
  c._q = { nombre: "La Fuerza" };
  c._qtext = "Ref quinta";
  return c;
}

function buildResuelto(comodinInvertido) {
  const c = [
    { carta: { nombre: "El Sol", valor: 19, tipo: "arcano" }, invertida: false, posicion: "Centro: energ\u00eda del d\u00eda", texto: "R1" },
    {
      carta: COMODIN, invertida: comodinInvertido, comodinEstado: "abierto", comodinInvertido,
      posicion: "Centro: n\u00facleo", extensionResuelta: true,
      extension: [
        { carta: { nombre: "El Mago", valor: 1, tipo: "arcano" }, invertida: false, posicion: "\u00bfDe qu\u00e9 te quiere avisar?", texto: "ref aviso" },
        { carta: { nombre: "Tres de Copas", valor: 3, tipo: "arcano" }, invertida: comodinInvertido, posicion: "\u00bfEn qu\u00e9 te quiere ayudar?", texto: "ref ayuda" },
        { carta: { nombre: "El Mundo", valor: 21, tipo: "arcano" }, invertida: false, posicion: "La Salida", texto: "ref salida" }
      ]
    },
    { carta: { nombre: "La Estrella", valor: 17, tipo: "arcano" }, invertida: false, posicion: "Arriba: ayuda disponible", texto: "R3" }
  ];
  c._q = { nombre: "La Fuerza" };
  c._qtext = "Ref quinta";
  return c;
}

function cartasPendiente() {
  const c = [
    { carta: { nombre: "El Sol", valor: 19, tipo: "arcano" }, invertida: false, posicion: "Centro: energ\u00eda del d\u00eda", texto: "R1" },
    { carta: COMODIN, invertida: false, comodinEstado: "cerrado", comodinInvertido: false, posicion: "Centro: n\u00facleo" },
    { carta: { nombre: "La Estrella", valor: 17, tipo: "arcano" }, invertida: false, posicion: "Arriba: ayuda disponible", texto: "R3" }
  ];
  c._q = null;
  return c;
}

describe("H-02 Comod\u00edn BATS camino corto (construirUserContent)", () => {
  it("A). Sin Comod\u00edn: serializaci\u00f3n id\u00e9ntica, sin rastro del bloque de extensi\u00f3n", () => {
    const ctx = { titulo: "Cruz Diaria", descripcion: "D", guion: "diaria" };
    const out = construirUserContent(cartasNormales(), ctx);
    expect(out).toBe(
      "Tirada: Cruz Diaria\nDescripci\u00f3n: D\n" +
      "\n" +
      "Posiciones y cartas (con referencia BATS):\n" +
      "1. [0] Centro: energ\u00eda del d\u00eda: El Sol\n" +
      "   Referencia BATS: R1\n" +
      "2. [1] Izquierda: qu\u00e9 frenar: La Luna (INVERTIDA)\n" +
      "   Referencia BATS: R2\n" +
      "3. [2] Derecha: qu\u00e9 impulsar: La Estrella\n" +
      "   Referencia BATS: R3\n" +
      "\n" +
      "Quintaesencia calculada: La Fuerza\n" +
      "Referencia BATS de la quintaesencia: Ref quinta"
    );
  });

  it("E). Lectura normal: sin Comod\u00edn no menciona extensi\u00f3n ni La Salida", () => {
    const out = construirUserContent(cartasNormales(), { titulo: "Cruz Diaria" });
    expect(out).not.toMatch(/COMOD\u00cdN|La Salida|extensi\u00f3n de 3 cartas/i);
  });

  it("B). Comod\u00edn resuelto: incluye mec\u00e1nica, las 3 cartas, funci\u00f3n y sustituci\u00f3n", () => {
    const out = construirUserContent(buildResuelto(false), { titulo: "Cruz Diaria" });
    expect(out).toContain("COMOD\u00cdN resuelto con una extensi\u00f3n de 3 cartas");
    expect(out).toContain("reemplaza al Comod\u00edn en su posici\u00f3n original");
    expect(out).toContain("La quintaesencia ya fue recalculada con La Salida");
    expect(out).toContain("Al abrir umbral = revela la carta del destino \u2192 extensi\u00f3n de 3 cartas");
    expect(out).toContain("\u00bfDe qu\u00e9 te quiere avisar?");
    expect(out).toContain("\u00bfEn qu\u00e9 te quiere ayudar?");
    expect(out).toContain("La Salida");
    expect(out).toContain("El Mago");
    expect(out).toContain("Tres de Copas");
    expect(out).toContain("El Mundo");
    expect(out).toContain("(Comod\u00edn \u2192 La Salida: El Mundo)");
    expect(out).toContain("Quintaesencia calculada: La Fuerza");
  });

  it("C). La Salida conserva su equivalencia num\u00e9rica cuando corresponde", () => {
    const out = construirUserContent(buildResuelto(false), { titulo: "Cruz Diaria" });
    expect(out).toContain("* La Salida: El Mundo (valor): 21");
  });

  it("D). Comod\u00edn invertido: se conserva la sem\u00e1ntica de inversi\u00f3n", () => {
    const out = construirUserContent(buildResuelto(true), { titulo: "Cruz Diaria" });
    expect(out).toContain("(Comod\u00edn \u2192 La Salida: El Mundo): Comod\u00edn (INVERTIDA)");
    expect(out).toContain("boca abajo (invertido)");
    expect(out).toContain("* \u00bfEn qu\u00e9 te quiere ayudar?: Tres de Copas (INVERTIDA)");
  });

  it("Comod\u00edn pendiente (no resuelto): serializaci\u00f3n sin bloque de extensi\u00f3n", () => {
    const out = construirUserContent(cartasPendiente(), { titulo: "Cruz Diaria" });
    expect(out).not.toMatch(/resuelto con una extensi\u00f3n/i);
    expect(out).toMatch(/Comod\u00edn/);
  });
});