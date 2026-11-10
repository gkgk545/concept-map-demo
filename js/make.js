// 만들기 모드 2D 보기: 탐색 2D와 같은 개념도(위계 줄·영역 섬·영역 색 카드) 위에 내 연결만 그린다.
// 카드 두 개를 차례로 눌러 연결하고 관계 문장을 쓴다. 3D 보기(make3d.js)와 연결 다루는 함수를 함께 쓴다.
import { pairKey, teacherPairs, teacherSentence } from './model.js';
import { openLinkDialog } from './dialog.js';
import { BACKDROP } from './g6-elements.js';
import { layout, mapLook, sameRowCurve } from './explore2d.js';

export const COLOR = { mine: '#5b5fc7', matched: '#2e9d5b', extra: '#9a9690', missed: '#e07b39' };
const isMiss = (edge) => edge.id.startsWith('miss:');

// 저장된 카드 자리가 탐색 2D 배치를 따른 것인지 표시한다. 그 전(1)에는 섞은 격자였다.
const LAYOUT_VERSION = 2;

// 카드 자리는 탐색 2D와 같은 배치에서 시작하고, 학생이 옮긴 자리는 저장해 둔다.
function preparePositions(unit, work) {
  if (work.layoutVersion !== LAYOUT_VERSION) {
    work.positions = {};
    work.layoutVersion = LAYOUT_VERSION;
  }
  const base = layout(unit);
  for (const c of unit.concepts) work.positions[c.id] ??= base.get(c.id);
}

// 그릴 연결 목록. 비교 전에는 내 연결만, 비교 뒤에는 맞은·내가 더한·놓친 연결로 나눈다.
export function linkViews(unit, work) {
  const result = work.lastCompare && !work.lastCompare.stale ? work.lastCompare : null;
  const matched = new Set(result?.matched);
  const views = work.links.map((l) => {
    const key = pairKey(l.source, l.target);
    const kind = !result ? 'mine' : matched.has(key) ? 'matched' : 'extra';
    return { id: `my:${key}`, kind, source: l.source, target: l.target, text: l.text };
  });
  const pairs = teacherPairs(unit);
  for (const key of result?.missed ?? []) {
    const [source, target] = key.split('|');
    views.push({ id: `miss:${key}`, kind: 'missed', source, target, text: `선생님: ${teacherSentence(pairs.get(key))}` });
  }
  return views;
}

// 두 개념 사이의 연결을 새로 만들거나 고치거나 지운다. 바뀌었으면 true.
export async function editLink(unit, work, a, b) {
  const labelOf = new Map(unit.concepts.map((c) => [c.id, c.label]));
  const key = pairKey(a, b);
  const existing = work.links.find((l) => pairKey(l.source, l.target) === key);
  const answer = await openLinkDialog({
    from: labelOf.get(existing?.source ?? a),
    to: labelOf.get(existing?.target ?? b),
    text: existing?.text ?? '',
    canDelete: Boolean(existing),
  });
  if (!answer) return false;
  if (answer.action === 'delete') work.links = work.links.filter((l) => l !== existing);
  else if (existing) existing.text = answer.text;
  else work.links.push({ source: a, target: b, text: answer.text });
  if (work.lastCompare) work.lastCompare.stale = true;
  return true;
}

// 배경 무늬는 캔버스 밖(DOM)에 있어 그림에 담기지 않으므로, 흰 바탕 위에 개념도를 얹어 저장한다.
async function toPNG(graph) {
  const image = new Image();
  image.src = await graph.toDataURL({ mode: 'overall' });
  await image.decode();
  const margin = 32;
  const canvas = document.createElement('canvas');
  canvas.width = image.width + margin * 2;
  canvas.height = image.height + margin * 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, margin, margin);
  return canvas.toDataURL('image/png');
}

