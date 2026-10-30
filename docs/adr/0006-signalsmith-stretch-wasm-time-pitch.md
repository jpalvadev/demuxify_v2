# Sustitución de WSOLA por Signalsmith Stretch WASM para Time-Stretch y Pitch-Shifting

Decidimos migrar el motor de Time-Stretch y Pitch-Shifting del Stem Player y la exportación de mezclas desde la implementación manual de WSOLA en TypeScript hacia **Signalsmith Stretch** compilado a WebAssembly (WASM) en AudioWorklet, implementando 4 instancias estéreo sincronizadas con compensación de formantes específica para el stem de Vocals y controles discretos cuantizados (1 semitono para pitch y 0.25x para tempo).

## Contexto y Alternativas

La solución previa basada en WSOLA (ADR 0002) operaba en el dominio del tiempo; aunque era adecuada para transientes percusivos, generaba distorsión armónica, efecto de chorus y pérdida de fase en material polifónico complejo (especialmente Vocals y Guitarras/Otros).

Se evaluaron las siguientes alternativas:

1. **Rubber Band Library**: Estándar en DAWs profesionales, pero descartado debido a su licencia GPLv3 / comercial restrictiva incompatible con la distribución web abierta del proyecto.
2. **Modelos neuronales (AI resynthesis)**: Descartados por requerir latencia computacional prohibitiva en tiempo real y riesgos de desfase de fase entre stems.
3. **Signalsmith Stretch (WASM)**: Algoritmo DSP de última generación en el dominio de frecuencia con licencia MIT. Preserva transientes sin artefactos de fase, añade compensación nativa de formantes para evitar voces no naturales ("ardilla" o "monstruo"), y corre con latencia despreciable dentro de Web Audio.

## Consecuencias y Diseño

- **Canales e instancias**: Se configuran 4 nodos estéreo desacoplados (uno por stem: Vocals, Drums, Bass, Other). Esto permite activar la compensación de formantes (`formantCompensation: true`) exclusivamente en Vocals sin distorsionar los transientes ni malgastar CPU en Drums y Bass.
- **Cuantización de pasos**: Los controles de UI y el motor de audio se restringen estrictamente a pasos discretos: semitonos enteros en pitch (-12 a +12 st) y múltiplos de 0.25x en tempo (0.50x a 2.00x).
- **Exportación offline**: `ExportDialog` incorpora un selector para elegir entre exportar al tono/tempo procesado actual o al estado original, renderizado a máxima velocidad mediante `OfflineAudioContext`.
- **Compatibilidad**: Se mantiene un adaptador con detección de capacidades WASM/AudioWorklet y fallback de emulación para asegurar la ejecución limpia de la suite de pruebas automatizadas (Vitest / JSDOM).
