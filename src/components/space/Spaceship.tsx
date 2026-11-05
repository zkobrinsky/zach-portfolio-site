"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PLANET_TILT } from "@/lib/space/constants";
import { SHIP_ORBIT_LEAN, SHIP_ORBIT_RADIUS, shipOrbitAngle } from "@/lib/space/ship";
import { space } from "@/lib/space/state";

const MODEL_URL = "/models/spaceship.glb";
const MODEL_LENGTH = 17.5;
/** The ship's length in scene units. */
const SHIP_LENGTH = 0.5;
/**
 * Lit like the moons: hard sunlight, near-black shadow. The astronaut's soft fill light is removed from this
 * material, leaving only a trace of light reflected from the planet.
 */
function hardLighting(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <lights_fragment_begin>",
      THREE.ShaderChunk.lights_fragment_begin.replace(
        "irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );",
        "irradiance += vec3(0.05, 0.043, 0.033);",
      ),
    )
    .replace("#include <lights_fragment_maps>", "") // no reflected environment light either
    // No shiny highlights: on details smaller than a pixel they only show up as flickering sparkles.
    .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n reflectedLight.directSpecular = vec3(0.0);");
}

/** The model has plain, dark colors, so it's brightened here, and its lights and windows glow. */
function finish(model: THREE.Object3D) {
  if (model.userData.finished) return;
  model.userData.finished = true;
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true; // the hull shades its own rivets and trim on the dark side
    object.receiveShadow = true;
    const material = object.material as THREE.MeshStandardMaterial;
    material.side = THREE.DoubleSide;
    material.metalness = 0;
    material.roughness = 1;
    material.onBeforeCompile = hardLighting;
    if (/Window|Dark_Blue/i.test(material.name)) material.emissive = new THREE.Color("#3a7fc4").multiplyScalar(0.35);
    else if (/Lamp/i.test(material.name)) material.emissive = new THREE.Color("#2bd14a").multiplyScalar(0.3);
    else if (material.color.r === material.color.g) material.color.setScalar(Math.min(material.color.r * 2.8, 0.75));
  });
}

const position = new THREE.Vector3();
const heading = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const side = new THREE.Vector3();
const basis = new THREE.Matrix4();

export function Spaceship() {
  const { scene: model } = useGLTF(MODEL_URL);
  const ship = useRef<THREE.Group>(null);

  useLayoutEffect(() => finish(model), [model]);

  useFrame(() => {
    if (!ship.current) return;
    const angle = shipOrbitAngle(space.time);
    position.set(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(SHIP_ORBIT_RADIUS);
    heading.set(-Math.sin(angle), 0, Math.cos(angle));
    ship.current.position.copy(position);
    // the model's nose points along -X
    side.crossVectors(heading, up);
    basis.makeBasis(heading.clone().negate(), up, side.negate());
    ship.current.quaternion.setFromRotationMatrix(basis);
  });

  return (
    <group rotation={PLANET_TILT}>
      <group rotation={[SHIP_ORBIT_LEAN, 0, 0]}>
        <group ref={ship}>
          <primitive object={model} scale={SHIP_LENGTH / MODEL_LENGTH} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
