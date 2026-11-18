"use client";

import { type ReactNode, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useProgress } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ASSETS } from "@/lib/space/assets";
import { BASE_FOV, HOME_CAMERA } from "@/lib/space/constants";
import { space } from "@/lib/space/state";
import { FIRST_ECLIPSE_AT, SUN_PERIOD } from "@/lib/space/sun";
import { compileForComposer, uploadTextures } from "@/lib/space/warmUp";
import { Astronaut } from "./Astronaut";
import { CameraRig } from "./CameraRig";
import { LandingSequence, type LandingEvents } from "./LandingSequence";
import { forgetMoonMaps, Moons } from "./Moons";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
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

/**
 * Feeds download progress to the loading screen, which animates the ring toward it. It only ever moves forward,
 * even as new files join the queue.
 */
function LoadProgress() {
  const { progress } = useProgress();
  useEffect(() => {
    space.loadProgress = Math.max(space.loadProgress, progress / 100);
  }, [progress]);
  return null;
}

/** Sits inside the Suspense boundary. Says the scene is ready once it has really drawn, shaders and all. */
function SceneReady({ waitForHead, onReady }: { waitForHead: boolean; onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    // with the head on, wait for it to be warmed up too: that stalls a few frames, which belong behind the loader
    if (frames.current > 2 || (waitForHead && !space.astronautWarm)) return;
    frames.current += 1;
    if (frames.current > 2) onReady();
  });
  return null;
}

/**
 * Holds back the first frame until every shader is built and every texture is on the GPU. Drawing straight
 * away built each shader on the spot, freezing the page for seconds; built ahead of time, the shaders compile
 * in parallel, off the main thread. Mounted last, so the fog and the reflections are in place first.
 */
function WarmUp({ onWarm }: { onWarm: () => void }) {
  const get = useThree((state) => state.get);
  useEffect(() => {
    const { gl, scene, camera } = get();
    let cancelled = false;
    uploadTextures(gl, scene);
    compileForComposer(gl, scene, camera).then((target) => {
      target.dispose();
      if (!cancelled) onWarm();
    });
    return () => {
      cancelled = true;
    };
  }, [get, onWarm]);
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
  steer: boolean;
  resetCount: number;
  destination: string | null;
  startedOnPage: boolean;
  paused: boolean;
  helmetOff: boolean;
  onReady: () => void;
};

/**
 * If any of the scene's files fails to download, tries the whole scene once more from scratch. A second
 * failure gives up and tells the page, which carries on without the 3D.
 */
export default function SpaceCanvas({ onFailed, ...props }: Props & { onFailed: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const onError = useCallback(() => {
    if (attempt > 0) return onFailed();
    // a failed load stays cached, so the retry would just get the same failure back without this
    for (const url of [ASSETS.astronaut, ASSETS.bust, ASSETS.spaceship]) useGLTF.clear(url);
    forgetMoonMaps();
    setAttempt(attempt + 1);
  }, [attempt, onFailed]);
  return (
    <SceneErrorBoundary key={attempt} onError={onError}>
      <Scene {...props} />
    </SceneErrorBoundary>
  );
}

function Scene({
  pov,
  steer,
  resetCount,
  destination,
  startedOnPage,
  paused,
  helmetOff,
  onReady,
  onImpact,
  onCovered,
  onBackInOrbit,
}: Props) {
  const [warm, setWarm] = useState(false);
  const onWarm = useCallback(() => setWarm(true), []);
  return (
    <Canvas
      flat
      frameloop={!warm ? "never" : paused ? "demand" : "always"}
      onCreated={({ gl }) => {
        // Checking each shader for errors makes the first draw with it wait until it's fully built.
        gl.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
      }}
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
        <CameraRig pov={pov} steer={steer} resetCount={resetCount} startedOnPage={startedOnPage} />
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
        <WarmUp onWarm={onWarm} />
      </Suspense>
    </Canvas>
  );
}
