// 탐색 2D와 만들기 모드가 함께 쓰는 G6 요소와 배경.

// 덧붙인 도형·배지도 요소의 가시성(위계 순서로 드러나기 전)과 흐림 정도를 따르게 한다.
function syncVisibility(element, attributes) {
  for (const [name, shape] of Object.entries(element.shapeMap)) {
    if (name !== 'accent' && name !== 'comet' && !name.startsWith('badge')) continue;
    shape.style.visibility = attributes.visibility ?? 'visible';
    shape.style.opacity = attributes.opacity ?? 1;
  }
}

// 개념 카드: 왼쪽에 색 띠(accent)를 두르고, 선택되면 광환이 숨 쉬듯 커졌다 작아진다.
class ConceptCard extends G6.Rect {
  render(attributes, container) {
    super.render(attributes, container);
    const key = this.shapeMap.key;
    const [width, height] = this.getSize(attributes);
    // UMD 번들은 도형 클래스를 내보내지 않으므로 바탕 사각형의 클래스를 빌려 쓴다.
    this.upsert('accent', key.constructor, {
      x: -width / 2,
      y: -height / 2,
      width: 7,
      height,
      radius: [attributes.radius, 0, 0, attributes.radius],
      fill: attributes.accent,
    }, container);
    const halo = this.shapeMap.halo;
    if (halo && !halo.breathing) {
      halo.breathing = true;
      halo.animate([{ lineWidth: 8, strokeOpacity: 0.7 }, { lineWidth: 26, strokeOpacity: 0.15 }], {
        duration: 1100,
        iterations: Infinity,
        direction: 'alternate',
        easing: 'ease-in-out',
      });
    }
    syncVisibility(this, attributes);
  }
}

// 흐르는 연결: 점선이면 화살표 방향으로 흐르고, 빛나는 점(comet)이 출발 개념에서 도착 개념으로 날아간다.
// style.comet: false면 빛나는 점을 띄우지 않는다. style.cometFill로 점 색을 바꾼다.
class FlowEdge extends G6.Quadratic {
  render(attributes, container) {
    super.render(attributes, container);
    syncVisibility(this, attributes);
  }

  onCreate() {
    const key = this.shapeMap.key;
    key.animate([{ lineDashOffset: 18 }, { lineDashOffset: 0 }], { duration: 700, iterations: Infinity });
    if (this.attributes.comet === false) return;
    const r = 4.5;
    const comet = this.upsert('comet', key.constructor, {
      d: [['M', -r, 0], ['A', r, r, 0, 1, 0, r, 0], ['A', r, r, 0, 1, 0, -r, 0], ['Z']],
      fill: this.attributes.cometFill ?? '#ffb347',
      stroke: '#ffffff',
      lineWidth: 1.5,
      shadowColor: this.attributes.cometFill ?? '#ff8a00',
      shadowBlur: 12,
      offsetPath: key,
      visibility: this.attributes.visibility,
    }, this);
    comet.animate([{ offsetDistance: 0 }, { offsetDistance: 1 }], {
      duration: 2200,
      delay: Math.random() * 1500,
      iterations: Infinity,
      easing: 'ease-in-out',
    });
  }
}

G6.register(G6.ExtensionCategory.NODE, 'concept-card', ConceptCard);
G6.register(G6.ExtensionCategory.EDGE, 'flow-edge', FlowEdge);

// 은은한 빛 번짐 두 개 위에 점 격자를 깐 배경(G6 background 플러그인).
export const BACKDROP = {
  type: 'background',
  background: [
    'radial-gradient(circle at 15% 10%, rgba(255, 214, 160, 0.45), transparent 45%)',
    'radial-gradient(circle at 85% 90%, rgba(170, 160, 255, 0.35), transparent 50%)',
    'radial-gradient(rgba(60, 50, 90, 0.12) 1px, transparent 1px)',
    '#fbfaf6',
  ].join(', '),
  backgroundSize: 'auto, auto, 22px 22px, auto',
};

// 카드 공통 모양. 색 띠·테두리·광환 색은 쓰는 쪽에서 정한다.
export const CARD_STYLE = {
  radius: 12,
  fill: '#ffffff',
  lineWidth: 1.5,
  shadowColor: 'rgba(40, 30, 80, 0.18)',
  shadowBlur: 14,
  shadowOffsetY: 5,
  cursor: 'pointer',
  labelPlacement: 'center',
  labelWordWrap: true,
  labelMaxWidth: 150,
  labelMaxLines: 2,
  labelOffsetX: 4,
  labelFontSize: 13,
  labelFill: '#1f1b2e',
};

export const CARD_HOVER = { shadowBlur: 24, shadowOffsetY: 8, shadowColor: 'rgba(59, 47, 143, 0.35)', lineWidth: 2.5 };

// 어두운 말풍선 모양의 연결 문장
export const DARK_LABEL = {
  labelAutoRotate: false,
  labelFontSize: 12,
  labelFill: '#ffffff',
  labelWordWrap: true,
  labelMaxWidth: 125,
  labelMaxLines: 3,
  labelBackground: true,
  labelBackgroundFill: '#2a2350',
  labelBackgroundOpacity: 0.92,
  labelBackgroundRadius: 8,
  labelPadding: [4, 8],
};
