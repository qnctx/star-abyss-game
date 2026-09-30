import test from 'node:test';
import assert from 'node:assert/strict';
import {createDynamicShadowScheduler} from './dynamic-shadow-scheduler.mjs';

test('first animated change refreshes immediately, subsequent frame changes coalesce to 10 Hz',()=>{
  const scheduler=createDynamicShadowScheduler(.1);
  assert.equal(scheduler.consume(0),false);
  scheduler.request();
  assert.equal(scheduler.consume(0),true);
  assert.equal(scheduler.pending,false);
  for(const time of [1/60,2/60,3/60,4/60,5/60]){
    scheduler.request();
    assert.equal(scheduler.consume(time),false);
    assert.equal(scheduler.pending,true);
  }
  assert.equal(scheduler.consume(.1),true);
  assert.equal(scheduler.consume(.11),false);
  scheduler.request();
  assert.equal(scheduler.consume(.2),true);
});

test('a pending change survives a missing timestamp and a restarted simulation clock',()=>{
  const scheduler=createDynamicShadowScheduler(.1);
  scheduler.request();
  assert.equal(scheduler.consume(4),true);
  scheduler.request();
  assert.equal(scheduler.consume(NaN),false);
  assert.equal(scheduler.pending,true);
  assert.equal(scheduler.consume(0),true);
  assert.equal(scheduler.pending,false);
});
