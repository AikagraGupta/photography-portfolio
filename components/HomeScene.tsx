"use client";

import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import InfiniteGallery from "@/components/InfiniteGallery";

type GalleryImage = {
  src: string;
  alt: string;
};

interface HomeSceneProps {
  images: GalleryImage[];
}

const LOADER_MIN_VISIBLE_MS = 900;
const LOADER_FADE_MS = 900;

function GalleryLoadingOverlay() {
  const { active, progress, total } = useProgress((state) => ({
    active: state.active,
    progress: state.progress,
    total: state.total,
  }));
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const hasStartedRef = useRef(false);
  const visibleSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    hasStartedRef.current = true;
    visibleSinceRef.current ??= performance.now();
    setIsVisible(true);
    setIsLeaving(false);
  }, [active]);

  useEffect(() => {
    if (!hasStartedRef.current) {
      const hideImmediately = window.setTimeout(() => {
        if (!active && total === 0) {
          setIsVisible(false);
        }
      }, 120);

      return () => window.clearTimeout(hideImmediately);
    }

    if (active || progress < 100) {
      return;
    }

    const startedAt = visibleSinceRef.current ?? performance.now();
    const elapsed = performance.now() - startedAt;
    const remaining = Math.max(0, LOADER_MIN_VISIBLE_MS - elapsed);
    let removeTimer: number | undefined;
    const fadeTimer = window.setTimeout(() => {
      setIsLeaving(true);

      removeTimer = window.setTimeout(() => {
        setIsVisible(false);
      }, LOADER_FADE_MS);
    }, remaining);

    return () => {
      window.clearTimeout(fadeTimer);
      if (removeTimer) {
        window.clearTimeout(removeTimer);
      }
    };
  }, [active, progress, total]);

  if (!isVisible) {
    return null;
  }

  const clampedProgress = Math.max(0, Math.min(100, progress || 0));

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-30 transition-opacity duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
          <p className="font-serif text-4xl tracking-tight text-white md:text-7xl">
            <span className="italic">little hobby :)</span>
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
  return (
    <>
      <InfiniteGallery
        images={images}
        speed={1.2}
        zSpacing={3}
        visibleCount={12}
        falloff={{ near: 0.8, far: 14 }}
        className="h-screen w-full overflow-hidden"
      />

      <GalleryLoadingOverlay />

      <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center px-3 text-center text-white mix-blend-exclusion">
        <div className="max-w-5xl">
          <h1 className="font-serif text-4xl tracking-tight md:text-7xl">
            <span className="italic">little hobby :)</span>
          </h1>
        </div>
      </div>
    </>
  );
}
