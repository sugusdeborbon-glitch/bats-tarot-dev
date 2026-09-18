const GOOGLE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GOOGLE_MODEL = "gemini-3.6-flash";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "qwen/qwen3.6-27b";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "openrouter/free";
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "ministral-14b-latest";
const ALLOWED_ORIGINS = [
  "https://sugusdeborbon-glitch.github.io",
  "null"
];
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_TOKENS = 8192;
const ADMIN_ENDPOINT = "/api/config";
const CONFIG_KEY = "ai_config";
const TTS_ENDPOINT = "/api/tts";
const TTS_MAX_TEXT = 20000;
const TTS_GOOGLE = "https://translate.google.com/translate_tts";
const AI_FLAGS_ENDPOINT = "/api/ai-flags";
const DEFAULT_USE_CORTA = true;
const DEFAULT_USE_LARGA = true;

function _sistemaBase(nombre, estructura) {
  return "Eres el intérprete profesional BATS (Business Ashram Tarot System) para la tirada “" + nombre + "”, basada en el mazo Rider-Waite-Smith.\n"
    + "PRINCIPIO RECTOR (no negociable): el tarot diagnostica el patrón; la persona decide. Nunca predices el futuro, nunca ordenas una acción, nunca afirmas certezas sobre terceros que no participan en la tirada. Tu voz es la de un analista de patrones, no un oráculo: evita expresiones como \"el universo te indica\", \"pronto llegarás a\", \"debes\", \"tienes que\"; usa en su lugar \"la carta señala\", \"el patrón indica\", \"conviene observar\".\n"
    + "Recibirás la tirada con posiciones ya definidas, su quintaesencia ya calculada y, para cada carta, una \"Referencia BATS\": es la fuente de significado autorizada del sistema para esa carta en esa orientación. Interprétala y fíltrala por el sentido de la posición; no la sustituyas por el significado genérico de manual RWS ni la contradigas.\n"
    + "Estructura de la tirada:\n" + estructura + "\n"
    + "Para cada posición: antes de interpretar, nombra en pocas palabras un elemento visual concreto de la imagen de la carta (RWS); no reemplaces el símbolo por metalenguaje técnico.\n"
    + "Debes responder ÚNICAMENTE con JSON válido y con esta forma exacta:\n"
    + "{\"posiciones\":[{\"i\":0,\"texto\":\"...\"},{\"i\":1,\"texto\":\"...\"},...],\"quintaesencia\":\"...\"}\n"
    + "Reglas:\n"
    + "- Una entrada por cada posición. El campo i es el índice de la carta (empieza en 0).\n"
    + "- Cada \"texto\" ancla primero un elemento visual y luego interpreta la carta filtrada por el sentido de esa posición y su Referencia BATS. Máximo 300 caracteres.\n"
    + "- Si se entrega una \"Referencia BATS de la quintaesencia\", úsala como base de la síntesis; no inventes un significado distinto. \"quintaesencia\" sintetiza el arquetipo de fondo de toda la tirada, nunca como mandato de acción ni predicción. Máximo 300 caracteres.\n"
    + "- Idioma: español, claro, directo, sin relleno místico ni tecnicismos innecesarios.\n"
    + "- No inventes datos biográficos ni asumas circunstancias no proporcionadas. Si falta información necesaria, indícalo brevemente dentro del texto de esa posición, nunca fuera del JSON.\n"
    + "- No escribas nada fuera del JSON: ni introducción, ni comentarios, ni comillas de código, ni etiquetas markdown.";
}

const AI_SISTEMA_AV = "Eres el intérprete profesional BATS (Business Ashram Tarot System) para el Arcano Visitante.\nPRINCIPIO RECTOR (no negociable): el tarot diagnostica el patrón; la persona decide. No predices el futuro ni ordenas una acción; tu voz es la de un analista de patrones, no un oráculo.\nRecibirás el Arcano Visitante del día (una carta calculada por numerología), sus Referencias BATS (lectura normal, sombra y ayuda — úsalas como base autorizada, no las sustituyas por significado genérico) y tres preguntas fijas.\nResponde ÚNICAMENTE con JSON válido de esta forma exacta:\n{\"q1\":\"...\",\"q2\":\"...\",\"q3\":\"...\"}\nReglas:\n- q1: ¿Qué vienes a mostrarme hoy? Máximo 300 caracteres.\n- q2: ¿Qué patrón conocido me estás ayudando a no repetir hoy? Máximo 300 caracteres.\n- q3: ¿Qué acción consciente me ayuda a escucharte? Máximo 300 caracteres.\n- Idioma: español, claro y directo. No predigas el futuro; muestra patrones y posibilidades.\n- No escribas nada fuera del JSON: ni introducción, ni comentarios, ni comillas de código.";

