"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLANET_TILT, RING_IN, RING_OUT } from "@/lib/space/constants";
import { space } from "@/lib/space/state";
import {
  PLANET_FRAGMENT,
  PLANET_VERTEX,
  RING_FRAGMENT,
  RING_VERTEX,
} from "./shaders";

function litUniforms() {
  return THREE.UniformsUtils.merge([
    THREE.UniformsLib.lights,
    {
      uTime: { value: 0 },
      uRingIn: { value: RING_IN },
      uRingOut: { value: RING_OUT },
    },
  ]);
}

function ringGeometry() {
  const geometry = new THREE.RingGeometry(RING_IN, RING_OUT, 1024, 1);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function Planet() {
  const planetUniforms = useMemo(() => litUniforms(), []);
  const ringUniforms = useMemo(() => litUniforms(), []);
  const rings = useMemo(() => ringGeometry(), []);
  const planetMaterial = useRef<THREE.ShaderMaterial>(null);

  useFrame(() => {
    if (planetMaterial.current)
      planetMaterial.current.uniforms.uTime.value = space.time;
  });

  return (
    <group rotation={PLANET_TILT}>
      <mesh castShadow>
        <sphereGeometry args={[1, 512, 256]} />
        <shaderMaterial
          ref={planetMaterial}
          lights
          uniforms={planetUniforms}
          vertexShader={PLANET_VERTEX}
          fragmentShader={PLANET_FRAGMENT}
        />
      </mesh>
      <mesh geometry={rings} receiveShadow renderOrder={1}>
        <shaderMaterial
          lights
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          uniforms={ringUniforms}
          vertexShader={RING_VERTEX}
          fragmentShader={RING_FRAGMENT}
        />
      </mesh>
    </group>
  );
}
