/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="@webgpu/types" />

declare module "signalsmith-stretch" {
  const SignalsmithStretch: (
    audioContext: AudioContext | OfflineAudioContext,
    options?: any
  ) => Promise<any>;
  export default SignalsmithStretch;
}
