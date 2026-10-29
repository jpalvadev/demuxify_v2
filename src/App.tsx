import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { SourceMixDropzone } from './components/SourceMixDropzone';
import { FallbackAdvisory } from './components/FallbackAdvisory';
import { detectWebGPUCapability, WebGPUCapability } from './lib/webgpu';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [capability, setCapability] = useState<WebGPUCapability | null>(null);
  const [isDetectingWebGPU, setIsDetectingWebGPU] = useState(true);
  const [selectedSourceMix, setSelectedSourceMix] = useState<File | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function probeCapability() {
      try {
        const result = await detectWebGPUCapability();
        if (isMounted) {
          setCapability(result);
        }
      } catch (err) {
        if (isMounted) {
          setCapability({
            supported: false,
            isFallback: true,
            errorReason: `WebGPU detection failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      } finally {
        if (isMounted) {
          setIsDetectingWebGPU(false);
        }
      }
    }

    probeCapability();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSourceMixSelected = (file: File) => {
    setSelectedSourceMix(file);
  };

  const handleClearSourceMix = () => {
    setSelectedSourceMix(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      <Header
        capability={capability}
        isDetectingWebGPU={isDetectingWebGPU}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 flex flex-col gap-8">
        {capability?.isFallback && (
          <FallbackAdvisory capability={capability} />
        )}

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Separate Music Into Stems
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Extract Vocals, Drums, Bass, and Other instruments locally in your browser using Demucs v4.
            </p>
          </div>

          <SourceMixDropzone
            onSourceMixSelected={handleSourceMixSelected}
            selectedFile={selectedSourceMix}
            onClearFile={handleClearSourceMix}
          />
        </section>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        <p>Demuxify Web • 100% Client-Side Audio Source Separation • Powered by Demucs v4 &amp; WebGPU</p>
      </footer>
    </div>
  );
};

export default App;
