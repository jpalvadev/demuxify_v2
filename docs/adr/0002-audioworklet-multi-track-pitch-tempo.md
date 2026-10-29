# Motor de Audio Multi-Pista con AudioWorklet y WSOLA

Decidimos implementar la reproducción sincronizada de los 4 stems utilizando la Web Audio API junto con un AudioWorklet basado en WSOLA (Waveform Similarity Overlap-Add) para control independiente de pitch (-12 a +12 semitonos) y tempo (0.5x a 2.0x).

## Contexto y Alternativas
El `playbackRate` nativo de HTML5 altera conjuntamente velocidad y tono (efecto cinta/vinilo). Se evaluó Tone.js, pero introduciría una capa de abstracción pesada e innecesaria. Un AudioWorklet dedicado que procese los 4 canales en paralelo asegura sincronización de fase precisa entre Voz, Batería, Bajo y Otros sin riesgo de desfase temporal por recolección de basura (*garbage collection*).

