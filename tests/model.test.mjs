import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pairKey, compare, conceptProgress, connectivity, validateUnit } from '../js/model.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url)));
const units = JSON.parse(readFileSync(new URL('../data/units.json', import.meta.url))).map(load);

const tiny = {
  unit: { id: 't', title: 'T', standards: [] },
  groups: [{ id: 'g', label: 'G' }],
  concepts: ['a', 'b', 'c'].map((id) => ({ id, label: id, group: 'g', level: 0, importance: 3, difficulty: 3 })),
  links: [
    { source: 'a', target: 'b', type: 'prerequisite', label: '' },
    { source: 'a', target: 'b', type: 'relation', label: 'a는 b다.' },
    { source: 'b', target: 'c', type: 'relation', label: 'b는 c다.' },
  ],
};

test('data/의 모든 단원이 검사를 통과한다', () => {
  for (const u of units) assert.deepEqual(validateUnit(u), [], u.unit.id);
});

test('개념 짝은 방향을 따지지 않는다', () => {
  assert.equal(pairKey('a', 'b'), pairKey('b', 'a'));
});

test('같은 짝의 선수 학습·관계 연결은 개념 짝 하나로 센다', () => {
  assert.equal(compare(tiny, []).total, 2);
});

test('방향이 반대여도 맞은 연결이고, 선생님에 없는 짝은 내가 더한 연결이다', () => {
  const r = compare(tiny, [
    { source: 'b', target: 'a', text: '...' },
    { source: 'a', target: 'c', text: '...' },
  ]);
  assert.deepEqual(r.matched, ['a|b']);
  assert.deepEqual(r.missed, ['b|c']);
  assert.deepEqual(r.extra, ['a|c']);
});

test('개념별 달성도는 그 개념이 낀 짝만 센다', () => {
  assert.deepEqual(conceptProgress(tiny, ['a|b'], 'b'), { done: 1, total: 2 });
  assert.deepEqual(conceptProgress(tiny, ['a|b'], 'c'), { done: 0, total: 1 });
});

test('연결성은 1~5 범위다', () => {
  const c = connectivity(tiny);
  assert.equal(c.get('b'), 5);
  assert.equal(c.get('a'), 1);
  for (const u of units) for (const v of connectivity(u).values()) assert.ok(v >= 1 && v <= 5);
});

test('검사는 흔한 실수를 찾아낸다', () => {
  const broken = structuredClone(tiny);
  broken.concepts[0].group = 'nope';
  broken.links.push({ source: 'a', target: 'zzz', type: 'relation', label: '' });
  const errors = validateUnit(broken);
  assert.ok(errors.some((e) => e.includes("없는 영역 'nope'")));
  assert.ok(errors.some((e) => e.includes('없는 개념')));
  assert.ok(errors.some((e) => e.includes('관계 문장')));
});
