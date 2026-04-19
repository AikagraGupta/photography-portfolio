"use client";

import type React from "react";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type ImageItem = string | { src: string; alt?: string };

interface FadeSettings {
  fadeIn: {
    start: number;
    end: number;
  };
  fadeOut: {
    start: number;
    end: number;
  };
}

interface BlurSettings {
  blurIn: {
    start: number;
    end: number;
  };
  blurOut: {
    start: number;
    end: number;
  };
  maxBlur: number;
}

export interface GalleryLoadState {
  ready: boolean;
  starterLoaded: number;
  starterTotal: number;
  totalLoaded: number;
  total: number;
}

interface InfiniteGalleryProps {
  images: ImageItem[];
  speed?: number;
  zSpacing?: number;
  visibleCount?: number;
  falloff?: { near: number; far: number };
  fadeSettings?: FadeSettings;
  blurSettings?: BlurSettings;
  className?: string;
  style?: React.CSSProperties;
  onLoadStateChange?: (state: GalleryLoadState) => void;
}

interface PlaneData {
  index: number;
  z: number;
  imageIndex: number;
  x: number;
  y: number;
}

type LoadedTextureMap = Record<number, THREE.Texture>;

const DEFAULT_DEPTH_RANGE = 50;
const MAX_HORIZONTAL_OFFSET = 8;
const MAX_VERTICAL_OFFSET = 8;
const BASE_PLANE_SIZE = 2;
const STARTER_CONCURRENCY = 3;
const BACKGROUND_CONCURRENCY = 2;

function createClothMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    toneMapped: false,
    uniforms: {
      map: { value: null },
      opacity: { value: 0.0 },
      blurAmount: { value: 0.0 },
      scrollForce: { value: 0.0 },
      time: { value: 0.0 },
      isHovered: { value: 0.0 },
    },
    vertexShader: `
      uniform float scrollForce;
      uniform float time;
      uniform float isHovered;
      varying vec2 vUv;

      void main() {
        vUv = uv;

        vec3 pos = position;
        float curveIntensity = scrollForce * 0.3;
        float distanceFromCenter = length(pos.xy);
        float curve = distanceFromCenter * distanceFromCenter * curveIntensity;

        float ripple1 = sin(pos.x * 2.0 + scrollForce * 3.0) * 0.02;
        float ripple2 = sin(pos.y * 2.5 + scrollForce * 2.0) * 0.015;
        float clothEffect = (ripple1 + ripple2) * abs(curveIntensity) * 2.0;

        float flagWave = 0.0;
        if (isHovered > 0.5) {
          float wavePhase = pos.x * 3.0 + time * 8.0;
          float waveAmplitude = sin(wavePhase) * 0.1;
          float dampening = smoothstep(-0.5, 0.5, pos.x);
          flagWave = waveAmplitude * dampening;
          float secondaryWave = sin(pos.x * 5.0 + time * 12.0) * 0.03 * dampening;
          flagWave += secondaryWave;
        }

        pos.z -= curve + clothEffect + flagWave;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float opacity;
      uniform float blurAmount;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(map, vUv);

        if (blurAmount > 0.0) {
          vec2 texelSize = 1.0 / vec2(textureSize(map, 0));
          vec4 blurred = vec4(0.0);
          float total = 0.0;

          for (float x = -2.0; x <= 2.0; x += 1.0) {
            for (float y = -2.0; y <= 2.0; y += 1.0) {
              vec2 offset = vec2(x, y) * texelSize * blurAmount;
              float weight = 1.0 / (1.0 + length(vec2(x, y)));
              blurred += texture2D(map, vUv + offset) * weight;
              total += weight;
            }
          }

          color = blurred / total;
        }
        gl_FragColor = vec4(color.rgb, color.a * opacity);
      }
    `,
  });
}

function getTextureScale(texture: THREE.Texture): [number, number, number] {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const aspect =
    image?.width && image?.height ? image.width / image.height : 1;

  return aspect > 1
    ? [BASE_PLANE_SIZE * aspect, BASE_PLANE_SIZE, 1]
    : [BASE_PLANE_SIZE, BASE_PLANE_SIZE / aspect, 1];
}