const AI_SISTEMA_LARGA = "Act\u00faa como el int\u00e9rprete experto del m\u00e9todo BATS (Business Ashram Tarot System).\nPRINCIPIO RECTOR (no negociable): el tarot diagnostica el patr\u00f3n; la persona decide. Nunca predices el futuro, nunca ordenas una acci\u00f3n, nunca afirmas certezas sobre terceros que no participan en la tirada. Tu voz es la de un analista de patrones, no un or\u00e1culo: evita \"el universo te indica\", \"pronto llegar\u00e1s a\", \"debes\", \"tienes que\"; usa en su lugar \"la carta se\u00f1ala\", \"el patr\u00f3n indica\", \"conviene observar\".\n\nVas a recibir una \u00fanica tirada del Tarot Rider-Waite-Smith. La tirada puede pertenecer a cualquier \u00e1mbito (diaria, laboral, relaci\u00f3n, aprendizaje, decisi\u00f3n, entrevista a un arcano, tirada libre, etc.). No presupongas su estructura; ded\u00facela a partir de los t\u00edtulos, posiciones y preguntas.\n\nCada carta llega con una \"Referencia BATS\": es la fuente de significado autorizada del sistema para esa carta en esa orientaci\u00f3n. \u00dasala como base de tu interpretaci\u00f3n; no la sustituyas por el significado gen\u00e9rico de manual RWS ni la contradigas. Si una carta no trae Referencia BATS, interp\u00e9tala desde el simbolismo RWS est\u00e1ndar e indica que no hay referencia propia para ella.\n\nPara cada posici\u00f3n:\n1. Lee primero la pregunta asociada a esa posici\u00f3n.\n2. Nombra brevemente un elemento visual concreto de la carta; no sustituyas el s\u00edmbolo por metalenguaje.\n3. Interpreta la carta desde la funci\u00f3n que cumple en esa posici\u00f3n, apoy\u00e1ndote en su Referencia BATS.\n4. Extrae el aprendizaje pr\u00e1ctico que aporta.\n\nSi existe una quintaesencia:\n- Si se entrega una \"Referencia BATS de la quintaesencia\", \u00fasala como base; no inventes un significado distinto.\n- Interpr\u00e9tala como el patr\u00f3n arquet\u00edpico que sintetiza toda la tirada.\n- Expl\u00edcala en relaci\u00f3n con el resto de las cartas, no de forma aislada.\n\nDespu\u00e9s realiza una lectura integrada de la tirada que incluya:\n- Arquitectura simb\u00f3lica de la tirada.\n- Relaciones, apoyos, tensiones y coherencias entre las cartas.\n- Repeticiones de n\u00fameros, palos, figuras o arcanos mayores cuando sean significativas.\n- Evoluci\u00f3n del mensaje desde la primera hasta la \u00faltima posici\u00f3n.\n- Ense\u00f1anza central de la tirada.\n\nFinaliza con:\n1. Una s\u00edntesis profunda de varios p\u00e1rrafos.\n2. Una \u00fanica frase que resuma el aprendizaje esencial del sistema.\n\nPrincipios metodol\u00f3gicos BATS:\n- El significado nace de la pregunta y de la posici\u00f3n, no de un significado fijo de la carta.\n- Cada carta modifica y es modificada por las dem\u00e1s.\n- La tirada constituye un \u00fanico sistema simb\u00f3lico.\n- La quintaesencia revela el patr\u00f3n profundo que organiza toda la lectura.\n- La interpretaci\u00f3n debe ser simb\u00f3lica, psicol\u00f3gica y arquet\u00edpica, orientada a la comprensi\u00f3n y a la toma de conciencia.\n- No utilices cartas invertidas salvo que se indique expresamente.\n- Evita cualquier enfoque predictivo, fatalista o determinista.";

