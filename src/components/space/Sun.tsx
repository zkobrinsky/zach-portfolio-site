"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { debugParams, space } from "@/lib/space/state";
import { SUN_FAR, SUN_RADIUS, SUN_SCALE, sunDirection } from "@/lib/space/sun";
import { sunVisibility } from "@/lib/space/sunVisibility";

const LIGHT_DISTANCE = 40;
const SHADOW_EXTENT = 7;

const BILLBOARD_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const CORONA_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float g = exp(-d * 10.0) * 1.1 + exp(-d * 3.5) * 0.07;
    g *= 1.0 - smoothstep(0.8, 1.0, d);
    gl_FragColor = vec4(vec3(1.0, 0.8, 0.56) * g, 1.0);
  }
`;
const GLARE_FRAGMENT = /* glsl */ `
  uniform float uVisible;
  varying vec2 vUv;
  void main() {
    vec2 q = vUv - 0.5; float d = length(q) * 2.0;
    float core = exp(-d * 18.0) * 0.9;
    float halo = 0.22 / (1.0 + pow(d * 9.0, 2.0));
    float streak = exp(-abs(q.y) * 260.0) * exp(-abs(q.x) * 5.0) * 0.35;
    float g = (core + halo + streak) * (1.0 - smoothstep(0.55, 1.0, d));
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * g * uVisible, 1.0);
  }
`;

const CABIN_LIGHT = new THREE.Vector3(-0.45, 0.65, 0.6).normalize();
const sunColor = new THREE.Color(1, 0.93, 0.82).multiplyScalar(6);
const sunPosition = new THREE.Vector3();
const toSun = new THREE.Vector3();
const forward = new THREE.Vector3();

/** The one light in the scene, plus the sun you see. Everything is lit and shadowed by this light. */
export function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  const disc = useRef<THREE.Mesh>(null);
  const corona = useRef<THREE.Mesh>(null);
  const glare = useRef<THREE.Mesh>(null);
  const glareMaterial = useRef<THREE.ShaderMaterial>(null);
  const glareUniforms = useMemo(() => ({ uVisible: { value: 1 } }), []);
  const timeOffset = useRef<number | null>(null);

  // first in the frame: everything else reads the time and the sun direction
  useFrame(({ clock }) => {
    timeOffset.current ??= debugParams().timeOffset;
    space.time = clock.elapsedTime + timeOffset.current;
    sunDirection(space.time, space.sunDirection);
    if (!light.current) return;
    // aboard the ship this same light stands in for the cabin lighting
    light.current.position.copy(space.inShip ? CABIN_LIGHT : space.sunDirection).multiplyScalar(LIGHT_DISTANCE);
    light.current.intensity = space.inShip ? 2.2 : 3.2;
  }, -3);

  // last before rendering: the disc follows the camera, so it needs the camera's final position
  useFrame(({ camera }) => {
    if (!disc.current || !corona.current || !glare.current || !glareMaterial.current) return;
    // only the visible sun hides with the rest of space; the light stays on for the boots
    disc.current.visible = corona.current.visible = glare.current.visible = !space.worldHidden;
    sunPosition.copy(camera.position).addScaledVector(space.sunDirection, SUN_FAR);
    disc.current.position.copy(sunPosition);
    corona.current.position.copy(sunPosition);
    glare.current.position.copy(sunPosition);
    corona.current.quaternion.copy(camera.quaternion);
    glare.current.quaternion.copy(camera.quaternion);

    space.sunVisible = sunVisibility(camera, sunPosition);
    toSun.copy(sunPosition).sub(camera.position).normalize();
    const onAxis = camera.getWorldDirection(forward).dot(toSun);
    glareMaterial.current.uniforms.uVisible.value = space.sunVisible * THREE.MathUtils.smoothstep(onAxis, 0.6, 0.85);
  });

  return (
    <>
      <directionalLight
        ref={light}
        castShadow
        color="#fff1dd"
        intensity={3.2}
        shadow-mapSize={[4096, 4096]}
        shadow-radius={3}
        shadow-bias={-0.0005}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={LIGHT_DISTANCE - 12}
        shadow-camera-far={LIGHT_DISTANCE + 12}
      />
      <mesh ref={disc} scale={SUN_SCALE}>
        <sphereGeometry args={[SUN_RADIUS, 64, 32]} />
        <meshBasicMaterial color={sunColor} />
      </mesh>
      <mesh ref={corona} scale={SUN_RADIUS * 16 * SUN_SCALE}>
        <planeGeometry />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={BILLBOARD_VERTEX}
          fragmentShader={CORONA_FRAGMENT}
        />
      </mesh>
      <mesh ref={glare} scale={SUN_RADIUS * 42 * SUN_SCALE} renderOrder={10}>
        <planeGeometry />
        <shaderMaterial
          ref={glareMaterial}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          uniforms={glareUniforms}
          vertexShader={BILLBOARD_VERTEX}
          fragmentShader={GLARE_FRAGMENT}
        />
      </mesh>
    </>
  );
}
