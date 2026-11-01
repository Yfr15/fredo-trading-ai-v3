'use strict';
const $=id=>document.getElementById(id);let stream=null,last=null,config=null;
const fmt=n=>n===null||n===undefined?'—':Number(n).toFixed(5);
function connect(){if(stream)stream.close();last=null;const symbol=$('symbol').value;$('feed').textContent='Connecting…';$('dot').className='dot';
 fetch('/api/market?symbol='+encodeURIComponent(symbol)).then(r=>r.json()).then(render).catch(()=>{});
 stream=new EventSource('/api/stream?symbol='+encodeURIComponent(symbol));stream.addEventListener('market',event=>{try{render(JSON.parse(event.data))}catch{}});
 stream.onerror=()=>{$('feed').textContent='Connection interrupted';$('dot').className='dot bad';forceWait('Connection interrupted')};}
function forceWait(reason){$('signal').textContent='WAIT';$('signal').className='';$('reason').textContent=reason;}

const SCORE_KEY='fredo-v3-signal-scorecard-v1';
const SCORE_PEAK_KEY='fredo-v3-scorecard-peak-v1';
let scorePeak=0;
try{scorePeak=Number(localStorage.getItem(SCORE_PEAK_KEY)||0)||0;}catch{}
let scoreRows=[];
try{scoreRows=JSON.parse(localStorage.getItem(SCORE_KEY)||'[]');if(!Array.isArray(scoreRows))scoreRows=[];}catch{scoreRows=[];}
function saveScores(){try{localStorage.setItem(SCORE_KEY,JSON.stringify(scoreRows.slice(-100)));localStorage.setItem(SCORE_PEAK_KEY,String(scorePeak));}catch{}}
function updateScorecard(d){
 const candles=d.candles||[];if(!candles.length)return;
 const current=candles[candles.length-1],symbol=d.symbol;
 // Resolve only after three later 5-second candles have completed.
 for(const row of scoreRows){
  if(row.symbol!==symbol||row.result!=='PENDING'||current.time<row.expiresAt)continue;
  row.exit=Number(current.close);
  row.result=row.exit===row.entry?'TIE':(row.direction==='UP'?row.exit>row.entry:row.exit<row.entry)?'WIN':'LOSS';
  row.checkedAt=Date.now();
 }
 const already=scoreRows.some(r=>r.symbol===symbol&&r.candleTime===current.time);
 if(!already&&['UP','DOWN'].includes(d.signal)&&!d.stale){
  scoreRows.push({symbol,direction:d.signal,entry:Number(current.close),candleTime:current.time,expiresAt:current.time+15000,result:'PENDING'});
  scoreRows=scoreRows.slice(-100);
 }
 saveScores();renderScorecard();
}
function renderScorecard(){
 const recent=scoreRows.slice().reverse().slice(0,20),done=recent.filter(r=>r.result!=='PENDING'),wins=done.filter(r=>r.result==='WIN').length,losses=done.filter(r=>r.result==='LOSS').length,ties=done.filter(r=>r.result==='TIE').length;
 const last10=scoreRows.slice().reverse().slice(0,10).filter(r=>r.result!=='PENDING');
 const last10Wins=last10.filter(r=>r.result==='WIN').length;
 const accuracy=done.length?(wins/done.length)*100:0;
 if(done.length&&accuracy>scorePeak){scorePeak=accuracy;saveScores();}
 $('score-total').textContent=done.length+' settled / '+recent.length+' tracked';
 $('score-accuracy').textContent=done.length?accuracy.toFixed(1)+'%':'—';
 $('score-record').textContent=wins+'W · '+losses+'L · '+ties+'T';
 $('score-peak').textContent=scorePeak?scorePeak.toFixed(1)+'%':'—';
 $('score-last10').textContent=last10.length?(last10Wins+'/'+last10.length+' wins · '+(last10Wins/last10.length*100).toFixed(0)+'%'):'—';
 const bySymbol={};scoreRows.filter(r=>r.result!=='PENDING').forEach(r=>{const s=r.symbol;(bySymbol[s]??={w:0,l:0,t:0}).w+=r.result==='WIN'?1:0;bySymbol[s].l+=r.result==='LOSS'?1:0;bySymbol[s].t+=r.result==='TIE'?1:0;});
 const symbolRows=Object.entries(bySymbol).map(([s,v])=>({s,...v,n:v.w+v.l+v.t})).sort((a,b)=>b.n-a.n);
 $('score-symbols').innerHTML=symbolRows.length?symbolRows.map(v=>'<div class="trade-row"><b>'+v.s.replace('_otc',' OTC')+'</b><span>'+v.w+'W · '+v.l+'L</span><span>'+v.t+'T</span><span>'+((v.w+v.l)?(v.w/(v.w+v.l)*100).toFixed(0)+'%':'—')+'</span></div>').join(''):'No settled symbol results yet.';
 $('score-rows').innerHTML=recent.length?recent.map(r=>'<div class="trade-row"><b>'+r.symbol.replace('_otc',' OTC')+'</b><span>'+r.direction+'</span><span>'+r.result+'</span><span>'+r.entry.toFixed(5)+(r.exit===undefined?'':' → '+r.exit.toFixed(5))+'</span></div>').join(''):'No directional signals scored yet.';
}

function render(d){if(!d||d.symbol!==$('symbol').value)return;last=d;updateScorecard(d);
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

async function demoRequest(path,body={}){const r=await fetch(path,{method:path.endsWith('/status')?'GET':'POST',headers:{'Content-Type':'application/json'},body:path.endsWith('/status')?undefined:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Demo request failed');return d;}
function renderDemo(d){$('demo-pnl').textContent=(d.dailyPnl<0?'-':'$')+(Math.abs(d.dailyPnl).toFixed(2));$('demo-winrate').textContent=d.winRate===null?'—':d.winRate+'%';$('demo-open').textContent=d.openTrades;$('demo-state').textContent=d.enabled?'RUNNING':'STOPPED';$('demo-risk').textContent=d.haltedReason||'Risk stops enabled · No live execution';$('demo-trades').innerHTML=d.trades.length?d.trades.slice(0,12).map(t=>'<div class="trade-row"><b>'+t.symbol.replace('_otc',' OTC')+'</b><span>'+t.direction+'</span><span>'+t.status+'</span><span>'+(t.pnl===null?'OPEN':(t.pnl<0?'-':'$')+Math.abs(t.pnl).toFixed(2))+'</span></div>').join(''):'No demo trades yet.';}
async function refreshDemo(){try{renderDemo(await demoRequest('/api/demo/status'))}catch(e){$('demo-risk').textContent=e.message}}
async function saveDemo(){try{const d=await demoRequest('/api/demo/config',{stake:Number($('demo-stake').value),maxDailyLoss:Number($('demo-loss').value),maxConsecutiveLosses:Number($('demo-streak').value),expiryCandles:Number($('demo-expiry').value)});renderDemo(d)}catch(e){$('demo-risk').textContent=e.message}}
$('demo-save').addEventListener('click',saveDemo);
$('demo-start').addEventListener('click',async()=>{try{await saveDemo();renderDemo(await demoRequest('/api/demo/start'))}catch(e){$('demo-risk').textContent=e.message}});
$('demo-stop').addEventListener('click',async()=>{try{renderDemo(await demoRequest('/api/demo/stop'))}catch(e){$('demo-risk').textContent=e.message}});
refreshDemo();setInterval(refreshDemo,2000);
