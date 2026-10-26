import { segmentDistance } from './map-math.js';
// The same temporary crossing footprint drives server collision and client prediction.
export function onCrossing(effect,x,z,time=0){
 if(effect.until<=time||!['icebridge','vinebridge','grapple'].includes(effect.kind))return false;
 return effect.a&&effect.b?segmentDistance(x,z,[effect.a.x,effect.a.z],[effect.b.x,effect.b.z])<(effect.width||1.6)/2:Math.hypot(x-effect.x,z-effect.z)<effect.radius;
}
