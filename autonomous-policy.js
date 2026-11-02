'use strict';

// Conservative signal-quality gate for the synthetic autonomous demo engine.
// This module never connects to a broker or submits orders.
function evaluateSignal({candles=[],signal='WAIT',now=Date.now(),minCandles=20,maxAgeMs=12000,minTrendEfficiency=0.22,minRangePct=0.00005,maxRangePct=0.02}={}) {
  const wait=(reason,extra={})=>({action:'WAIT',approved:false,reason,...extra});
  if(!Array.isArray(candles)||candles.length<minCandles)return wait('Insufficient candle history',{count:Array.isArray(candles)?candles.length:0});
  const recent=candles.slice(-minCandles);
  if(recent.some(c=>!c||![c.time,c.open,c.high,c.low,c.close].every(Number.isFinite)||c.high<c.low||c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)))return wait('Invalid OHLC candle');
  const last=recent[recent.length-1];
  if(now-last.time>maxAgeMs||last.time>now+2000)return wait('Stale or future-dated candle',{ageMs:now-last.time});
  for(let i=1;i<recent.length;i++)if(recent[i].time<=recent[i-1].time)return wait('Out-of-order candles');
  const first=recent[0].close, net=Math.abs(last.close-first);
  const path=recent.slice(1).reduce((sum,c,i)=>sum+Math.abs(c.close-recent[i].close),0);
  const efficiency=path===0?0:net/path;
  const high=Math.max(...recent.map(c=>c.high)),low=Math.min(...recent.map(c=>c.low));
  const rangePct=first===0?Infinity:(high-low)/Math.abs(first);
  if(!Number.isFinite(rangePct)||rangePct<minRangePct)return wait('Insufficient movement',{trendEfficiency:Number(efficiency.toFixed(3)),rangePct});
  if(rangePct>maxRangePct)return wait('Excessive volatility',{trendEfficiency:Number(efficiency.toFixed(3)),rangePct});
  if(efficiency<minTrendEfficiency)return wait('Choppy price action',{trendEfficiency:Number(efficiency.toFixed(3)),rangePct});
  const direction=last.close>first?'UP':last.close<first?'DOWN':'WAIT';
  if(!['UP','DOWN'].includes(signal)||signal!==direction)return wait('Signal does not agree with recent price direction',{trendEfficiency:Number(efficiency.toFixed(3)),rangePct,direction});
  return {action:signal,approved:true,reason:'Signal passed demo quality gate',trendEfficiency:Number(efficiency.toFixed(3)),rangePct,direction};
}
module.exports={evaluateSignal};
