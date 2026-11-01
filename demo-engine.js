'use strict';

// Simulation only. This module never connects to a broker or places real orders.
const DAY_MS=24*60*60*1000;
class DemoEngine {
  constructor({maxDailyLoss=10,maxConsecutiveLosses=3,maxOpenTrades=3}={}) {
    this.enabled=false;
    this.settings={stake:1,payout:0.92,expiryCandles:3,maxDailyLoss,maxConsecutiveLosses,maxOpenTrades};
    this.trades=[];
    this.dailyPnl=0;
    this.consecutiveLosses=0;
    this.dayKey=this.todayKey();
    this.haltedReason=null;
    this.lastEntry=new Map();
  }
  todayKey(){return new Date().toISOString().slice(0,10);}
  rollDay(){
    const key=this.todayKey();
    if(key!==this.dayKey){this.dayKey=key;this.dailyPnl=0;this.consecutiveLosses=0;this.haltedReason=null;}
  }
  status(){
    this.rollDay();
    const open=this.trades.filter(t=>t.status==='OPEN');
    const settled=this.trades.filter(t=>t.status==='WIN'||t.status==='LOSS'||t.status==='TIE');
    const wins=settled.filter(t=>t.status==='WIN').length;
    const losses=settled.filter(t=>t.status==='LOSS').length;
    return {enabled:this.enabled,mode:'SIMULATED_ONLY',settings:{...this.settings},dailyPnl:Number(this.dailyPnl.toFixed(2)),consecutiveLosses:this.consecutiveLosses,haltedReason:this.haltedReason,openTrades:open.length,totalTrades:settled.length,wins,losses,ties:settled.filter(t=>t.status==='TIE').length,winRate:settled.length?Number((wins/settled.length*100).toFixed(1)):null,trades:this.trades.slice(-50).reverse()};
  }
  configure(input={}){
    const stake=Number(input.stake??this.settings.stake);
    const maxDailyLoss=Number(input.maxDailyLoss??this.settings.maxDailyLoss);
    const maxConsecutiveLosses=Number(input.maxConsecutiveLosses??this.settings.maxConsecutiveLosses);
    const expiryCandles=Number(input.expiryCandles??this.settings.expiryCandles);
    if(!Number.isFinite(stake)||stake<1||stake>5)throw Error('Demo stake must be between $1 and $5');
    if(!Number.isFinite(maxDailyLoss)||maxDailyLoss<1||maxDailyLoss>25)throw Error('Daily loss limit must be between $1 and $25');
    if(!Number.isInteger(maxConsecutiveLosses)||maxConsecutiveLosses<1||maxConsecutiveLosses>5)throw Error('Consecutive-loss limit must be 1 to 5');
    if(!Number.isInteger(expiryCandles)||expiryCandles<1||expiryCandles>6)throw Error('Expiry must be 1 to 6 candles');
    this.settings={...this.settings,stake,maxDailyLoss,maxConsecutiveLosses,expiryCandles};
    return this.status();
  }
  start(){this.rollDay();if(this.haltedReason)throw Error('Risk stop active: '+this.haltedReason);this.enabled=true;return this.status();}
  stop(){this.enabled=false;return this.status();}
  onCandle(symbol,candle,signal,source){
    this.rollDay();
    // Resolve simulated positions only against subsequent completed candles.
    for(const trade of this.trades){
      if(trade.status!=='OPEN'||trade.symbol!==symbol||candle.time<trade.expiresAt)continue;
      const won=trade.direction==='UP'?candle.close>trade.entryPrice:candle.close<trade.entryPrice;
      const tie=candle.close===trade.entryPrice;
      trade.exitPrice=candle.close;trade.closedAt=candle.time;
      trade.status=tie?'TIE':won?'WIN':'LOSS';
      const pnl=tie?0:won?Number((trade.stake*trade.payout).toFixed(2)):-trade.stake;
      trade.pnl=pnl;this.dailyPnl=Number((this.dailyPnl+pnl).toFixed(2));
      this.consecutiveLosses=won||tie?0:this.consecutiveLosses+1;
      if(this.dailyPnl<=-this.settings.maxDailyLoss){this.enabled=false;this.haltedReason='Daily demo loss limit reached';}
      if(this.consecutiveLosses>=this.settings.maxConsecutiveLosses){this.enabled=false;this.haltedReason='Consecutive demo loss limit reached';}
    }
    if(!this.enabled||source!=='SIMULATED'||!['UP','DOWN'].includes(signal))return;
    const open=this.trades.filter(t=>t.status==='OPEN');
    if(open.length>=this.settings.maxOpenTrades||open.some(t=>t.symbol===symbol))return;
    const last=this.lastEntry.get(symbol)||0;
    if(candle.time-last< this.settings.expiryCandles*5000)return;
    const trade={id:'D'+candle.time.toString(36)+Math.random().toString(36).slice(2,7),symbol,direction:signal,entryPrice:candle.close,exitPrice:null,stake:this.settings.stake,payout:this.settings.payout,openedAt:candle.time,expiresAt:candle.time+this.settings.expiryCandles*5000,closedAt:null,status:'OPEN',pnl:null,source:'SYNTHETIC_PRICE'};
    this.trades.push(trade);this.trades=this.trades.slice(-500);this.lastEntry.set(symbol,candle.time);
  }
}
module.exports={DemoEngine};