const SISTEMAS = {
  diaria: _sistemaBase("Cruz Diaria", "- Centro: la energía del día (el núcleo de la jornada).\n- Izquierda: qué frenar o minimizar.\n- Derecha: qué impulsar o hacer.\n- Arriba: ayuda disponible.\n- Abajo: posible salida o resultado."),
  rel: _sistemaBase("Tirada de la relación", "- Energía del momento de la relación.\n- Energía de la Persona 1.\n- Energía de la Persona 2.\n- Posible salida o dirección."),
  laboral: _sistemaBase("BATS Laboral", "- Centro: la energía laboral del momento.\n- Izquierda: qué frenar o minimizar en el trabajo.\n- Derecha: qué impulsar o hacer en el trabajo.\n- Arriba: ayuda disponible en el trabajo.\n- Abajo: posible salida o resultado laboral."),
  aprendizaje: _sistemaBase("El Aprendizaje", "- El Hecho: qué ha ocurrido realmente.\n- El Maestro: qué me está mostrando realmente esta experiencia.\n- El Punto Ciego: qué no estoy viendo o qué interpretación me impide aprender.\n- La Integración: qué comprensión quiere integrarse en mí.\n- El Don Transformador: qué capacidad o cambio nace al integrar la verdad.\n- El Resultado Posible: qué transformación ocurre si integro la lección."),
  pers: _sistemaBase("Tirada Personalizada", "- Cada posición lleva el título que la persona eligió; ese título define su función.\n- No asumas un significado fijo de la carta: interprétala desde la función que cumple en su posición."),
  av: AI_SISTEMA_AV,
  larga: AI_SISTEMA_LARGA,
  default: _sistemaBase("tirada BATS", "(estructura no especificada; interpreta cada posición por su título tal como llega)")
};

function sistemaPorTipo(tipo) {
  return SISTEMAS[tipo] || SISTEMAS.default;
}

const PROVIDERS = [
  { id: "groq", name: "Groq", url: GROQ_URL, model: GROQ_MODEL, keyEnv: "GROQ_API_KEY" },
  { id: "google", name: "Google", url: GOOGLE_URL, model: GOOGLE_MODEL, keyEnv: "GOOGLE_API_KEY", googleThinking: "low" },
  { id: "openrouter", name: "OpenRouter", url: OPENROUTER_URL, model: OPENROUTER_MODEL, keyEnv: "OPENROUTER_API_KEY" },
  { id: "mistral", name: "Mistral", url: MISTRAL_URL, model: MISTRAL_MODEL, keyEnv: "MISTRAL_API_KEY" }
];
const DEFAULT_ORDER = ["groq", "google", "openrouter", "mistral"];

const hits = new Map();

function corsHeaders(req) {
  const origin = req.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.indexOf(origin) !== -1) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-BATS-Token, X-Admin-Token",
      "Vary": "Origin"
    };
  }
  return {};
}

function json(body, status, req, providerName) {
  const extra = providerName ? { "X-Provider": providerName } : {};
  return new Response(JSON.stringify(body), {
    status: status,
    headers: Object.assign({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }, extra, corsHeaders(req))
  });
}

function rateLimited(req) {
  const ip = req.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(function(t){ return now - t < RATE_LIMIT_WINDOW_MS; });
  if (arr.length >= RATE_LIMIT_MAX) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

async function getConfig(env) {
  try {
    const raw = await env.CONFIG.get(CONFIG_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

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
      url: meta.url,
      model: custom.model || meta.model,
      key: key,
      googleThinking: (custom.extra && custom.extra.thinking_level) || meta.googleThinking
    });
  }
  return list;
}

function availableProviders(env) {
  return PROVIDERS.map(function(p){
    return { id: p.id, name: p.name, available: !!env[p.keyEnv] };
  });
}

function providerStatus(env, cfg) {
  const providersCfg = cfg.providers || {};
  const on = cfg.providersOn || {};
  return PROVIDERS.map(function(p){
    const custom = providersCfg[p.id] || {};
    return {
      id: p.id,
      name: p.name,
      hasKey: !!env[p.keyEnv],
      active: on[p.id] !== false,
      model: custom.model || p.model,
      modelSource: custom.model ? "kv" : "default",
      label: custom.label || p.name
    };
  });
}

