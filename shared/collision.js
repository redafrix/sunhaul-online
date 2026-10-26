// Local P1 movement against catalog footprints. Server Rapier authority is P2.
export function moveOnMap(position,dx,dz,radius,colliders,height,waterLevel) {
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));
 let x=position.x,z=position.z;
 for(let step=0;step<steps;step++){
  const oldX=x,oldZ=z;x+=dx/steps;z+=dz/steps;
  for(let pass=0;pass<2;pass++)for(const {placement:p,asset:a}of colliders){
   const scale=Array.isArray(p.s)?p.s:[p.s??1,p.s??1,p.s??1],c=a.collider,angle=(p.r||0)*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);
   if(c.type==='circle'){
    const rr=c.r*Math.max(scale[0],scale[2])+radius,ox=x-p.p[0],oz=z-p.p[2],d=Math.hypot(ox,oz);
    if(d<rr){const nx=d>.0001?ox/d:1,nz=d>.0001?oz/d:0;x=p.p[0]+nx*rr;z=p.p[2]+nz*rr;}
   }else if(c.type==='box'){
    const relX=x-p.p[0],relZ=z-p.p[2],ox=c.offset?.[0]*scale[0]||0,oz=c.offset?.[1]*scale[2]||0;
    let lx=co*relX-si*relZ-ox,lz=si*relX+co*relZ-oz;const hx=c.half[0]*scale[0]+radius,hz=c.half[1]*scale[2]+radius;
    if(Math.abs(lx)<hx&&Math.abs(lz)<hz){if(hx-Math.abs(lx)<hz-Math.abs(lz))lx=(lx<0?-1:1)*hx;else lz=(lz<0?-1:1)*hz;lx+=ox;lz+=oz;x=p.p[0]+co*lx+si*lz;z=p.p[2]-si*lx+co*lz;}
   }
  }
  if(height(x,z)<waterLevel+.16){
   if(height(x,oldZ)>=waterLevel+.16)z=oldZ;
   else if(height(oldX,z)>=waterLevel+.16)x=oldX;
   else{x=oldX;z=oldZ;}
  }
 }
 position.x=x;position.z=z;position.y=height(x,z);
 return position;
}
