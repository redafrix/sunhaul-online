import http from 'http';
import { readFile,writeFile,mkdir,rename,stat } from 'node:fs/promises';
import { validateRecipe } from '../shared/map-schema.js';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import compression from 'compression';
import { Server as SocketIOServer } from 'socket.io';
import { Rooms } from './rooms.js';
import { CAMPAIGN } from '../shared/campaign.js';
import { MODE_MAPS } from '../shared/modes.js';
import { networkInterfaces } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3100;
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
app.use(compression({threshold:1024,filter:(req,res)=>/^(text\/|application\/(json|javascript)|model\/gltf\+json)/.test(String(res.getHeader('Content-Type')))}));
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 16384,
  // Repeated world snapshots compress well, especially on a phone uplink.
  perMessageDeflate: { threshold:1024 }
});

const catalog=JSON.parse(await readFile(path.join(ROOT,'assets/catalog.json'),'utf8'));
const recipes=new Map(await Promise.all([...CAMPAIGN,...MODE_MAPS].map(async m=>[m.id,validateRecipe(JSON.parse(await readFile(path.join(ROOT,'maps',m.world,m.id+'.json'),'utf8')),catalog)])));
const rooms=new Rooms(io,recipes.get('w1m1'),catalog,recipes);
const tickSamples=[];
const build=process.env.BUILD_SHA||await readFile(path.join(ROOT,'package.json'),'utf8').then(s=>JSON.parse(s).build||'dev');
let tickCount=0,metricAt=performance.now(),cpuAt=process.cpuUsage();
let metrics={cpuPercent:0,tickHz:60,rssMiB:0};
setInterval(()=>{
 const now=performance.now(),elapsed=now-metricAt,cpu=process.cpuUsage(cpuAt);
 metrics={cpuPercent:Math.round((cpu.user+cpu.system)/elapsed)/10,tickHz:Math.round(tickCount/elapsed*10000)/10,rssMiB:Math.round(process.memoryUsage().rss/1048576)};
 if(isProd)console.log(JSON.stringify({event:'server_metrics',rooms:rooms.rooms.size,...metrics,tickMs:Math.max(0,...tickSamples)}));
 tickCount=0;metricAt=now;cpuAt=process.cpuUsage();
},10000).unref();
const ticker=setInterval(()=>{const started=performance.now();tickCount+=rooms.advance();tickSamples.push(performance.now()-started);if(tickSamples.length>180)tickSamples.shift();},1000/60);
io.on('connection',socket=>rooms.attach(socket));
app.get('/api/network',(_req,res)=>{const addresses=Object.values(networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal&&!a.address.startsWith('172.')&&!a.address.startsWith('100.'));res.json({host:addresses[0]?.address||'localhost',port:PORT});});

app.get('/api/maps/:world/:id',async(req,res)=>{
  const {world,id}=req.params;
  if(!/^[a-z0-9_-]{1,32}$/.test(world)||!/^[a-z0-9_-]{1,32}$/.test(id))return res.status(400).json({error:'Invalid map identity'});
  const recipe=recipes.get(id);
  if(!recipe||recipe.world!==world)return res.status(404).json({error:'Map not found'});
  res.json(recipe);
});
app.get('/api/adventure',(_req,res)=>res.json(CAMPAIGN));
app.get('/health',(_req,res)=>{res.set('Cache-Control','no-store');res.json({ok:true,build,phase:'P6',mode:isProd?'release':'dev',rooms:rooms.rooms.size,...metrics,tickMs:Math.round(Math.max(0,...tickSamples)*100)/100});});
if(!isProd){
 app.put('/api/maps/:world/:id',express.json({limit:'2mb'}),async(req,res)=>{
  try {
   const origin=req.get('origin');if(origin&&new URL(origin).host!==req.get('host'))return res.status(403).json({error:'Same-origin editor required'});
   const catalog=JSON.parse(await readFile(path.join(ROOT,'assets/catalog.json'),'utf8'));
   const map=validateRecipe(req.body,catalog);
   if(map.world!==req.params.world||map.id!==req.params.id)return res.status(400).json({error:'Map identity does not match URL'});
   const folder=path.join(ROOT,'maps',map.world);await mkdir(folder,{recursive:true});
   const filename=path.join(folder,map.id+'.json');await writeFile(filename+'.tmp',JSON.stringify(map,null,2)+'\n');await rename(filename+'.tmp',filename);
   res.json({ok:true,id:map.id});
  }catch(error){res.status(400).json({error:error.message});}
 });
}
async function start() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.resolve(ROOT,'vite.config.js'),
      root: path.resolve(ROOT, 'client'),
      server: { middlewareMode: true, hmr: { server } },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.get(/^\/(packs\/[\w-]+\.pack|enemies\/[a-z]+\.glb)$/,async(req,res,next)=>{
      res.vary('Accept-Encoding');const encoding=req.acceptsEncodings('br','gzip');if(!encoding)return next();
      const file=path.join(ROOT,'dist',req.path.slice(1)),compressed=file+(encoding==='br'?'.br':'.gz');
      try {
        const [source]=await Promise.all([stat(file),stat(compressed)]);
        res.sendFile(compressed,{headers:{'Content-Encoding':encoding,'Content-Type':'application/octet-stream','X-File-Size':String(source.size),'Cache-Control':req.path.startsWith('/packs/')?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate'}},error=>{if(error)next(error);});
      } catch(error){if(error.code==='ENOENT')next();else next(error);}
    });
    app.use(express.static(path.resolve(ROOT,'dist'),{setHeaders(res,file){
      const hashed=/\/assets\/.*-[\w-]+\.(js|css)$/.test(file)||/\/textures\/[a-f0-9]{24}\.webp$/.test(file)||/\/packs\/.*-[a-f0-9]{16}\.pack$/.test(file);
      res.set('Cache-Control',hashed?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate');
    }}));
    app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found'}));
    app.get(/\.(gltf|glb|bin|webp|png|hdr|js|css|json|pack)$/,(_req,res)=>res.status(404).send('Asset not found'));
    app.get(['/gallery.html','/editor.html'],(_req,res)=>res.status(404).send('Page not found'));
    app.get('/{*path}', (req, res) => {
      res.sendFile(path.resolve(ROOT, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==============================================`);
    console.log(`☀️  SUNHAUL v4 ${isProd?'release':'dev'} server live at:`);
    console.log(`    http://localhost:${PORT}`);
    console.log(`==============================================\n`);
  });
}

start().catch(err => {
  console.error('[Server Error]', err);
  process.exit(1);
});
let stopping=false;
function shutdown(){if(stopping)return;stopping=true;clearInterval(ticker);io.close(()=>server.close(()=>process.exit(0)));setTimeout(()=>process.exit(0),8000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
