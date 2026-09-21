# Corrección estructural — Provider Manager (DEV)

Estado: implementado en el working tree de `bats-tarot-dev`. **Sin commit, sin push, sin deploy.**
Alcance: solo DEV. PRO (`bats-tarot`, worker `bats-tarot-ai`) no se ha tocado.

Commit de partida auditado: `db1b1e5`.

---

## 1. Arquitectura final del estado

Antes había **dos arrays que representaban lo mismo sin estar enlazados**
(`providerInfo` = snapshot del servidor; `pendingProviders` = borrador que nunca se
sembraba), y el borrador se ponía a `null` en cada carga/guardado. El resultado era
"N cards en pantalla / 0 en el estado".

Ahora:

| Objeto | Papel | Quién escribe |
|---|---|---|
| `_adminState.providerInfo` | snapshot de solo lectura del Worker (GET `/api/config`) | `adminEntrar`, `adminRefresh` |
| `_adminState.draft` | **única fuente de verdad editable** | `adminSembrarDraft()` (siembra/reemplazo), `adminCambio()` (edición por input), `adminMover/Quitar/Anadir` (estructura) |
| `_adminState.providerHealth` | resultados de Probar | `adminTestProvider`, `adminTestAll` |
| DOM (`#prov-*`) | **proyección** del draft | `adminPoblar()` (solo lee el draft, nunca lo reconstruye) |

Reglas implementadas:

1. `adminSembrarDraft()` = `providerInfo.map(adminClonProvider)` — copia profunda, nunca
   comparte referencias. Se llama en **cada carga válida** (`adminEntrar`, `adminRefresh`)
   y **reemplaza** el draft por el snapshot nuevo.
2. `adminClonProvider()` normaliza: `active` (Worker) → `enabled` (UI), `hasKey`, `extra`,
   e inventa un `id` estable si faltaba.
3. Los inputs escriben en el draft con `oninput` (`adminCambio(i,"model",valor)`), que
   **solo** actualiza ese campo + el label de estado. No hay re-render, así que el blur
   ya no puede revertir nada.
4. `adminPoblar()` renderiza `adminDraft()` (nunca `providerInfo`) y usa
   `adminPintarEstado(i, el)` — una única función de label, reutilizada en render y en edición.
5. `adminLeerProviders()` **eliminado**. Ya no existe ningún mecanismo que sincronice
   estado leyendo el DOM a posteriori; el camino es DOM → draft en el momento de teclear.
6. Guardar = `adminValidarDraft()` + `adminSerializarDraft()` → PUT. Probar =
   `adminProviderConfig(draft[idx])` → POST `/api/provider-test`.
7. `adminMover/Quitar/Anadir` operan sobre `adminDraft().slice()`, así que en frío ya no
   parten de una lista vacía.

---

## 2. Causa de cada bug corregido

| Síntoma | Causa raíz | Corrección |
|---|---|---|
| blur revertía `qwen…` a `llama…` | `adminPoblar()` re-renderizaba desde `pendingProviders` (estado viejo) | inputs → draft, sin re-render (ya estaba mitigado en `db1b1e5`; ahora el dato vive en el draft) |
| **Guardar** volvía a `llama-3.3-70b-versatile` | `adminLeerProviders()` tomaba la **longitud** de `pendingProviders` (que valía `null` → `[]`) y no leía ni un input ⇒ `cfg.providers=[]` | `adminSerializarDraft()` serializa el draft sembrado (4 proveedores reales) |
| El Worker descartaba ese `[]` en silencio | `sanitizeConfig`: `body.providers=[]` es truthy, `sanitizeProvidersArray([])` → `null`, `if(sanitized)` falso ⇒ `cfg.providers` no se asignaba | 4 casos distinguidos: **ausente** (no tocar), **válido** (persistir con warnings), **vacío** (persistir como vacío explícito), **inválido** (error 400 con detalle) |
| KV guardado sin `providers` → `migrateLegacyConfig` resucitaba `DEFAULT_PROVIDERS` | `providers: []` caía al camino legacy | `Array.isArray(cfg.providers)` → el array (incluso vacío) es el formato nuevo y no se rellena con defaults |
| **Probar** no respondía | `db1b1e5` hizo `pendingProviders = adminLeerProviders()` ⇒ `[]` ⇒ `p === undefined` ⇒ "Proveedor no encontrado" **sin llamar a `adminFetch`** | `adminTestProvider/All` leen `adminDraft()` |
| ▲▼ en frío no hacían nada / "+ Añadir" borraba los 4 visibles | mismas funciones partían de `(null || []).slice()` | operan sobre el draft sembrado |
| El toggle de activación no se reflejaba bien | `providerStatus` devuelve `active`, la UI leía `enabled` (undefined) | `adminClonProvider` normaliza ambos |

---

## 3. Worker DEV — `sanitizeProvidersArray` / `sanitizeConfig`

`sanitizeProvidersArray(arr)` ahora devuelve
`{ ok:true, providers, dropped }` o `{ ok:false, error }`. Cada entrada descartada viaja en
`dropped` con `{ index, id, reason, missing? }` (`incompleto`, `id-duplicado`, `sin-id`,
`entrada-no-objeto`, `max-proveedores`). **Nada desaparece sin dejar rastro.**

`sanitizeConfig(body)` devuelve `{ cfg, warnings }` o `{ error, warnings }`:

- `providers` **ausente** → `cfg.providers` sin definir (no se toca).
- **array válido** → `cfg.providers` saneado; `warnings` con lo descartado.
- **array vacío** → `cfg.providers = []` (vacío explícito, se persiste).
- **array inválido** → `{ error }`; si *todas* las entradas eran inválidas, error
  "Ningún proveedor válido en la lista enviada" con el detalle.

