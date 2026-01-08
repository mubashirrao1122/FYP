import assert from 'node:assert/strict';
import { parseHermesPriceFeed } from '../lib/perps/pyth';

const sample = {
  id: '0xabc',
  price: {
    price: '12345',
    conf: '67',
    expo: -2,
    publish_time: 1710000000,
  },
};

const parsed = parseHermesPriceFeed(sample);

assert.ok(parsed, 'Expected parsed price');
assert.equal(parsed?.price, 123.45);
assert.equal(parsed?.confidence, 0.67);
assert.equal(parsed?.expo, -2);
assert.equal(parsed?.publishTime, 1710000000);

const empty = parseHermesPriceFeed({ id: '0xabc', price: undefined } as never);
assert.equal(empty, null);

console.log('pyth parsing tests passed');
