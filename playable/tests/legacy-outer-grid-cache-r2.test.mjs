import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyTerrainHeight} from '../src/layout.mjs';

// Captured from the uncached implementation before the outer-grid memoization.
const originalHeights = [
  [-4000,-3450,-9.452324262657342],[-3999.9,125,6.012629465340114],[-3500,-172.4,-1.8317591980468393],
  [-3100,200,1.633857432165586],[-3000.001,-3000.001,-5.276915362963465],[-3000,3000,-1.084810993400818],
  [-2999.9,2999.9,-1.0809851330888027],[-2500,-125,2.3392654934874697],[0,0,0],
  [2500,125,-2.3392654934874697],[2999.9,-2999.9,1.0809851330888027],[3000,-3000,1.084810993400818],
  [3000.001,3000.001,5.276915362963406],[3100,-200,-1.633857432165586],[3500,172.4,1.8317591980468393],
  [3999.9,-125,-6.0126294653401136],[4000,3450,9.452324262657342],[3500,3500,2.017162313408625],
  [-3500,3500,3.398016160750768],[3500,-3500,-3.398016160750768],[-3500,-3500,-2.017162313408625],
];

test('cached outer grid exactly retains old heights at signed boundaries and repeated positions', () => {
  for (const pass of [originalHeights, [...originalHeights].reverse(), originalHeights]) {
    for (const [x,z,height] of pass) assert.equal(legacyTerrainHeight(x,z), height, `${x},${z}`);
  }
});
