// Baked textures: fetched and decoded off the main thread (createImageBitmap),
// then uploaded to the GPU one per frame so no frame pays for a batch.
import * as THREE from 'three';

const BASE = new URL('../../assets/tex/', import.meta.url);
const cache = new Map();
const uploads = [];

const decode = async (name) => {
  const response = await fetch(new URL(`${name}.webp`, BASE));
  if (!response.ok) throw new Error(`texture ${name}: ${response.status}`);
  return createImageBitmap(await response.blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
};

export const texture = (name, { srgb = true, repeat = null } = {}) => {
  if (cache.has(name)) return cache.get(name);
  const promise = decode(name).then((bitmap) => {
    const tex = new THREE.Texture(bitmap);
    tex.flipY = false;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 8;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if (repeat) {
      tex.wrapS = THREE.MirroredRepeatWrapping;
      tex.wrapT = THREE.MirroredRepeatWrapping;
      tex.repeat.set(...repeat);
    }
    tex.needsUpdate = true;
    tex.userData.size = { w: bitmap.width, h: bitmap.height };
    uploads.push(tex);
    return tex;
  });
  cache.set(name, promise);
  return promise;
};

export const textures = (names) => Promise.all(names.map((name) => texture(name)));

// Call once per frame: uploads at most one decoded texture.
export const uploadOne = (renderer) => {
  const next = uploads.shift();
  if (next) renderer.initTexture(next);
  return uploads.length;
};

export const pendingUploads = () => uploads.length;
