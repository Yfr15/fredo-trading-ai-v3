const assert=require('node:assert/strict');const {indicators,pushCandle,snapshot}=require('./server');
assert.equal(indicators([]).signal,'WAIT');const symbol='AAPL_otc',t=Math.floor(Date.now()/5000)*5000-200000;
for(let i=0;i<40;i++){let p=100+i*.02;pushCandle(symbol,{time:t+i*5000,open:p,close:p+.01,high:p+.02,low:p-.01});}
const snap=snapshot(symbol);assert.equal(snap.count,40);assert.ok(['UP','DOWN','WAIT'].includes(snap.signal));assert.equal(snap.source,'SIMULATED');assert.throws(()=>pushCandle(symbol,{time:t-5000,open:1,high:2,low:0,close:1}),/Out-of-order/);console.log('PASS: indicators, candle validation, and snapshot');
