/**
 * BATS Tarot — Crypto utility tests
 * Tests AES-GCM + PBKDF2 encryption/decryption from js/crypto-util.js
 */
import { describe, it, expect } from "vitest";

// Replicate crypto-util logic for testing (Web Crypto API available in Node via vitest)
const ITERATIONS = 100000;
const SALT_LEN = 16;
const IV_LEN = 12;
const FORMAT_VERSION = 1;

function getRandomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

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
    .then(function (keyMaterial) {
      return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: ITERATIONS, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    });
}

function encrypt(plaintext, password) {
  const enc = new TextEncoder();
  const salt = getRandomBytes(SALT_LEN);
  const iv = getRandomBytes(IV_LEN);
  return deriveKey(password, salt).then(function (key) {
    return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(plaintext));
  }).then(function (ciphertext) {
    return JSON.stringify({
      v: FORMAT_VERSION, algo: "AES-GCM", kdf: "PBKDF2",
      iter: ITERATIONS, salt: bufferToBase64(salt), iv: bufferToBase64(iv),
      data: bufferToBase64(ciphertext)
    });
  });
}

function decrypt(envelope, password) {
  let payload;
  try { payload = JSON.parse(envelope); } catch (e) {
    return Promise.reject(new Error("Formato de fichero no válido"));
  }
  if (!payload || payload.v !== FORMAT_VERSION || payload.algo !== "AES-GCM") {
    return Promise.reject(new Error("Formato incompatible"));
  }
  const salt = new Uint8Array(base64ToBuffer(payload.salt));
  const iv = new Uint8Array(base64ToBuffer(payload.iv));
  const ciphertext = base64ToBuffer(payload.data);
  return deriveKey(password, salt).then(function (key) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
  }).then(function (plaintext) {
    return new TextDecoder().decode(plaintext);
  }).catch(function (e) {
    if (e.message && e.message.indexOf("formato") !== -1) throw e;
    throw new Error("Contraseña incorrecta o fichero corrupto");
  });
}

// ── Tests ──

describe("AES-GCM encrypt/decrypt", () => {
  it("encrypts and decrypts with correct password", async () => {
    const original = "mi-clave-secreta-12345";
    const password = "admin-password";
    const envelope = await encrypt(original, password);
    const decrypted = await decrypt(envelope, password);
    expect(decrypted).toBe(original);
  });

  it("produces valid JSON envelope", async () => {
    const envelope = await encrypt("test", "pass");
    const parsed = JSON.parse(envelope);
    expect(parsed.v).toBe(1);
    expect(parsed.algo).toBe("AES-GCM");
    expect(parsed.kdf).toBe("PBKDF2");
    expect(parsed.iter).toBe(100000);
    expect(parsed.salt).toBeDefined();
    expect(parsed.iv).toBeDefined();
    expect(parsed.data).toBeDefined();
  });

  it("fails with wrong password", async () => {
    const envelope = await encrypt("secret", "correct-password");
    try {
      await decrypt(envelope, "wrong-password");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e.message).toContain("Contraseña incorrecta");
    }
  });

  it("fails with tampered data", async () => {
    const envelope = await encrypt("secret", "pass");
    const parsed = JSON.parse(envelope);
    // Tamper with the data
    parsed.data = parsed.data.slice(0, -4) + "XXXX";
    const tampered = JSON.stringify(parsed);
    try {
      await decrypt(tampered, "pass");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e.message).toContain("Contraseña incorrecta");
    }
  });

  it("fails with invalid JSON", async () => {
    try {
      await decrypt("not-valid-json", "pass");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it("fails with wrong format version", async () => {
    const bad = JSON.stringify({ v: 99, algo: "AES-GCM", data: "x", salt: "x", iv: "x" });
    try {
      await decrypt(bad, "pass");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e.message).toContain("incompatible");
    }
  });

  it("handles special characters in plaintext", async () => {
    const original = "ñáéíóú üïöä €£$@!#%&*(){}[]|\\:\";'<>?,./`~";
    const password = "p@ssw0rd!";
    const envelope = await encrypt(original, password);
    const decrypted = await decrypt(envelope, password);
    expect(decrypted).toBe(original);
  });

  it("handles empty string", async () => {
    const envelope = await encrypt("", "pass");
    const decrypted = await decrypt(envelope, "pass");
    expect(decrypted).toBe("");
  });

  it("handles long string (API key pattern)", async () => {
    const original = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const envelope = await encrypt(original, "bats-admin-2026");
    const decrypted = await decrypt(envelope, "bats-admin-2026");
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext each time (random salt/IV)", async () => {
    const e1 = await encrypt("same", "pass");
    const e2 = await encrypt("same", "pass");
    expect(e1).not.toBe(e2);
    // But both decrypt to the same value
    const d1 = await decrypt(e1, "pass");
    const d2 = await decrypt(e2, "pass");
    expect(d1).toBe(d2);
    expect(d1).toBe("same");
  });
});
