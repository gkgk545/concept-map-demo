// 만들기 모드: 카드 두 개를 차례로 눌러 연결하고 관계 문장을 쓴다.
import { pairKey, teacherPairs, teacherSentence } from './model.js';
import { openLinkDialog } from './dialog.js';
import { BACKDROP, CARD_HOVER, CARD_STYLE } from './g6-elements.js';

// 카드에는 영역 색을 쓰지 않는다(정답 구조가 드러나므로). 모두 같은 남색 띠를 두른다.
const INK = '#5b5fc7';
const isMiss = (edge) => edge.id.startsWith('miss:');
const COLOR = { mine: INK, matched: '#2e9d5b', extra: '#9a9690', missed: '#e07b39' };

// 위계·영역 순서가 드러나지 않게 섞되, 단원마다 늘 같은 순서가 나오게 한다.
function shuffled(items, seedText) {
  let seed = [...seedText].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 격자 칸(240×150)이 캔버스 가로세로 비율에 맞게 열 수를 정한다.
function gridPositions(unit, width, height) {
  const ratio = (width / height) * (150 / 240);
  const cols = Math.max(3, Math.round(Math.sqrt(unit.concepts.length * ratio)));
  const pos = {};
  shuffled(unit.concepts, unit.unit.id).forEach((c, i) => {
    pos[c.id] = { x: (i % cols) * 240, y: Math.floor(i / cols) * 150 };
  });
  return pos;
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
  const labelOf = new Map(unit.concepts.map((c) => [c.id, c.label]));
  const pairs = teacherPairs(unit);
  if (Object.keys(work.positions).length === 0) work.positions = gridPositions(unit, el.clientWidth, el.clientHeight);

  function graphData() {
    const result = work.lastCompare && !work.lastCompare.stale ? work.lastCompare : null;
    const matched = new Set(result?.matched);
    // 내 연결엔 빛나는 점이 흐르고, 비교 뒤 맞은 연결은 금빛 점, 내가 더한 연결은 점 없이 회색으로 그린다.
    // 관계 문장이 카드에 가리지 않게 내 연결은 카드 위(zIndex)에 그린다.
    const edges = work.links.map((l) => {
      const key = pairKey(l.source, l.target);
      const kind = !result ? 'mine' : matched.has(key) ? 'matched' : 'extra';
      return {
        id: `my:${key}`,
        type: kind === 'extra' ? 'quadratic' : 'flow-edge',
        source: l.source,
        target: l.target,
        style: {
          stroke: COLOR[kind],
          labelText: l.text,
          labelFill: d3.color(COLOR[kind]).darker(1.5).formatHex(),
          cometFill: kind === 'matched' ? '#ffd166' : '#a5b4fc',
          zIndex: 10,
        },
      };
    });
    for (const key of result?.missed ?? []) {
      const [source, target] = key.split('|');
      edges.push({
        id: `miss:${key}`,
        type: 'flow-edge',
        source,
        target,
        style: {
          stroke: COLOR.missed,
          lineDash: [10, 8],
          comet: false,
          label: false,
          labelText: `선생님: ${teacherSentence(pairs.get(key))}`,
        },
      });
    }
    return {
      nodes: unit.concepts.map((c) => ({ id: c.id, style: { ...work.positions[c.id], labelText: c.label } })),
      edges,
    };
  }

  const graph = new G6.Graph({
    container: el,
    autoFit: 'view',
    padding: 40,
    animation: { duration: 350, easing: 'ease-out' },
    data: graphData(),
    node: {
      type: 'concept-card',
      style: { ...CARD_STYLE, size: [158, 50], accent: INK, stroke: '#d8d3ea', haloStroke: INK },
      state: {
        selected: { halo: true, lineWidth: 3, stroke: '#3b2f8f', fill: '#f3f2ff', shadowBlur: 26, shadowColor: 'rgba(59, 47, 143, 0.45)' },
        active: CARD_HOVER,
      },
    },
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
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
  });

  let pending = null;

  async function redraw() {
    graph.setData(graphData());
    await graph.draw();
  }

  let hovered = null;

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

  function changed() {
    if (work.lastCompare) work.lastCompare.stale = true;
    onWorkChange();
    redraw();
  }

  async function editLink(a, b) {
    const key = pairKey(a, b);
    const existing = work.links.find((l) => pairKey(l.source, l.target) === key);
    const answer = await openLinkDialog({
      from: labelOf.get(existing?.source ?? a),
      to: labelOf.get(existing?.target ?? b),
      text: existing?.text ?? '',
      canDelete: Boolean(existing),
    });
    if (!answer) return;
    if (answer.action === 'delete') work.links = work.links.filter((l) => l !== existing);
    else if (existing) existing.text = answer.text;
    else work.links.push({ source: a, target: b, text: answer.text });
    changed();
  }

  graph.on('node:click', async (e) => {
    const id = e.target.id;
    onSelect(id);
    if (!pending || pending === id) return setPending(pending === id ? null : id);
    const first = pending;
    setPending(null);
    await editLink(first, id);
  });
  graph.on('edge:click', (e) => {
    const id = e.target.id;
    if (id.startsWith('my:')) editLink(...id.slice(3).split('|'));
  });
  graph.on('node:pointerenter', (e) => { hovered = e.target.id; graph.setElementState(hovered, cardStates(hovered), true); });
  graph.on('node:pointerleave', (e) => { hovered = null; graph.setElementState(e.target.id, cardStates(e.target.id), true); });
  graph.on('edge:pointerenter', (e) => e.target.id.startsWith('miss:') && graph.setElementState(e.target.id, 'active'));
  graph.on('edge:pointerleave', (e) => e.target.id.startsWith('miss:') && graph.setElementState(e.target.id, []));
  graph.on('canvas:click', () => {
    setPending(null);
    onSelect(null);
  });
  graph.on('node:dragend', () => {
    for (const n of graph.getNodeData()) work.positions[n.id] = { x: n.style.x, y: n.style.y };
    onWorkChange();
  });

  graph.render();
  return {
    redraw,
    select() {},
    toDataURL: () => toPNG(graph),
    destroy: () => graph.destroy(),
  };
}
