import * as THREE from "three";

/**
 * Builds every shader the scene needs without blocking, and resolves once they're really done. The scene is
 * drawn into the EffectComposer's render target, and three.js builds a different shader for a render target
 * (linear output) than for the canvas (sRGB), so compile against a render target or the work is wasted.
 */
export async function compileForComposer(gl: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera) {
  const target = new THREE.WebGLRenderTarget(1, 1);
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  const compiled = gl.compileAsync(scene, camera); // the compile itself happens right here; only the wait is async
  gl.setRenderTarget(previous);
  await compiled;
  return target;
}

/** Sends every texture under `root` to the GPU now, instead of on the first frame that draws it. */
export function uploadTextures(gl: THREE.WebGLRenderer, root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of [object.material].flat() as THREE.Material[]) {
      const uniforms = material instanceof THREE.ShaderMaterial ? Object.values(material.uniforms).map(({ value }) => value) : [];
      for (const value of [...Object.values(material), ...uniforms]) if (value instanceof THREE.Texture) gl.initTexture(value);
    }
  });
}
