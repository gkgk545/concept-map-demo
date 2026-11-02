// 내 개념도는 이 브라우저에만 단원별로 저장한다(docs/adr/0001).
const keyOf = (unitId) => `concept-map:${unitId}`;
const empty = () => ({ links: [], positions: {}, lastCompare: null });

export function loadWork(unitId) {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(keyOf(unitId))) };
  } catch {
    return empty();
  }
}

export function saveWork(unitId, work) {
  try {
    localStorage.setItem(keyOf(unitId), JSON.stringify(work));
  } catch {
    // 사생활 보호 모드 등에서는 저장하지 못한다. 화면에서는 그대로 쓸 수 있다.
  }
}

export function clearWork(unitId) {
  try {
    localStorage.removeItem(keyOf(unitId));
  } catch {}
  return empty();
}
