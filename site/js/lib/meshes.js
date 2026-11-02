// Meshes for paper things: prints that curl a little, tape, stickers.
import * as THREE from 'three';

export const canvasTexture = (canvas, { srgb = true, anisotropy = 8 } = {}) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
};

// Plane with gentle paper deformation: `curl` lifts both short ends, `cup`
// bows the long edges, `lift` raises one corner (positive x, positive y).
export const paperGeometry = (width, height, { curl = 0, cup = 0, lift = 0, segments = [10, 36] } = {}) => {
  const geometry = new THREE.PlaneGeometry(width, height, segments[0], segments[1]);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const nx = position.getX(index) / (width / 2);
    const ny = position.getY(index) / (height / 2);
    const corner = Math.max(0, nx) * Math.max(0, ny);
    const z = curl * ny * ny * height * 0.05 + cup * nx * nx * width * 0.05 + lift * corner * corner * Math.min(width, height) * 0.08;
    position.setZ(index, z);
  }
  geometry.computeVertexNormals();
  return geometry;
};

export const printMesh = (canvas, width, {
  gloss = 0.4, roughness = 0.6, curl = 0, cup = 0, lift = 0, transparent = false, alphaTest = 0, physical = true, segments,
} = {}) => {
  const height = (width * canvas.height) / canvas.width;
  const map = canvasTexture(canvas);
  const options = {
    map,
    roughness,
    side: THREE.DoubleSide,
    transparent,
    alphaTest,
  };
  const material = physical
    ? new THREE.MeshPhysicalMaterial({ ...options, clearcoat: gloss, clearcoatRoughness: 0.14 })
    : new THREE.MeshStandardMaterial(options);
  const mesh = new THREE.Mesh(paperGeometry(width, height, { curl, cup, lift, segments }), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.size = { width, height };
  return mesh;
};

// Places `child` on `parent`'s surface at a local (x, y), with a tilt and height.
export const pin = (parent, child, { x = 0, y = 0, z = 0.02, rotate = 0 } = {}) => {
  child.position.set(x, y, z);
  child.rotation.z = rotate;
  parent.add(child);
  return child;
};
