// 탐색 모드 2D 보기: 위계는 줄(위→아래), 영역은 섬, 선수 학습 연결은 흐르는 길.
// 처음 열면 선수 개념부터 위계 순서대로 차례차례 나타나, 단원의 학습 흐름을 보여 준다.
import { pairKey } from './model.js';
import { BACKDROP, CARD_HOVER, CARD_STYLE, DARK_LABEL } from './g6-elements.js';

const CELL_W = 190;
const ROW_H = 150;
const GROUP_GAP = 60;
const REVEAL_STEP_MS = 320;

// 영역마다 차지하는 위계 범위가 겹치는 영역끼리만 옆으로 비켜 놓는다.
export function layout(unit) {
  const placed = []; // { minL, maxL, x0, x1, members }
  const pos = new Map();
  for (const group of unit.groups) {
    const members = unit.concepts.filter((c) => c.group === group.id);
    if (members.length === 0) continue;
    const byLevel = Map.groupBy(members, (c) => c.level);
    const levels = [...byLevel.keys()];
    const minL = Math.min(...levels);
    const maxL = Math.max(...levels);
    const width = Math.max(...[...byLevel.values()].map((row) => row.length)) * CELL_W;
    let x0 = 0;
    for (const p of placed.filter((p) => p.minL <= maxL && minL <= p.maxL).sort((a, b) => a.x0 - b.x0)) {
      if (x0 + width + GROUP_GAP > p.x0 && x0 < p.x1 + GROUP_GAP) x0 = p.x1 + GROUP_GAP;
    }
    placed.push({ minL, maxL, x0, x1: x0 + width, members });
    for (const [level, row] of byLevel) {
      const start = x0 + (width - row.length * CELL_W) / 2 + CELL_W / 2;
      row.forEach((c, i) => pos.set(c.id, { x: start + i * CELL_W, y: level * ROW_H }));
    }
  }
  // 옆에 다른 영역이 없는 영역은 가운데로 옮겨 위계 흐름이 나무처럼 보이게 한다.
  const total = Math.max(...placed.map((p) => p.x1));
  for (const p of placed) {
    if (placed.some((q) => q !== p && q.minL <= p.maxL && p.minL <= q.maxL)) continue;
    const shift = (total - (p.x1 - p.x0)) / 2 - p.x0;
    for (const c of p.members) pos.get(c.id).x += shift;
  }
  return pos;
}

const deep = (color, k = 1.4) => d3.color(color).darker(k).formatHex();

// 같은 줄의 연결은 사이 개념을 뚫고 지나가지 않게 휘게 한다.
export const sameRowCurve = (s, t) => (s.y === t.y ? 24 + Math.abs(t.x - s.x) * 0.12 : 0);

