import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterPoints, isSameSpot } from '../../src/data/cluster.js';

const ids = (groups) => groups.map(g => g.map(p => p.id));

test('pins further apart than the radius stay separate', () => {
  const pts = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 100, y: 0 }];
  assert.deepEqual(ids(clusterPoints(pts, 40)), [['a'], ['b']]);
});

test('pins that would overlap are grouped', () => {
  const pts = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 20, y: 10 }, { id: 'c', x: 300, y: 0 }];
  assert.deepEqual(ids(clusterPoints(pts, 40)), [['a', 'b'], ['c']]);
});

test('every pin lands in exactly one group', () => {
  const pts = Array.from({ length: 50 }, (_, i) => ({ id: String(i), x: (i * 7) % 90, y: (i * 13) % 70 }));
  const flat = clusterPoints(pts, 40).flat().map(p => p.id).sort();
  assert.deepEqual(flat, pts.map(p => p.id).sort());
});

test('the same input always gives the same groups', () => {
  const pts = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 30, y: 0 }, { id: 'c', x: 60, y: 0 }];
  assert.deepEqual(ids(clusterPoints(pts, 40)), ids(clusterPoints(pts, 40)));
  assert.deepEqual(ids(clusterPoints(pts, 40)), [['a', 'b'], ['c']]);
});

test('places in one building are the same spot; places a street apart are not', () => {
  assert.equal(isSameSpot([{ lat: 37.5345, lng: 126.9946 }, { lat: 37.53455, lng: 126.99462 }]), true);
  assert.equal(isSameSpot([{ lat: 37.5345, lng: 126.9946 }, { lat: 37.5360, lng: 126.9946 }]), false);
});

test('single dots left by the dot radius never share a 32 px tap area', async () => {
  const { DOT_CLUSTER_RADIUS_PX } = await import('../../src/data/cluster.js');
  assert.ok(DOT_CLUSTER_RADIUS_PX >= 32);
  // A dense, irregular field: every pair of points left on their own must
  // be further apart than the radius, whatever order they come in.
  const pts = [];
  for (let i = 0; i < 400; i++) pts.push({ x: (i * 37) % 500, y: (i * 53) % 500 });
  const singles = clusterPoints(pts, DOT_CLUSTER_RADIUS_PX).filter(g => g.length === 1).map(g => g[0]);
  for (let a = 0; a < singles.length; a++) {
    for (let b = a + 1; b < singles.length; b++) {
      const d = Math.hypot(singles[a].x - singles[b].x, singles[a].y - singles[b].y);
      assert.ok(d > DOT_CLUSTER_RADIUS_PX, `${d}`);
    }
  }
});
