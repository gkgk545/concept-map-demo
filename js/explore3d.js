// 탐색 모드 3D 보기. 개념 이름은 HTML 글자를 3D 좌표에 맞춰 매 프레임 옮겨 늘 보이게 한다.
import { pairKey } from './model.js';

export function mount(el, unit, { onSelect }) {
  const colors = new Map(unit.groups.map((g) => [g.id, g.color]));
  const pairCount = new Map();
  for (const l of unit.links) {
    const key = pairKey(l.source, l.target);
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
  }
  const nodes = unit.concepts.map((c) => ({ ...c }));
  const links = unit.links.map((l) => ({ ...l, doubled: pairCount.get(pairKey(l.source, l.target)) > 1 }));
  const prereq = (l) => l.type === 'prerequisite';

  const graphEl = document.createElement('div');
  const labelLayer = document.createElement('div');
  labelLayer.className = 'labels3d';
  el.append(graphEl, labelLayer);
  const labels = new Map(
    nodes.map((n) => {
      const span = document.createElement('span');
      span.textContent = n.label;
      labelLayer.append(span);
      return [n.id, span];
    }),
  );

  const graph = new ForceGraph3D(graphEl)
    .width(el.clientWidth)
    .height(el.clientHeight)
    .backgroundColor('#f4f1ea')
    .showNavInfo(false)
    .graphData({ nodes, links })
    .nodeLabel(() => '')
    .nodeColor((n) => colors.get(n.group))
    .nodeVal((n) => n.importance * 2)
    .nodeOpacity(0.95)
    .linkColor((l) => (prereq(l) ? '#6e6a64' : '#4f73c9'))
    .linkWidth((l) => (prereq(l) ? 1.6 : 0.5))
    .linkOpacity(0.6)
    .linkCurvature((l) => (l.doubled && !prereq(l) ? 0.3 : 0))
    .linkDirectionalArrowLength((l) => (prereq(l) ? 6 : 0))
    .linkDirectionalArrowRelPos(1)
    .linkDirectionalParticles((l) => (prereq(l) ? 3 : 0))
    .linkDirectionalParticleWidth(2)
    .onNodeClick((n) => onSelect(n.id))
    .onBackgroundClick(() => onSelect(null))
    .cooldownTime(3000);
  let fitted = false;
  graph.onEngineStop(() => fitted || ((fitted = true), graph.zoomToFit(600, 40)));

  let frame;
  (function moveLabels() {
    for (const n of nodes) {
      if (n.x === undefined) continue;
      const { x, y } = graph.graph2ScreenCoords(n.x, n.y, n.z);
      labels.get(n.id).style.transform = `translate(${x}px, ${y}px) translate(-50%, 8px)`;
    }
    frame = requestAnimationFrame(moveLabels);
  })();

  const resize = new ResizeObserver(() => graph.width(el.clientWidth).height(el.clientHeight));
  resize.observe(el);

  return {
    select(id) {
      for (const [nid, span] of labels) span.classList.toggle('selected', nid === id);
    },
    destroy() {
      cancelAnimationFrame(frame);
      resize.disconnect();
      graph._destructor();
      el.replaceChildren();
    },
  };
}
