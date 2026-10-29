// Gameplay shapes derived from the same harbour dressing dimensions used by the renderer.
// Cached per recipe so floor queries and prediction do not rebuild scenery every frame.
import { terrainHeight } from './map-math.js';
import { placements } from './physics-geometry.js';
const cache = new WeakMap();

export function localPoint(item, x, z) {
  const angle = (item.r || 0) * Math.PI / 180;
  const dx = x - item.p[0];
  const dz = z - item.p[2];
  return { x: Math.cos(angle) * dx - Math.sin(angle) * dz,
    z: Math.sin(angle) * dx + Math.cos(angle) * dz };
}

export function mapGeometry(recipe) {
  if (cache.has(recipe)) return cache.get(recipe);
  const dressing = recipe.dressing || {};
  const replaced = new Set(dressing.replaceProps || []);
  const props = [...placements(recipe), ...(dressing.props || [])].filter(p => !replaced.has(p.id));
  const solids = [];
  const floors = [];
  function box(id, item, half, offset = [0, 0]) {
    solids.push({ placement: { id, p: item.p, r: item.r || 0 },
      asset: { collider: { type: 'box', half, offset }, ropeContact: true } });
  }
  for (const [index, house] of (dressing.houses || []).entries()) {
    box(`house-${index}`, house, [house.size[0] / 2 + .06, house.size[2] / 2 + .06]);
  }
  for (const [index, wall] of (dressing.seawalls || []).entries()) {
    box(`seawall-${index}`, wall, [(wall.w + .18) / 2, .49], [0, -.08]);
  }
  for (const [index, arch] of (dressing.arches || []).entries()) {
    for (const side of [-1, 1]) box(`arch-${index}-${side}`, arch, [.425, .55], [side * arch.w / 2, 0]);
  }
  for (const terrace of dressing.terraces || []) {
    floors.push({ ...terrace, half: [terrace.size[0] / 2, terrace.size[2] / 2], height: terrace.p[1] + terrace.size[1] + .065 });
  }
  for (const stair of dressing.stairs || []) {
    floors.push({ ...stair, stair: true, length: ((stair.steps || 12) - 1) * .46 });
  }
  for (const prop of props) {
    if (prop.a !== 'pirate/Environment_Dock' || prop.walkable === false) continue;
    const scale = Array.isArray(prop.s) ? prop.s : Array(3).fill(prop.s ?? 1);
    floors.push({ ...prop, half: [1.09 * scale[0], 1.32 * scale[2]], height: prop.p[1] + scale[1] });
  }
  for (const [index, planter] of (dressing.planters || []).entries()) {
    box(`planter-${index}`, planter, [(planter.size?.[0] || 2.4) / 2, (planter.size?.[1] || .7) / 2]);
  }
  for (const [index, crane] of (dressing.cranes || []).entries()) {
    box(`crane-base-${index}`, crane, [1.4, 1.3]);
  }
  for (const [index, cliff] of (dressing.cliffs || []).entries()) {
    const floor = terrainHeight(recipe, cliff.p[0], cliff.p[2]);
    if (cliff.p[1] + cliff.size[1] > floor + .3) {
      box(`cliff-${index}`, cliff, [cliff.size[0] * .34, cliff.size[2] * .34]);
    }
  }
  const result = { props, solids, floors };
  cache.set(recipe, result);
  return result;
}

export function sceneryHeight(recipe, x, z, base) {
  let height = base;
  for (const surface of mapGeometry(recipe).floors) {
    const local = localPoint(surface, x, z);
    if (surface.stair) {
      if (Math.abs(local.x) > (surface.w || 2.1) / 2 || local.z > .245 || local.z < -surface.length - .245) continue;
      const progress = Math.max(1 / (surface.steps || 12), Math.min(1, (.245 - local.z) / (surface.length + .245)));
      height = Math.max(height, surface.p[1] + surface.rise * progress);
    } else if (Math.abs(local.x) <= surface.half[0] && Math.abs(local.z) <= surface.half[1]) {
      height = Math.max(height, surface.height);
    }
  }
  return height;
}

// Skip scenery buried below the visible floor or mounted wholly above a Keeper's head.
export function collisionEntries(recipe, catalog) {
  const geometry = mapGeometry(recipe);
  const entries = geometry.props.filter(prop => {
    const asset = catalog[prop.a];
    if (!asset || prop.collide === false || asset.collider.type === 'none' || prop.visual === 'harbour-crane') return false;
    if (!asset.bounds) return true;
    const scale = Array.isArray(prop.s) ? prop.s[1] : prop.s ?? 1;
    const floor = sceneryHeight(recipe, prop.p[0], prop.p[2], terrainHeight(recipe, prop.p[0], prop.p[2]));
    // A roof crane's hanging rope extends its bounds to street level; its boom is overhead.
    if (prop.a === 'harbour/Crane' && prop.p[1] > floor + 2) return false;
    return prop.p[1] + asset.bounds.max[1] * scale > floor + .08
      && prop.p[1] + asset.bounds.min[1] * scale < floor + 2;
  }).map(placement => ({ placement, asset: placement.a === 'harbour/QuayLamp'
    ? { ...catalog[placement.a], collider: { type: 'circle', r: .16 } } : catalog[placement.a] }));
  return entries.concat(geometry.solids);
}
