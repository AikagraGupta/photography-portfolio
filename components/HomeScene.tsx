"use client";

import { useEffect, useMemo, useState } from "react";
import InfiniteGallery from "@/components/InfiniteGallery";

type GalleryImage = {
  src: string;
  alt: string;
};

interface HomeSceneProps {
  images: GalleryImage[];
}

const MINIMUM_LOADING_MS = 1200;

function preloadImage(src: string) {
  return new Promise<void>((resolve) => {
    const image = new window.Image();

    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

export default function HomeScene({ images }: HomeSceneProps) {
  const [loadedCount, setLoadedCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const totalImages = images.length;

  useEffect(() => {
    let cancelled = false;
    const start = performance.now();

    async function warmGallery() {
      if (totalImages === 0) {
        setIsReady(true);
        return;
      }

      await Promise.all(
        images.map(async ({ src }) => {
          await preloadImage(src);

          if (!cancelled) {
            setLoadedCount((count) => count + 1);
          }
        })
      );

      const elapsed = performance.now() - start;
      const remaining = Math.max(0, MINIMUM_LOADING_MS - elapsed);

      window.setTimeout(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      }, remaining);
    }

    warmGallery();

    return () => {
      cancelled = true;
    };
  }, [images, totalImages]);

  const progress = useMemo(() => {
    if (totalImages === 0) {
      return 1;
    }

    return Math.min(1, loadedCount / totalImages);
  }, [loadedCount, totalImages]);

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

      <div
        className={`pointer-events-none fixed inset-0 z-30 transition-opacity duration-900 ${
          isReady ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden={isReady}
      >
        <div className="loader-aura loader-aura-left" />
        <div className="loader-aura loader-aura-right" />
        <div className="loader-noise" />

        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <div className="w-full max-w-3xl">
            <p className="font-serif text-4xl tracking-tight text-white md:text-7xl">
              <span className="italic">little hobby :)</span>
            </p>

            <div className="mx-auto mt-8 h-px w-full max-w-md overflow-hidden rounded-full bg-white/10">
              <div
                className="loader-progress h-full rounded-full bg-white/80"
                style={{ transform: `scaleX(${progress})` }}
              />
            </div>
          </div>
        </div>
      </div>

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
