"use client";

import { useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { driftMoons, MOON_WORLDS, MOONS, type MoonSpec } from "@/lib/space/moons";
import { space } from "@/lib/space/state";
import { NOISE_GLSL, SUN_VARYINGS_GLSL, SUN_VERTEX_GLSL } from "./shaders";

/*
  The moons are wrapped in real data: NASA's color and elevation maps of our own Moon, measured by the
  Lunar Reconnaissance Orbiter. The elevation map shades every crater from the sun's real direction.
  Those maps run out of detail up close, so a repeating patch of finer terrain takes over as the camera arrives.
*/
/** Turns the familiar side of the Moon, with its dark seas, toward the opening view. */
const NEAR_SIDE_TOWARD_US = new THREE.Euler(0, -Math.PI / 2, 0);
/** A slow turn on each moon's own axis, in radians per second. */
const SPIN_SPEED = 0.01;

const MOON_VERTEX = /* glsl */ `
  #include <common>
  #include <lights_pars_begin>
  ${SUN_VARYINGS_GLSL}
  varying vec2 vUv;
  void main() {
    vUv = uv;
    ${SUN_VERTEX_GLSL}
  }
`;

const MOON_FRAGMENT = /* glsl */ `
  ${NOISE_GLSL}
  ${SUN_VARYINGS_GLSL}
  uniform sampler2D uColor, uHeight, uDetail;
  uniform vec3 uTint;
  uniform float uSeed;
  uniform int uWorld;
  varying vec2 vUv;

  // Each world paints its own surface. rock (0) keeps NASA's colors as they are.
  // relief: how much terrain shows. haze: the color of any atmosphere.
  vec3 paint(vec3 dir, vec3 map, float rise, out float relief, out vec3 haze) {
    vec3 p = dir + uSeed;
    float grey = dot(map, vec3(0.333));
    float big = fbm(p * 2.2), mid = fbm(p * 7.0 + 3.0);
    relief = 1.0; haze = vec3(0.0);

    if (uWorld == 1) { // ice: pale shell crossed by rust-stained cracks
      relief = 0.25;
      float warp = fbm(p * 3.0);
      float cracks = abs(noise(p * 6.0 + warp * 3.0) - 0.5) * abs(noise(p * 13.0 - warp * 2.0) - 0.5);
      vec3 shell = mix(vec3(0.72, 0.8, 0.86), vec3(0.93, 0.92, 0.88), big);
      return mix(vec3(0.42, 0.2, 0.1), shell, smoothstep(0.0, 0.012, cracks));
    }
    if (uWorld == 2) { // sulfur: yellow and orange plains, black vents ringed in red
      relief = 0.35;
      vec3 c = mix(vec3(0.82, 0.62, 0.14), vec3(0.93, 0.84, 0.42), smoothstep(0.3, 0.7, mid));
      c = mix(c, vec3(0.62, 0.27, 0.07), smoothstep(0.5, 0.68, big));
      float vent = noise(p * 9.0);
      c = mix(c, vec3(0.55, 0.1, 0.04), smoothstep(0.7, 0.76, vent));
      return mix(c, vec3(0.04, 0.03, 0.03), smoothstep(0.77, 0.81, vent));
    }
    if (uWorld == 3) { // rust: red desert, dark basalt, frosted poles
      vec3 c = mix(vec3(0.52, 0.2, 0.09), vec3(0.8, 0.46, 0.24), smoothstep(0.32, 0.68, mid));
      c = mix(c, vec3(0.2, 0.12, 0.1), smoothstep(0.52, 0.66, big));
      c *= 0.75 + 0.5 * grey;
      return mix(c, vec3(0.92, 0.9, 0.88), smoothstep(0.8, 0.86, abs(dir.y) + 0.1 * (mid - 0.5)));
    }
    if (uWorld == 4) { // two-tone: one bright hemisphere, one coal black, with a ragged border
      float side = dir.x + dir.z * 0.4 + 0.5 * (big - 0.5);
      return mix(vec3(0.05, 0.04, 0.035), vec3(0.8, 0.77, 0.7) * (0.6 + grey), smoothstep(-0.05, 0.08, side));
    }
    if (uWorld == 5) { // basalt: dark, plum-grey rock with all of the real terrain
      return mix(vec3(0.05, 0.045, 0.055), vec3(0.2, 0.17, 0.2), smoothstep(0.15, 0.6, grey)) * (0.8 + 0.4 * big);
    }
    if (uWorld == 6) { // haze: thick orange atmosphere, no surface in sight
      relief = 0.0;
      haze = vec3(0.95, 0.55, 0.2);
      float bands = fbm(vec3(dir.y * 7.0, p.x * 0.7, p.z * 0.7));
      return mix(vec3(0.68, 0.42, 0.18), vec3(0.88, 0.66, 0.36), bands);
    }
    if (uWorld == 7) { // ocean: deep blue water under white cloud
      relief = 0.0;
      haze = vec3(0.35, 0.6, 1.0);
      vec3 sea = mix(vec3(0.015, 0.07, 0.22), vec3(0.03, 0.2, 0.38), mid);
      float swirl = fbm(p * 3.0 + 2.0 * fbm(p * 2.0));
      return mix(sea, vec3(0.92, 0.94, 0.97), smoothstep(0.5, 0.64, swirl));
    }
    return map;
  }

  float elevation(vec2 uv) { return texture2D(uHeight, uv).r; }

  // Fine terrain from a small repeating tile. Its mipmaps average out to flat when it's far away,
  // so this fades by itself with distance and can't speckle.
  vec2 detailSlope(vec2 uv, float offset) {
    return vec2(
      texture2D(uDetail, uv + vec2(offset, 0.0)).r - texture2D(uDetail, uv - vec2(offset, 0.0)).r,
      texture2D(uDetail, uv + vec2(0.0, offset)).r - texture2D(uDetail, uv - vec2(0.0, offset)).r
    );
  }

  void main() {
    vec3 dir = normalize(vObj);
    vec2 uv = vUv + vec2(uSeed * 0.137, 0.0); // each moon gets a different stretch of terrain

    // the two directions along the surface here: east and north
    vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), dir));
    vec3 north = cross(dir, east);

    float relief; vec3 haze;
    vec3 surface = paint(dir, texture2D(uColor, uv).rgb, elevation(uv), relief, haze);

    // the real terrain: slope from how elevation changes between neighboring points on NASA's map
    vec2 step = vec2(1.0 / 5760.0, 1.0 / 2880.0);
    vec2 slope = vec2(
      elevation(uv + vec2(step.x, 0.0)) - elevation(uv - vec2(step.x, 0.0)),
      elevation(uv + vec2(0.0, step.y)) - elevation(uv - vec2(0.0, step.y))
    ) * 10.0;

    // finer terrain at two scales, for when the map runs out of detail up close
    vec2 tileUv = uv * vec2(2.0, 1.0);
    vec2 coarse = tileUv * 48.0, fine = tileUv * 400.0;
    slope += detailSlope(coarse, 1.0 / 512.0) * 1.2 + detailSlope(fine, 1.0 / 512.0) * 0.7;
    slope *= relief;
    vec3 n = normalize(dir - east * slope.x - north * slope.y);

    float grain = texture2D(uDetail, coarse).r + texture2D(uDetail, fine).r - 1.0;
    vec3 albedo = surface * uTint * (1.0 + grain * 0.35 * max(relief, 0.15));

    vec3 L = normalize(vSunL);
    // the moon's bulk shadows its own night side, whatever the local slope says
    float light = max(dot(n, L), 0.0) * smoothstep(-0.03, 0.08, dot(dir, L));
    // a little light reflected off the big planet, so the night side is dim instead of pure black
    vec3 c = albedo * (light * vSun * 1.5 + vec3(0.095, 0.082, 0.063));

    // an atmosphere shows as a soft sunlit rim
    float edge = 1.0 - max(dot(dir, normalize(vCamL - vObj)), 0.0);
    c += haze * pow(edge, 3.0) * smoothstep(-0.2, 0.3, dot(dir, L)) * 0.7;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const DETAIL_SIZE = 512;

/** A repeating patch of lumpy ground and small craters, built once. Everything wraps at the edges so it tiles. */
function detailTexture() {
  const n = DETAIL_SIZE;
  let seed = 41;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const height = new Float32Array(n * n).fill(0.5);

  // lumpy ground: smooth random grids at increasing fineness
  for (let cells = 8, amplitude = 0.26; cells <= 256; cells *= 2, amplitude *= 0.6) {
    const grid = Float32Array.from({ length: cells * cells }, () => random() - 0.5);
    const smooth = (t: number) => t * t * (3 - 2 * t);
    for (let y = 0; y < n; y++) {
      const gy = (y / n) * cells, iy = Math.floor(gy), fy = smooth(gy - iy);
      for (let x = 0; x < n; x++) {
        const gx = (x / n) * cells, ix = Math.floor(gx), fx = smooth(gx - ix);
        const at = (a: number, b: number) => grid[(b % cells) * cells + (a % cells)];
        const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
        const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
        height[y * n + x] += amplitude * (top + (bottom - top) * fy);
      }
    }
  }

  // craters: shallow bowls with soft raised rims, many small and a few large
  for (let i = 0; i < 260; i++) {
    const radius = 3 + Math.pow(random(), 4) * 44;
    const cx = random() * n, cy = random() * n, depth = 0.05 + 0.1 * random();
    const reach = Math.ceil(radius * 1.5);
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const d = Math.hypot(dx, dy) / radius;
        if (d > 1.5) continue;
        const bowl = d < 1 ? -(1 - d * d) : 0;
        const rim = Math.exp(-Math.pow((d - 1) / 0.18, 2)) * 0.28;
        const px = (Math.round(cx) + dx + n) % n, py = (Math.round(cy) + dy + n) % n;
        height[py * n + px] += depth * (bowl + rim);
      }
    }
  }

  const data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const v = Math.min(255, Math.max(0, height[i] * 255));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

type MoonMaps = { color: THREE.Texture; height: THREE.Texture; detail: THREE.Texture };

function Moon({ spec, color, height, detail }: MoonMaps & { spec: MoonSpec }) {
  const uniforms = useMemo(
    () =>
      THREE.UniformsUtils.merge([
        THREE.UniformsLib.lights,
        { uTint: { value: new THREE.Color(spec.tint) }, uSeed: { value: spec.seed }, uWorld: { value: MOON_WORLDS.indexOf(spec.world) }, uColor: { value: null }, uHeight: { value: null }, uDetail: { value: null } },
      ]),
    [spec],
  );

  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!mesh.current) return;
    mesh.current.position.copy(spec.position);
    mesh.current.rotation.y = NEAR_SIDE_TOWARD_US.y + drift.seconds * SPIN_SPEED * (spec.seed % 2 < 1 ? 1 : -1);
  });

  return (
    <mesh ref={mesh} position={spec.position} rotation={NEAR_SIDE_TOWARD_US}>
      <sphereGeometry args={[spec.radius, 192, 128]} />
      <shaderMaterial
        lights
        uniforms={uniforms}
        uniforms-uColor-value={color}
        uniforms-uHeight-value={height}
        uniforms-uDetail-value={detail}
        vertexShader={MOON_VERTEX}
        fragmentShader={MOON_FRAGMENT}
      />
    </mesh>
  );
}

/** How far the moons have drifted. It only runs in orbit: during a trip a moon holds still, so the landing hits it exactly. */
const drift = { seconds: 0 };

export function Moons() {
  useFrame((_, delta) => {
    if (space.cameraOwner === "landing") return;
    drift.seconds += Math.min(delta, 0.1);
    driftMoons(drift.seconds);
  }, -1);

  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const [color, height] = useTexture(["/textures/moon-color.jpg", "/textures/moon-height.jpg"], (textures) => {
    const [colorMap, heightMap] = textures as THREE.Texture[];
    colorMap.colorSpace = THREE.SRGBColorSpace;
    for (const map of [colorMap, heightMap]) {
      map.wrapS = THREE.RepeatWrapping;
      map.anisotropy = maxAnisotropy;
    }
  });
  const detail = useMemo(() => detailTexture(), []);
  return MOONS.filter((spec) => !spec.ship && !spec.unlisted).map((spec) => <Moon key={spec.id} spec={spec} color={color} height={height} detail={detail} />);
}
