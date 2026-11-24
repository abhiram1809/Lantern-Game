import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

// GPU-compressed textures: the props', the people's and the surfaces' (KTX2, UASTC, written by
// tools/texture-fit.mjs). They stay compressed on the GPU (ASTC or BC7, a quarter of RGBA8); the transcoder
// (three's own Basis build, which the bundle carries under a hashed name, so it always matches three) runs in
// workers. `ktx2Support(renderer)` once, before anything loads; GLTF loaders take `ktx2` (`setKTX2Loader`).
export const ktx2 = new KTX2Loader().setWorkerLimit(4);
let gpu = null;
export const ktx2Support = (renderer) => { gpu = renderer; return ktx2.detectSupport(renderer); };

// A compressed texture's average colour (linear, its opaque texels only), for the far copies drawn in one colour a
// part (city/Lod.js): the canvas can't read a compressed image, so it's worked out on the GPU, 8 × 8 samples of the
// mip about that size drawn into one pixel and read back (square-rooted into the byte, for the darks). Null when
// it isn't in yet, or is all clear.
const avg = {};
export function averageColour(tex) {
  if (!gpu || !tex?.isCompressedTexture || !tex.mipmaps?.length) return null;
  if (!avg.mat) {
    avg.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, lod: { value: 0 } },
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D map; uniform float lod;
        void main() {
          vec4 s = vec4(0.0);
          for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) { vec4 c = textureLod(map, (vec2(i, j) + 0.5) / 8.0, lod); float w = step(0.5, c.a); s += vec4(c.rgb * w, w); }
          gl_FragColor = vec4(sqrt(s.rgb / max(s.a, 1.0)), s.a / 64.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), avg.mat);
    quad.frustumCulled = false;
    avg.scene = new THREE.Scene().add(quad);
    avg.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    avg.rt = new THREE.WebGLRenderTarget(1, 1);
    avg.px = new Uint8Array(4);
  }
  avg.mat.uniforms.map.value = tex;
  avg.mat.uniforms.lod.value = Math.max(0, Math.min(tex.mipmaps.length - 1, Math.log2(Math.max(tex.image.width, tex.image.height)) - 3));
  const prev = gpu.getRenderTarget();
  gpu.setRenderTarget(avg.rt);
  gpu.render(avg.scene, avg.cam);
  gpu.setRenderTarget(prev);
  gpu.readRenderTargetPixels(avg.rt, 0, 0, 1, 1, avg.px);
  avg.mat.uniforms.map.value = null;
  const [r, g, b, a] = avg.px;
  return a ? new THREE.Color().setRGB((r / 255) ** 2, (g / 255) ** 2, (b / 255) ** 2) : null;
}

// A KTX2 image as a texture at once (as TextureLoader gives one), filled in when it's transcoded. Its copies
// (`clone()`, each with its own repeat) share the image but each holds its own list of mips, so every copy is
// kept and filled in with the first. `image.src` is the file (the rain finds the wet surfaces by it).
class Ktx2Texture extends THREE.CompressedTexture {
  // (nothing to upload before it's in: a compressed texture without mips throws in the upload)
  set needsUpdate(v) { if (this.mipmaps?.length) super.needsUpdate = v; }
  copy(source) {
    super.copy(source);
    this.copies = source.copies;
    this.copies?.push(this);
    return this;
  }
}
export function ktx2Texture(url) {
  const t = new Ktx2Texture([], 4, 4);
  t.image = { width: 4, height: 4, src: url };
  t.copies = [t];
  ktx2.load(url, (k) => {
    t.source.data = { width: k.image.width, height: k.image.height, src: url };
    // (copies made from here on copy the mips themselves)
    for (const c of t.copies) {
      Object.assign(c, { mipmaps: k.mipmaps, format: k.format, type: k.type, minFilter: k.minFilter, premultiplyAlpha: k.premultiplyAlpha, copies: null });
      c.needsUpdate = true;
    }
    k.dispose();
  }, undefined, (e) => console.warn(`${url}:`, e));
  return t;
}
