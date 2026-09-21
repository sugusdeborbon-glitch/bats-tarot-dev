# BATS Tarot — Contexto del proyecto

## Descripción
Business Ashram Tarot System - App de tarot PWA + Android APK.
Tiradas: Cruz Diaria, Relación, BATS Laboral, Personalizada, El Aprendizaje, El Arcano Visitante.
78 cartas con significados BATS en español + sistema de Comodín con extensión.

## Stack
- HTML5 + CSS3 + JS vanilla (sin frameworks)
- PWA: manifest.json + service-worker.js
- Android: Capacitor 8.x (proyecto en android/)
- Hosting: GitHub Pages

## Versión actual
- **v1.10.0** (2026-09-10)
- APK: `bats-tarot.apk` (~15.7 MB debug)

## Estructura
- `index.html` — entrada principal (HTML semántico)
- `style.css` — estilos con animaciones
- `app.js` — lógica de la app (renderizado DOM, seguridad XSS blindada)
- `ai.js` — integración con proveedores IA (OpenAI, Groq, NVIDIA, etc.)
- `datos_bats.js` — significados de las 78 cartas
- `quintaesencia_bats.js` — textos de quintaesencia
- `manifest.json` — config PWA
- `service-worker.js` — caché stale-while-revalidate
- `offline.html` — fallback sin conexión
- `version.json` — versión y fecha actual
- `android/` — proyecto Android nativo (Capacitor)
- `www/` — assets sincronizados para el APK
- `cartas/` — 78 imágenes JPG de cartas

## Repositorio
- GitHub: sugusdeborbon-glitch/bats-tarot
- URL: https://sugusdeborbon-glitch.github.io/bats-tarot/
- Rama principal: master
- **CRÍTICO: GitHub Pages deploya desde la rama `dev`, NO `master`**
  - Siempre hacer `git checkout dev; git merge master --no-edit; git push origin dev` después de push a master
- Último tag: v1.0.0

## Comandos útiles
```bash
# Generar APK
cd android && ./gradlew assembleDebug

# Sincronizar web → Android
npx cap sync

# Desplegar Worker DEV (NUNCA usar "wrangler deploy" sin --config)
cd worker && deploy-dev.bat
# O manualmente:
cd worker && npx wrangler deploy --config wrangler.dev.toml

# Publicar frontend DEV
git add -A && git commit -m "mensaje" && git push origin master

# Versionar
git tag -a v1.x.x -m "mensaje" && git push origin v1.x.x
```

## SEGURIDAD — DEPLOY
- **NUNCA ejecutar `wrangler deploy` sin `--config wrangler.dev.toml` desde este repositorio**
- `wrangler.toml` NO existe en DEV (fue renombrado a `wrangler.prod.toml` como protección)
- Si `wrangler.toml` aparece, NO deployar — contactar a Gus
- Este repositorio despliega SOLO a `bats-tarot-ai-dev` (Worker DEV)
- PRO (`bats-tarot-ai`) se despliega SOLO desde el repositorio PRO

## Próximas mejoras pendientes
- [ ] (pendiente de definir con el usuario)
