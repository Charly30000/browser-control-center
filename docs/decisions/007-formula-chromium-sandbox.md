# ADR 007 — Fórmulas en proceso Chromium desechable

Las fórmulas se ejecutan en un `BrowserServer` headless dedicado por ejecución. Ante timeout se mata el proceso. Se eligió este límite porque un bucle infinito no puede interrumpirse de forma fiable dentro del mismo hilo del Extension Host y `eval`, `new Function` o `node:vm` no ofrecen el aislamiento exigido.
