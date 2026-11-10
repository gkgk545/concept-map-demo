// 만들기 모드 3D 보기. 탐색 3D와 같은 공(영역 색·중요도 크기)과 이름표 위에 내 연결만 그린다.
// 공 두 개를 차례로 눌러 연결하고, 연결을 누르면 고치거나 지운다.
// 선생님 연결로 공을 배치하면 정답 짝이 가까이 모여 드러나므로, 위계(위→아래)와 탐색 2D의 가로 자리,
// 그리고 내 연결만으로 공을 놓는다.
import { layout } from './explore2d.js';
import { create3d } from './explore3d.js';
import { COLOR, editLink, linkViews } from './make.js';

const PENDING = '#3b2f8f';
const escapeHTML = (text) => text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

export function mount(el, unit, { work, onSelect, onWorkChange }) {
  // 탐색 2D 배치(가로 190px 칸, 세로 150px 줄)를 3D 공간 크기로 줄여 공이 돌아가려는 자리로 쓴다.
  const base = layout(unit);
  const xs = [...base.values()].map((p) => p.x);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const nodes = unit.concepts.map((c) => {
    const homeX = (base.get(c.id).x - midX) * 0.4;
    const homeY = -c.level * 70;
    return { ...c, homeX, homeY, x: homeX, y: homeY };
  });

  let pending = null;
  // 3D 화면을 그림으로 저장하려면 그린 화면을 지우지 않고 남겨 둬야 한다.
  const { graph, colors, labels, destroy } = create3d(el, unit, nodes, { preserveDrawingBuffer: true });

  const links = () => linkViews(unit, work).map((v) => ({ ...v }));
  const colorNodes = () => graph.nodeColor((n) => (n.id === pending ? PENDING : colors.get(n.group)));

  function setPending(id) {
    pending = id;
    for (const [nid, span] of labels) span.classList.toggle('pending', nid === id);
    colorNodes();
  }

  async function edit(a, b) {
    if (!(await editLink(unit, work, a, b))) return;
    onWorkChange();
    redraw();
  }

  function redraw() {
    graph.graphData({ nodes, links: links() });
  }

  // 내 연결이 공을 너무 끌어당기면 이을 때마다 자리가 크게 바뀌므로 약하게 둔다.
  graph.d3Force('link').strength(0.05);
  graph
    .d3Force('x', d3.forceX((n) => n.homeX).strength(0.12))
    .d3Force('y', d3.forceY((n) => n.homeY).strength(0.35))
    // 가로세로를 붙잡으면 공끼리 밀어내는 힘이 앞뒤로만 쏠려 화면이 멀어지므로, 앞뒤 깊이도 살짝 붙잡는다.
    .d3Force('z', (alpha) => nodes.forEach((n) => (n.vz -= (n.z ?? 0) * 0.08 * alpha)))
    .graphData({ nodes, links: links() })
    .linkColor((l) => COLOR[l.kind])
    .linkWidth((l) => (l.kind === 'missed' ? 0.6 : 1.6))
    .linkOpacity(0.8)
    .linkLabel((l) => `<div class="link-tip">${escapeHTML(l.text)}</div>`)
    .linkDirectionalArrowLength((l) => (l.kind === 'missed' ? 0 : 6))
    .linkDirectionalArrowRelPos(1)
    .linkDirectionalParticles((l) => (l.kind === 'mine' || l.kind === 'matched' ? 3 : 0))
    .linkDirectionalParticleWidth(2.2)
    .linkDirectionalParticleColor((l) => (l.kind === 'matched' ? '#ffd166' : '#a5b4fc'))
    // 고른 공을 다시 누르면 고르기를 풀고 단원 전체 화면으로 돌아간다.
    .onNodeClick((n) => {
      if (pending === n.id) {
        setPending(null);
        return onSelect(null);
      }
      onSelect(n.id);
      if (!pending) return setPending(n.id);
      const first = pending;
      setPending(null);
      edit(first, n.id);
    })
    .onLinkClick((l) => l.id.startsWith('my:') && edit(l.source.id, l.target.id))
    .onBackgroundClick(() => {
      setPending(null);
      onSelect(null);
    });

  // 3D 화면 위에 개념 이름을 직접 그려 넣어 저장한다(화면의 이름표는 HTML이라 그림에 담기지 않는다).
  function toDataURL() {
    const src = graph.renderer().domElement;
    const scale = src.width / el.clientWidth;
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.scale(scale, scale);
    ctx.font = '12px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#f4f1ea';
    ctx.fillStyle = '#222222';
    for (const n of nodes) {
      const { x, y } = graph.graph2ScreenCoords(n.x, n.y, n.z);
      ctx.strokeText(n.label, x, y + 8);
      ctx.fillText(n.label, x, y + 8);
    }
    return canvas.toDataURL('image/png');
  }

  return {
    redraw,
    select(id) {
      for (const [nid, span] of labels) span.classList.toggle('selected', nid === id);
    },
    toDataURL,
    destroy,
  };
}