function getOpacity(normalizedPosition: number, fadeSettings: FadeSettings) {
  if (
    normalizedPosition >= fadeSettings.fadeIn.start &&
    normalizedPosition <= fadeSettings.fadeIn.end
  ) {
    return (
      (normalizedPosition - fadeSettings.fadeIn.start) /
      (fadeSettings.fadeIn.end - fadeSettings.fadeIn.start)
    );
  }

  if (normalizedPosition < fadeSettings.fadeIn.start) {
    return 0;
  }

  if (
    normalizedPosition >= fadeSettings.fadeOut.start &&
    normalizedPosition <= fadeSettings.fadeOut.end
  ) {
    return (
      1 -
      (normalizedPosition - fadeSettings.fadeOut.start) /
        (fadeSettings.fadeOut.end - fadeSettings.fadeOut.start)
    );
  }

  if (normalizedPosition > fadeSettings.fadeOut.end) {
    return 0;
  }

  return 1;
}

function getBlur(normalizedPosition: number, blurSettings: BlurSettings) {
  if (
    normalizedPosition >= blurSettings.blurIn.start &&
    normalizedPosition <= blurSettings.blurIn.end
  ) {
    return (
      blurSettings.maxBlur *
      (1 -
        (normalizedPosition - blurSettings.blurIn.start) /
          (blurSettings.blurIn.end - blurSettings.blurIn.start))
    );
  }

  if (normalizedPosition < blurSettings.blurIn.start) {
    return blurSettings.maxBlur;
  }

  if (
    normalizedPosition >= blurSettings.blurOut.start &&
    normalizedPosition <= blurSettings.blurOut.end
  ) {
    return (
      blurSettings.maxBlur *
      ((normalizedPosition - blurSettings.blurOut.start) /
        (blurSettings.blurOut.end - blurSettings.blurOut.start))
    );
  }

  if (normalizedPosition > blurSettings.blurOut.end) {
    return blurSettings.maxBlur;
  }

  return 0;
}

function FallbackGallery({ images }: { images: ImageItem[] }) {
  const normalizedImages = useMemo(
    () =>
      images.map((image) =>
        typeof image === "string" ? { src: image, alt: "" } : image
      ),
    [images]
  );

  return (
    <div className="flex h-full flex-col items-center justify-center bg-neutral-950 px-4 py-10">
      <p className="mb-6 text-sm uppercase tracking-[0.35em] text-white/50">
        WebGL unavailable
      </p>
      <div className="grid max-h-[28rem] grid-cols-2 gap-4 overflow-y-auto md:grid-cols-3">
        {normalizedImages.map((image, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={image.src}
            src={image.src || "/placeholder.svg"}
            alt={image.alt || `Gallery image ${index + 1}`}
            className="h-32 w-full rounded object-cover"
          />
        ))}
      </div>
    </div>
  );
}

