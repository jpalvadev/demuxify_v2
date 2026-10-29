# Persistencia en IndexedDB, Exportación Dual y UI con ShadCN

Decidimos estructurar la interfaz de usuario con ShadCN UI (Tailwind CSS + Radix UI), almacenar la sesión activa y los stems en IndexedDB / OPFS, soportar exportación en WAV y MP3 (con bitrate seleccionable de 128 a 320 kbps vía worker con LameJS) de manera individual o en ZIP, e incorporar una forma de onda maestra interactiva para navegación y scrubbing junto a las formas de onda individuales por stem.

## Contexto y Alternativas
La pérdida de datos por recargas accidentales en navegadores móviles requiere almacenamiento local de buffers de audio. Para la interfaz, ShadCN proporciona componentes accesibles, modulares y de alto rendimiento táctil para móvil y desktop. La exportación a MP3 se aísla en un worker para no congelar la UI durante la compresión.

