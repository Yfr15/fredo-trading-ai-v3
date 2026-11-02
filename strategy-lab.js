'use strict';

// Historical research only. Signals are computed from candles available at the
// decision time; entry occurs on the next candle open to avoid same-bar lookahead.
function backtestStrategy(candles, options={}) {
  const {
    signalFn, expiryCandles=3, payout=0.92, stake=1,
    minHistory=40, feePerTrade=0, startIndex=minHistory
  } = options;
  if (!Array.isArray(candles)) throw new TypeError('candles must be an array');
  if (typeof signalFn !== 'function') throw new TypeError('signalFn is required');
  if (!Number.isInteger(expiryCandles) || expiryCandles < 1) throw new RangeError('expiryCandles must be a positive integer');
  if (!(payout > 0 && payout <= 1) || !(stake > 0) || !(feePerTrade >= 0)) throw new RangeError('Invalid payout, stake, or fee');
  for (let i=0;i<candles.length;i++) {
    const c=candles[i];
    if (!c || ![c.time,c.open,c.high,c.low,c.close].every(Number.isFinite) ||
      c.high < Math.max(c.open,c.close) || c.low > Math.min(c.open,c.close) || c.high < c.low)
      throw new Error('Invalid OHLC candle at index '+i);
    if (i && c.time <= candles[i-1].time) throw new Error('Candles must be strictly chronological');
  }
  const trades=[];
  const first=Math.max(minHistory, startIndex);
  for (let i=first; i + expiryCandles < candles.length; i++) {
    const history=candles.slice(0,i+1);
    const decision=signalFn(history, i);
    const direction=typeof decision==='string'?decision:decision?.action;
    if (direction !== 'UP' && direction !== 'DOWN') continue;
    const entry=candles[i+1].open;
    const exit=candles[i+expiryCandles].close;
    const outcome=direction==='UP'?(exit>entry?'WIN':exit<entry?'LOSS':'TIE'):(exit<entry?'WIN':exit>entry?'LOSS':'TIE');
    const gross=outcome==='WIN'?stake*payout:outcome==='LOSS'?-stake:0;
    trades.push({decisionTime:candles[i].time,entryTime:candles[i+1].time,exitTime:candles[i+expiryCandles].time,direction,entryPrice:entry,exitPrice:exit,outcome,pnl:Number((gross-feePerTrade).toFixed(8))});
  }
  const wins=trades.filter(t=>t.outcome==='WIN').length;
  const losses=trades.filter(t=>t.outcome==='LOSS').length;
  const ties=trades.filter(t=>t.outcome==='TIE').length;
  const net=trades.reduce((s,t)=>s+t.pnl,0);
  const grossWins=trades.filter(t=>t.pnl>0).reduce((s,t)=>s+t.pnl,0);
  const grossLosses=Math.abs(trades.filter(t=>t.pnl<0).reduce((s,t)=>s+t.pnl,0));
  let equity=0,peak=0,maxDrawdown=0;
  for (const t of trades) { equity+=t.pnl; peak=Math.max(peak,equity); maxDrawdown=Math.max(maxDrawdown,peak-equity); }
  const n=wins+losses;
  const winRate=n?wins/n:null;
  // Wilson 95% interval for win rate, excluding ties.
  let confidence=null;
  if(n){const z=1.96,den=1+z*z/n,center=(winRate+z*z/(2*n))/den,half=z*Math.sqrt(winRate*(1-winRate)/n+z*z/(4*n*n))/den;confidence={low:Number(Math.max(0,center-half).toFixed(4)),high:Number(Math.min(1,center+half).toFixed(4))};}
  return {
    trades,wins,losses,ties,decisiveTrades:n,
    winRate:winRate===null?null:Number((winRate*100).toFixed(2)),
    winRateConfidence95:confidence,
    breakEvenWinRate:Number((100/(1+payout)).toFixed(2)),
    netPnl:Number(net.toFixed(4)),
    expectancyPerTrade:trades.length?Number((net/trades.length).toFixed(6)):null,
    profitFactor:grossLosses?Number((grossWins/grossLosses).toFixed(4)):(grossWins?null:0),
    maxDrawdown:Number(maxDrawdown.toFixed(4)),
    sampleSize:trades.length,
    researchOnly:true,
    warning:'Historical simulation is not a prediction. Results depend on data quality, payout, execution assumptions, and market regime.'
  };
}
module.exports={backtestStrategy};