function GalleryScene({
  images,
  textures,
  starterReady,
  speed = 1,
  visibleCount = 8,
  fadeSettings = {
    fadeIn: { start: 0.05, end: 0.15 },
    fadeOut: { start: 0.85, end: 0.95 },
  },
  blurSettings = {
    blurIn: { start: 0.0, end: 0.1 },
    blurOut: { start: 0.9, end: 1.0 },
    maxBlur: 3.0,
  },
}: Omit<InfiniteGalleryProps, "className" | "style" | "onLoadStateChange"> & {
  textures: LoadedTextureMap;
  starterReady: boolean;
}) {
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);
  const revealProgressRef = useRef<number[]>(Array.from({ length: visibleCount }, () => 0));
  const displayedTextureIndexRef = useRef<number[]>(
    Array.from({ length: visibleCount }, () => -1)
  );
  const pointerTrackingRef = useRef({ active: false, lastY: 0 });
  const scrollVelocityRef = useRef(0);
  const autoPlayRef = useRef(true);
  const lastInteractionRef = useRef(0);
  const { gl } = useThree();
  const maxAnisotropy = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);

  const normalizedImages = useMemo(
    () =>
      images.map((image) =>
        typeof image === "string" ? { src: image, alt: "" } : image
      ),
    [images]
  );

  const materials = useMemo(
    () => Array.from({ length: visibleCount }, () => createClothMaterial()),
    [visibleCount]
  );

  const spatialPositions = useMemo(() => {
    const positions: { x: number; y: number }[] = [];

    for (let index = 0; index < visibleCount; index += 1) {
      const horizontalAngle = (index * 2.618) % (Math.PI * 2);
      const verticalAngle = (index * 1.618 + Math.PI / 3) % (Math.PI * 2);
      const horizontalRadius = (index % 3) * 1.2;
      const verticalRadius = ((index + 1) % 4) * 0.8;

      positions.push({
        x: (Math.sin(horizontalAngle) * horizontalRadius * MAX_HORIZONTAL_OFFSET) / 3,
        y: (Math.cos(verticalAngle) * verticalRadius * MAX_VERTICAL_OFFSET) / 4,
      });
    }

    return positions;
  }, [visibleCount]);

  const totalImages = normalizedImages.length;
  const depthRange = DEFAULT_DEPTH_RANGE;
  const initialPlanes = useMemo(
    () =>
      Array.from({ length: visibleCount }, (_, index) => ({
        index,
        z:
          visibleCount > 0
            ? ((depthRange / Math.max(visibleCount, 1)) * index) % depthRange
            : 0,
        imageIndex: totalImages > 0 ? index % totalImages : 0,
        x: spatialPositions[index]?.x ?? 0,
        y: spatialPositions[index]?.y ?? 0,
      })),
    [depthRange, spatialPositions, totalImages, visibleCount]
  );
  const planesDataRef = useRef<PlaneData[]>(initialPlanes);
  const firstLoadedIndex = useMemo(() => {
    let smallestIndex = Number.POSITIVE_INFINITY;

    Object.keys(textures).forEach((key) => {
      const numericKey = Number(key);

      if (Number.isFinite(numericKey) && numericKey < smallestIndex) {
        smallestIndex = numericKey;
      }
    });

    return Number.isFinite(smallestIndex) ? smallestIndex : -1;
  }, [textures]);

  useEffect(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  useEffect(() => {
    planesDataRef.current = initialPlanes;
    revealProgressRef.current = Array.from({ length: visibleCount }, () => 0);
    displayedTextureIndexRef.current = Array.from({ length: visibleCount }, () => -1);
  }, [initialPlanes, visibleCount]);

  useEffect(
    () => () => {
      materials.forEach((material) => material.dispose());
    },
    [materials]
  );

  const registerInteraction = useCallback((delta: number) => {
    scrollVelocityRef.current += delta;
    autoPlayRef.current = false;
    lastInteractionRef.current = Date.now();
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      registerInteraction(event.deltaY * 0.01 * speed);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        registerInteraction(-2 * speed);
      }

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        registerInteraction(2 * speed);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      pointerTrackingRef.current = {
        active: true,
        lastY: event.clientY,
      };
      autoPlayRef.current = false;
      lastInteractionRef.current = Date.now();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerTrackingRef.current.active) {
        return;
      }

      const deltaY = pointerTrackingRef.current.lastY - event.clientY;
      pointerTrackingRef.current.lastY = event.clientY;
      registerInteraction(deltaY * 0.04 * speed);
    };

    const handlePointerUp = () => {
      pointerTrackingRef.current.active = false;
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [gl, registerInteraction, speed]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (Date.now() - lastInteractionRef.current > 3000) {
        autoPlayRef.current = true;
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useFrame((state, delta) => {
    if (autoPlayRef.current && starterReady) {
      scrollVelocityRef.current += 0.3 * delta;
    }

    scrollVelocityRef.current *= 0.95;

    const scrollVelocity = scrollVelocityRef.current;
    const time = state.clock.getElapsedTime();
    const imageAdvance =
      totalImages > 0 ? visibleCount % totalImages || totalImages : 0;
    planesDataRef.current.forEach((plane, index) => {
      const mesh = meshRefs.current[index];
      const material = materials[index];

      if (!mesh || !material) {
        return;
      }

      let newZ = plane.z + scrollVelocity * delta * 10;
      let wrapsForward = 0;
      let wrapsBackward = 0;

      if (newZ >= depthRange) {
        wrapsForward = Math.floor(newZ / depthRange);
        newZ -= depthRange * wrapsForward;
      } else if (newZ < 0) {
        wrapsBackward = Math.ceil(-newZ / depthRange);
        newZ += depthRange * wrapsBackward;
      }

      if (wrapsForward > 0 && imageAdvance > 0 && totalImages > 0) {
        plane.imageIndex = (plane.imageIndex + wrapsForward * imageAdvance) % totalImages;
      }

      if (wrapsBackward > 0 && imageAdvance > 0 && totalImages > 0) {
        const nextIndex = plane.imageIndex - wrapsBackward * imageAdvance;
        plane.imageIndex = ((nextIndex % totalImages) + totalImages) % totalImages;
      }

      plane.z = ((newZ % depthRange) + depthRange) % depthRange;
      plane.x = spatialPositions[index]?.x ?? 0;
      plane.y = spatialPositions[index]?.y ?? 0;

      const desiredIndex = plane.imageIndex;
      const desiredTexture = textures[desiredIndex];
      const currentTextureIndex = displayedTextureIndexRef.current[index];
      const currentTexture =
        currentTextureIndex >= 0 ? textures[currentTextureIndex] : null;

      if (desiredTexture && currentTextureIndex !== desiredIndex) {
        desiredTexture.colorSpace = THREE.SRGBColorSpace;
        desiredTexture.anisotropy = maxAnisotropy;
        desiredTexture.needsUpdate = true;
        material.uniforms.map.value = desiredTexture;
        mesh.scale.set(...getTextureScale(desiredTexture));
        displayedTextureIndexRef.current[index] = desiredIndex;
        revealProgressRef.current[index] = 0;
      } else if (!currentTexture && firstLoadedIndex >= 0 && textures[firstLoadedIndex]) {
        const fallbackTexture = textures[firstLoadedIndex];

        if (fallbackTexture) {
          fallbackTexture.colorSpace = THREE.SRGBColorSpace;
          fallbackTexture.anisotropy = maxAnisotropy;
          fallbackTexture.needsUpdate = true;
          material.uniforms.map.value = fallbackTexture;
          mesh.scale.set(...getTextureScale(fallbackTexture));
          displayedTextureIndexRef.current[index] = firstLoadedIndex;
          revealProgressRef.current[index] = 0;
        }
      }

      revealProgressRef.current[index] = Math.min(
        1,
        revealProgressRef.current[index] + delta * 2.5
      );

      const normalizedPosition = plane.z / depthRange;
      const depthOpacity = Math.max(
        0,
        Math.min(1, getOpacity(normalizedPosition, fadeSettings))
      );
      const blur = Math.max(
        0,
        Math.min(blurSettings.maxBlur, getBlur(normalizedPosition, blurSettings))
      );
      const revealOpacity =
        displayedTextureIndexRef.current[index] >= 0 ? revealProgressRef.current[index] : 0;

      material.uniforms.time.value = time;
      material.uniforms.scrollForce.value = scrollVelocity;
      material.uniforms.opacity.value = depthOpacity * revealOpacity;
      material.uniforms.blurAmount.value = blur;

      const worldZ = plane.z - depthRange / 2;
      mesh.position.set(plane.x, plane.y, worldZ);
    });
  });

  if (normalizedImages.length === 0) {
    return null;
  }

  return (
    <>
      {initialPlanes.map((plane, index) => (
        <mesh
          key={plane.index}
          ref={(node) => {
            meshRefs.current[index] = node;
          }}
          position={[plane.x, plane.y, plane.z - depthRange / 2]}
          scale={[BASE_PLANE_SIZE, BASE_PLANE_SIZE * 1.25, 1]}
          material={materials[index]}
          onPointerEnter={() => {
            materials[index].uniforms.isHovered.value = 1.0;
          }}
          onPointerLeave={() => {
            materials[index].uniforms.isHovered.value = 0.0;
          }}
        >
          <planeGeometry args={[1, 1, 32, 32]} />
        </mesh>
      ))}
    </>
  );
}

export default function InfiniteGallery({
  images,
  className = "h-96 w-full",
  style,
  speed = 1,
  zSpacing = 3,
  visibleCount = 8,
  fadeSettings = {
    fadeIn: { start: 0.05, end: 0.25 },
    fadeOut: { start: 0.4, end: 0.43 },
  },
  blurSettings = {
    blurIn: { start: 0.0, end: 0.1 },
    blurOut: { start: 0.4, end: 0.43 },
    maxBlur: 8.0,
  },
  onLoadStateChange,
}: InfiniteGalleryProps) {
  const [webglSupported] = useState(() => {
    if (typeof document === "undefined") {
      return true;
    }

    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

      return Boolean(gl);
    } catch {
      return false;
    }
  });
  const [loadedTextures, setLoadedTextures] = useState<LoadedTextureMap>({});
  const [progressState, setProgressState] = useState({
    starterLoaded: 0,
    totalLoaded: 0,
  });
  const loadedTexturesRef = useRef<LoadedTextureMap>({});

  const normalizedImages = useMemo(
    () =>
      images.map((image) =>
        typeof image === "string" ? { src: image, alt: "" } : image
      ),
    [images]
  );

  const totalImages = normalizedImages.length;
  const starterTotal = Math.min(totalImages, Math.max(visibleCount, 10));
  const ready = starterTotal === 0 || progressState.starterLoaded >= starterTotal;

  useEffect(() => {
    loadedTexturesRef.current = loadedTextures;
  }, [loadedTextures]);

  useEffect(
    () => () => {
      Object.values(loadedTexturesRef.current).forEach((texture) => {
        texture.dispose();
      });
    },
    []
  );

  useEffect(() => {
    onLoadStateChange?.({
      ready,
      starterLoaded: progressState.starterLoaded,
      starterTotal,
      totalLoaded: progressState.totalLoaded,
      total: totalImages,
    });
  }, [
    onLoadStateChange,
    progressState.starterLoaded,
    progressState.totalLoaded,
    ready,
    starterTotal,
    totalImages,
  ]);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const starterIndices = Array.from(
      { length: starterTotal },
      (_, index) => index
    );
    const backgroundIndices = Array.from(
      { length: Math.max(totalImages - starterTotal, 0) },
      (_, index) => index + starterTotal
    );

    const loadTexture = async (index: number) => {
      try {
        const texture = await loader.loadAsync(normalizedImages[index].src);

        if (cancelled) {
          texture.dispose();
          return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;

        startTransition(() => {
          setLoadedTextures((current) => {
            if (current[index]) {
              texture.dispose();
              return current;
            }

            return {
              ...current,
              [index]: texture,
            };
          });

          setProgressState((current) => ({
            starterLoaded: current.starterLoaded + (index < starterTotal ? 1 : 0),
            totalLoaded: current.totalLoaded + 1,
          }));
        });
      } catch {
        if (!cancelled) {
          startTransition(() => {
            setProgressState((current) => ({
              starterLoaded: current.starterLoaded + (index < starterTotal ? 1 : 0),
              totalLoaded: current.totalLoaded + 1,
            }));
          });
        }
      }
    };

    const runQueue = async (indices: number[], concurrency: number) => {
      if (indices.length === 0) {
        return;
      }

      let cursor = 0;
      const workerCount = Math.min(concurrency, indices.length);

      const workers = Array.from({ length: workerCount }, async () => {
        while (!cancelled) {
          const nextIndex = indices[cursor];
          cursor += 1;

          if (nextIndex === undefined) {
            return;
          }

          await loadTexture(nextIndex);
        }
      });

      await Promise.all(workers);
    };

    void (async () => {
      await runQueue(starterIndices, STARTER_CONCURRENCY);

      if (cancelled) {
        return;
      }

      await runQueue(backgroundIndices, BACKGROUND_CONCURRENCY);
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedImages, starterTotal, totalImages]);

  if (!webglSupported) {
    return (
      <div className={className} style={style}>
        <FallbackGallery images={images} />
      </div>
    );
  }

  return (
    <div className={`gallery-shell ${className}`} style={style}>
      <Canvas
        camera={{ position: [0, 0, 0], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
      >
        <GalleryScene
          images={images}
          textures={loadedTextures}
          starterReady={ready}
          speed={speed}
          zSpacing={zSpacing}
          visibleCount={visibleCount}
          fadeSettings={fadeSettings}
          blurSettings={blurSettings}
        />
      </Canvas>
    </div>
  );
}
