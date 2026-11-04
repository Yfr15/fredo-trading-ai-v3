'use strict';
const assert=require('node:assert/strict');
const {createFiveSecondAggregator}=require('./binance-feed');
const out=[];const a=createFiveSecondAggregator((s,c)=>out.push({s,...c}));
assert.equal(a.tick('BTCUSDT',100,10001,2),true);
assert.equal(a.tick('BTCUSDT',102,12000,1),true);
assert.equal(a.current.get('BTCUSDT').time,10000);
assert.equal(a.current.get('BTCUSDT').open,100);
assert.equal(a.current.get('BTCUSDT').high,102);
assert.equal(a.current.get('BTCUSDT').low,100);
assert.equal(a.current.get('BTCUSDT').close,102);
assert.equal(a.tick('BTCUSDT',99,9999),false);
a.tick('BTCUSDT',103,15000,3);
assert.equal(out.length,2); // one in-progress update, then the completed candle at rollover
assert.equal(out[1].time,10000);
assert.equal(out[1].volume,3);
assert.equal(a.current.get('BTCUSDT').time,15000);
assert.equal(a.tick('ETHUSDT',20,15001),true);
console.log('PASS: UTC 5-second boundaries, OHLCV updates, rollover, and out-of-order rejection');
