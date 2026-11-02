'use strict';

// Simulation only. This module never connects to a broker or places real orders.
class DemoEngine {
  constructor({maxDailyLoss=10,maxConsecutiveLosses=3,maxOpenTrades=3,maxTradesPerDay=20,cooldownCandles=3}={}) {
    this.enabled=false;
    this.settings={stake:1,payout:0.92,expiryCandles:3,maxDailyLoss,maxConsecutiveLosses,maxOpenTrades,maxTradesPerDay,cooldownCandles};
    this.trades=[];this.events=[];this.dailyPnl=0;this.consecutiveLosses=0;
    this.dayKey=this.todayKey();this.haltedReason=null;this.lastEntry=new Map();
  }
  todayKey(){return new Date().toISOString().slice(0,10);}
  log(type,message,extra={}){this.events.push({time:Date.now(),type,message,...extra});this.events=this.events.slice(-100);}
  rollDay(){
    const key=this.todayKey();
    if(key!==this.dayKey){this.dayKey=key;this.dailyPnl=0;this.consecutiveLosses=0;this.haltedReason=null;this.log('RESET','Daily risk counters reset');}
  }
  dailyTrades(){const today=this.todayKey();return this.trades.filter(t=>new Date(t.openedAt).toISOString().slice(0,10)===today).length;}
  status(){
    this.rollDay();const open=this.trades.filter(t=>t.status==='OPEN');
    const settled=this.trades.filter(t=>t.status==='WIN'||t.status==='LOSS'||t.status==='TIE');
    const wins=settled.filter(t=>t.status==='WIN').length,losses=settled.filter(t=>t.status==='LOSS').length;
    return {enabled:this.enabled,mode:'SIMULATED_ONLY',settings:{...this.settings},dailyPnl:Number(this.dailyPnl.toFixed(2)),dailyTrades:this.dailyTrades(),consecutiveLosses:this.consecutiveLosses,haltedReason:this.haltedReason,openTrades:open.length,totalTrades:settled.length,wins,losses,ties:settled.filter(t=>t.status==='TIE').length,winRate:settled.length?Number((wins/settled.length*100).toFixed(1)):null,trades:this.trades.slice(-50).reverse(),events:this.events.slice(-20).reverse()};
  }
  configure(input={}){
    const next={...this.settings};
    for(const key of ['stake','maxDailyLoss','maxConsecutiveLosses','expiryCandles','maxOpenTrades','maxTradesPerDay','cooldownCandles'])if(input[key]!==undefined)next[key]=Number(input[key]);
    if(!Number.isFinite(next.stake)||next.stake<1||next.stake>5)throw Error('Demo stake must be between $1 and $5');
    if(!Number.isFinite(next.maxDailyLoss)||next.maxDailyLoss<1||next.maxDailyLoss>25)throw Error('Daily loss limit must be between $1 and $25');
    if(!Number.isInteger(next.maxConsecutiveLosses)||next.maxConsecutiveLosses<1||next.maxConsecutiveLosses>5)throw Error('Consecutive-loss limit must be 1 to 5');
    if(!Number.isInteger(next.expiryCandles)||next.expiryCandles<1||next.expiryCandles>6)throw Error('Expiry must be 1 to 6 candles');
    if(!Number.isInteger(next.maxOpenTrades)||next.maxOpenTrades<1||next.maxOpenTrades>3)throw Error('Maximum open demo trades must be 1 to 3');
    if(!Number.isInteger(next.maxTradesPerDay)||next.maxTradesPerDay<1||next.maxTradesPerDay>50)throw Error('Daily demo trade cap must be 1 to 50');
    if(!Number.isInteger(next.cooldownCandles)||next.cooldownCandles<1||next.cooldownCandles>12)throw Error('Cooldown must be 1 to 12 candles');
    this.settings=next;this.log('CONFIG','Risk settings saved');return this.status();
  }
  start(){this.rollDay();if(this.haltedReason)throw Error('Risk stop active: '+this.haltedReason);this.enabled=true;this.log('START','Demo engine started');return this.status();}
  stop(){this.enabled=false;this.log('STOP','Emergency stop: demo engine stopped');return this.status();}
  halt(reason){this.enabled=false;this.haltedReason=reason;this.log('HALT',reason);}
  onCandle(symbol,candle,signal,source){
    this.rollDay();
    for(const trade of this.trades){
      if(trade.status!=='OPEN'||trade.symbol!==symbol||candle.time<trade.expiresAt)continue;
      const won=trade.direction==='UP'?candle.close>trade.entryPrice:candle.close<trade.entryPrice,tie=candle.close===trade.entryPrice;
      trade.exitPrice=candle.close;trade.closedAt=candle.time;trade.status=tie?'TIE':won?'WIN':'LOSS';
      const pnl=tie?0:won?Number((trade.stake*trade.payout).toFixed(2)):-trade.stake;
      trade.pnl=pnl;this.dailyPnl=Number((this.dailyPnl+pnl).toFixed(2));this.consecutiveLosses=won||tie?0:this.consecutiveLosses+1;
      this.log('SETTLE',trade.status+' '+symbol,{tradeId:trade.id,pnl});
      if(this.dailyPnl<=-this.settings.maxDailyLoss)this.halt('Daily demo loss limit reached');
      if(this.consecutiveLosses>=this.settings.maxConsecutiveLosses)this.halt('Consecutive demo loss limit reached');
    }
    if(!this.enabled||source!=='SIMULATED'||!['UP','DOWN'].includes(signal))return;
    if(this.dailyTrades()>=this.settings.maxTradesPerDay){this.halt('Daily demo trade cap reached');return;}
    const open=this.trades.filter(t=>t.status==='OPEN');
    if(open.length>=this.settings.maxOpenTrades||open.some(t=>t.symbol===symbol))return;
    const last=this.lastEntry.get(symbol)||0;
    if(candle.time-last<this.settings.cooldownCandles*5000)return;
    const trade={id:'D'+candle.time.toString(36)+Math.random().toString(36).slice(2,7),symbol,direction:signal,entryPrice:candle.close,exitPrice:null,stake:this.settings.stake,payout:this.settings.payout,openedAt:candle.time,expiresAt:candle.time+this.settings.expiryCandles*5000,closedAt:null,status:'OPEN',pnl:null,source:'SYNTHETIC_PRICE'};
    this.trades.push(trade);this.trades=this.trades.slice(-500);this.lastEntry.set(symbol,candle.time);this.log('OPEN',signal+' '+symbol,{tradeId:trade.id});
  }
}
module.exports={DemoEngine};
