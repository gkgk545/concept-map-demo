// 단원 데이터 검사와 비교 계산. DOM·라이브러리에 의존하지 않는다(테스트 대상).

export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// 선생님 개념도의 개념 짝 → 그 짝에 걸린 연결들
export function teacherPairs(unit) {
  const pairs = new Map();
  for (const link of unit.links) {
    const key = pairKey(link.source, link.target);
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(link);
  }
  return pairs;
}

// 놓친·맞은 연결 옆에 보여 줄 선생님 문장. 선수 학습 연결만 있는 짝은 문장이 없다.
export function teacherSentence(links) {
  const sentences = links.filter((l) => l.label).map((l) => l.label);
  return sentences.length ? sentences.join(' / ') : '(선수 학습 연결)';
}

// myLinks: [{ source, target, text }]
export function compare(unit, myLinks) {
  const pairs = teacherPairs(unit);
  const mine = new Set(myLinks.map((l) => pairKey(l.source, l.target)));
  const matched = [...pairs.keys()].filter((k) => mine.has(k));
  const missed = [...pairs.keys()].filter((k) => !mine.has(k));
  const extra = [...mine].filter((k) => !pairs.has(k));
  return { matched, missed, extra, total: pairs.size };
}

// 개념 하나에 대한 달성도: 그 개념이 낀 선생님 개념 짝 중 맞은 것
export function conceptProgress(unit, matchedKeys, conceptId) {
  const keys = [...teacherPairs(unit).keys()].filter((k) => k.split('|').includes(conceptId));
  const matched = new Set(matchedKeys);
  return { done: keys.filter((k) => matched.has(k)).length, total: keys.length };
}

// 연결성: 선생님 개념도에서 이어진 개념 짝 수를 1~5로 환산
export function connectivity(unit) {
  const degree = new Map(unit.concepts.map((c) => [c.id, 0]));
  for (const key of teacherPairs(unit).keys()) {
    for (const id of key.split('|')) degree.set(id, degree.get(id) + 1);
  }
  const values = [...degree.values()];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const scaled = new Map();
  for (const [id, d] of degree) scaled.set(id, max === min ? 3 : 1 + Math.round((4 * (d - min)) / (max - min)));
  return scaled;
}

// 선생님이 JSON을 직접 고치므로, 흔한 실수를 사람이 읽을 문장으로 알려 준다.
export function validateUnit(unit) {
  const errors = [];
  if (!unit?.unit?.id || !unit.unit.title) errors.push('unit.id와 unit.title이 있어야 합니다.');
  if (!Array.isArray(unit?.groups) || !Array.isArray(unit?.concepts) || !Array.isArray(unit?.links)) {
    errors.push('groups, concepts, links는 배열이어야 합니다.');
    return errors;
  }
  const groupIds = new Set(unit.groups.map((g) => g.id));
  const conceptIds = new Set();
  const standardCodes = new Set((unit.unit.standards ?? []).map((s) => s.code));
  for (const c of unit.concepts) {
    const where = `개념 '${c.id ?? c.label}'`;
    if (!c.id || !c.label) errors.push(`${where}: id와 label이 있어야 합니다.`);
    if (conceptIds.has(c.id)) errors.push(`${where}: id가 중복됩니다.`);
    conceptIds.add(c.id);
    if (!groupIds.has(c.group)) errors.push(`${where}: 없는 영역 '${c.group}'을 가리킵니다.`);
    if (!Number.isInteger(c.level) || c.level < 0) errors.push(`${where}: level은 0 이상의 정수여야 합니다.`);
    for (const f of ['importance', 'difficulty']) {
      if (!Number.isInteger(c[f]) || c[f] < 1 || c[f] > 5) errors.push(`${where}: ${f}는 1~5 정수여야 합니다.`);
    }
    for (const code of c.standards ?? []) {
      if (!standardCodes.has(code)) errors.push(`${where}: 없는 성취기준 '${code}'를 가리킵니다.`);
    }
  }
  for (const l of unit.links) {
    const where = `연결 '${l.source} → ${l.target}'`;
    if (!conceptIds.has(l.source) || !conceptIds.has(l.target)) errors.push(`${where}: 없는 개념을 가리킵니다.`);
    if (l.source === l.target) errors.push(`${where}: 자기 자신을 잇습니다.`);
    if (l.type !== 'prerequisite' && l.type !== 'relation') errors.push(`${where}: type은 prerequisite 또는 relation이어야 합니다.`);
    if (l.type === 'relation' && !l.label) errors.push(`${where}: 관계 연결에는 관계 문장(label)이 있어야 합니다.`);
  }
  return errors;
}