PUT `/api/config`: responde `400 {error, warnings}` cuando hay error y
`200 {ok, config, warnings}` en éxito. `adminFetch` (ai.js) propaga `err.details = warnings`
y `err.status`, y `adminGuardar` los muestra en `#admin-msg`.
El frontend además **bloquea** el guardado con el nombre exacto del card incompleto
("Proveedor 2 (Google): falta Modelo") cuando el proveedor está habilitado.

---

## 4. Tests antes / después

- Suite previa (`db1b1e5`): **106/106**, pero con cobertura falsa: `provider-management.test.js`
  reimplementaba el Worker a mano y precargaba `pendingProviders`, así que el arranque en frío
  (el bug real) nunca se ejercitaba.
- Suite nueva contra el `app.js` viejo: **25 fallidos / 92 pasados** (117) — todos en los
  flujos reales de Admin.
- Suite nueva con la corrección: **117/117** (5 archivos).

Cambios de la suite (`tests/provider-management.test.js`, 51 → 62 tests):

1. **Se importan las funciones reales** de `worker/worker.js`
   (`isValidProviderUrl`, `migrateLegacyConfig`, `buildProviders`, `sanitizeProvidersArray`,
   `sanitizeConfig`, `providerStatus`, `MAX_PROVIDERS`, `DEFAULT_PROVIDERS`) — se eliminan las
   copias replicadas. Para poder importarlas se añadieron *named exports* al Worker (sin cambio
   de comportamiento).
2. Se borran los tests de "admin model edit persistence" que simulaban la lógica a mano.
3. Nuevo arnés de Admin: extrae el chunk real de `app.js`, lo ejecuta con un DOM falso y un
   **backend falso que usa el Worker real** (`sanitizeConfig` → "KV" → `providerStatus`).
   Todos los flujos arrancan **en frío** inyectando solo la respuesta GET.
4. Casos exigidos, todos presentes:
   - cargar 4 proveedores → `draft.length === 4`;
   - editar modelo → draft con el modelo editado;
   - blur → draft solo cambia por la edición (nada más del draft se altera);
   - Guardar → payload con los 4 proveedores y el modelo editado;
   - Probar → `providerConfig.model` con el modelo editado;
   - añadir conserva los 4; quitar elimina solo el seleccionado; mover conserva todos y cambia
     solo el orden;
   - refresh reconstruye el draft y descarta ediciones locales;
   - round-trip real con `sanitizeConfig` (editar → Guardar → "reinicio"/nueva sesión);
   - proveedor vacío/incompleto no desaparece en silencio (frontend bloquea + Worker `warnings`);
   - regresión `llama → qwen → blur`;
   - regresión de Probar (en frío sí llama a `/api/provider-test`).
   - extra: `providers: []` es explícito y no resucita defaults; `active` → `enabled`.

---

## 5. Diff conceptual

```
- _adminState.pendingProviders = null      (x5: entrar, cerrar, guardar, restaurar, refresh)
+ _adminState.draft = null                 (solo al cerrar sesión)
+ adminSembrarDraft()                      (en adminEntrar y adminRefresh)

- var providers = _adminState.pendingProviders || (_adminState.providerInfo || [])   [render]
- var providers = adminLeerProviders()                                               [Guardar/Probar]
+ var providers = adminDraft()

- adminCambio(i)        -> reconstruía estado desde el DOM
+ adminCambio(i,campo,valor) -> escribe el campo en el draft + repinta el label

+ adminClonProvider / adminProviderConfig / adminSerializarDraft / adminValidarDraft
+ adminPintarEstado(i, el)  (label único, reutilizado en render y edición)

Worker:
- if (body.providers && Array.isArray(body.providers)) { const s = sanitize...; if (s) cfg.providers = s }
+ cuatro casos explícitos + `warnings` con índice/id/motivo de cada descarte
+ PUT 400 con detalle cuando la lista es inválida o íntegramente ilegible
- migrateLegacyConfig: array con longitud > 0 y primer id string
+ migrateLegacyConfig: Array.isArray(cfg.providers)  ([] = cero proveedores, sin resucitar defaults)
```

---

## 6. Riesgos y decisiones pendientes

1. **PUT es reemplazo total de `ai_config`.** Un cliente que envíe un cuerpo sin `providers`
   borra la lista guardada (vuelven los defaults). Hoy solo lo hace "Restaurar todo", que es lo
   deseado; si en el futuro se añaden PUT parciales, habrá que hacer merge en el Worker.
2. **Proveedor nuevo (+ Añadir) nace `enabled:false` e incompleto**: se guarda sin bloquear y el
   Worker lo descarta con `warning` visible; al refrescar desaparece. Si se prefiere que se
   conserve como borrador, habría que persistir entradas incompletas (hoy el saneado exige
   `url`+`model`+`secretRef`).
3. **Composición IME / autofill**: si un navegador cambia el valor sin disparar `input`, el draft
   no lo vería. Mitigación posible: `change` adicional o flush DOM→draft por índice antes de
   Guardar/Probar.
4. **`service-worker.js` cachea `app.js`** (stale-while-revalidate): en la primera visita tras
   desplegar puede servirse la versión antigua. Conviene subir la versión de caché al publicar.
5. **Probar un proveedor inválido**: se envía igualmente y el error lo devuelve el Worker
   ("URL inválida"), que es justo lo que se quiere ver. No hay validación previa en cliente.
6. Decisión pendiente explícita: ¿debe `providers: []` significar "IA desactivada" (comportamiento
   actual, honesto) o "no tocar" (volver a defaults)? Hoy es lo primero.
