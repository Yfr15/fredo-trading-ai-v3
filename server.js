'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const PORT=Number(process.env.PORT||3000), HOST='0.0.0.0';
const MODE=process.env.DATA_MODE==='provider'?'provider':'demo';
const SYMBOLS=['AAPL_otc','AXP_otc','BA_otc','FB_otc','INTC_otc','JNJ_otc','MCD_otc','BABA_otc','COIN_otc','FDX_otc','NFLX_otc','PLTR_otc','AMD_otc','C_otc','XOM_otc','AMZN_otc','GME_otc','CSCO_otc'];
const CANDLE_MS=5000,MAX_CANDLES=400,STALE_MS=12000;
const states=new Map(),clients=new Set();
const {DemoEngine}=require('./demo-engine');
const demoEngine=new DemoEngine();
const round=n=>Math.round(n*100000)/100000;
function ema(values,period){let out=Array(values.length).fill(null),alpha=2/(period+1),v=null;for(let i=0;i<values.length;i++){let x=values[i];if(!Number.isFinite(x))continue;v=v===null?x:v+alpha*(x-v);out[i]=v;}return out;}
function indicators(candles){const close=candles.map(c=>c.close);if(close.length<40)return {macd:null,momentum:null,osma:null,signal:'WAIT',reason:'Warming up: need 40 candles'};
 const e12=ema(close,12),e26=ema(close,26),macd=e12.map((x,i)=>x-e26[i]),signalLine=ema(macd,9),i=close.length-1;
 const m=macd[i],hist=m-signalLine[i],mom=close[i]-close[i-10],prevHist=macd[i-1]-signalLine[i-1];
 const normalizedMom=mom/close[i];const up=m>0&&hist>0&&hist>prevHist&&normalizedMom>0.0001;
 const down=m<0&&hist<0&&hist<prevHist&&normalizedMom< -0.0001;
 return {macd:round(m),momentum:round(mom),osma:round(hist),signal:up?'UP':down?'DOWN':'WAIT',reason:up?'Three indicators align upward':down?'Three indicators align downward':'Indicators do not align'};
}
function state(symbol){if(!states.has(symbol))states.set(symbol,{symbol,candles:[],lastUpdate:0,source:MODE==='demo'?'SIMULATED':'PROVIDER',error:null,seq:0});return states.get(symbol);}
function pushCandle(symbol,c){let s=state(symbol);let candle={time:Number(c.time),open:Number(c.open),high:Number(c.high),low:Number(c.low),close:Number(c.close)};
 if(!Object.values(candle).every(Number.isFinite)||candle.time<=0||candle.high<Math.max(candle.open,candle.close)||candle.low>Math.min(candle.open,candle.close))throw Error('Invalid OHLC candle');
 if(candle.time%5000!==0)throw Error('Candle timestamp must be aligned to 5 seconds');
 const prev=s.candles.at(-1);if(prev&&candle.time<prev.time)throw Error('Out-of-order candle');
 if(prev&&candle.time===prev.time)s.candles[s.candles.length-1]=candle;else s.candles.push(candle);
 s.candles=s.candles.slice(-MAX_CANDLES);s.lastUpdate=Date.now();s.error=null;s.seq++;
 demoEngine.onCandle(symbol,candle,indicators(s.candles).signal,s.source);
 broadcast(symbol);}
function snapshot(symbol){const s=state(symbol),age=s.lastUpdate?Date.now()-s.lastUpdate:null,stale=age===null||age>STALE_MS;let calc=indicators(s.candles);return {symbol,source:s.source,mode:MODE,serverTime:Date.now(),lastUpdate:s.lastUpdate,ageMs:age,stale,connected:!stale&&!s.error,signal:stale?'WAIT':calc.signal,reason:s.error|| (stale?'No recent candle; signals disabled':calc.reason),indicators:{macd:calc.macd,momentum:calc.momentum,osma:calc.osma},count:s.candles.length,candles:s.candles.slice(-100)};}
function broadcast(symbol){const msg=`event: market\ndata: ${JSON.stringify(snapshot(symbol))}\n\n`;for(const c of clients){if(c.symbol===symbol){try{c.res.write(msg)}catch{clients.delete(c)}}}}
function demoTick(){for(let idx=0;idx<SYMBOLS.length;idx++){const symbol=SYMBOLS[idx],s=state(symbol),last=s.candles.at(-1),time=Math.floor(Date.now()/5000)*5000-5000;if(last&&time<=last.time)continue;
 const open=last?.close??(100+idx*28),drift=(Math.random()-.5)*0.18,close=round(Math.max(0.01,open+drift)),high=round(Math.max(open,close)+Math.random()*0.04),low=round(Math.min(open,close)-Math.random()*0.04);
 pushCandle(symbol,{time,open,high,low,close});}}
