/** Smooth random noise, the raw material for clouds, rock and dust. */
export const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
`;

/** Noise plus the ring density profile, shared by the planet and ring fragment shaders. */
export const SURFACE_GLSL = /* glsl */ `
  ${NOISE_GLSL}
  uniform float uRingIn, uRingOut;
  // Radial optical depth: faint C ring, bright B ring, Cassini division, A ring, Encke gap.
  // fw = screen-space footprint of x (fwidth). Detail finer than a pixel fades to its mean, so it can't shimmer.
  // Mirrored in lib/space/sunVisibility.ts. Keep the two in step.
  float ringDensity(float r, float fw) {
    float x = (r - uRingIn) / (uRingOut - uRingIn);
    if (x < 0.0 || x > 1.0) return 0.0;
    float a = 0.5, s = 0.0, f = 38.0; vec3 q = vec3(x * 38.0, 0.5, 0.5);
    for (int i = 0; i < 6; i++) { float k = 1.0 - smoothstep(0.45, 1.1, f * fw); s += a * mix(0.5, noise(q), k); q = q * 2.03 + 17.1; f *= 2.03; a *= 0.5; }
    float d = 0.15 + 0.85 * smoothstep(0.25, 0.75, s);
    d *= 0.55 + 0.45 * mix(0.5, noise(vec3(x * 420.0, 1.5, 0.5)), 1.0 - smoothstep(0.45, 1.1, 420.0 * fw));
    d *= mix(0.18, 1.0, smoothstep(0.16, 0.24, x));
    d *= mix(1.0, 0.75, smoothstep(0.66, 0.72, x));
    d *= 1.0 - 0.94 * (smoothstep(0.585, 0.6, x) - smoothstep(0.645, 0.66, x));
    d *= 1.0 - 0.85 * (smoothstep(0.905, 0.91, x) - smoothstep(0.918, 0.923, x));
    d *= smoothstep(0.0, 0.02, x) * (1.0 - smoothstep(0.97, 1.0, x));
    return clamp(d, 0.0, 1.0);
  }
`;

/**
 * Reads the scene's real DirectionalLight and hands it to the fragment shader in planet-local space.
 * 1.22 / PI matches the look of a physically based material lit by the same light.
 */
export const SUN_VARYINGS_GLSL = /* glsl */ `
  varying vec3 vObj, vSunL, vCamL, vSun;
`;
export const SUN_VERTEX_GLSL = /* glsl */ `
  vObj = position;
  mat3 viewToLocal = transpose(mat3(modelViewMatrix));
  vSunL = viewToLocal * directionalLights[0].direction;
  vCamL = viewToLocal * (-modelViewMatrix[3].xyz);
  vSun = directionalLights[0].color * (1.22 / PI);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
`;

export const PLANET_VERTEX = /* glsl */ `
  #include <common>
  #include <lights_pars_begin>
  ${SUN_VARYINGS_GLSL}
  void main() {
    ${SUN_VERTEX_GLSL}
  }
`;

export const PLANET_FRAGMENT = /* glsl */ `
  ${NOISE_GLSL}
  ${SUN_VARYINGS_GLSL}
  uniform float uTime;
  void main() {
    vec3 n = normalize(vObj);
    // the cloud deck rotates slowly; latitude-dependent speed gives the zonal shear
    float lon = atan(n.z, n.x) + uTime * (0.012 + 0.006 * sin(n.y * 9.0));
    float rxz = length(n.xz);
    vec3 q = vec3(cos(lon) * rxz, n.y, sin(lon) * rxz);
    float warp = fbm(q * vec3(4.0, 10.0, 4.0));
    float lat = n.y + 0.035 * (warp - 0.5) + 0.01 * (fbm(q * 18.0) - 0.5);
    float bands = fbm(vec3(lat * 22.0, q.x * 0.4, q.z * 0.4));
    float fine = mix(0.5, noise(vec3(lat * 160.0, q.x * 3.0, q.z * 3.0)), 1.0 - smoothstep(0.2, 0.5, fwidth(lat) * 160.0));
    vec3 col = mix(lin(vec3(0.86, 0.74, 0.52)), lin(vec3(0.62, 0.46, 0.29)), smoothstep(0.36, 0.68, bands));
    col = mix(col, lin(vec3(0.95, 0.90, 0.77)), smoothstep(0.55, 0.85, fine) * 0.3);
    col = mix(col, lin(vec3(0.62, 0.50, 0.36)), smoothstep(0.55, 0.8, abs(n.y)) * 0.5);
    col = mix(col, lin(vec3(0.50, 0.58, 0.66)), smoothstep(0.82, 0.98, abs(n.y)) * 0.55);

    vec3 L = normalize(vSunL), V = normalize(vCamL - vObj);
    float ndl = dot(n, L);
    float diff = clamp((ndl + 0.06) / 1.06, 0.0, 1.0);
    float mu = max(dot(n, V), 0.0);
    float limb = 0.55 + 0.45 * pow(mu, 0.45);

    vec3 c = col * diff * limb * vSun;
    float rim = pow(1.0 - mu, 5.0) * smoothstep(-0.15, 0.35, ndl);
    c += lin(vec3(0.95, 0.88, 0.70)) * rim * 1.2;
    c += col * 0.004;
    // backlit: sunlight forward-scattered through the upper atmosphere, the bright limb during eclipse
    float fwd = pow(max(dot(-V, L), 0.0), 8.0);
    c += lin(vec3(1.0, 0.82, 0.58)) * pow(1.0 - mu, 7.0) * fwd * 9.0;
    gl_FragColor = vec4(c, 1.0);
  }