// 탐색 2D와 만들기 2D가 함께 쓰는 개념도 모양: 영역 섬, 영역 색 카드, 중요도에 따른 카드 크기와 '핵심' 배지.
// pos: 개념 id → { x, y }. hidden이면 처음에 숨겨 두었다가 차례로 드러낸다.
export function mapLook(unit, pos, { hidden = false } = {}) {
  const colorOf = new Map(unit.groups.map((g) => [g.id, g.color]));
  const conceptOf = new Map(unit.concepts.map((c) => [c.id, c]));
  const visibility = hidden ? { visibility: 'hidden' } : {};
  return {
    // G6에서는 개념과 영역이 같은 id 공간을 쓴다. 인권 단원처럼 영역 id와 개념 id가 같을 수 있어 접두어를 붙인다.
    nodes: unit.concepts.map((c) => ({
      id: c.id,
      combo: `group:${c.group}`,
      style: { ...pos[c.id], labelText: c.label, ...visibility },
    })),
    combos: unit.groups.map((g) => ({
      id: `group:${g.id}`,
      style: {
        labelText: g.label,
        fill: `linear-gradient(160deg, ${g.color} 0%, #ffffff 100%)`,
        stroke: deep(g.color, 0.6),
        labelBackgroundFill: deep(g.color, 1.6),
        ...visibility,
      },
    })),
    node: {
      type: 'concept-card',
      style: {
        // 중요도가 높을수록 카드가 크고 글씨가 굵다.
        ...CARD_STYLE,
        // G6는 상태를 풀 때 기본 모양에 없는 값은 되돌리지 않는다. 흐림(inactive)이 남지 않게 기본 불투명도를 적어 둔다.
        opacity: 1,
        size: (d) => [128 + conceptOf.get(d.id).importance * 9, 50],
        accent: (d) => deep(colorOf.get(conceptOf.get(d.id).group), 0.4),
        stroke: (d) => colorOf.get(conceptOf.get(d.id).group),
        labelFontWeight: (d) => (conceptOf.get(d.id).importance >= 4 ? 700 : 500),
        // 중요도 5인 개념에는 '핵심' 배지를 단다.
        badges: (d) => (conceptOf.get(d.id).importance === 5 ? [{ text: '핵심', placement: 'right-top' }] : []),
        badgePalette: ['#ff6b3d'],
        badgeFontSize: 10,
        badgePadding: [2, 6],
        haloStroke: (d) => deep(colorOf.get(conceptOf.get(d.id).group), 0.5),
      },
      state: {
        selected: { halo: true, lineWidth: 3, stroke: '#3b2f8f', shadowBlur: 26, shadowColor: 'rgba(59, 47, 143, 0.45)' },
        active: CARD_HOVER,
        inactive: { opacity: 0.18 },
      },
      animation: { show: [{ fields: ['opacity'], duration: 450, easing: 'ease-out' }] },
    },
    combo: {
      type: 'rect',
      style: {
        radius: 22,
        fillOpacity: 0.55,
        lineWidth: 1.5,
        lineDash: [6, 5],
        padding: [26, 18, 18, 18],
        shadowColor: 'rgba(40, 30, 80, 0.08)',
        shadowBlur: 20,
        labelPlacement: 'top',
        labelOffsetY: 14,
        labelFontSize: 12,
        labelFontWeight: 700,
        labelFill: '#ffffff',
        labelBackground: true,
        labelBackgroundRadius: 10,
        labelPadding: [3, 10],
      },
    },
  };
}

