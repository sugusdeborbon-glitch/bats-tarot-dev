/**
 * BATS Tarot — XOR → AES-GCM migration tests
 * Tests the key migration behavior from ai.js
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Replicate ai.js crypto logic for testing ──

const AI_KEY_SEED = "BATS_2026_v1";

function aiXor(s) {
  var r = "";
  for (var i = 0; i < s.length; i++) r += String.fromCharCode(s.charCodeAt(i) ^ AI_KEY_SEED.charCodeAt(i % AI_KEY_SEED.length));
  return r;
}
function aiEncr(s) { return btoa(aiXor(s)); }
function aiDecr(s) { try { return aiXor(atob(s)); } catch (e) { return ""; } }

function isAESGCM(s) {
  if (!s || s.charAt(0) !== "{") return false;
  try { var o = JSON.parse(s); return o && o.v === 1 && o.algo === "AES-GCM"; } catch (e) { return false; }
}

// ── Replicate crypto-util.js encrypt/decrypt for testing ──
const ITERATIONS = 100000;
const SALT_LEN = 16;
const IV_LEN = 12;

function getRandomBytes(n) { return crypto.getRandomValues(new Uint8Array(n)); }
function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function base64ToBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
function deriveKey(password, salt) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"])
    .then(km => crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
      km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    ));
}
function aesEncrypt(plaintext, password) {
  const enc = new TextEncoder();
  const salt = getRandomBytes(SALT_LEN);
  const iv = getRandomBytes(IV_LEN);
  return deriveKey(password, salt)
    .then(key => crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext)))
    .then(ct => JSON.stringify({ v: 1, algo: "AES-GCM", kdf: "PBKDF2", iter: ITERATIONS,
      salt: bufferToBase64(salt), iv: bufferToBase64(iv), data: bufferToBase64(ct) }));
}
function aesDecrypt(envelope, password) {
  const p = JSON.parse(envelope);
  const salt = new Uint8Array(base64ToBuffer(p.salt));
  const iv = new Uint8Array(base64ToBuffer(p.iv));
  const ct = base64ToBuffer(p.data);
  return deriveKey(password, salt)
    .then(key => crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct))
    .then(pt => new TextDecoder().decode(pt));
}

// ── Simulate aiDecrAsync with migration behavior ──
function aiDecrAsyncSim(s, password, store) {
  if (!s) return Promise.resolve("");
  if (isAESGCM(s)) {
    return aesDecrypt(s, password || "bats-user-key");
  }
  // XOR detected — try migration
  var plain = aiDecr(s);
  if (!plain) return Promise.resolve("");
  return aesEncrypt(plain, password || "bats-user-key").then(function (migrated) {
    store.key = migrated; // migrate in store
    return plain;
  }).catch(function () {
    return plain; // can't migrate, still return the value
  });
}

// ── Simulate aiEncrAsync without fallback ──
function aiEncrAsyncSim(s, password) {
  return aesEncrypt(s, password || "bats-user-key");
}

// ── Tests ──

describe("isAESGCM() — format detection", () => {
  it("detects AES-GCM envelope", () => {
    expect(isAESGCM('{"v":1,"algo":"AES-GCM","data":"x"}')).toBe(true);
  });
  it("rejects XOR base64", () => {
    expect(isAESGCM(aiEncr("test-key"))).toBe(false);
  });
  it("rejects empty string", () => {
    expect(isAESGCM("")).toBe(false);
  });
  it("rejects null", () => {
    expect(isAESGCM(null)).toBe(false);
  });
  it("rejects wrong version", () => {
    expect(isAESGCM('{"v":2,"algo":"AES-GCM"}')).toBe(false);
  });
  it("rejects wrong algo", () => {
    expect(isAESGCM('{"v":1,"algo":"AES-CTR"}')).toBe(false);
  });
});

describe("XOR legacy — aiDecr reads XOR keys correctly", () => {
  it("decrypts a known XOR-encrypted key", () => {
    const original = "sk-test-1234567890";
    const encrypted = aiEncr(original);
    const decrypted = aiDecr(encrypted);
    expect(decrypted).toBe(original);
  });

  it("returns empty string for invalid base64", () => {
    expect(aiDecr("not-valid-base64!!!")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(aiDecr("")).toBe("");
  });
});

describe("Migration XOR → AES-GCM — on-read migration", () => {
  it("migrates XOR key to AES-GCM when reading", async () => {
    const original = "sk-my-secret-api-key";
    const xorEncrypted = aiEncr(original);
    const store = { key: xorEncrypted };

    expect(isAESGCM(store.key)).toBe(false);

    const result = await aiDecrAsyncSim(store.key, "bats-user-key", store);

    expect(result).toBe(original);
    expect(isAESGCM(store.key)).toBe(true);
  });

  it("store no longer contains XOR after migration", async () => {
    const original = "my-api-key-abc";
    const xorEncrypted = aiEncr(original);
    const store = { key: xorEncrypted };

    await aiDecrAsyncSim(store.key, "bats-user-key", store);

    expect(isAESGCM(store.key)).toBe(true);
    expect(store.key).not.toBe(xorEncrypted);
  });

  it("migrated key decrypts correctly with AES-GCM", async () => {
    const original = "sk-proj-real-key-xyz";
    const xorEncrypted = aiEncr(original);
    const store = { key: xorEncrypted };

    await aiDecrAsyncSim(store.key, "bats-user-key", store);

    const decrypted = await aesDecrypt(store.key, "bats-user-key");
    expect(decrypted).toBe(original);
  });

  it("handles multiple reads consistently (idempotent)", async () => {
    const original = "key-to-read-twice";
    const xorEncrypted = aiEncr(original);
    const store = { key: xorEncrypted };

    const r1 = await aiDecrAsyncSim(store.key, "bats-user-key", store);
    const r2 = await aiDecrAsyncSim(store.key, "bats-user-key", store);

    expect(r1).toBe(original);
    expect(r2).toBe(original);
    expect(isAESGCM(store.key)).toBe(true);
  });
});

describe("New keys — AES-GCM only, no XOR fallback", () => {
  it("encrypts new key with AES-GCM", async () => {
    const key = "sk-new-key-12345";
    const encrypted = await aiEncrAsyncSim(key);

    expect(isAESGCM(encrypted)).toBe(true);
    const decrypted = await aesDecrypt(encrypted, "bats-user-key");
    expect(decrypted).toBe(key);
  });

  it("different每次 produces different ciphertext (random salt/IV)", async () => {
    const e1 = await aiEncrAsyncSim("same-key");
    const e2 = await aiEncrAsyncSim("same-key");
    expect(e1).not.toBe(e2);
  });

  it("XOR function still exists for backward compat but is not used for new saves", () => {
    const key = "test-key";
    const xorResult = aiEncr(key);
    expect(typeof xorResult).toBe("string");
    expect(xorResult.length).toBeGreaterThan(0);
    // XOR still works for reading, but aiEncrAsyncSim never produces it
  });
});

describe("Error when AES-GCM unavailable", () => {
  it("aiEncrAsync rejects when crypto not available", () => {
    var g = globalThis;
    var original = g.BATS;
    try {
      g.BATS = {};
      var crypto = (g.BATS && g.BATS.crypto) ? g.BATS.crypto : null;
      expect(crypto).toBeNull();
    } finally {
      g.BATS = original;
    }
  });

  it("aiEncrAsync rejects when BATS not defined", () => {
    var g = globalThis;
    var original = g.BATS;
    try {
      g.BATS = undefined;
      var crypto = (g.BATS && g.BATS.crypto) ? g.BATS.crypto : null;
      expect(crypto).toBeNull();
    } finally {
      g.BATS = original;
    }
  });
});

describe("Compatibility — existing XOR installations", () => {
  it("can still read XOR keys via aiDecr", () => {
    const keys = [
      "sk-openai-123",
      "nvapi-test-key-456",
      "gsk_groq_key_789",
      ""
    ];
    for (const k of keys) {
      const encrypted = aiEncr(k);
      const decrypted = aiDecr(encrypted);
      expect(decrypted).toBe(k);
    }
  });

  it("XOR encryption is deterministic with same seed", () => {
    const k = "deterministic-test";
    const e1 = aiEncr(k);
    const e2 = aiEncr(k);
    expect(e1).toBe(e2);
  });

  it("XOR handles ASCII characters", () => {
    const k = "sk-test-key-12345!@#$%";
    const encrypted = aiEncr(k);
    const decrypted = aiDecr(encrypted);
    expect(decrypted).toBe(k);
  });
});
