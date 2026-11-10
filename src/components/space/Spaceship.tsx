"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PLANET_TILT } from "@/lib/space/constants";
import { shipHatch, shipHatchPath, shipHatchState, shipLight, shipOrbitAngle, shipPlacement } from "@/lib/space/ship";
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

/** A hull mesh's vertices in the model's own space and its full triangle list, kept so the ramp can be re-cut. */
type HullPart = { mesh: THREE.Mesh; relative: THREE.Matrix4; points: Float32Array; triangles: number[] };

function hullParts(model: THREE.Object3D): HullPart[] {
  model.userData.hullParts ??= (() => {
    const parts: HullPart[] = [];
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const relative = new THREE.Matrix4();
      for (let node: THREE.Object3D | null = object; node && node !== model; node = node.parent) {
        node.updateMatrix();
        relative.premultiply(node.matrix);
      }
      const geometry = object.geometry as THREE.BufferGeometry;
      const position = geometry.attributes.position;
      const points = new Float32Array(position.count * 3);
      const point = new THREE.Vector3();
      for (let i = 0; i < position.count; i++) point.fromBufferAttribute(position, i).applyMatrix4(relative).toArray(points, i * 3);
      const triangles = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: position.count }, (_, i) => i);
      parts.push({ mesh: object, relative, points, triangles });
    });
    return parts;
  })();
  return model.userData.hullParts;
}

/** Moves the hull triangles inside the ramp's box out of the ship and into `ramp`, leaving a hole where they were. */
function cutRamp(parts: HullPart[], ramp: THREE.Object3D) {
  const { x, y, z, length, width, depth } = shipHatch;
  ramp.clear(); // the old pieces share the hull's buffers, so they're dropped, not disposed
  for (const { mesh, relative, points, triangles } of parts) {
    const keep: number[] = [];
    const cut: number[] = [];
    for (let i = 0; i < triangles.length; i += 3) {
      let inside = true;
      for (let j = 0; j < 3 && inside; j++) {
        const v = triangles[i + j] * 3;
        inside = Math.abs(points[v] - x) <= length / 2 && Math.abs(points[v + 2] - z) <= width / 2 && points[v + 1] <= y + depth;
      }
      (inside ? cut : keep).push(triangles[i], triangles[i + 1], triangles[i + 2]);
    }
    const hull = mesh.geometry as THREE.BufferGeometry;
    hull.setIndex(keep);
    if (!cut.length) continue;
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(hull.attributes)) geometry.setAttribute(name, attribute);
    geometry.setIndex(cut);
    geometry.computeBoundingSphere();
    const piece = new THREE.Mesh(geometry, mesh.material);
    piece.matrixAutoUpdate = false;
    piece.matrix.copy(relative);
    piece.castShadow = piece.receiveShadow = true;
    ramp.add(piece);
  }
}
const glowMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, transparent: true, side: THREE.DoubleSide });
/** A soft shaft of light out of the opening, brightest at the ship and fading with distance. */
const beamMaterial = new THREE.ShaderMaterial({
  uniforms: { uStrength: { value: 0 } },
  vertexShader: "varying float vAlong; void main() { vAlong = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform float uStrength; varying float vAlong; void main() { gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * uStrength * pow(vAlong, 2.0), 1.0); }",
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  toneMapped: false,
});
/** In hatch widths: how long the beam is, and how much wider it gets. */
const BEAM_LENGTH = 2.2;
const BEAM_SPREAD = 1.6;

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
  const hatch = useRef<THREE.Group>(null);
  const hinge = useRef<THREE.Group>(null);
  const ramp = useRef<THREE.Group>(null);
  const cutFor = useRef("");
  const glow = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);

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

    // the belly ramp
    const open = Math.max(shipHatchState.open, shipHatch.preview);
    const { x, y, z, length, width, angle: drop } = shipHatch;
    if (hatch.current && hinge.current && ramp.current && glow.current && beam.current && light.current) {
      const box = `${x} ${y} ${z} ${length} ${width} ${shipHatch.depth}`;
      if (cutFor.current !== box) {
        cutFor.current = box;
        cutRamp(hullParts(model), ramp.current);
      }
      hatch.current.position.set(x, y, z);
      // hinged at the back edge (+X); positive turns about Z swing the front end down
      hinge.current.position.set(length / 2, 0, 0);
      hinge.current.rotation.z = drop * THREE.MathUtils.smootherstep(open, 0, 1);
      // the cut-out pieces are in the model's space, so undo the hinge's offset
      ramp.current.position.set(-x - length / 2, -y, -z);
      // always lit: the closed ramp hides it, and opening reveals it
      glow.current.visible = open > 0.001;
      glow.current.position.set(0, shipHatch.depth, 0);
      glow.current.scale.set(length, width, 1);
      glowMaterial.color.setScalar(shipHatch.glow);
      beam.current.visible = open > 0.001 && shipHatch.beam > 0;
      beam.current.scale.set(width, width * BEAM_LENGTH, width);
      beamMaterial.uniforms.uStrength.value = shipHatch.beam * THREE.MathUtils.smoothstep(open, 0.1, 0.8);
      light.current.intensity = shipHatch.light * open;
      // where the opening is, for the flight to aim at
      hatch.current.updateWorldMatrix(true, false);
      hatch.current.getWorldPosition(shipHatchState.center);
      shipHatchState.normal.set(0, -1, 0).transformDirection(hatch.current.matrixWorld);
      shipHatchState.forward.set(-1, 0, 0).transformDirection(hatch.current.matrixWorld);
      const { runIn, runBelow, endBelow } = shipHatchPath;
      hatch.current.localToWorld(shipHatchState.lineUp.set(-runIn, -runBelow, 0));
      hatch.current.localToWorld(shipHatchState.end.set(0, -endBelow, 0));
      hatch.current.localToWorld(shipHatchState.light.set(0, shipHatch.depth, 0));
    }
  });

  return (
    <group rotation={PLANET_TILT}>
      <group ref={orbit}>
        <group ref={ship}>
          <group ref={attitude}>
            <primitive object={model} scale={SHIP_LENGTH / MODEL_LENGTH} />
            <group scale={SHIP_LENGTH / MODEL_LENGTH}>
              <group ref={hatch}>
                <group ref={hinge}>
                  <group ref={ramp} />
                </group>
                {/* the lit inside, up in the hole the ramp leaves */}
                <mesh ref={glow} material={glowMaterial} rotation={[Math.PI / 2, 0, 0]}>
                  <planeGeometry />
                </mesh>
                <mesh ref={beam} material={beamMaterial} position={[0, -BEAM_LENGTH / 2, 0]}>
                  {/* uv.y runs bottom to top, so the beam is brightest at the ship */}
                  <cylinderGeometry args={[0.5, 0.5 * BEAM_SPREAD, 1, 4, 1, true]} />
                </mesh>
                <pointLight ref={light} position={[0, -1.2, 0]} color="#fff6e8" intensity={0} distance={0.6} decay={2} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
