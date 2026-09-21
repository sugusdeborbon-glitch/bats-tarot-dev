@echo off
REM ============================================================
REM  DEPLOY DEV — Guardrail de seguridad
REM  USO: deploy-dev.bat
REM  Solo despliega al Worker DEV (bats-tarot-ai-dev).
REM  NUNCA deploya a PRO desde este repositorio.
REM ============================================================

echo [GUARDRAIL] Verificando entorno...

REM Verificar que estamos en el repositorio DEV
if not exist "..\AGENTS.md" (
    echo [ERROR] No se detecto el repositorio BATS.
    exit /b 1
)

REM Verificar que existe wrangler.dev.toml
if not exist "wrangler.dev.toml" (
    echo [ERROR] No se encontro wrangler.dev.toml. Abortando.
    exit /b 1
)

REM Verificar que NO existe wrangler.toml (proteccion contra deploy accidental PRO)
if exist "wrangler.toml" (
    echo [ERROR] Se encontro wrangler.toml (config PRO). Esto NO deberia existir en DEV.
    echo [ERROR] Abortando para prevenir deploy accidental a PRO.
    exit /b 1
)

echo [GUARDRAIL] Configuracion DEV detectada: wrangler.dev.toml
echo [GUARDRAIL] Desplegando a bats-tarot-ai-dev...

npx wrangler deploy --config wrangler.dev.toml

if %ERRORLEVEL% EQU 0 (
    echo [OK] Deploy completado exitosamente a DEV.
) else (
    echo [ERROR] Deploy fallo con codigo %ERRORLEVEL%.
)
