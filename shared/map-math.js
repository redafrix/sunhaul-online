export function seeded(seed=1){let s=seed>>>0;return()=>{s+=0x6d2b79f5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function inPolygon(x,z,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
export function pathDistance(x,z,pts){let d=Infinity;for(let i=1;i<pts.length;i++)d=Math.min(d,segmentDistance(x,z,pts[i-1],pts[i]));return d;}
export function borderDistance(x,z,poly){let d=Infinity;for(let i=0;i<poly.length;i++)d=Math.min(d,segmentDistance(x,z,poly[i],poly[(i+1)%poly.length]));return d;}
export function terrainHeight(recipe,x,z){
 const t=recipe.terrain,n=t.noise||{};
 let h=(t.base??0)+(n.amp??.25)*(Math.sin(x*(n.freq??.045)+recipe.seed)*Math.cos(z*(n.freq??.045)*1.3)+Math.sin((x+z)*.12)*.3);
 for(const p of t.plateaus||[]){const d=borderDistance(x,z,p.poly),w=p.blend??2,inside=inPolygon(x,z,p.poly);const k=inside?1:1-smooth(0,w,d);h=h*(1-k)+p.h*k;}
 for(const p of t.paths||[]){if(p.h===undefined)continue;const k=1-smooth(p.w*.35,p.w*.65,pathDistance(x,z,p.pts));h=h*(1-k)+p.h*k;}
 return h;
}
export function terrainWeights(recipe,x,z){
 const h=terrainHeight(recipe,x,z),w=[0,.15,.75,.1];
 if(h<(recipe.water?.level??-1)+1.2){w[1]=.9;w[2]=.08;w[3]=.02;}
 const mats={cobble:0,sand:1,grass:2,mud:3};
 for(const p of recipe.terrain.plateaus||[]){if(p.mat&&inPolygon(x,z,p.poly)){w.fill(0);w[mats[p.mat]??0]=1;}}
 for(const p of recipe.terrain.paths||[]){const k=1-smooth(p.w*.4,p.w*.65,pathDistance(x,z,p.pts));for(let i=0;i<4;i++)w[i]*=1-k;w[mats[p.mat]??0]+=k;}
 const sum=w.reduce((a,b)=>a+b,0);return w.map(v=>v/sum);
}
