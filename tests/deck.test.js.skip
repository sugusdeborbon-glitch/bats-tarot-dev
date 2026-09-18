/**
 * BATS Tarot — Unit tests for pure utility functions
 * Phase 0: Tests functions from js/deck-utils.js (no DOM dependency)
 */
import { describe, it, expect } from "vitest";
import {
  z, ini, escHTML, slugify, esComodin, barajar,
  normalizarNombre, sumaDigitos, sumaNombre,
  calcArcanoNum, calcQuinta
} from "../js/deck-utils.js";

// ── z() ──────────────────────────────────────────────
describe("z() — zero-pad", () => {
  it("pads single digit", () => { expect(z(0)).toBe("00"); });
  it("pads single digit 5", () => { expect(z(5)).toBe("05"); });
  it("no pads double digit", () => { expect(z(10)).toBe("10"); });
  it("no pads triple digit", () => { expect(z(100)).toBe("100"); });
});

// ── ini() ────────────────────────────────────────────
describe("ini() — card abbreviation", () => {
  it("strips article 'El'", () => { expect(ini("El Mago")).toBe("MA"); });
  it("strips article 'La'", () => { expect(ini("La Sacerdotisa")).toBe("SA"); });
  it("strips article 'Los'", () => { expect(ini("Los Enamorados")).toBe("EN"); });
  it("handles 'As de ...'", () => { expect(ini("As de Bastos")).toBe("BA"); });
  it("handles 'Sota de ...'", () => { expect(ini("Sota de Copas")).toBe("CO"); });
  it("returns first 2 letters if no article", () => { expect(ini("Torre")).toBe("TO"); });
  it("returns first 2 letters uppercase", () => { expect(ini("luna")).toBe("LU"); });
});

// ── escHTML() ────────────────────────────────────────
describe("escHTML() — XSS escaping", () => {
  it("escapes ampersand", () => { expect(escHTML("a&b")).toBe("a&amp;b"); });
  it("escapes less than", () => { expect(escHTML("a<b")).toBe("a&lt;b"); });
  it("escapes greater than", () => { expect(escHTML("a>b")).toBe("a&gt;b"); });
  it("escapes double quote", () => { expect(escHTML('a"b')).toBe("a&quot;b"); });
  it("escapes single quote", () => { expect(escHTML("a'b")).toBe("a&#39;b"); });
  it("handles null", () => { expect(escHTML(null)).toBe(""); });
  it("handles undefined", () => { expect(escHTML(undefined)).toBe(""); });
  it("handles numbers", () => { expect(escHTML(42)).toBe("42"); });
  it("leaves clean string untouched", () => { expect(escHTML("hello")).toBe("hello"); });
});

// ── slugify() ────────────────────────────────────────
describe("slugify() — filename safe string", () => {
  it("lowercases and replaces spaces", () => { expect(slugify("Cruz Diaria")).toBe("cruz_diaria"); });
  it("removes special characters", () => { expect(slugify("¡Hola!")).toBe("hola"); });
  it("collapses underscores", () => { expect(slugify("a  b   c")).toBe("a_b_c"); });
  it("returns 'tirada' for empty string", () => { expect(slugify("")).toBe("tirada"); });
  it("handles accented characters", () => { expect(slugify("Relación")).toBe("relación"); });
  it("replaces hyphens", () => { expect(slugify("mi-tirada")).toBe("mi_tirada"); });
});

// ── esComodin() ──────────────────────────────────────
describe("esComodin() — wildcard detection", () => {
  it("returns true for comodin", () => { expect(esComodin({ tipo: "comodin" })).toBe(true); });
  it("returns false for non-comodin", () => { expect(esComodin({ tipo: "arcano" })).toBe(false); });
  it("returns false for null", () => { expect(esComodin(null)).toBeFalsy(); });
  it("returns false for undefined", () => { expect(esComodin(undefined)).toBeFalsy(); });
});

// ── barajar() ────────────────────────────────────────
describe("barajar() — Fisher-Yates shuffle", () => {
  it("returns same length", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(barajar(arr).length).toBe(5);
  });
  it("does not mutate original", () => {
    const arr = [1, 2, 3, 4, 5];
    barajar(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });
  it("contains same elements", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(barajar(arr).sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("handles empty array", () => { expect(barajar([])).toEqual([]); });
  it("handles single element", () => { expect(barajar([42])).toEqual([42]); });
});

// ── normalizarNombre() ───────────────────────────────
describe("normalizarNombre() — accent stripping", () => {
  it("uppercase and strips accents", () => { expect(normalizarNombre("María José")).toBe("MARIA JOSE"); });
  it("removes non-alpha (hyphens, digits)", () => { expect(normalizarNombre("Ana-Lucía 123")).toBe("ANALUCIA "); });
  it("handles plain text", () => { expect(normalizarNombre("ana")).toBe("ANA"); });
});

// ── sumaDigitos() ────────────────────────────────────
describe("sumaDigitos() — digit sum", () => {
  it("sums digits", () => { expect(sumaDigitos("123")).toBe(6); });
  it("single digit", () => { expect(sumaDigitos("5")).toBe(5); });
  it("zero", () => { expect(sumaDigitos("0")).toBe(0); });
  it("large number", () => { expect(sumaDigitos("999")).toBe(27); });
});

// ── sumaNombre() ─────────────────────────────────────
describe("sumaNombre() — numerology sum", () => {
  it("calculates known value", () => {
    // MARIA = M(4)+A(1)+R(9)+I(9)+A(1) = 24
    expect(sumaNombre("Maria")).toBe(24);
  });
  it("handles accented names", () => {
    // ANA = A(1)+N(5)+A(1) = 7
    expect(sumaNombre("Ana")).toBe(7);
  });
});

// ── calcArcanoNum() ──────────────────────────────────
describe("calcArcanoNum() — arcano calculation", () => {
  it("returns a number between 1 and 78", () => {
    const result = calcArcanoNum("15/06/1990", "10/09/2026", "Maria");
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(78);
  });
  it("returns same value for same inputs", () => {
    const a = calcArcanoNum("01/01/2000", "01/01/2025", "Test");
    const b = calcArcanoNum("01/01/2000", "01/01/2025", "Test");
    expect(a).toBe(b);
  });
  it("returns 1 for invalid date", () => {
    expect(calcArcanoNum("invalid", "date", "name")).toBe(1);
  });
});

// ── calcQuinta() ─────────────────────────────────────
describe("calcQuinta() — quintessence calculation", () => {
  it("calculates from card values", () => {
    const cartas = [
      { carta: { valor: 5 } },
      { carta: { valor: 10 } },
      { carta: { valor: 3 } }
    ];
    // sum=18, digit sum=9
    expect(calcQuinta(cartas)).toBe(9);
  });
  it("reduces to 1-22 range", () => {
    const cartas = [
      { carta: { valor: 21 } },
      { carta: { valor: 20 } },
      { carta: { valor: 19 } }
    ];
    // sum=60, digit sum=6
    expect(calcQuinta(cartas)).toBe(6);
  });
  it("returns null for empty array", () => {
    expect(calcQuinta([])).toBeNull();
  });
  it("returns null for null input", () => {
    expect(calcQuinta(null)).toBeNull();
  });
  it("handles cards without carta wrapper", () => {
    const cartas = [{ valor: 5 }, { valor: 10 }];
    // sum=15, digit sum=6
    expect(calcQuinta(cartas)).toBe(6);
  });
});
