'use strict';
const WebSocket=require('ws');
const DEFAULT_SYMBOLS=['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','LINKUSDT'];
function createFiveSecondAggregator(onCandle,{clock=()=>Date.now()}={}) {
 const current=new Map();
 function tick(symbol,price,time,quantity=0) {
  if(!symbol||!Number.isFinite(price)||price<=0||!Number.isFinite(time)||time<=0) return false;
  const bucket=Math.floor(time/5000)*5000;
  const prior=current.get(symbol);
  if(prior&&bucket<prior.time)return false;
  if(!prior||bucket>prior.time) {
   if(prior) onCandle(symbol,{...prior});
   current.set(symbol,{time:bucket,open:price,high:price,low:price,close:price,volume:Math.max(0,quantity)});
  } else {
   prior.high=Math.max(prior.high,price);prior.low=Math.min(prior.low,price);prior.close=price;prior.volume+=Math.max(0,quantity);
   onCandle(symbol,{...prior});
  }
  return true;
 }
 function flushExpired(now=clock()) {
  for(const [symbol,c] of current) if(now>=c.time+5000) {
   onCandle(symbol,{...c});current.delete(symbol);
  }
 }
 return {tick,flushExpired,current};
}
function startBinanceFeed({symbols=DEFAULT_SYMBOLS,onCandle,onStatus=()=>{},WebSocketImpl=WebSocket,clock=()=>Date.now()}={}) {
 if(typeof onCandle!=='function')throw new TypeError('onCandle callback required');
 const agg=createFiveSecondAggregator(onCandle,{clock});
 let socket=null,stopped=false,retry=1000,timer=null;
 const streams=symbols.map(s=>s.toLowerCase()+'@aggTrade').join('/');
 function connect(){
  if(stopped)return;
  onStatus({connected:false,state:'connecting',source:'BINANCE_SPOT'});
  socket=new WebSocketImpl('wss://stream.binance.com:9443/stream?streams='+streams);
  socket.on('open',()=>{retry=1000;onStatus({connected:true,state:'live',source:'BINANCE_SPOT'});});
  socket.on('message',raw=>{try{
   const outer=JSON.parse(raw.toString()),d=outer.data||outer;
   if(d.e!=='aggTrade')return;
   const symbol=String(d.s||'').toUpperCase(),price=Number(d.p),time=Number(d.T),qty=Number(d.q);
   agg.tick(symbol,price,time,qty);
  }catch{}});
  socket.on('error',()=>{try{socket.close()}catch{}});
  socket.on('close',()=>{onStatus({connected:false,state:'reconnecting',source:'BINANCE_SPOT'});if(!stopped){timer=setTimeout(connect,retry);retry=Math.min(retry*2,30000);}});
 }
 const flush=setInterval(()=>agg.flushExpired(clock()),250);
 connect();
 return {close(){stopped=true;clearInterval(flush);if(timer)clearTimeout(timer);if(socket)socket.close();},aggregator:agg};
}
module.exports={DEFAULT_SYMBOLS,createFiveSecondAggregator,startBinanceFeed};
