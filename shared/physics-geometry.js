import { scatterProps } from './scatter.js';
export function placements(recipe) { return [...recipe.props,...scatterProps(recipe)].map((p,i)=>({...p,id:p.id||`prop-${i}`})); }
export function footprint(p,a,padding=0) {
 const s=Array.isArray(p.s)?p.s:[p.s??1,p.s??1,p.s??1],c=a.collider,angle=-(p.r||0)*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);
 const ox=(c.offset?.[0]||0)*s[0],oz=(c.offset?.[1]||0)*s[2];
 const x=p.p[0]+co*ox-si*oz,z=p.p[2]+si*ox+co*oz;
 const r=c.r*Math.max(s[0],s[2]),hx=c.half?.[0]*s[0],hz=c.half?.[1]*s[2];
 const local=c.type==='circle'?Array.from({length:12},(_,i)=>[(r+padding)*Math.cos(i*Math.PI/6),(r+padding)*Math.sin(i*Math.PI/6)]):[[-hx-padding,-hz-padding],[hx+padding,-hz-padding],[hx+padding,hz+padding],[-hx-padding,hz+padding]];
 return {id:p.id,x,z,angle,type:c.type,r,hx,hz,points:local.map(([a,b])=>({x:x+co*a-si*b,z:z+si*a+co*b})),ropeContact:p.ropeContact??a.ropeContact,dynamic:p.dynamic??a.dynamic};
}
