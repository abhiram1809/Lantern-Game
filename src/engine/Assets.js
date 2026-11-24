export function assetUrl(path) {
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}

// Track each requested asset through download and decode. Where the server omits the
// transfer size, the asset contributes when it is ready.
export function trackAssets(count, report) {
  const fractions = Array(count).fill(0);
  let next = 0;
  let ready = 0;
  const update = () => report(fractions.reduce((sum, value) => sum + value, 0) / count, `${ready} of ${count} ready`);
  update();

  return async (load) => {
    const index = next++;
    const asset = await load((event) => {
      if (event.lengthComputable && event.total > 0) {
        fractions[index] = Math.min(0.99, event.loaded / event.total);
        update();
      }
    });
    fractions[index] = 1;
    ready++;
    update();
    return asset;
  };
}
