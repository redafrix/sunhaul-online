// Crew discovery, reserved reconnect seats and bounded multiplayer lifecycle.
import { randomInt,randomUUID } from 'node:crypto';
import { listenGuard } from './socket-guard.js';
import { Game } from './sim/game.js';
import { SKINS } from '../shared/cosmetics.js';
import { HEROES } from '../shared/abilities.js';
import { nextMission } from '../shared/campaign.js';
import { missionObjective } from '../shared/mission-flow.js';
import { HERO_DEFS } from '../shared/heroes.js';
import { STEP } from '../shared/movement.js';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class Rooms {
 constructor(io,recipe,catalog,recipes=new Map([[recipe.id,recipe]])){this.io=io;this.recipe=recipe;this.recipes=recipes;this.catalog=catalog;this.rooms=new Map();this.last=performance.now();this.accumulator=0;}
 create(options={}) {
  let code;do{code=Array.from({length:5},()=>alphabet[randomInt(alphabet.length)]).join('');}while(this.rooms.has(code));
  const recipe=this.recipes.get(options.map)||this.recipe;const game=new Game(recipe,this.catalog,options);
  const room={code,game,seats:new Map(),host:null,created:Date.now(),emptySince:null,lastActive:Date.now(),checkpoint:options.checkpoint==='headland'?'headland':undefined,public:options.quickMatch===true,aiKeepers:Number.isInteger(options.aiKeepers)?Math.max(0,Math.min(2,options.aiKeepers)):0,mode:recipe.mode||(options.mode==='solo'?'solo':'coop')};this.rooms.set(code,room);console.log(JSON.stringify({event:'room_start',room:code,public:room.public,map:recipe.id}));return room;
 }
 metadata(room) {return {code:room.code,checkpoint:room.checkpoint,public:room.public,host:room.host,map:room.game.recipe.id,world:room.game.recipe.world,missionName:room.game.recipe.name,capacity:room.game.recipe.mode==='sun-race'?room.game.teamSize*2:4,teamSize:room.game.teamSize,mode:room.mode,aiKeepers:room.aiKeepers,bots:[...room.game.players.values()].filter(p=>p.bot).map(p=>({id:p.id,hero:p.hero,name:p.name})),difficulty:room.game.difficulty,mutators:room.game.mutators,seats:[...room.seats.values()].map(s=>({id:s.id,name:room.game.players.get(s.id)?.name,hero:room.game.players.get(s.id)?.hero,team:room.game.players.get(s.id)?.team,connected:!!s.socketId,host:s.id===room.host})),link:`/?room=${room.code}&map=${room.game.recipe.id}`};}
 paused(room){const clients=[...room.seats.values()].filter(s=>s.socketId).map(s=>this.io.sockets.sockets.get(s.socketId)).filter(Boolean);return !clients.some(s=>s.data.ready)||(room.mode==='solo'&&clients.length===1&&!!clients[0].data.paused);}
 snapshot(room){return {...room.game.snapshot(),paused:this.paused(room)};}
 reset(room,recipe=room.game.baseRecipe,difficulty=room.game.difficulty,options={}){const old=room.game,reload=recipe.id!==old.recipe.id||difficulty!==old.difficulty||JSON.stringify(options.mutators??old.mutators)!==JSON.stringify(old.mutators);if(reload){room.hostReloadUntil=Date.now()+15000;for(const seat of room.seats.values()){const client=this.io.sockets.sockets.get(seat.socketId);if(client){client.data.ready=false;client.leave(room.code+':live');}}}room.game=new Game(recipe,this.catalog,{difficulty,teamSize:options.teamSize??old.teamSize,mutators:options.mutators??old.mutators,checkpoint:room.checkpoint});room.mode=recipe.mode||(room.mode==='solo'?'solo':'coop');for(const seat of room.seats.values()){room.game.addPlayer(seat.id,old.players.get(seat.id));room.game.players.get(seat.id).connected=!!seat.socketId;}room.game.setBots(recipe.mode?0:room.aiKeepers);old.physics.free();this.io.to(room.code).emit('mission_reset');this.io.to(room.code).emit('room_state',this.metadata(room));}
 join(socket,data={},ack=()=>{}) {
  data=data&&typeof data==='object'?data:{};const requested=typeof data.room==='string'?data.room.trim().toUpperCase():'';let room=requested?this.rooms.get(requested):null;
  if(requested&&!room)return ack({ok:false,error:'Room not found. Check the five-character code.'});
  if(!room&&data.quickMatch===true)room=[...this.rooms.values()].filter(r=>r.public&&r.game.recipe.id==='w1m1'&&!r.game.failed&&!r.game.mission.complete&&r.seats.size<4&&[...r.seats.values()].some(s=>s.socketId)&&(missionObjective(r.game.recipe,{machines:r.game.machines,flags:r.game.flags,mission:r.game.mission,sun:r.game.sunPositionFor()},null)?.index??0)===0).sort((a,b)=>b.created-a.created)[0];
  if(!room){if(this.rooms.size>=40)return ack({ok:false,error:'All crew berths are busy. Join an existing room.'});room=this.create(data);}
  let seat=[...room.seats.values()].find(s=>(s.token===data.token&&(!s.expires||s.expires>Date.now()))||(socket.data.room===room.code&&s.socketId===socket.id));
  if(!seat&&room.game.recipe.mode==='sun-race'){const rival=[...room.game.players.values()].find(p=>p.raceRival);if(rival){room.game.removePlayer(rival.id);room.game.modeState.aiRival=false;}}
  if(!seat&&room.game.players.size>=4){const bot=[...room.game.players.values()].find(p=>p.bot);if(bot)room.game.removePlayer(bot.id);}
  if(!seat&&room.game.players.size>=(room.game.recipe.mode==='sun-race'?room.game.teamSize*2:4))return ack({ok:false,error:'This crew has four Keepers.'});
  if(socket.data.room&&socket.data.room!==room.code)this.leave(socket,true);
  if(!seat){const id=randomUUID();seat={id,token:randomUUID(),socketId:null};room.seats.set(id,seat);const player=room.game.addPlayer(id,{...data,team:undefined});player.connected=true;
  }
  if(seat.socketId&&seat.socketId!==socket.id){const old=this.io.sockets.sockets.get(seat.socketId);if(old){old.leave(room.code);old.leave(room.code+':live');old.data={};old.emit('session_replaced');}}
  seat.socketId=socket.id;seat.expires=null;room.lastActive=Date.now();socket.data={room:room.code,playerId:seat.id,ready:data.loading!==true,paused:false};socket.join(room.code);if(socket.data.ready)socket.join(room.code+':live');room.emptySince=null;
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
  socket.leave(room.code);socket.leave(room.code+':live');seat.socketId=null;seat.expires=Date.now()+(explicit?0:60000);
  const p=room.game.players.get(id);p.connected=false;p.input={x:0,z:0};p.rope.attached=false;
  if(room.host===id&&(explicit||!(room.hostReloadUntil>Date.now())))room.host=[...room.seats.values()].find(s=>s.socketId)?.id||null;
  socket.data={};
  if(explicit){room.game.removePlayer(id);room.seats.delete(id);room.game.setBots(room.game.recipe.mode?0:room.aiKeepers);if(!room.seats.size)this.close(room);}
  if(this.rooms.has(room.code))this.io.to(room.code).emit('room_state',this.metadata(room));
 }
 attach(socket) {
  // Token bucket bounds all client messages, including repeated room creation.
  let tokens=160,refill=performance.now();
  socket.use?.(([event,...args],next)=>{
   const now=performance.now();tokens=Math.min(160,tokens+(now-refill)*.08);refill=now;
   const cost=event==='join_room'?40:1;
   if(tokens<cost){const ack=args.at(-1);if(typeof ack==='function')ack({ok:false,error:'Too many messages. Try again shortly.'});return;}
   tokens-=cost;next();
  });
  socket.emit('connected',{socketId:socket.id,serverTime:Date.now(),build:'v4-p5'});
  const listen=listenGuard(socket);
  listen('join_room',(data,ack)=>this.join(socket,data,typeof ack==='function'?ack:()=>{}));
  // Keep the bootstrap snapshot/crew messages during loading, then subscribe to
  // live snapshots. They otherwise compete with asset downloads on slow links.
  listen('client_ready',()=>{const room=this.rooms.get(socket.data.room);if(!room||socket.data.ready)return;socket.data.ready=true;socket.join(room.code+':live');socket.emit('snapshot',this.snapshot(room));});
  listen('solo_pause',paused=>{const room=this.rooms.get(socket.data.room);if(!room||room.mode!=='solo'||room.host!==socket.data.playerId||typeof paused!=='boolean')return;socket.data.paused=paused;if(paused){const p=room.game.players.get(socket.data.playerId);p.input={x:0,z:0,sprint:false};p.commands=[];}});
  listen('leave_room',()=>this.leave(socket,true));
  listen('input',data=>{const room=this.rooms.get(socket.data.room);if(room&&Number.isSafeInteger(data?.seq)&&((Number.isFinite(data.x)&&data.x!==0)||(Number.isFinite(data.z)&&data.z!==0)||Array.isArray(data.commands)&&data.commands.length))room.lastActive=Date.now();room?.game.input(socket.data.playerId,data);});
  listen('race_ai',ack=>{const r=this.rooms.get(socket.data.room);if(!r||r.host!==socket.data.playerId||r.game.recipe.mode!=='sun-race'||!r.game.modeState.soloAvailable||r.seats.size!==1||[...r.game.players.values()].some(p=>p.raceRival))return ack?.({ok:false,error:'Wait for the solo race choice.'});const bot=r.game.addPlayer('race-rival',{hero:'mara',name:'Mara (AI rival)',bot:true});bot.raceRival=true;r.game.modeState.aiRival=true;this.io.to(r.code).emit('room_state',this.metadata(r));ack?.({ok:true});});
  listen('restart_mission',ack=>{const r=this.rooms.get(socket.data.room);if(!r||r.host!==socket.data.playerId)return ack?.({ok:false,error:'Only the host can restart the mission.'});if(r.game.failed&&r.game.recipe.mission){r.game.retryCheckpoint();this.io.to(r.code).emit('mission_reset');}else this.reset(r);ack?.({ok:true});});
  listen('return_sun',ack=>{const r=this.rooms.get(socket.data.room);if(!r||!r.game.mission.recoveryAvailable||r.game.mission.complete)return ack?.({ok:false,error:'Keep hauling toward the next cradle.'});r.game.retryCheckpoint();this.io.to(r.code).emit('mission_reset');ack?.({ok:true});});
  listen('next_mission',ack=>{const r=this.rooms.get(socket.data.room);if(!r||r.host!==socket.data.playerId)return ack?.({ok:false,error:'Only the host can continue the journey.'});if(r.game.recipe.mode||!r.game.mission.complete||r.game.failed)return ack?.({ok:false,error:'Finish this Adventure mission before continuing.'});const next=nextMission(r.game.recipe.id),recipe=this.recipes.get(next?.id);if(!recipe)return ack?.({ok:false,error:'You have reached the end of this harbour mission.'});this.reset(r,recipe);ack?.({ok:true,map:recipe.id});});
  listen('select_mission',(data,ack)=>{const r=this.rooms.get(socket.data.room);if(!r||r.host!==socket.data.playerId)return ack?.({ok:false,error:'Only the host can choose the mission.'});const recipe=this.recipes.get(data?.map);if(!recipe)return ack?.({ok:false,error:'Unknown map.'});if(recipe.mode==='sun-race'&&r.seats.size>Math.max(1,Math.min(4,Number(data?.teamSize)||r.game.teamSize))*2)return ack?.({ok:false,error:'Choose a team size with enough seats for this crew.'});this.reset(r,recipe,data?.difficulty||r.game.difficulty,data||{});ack?.({ok:true,map:recipe.id});});
  listen('ping',point=>this.rooms.get(socket.data.room)?.game.ping(point));
  listen('crew_options',(data,ack)=>{
   const r=this.rooms.get(socket.data.room);if(!r)return ack?.({ok:false,error:'Join a crew first.'});
   if(!data||typeof data!=='object')return ack?.({ok:false,error:'Choose a Keeper.'});
   const changingCrew=data.mode!==undefined||data.aiKeepers!==undefined||data.bots!==undefined;
   if(changingCrew&&r.host!==socket.data.playerId)return ack?.({ok:false,error:'Only the host can choose Solo mode and AI Keepers.'});
   if(data.hero!==undefined&&(typeof data.hero!=='string'||!Object.hasOwn(HEROES,data.hero)))return ack?.({ok:false,error:'Unknown Keeper.'});
   if(data.aiKeepers!==undefined&&(!Number.isInteger(data.aiKeepers)||data.aiKeepers<0||data.aiKeepers>2))return ack?.({ok:false,error:'Choose 0, 1 or 2 AI Keepers.'});
   const p=r.game.players.get(socket.data.playerId);if(data.hero&&data.hero!==p.hero){const cast=r.game.effects.find(e=>e.id===p.channel?.effect);if(cast)cast.until=r.game.time;for(const system of r.game.systems)system.drop?.(r.game,p);p.hero=data.hero;p.channel=null;p.dash=null;p.action=null;p.pendingCast=null;p.pendingStrike=null;p.pullMultiplier=1;p.transformUntil=0;}
   if(data.skin!==undefined){if(typeof data.skin!=='string'||!Object.hasOwn(SKINS,data.skin))return ack?.({ok:false,error:'Unknown palette.'});p.skin=data.skin;}
   if(typeof data.name==='string')p.name=data.name.slice(0,18);
   if(data.mode!==undefined&&!r.game.recipe.mode)r.mode=data.mode==='solo'?'solo':'coop';
   if(data.aiKeepers!==undefined)r.aiKeepers=data.aiKeepers;
   r.game.setBots(r.game.recipe.mode?0:r.aiKeepers);
   const seat=r.seats.get(p.id);
   if(!seat.announced){
    const sun=r.game.sunPositionFor(p);
    if(Math.hypot(p.x-sun.x,p.z-sun.z)>3.5){
     const at=r.game.safeSpawn(sun);
     p.body.setTranslation({x:at.x,y:at.z},true);
     p.body.setNextKinematicTranslation?.({x:at.x,y:at.z});
     r.game.physics.sync(p);
     p.hp=100;
     p.downedUntil=0;
    }
    seat.announced=true;if(r.seats.size>1)this.io.to(r.code).emit('crew_joined',{hero:HERO_DEFS[p.hero].name});}
   this.io.to(r.code).emit('room_state',this.metadata(r));ack?.({ok:true,hero:p.hero});
  });
  listen('disconnect',()=>this.leave(socket));
 }
 close(room){if(!this.rooms.has(room.code))return;room.game.physics.free();this.rooms.delete(room.code);console.log(JSON.stringify({event:'room_end',room:room.code,seconds:Math.round((Date.now()-room.created)/1000)}));}
 advance() {
  const now=performance.now();this.accumulator+=Math.min(.15,(now-this.last)/1000);this.last=now;
  let steps=0;
  const connectedRooms=[...this.rooms.values()].filter(room=>[...room.seats.values()].some(seat=>seat.socketId));
  while(this.accumulator>=STEP){
   steps++;
   for(const room of connectedRooms){
    if(!this.paused(room))room.game.step();
    room.snapshotStep=(room.snapshotStep||0)+1;
    if(room.snapshotStep%3===0)this.io.to(room.code+':live').emit('snapshot',this.snapshot(room));
   }
   this.accumulator-=STEP;
  }
  for(const room of this.rooms.values()){
   if(room.hostReloadUntil&&room.hostReloadUntil<Date.now()){room.hostReloadUntil=0;if(!room.seats.get(room.host)?.socketId){room.host=[...room.seats.values()].find(s=>s.socketId)?.id||null;this.io.to(room.code).emit('room_state',this.metadata(room));}}
   for(const seat of room.seats.values())if(!seat.socketId&&seat.expires<=Date.now()){room.game.removePlayer(seat.id);room.seats.delete(seat.id);room.game.setBots(room.game.recipe.mode?0:room.aiKeepers);this.io.to(room.code).emit('room_state',this.metadata(room));}
   if(Date.now()-room.lastActive>600000){this.io.to(room.code).emit('room_closed');for(const seat of room.seats.values()){const client=this.io.sockets.sockets.get(seat.socketId);if(client)this.leave(client,true);}this.close(room);}
  }
  return steps;
 }
}
