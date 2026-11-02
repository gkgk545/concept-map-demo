// 오른쪽 패널: 개념 정보, 레이더(중요도·난이도·연결성), 달성도 게이지. d3로 그린다.
import { connectivity, conceptProgress, pairKey, teacherPairs, teacherSentence } from './model.js';

export function renderPanel(el, { unit, mode, selectedId, work }) {
  el.replaceChildren();
  const root = d3.select(el);
  const concept = unit.concepts.find((c) => c.id === selectedId);
  if (concept) renderConcept(root, unit, concept, mode, work);
  else renderUnit(root, unit, mode, work);
}

function renderUnit(root, unit, mode, work) {
  root.append('h2').text(unit.unit.title);
  root.append('p').attr('class', 'muted').text(`${unit.unit.school} ${unit.unit.subject}`);
  if (mode === 'make') {
    root.append('p').attr('class', 'hint')
      .text('카드 두 개를 차례로 누르면 연결하고 관계 문장을 써요. 연결을 누르면 고치거나 지울 수 있어요.');
  }
  renderGauge(root, mode, work);

  const result = work.lastCompare;
  if (mode === 'make' && result && !result.stale) {
    const pairs = teacherPairs(unit);
    const labelOf = new Map(unit.concepts.map((c) => [c.id, c.label]));
    const pairName = (key) => key.split('|').map((id) => labelOf.get(id)).join(' — ');
    const myText = new Map(work.links.map((l) => [pairKey(l.source, l.target), l.text]));

    section(root, `맞은 연결 ${result.matched.length}`, result.matched, (li, key) => {
      li.append('strong').text(pairName(key));
      li.append('div').text(`나: ${myText.get(key)}`);
      li.append('div').attr('class', 'muted').text(`선생님: ${teacherSentence(pairs.get(key))}`);
    });
    section(root, `놓친 연결 ${result.missed.length}`, result.missed, (li, key) => {
      li.append('strong').text(pairName(key));
      li.append('div').attr('class', 'muted').text(`선생님: ${teacherSentence(pairs.get(key))}`);
    });
    section(root, `내가 더한 연결 ${result.extra.length}`, result.extra, (li, key) => {
      li.append('strong').text(pairName(key));
      li.append('div').text(`나: ${myText.get(key)}`);
    });
  }

  section(root, '성취기준', unit.unit.standards, (li, s) => {
    li.append('strong').text(s.code);
    li.append('div').text(s.text);
  });
}

function renderConcept(root, unit, concept, mode, work) {
  const group = unit.groups.find((g) => g.id === concept.group);
  root.append('h2').text(concept.label);
  root.append('span').attr('class', 'chip').style('background', group.color).text(group.label);
  root.append('p').text(concept.summary);

  drawRadar(root, [
    { axis: '중요도', value: concept.importance },
    { axis: '난이도', value: concept.difficulty },
    { axis: '연결성', value: connectivity(unit).get(concept.id) },
  ], group.color);

  const standards = unit.unit.standards.filter((s) => concept.standards?.includes(s.code));
  section(root, '성취기준', standards, (li, s) => {
    li.append('strong').text(s.code);
    li.append('div').text(s.text);
  });

  const labelOf = new Map(unit.concepts.map((c) => [c.id, c.label]));
  const touches = (l) => l.source === concept.id || l.target === concept.id;
  if (mode === 'explore') {
    const before = unit.links.filter((l) => l.type === 'prerequisite' && l.target === concept.id);
    const after = unit.links.filter((l) => l.type === 'prerequisite' && l.source === concept.id);
    if (before.length) root.append('p').text(`먼저 배울 개념: ${before.map((l) => labelOf.get(l.source)).join(', ')}`);
    if (after.length) root.append('p').text(`이어서 배울 개념: ${after.map((l) => labelOf.get(l.target)).join(', ')}`);
    section(root, '관계 문장', unit.links.filter((l) => l.type === 'relation' && touches(l)), (li, l) => li.text(l.label));
  } else {
    section(root, '내가 쓴 관계 문장', work.links.filter(touches), (li, l) => li.text(l.text));
  }

  renderGauge(root, mode, work);
  if (work.lastCompare) {
    const { done, total } = conceptProgress(unit, work.lastCompare.matched, concept.id);
    const row = root.append('div').attr('class', 'progress');
    row.append('span').text(`이 개념의 연결 ${done} / ${total}`);
    row.append('div').attr('class', 'bar').append('div').style('width', `${total ? (100 * done) / total : 0}%`);
  }
}

function section(root, title, items, fill) {
  if (items.length === 0) return;
  const s = root.append('section');
  s.append('h3').text(title);
  s.append('ul').selectAll('li').data(items).join('li').each(function (d) {
    fill(d3.select(this), d);
  });
}

function renderGauge(root, mode, work) {
  const s = root.append('section');
  s.append('h3').text('달성도');
  const result = work.lastCompare;
  if (!result) {
    s.append('p').attr('class', 'muted').text(mode === 'make'
      ? '[선생님 개념도와 비교]를 누르면 달성도가 나타나요.'
      : '만들기 모드에서 비교하면 달성도가 나타나요.');
    return;
  }
  const done = result.matched.length;
  const ratio = result.total ? done / result.total : 0;
  const svg = s.append('svg').attr('viewBox', '0 0 220 128').attr('class', 'gauge');
  const arc = d3.arc().innerRadius(72).outerRadius(92).startAngle(-Math.PI / 2).cornerRadius(3);
  const g = svg.append('g').attr('transform', 'translate(110,110)');
  g.append('path').attr('class', 'gauge-track').attr('d', arc({ endAngle: Math.PI / 2 }));
  g.append('path').attr('class', 'gauge-value').attr('d', arc({ endAngle: -Math.PI / 2 + Math.PI * ratio }));
  g.append('text').attr('class', 'gauge-percent').attr('y', -14).text(`${Math.round(ratio * 100)}%`);
  g.append('text').attr('class', 'gauge-sub').attr('y', 8).text(`${done} / ${result.total} 개념 짝`);
  if (result.stale) s.append('p').attr('class', 'stale').text('비교 후 수정함 · 다시 비교해 보세요');
}

function drawRadar(root, values, color) {
  const size = 240;
  const radius = 72;
  const center = size / 2;
  const scale = d3.scaleLinear([0, 5], [0, radius]);
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / values.length;
  const point = (i, v) => [center + scale(v) * Math.cos(angle(i)), center + 6 + scale(v) * Math.sin(angle(i))];
  const polygon = (fn) => values.map((d, i) => point(i, fn(d)).join(',')).join(' ');

  const svg = root.append('svg').attr('viewBox', `0 0 ${size} ${size}`).attr('class', 'radar');
  for (let level = 1; level <= 5; level++) svg.append('polygon').attr('class', 'radar-grid').attr('points', polygon(() => level));
  values.forEach((d, i) => {
    const [x, y] = point(i, 5);
    svg.append('line').attr('class', 'radar-axis').attr('x1', center).attr('y1', center + 6).attr('x2', x).attr('y2', y);
    const [lx, ly] = point(i, 6.4);
    svg.append('text').attr('class', 'radar-label').attr('x', lx).attr('y', ly).text(`${d.axis} ${d.value}`);
  });
  svg.append('polygon').attr('points', polygon((d) => d.value))
    .attr('fill', color).attr('fill-opacity', 0.55).attr('stroke', d3.color(color).darker(1.2)).attr('stroke-width', 2);
}
