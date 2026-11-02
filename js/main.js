import { compare, validateUnit } from './model.js';
import { clearWork, loadWork, saveWork } from './store.js';
import { renderPanel } from './panel.js';
import * as explore2d from './explore2d.js';
import * as explore3d from './explore3d.js';
import * as make from './make.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#canvas');
const panel = $('#panel');
const legend = $('#legend');
const unitSelect = $('#unit-select');

const units = new Map(); // id → { unit, errors }
const state = { unitId: null, mode: 'explore', view: '2d', selected: null, work: null };
let view = null;

async function loadUnits() {
  const files = await fetch('data/units.json').then((r) => r.json());
  for (const file of files) {
    try {
      const response = await fetch(`data/${file}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const unit = await response.json();
      units.set(unit.unit?.id ?? file, { unit, errors: validateUnit(unit) });
    } catch (err) {
      units.set(file, { unit: null, errors: [`${file}을(를) 읽지 못했습니다: ${err.message}`] });
    }
  }
  for (const [id, { unit }] of units) {
    unitSelect.append(new Option(unit ? `${unit.unit.school} ${unit.unit.subject} · ${unit.unit.title}` : id, id));
  }
}

// 주소 해시: #단원id/모드 — 선생님이 링크로 특정 단원을 바로 열어 줄 수 있다.
function readHash() {
  const [unitId, mode] = location.hash.slice(1).split('/').map(decodeURIComponent);
  return {
    unitId: units.has(unitId) ? unitId : units.keys().next().value,
    mode: mode === 'make' ? 'make' : 'explore',
  };
}

function go(patch) {
  const next = { ...readHash(), ...patch };
  location.hash = `${encodeURIComponent(next.unitId)}/${next.mode}`;
}

function show() {
  const { unitId, mode } = readHash();
  if (unitId !== state.unitId) {
    state.selected = null;
    state.work = loadWork(unitId);
  }
  state.unitId = unitId;
  state.mode = mode;
  unitSelect.value = unitId;
  document.body.dataset.mode = mode;
  mountView();
}

function mountView() {
  view?.destroy();
  view = null;
  canvas.replaceChildren();
  document.body.dataset.view = state.view;
  const { unit, errors } = units.get(state.unitId);
  if (errors.length) {
    const box = document.createElement('div');
    box.className = 'errors';
    box.innerHTML = '<h2>단원 데이터를 고쳐 주세요</h2>';
    const list = document.createElement('ul');
    for (const e of errors) list.append(Object.assign(document.createElement('li'), { textContent: e }));
    box.append(list);
    canvas.append(box);
    panel.replaceChildren();
    legend.textContent = '';
    return;
  }
  if (state.mode === 'make' && matchMedia('(max-width: 760px)').matches) {
    canvas.append(Object.assign(document.createElement('p'), {
      className: 'narrow-note',
      textContent: '만들기 모드는 노트북·태블릿처럼 큰 화면에서 해 주세요.',
    }));
  } else {
    const mod = state.mode === 'make' ? make : state.view === '3d' ? explore3d : explore2d;
    view = mod.mount(canvas, unit, { work: state.work, onSelect: select, onWorkChange: workChanged });
    view.select(state.selected);
  }
  refresh();
}

function refresh() {
  const { unit } = units.get(state.unitId);
  renderPanel(panel, { unit, mode: state.mode, selectedId: state.selected, work: state.work });
  const compared = state.work.lastCompare && !state.work.lastCompare.stale;
  legend.innerHTML =
    state.mode === 'make'
      ? compared
        ? '<i class="sw matched"></i>맞은 연결 <i class="sw extra"></i>내가 더한 연결 <i class="sw missed"></i>놓친 연결(마우스를 올리면 선생님 문장)'
        : '<i class="sw mine"></i>내 연결 · 카드 두 개를 차례로 눌러 이어요'
      : state.view === '3d'
        ? '<i class="sw prereq"></i>선수 학습 연결 <i class="sw relation"></i>관계 연결 · 공 크기는 중요도 · 끌어서 돌려 보세요'
        : '<i class="sw prereq"></i>선수 학습 연결 <i class="sw relation"></i>관계 연결 · 개념을 누르면 관계 문장이 보여요';
}

function select(id) {
  state.selected = id;
  view?.select(id);
  refresh();
}

function workChanged() {
  saveWork(state.unitId, state.work);
  refresh();
}

unitSelect.addEventListener('change', () => go({ unitId: unitSelect.value }));
for (const button of document.querySelectorAll('button[data-mode]')) {
  button.addEventListener('click', () => go({ mode: button.dataset.mode }));
}
for (const button of document.querySelectorAll('button[data-view]')) {
  button.addEventListener('click', () => {
    state.view = button.dataset.view;
    mountView();
  });
}
$('#btn-compare').addEventListener('click', async () => {
  const { unit } = units.get(state.unitId);
  state.work.lastCompare = { ...compare(unit, state.work.links), stale: false };
  workChanged();
  await view?.redraw();
});
$('#btn-png').addEventListener('click', async () => {
  if (!view?.toDataURL) return;
  const link = document.createElement('a');
  link.href = await view.toDataURL();
  link.download = `${units.get(state.unitId).unit.unit.title} 내 개념도.png`;
  link.click();
});
$('#btn-reset').addEventListener('click', () => {
  if (!confirm('이 단원에서 만든 연결과 비교 결과를 모두 지울까요?')) return;
  state.work = clearWork(state.unitId);
  state.selected = null;
  mountView();
});
window.addEventListener('hashchange', show);

await loadUnits();
show();
