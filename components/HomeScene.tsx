"use client";

import { useCallback, useEffect, useState } from "react";
import InfiniteGallery, { type GalleryLoadState } from "@/components/InfiniteGallery";

type GalleryImage = {
  src: string;
  alt: string;
};

interface HomeSceneProps {
  images: GalleryImage[];
}

const LOADER_MIN_VISIBLE_MS = 700;
const LOADER_FADE_MS = 800;

function GalleryLoadingOverlay({
  progress,
  isLeaving,
}: {
  progress: number;
  isLeaving: boolean;
}) {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-30 transition-opacity duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isLeaving ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden={isLeaving}
    >
      <div className="loader-screen" />
      <div className="loader-aura loader-aura-left" />
      <div className="loader-aura loader-aura-right" />
      <div className="loader-noise" />

      <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
        <div className="w-full max-w-3xl">
          <p className="mb-5 font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">
            little hobby :)
          </p>

          <p className="font-serif text-4xl tracking-tight text-white md:text-7xl">
            <span className="italic">I create;</span> therefore I am
          </p>

          <div className="mx-auto mt-8 h-px w-full max-w-md overflow-hidden rounded-full bg-white/12">
            <div
              className="loader-progress h-full rounded-full"
              style={{ transform: `scaleX(${clampedProgress / 100})` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomeScene({ images }: HomeSceneProps) {
  const hasImages = images.length > 0;
  const [loadState, setLoadState] = useState<GalleryLoadState>({
    ready: !hasImages,
    starterLoaded: 0,
    starterTotal: 0,
    totalLoaded: 0,
    total: images.length,
  });
  const [isVisible, setIsVisible] = useState(hasImages);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleLoadStateChange = useCallback((nextState: GalleryLoadState) => {
    setLoadState(nextState);
  }, []);

  useEffect(() => {
    if (!isVisible || !loadState.ready) {
      return undefined;
    }

    const fadeTimer = window.setTimeout(() => {
      setIsLeaving(true);
    }, LOADER_MIN_VISIBLE_MS);

    const removeTimer = window.setTimeout(() => {
      setIsVisible(false);
    }, LOADER_MIN_VISIBLE_MS + LOADER_FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [isVisible, loadState.ready]);

  const progress = loadState.starterTotal
    ? (loadState.starterLoaded / loadState.starterTotal) * 100
    : 100;

  return (
    <>
      <InfiniteGallery
        images={images}
        speed={1.2}
        zSpacing={3}
        visibleCount={12}
        falloff={{ near: 0.8, far: 14 }}
        className="h-screen w-full overflow-hidden"
        onLoadStateChange={handleLoadStateChange}
      />

      {isVisible ? <GalleryLoadingOverlay progress={progress} isLeaving={isLeaving} /> : null}

      <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center px-3 text-center text-white mix-blend-exclusion">
        <div className="max-w-5xl">
          <p className="mb-5 font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">
            little hobby :)
          </p>

          <h1 className="font-serif text-4xl tracking-tight md:text-7xl">
            <span className="italic">I create;</span> therefore I am
          </h1>
        </div>
      </div>
    </>
  );
}