const LEN_LINES = {
  corta: "Extensión: breve, alrededor de 500 caracteres (1 párrafo).",
  media: "Extensión: media, alrededor de 1500 caracteres (3-4 párrafos).",
  larga: "Extensión: extensa, alrededor de 3000 caracteres (5-7 párrafos)."
};

function applyOverrides(messages, cfg, tipo) {
  if (!Array.isArray(messages) || !messages.length) return messages;
  let msgs = messages;
  const keyMap = { diaria: "systemDiaria", rel: "systemRel", laboral: "systemLaboral", aprendizaje: "systemAprendizaje", pers: "systemPers", av: "systemAV", larga: "systemLarga" };
  const overKey = keyMap[tipo];
  if (overKey && cfg[overKey] && typeof cfg[overKey] === "string" && msgs[0] && msgs[0].role === "system") {
    msgs = msgs.slice();
    msgs[0] = Object.assign({}, msgs[0], { content: cfg[overKey] });
  }
  if (tipo === "larga" && cfg.lenDefault && LEN_LINES[cfg.lenDefault] && msgs[1] && msgs[1].role === "user") {
    const content = String(msgs[1].content || "");
    const replaced = content.replace(/Extensión: [^\n]*/, LEN_LINES[cfg.lenDefault]);
    if (replaced !== content) {
      msgs = msgs.slice();
      msgs[1] = Object.assign({}, msgs[1], { content: replaced });
    }
  }
  return msgs;
}

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
  for (const k of ["systemDiaria", "systemRel", "systemLaboral", "systemAprendizaje", "systemPers", "systemAV", "systemLarga"]) {
    if (typeof body[k] === "string") cfg[k] = body[k];
  }
  if (typeof body.temperature === "number" && body.temperature >= 0 && body.temperature <= 2) {
    cfg.temperature = body.temperature;
  }
  if (Number.isInteger(body.maxTokens) && body.maxTokens >= 128 && body.maxTokens <= 8192) {
    cfg.maxTokens = body.maxTokens;
  }
  if (LEN_LINES[body.lenDefault]) cfg.lenDefault = body.lenDefault;
  if (typeof body.useCorta === "boolean") cfg.useCorta = body.useCorta;
  if (typeof body.useLarga === "boolean") cfg.useLarga = body.useLarga;
  return cfg;
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }
    const url = new URL(req.url);

    if (url.pathname === ADMIN_ENDPOINT) {
      if (req.headers.get("X-Admin-Token") !== env.ADMIN_TOKEN) {
        return json({ error: "No autorizado" }, 401, req);
      }
      if (req.method === "GET") {
        const cfg = await getConfig(env);
        let health = {};
        try {
          const raw = await env.CONFIG.get("provider_health");
          health = raw ? JSON.parse(raw) : {};
        } catch (e) { /* ignore */ }
        return json({ config: cfg, available: availableProviders(env), providerInfo: providerStatus(env, cfg), providerHealth: health, defaults: DEFAULT_ORDER, systemDefaults: SISTEMAS, aiFlags: { useCorta: typeof cfg.useCorta === "boolean" ? cfg.useCorta : DEFAULT_USE_CORTA, useLarga: typeof cfg.useLarga === "boolean" ? cfg.useLarga : DEFAULT_USE_LARGA } }, 200, req);
      }
      if (req.method === "PUT") {
        let body;
        try {
          body = await req.json();
        } catch (e) {
          return json({ error: "Cuerpo JSON inválido" }, 400, req);
        }
        const cfg = sanitizeConfig(body);
        await env.CONFIG.put(CONFIG_KEY, JSON.stringify(cfg));
        return json({ ok: true, config: cfg }, 200, req);
      }
      return json({ error: "Método no permitido" }, 405, req);
    }

    if (url.pathname === AI_FLAGS_ENDPOINT) {
      if (req.method !== "GET") {
        return json({ error: "Método no permitido" }, 405, req);
      }
      const cfg = await getConfig(env);
      return json({
        useCorta: typeof cfg.useCorta === "boolean" ? cfg.useCorta : DEFAULT_USE_CORTA,
        useLarga: typeof cfg.useLarga === "boolean" ? cfg.useLarga : DEFAULT_USE_LARGA
      }, 200, req);
    }

    if (url.pathname === "/api/provider-status") {
      if (req.method !== "GET") {
        return json({ error: "Método no permitido" }, 405, req);
      }
      if (req.headers.get("X-Admin-Token") !== env.ADMIN_TOKEN) {
        return json({ error: "No autorizado" }, 401, req);
      }
      const cfg = await getConfig(env);
      const providersCfg = cfg.providers || {};
      const on = cfg.providersOn || {};
      const status = {};
      for (const p of PROVIDERS) {
        const custom = providersCfg[p.id] || {};
        status[p.id] = {
          id: p.id,
          name: p.name,
          hasKey: !!env[p.keyEnv],
          active: on[p.id] !== false,
          model: custom.model || p.model,
          modelSource: custom.model ? "kv" : "default",
          label: custom.label || p.name,
          url: p.url
        };
      }
      return json({ providers: status, order: cfg.providerOrder || DEFAULT_ORDER, defaults: DEFAULT_ORDER }, 200, req);
    }

    if (url.pathname === "/api/provider-test") {
      if (req.method !== "POST") {
        return json({ error: "Método no permitido" }, 405, req);
      }
      if (req.headers.get("X-Admin-Token") !== env.ADMIN_TOKEN) {
        return json({ error: "No autorizado" }, 401, req);
      }
      let body;
      try {
        body = await req.json();
      } catch (e) {
        return json({ error: "Cuerpo JSON inválido" }, 400, req);
      }
      const providerId = typeof body.provider === "string" ? body.provider : "";
      if (!providerId) {
        return json({ error: "Falta el campo provider" }, 400, req);
      }
      const cfg = await getConfig(env);
      const providers = buildProviders(env, cfg);
      const target = providers.find(function(p){ return p.id === providerId; });
      if (!target) {
        return json({ error: "Proveedor no disponible: " + providerId }, 400, req);
      }
      const testMessages = [{ role: "user", content: "PING" }];
      const t0 = Date.now();
      const res = await llamarProveedor(target, testMessages, { temperature: 0.7, max_tokens: 5 });
      const latency = Date.now() - t0;
      const healthEntry = {
        lastTest: new Date().toISOString(),
        ok: res.ok,
        status: res.status || 0,
        latency: latency,
        model: target.model,
        modelReal: res.modelReal || null,
        provider: target.name
      };
      if (!res.ok) {
        healthEntry.error = res.err;
        healthEntry.category = res.category || "unknown";
      }
      try {
        const raw = await env.CONFIG.get("provider_health");
        const health = raw ? JSON.parse(raw) : {};
        health[providerId] = healthEntry;
        await env.CONFIG.put("provider_health", JSON.stringify(health));
      } catch (e) { /* health storage best-effort */ }
      return json(healthEntry, 200, req);
    }

    if (url.pathname === "/api/provider-health") {
      if (req.method !== "GET") {
        return json({ error: "Método no permitido" }, 405, req);
      }
      if (req.headers.get("X-Admin-Token") !== env.ADMIN_TOKEN) {
        return json({ error: "No autorizado" }, 401, req);
      }
      try {
        const raw = await env.CONFIG.get("provider_health");
        return json(raw ? JSON.parse(raw) : {}, 200, req);
      } catch (e) {
        return json({}, 200, req);
      }
    }

    if (url.pathname === TTS_ENDPOINT) {
      if (req.method !== "POST") {
        return json({ error: "Método no permitido" }, 405, req);
      }
      if (env.BATS_TOKEN && req.headers.get("X-BATS-Token") !== env.BATS_TOKEN) {
        return json({ error: "No autorizado" }, 401, req);
      }
      if (rateLimited(req)) {
        return json({ error: "Demasiadas peticiones. Inténtalo en un momento." }, 429, req);
      }
      let body;
      try {
        body = await req.json();
      } catch (e) {
        return json({ error: "Cuerpo JSON inválido" }, 400, req);
      }
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) {
        return json({ error: "Falta el texto" }, 400, req);
      }
      if (text.length > TTS_MAX_TEXT) {
        return json({ error: "Texto demasiado largo" }, 413, req);
      }
      const lang = body.voice === "es-US" ? "es-US" : "es";
      const res = await ttsGoogle(text, lang);
      if (res.error) {
        return json({ error: res.error }, 502, req);
      }
      return new Response(res.data, {
        status: 200,
        headers: Object.assign({
          "Content-Type": "audio/mpeg",
          "Content-Disposition": 'attachment; filename="lectura-bats.mp3"',
          "Cache-Control": "no-store"
        }, corsHeaders(req))
      });
    }

    if (req.method !== "POST") {
      return json({ error: "Método no permitido" }, 405, req);
    }
    if (env.BATS_TOKEN && req.headers.get("X-BATS-Token") !== env.BATS_TOKEN) {
      return json({ error: "No autorizado" }, 401, req);
    }
    if (rateLimited(req)) {
      return json({ error: "Demasiadas peticiones. Inténtalo en un momento." }, 429, req);
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json({ error: "Cuerpo JSON inválido" }, 400, req);
    }

    const tipo = typeof body.tipo === "string" ? body.tipo : "";
    const cfg = await getConfig(env);

    let messages = body.messages;
    if (!Array.isArray(messages) || !messages.length) {
      if (typeof body.user === "string" && body.user) {
        messages = [
          { role: "system", content: sistemaPorTipo(tipo) },
          { role: "user", content: body.user }
        ];
      } else {
        return json({ error: "Faltan los mensajes" }, 400, req);
      }
    }
    const msgs = applyOverrides(messages, cfg, tipo);

    if (body.mode === "propia") {
      if (typeof body.base !== "string" || !/^https:\/\//i.test(body.base)) {
        return json({ error: "Endpoint de IA inválido" }, 400, req);
      }
      const pkey = String(req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!pkey) {
        return json({ error: "Falta la clave del consultante" }, 401, req);
      }
      const p = await llamarEndpointPropio(body.base, body.model, msgs, cfg, pkey);
      if (p.ok) {
        return json({ content: p.content, provider: "Mi IA", modelo: (typeof body.model === "string" && body.model) ? body.model : "gpt-4o-mini" }, 200, req, "propia");
      }
      const st = p.status && p.status >= 400 ? p.status : 502;
      return json({ error: p.err }, st, req);
    }

    let providers = buildProviders(env, cfg);
    if (!providers.length) {
      return json({ error: "Configuración del servidor incompleta" }, 500, req);
    }

    if (typeof body.provider === "string" && body.provider) {
      providers = providers.filter(function(p){ return p.name === body.provider; });
    }

    const payload = {
      temperature: cfg.temperature != null ? cfg.temperature : (body.temperature != null ? body.temperature : 0.7),
      max_tokens: cfg.maxTokens || body.max_tokens || MAX_TOKENS
    };

    let last = null;
    const errors = [];
    for (const provider of providers) {
      const res = await llamarProveedor(provider, msgs, payload);
      if (res.ok) {
        return json({ content: res.content, provider: provider.name, modelo: provider.model, modeloReal: res.modelReal || null }, 200, req, provider.name);
      }
      last = res;
      errors.push(provider.name + ": " + res.err + " [" + (res.category || "unknown") + "]");
    }
    if (last) {
      const status = last.status && last.status >= 400 ? last.status : 502;
      const summary = "Todos los proveedores fallaron (" + providers.length + "): " + errors.join(" | ");
      return json({ error: summary }, status, req);
    }
    return json({ error: "Error desconocido del proveedor" }, 502, req);
  }
};

