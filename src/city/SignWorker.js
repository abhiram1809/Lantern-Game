// A page of shop signs (city/Signs.js) compressed, in a worker: its signs' pixels put in their places, then Basis
// Universal's encoder (public/basis: Apache-2.0, Binomial LLC, its NOTICE there) makes a KTX2 file of it, UASTC 4×4
// with sRGB mipmaps, as the props are (level 1: 47 dB on a page of signs, about 3 s), its rows bottom first like the
// page's (flipY). The encoder is single-threaded: no cross-origin isolation needed.
// (the encoder's from the game's own base, which the page sends with each page: a classic worker has no
// import.meta, and the game can be served under a subpath)
let ready = null;
const encoder = (base) => {
  importScripts(`${base}basis/basis_encoder.js`);
  return BASIS({ locateFile: (f) => `${base}basis/${f}`, print() {}, printErr() {} }).then((M) => { M.initializeBasis(); return M; });
};

onmessage = async ({ data: { size, parts, base } }) => {
  try {
    const M = await (ready ??= encoder(base)), rgba = new Uint8Array(size * size * 4);
    for (const { x, y, w, h, data } of parts) {
      const d = new Uint8Array(data);
      for (let r = 0; r < h; r++) rgba.set(d.subarray(r * w * 4, (r + 1) * w * 4), ((y + r) * size + x) * 4);
    }
    const e = new M.BasisEncoder();
    try {
      e.setSliceSourceImage(0, rgba, size, size, M.ldr_image_type.cRGBA32.value);
      e.setFormatMode(M.basis_tex_format.cUASTC_LDR_4x4.value);
      e.setPackUASTCFlags(1);
      e.setMipGen(true); e.setMipSRGB(true); e.setPerceptual(true); e.setYFlip(true);
      e.setCreateKTX2File(true); e.setKTX2UASTCSupercompression(true); e.setKTX2AndBasisSRGBTransferFunc(true);
      const out = new Uint8Array(size * size * 2), n = e.encode(out);
      if (!n) throw new Error('the encoder made nothing');
      const ktx2 = out.slice(0, n).buffer;
      postMessage({ ktx2 }, [ktx2]);
    } finally {
      e.delete();
    }
  } catch (err) {
    postMessage({ error: String(err?.message ?? err) });
  }
};
