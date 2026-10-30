'use strict';
const $=id=>document.getElementById(id);let stream=null,last=null,config=null;
const fmt=n=>n===null||n===undefined?'—':Number(n).toFixed(5);
function connect(){if(stream)stream.close();last=null;const symbol=$('symbol').value;$('feed').textContent='Connecting…';$('dot').className='dot';
 fetch('/api/market?symbol='+encodeURIComponent(symbol)).then(r=>r.json()).then(render).catch(()=>{});
 stream=new EventSource('/api/stream?symbol='+encodeURIComponent(symbol));stream.addEventListener('market',event=>{try{render(JSON.parse(event.data))}catch{}});
 stream.onerror=()=>{$('feed').textContent='Connection interrupted';$('dot').className='dot bad';forceWait('Connection interrupted')};}
function forceWait(reason){$('signal').textContent='WAIT';$('signal').className='';$('reason').textContent=reason;}
function render(d){if(!d||d.symbol!==$('symbol').value)return;last=d;
 $('price').textContent=d.candles.length?fmt(d.candles.at(-1).close):'—';$('updated').textContent=d.candles.length?new Date(d.candles.at(-1).time).toLocaleTimeString()+' · candle close':'No candles';
 $('macd').textContent=fmt(d.indicators.macd);$('momentum').textContent=fmt(d.indicators.momentum);$('osma').textContent=fmt(d.indicators.osma);$('count').textContent=d.count;
 const stale=d.stale||Date.now()-d.lastUpdate>12000||!d.connected;
 $('signal').textContent=stale?'WAIT':d.signal;$('signal').className=stale?'':d.signal.toLowerCase();$('reason').textContent=stale?'Stale or unavailable data — no signal':d.reason;
 $('feed').textContent=stale?'Stale / unavailable':d.source==='SIMULATED'?'Simulated feed':'Provider feed';$('dot').className='dot '+(stale?'bad':'good');$('connection').textContent=stale?'Unavailable':'Receiving';$('age').textContent=d.lastUpdate?((Date.now()-d.lastUpdate)/1000).toFixed(1)+'s':'—';draw(d.candles);
}
function draw(candles){const canvas=$('chart'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b1221';ctx.fillRect(0,0,w,h);
 const vals=candles.map(c=>c.close);if(vals.length<2)return;let min=Math.min(...vals),max=Math.max(...vals),pad=(max-min)*.15||.1;min-=pad;max+=pad;
 ctx.strokeStyle='#24334c';ctx.lineWidth=1;for(let i=1;i<5;i++){const y=i*h/5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 ctx.strokeStyle='#e9bd6e';ctx.lineWidth=3;ctx.beginPath();vals.forEach((v,i)=>{let x=20+i*(w-40)/(vals.length-1),y=12+(max-v)/(max-min)*(h-24);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();}
setInterval(()=>{if(!last)return;const age=Date.now()-last.lastUpdate;$('age').textContent=last.lastUpdate?(age/1000).toFixed(1)+'s':'—';if(age>12000){forceWait('Stale data — no signal');$('dot').className='dot bad';$('feed').textContent='Stale / unavailable';$('connection').textContent='Unavailable';}},1000);
$('symbol').addEventListener('change',connect);
fetch('/api/config').then(r=>r.json()).then(c=>{config=c;$('mode').textContent=c.mode==='demo'?'SIMULATED DEMO':'PROVIDER MODE';$('notice').textContent=c.mode==='demo'?'SIMULATED DATA ONLY — these are generated prices, not Pocket Option OTC quotes. Signals are for interface testing, not trading.':'EXTERNAL PROVIDER MODE — verify authorization, symbol mappings, timestamps and quote accuracy before any use.';connect()}).catch(()=>{$('mode').textContent='OFFLINE';forceWait('Server unavailable')});
