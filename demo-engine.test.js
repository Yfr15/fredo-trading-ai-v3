'use strict';
const assert=require('node:assert/strict');
const {DemoEngine}=require('./demo-engine');

function makeTrend(now){
  return Array.from({length:20},(_,i)=>{
    const close=100+i*0.1;
    return {time:now-(19-i)*5000,open:close-0.01,high:close+0.02,low:close-0.02,close};
  });
}

const now=Math.floor(Date.now()/5000)*5000;
const history=makeTrend(now);
const last=history.at(-1);

// A provider-labelled feed must never be mistaken for synthetic demo input.
{
  const engine=new DemoEngine();
  engine.start();
  engine.onCandle('TEST_otc',last,'UP','PROVIDER',history);
  assert.equal(engine.status().totalTrades,0);
  assert.equal(engine.status().openTrades,0);
  assert.match(engine.status().lastDecision.reason,/synthetic candles only/i);
}

// The demo engine must stop at the configured daily loss limit.
{
  const engine=new DemoEngine({maxDailyLoss:1,maxConsecutiveLosses:3,cooldownCandles:1});
  engine.configure({expiryCandles:1,stake:1,maxDailyLoss:1});
  engine.start();
  engine.onCandle('TEST_otc',last,'UP','SIMULATED',history);
  assert.equal(engine.status().openTrades,1);

  const losing={time:now+5000,open:last.close,high:last.close+0.01,low:last.close-0.2,close:last.close-0.1};
  engine.onCandle('TEST_otc',losing,'WAIT','SIMULATED',history.concat(losing));
  const status=engine.status();
  assert.equal(status.dailyPnl,-1);
  assert.equal(status.openTrades,0);
  assert.equal(status.enabled,false);
  assert.match(status.haltedReason,/Daily demo loss limit/);
}

// Risk configuration must reject unsafe stake values.
{
  const engine=new DemoEngine();
  assert.throws(()=>engine.configure({stake:0.5}),/stake must be between/);
  assert.throws(()=>engine.configure({stake:6}),/stake must be between/);
}

console.log('PASS: provider-feed isolation, daily-loss shutdown, and stake bounds');
