import { randomInt,randomUUID } from 'node:crypto';
import { Game } from './sim/game.js';
import { SKINS } from '../shared/cosmetics.js';
import { HEROES } from '../shared/abilities.js';
import { nextMission } from '../shared/campaign.js';
import { STEP } from '../shared/movement.js';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class Rooms {
 constructor(io,recipe,catalog,recipes=new Map([[recipe.id,recipe]])){this.io=io;this.recipe=recipe;this.recipes=recipes;this.catalog=catalog;this.rooms=new Map();this.last=performance.now();this.accumulator=0;}
 create(options={}) {
  let code;do{code=Array.from({length:5},()=>alphabet[randomInt(alphabet.length)]).join('');}while(this.rooms.has(code));
  const recipe=this.recipes.get(options.map)||this.recipe;const game=new Game(recipe,this.catalog,options);
  const room={code,game,seats:new Map(),host:null,created:Date.now(),emptySince:null,aiKeepers:Number.isInteger(options.aiKeepers)?Math.max(0,Math.min(2,options.aiKeepers)):0,mode:recipe.mode||(options.mode==='solo'?'solo':'coop')};this.rooms.set(code,room);return room;
 }
 metadata(room) {return {code:room.code,host:room.host,map:room.game.recipe.id,world:room.game.recipe.world,missionName:room.game.recipe.name,capacity:room.game.recipe.mode==='sun-race'?room.game.teamSize*2:4,teamSize:room.game.teamSize,mode:room.mode,aiKeepers:room.aiKeepers,bots:[...room.game.players.values()].filter(p=>p.bot).map(p=>({id:p.id,hero:p.hero,name:p.name})),difficulty:room.game.difficulty,mutators:room.game.mutators,seats:[...room.seats.values()].map(s=>({id:s.id,name:room.game.players.get(s.id)?.name,hero:room.game.players.get(s.id)?.hero,team:room.game.players.get(s.id)?.team,connected:!!s.socketId,host:s.id===room.host})),link:`/?room=${room.code}&map=${room.game.recipe.id}`};}
 paused(room){const clients=[...room.seats.values()].filter(s=>s.socketId).map(s=>this.io.sockets.sockets.get(s.socketId)).filter(Boolean);return !clients.some(s=>s.data.ready)||(room.mode==='solo'&&clients.length===1&&!!clients[0].data.paused);}
 snapshot(room){return {...room.game.snapshot(),paused:this.paused(room)};}
 reset(room,recipe=room.game.baseRecipe,difficulty=room.game.difficulty,options={}){const old=room.game,reload=recipe.id!==old.recipe.id||difficulty!==old.difficulty||JSON.stringify(options.mutators??old.mutators)!==JSON.stringify(old.mutators);if(reload){room.hostReloadUntil=Date.now()+15000;for(const seat of room.seats.values()){const client=this.io.sockets.sockets.get(seat.socketId);if(client){client.data.ready=false;client.leave(room.code+':live');}}}room.game=new Game(recipe,this.catalog,{difficulty,teamSize:options.teamSize??old.teamSize,mutators:options.mutators??old.mutators});room.mode=recipe.mode||(room.mode==='solo'?'solo':'coop');for(const seat of room.seats.values()){room.game.addPlayer(seat.id,old.players.get(seat.id));room.game.players.get(seat.id).connected=!!seat.socketId;}room.game.setBots(recipe.mode?0:room.aiKeepers);old.physics.free();this.io.to(room.code).emit('mission_reset');this.io.to(room.code).emit('room_state',this.metadata(room));}
 join(socket,data={},ack=()=>{}) {
  data=data&&typeof data==='object'?data:{};const requested=String(data.room||'').trim().toUpperCase();let room=requested?this.rooms.get(requested):null;
  if(requested&&!room)return ack({ok:false,error:'Room not found. Check the five-character code.'});
  if(!room){if(this.rooms.size>=24)return ack({ok:false,error:'All crew berths are busy. Join an existing room.'});room=this.create(data);}
  let seat=[...room.seats.values()].find(s=>s.token===data.token);
  if(!seat&&room.game.players.size>=4){const bot=[...room.game.players.values()].find(p=>p.bot);if(bot)room.game.removePlayer(bot.id);}
  if(!seat&&room.game.players.size>=(room.game.recipe.mode==='sun-race'?room.game.teamSize*2:4))return ack({ok:false,error:'This crew has four Keepers.'});
  if(socket.data.room)this.leave(socket,true);
  if(!seat){const id=randomUUID();seat={id,token:randomUUID(),socketId:null};room.seats.set(id,seat);const player=room.game.addPlayer(id,{...data,team:undefined});player.connected=true;
   if(room.game.time>1){const sun=room.game.sunPositionFor(player);const spot=room.game.safeSpawn?.(sun)||{x:sun.x+2,z:sun.z+2};player.body.setTranslation({x:spot.x,y:spot.z},true);room.game.physics.sync(player);}
  }
  if(seat.socketId&&seat.socketId!==socket.id){const old=this.io.sockets.sockets.get(seat.socketId);if(old){old.leave(room.code);old.leave(room.code+':live');old.data={};old.emit('session_replaced');}}
  seat.socketId=socket.id;seat.expires=null;socket.data={room:room.code,playerId:seat.id,ready:data.loading!==true,paused:false};socket.join(room.code);if(socket.data.ready)socket.join(room.code+':live');room.emptySince=null;
  const p=room.game.players.get(seat.id);p.connected=true;p.lastInput=room.game.time;
  if(!room.host)room.host=seat.id;
  if(room.host===seat.id)room.hostReloadUntil=0;
  room.game.setBots(room.game.recipe.mode?0:room.aiKeepers);
  ack({ok:true,room:room.code,playerId:seat.id,token:seat.token,seat:[...room.seats.keys()].indexOf(seat.id),...this.metadata(room)});
  socket.emit('snapshot',this.snapshot(room));this.io.to(room.code).emit('room_state',this.metadata(room));
 }
 leave(socket,explicit=false) {
  const room=this.rooms.get(socket.data.room);if(!room)return;
  const id=socket.data.playerId,seat=room.seats.get(id);if(!seat||seat.socketId!==socket.id)return;
  socket.leave(room.code);socket.leave(room.code+':live');seat.socketId=null;seat.expires=Date.now()+(explicit?0:90000);
  const p=room.game.players.get(id);p.connected=false;p.input={x:0,z:0};p.rope.attached=false;
  if(room.host===id&&(explicit||!(room.hostReloadUntil>Date.now())))room.host=[...room.seats.values()].find(s=>s.socketId)?.id||null;
  socket.data={};this.io.to(room.code).emit('room_state',this.metadata(room));
 }
 attach(socket) {
  socket.emit('connected',{socketId:socket.id,serverTime:Date.now(),build:'v4-p5'});
  socket.on('join_room',(data,ack)=>this.join(socket,data,typeof ack==='function'?ack:()=>{}));
  // Keep the bootstrap snapshot/crew messages during loading, then subscribe to
  // live snapshots. They otherwise compete with asset downloads on slow links.
  socket.on('client_ready',()=>{const room=this.rooms.get(socket.data.room);if(!room||socket.data.ready)return;socket.data.ready=true;socket.join(room.code+':live');socket.emit('snapshot',this.snapshot(room));});
  socket.on('solo_pause',paused=>{const room=this.rooms.get(socket.data.room);if(!room||room.mode!=='solo'||room.host!==socket.data.playerId||typeof paused!=='boolean')return;socket.data.paused=paused;if(paused){const p=room.game.players.get(socket.data.playerId);p.input={x:0,z:0,sprint:false};p.commands=[];}});
  socket.on('leave_room',()=>this.leave(socket,true));
  socket.on('input',data=>{const room=this.rooms.get(socket.data.room);room?.game.input(socket.data.playerId,data);});
  socket.on('restart_mission',ack=>{const r=this.rooms.get(socket.data.room);if(!r||r.host!==socket.data.playerId)return ack?.({ok:false,error:'Only the host can restart the mission.'});this.reset(r);ack?.({ok:true});});
  socket.on('next_mission',ack=>{const r=this.rooms.get(socket.data.room);if(!r||r.host!==socket.data.playerId)return ack?.({ok:false,error:'Only the host can continue the journey.'});if(r.game.recipe.mode||!r.game.mission.complete||r.game.failed)return ack?.({ok:false,error:'Finish this Adventure mission before continuing.'});const next=nextMission(r.game.recipe.id),recipe=this.recipes.get(next?.id);if(!recipe)return ack?.({ok:false,error:'You have reached the end of this harbour mission.'});this.reset(r,recipe);ack?.({ok:true,map:recipe.id});});
  socket.on('select_mission',(data,ack)=>{const r=this.rooms.get(socket.data.room);if(!r||r.host!==socket.data.playerId)return ack?.({ok:false,error:'Only the host can choose the mission.'});const recipe=this.recipes.get(data?.map);if(!recipe)return ack?.({ok:false,error:'Unknown map.'});if(recipe.mode==='sun-race'&&r.seats.size>Math.max(1,Math.min(4,Number(data?.teamSize)||r.game.teamSize))*2)return ack?.({ok:false,error:'Choose a team size with enough seats for this crew.'});this.reset(r,recipe,data?.difficulty||r.game.difficulty,data||{});ack?.({ok:true,map:recipe.id});});
  socket.on('ping',point=>this.rooms.get(socket.data.room)?.game.ping(point));
  socket.on('crew_options',(data,ack)=>{
   const r=this.rooms.get(socket.data.room);if(!r)return ack?.({ok:false,error:'Join a crew first.'});
   if(!data||typeof data!=='object')return ack?.({ok:false,error:'Choose a Keeper.'});
   const changingCrew=data.mode!==undefined||data.aiKeepers!==undefined||data.bots!==undefined;
   if(changingCrew&&r.host!==socket.data.playerId)return ack?.({ok:false,error:'Only the host can choose Solo mode and AI Keepers.'});
   if(data.hero!==undefined&&(typeof data.hero!=='string'||!Object.hasOwn(HEROES,data.hero)))return ack?.({ok:false,error:'Unknown Keeper.'});
   if(data.aiKeepers!==undefined&&(!Number.isInteger(data.aiKeepers)||data.aiKeepers<0||data.aiKeepers>2))return ack?.({ok:false,error:'Choose 0, 1 or 2 AI Keepers.'});
   const p=r.game.players.get(socket.data.playerId);if(data.hero&&data.hero!==p.hero){const cast=r.game.effects.find(e=>e.id===p.channel?.effect);if(cast)cast.until=r.game.time;for(const system of r.game.systems)system.drop?.(r.game,p);p.hero=data.hero;p.channel=null;p.dash=null;p.pullMultiplier=1;p.transformUntil=0;}
   if(data.skin!==undefined){if(!Object.hasOwn(SKINS,data.skin))return ack?.({ok:false,error:'Unknown palette.'});p.skin=data.skin;}
   if(data.name)p.name=String(data.name).slice(0,18);
   if(data.mode!==undefined&&!r.game.recipe.mode)r.mode=data.mode==='solo'?'solo':'coop';
   if(data.aiKeepers!==undefined)r.aiKeepers=data.aiKeepers;
   r.game.setBots(r.game.recipe.mode?0:r.aiKeepers);
   this.io.to(r.code).emit('room_state',this.metadata(r));ack?.({ok:true,hero:p.hero});
  });
  socket.on('disconnect',()=>this.leave(socket));
 }
 advance() {
  const now=performance.now();this.accumulator+=Math.min(.15,(now-this.last)/1000);this.last=now;
  while(this.accumulator>=STEP){for(const room of this.rooms.values()){if(!this.paused(room))room.game.step();room.snapshotStep=(room.snapshotStep||0)+1;if(room.snapshotStep%3===0)this.io.to(room.code+':live').emit('snapshot',this.snapshot(room));}this.accumulator-=STEP;}
  for(const room of this.rooms.values()){
   if(room.hostReloadUntil&&room.hostReloadUntil<Date.now()){room.hostReloadUntil=0;if(!room.seats.get(room.host)?.socketId){room.host=[...room.seats.values()].find(s=>s.socketId)?.id||null;this.io.to(room.code).emit('room_state',this.metadata(room));}}
   for(const seat of room.seats.values())if(!seat.socketId&&seat.expires<Date.now()){room.game.removePlayer(seat.id);room.seats.delete(seat.id);room.game.setBots(room.game.recipe.mode?0:room.aiKeepers);this.io.to(room.code).emit('room_state',this.metadata(room));}
   if(![...room.seats.values()].some(s=>s.socketId)){room.emptySince??=Date.now();if(Date.now()-room.emptySince>120000){room.game.physics.free();this.rooms.delete(room.code);}}
  }
 }
}