async function llamarEndpointPropio(base, model, messages, cfg, key) {
  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, 40000);
  const bodyObj = {
    model: (typeof model === "string" && model) ? model : "gpt-4o-mini",
    messages: messages,
    temperature: cfg.temperature != null ? cfg.temperature : 0.7,
    max_tokens: cfg.maxTokens || MAX_TOKENS
  };
  try {
    const upstream = await fetch(base.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key
      },
      body: JSON.stringify(bodyObj),
      signal: ctrl.signal
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      const detalle = data && data.error
        ? (data.error.message || data.error.status || JSON.stringify(data.error))
        : JSON.stringify(data).slice(0, 300);
      return { ok: false, status: upstream.status, err: upstream.status + ": " + detalle };
    }
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content || content.length < 80) {
      return { ok: false, status: 502, err: "Respuesta vacía o demasiado corta del proveedor propio" };
    }
    return { ok: true, status: upstream.status, content: content };
  } catch (e) {
    if (e && e.name === "AbortError") {
      return { ok: false, status: 504, err: "El proveedor propio tardó demasiado" };
    }
    return { ok: false, status: 502, err: "Error de red con el proveedor propio" };
  } finally {
    clearTimeout(timer);
  }
}

async function llamarProveedor(provider, messages, payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, 40000);
  const bodyObj = {
    model: provider.model,
    messages: messages,
    temperature: payload.temperature,
    max_tokens: payload.max_tokens
  };
  if (provider.googleThinking) {
    bodyObj.extra_body = {
      google: {
        thinking_config: {
          thinking_level: provider.googleThinking,
          include_thoughts: false
        }
      }
    };
  }
  try {
    const upstream = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + provider.key
      },
      body: JSON.stringify(bodyObj),
      signal: ctrl.signal
    });
    let data;
    try {
      data = await upstream.json();
    } catch (parseErr) {
      return {
        ok: false,
        status: upstream.status,
        err: provider.name + " (" + upstream.status + "): respuesta no JSON del upstream",
        category: "parse_error"
      };
    }
    if (!upstream.ok) {
      const detalle = data && data.error
        ? (data.error.message || data.error.status || JSON.stringify(data.error))
        : (data && data.error_type ? data.error_type : JSON.stringify(data).slice(0, 300));
      let category = "provider_error";
      if (upstream.status === 429) category = "rate_limited";
      else if (upstream.status >= 500) category = "server_error";
      else if (upstream.status === 408) category = "timeout";
      return {
        ok: false,
        status: upstream.status,
        err: provider.name + " (" + upstream.status + "): " + detalle,
        category: category
      };
    }
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content || content.length < 80) {
      return { ok: false, status: 502, err: "Respuesta vacía o demasiado corta de " + provider.name, category: "empty_response" };
    }
    return { ok: true, status: upstream.status, content: content, modelReal: data.model || null };
  } catch (e) {
    if (e && e.name === "AbortError") {
      return { ok: false, status: 504, err: provider.name + ": la petición excedió el tiempo de espera (40s).", category: "timeout" };
    }
    return { ok: false, status: 502, err: provider.name + ": error de red — " + (e && e.message || "desconocido"), category: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

function splitTTS(text, max) {
  max = max || 150;
  const s = String(text).replace(/\s+/g, " ").trim();
  if (!s) return [];
  const chunks = [];
  let rest = s;
  while (rest.length > max) {
    const slice = rest.substring(0, max);
    let cut = slice.lastIndexOf(". ");
    if (cut < max * 0.5) cut = slice.lastIndexOf("; ");
    if (cut < max * 0.5) cut = slice.lastIndexOf(", ");
    if (cut <= 0) cut = slice.lastIndexOf(" ");
    if (cut <= 0) cut = max;
    const piece = slice.substring(0, cut).trim();
    if (piece) chunks.push(piece);
    rest = rest.substring(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function ttsGoogle(text, lang) {
  const chunks = splitTTS(text, 150);
  if (!chunks.length) return { error: "Texto vacío" };
  const parts = [];
  for (const chunk of chunks) {
    const url = TTS_GOOGLE
      + "?ie=UTF-8&q=" + encodeURIComponent(chunk)
      + "&tl=" + encodeURIComponent(lang)
      + "&client=tw-ob";
    let upstream;
    try {
      upstream = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Referer": "https://translate.google.com/"
        }
      });
    } catch (e) {
      return { error: "No se pudo contactar con el proveedor de voz." };
    }
    if (!upstream.ok) {
      return { error: "El proveedor de voz respondió con estado " + upstream.status };
    }
    try {
      const buf = await upstream.arrayBuffer();
      parts.push(new Uint8Array(buf));
    } catch (e) {
      return { error: "No se pudo leer el audio del proveedor de voz." };
    }
  }
  const total = parts.reduce(function(a, b){ return a + b.length; }, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return { data: out };
}