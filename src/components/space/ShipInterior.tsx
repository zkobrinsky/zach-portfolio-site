"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { space } from "@/lib/space/state";

/*
  The inside of the ship: a long dark ribbed tube with light strips, built entirely in code. The astronaut
  floats near the front, and the tube fades away into darkness, so you never see where it ends.
*/
const RADIUS = 0.62;
const LENGTH = 44;
/** The tube runs from just behind the camera to far ahead of it. */
const CENTER_Z = 3 - LENGTH / 2;
const RIBS = Array.from({ length: 80 }, (_, i) => 2.5 - i * 0.45);
/** Where the darkness starts and where it's total, measured from the camera. */
const FADE_START = 1.5;
const FADE_END = 15;
const STRIPS = [-0.7, 0.7, Math.PI - 0.7, Math.PI + 0.7];

export function ShipInterior() {
  const cabin = useRef<THREE.Group>(null);

  useFrame(({ scene }) => {
    if (cabin.current) cabin.current.visible = space.inShip;
    // the fog stays on and is just pushed out of reach in space, so nothing has to recompile
    scene.fog ??= new THREE.Fog("#000000");
    const fog = scene.fog as THREE.Fog;
    fog.near = space.inShip ? FADE_START : 1e6;
    fog.far = space.inShip ? FADE_END : 2e6;
  });

  return (
    <group ref={cabin} visible={false}>
      <mesh position={[0, 0, CENTER_Z]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <cylinderGeometry args={[RADIUS, RADIUS, LENGTH, 8, 1, true]} />
        <meshStandardMaterial color="#2b2e33" roughness={0.75} metalness={0.2} side={THREE.BackSide} flatShading />
      </mesh>
      {RIBS.map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <torusGeometry args={[RADIUS * 0.97, 0.022, 8, 8]} />
          <meshStandardMaterial color="#4b4f55" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {STRIPS.map((angle) => (
        <mesh key={angle} position={[Math.sin(angle) * RADIUS * 0.93, Math.cos(angle) * RADIUS * 0.93, CENTER_Z]}>
          <boxGeometry args={[0.018, 0.018, LENGTH]} />
          <meshStandardMaterial color="#000000" emissive="#ffd9a0" emissiveIntensity={2.2} />
        </mesh>
      ))}
    </group>
  );
}
