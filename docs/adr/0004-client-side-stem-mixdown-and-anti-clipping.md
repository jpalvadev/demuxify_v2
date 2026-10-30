# Exportación de Custom Mixdown y Normalización Anti-Clipping en Cliente

Decidimos implementar la exportación de mezclas personalizadas (**Custom Mixdown**) sumando los stems seleccionados (`Float32Array[]`) directamente en memoria en el cliente con normalización de picos inteligente (\(-0.3\text{ dBFS}\)) y preservando la fidelidad original sin time-stretch.

## Contexto y Alternativas

Demuxify permitía exportar stems individuales (`Single Stem`) o todos los stems en un archivo ZIP (`Export Bundle`) a nivel nominal. Para casos de uso como pistas de acompañamiento (backing tracks), karaoke (eliminar voces) o aislar sección rítmica (bajo + batería), los usuarios necesitaban combinar selectivamente stems con volúmenes arbitrarios en un único archivo WAV o MP3.

Se evaluaron dos enfoques para la suma:

1. **Suma offline en Web Audio API (OfflineAudioContext)**: Requiere instanciar nodos Web Audio en el hilo principal o worklets, añadiendo sobrecarga de creación de contexto y posibles diferencias de sample rate.
2. **Suma directa en Float32Array multicanal**: Procesamiento aritmético puro en JavaScript (`out[ch][i] += stem[ch][i] * gain`), sumando vectores y analizando el pico máximo absoluto.

Se eligió la suma directa en memoria por ser determinista, sincrónica, de latencia cero y libre de dependencias de Web Audio. Si la suma combinada excede \(-0.3\text{ dBFS}\) (\(\approx 0.966\)), se aplica un escalado de ganancia lineal automático que previene el _clipping_ digital antes de enviar los búferes al encoder (WAV o worker MP3).