async function providerTick(){const endpoint=process.env.PROVIDER_CANDLES_URL;const key=process.env.PROVIDER_API_KEY;
 if(!endpoint||!key){for(const sym of SYMBOLS){state(sym).error='Provider not configured';broadcast(sym)}return;}
 // Adapter contract: URL contains {symbol}; returns {candles:[{time,open,high,low,close}]}.
 // This is NOT a claim about OTCharts API shape. Implement provider-specific mapping separately.
 for(const sym of SYMBOLS){try{const url=endpoint.replace('{symbol}',encodeURIComponent(sym));const parsed=new URL(url);if(parsed.protocol!=='https:')throw Error('Provider URL must use HTTPS');
 const response=await fetch(url,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},signal:AbortSignal.timeout(3500)});
 if(!response.ok)throw Error('Provider HTTP '+response.status);const data=await response.json();if(!Array.isArray(data.candles))throw Error('Adapter expected candles array');
 for(const c of data.candles.slice(-MAX_CANDLES).sort((a,b)=>a.time-b.time)){const s=state(sym);if(!s.candles.length||Number(c.time)>=s.candles.at(-1).time)pushCandle(sym,c)}
 }catch(err){state(sym).error='Feed error: '+err.message;broadcast(sym)}}}
function send(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));}
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css'};
const server=http.createServer((req,res)=>{let url;try{url=new URL(req.url,'http://localhost')}catch{return send(res,400,{error:'Bad URL'})}
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
 if(req.method==='POST'){
  if(!url.pathname.startsWith('/api/demo/'))return send(res,405,{error:'Method not allowed'});
  let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>8192)req.destroy();});
  req.on('end',()=>{let body={};try{body=raw?JSON.parse(raw):{};}catch{return send(res,400,{error:'Invalid JSON'});}
    try{
      if(url.pathname==='/api/demo/start')return send(res,200,demoEngine.start());
      if(url.pathname==='/api/demo/stop')return send(res,200,demoEngine.stop());
      if(url.pathname==='/api/demo/config')return send(res,200,demoEngine.configure(body));
      return send(res,404,{error:'Not found'});
    }catch(err){return send(res,400,{error:err.message,status:demoEngine.status()});}
  });return;
 }
 if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
 
if(url.pathname==='/api/env-check'){
  const key=process.env.OTCHARTS_API_KEY;
  return send(res,200,{
    keyPresent:typeof key==='string',
    keyNonEmpty:typeof key==='string'&&key.trim().length>0
  });
}
  