`;

export const RING_VERTEX = /* glsl */ `
  #include <common>
  #include <lights_pars_begin>
  #include <shadowmap_pars_vertex>
  ${SUN_VARYINGS_GLSL}
  void main() {
    ${SUN_VERTEX_GLSL}
    vec3 transformedNormal = normalMatrix * normal;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    #include <shadowmap_vertex>
  }
`;

export const RING_FRAGMENT = /* glsl */ `
  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>
  ${SURFACE_GLSL}
  ${SUN_VARYINGS_GLSL}
  void main() {
    float r = length(vObj.xz);
    float dens = ringDensity(r, fwidth(r) / (uRingOut - uRingIn));
    if (dens < 0.004) discard;
    vec3 L = normalize(vSunL);
    float x = (r - uRingIn) / (uRingOut - uRingIn);
    vec3 col = mix(lin(vec3(0.55, 0.47, 0.38)), lin(vec3(0.88, 0.78, 0.62)), smoothstep(0.2, 0.55, x));
    col *= 0.85 + 0.3 * mix(0.5, noise(vec3(r * 140.0, 0.3, 0.7)), 1.0 - smoothstep(0.2, 0.5, fwidth(r) * 140.0));

    // The planet's shadow across the rings, from the real light's shadow map.
    // Not fully black, so the rings still read through it.
    float shadow = mix(0.2, 1.0, getShadowMask());

    // One illumination curve for both faces. The face away from the sun only gets light diffused through the
    // ring, so it's never brighter than the lit face. The faces blend over a wide band of sun elevation, and an
    // edge-on sun only dims the rings, never to black.
    float face = min(0.12 + 1.6 * abs(L.y), 0.9);
    float through = face * (0.15 + 0.7 * (1.0 - dens));
    float lit = mix(through, face, smoothstep(-0.2, 0.2, L.y * sign(vCamL.y)));
    lit *= mix(0.35, 1.0, smoothstep(0.0, 0.12, abs(L.y)));
    vec3 c = col * lit * shadow * vSun * 0.9;
    vec3 V = normalize(vCamL - vObj);
    float fwd = pow(max(dot(-V, L), 0.0), 5.0);
    c += lin(vec3(1.0, 0.86, 0.66)) * fwd * dens * (1.0 - dens) * 3.0 * shadow * vSun;
    c += col * 0.012 * vSun;
    gl_FragColor = vec4(c, 1.0 - exp(-4.5 * dens));
  }
`;

export const SKY_FRAGMENT = /* glsl */ `
  ${SURFACE_GLSL}
  uniform vec3 uBand;
  varying vec3 vD;
  void main() {
    float k = dot(vD, uBand);
    float glow = exp(-k * k / 0.03) * (0.35 + fbm(vD * 5.0)) * (0.6 + 0.8 * fbm(vD * 14.0 + 3.0));
    float dust = smoothstep(0.45, 0.75, fbm(vD * 9.0 + 7.0)) * exp(-k * k / 0.006);
    gl_FragColor = vec4(vec3(0.016, 0.014, 0.018) * glow * (1.0 - 0.8 * dust), 1.0);
  }
`;
