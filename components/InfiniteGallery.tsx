"use client";
/* eslint-disable react-hooks/immutability, react-hooks/refs */

import Image from "next/image";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
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

const DEFAULT_DEPTH_RANGE = 50;
const MAX_HORIZONTAL_OFFSET = 8;
const MAX_VERTICAL_OFFSET = 8;

const defaultFadeSettings: FadeSettings = {
  fadeIn: { start: 0.05, end: 0.25 },
  fadeOut: { start: 0.4, end: 0.43 },
};

const defaultBlurSettings: BlurSettings = {
  blurIn: { start: 0.0, end: 0.1 },
  blurOut: { start: 0.4, end: 0.43 },
  maxBlur: 8.0,
};

const createClothMaterial = () =>
  new THREE.ShaderMaterial({
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

        pos.z -= (curve + clothEffect + flagWave);

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

function ImagePlane({
  texture,
  position,
  scale,
  material,
}: {
  texture: THREE.Texture;
  position: [number, number, number];
  scale: [number, number, number];
  material: THREE.ShaderMaterial;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const shaderMaterial = useMemo(() => material, [material]);

  useEffect(() => {
    shaderMaterial.uniforms.map.value = texture;
  }, [shaderMaterial, texture]);

  useEffect(() => {
    shaderMaterial.uniforms.isHovered.value = isHovered ? 1.0 : 0.0;
  }, [isHovered, shaderMaterial]);

  return (
    <mesh
      position={position}
      scale={scale}
      material={shaderMaterial}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <planeGeometry args={[1, 1, 32, 32]} />
    </mesh>
  );
}

function GalleryScene({
  images,
  speed = 1,
  visibleCount = 8,
  fadeSettings = defaultFadeSettings,
  blurSettings = defaultBlurSettings,
}: Omit<InfiniteGalleryProps, "className" | "style">) {
  const scrollVelocityRef = useRef(0);
  const autoPlayRef = useRef(true);
  const lastInteractionRef = useRef(0);

  const normalizedImages = useMemo(
    () =>
      images.map((image) =>
        typeof image === "string" ? { src: image, alt: "" } : image
      ),
    [images]
  );

  const textures = useTexture(normalizedImages.map((image) => image.src));

  const materials = useMemo(
    () => Array.from({ length: visibleCount }, () => createClothMaterial()),
    [visibleCount]
  );

  useEffect(
    () => () => {
      materials.forEach((material) => material.dispose());
    },
    [materials]
  );

  const spatialPositions = useMemo(() => {
    return Array.from({ length: visibleCount }, (_, index) => {
      const horizontalAngle = (index * 2.618) % (Math.PI * 2);
      const verticalAngle = (index * 1.618 + Math.PI / 3) % (Math.PI * 2);
      const horizontalRadius = (index % 3) * 1.2;
      const verticalRadius = ((index + 1) % 4) * 0.8;

      return {
        x:
          (Math.sin(horizontalAngle) * horizontalRadius * MAX_HORIZONTAL_OFFSET) /
          3,
        y:
          (Math.cos(verticalAngle) * verticalRadius * MAX_VERTICAL_OFFSET) / 4,
      };
    });
  }, [visibleCount]);

  const totalImages = normalizedImages.length;
  const initialPlanes = useMemo(
    () =>
      Array.from({ length: visibleCount }, (_, index) => ({
        index,
        z:
          visibleCount > 0
            ? ((DEFAULT_DEPTH_RANGE / Math.max(visibleCount, 1)) * index) %
              DEFAULT_DEPTH_RANGE
            : 0,
        imageIndex: totalImages > 0 ? index % totalImages : 0,
        x: spatialPositions[index]?.x ?? 0,
        y: spatialPositions[index]?.y ?? 0,
      })),
    [spatialPositions, totalImages, visibleCount]
  );
  const planesData = useRef<PlaneData[]>(initialPlanes);

  useEffect(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  useEffect(() => {
    planesData.current = initialPlanes;
  }, [initialPlanes]);

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
    materials.forEach((material) => {
      material.uniforms.time.value = time;
      material.uniforms.scrollForce.value = scrollVelocityRef.current;
    });

    const imageAdvance = totalImages > 0 ? visibleCount % totalImages || totalImages : 0;

    planesData.current.forEach((plane, index) => {
      let newZ = plane.z + scrollVelocityRef.current * delta * 10;
      let wrapsForward = 0;
      let wrapsBackward = 0;

      if (newZ >= DEFAULT_DEPTH_RANGE) {
        wrapsForward = Math.floor(newZ / DEFAULT_DEPTH_RANGE);
        newZ -= DEFAULT_DEPTH_RANGE * wrapsForward;
      } else if (newZ < 0) {
        wrapsBackward = Math.ceil(-newZ / DEFAULT_DEPTH_RANGE);
        newZ += DEFAULT_DEPTH_RANGE * wrapsBackward;
      }

      if (wrapsForward > 0 && imageAdvance > 0 && totalImages > 0) {
        plane.imageIndex = (plane.imageIndex + wrapsForward * imageAdvance) % totalImages;
      }

      if (wrapsBackward > 0 && imageAdvance > 0 && totalImages > 0) {
        const nextIndex = plane.imageIndex - wrapsBackward * imageAdvance;
        plane.imageIndex = ((nextIndex % totalImages) + totalImages) % totalImages;
      }

      plane.z = ((newZ % DEFAULT_DEPTH_RANGE) + DEFAULT_DEPTH_RANGE) % DEFAULT_DEPTH_RANGE;
      plane.x = spatialPositions[index]?.x ?? 0;
      plane.y = spatialPositions[index]?.y ?? 0;

      const normalizedPosition = plane.z / DEFAULT_DEPTH_RANGE;
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

      const material = materials[index];
      material.uniforms.opacity.value = Math.max(0, Math.min(1, opacity));
      material.uniforms.blurAmount.value = Math.max(
        0,
        Math.min(blurSettings.maxBlur, blur)
      );
    });
  });

  if (normalizedImages.length === 0) {
    return null;
  }

  return (
    <>
      {planesData.current.map((plane, index) => {
        const texture = textures[plane.imageIndex];
        const material = materials[index];

        if (!texture || !material) {
          return null;
        }

        const imageSize = texture.image as { width?: number; height?: number } | undefined;
        const aspect =
          imageSize?.width && imageSize?.height
            ? imageSize.width / imageSize.height
            : 1;
        const scale: [number, number, number] =
          aspect > 1 ? [2 * aspect, 2, 1] : [2, 2 / aspect, 1];

        return (
          <ImagePlane
            key={plane.index}
            texture={texture}
            position={[plane.x, plane.y, plane.z - DEFAULT_DEPTH_RANGE / 2]}
            scale={scale}
            material={material}
          />
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
  zSpacing,
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
        <GalleryScene
          images={images}
          speed={speed}
          zSpacing={zSpacing}
          visibleCount={visibleCount}
          falloff={falloff}
          fadeSettings={fadeSettings}
          blurSettings={blurSettings}
        />
      </Canvas>
    </div>
  );
}