if(url.pathname==='/api/otcharts-test'){
  const key=process.env.OTCHARTS_API_KEY;
  if(!key)return send(res,503,{ok:false,error:'OTCHARTS_API_KEY not configured'});
  (async()=>{
    const headers={Authorization:'Bearer '+key,Accept:'application/json'};
    const get=async(apiPath)=>{
      const response=await fetch('https://otcharts.com'+apiPath,{headers,signal:AbortSignal.timeout(8000)});
      let body={};try{body=await response.json()}catch{}
      return {status:response.status,ok:response.ok,body};
    };
    try{
      const venues=await get('/v1/venues');
      if(!venues.ok)return send(res,200,{ok:false,stage:'venues',providerStatus:venues.status,providerError:venues.body.error||null,message:venues.status===402?'OTCharts rejected this account plan (HTTP 402). The key reached OTCharts; this is not a missing-key error.':'Could not read the OTCharts venue list.'});
      const otc=(venues.body.venues||[]).find(v=>v.id==='otc');
      if(!otc||!otc.open)return send(res,200,{ok:false,stage:'venues',venueOpen:false,timeframes:otc?.timeframes||[],message:'This key does not currently have the Pocket Option OTC book open. Check the book selected for this key in your OTCharts account.'});
      const usage=await get('/v1/usage');
      const catalogue=await get('/v1/symbols?venue=otc');
      if(!catalogue.ok)return send(res,200,{ok:false,stage:'symbols',providerStatus:catalogue.status,providerError:catalogue.body.error||null,message:catalogue.status===403?'The OTC book is open, but this plan does not permit reading the symbol catalogue.':'Could not read the Pocket Option OTC symbol catalogue.'});
      const all=Array.isArray(catalogue.body.symbols)?catalogue.body.symbols:[];
      const freeIds=['EURUSD_otc','GBPUSD_otc','USDJPY_otc','BTCUSD_otc','AUDUSD_otc'];
      const freeCandidates=freeIds.map(id=>all.find(x=>x.symbol===id)).filter(Boolean);
      const available=freeCandidates.filter(x=>x.open!==false);
      if(!available.length)return send(res,200,{ok:false,stage:'symbols',venueOpen:true,freeTierCandidates:freeCandidates.map(x=>({symbol:x.symbol,open:x.open??null})),message:'The OTC book is open, but none of the five documented free-tier instruments is currently listed as open. No stock OTC symbols were tested.'});
      const selected=available[0];
      const candles=await get('/v1/candles?venue=otc&symbol='+encodeURIComponent(selected.symbol)+'&tf=5&limit=5');
      if(!candles.ok)return send(res,200,{ok:false,stage:'candles',providerStatus:candles.status,providerError:candles.body.error||null,symbol:selected.symbol,venueOpen:true,message:candles.status===403?'The OTC book is open, but this key cannot read the selected free-tier instrument.':'The venue and catalogue responded, but the five-second candle-history request failed.'});
      const rows=Array.isArray(candles.body.candles)?candles.body.candles:[];
      const valid=rows.filter(c=>[c.time,c.open,c.high,c.low,c.close].every(v=>Number.isFinite(Number(v))));
      return send(res,200,{ok:valid.length>0,stage:'complete',source:'OTCharts Pocket Option OTC (read-only)',venueOpen:true,timeframes:otc.timeframes||[],usage:usage.ok?usage.body:null,freeTierCandidates:freeCandidates.map(x=>({symbol:x.symbol,open:x.open??null})),symbol:selected.symbol,timeframeSeconds:5,count:valid.length,sample:valid.slice(-2),liveStreamAvailable:false,notice:'The free API tier has no live streaming. This endpoint is a one-time diagnostic only; it does not connect to your Pocket Option account or place trades.'});
    }catch(err){
      return send(res,200,{ok:false,stage:'network',error:err.name==='TimeoutError'?'OTCharts request timed out':'Unable to complete OTCharts diagnostic',message:'The server could not complete the provider request.'});
    }
  })();
  return;
}
  
if(url.pathname==='/api/demo/status')return send(res,200,demoEngine.status());
 if(url.pathname==='/api/config')return send(res,200,{mode:MODE,symbols:SYMBOLS,candleSeconds:5,staleAfterSeconds:STALE_MS/1000,disclaimer:'Research/demo only. No trading execution.'});
 if(url.pathname==='/api/market'){const sym=url.searchParams.get('symbol');return SYMBOLS.includes(sym)?send(res,200,snapshot(sym)):send(res,400,{error:'Unsupported symbol'});}
 if(url.pathname==='/api/stream'){const sym=url.searchParams.get('symbol');if(!SYMBOLS.includes(sym))return send(res,400,{error:'Unsupported symbol'});
 res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store, no-transform',Connection:'keep-alive','X-Accel-Buffering':'no'});
 res.write(`retry: 3000\nevent: market\ndata: ${JSON.stringify(snapshot(sym))}\n\n`);const client={res,symbol:sym};clients.add(client);req.on('close',()=>clients.delete(client));return;}
 const filename=files[url.pathname];if(!filename)return send(res,404,{error:'Not found'});const filepath=path.join(__dirname,'public',filename);
 fs.readFile(filepath,(err,data)=>{if(err)return send(res,500,{error:'File unavailable'});res.writeHead(200,{'Content-Type':filename.endsWith('.js')?'text/javascript; charset=utf-8':filename.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(data)});
});
if(require.main===module){for(const sym of SYMBOLS)state(sym);if(MODE==='demo'){for(let i=0;i<70;i++)demoTickSeed(i);setInterval(demoTick,1000)}else{providerTick();setInterval(providerTick,5000)}setInterval(()=>{for(const c of clients){try{c.res.write(': keepalive\n\n');c.res.write(`event: market\ndata: ${JSON.stringify(snapshot(c.symbol))}\n\n`)}catch{clients.delete(c)}}},3000);server.listen(PORT,HOST,()=>console.log(`Fredo AI v3 (${MODE}) listening on http://${HOST}:${PORT}`));}
function demoTickSeed(i){for(let idx=0;idx<SYMBOLS.length;idx++){const sym=SYMBOLS[idx],s=state(sym),open=s.candles.at(-1)?.close??(100+idx*28),close=round(Math.max(.01,open+(Math.random()-.5)*.18)),time=Math.floor(Date.now()/5000)*5000-(70-i)*5000;pushCandle(sym,{time,open,close,high:round(Math.max(open,close)+.02),low:round(Math.min(open,close)-.02)});}}
module.exports={indicators,pushCandle,snapshot,state,server};