export function mount(el, unit, { work, onSelect, onWorkChange }) {
  preparePositions(unit, work);
  const look = mapLook(unit, work.positions);

  function graphData() {
    // 내 연결엔 빛나는 점이 흐르고, 비교 뒤 맞은 연결은 금빛 점, 내가 더한 연결은 점 없이 회색으로 그린다.
    // 관계 문장이 카드에 가리지 않게 내 연결은 카드 위(zIndex)에 그린다.
    const edges = linkViews(unit, work).map((v) => {
      const curveOffset = sameRowCurve(work.positions[v.source], work.positions[v.target]);
      if (v.kind === 'missed') {
        return {
          id: v.id,
          type: 'flow-edge',
          source: v.source,
          target: v.target,
          style: { stroke: COLOR.missed, lineDash: [10, 8], comet: false, label: false, labelText: v.text, curveOffset },
        };
      }
      return {
        id: v.id,
        type: v.kind === 'extra' ? 'quadratic' : 'flow-edge',
        source: v.source,
        target: v.target,
        style: {
          stroke: COLOR[v.kind],
          labelText: v.text,
          labelFill: d3.color(COLOR[v.kind]).darker(1.5).formatHex(),
          cometFill: v.kind === 'matched' ? '#ffd166' : '#a5b4fc',
          curveOffset,
          zIndex: 10,
        },
      };
    });
    const nodes = look.nodes.map((n) => ({ ...n, style: { ...n.style, ...work.positions[n.id] } }));
    return { nodes, edges, combos: look.combos };
  }

  const graph = new G6.Graph({
    container: el,
    autoFit: 'view',
    padding: 40,
    animation: { duration: 350, easing: 'ease-out' },
    data: graphData(),
    node: look.node,
    combo: look.combo,
    edge: {
      style: {
        lineWidth: 2.2,
        // 이 설정이 데이터의 style보다 우선하므로, 놓친 연결의 화살표는 여기서 끈다.
        endArrow: (d) => !isMiss(d),
        labelAutoRotate: false,
        increasedLineWidthForHitTesting: 14, // 가는 선도 누르기 쉽게
        // 이 설정이 데이터의 style보다 우선하므로, 말풍선 모양은 여기서 나눈다.
        // 내 문장은 흰 말풍선, 놓친 연결의 선생님 문장은 어두운 말풍선
        labelFill: (d) => (isMiss(d) ? '#ffffff' : d.style.labelFill),
        labelFontSize: 12,
        labelFontWeight: (d) => (isMiss(d) ? 400 : 600),
        labelWordWrap: true,
        labelMaxWidth: 150,
        labelMaxLines: 3,
        labelBackground: true,
        labelBackgroundFill: (d) => (isMiss(d) ? '#2a2350' : '#ffffff'),
        labelBackgroundStroke: (d) => (isMiss(d) ? '#2a2350' : '#d8d3ea'),
        labelBackgroundRadius: 8,
        labelBackgroundOpacity: 0.95,
        labelPadding: [4, 8],
        cursor: 'pointer',
      },
      state: { active: { label: true, halo: true, haloStrokeOpacity: 0.2, haloLineWidth: 10, zIndex: 12 } },
    },
    plugins: [BACKDROP],
    // 카드를 다른 영역 섬에 떨어뜨려도 영역은 바뀌지 않는다(dropEffect: none).
    behaviors: ['drag-canvas', 'zoom-canvas', { type: 'drag-element', dropEffect: 'none' }],
  });

  let pending = null;
  let hovered = null;

  async function redraw() {
    graph.setData(graphData());
    await graph.draw();
  }

  // 고른 카드(pending)는 광환, 마우스가 올라간 카드는 떠오름
  function cardStates(id) {
    return [...(id === pending ? ['selected'] : []), ...(id === hovered ? ['active'] : [])];
  }

  function setPending(id) {
    const before = pending;
    pending = id;
    const states = {};
    for (const n of [before, id]) if (n) states[n] = cardStates(n);
    graph.setElementState(states, true);
  }

  async function edit(a, b) {
    if (!(await editLink(unit, work, a, b))) return;
    onWorkChange();
    redraw();
  }

  // 고른 카드를 다시 누르면 고르기를 풀고 단원 전체 화면으로 돌아간다.
  graph.on('node:click', async (e) => {
    const id = e.target.id;
    if (pending === id) {
      setPending(null);
      return onSelect(null);
    }
    onSelect(id);
    if (!pending) return setPending(id);
    const first = pending;
    setPending(null);
    await edit(first, id);
  });
  graph.on('edge:click', (e) => {
    const id = e.target.id;
    if (id.startsWith('my:')) edit(...id.slice(3).split('|'));
  });
  graph.on('node:pointerenter', (e) => { hovered = e.target.id; graph.setElementState(hovered, cardStates(hovered), true); });
  graph.on('node:pointerleave', (e) => { hovered = null; graph.setElementState(e.target.id, cardStates(e.target.id), true); });
  graph.on('edge:pointerenter', (e) => isMiss(e.target) && graph.setElementState(e.target.id, 'active'));
  graph.on('edge:pointerleave', (e) => isMiss(e.target) && graph.setElementState(e.target.id, []));
  graph.on('canvas:click', () => {
    setPending(null);
    onSelect(null);
  });
  // 카드 하나든 영역 섬 통째로든, 옮긴 뒤의 자리를 저장한다.
  const savePositions = () => {
    for (const n of graph.getNodeData()) work.positions[n.id] = { x: n.style.x, y: n.style.y };
    onWorkChange();
  };
  graph.on('node:dragend', savePositions);
  graph.on('combo:dragend', savePositions);

  graph.render();
  return {
    redraw,
    select() {},
    toDataURL: () => toPNG(graph),
    destroy: () => graph.destroy(),
  };
}
