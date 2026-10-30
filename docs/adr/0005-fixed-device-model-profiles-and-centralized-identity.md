# Estrategia de Perfiles de Modelo Híbrida (Fijo en Móvil, Seleccionable en PC) e Identidad Centralizada

Decidimos establecer una política de perfiles de modelo diferenciada por dispositivo:

1. **En dispositivos móviles (smartphones/tablets):** El modelo queda fijo en **MDX-Net 4-Stem (~45 MB)** para garantizar estabilidad y evitar cierres abruptos por Out-Of-Memory (OOM).
2. **En equipos de escritorio (PC/Laptop):** El modelo predeterminado es **BS-RoFormer 4-Stem (~270 MB)** por su máxima fidelidad acústica, pero se habilita un selector en la interfaz para que el usuario pueda alternar libremente a MDX-Net (Modo Rápido / Bajo Consumo).

Se informa explícitamente en la interfaz qué modelo está activo y el motivo de la configuración. Además, para eliminar cadenas mágicas dispersas, toda la identidad, descripciones, rutas y parámetros de ejecución se centralizan en `src/lib/modelConfig.ts`.

## Contexto y Alternativas

Permitir que un smartphone cargue libremente BS-RoFormer genera bloqueos críticos de GPU y fallos de asignación en el heap de WASM. Al mismo tiempo, restringir a los usuarios de PC al modelo pesado sin opción de cambio impedía a usuarios con GPUs modestas o sin WebGPU acelerar sus separaciones. La solución híbrida protege la estabilidad en mobile y maximiza la flexibilidad en desktop.
