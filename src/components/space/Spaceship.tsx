"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PLANET_TILT } from "@/lib/space/constants";
import { shipLight, shipOrbitAngle, shipPlacement } from "@/lib/space/ship";
import { space } from "@/lib/space/state";

const MODEL_URL = "/models/spaceship.glb";
const MODEL_LENGTH = 17.5;
/** The ship's length in scene units. */
const SHIP_LENGTH = 0.5;
/**
 * Lit like the moons: hard sunlight, near-black shadow. The astronaut's soft fill light is removed from this
 * material, leaving only a trace of light reflected from the planet.
 */
const lightUniforms = { uShipFill: { value: 0 }, uShipSide: { value: 0 }, uShipSideDirection: { value: new THREE.Vector3() } };

function hardLighting(shader: { fragmentShader: string; uniforms: Record<string, { value: unknown }> }) {
  Object.assign(shader.uniforms, lightUniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nuniform float uShipFill;\nuniform float uShipSide;\nuniform vec3 uShipSideDirection;")
    .replace(
      "#include <lights_fragment_begin>",
      THREE.ShaderChunk.lights_fragment_begin.replace(
        "irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );",
        "irradiance += vec3(1.0, 0.87, 0.67) * uShipFill;",
      ),
    )
    .replace("#include <lights_fragment_maps>", "") // no reflected environment light either
    // No shiny highlights: on details smaller than a pixel they only show up as flickering sparkles.
    .replace(
      "#include <lights_fragment_end>",
      `#include <lights_fragment_end>
       reflectedLight.directSpecular = vec3(0.0);
       reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(1.0, 0.93, 0.82) * uShipSide * smoothstep(0.02, 0.3, dot(geometryNormal, uShipSideDirection));`,
    );
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
const sideLight = new THREE.Vector3();
const heading = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const side = new THREE.Vector3();
const basis = new THREE.Matrix4();

export function Spaceship() {
  const { scene: model } = useGLTF(MODEL_URL);
  const ship = useRef<THREE.Group>(null);
  const orbit = useRef<THREE.Group>(null);
  const attitude = useRef<THREE.Group>(null);

  useLayoutEffect(() => finish(model), [model]);

  useFrame(({ camera }) => {
    if (!ship.current) return;
    const angle = shipOrbitAngle(space.time);
    const { radius, lean, pitch, yaw, roll, scale } = shipPlacement;
    lightUniforms.uShipFill.value = shipLight.fill;
    // the sun as seen from the camera, with its depth flattened so it can't end up behind the ship
    sideLight.copy(space.sunDirection).transformDirection(camera.matrixWorldInverse);
    lightUniforms.uShipSide.value = shipLight.side * THREE.MathUtils.smoothstep(-sideLight.z, -0.4, 0.2);
    sideLight.z = shipLight.front;
    lightUniforms.uShipSideDirection.value.copy(sideLight.normalize());
    orbit.current?.rotation.set(lean, 0, 0);
    attitude.current?.rotation.set(pitch, yaw, roll);
    attitude.current?.scale.setScalar(scale);
    position.set(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(radius);
    heading.set(-Math.sin(angle), 0, Math.cos(angle));
    ship.current.position.copy(position);
    // the model's nose points along -X
    side.crossVectors(heading, up);
    basis.makeBasis(heading.clone().negate(), up, side.negate());
    ship.current.quaternion.setFromRotationMatrix(basis);
  });

  return (
    <group rotation={PLANET_TILT}>
      <group ref={orbit}>
        <group ref={ship}>
          <group ref={attitude}>
            <primitive object={model} scale={SHIP_LENGTH / MODEL_LENGTH} />
          </group>
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
