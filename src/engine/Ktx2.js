import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

// GPU-compressed textures: the props', the people's and the surfaces' (KTX2, UASTC, written by
// tools/texture-fit.mjs). They stay compressed on the GPU (ASTC or BC7, a quarter of RGBA8); the transcoder
// (three's own Basis build, which the bundle carries under a hashed name, so it always matches three) runs in
// workers. `ktx2Support(renderer)` once, before anything loads; GLTF loaders take `ktx2` (`setKTX2Loader`).
export const ktx2 = new KTX2Loader().setWorkerLimit(4);
export const ktx2Support = (renderer) => ktx2.detectSupport(renderer);

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
