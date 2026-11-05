"use client";

import { type ReactNode, Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BASE_FOV, HOME_CAMERA } from "@/lib/space/constants";
import { space } from "@/lib/space/state";
import { FIRST_ECLIPSE_AT, SUN_PERIOD } from "@/lib/space/sun";
import { Astronaut } from "./Astronaut";
import { CameraRig } from "./CameraRig";
import { LandingSequence, type LandingEvents } from "./LandingSequence";
import { Moons } from "./Moons";
import { ShipInterior } from "./ShipInterior";
import { Planet } from "./Planet";
import { Spaceship } from "./Spaceship";
import { Stars } from "./Stars";
import { Sun } from "./Sun";

/** A faint reflection source, so the visor has some sheen. Not a light. */
function VisorReflections() {
  const get = useThree((state) => state.get);
  useEffect(() => {
    const { gl, scene } = get();
    const generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.22;
    return () => {
      scene.environment = null;
      target.dispose();
      generator.dispose();
    };
  }, [get]);
  return null;
}

/** Everything that disappears when a web page takes over the screen. */
function World({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = !space.worldHidden;
  });
  return <group ref={group}>{children}</group>;
}

/** Feeds download progress to the loading screen. It only ever moves forward, even as new files join the queue. */
function LoadProgress() {
  const { progress } = useProgress();
  const highest = useRef(0);
  useEffect(() => {
    highest.current = Math.max(highest.current, progress);
    space.loader?.style.setProperty("--progress", String(highest.current / 100));
    const percent = space.loader?.querySelector("[data-percent]");
    if (percent) percent.textContent = String(Math.round(highest.current));
  }, [progress]);
  return null;
}

/** Sits inside the Suspense boundary. Says the scene is ready once it has really drawn, shaders and all. */
function SceneReady({ waitForHead, onReady }: { waitForHead: boolean; onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current > 2 || (waitForHead && !space.headOn)) return;
    frames.current += 1;
    if (frames.current > 2) onReady();
  });
  return null;
}

function DebugHud() {
  useFrame((_, delta) => {
    if (!space.hud) return;
    const next = (((FIRST_ECLIPSE_AT - space.time) % SUN_PERIOD) + SUN_PERIOD) % SUN_PERIOD;
    space.hud.textContent =
      `${Math.round(1 / Math.max(delta, 0.001))} fps · t ${space.time.toFixed(1)}s · ` +
      `next eclipse ${next.toFixed(0)}s · sun visible ${(space.sunVisible * 100).toFixed(0)}%`;
  });
  return null;
}

type Props = LandingEvents & {
  pov: boolean;
  resetCount: number;
  destination: string | null;
  startedOnPage: boolean;
  paused: boolean;
  helmetOff: boolean;
  onReady: () => void;
};

export default function SpaceCanvas({ pov, resetCount, destination, startedOnPage, paused, helmetOff, onReady, onImpact, onCovered, onBackInOrbit }: Props) {
  return (
    <Canvas
      flat
      frameloop={paused ? "demand" : "always"}
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: BASE_FOV, near: 0.1, far: 20000, position: HOME_CAMERA.toArray() }}
    >
      <LoadProgress />
      <Suspense fallback={null}>
      <SceneReady waitForHead={helmetOff} onReady={onReady} />
      <VisorReflections />
      <hemisphereLight args={["#8a7a64", "#0a0c12", 0.45]} />
      <Sun />
      <World>
        <Stars />
        <Planet />
        <Moons />
        <Spaceship />
      </World>
      <Astronaut helmetOff={helmetOff} preloadHead={destination === "about"} />
      <ShipInterior />
      <CameraRig pov={pov} resetCount={resetCount} startedOnPage={startedOnPage} />
      <LandingSequence
        destination={destination}
        startedOnPage={startedOnPage}
        onImpact={onImpact}
        onCovered={onCovered}
        onBackInOrbit={onBackInOrbit}
      />
      <DebugHud />
      <EffectComposer multisampling={4}>
        {/* additive: the default SCREEN blend assumes 0..1 values, so HDR pixels get darker under their own bloom */}
        <Bloom
          mipmapBlur
          blendFunction={BlendFunction.ADD}
          intensity={0.45}
          luminanceThreshold={0.8}
          luminanceSmoothing={0.15}
          radius={0.55}
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
