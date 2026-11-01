const assert=require('node:assert/strict');const {indicators,pushCandle,snapshot}=require('./server');
assert.equal(indicators([]).signal,'WAIT');const symbol='AAPL_otc',t=Math.floor(Date.now()/5000)*5000-200000;
for(let i=0;i<40;i++){let p=100+i*.02;pushCandle(symbol,{time:t+i*5000,open:p,close:p+.01,high:p+.02,low:p-.01});}
const snap=snapshot(symbol);assert.equal(snap.count,40);assert.ok(['UP','DOWN','WAIT'].includes(snap.signal));assert.equal(snap.source,'SIMULATED');assert.throws(()=>pushCandle(symbol,{time:t-5000,open:1,high:2,low:0,close:1}),/Out-of-order/);const {DemoEngine}=require('./demo-engine');
const engine=new DemoEngine({maxDailyLoss:2,maxConsecutiveLosses:2});
engine.configure({stake:1,payout:.92,expiryCandles:1,maxDailyLoss:2,maxConsecutiveLosses:2});
engine.start();
const base=Date.now()-10000;
engine.onCandle('TEST_otc',{time:base,close:100},'UP','SIMULATED');
assert.equal(engine.status().openTrades,1);
engine.onCandle('TEST_otc',{time:base+5000,close:99},'WAIT','SIMULATED');
assert.equal(engine.status().losses,1);
engine.onCandle('TEST_otc',{time:base+10000,close:99},'UP','SIMULATED');
engine.onCandle('TEST_otc',{time:base+15000,close:98},'WAIT','SIMULATED');
assert.equal(engine.status().enabled,false);
assert.ok(engine.status().haltedReason);
console.log('PASS: indicators, candle validation, snapshots, demo trade settlement and risk stops');
