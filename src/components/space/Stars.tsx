"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SKY_FRAGMENT } from "./shaders";

const COUNT = 14000;
const RADIUS = 900;
const HERO_STAR_CHANCE = 0.0125;
const GALACTIC_POLE = new THREE.Vector3(0.35, 1, -0.25).normalize();
/** The sky turns very slowly around the galaxy's pole, about once an hour, so the band of the Milky Way stays put. */
const SKY_TURN_SPEED = (Math.PI * 2) / 3600;
const TEMPERATURES = [
  [0.62, 0.72, 1.0],
  [0.85, 0.9, 1.0],
  [1.0, 0.97, 0.92],
  [1.0, 0.88, 0.7],
  [1.0, 0.74, 0.5],
];

/** Seeded, so the sky is the same on every visit. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starGeometry() {
  const random = mulberry32(1969);
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const v = new THREE.Vector3();
  for (let i = 0; i < COUNT; i++) {
    const z = random() * 2 - 1;
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    v.set(r * Math.cos(a), z, r * Math.sin(a));
    if (random() < 0.45) v.addScaledVector(GALACTIC_POLE, -v.dot(GALACTIC_POLE) * 0.8).normalize();
    positions.set([v.x * RADIUS, v.y * RADIUS, v.z * RADIUS], i * 3);
    // Most stars stay under the bloom threshold and draw their own soft glow. About 1 in 80 is a
    // "hero" star, bright enough for the bloom pass to catch and flare.
    const hero = random() < HERO_STAR_CHANCE;
    const brightness = hero ? 2 + Math.pow(random(), 2) * 10 : 0.05 + Math.pow(random(), 9) * 0.9;
    const t = TEMPERATURES[Math.floor(random() * TEMPERATURES.length)];
    colors.set([t[0] * brightness, t[1] * brightness, t[2] * brightness], i * 3);
    sizes[i] = hero ? 7 + random() * 6 : 2 + Math.pow(brightness / 0.95, 1.5) * 12;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

const STAR_VERTEX = /* glsl */ `
  attribute vec3 color;
  attribute float size;
  uniform float uDpr;
  varying vec3 vC;
  void main() {
    vC = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uDpr;
  }
`;
const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vC;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = (exp(-d * d * 30.0) + exp(-d * 6.0) * 0.18) * (1.0 - smoothstep(0.7, 1.0, d));
    gl_FragColor = vec4(vC * a, 1.0);
  }
`;
const SKY_VERTEX = /* glsl */ `
  varying vec3 vD;
  void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export function Stars() {
  const dpr = useThree((state) => state.viewport.dpr);
  const geometry = useMemo(() => starGeometry(), []);
  const starUniforms = useMemo(() => ({ uDpr: { value: dpr } }), [dpr]);
  const skyUniforms = useMemo(() => ({ uBand: { value: GALACTIC_POLE }, uRingIn: { value: 0 }, uRingOut: { value: 1 } }), []);
  const sky = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    sky.current?.rotateOnWorldAxis(GALACTIC_POLE, Math.min(delta, 0.1) * SKY_TURN_SPEED);
  });

  return (
    <group ref={sky}>
      {/* drawn first: the sun sits beyond this sphere, and opaque objects don't sort by depth alone */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[950, 64, 32]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={skyUniforms}
          vertexShader={SKY_VERTEX}
          fragmentShader={SKY_FRAGMENT}
        />
      </mesh>
      <points geometry={geometry}>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={starUniforms}
          vertexShader={STAR_VERTEX}
          fragmentShader={STAR_FRAGMENT}
        />
      </points>
    </group>
  );
}