export function mount(el, unit, { onSelect }) {
  const pos = layout(unit);
  const colorOf = new Map(unit.groups.map((g) => [g.id, g.color]));
  const groupOf = new Map(unit.concepts.map((c) => [c.id, c.group]));
  const typesByPair = new Map();
  for (const l of unit.links) {
    const key = pairKey(l.source, l.target);
    typesByPair.set(key, (typesByPair.get(key) ?? 0) + 1);
  }
  const edges = unit.links.map((l, i) => {
    const prereq = l.type === 'prerequisite';
    const doubled = typesByPair.get(pairKey(l.source, l.target)) > 1;
    let curveOffset = sameRowCurve(pos.get(l.source), pos.get(l.target));
    if (doubled) curveOffset += prereq ? 26 : -26;
    const tint = deep(colorOf.get(groupOf.get(l.source)), 1.2);
    return {
      id: `e${i}`,
      type: prereq ? 'flow-edge' : 'quadratic',
      source: l.source,
      target: l.target,
      style: prereq
        ? { stroke: '#8b7fd6', lineWidth: 3.5, lineDash: [10, 8], endArrowSize: 11, curveOffset, zIndex: 1, visibility: 'hidden' }
        : { stroke: tint, lineWidth: 1.6, strokeOpacity: 0.75, endArrowSize: 8, curveOffset, labelText: l.label, zIndex: 2, visibility: 'hidden' },
    };
  });

  const look = mapLook(unit, Object.fromEntries(pos), { hidden: true });
  const graph = new G6.Graph({
    container: el,
    autoFit: 'view',
    padding: 40,
    animation: { duration: 350, easing: 'ease-out' },
    data: { nodes: look.nodes, edges, combos: look.combos },
    node: look.node,
    edge: {
      style: {
        endArrow: true,
        label: false,
        opacity: 1, // 흐림(inactive)을 풀 때 되돌아갈 값
        ...DARK_LABEL,
        increasedLineWidthForHitTesting: 14, // 가는 선도 누르기 쉽게
      },
      state: {
        active: { label: true, halo: true, haloStrokeOpacity: 0.18, haloLineWidth: 10, lineWidth: 3, strokeOpacity: 1, zIndex: 5 },
        inactive: { opacity: 0.08 },
      },
    },
    combo: look.combo,
    plugins: [BACKDROP],
    behaviors: ['drag-canvas', 'zoom-canvas'],
  });

  let selected = null;
  let hovered = null; // 마우스가 올라간 개념 또는 연결
  let destroyed = false;
  const revealed = new Set();

  function applyStates() {
    const states = {};
    // 선택한 개념에서 뻗은 문장들이 한곳에 몰리지 않게, 각 문장을 이웃 개념 쪽 끝에 둔다.
    // 같은 줄 이웃들은 서로 가까우니 더 이웃 쪽으로 민다.
    graph.updateEdgeData(edges.filter((e) => e.style.labelText && revealed.has(e.id)).map((e) => {
      const near = pos.get(e.source).y === pos.get(e.target).y ? 0.82 : 0.7;
      return { id: e.id, style: { labelPlacement: e.source === selected ? near : e.target === selected ? 1 - near : 0.5 } };
    }));
    const near = new Set([selected]);
    for (const e of edges) {
      if (!revealed.has(e.id)) continue;
      const touches = selected && (e.source === selected || e.target === selected);
      if (touches) near.add(e.source).add(e.target);
      const s = [];
      // 선수 학습 연결엔 문장이 없으니 라벨 대신 강조만 한다.
      if ((touches || e.id === hovered) && e.style.labelText) s.push('active');
      else if (selected && !touches) s.push('inactive');
      states[e.id] = s;
    }
    for (const c of unit.concepts) {
      if (!revealed.has(c.id)) continue;
      const s = c.id === selected ? ['selected'] : selected && !near.has(c.id) ? ['inactive'] : [];
      if (c.id === hovered && c.id !== selected) s.push('active');
      states[c.id] = s;
    }
    graph.setElementState(states, true);
  }

  // 영역 섬을 띄운 뒤, 위계 0(선수 개념)부터 한 줄씩 카드와 그 줄까지 이어진 연결을 드러낸다.
  async function reveal() {
    await graph.render();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await graph.showElement(unit.groups.map((g) => `group:${g.id}`), true);
    const levels = [...new Set(unit.concepts.map((c) => c.level))].sort((a, b) => a - b);
    for (const level of levels) {
      if (destroyed) return;
      const ids = unit.concepts.filter((c) => c.level === level).map((c) => c.id);
      ids.forEach((id) => revealed.add(id));
      const edgeIds = edges.filter((e) => !revealed.has(e.id) && revealed.has(e.source) && revealed.has(e.target)).map((e) => e.id);
      edgeIds.forEach((id) => revealed.add(id));
      graph.showElement([...ids, ...edgeIds], true);
      await wait(REVEAL_STEP_MS);
    }
    if (!destroyed) applyStates();
  }

  // 이미 선택한 개념을 다시 누르면 선택을 풀어 단원 전체 화면으로 돌아간다.
  graph.on('node:click', (e) => onSelect(e.target.id === selected ? null : e.target.id));
  graph.on('canvas:click', () => onSelect(null));
  for (const type of ['node', 'edge']) {
    graph.on(`${type}:pointerenter`, (e) => { hovered = e.target.id; applyStates(); });
    graph.on(`${type}:pointerleave`, () => { hovered = null; applyStates(); });
  }

  const ready = reveal();
  return {
    select(id) {
      selected = id;
      ready.then(() => destroyed || applyStates());
    },
    destroy() {
      destroyed = true;
      graph.destroy();
    },
  };
}
