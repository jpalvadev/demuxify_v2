# PWA con WebGPU y ONNX Runtime Web Worker

Decidimos implementar Demuxify como una Progressive Web App (PWA) client-side ejecutando el modelo HTDemucs v4 sobre ONNX Runtime Web con backend WebGPU dentro de un Web Worker, en lugar de una app nativa Android o un backend servidor.

## Contexto y Alternativas
Se evaluó desarrollar una app nativa en Android o implementar inferencia con Rust/WASM o WebGL. WebGL carece de compute shaders nativos para tensores profundos, y Rust/WASM enfrentaría la misma limitación en el compilado a GPU. ONNX Runtime Web cuenta con kernels WGSL optimizados por Microsoft y soporte de precisión FP16 directamente sobre Vulkan/Metal/DirectX 12. La arquitectura PWA permite distribución universal (móvil y escritorio) sin necesidad de infraestructura de servidores ni empaquetado por tiendas propietarias.

