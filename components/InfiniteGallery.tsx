"use client";

import Image from "next/image";
import type React from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Preload, useTexture } from "@react-three/drei";
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
}

interface PlaneData {
  index: number;
  z: number;
  imageIndex: number;
  x: number;
  y: number;
}

const BASE_PLANE_SIZE = 2;
const DEFAULT_Z_SPACING = 3;
const MAX_HORIZONTAL_OFFSET = 8;
const MAX_VERTICAL_OFFSET = 8;

const defaultFadeSettings: FadeSettings = {
  fadeIn: { start: 0.05, end: 0.25 },
  fadeOut: { start: 0.78, end: 0.96 },
};

const defaultBlurSettings: BlurSettings = {
  blurIn: { start: 0.0, end: 0.1 },
  blurOut: { start: 0.82, end: 1.0 },
  maxBlur: 4.5,
};

function createClothMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      map: { value: null },
      opacity: { value: 1.0 },
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
      uniform float scrollForce;
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

        float curveHighlight = abs(scrollForce) * 0.05;
        color.rgb += vec3(curveHighlight * 0.1);

        gl_FragColor = vec4(color.rgb, color.a * opacity);
      }
    `,
  });
}

function createPlaneLayout(visibleCount: number, totalImages: number, zSpacing: number) {
  const depthRange = Math.max(visibleCount * zSpacing, 24);

  return Array.from({ length: visibleCount }, (_, index) => {
    const horizontalAngle = (index * 2.618) % (Math.PI * 2);
    const verticalAngle = (index * 1.618 + Math.PI / 3) % (Math.PI * 2);
    const horizontalRadius = (index % 3) * 1.2;
    const verticalRadius = ((index + 1) % 4) * 0.8;

    return {
      index,
      z: ((depthRange / Math.max(visibleCount, 1)) * index) % depthRange,
      imageIndex: totalImages > 0 ? index % totalImages : 0,
      x: (Math.sin(horizontalAngle) * horizontalRadius * MAX_HORIZONTAL_OFFSET) / 3,
      y: (Math.cos(verticalAngle) * verticalRadius * MAX_VERTICAL_OFFSET) / 4,
    };
  });
}

function getImageScale(texture: THREE.Texture) {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const aspect =
    image?.width && image?.height ? image.width / image.height : 1;

  return aspect > 1
    ? [BASE_PLANE_SIZE * aspect, BASE_PLANE_SIZE, 1]
    : [BASE_PLANE_SIZE, BASE_PLANE_SIZE / aspect, 1];
}

function GalleryScene({
  images,
  speed = 1,
  zSpacing = DEFAULT_Z_SPACING,
  visibleCount = 8,
  fadeSettings = defaultFadeSettings,
  blurSettings = defaultBlurSettings,
}: Omit<InfiniteGalleryProps, "className" | "style">) {
  const scrollVelocityRef = useRef(0);
  const autoPlayRef = useRef(true);
  const lastInteractionRef = useRef(0);
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);

  const normalizedImages = useMemo(
    () =>
      images.map((image) =>
        typeof image === "string" ? { src: image, alt: "" } : image
      ),
    [images]
  );

  const textures = useTexture(normalizedImages.map((image) => image.src));
  const totalImages = normalizedImages.length;
  const depthRange = Math.max(visibleCount * zSpacing, 24);

  const initialPlanes = useMemo(
    () => createPlaneLayout(visibleCount, totalImages, zSpacing),
    [totalImages, visibleCount, zSpacing]
  );

  const planesData = useRef<PlaneData[]>(initialPlanes);

  const materials = useMemo(
    () => Array.from({ length: visibleCount }, () => createClothMaterial()),
    [visibleCount]
  );

  useEffect(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    });
  }, [textures]);

  useEffect(() => {
    planesData.current = initialPlanes;
  }, [initialPlanes]);

  useEffect(
    () => () => {
      materials.forEach((material) => material.dispose());
    },
    [materials]
  );

  useEffect(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  const registerInteraction = useCallback((delta: number) => {
    scrollVelocityRef.current += delta;
    autoPlayRef.current = false;
    lastInteractionRef.current = Date.now();
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      registerInteraction(event.deltaY * 0.01 * speed);
    },
    [registerInteraction, speed]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        registerInteraction(-2 * speed);
      }

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        registerInteraction(2 * speed);
      }
    },
    [registerInteraction, speed]
  );

  useEffect(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) {
      return undefined;
    }

    canvas.addEventListener("wheel", handleWheel, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown, handleWheel]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (Date.now() - lastInteractionRef.current > 3000) {
        autoPlayRef.current = true;
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useFrame((state, delta) => {
    if (autoPlayRef.current) {
      scrollVelocityRef.current += 0.3 * delta;
    }

    scrollVelocityRef.current *= 0.95;

    const time = state.clock.getElapsedTime();
    const imageAdvance = totalImages > 0 ? visibleCount % totalImages || totalImages : 0;

    planesData.current.forEach((plane, index) => {
      const material = materials[index];
      const mesh = meshRefs.current[index];
      if (!material || !mesh) {
        return;
      }

      let newZ = plane.z + scrollVelocityRef.current * delta * 10;
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

      const normalizedPosition = plane.z / depthRange;
      let opacity = 1;

      if (
        normalizedPosition >= fadeSettings.fadeIn.start &&
        normalizedPosition <= fadeSettings.fadeIn.end
      ) {
        opacity =
          (normalizedPosition - fadeSettings.fadeIn.start) /
          (fadeSettings.fadeIn.end - fadeSettings.fadeIn.start);
      } else if (normalizedPosition < fadeSettings.fadeIn.start) {
        opacity = 0;
      } else if (
        normalizedPosition >= fadeSettings.fadeOut.start &&
        normalizedPosition <= fadeSettings.fadeOut.end
      ) {
        opacity =
          1 -
          (normalizedPosition - fadeSettings.fadeOut.start) /
            (fadeSettings.fadeOut.end - fadeSettings.fadeOut.start);
      } else if (normalizedPosition > fadeSettings.fadeOut.end) {
        opacity = 0;
      }

      let blur = 0;
      if (
        normalizedPosition >= blurSettings.blurIn.start &&
        normalizedPosition <= blurSettings.blurIn.end
      ) {
        blur =
          blurSettings.maxBlur *
          (1 -
            (normalizedPosition - blurSettings.blurIn.start) /
              (blurSettings.blurIn.end - blurSettings.blurIn.start));
      } else if (normalizedPosition < blurSettings.blurIn.start) {
        blur = blurSettings.maxBlur;
      } else if (
        normalizedPosition >= blurSettings.blurOut.start &&
        normalizedPosition <= blurSettings.blurOut.end
      ) {
        blur =
          blurSettings.maxBlur *
          ((normalizedPosition - blurSettings.blurOut.start) /
            (blurSettings.blurOut.end - blurSettings.blurOut.start));
      } else if (normalizedPosition > blurSettings.blurOut.end) {
        blur = blurSettings.maxBlur;
      }

      const texture = textures[plane.imageIndex];
      if (texture) {
        material.uniforms.map.value = texture;
        const [width, height, depth] = getImageScale(texture);
        mesh.scale.set(width, height, depth);
      }

      material.uniforms.time.value = time;
      material.uniforms.scrollForce.value = scrollVelocityRef.current;
      material.uniforms.opacity.value = Math.max(0, Math.min(1, opacity));
      material.uniforms.blurAmount.value = Math.max(
        0,
        Math.min(blurSettings.maxBlur, blur)
      );

      mesh.position.set(plane.x, plane.y, plane.z - depthRange / 2);
    });
  });

  if (normalizedImages.length === 0) {
    return null;
  }

  return (
    <>
      {initialPlanes.map((plane, index) => {
        const texture = textures[plane.imageIndex];
        const material = materials[index];

        if (!texture || !material) {
          return null;
        }

        const [width, height, depth] = getImageScale(texture);

        return (
          <mesh
            key={plane.index}
            ref={(node) => {
              meshRefs.current[index] = node;
            }}
            position={[plane.x, plane.y, plane.z - depthRange / 2]}
            scale={[width, height, depth]}
            material={material}
            onPointerEnter={() => {
              material.uniforms.isHovered.value = 1;
            }}
            onPointerLeave={() => {
              material.uniforms.isHovered.value = 0;
            }}
          >
            <planeGeometry args={[1, 1, 32, 32]} />
          </mesh>
        );
      })}
    </>
  );
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
          <Image
            key={image.src}
            src={image.src || "/placeholder.svg"}
            alt={image.alt || `Gallery image ${index + 1}`}
            width={480}
            height={480}
            className="h-32 w-full rounded object-cover"
          />
        ))}
      </div>
    </div>
  );
}

export default function InfiniteGallery({
  images,
  className = "h-96 w-full",
  style,
  speed = 1,
  zSpacing = DEFAULT_Z_SPACING,
  visibleCount = 8,
  falloff,
  fadeSettings = defaultFadeSettings,
  blurSettings = defaultBlurSettings,
}: InfiniteGalleryProps) {
  const [webglSupported] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    try {
      const canvas = document.createElement("canvas");
      return Boolean(canvas.getContext("webgl"));
    } catch {
      return false;
    }
  });

  if (!webglSupported) {
    return (
      <div className={className} style={style}>
        <FallbackGallery images={images} />
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      <Canvas camera={{ position: [0, 0, 0], fov: 55 }} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <GalleryScene
            images={images}
            speed={speed}
            zSpacing={zSpacing}
            visibleCount={visibleCount}
            falloff={falloff}
            fadeSettings={fadeSettings}
            blurSettings={blurSettings}
          />
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}
