'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const {server}=require('./server');

const originalFetch=global.fetch;
const originalKey=process.env.OTCHARTS_API_KEY;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
function request(path){
  return new Promise((resolve,reject)=>{
    const req=http.get({host:'127.0.0.1',port:server.address().port,path},res=>{
      let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);
      res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(body)})}catch(e){reject(e)}});
    });
    req.on('error',reject);
  });
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    // Missing credentials must fail closed without making a provider request.
    delete process.env.OTCHARTS_API_KEY;
    global.fetch=async()=>{throw new Error('fetch must not run without a key')};
    let result=await request('/api/otcharts-test');
    assert.equal(result.status,503);
    assert.equal(result.body.ok,false);
    assert.match(result.body.error,/not configured/i);

    // A provider plan rejection is reported as a plan/permission issue, not a bad key.
    process.env.OTCHARTS_API_KEY='test-key';
    global.fetch=async(url,options)=>{
      assert.equal(String(url),'https://otcharts.com/v1/venues');
      assert.equal(options.headers.Authorization,'Bearer test-key');
      return json({error:'Plan does not include venue access'},402);
    };
    result=await request('/api/otcharts-test');
    assert.equal(result.status,200);
    assert.equal(result.body.ok,false);
    assert.equal(result.body.stage,'venues');
    assert.equal(result.body.providerStatus,402);
    assert.match(result.body.message,/plan/i);

    // A complete read-only diagnostic validates the OTC venue, free-tier symbol,
    // and five-second candle response without implying streaming or execution.
    const calls=[];
    global.fetch=async(url,options)=>{
      const path=new URL(String(url)).pathname+new URL(String(url)).search;
      calls.push(path);
      assert.equal(options.headers.Authorization,'Bearer test-key');
      if(path==='/v1/venues')return json({venues:[{id:'otc',open:true,timeframes:[5]}]});
      if(path==='/v1/usage')return json({remaining:100});
      if(path==='/v1/symbols?venue=otc')return json({symbols:[
        {symbol:'EURUSD_otc',open:true},{symbol:'GBPUSD_otc',open:true},
        {symbol:'USDJPY_otc',open:true},{symbol:'BTCUSD_otc',open:true},
        {symbol:'AUDUSD_otc',open:true}
      ]});
      if(path.startsWith('/v1/candles?venue=otc&symbol=EURUSD_otc&tf=5&limit=5')){
        return json({candles:[
          {time:1700000000000,open:1.1,high:1.2,low:1.0,close:1.15},
          {time:1700000005000,open:1.15,high:1.2,low:1.1,close:1.18}
        ]});
      }
      throw new Error('Unexpected OTCharts request: '+path);
    };
    result=await request('/api/otcharts-test');
    assert.equal(result.status,200);
    assert.equal(result.body.ok,true);
    assert.equal(result.body.stage,'complete');
    assert.equal(result.body.symbol,'EURUSD_otc');
    assert.equal(result.body.timeframeSeconds,5);
    assert.equal(result.body.count,2);
    assert.equal(result.body.liveStreamAvailable,false);
    assert.match(result.body.notice,/does not connect/i);
    assert.deepEqual(calls,['/v1/venues','/v1/usage','/v1/symbols?venue=otc','/v1/candles?venue=otc&symbol=EURUSD_otc&tf=5&limit=5']);

    console.log('PASS: OTCharts diagnostic missing-key, plan-rejection, and read-only OTC candle paths');
  }finally{
    global.fetch=originalFetch;
    if(originalKey===undefined)delete process.env.OTCHARTS_API_KEY;
    else process.env.OTCHARTS_API_KEY=originalKey;
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
