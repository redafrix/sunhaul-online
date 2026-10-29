// Predicted circular contact uses the server's rotated footprints and rounded box corners.
import { footprint } from './physics-geometry.js';
const shapes = new WeakMap();

function shape(entry) {
  if (!shapes.has(entry)) {
    const f = footprint(entry.placement, entry.asset);
    f.co = Math.cos(f.angle);
    f.si = Math.sin(f.angle);
    f.reach = f.type === 'circle' ? f.r : Math.hypot(f.hx, f.hz);
    shapes.set(entry, f);
  }
  return shapes.get(entry);
}

function project(x, z, radius, entry) {
  const f = shape(entry);
  const co = f.co;
  const si = f.si;
  const dx = x - f.x;
  const dz = z - f.z;
  if (Math.abs(dx) > f.reach + radius + .02 || Math.abs(dz) > f.reach + radius + .02) return { x, z };
  let lx = co * dx + si * dz;
  let lz = -si * dx + co * dz;
  const qx = f.type === 'circle' ? 0 : Math.max(-f.hx, Math.min(f.hx, lx));
  const qz = f.type === 'circle' ? 0 : Math.max(-f.hz, Math.min(f.hz, lz));
  const ox = lx - qx;
  const oz = lz - qz;
  const distance = Math.hypot(ox, oz);
  const clearance = radius + .02 + (f.type === 'circle' ? f.r : 0);
  if (distance >= clearance) return { x, z };
  if (distance > .00001) {
    lx = qx + ox / distance * clearance;
    lz = qz + oz / distance * clearance;
  } else if (f.type === 'circle') {
    lx = clearance;
  } else if (f.hx - Math.abs(lx) < f.hz - Math.abs(lz)) {
    lx = (lx < 0 ? -1 : 1) * (f.hx + clearance);
  } else {
    lz = (lz < 0 ? -1 : 1) * (f.hz + clearance);
  }
  return { x: f.x + co * lx - si * lz, z: f.z + si * lx + co * lz };
}

export function moveOnMap(position, dx, dz, radius, colliders, height, waterLevel) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .18));
  let x = position.x;
  let z = position.z;
  for (let step = 0; step < steps; step++) {
    const oldX = x;
    const oldZ = z;
    const previous = height(x, z);
    const allowed = (a, b) => height(a, b) >= waterLevel - .15 && Math.abs(height(a, b) - previous) <= 1.4;
    x += dx / steps;
    z += dz / steps;
    for (let pass = 0; pass < 2; pass++) {
      for (const collider of colliders) ({ x, z } = project(x, z, radius, collider));
    }
    if (!allowed(x, z)) {
      if (allowed(x, oldZ)) z = oldZ;
      else if (allowed(oldX, z)) x = oldX;
      else { x = oldX; z = oldZ; }
    }
  }
  position.x = x;
  position.z = z;
  position.y = height(x, z);
  return position;
}
