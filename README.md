# 개념도 학습

중·고등학생이 한 단원의 개념을 이어 개념도로 정리하고, 선생님 개념도와 비교해 놓친 연결을 찾는 정적 웹앱. 서버·로그인·빌드 단계가 없다. 용어는 [GLOSSARY.md](GLOSSARY.md), 주요 결정은 [docs/adr/](docs/adr/)에 있다.

- **탐색 모드**: 선생님 개념도를 2D(위계·영역·선수 학습 화살표)와 3D로 본다.
- **만들기 모드**: 카드 두 개를 차례로 눌러 잇고 관계 문장을 쓴 뒤, [선생님 개념도와 비교]로 달성도와 놓친 연결을 확인한다. 내 개념도는 이 브라우저에만 저장되고, [그림으로 저장]으로 PNG를 받아 제출한다.
- 주소 `#단원id/explore`, `#단원id/make`로 특정 단원을 바로 열 수 있다(예: `#human-rights/make`).

## 로컬에서 열기

`fetch`로 JSON을 읽으므로 파일을 더블클릭하지 말고 정적 서버로 연다.

```bash
python3 -m http.server 8765
```

## 단원 추가

1. `data/`에 단원 JSON을 넣는다. 형식은 `data/state-change.json`을 따른다.
2. `data/units.json` 목록에 파일 이름을 한 줄 더한다.

형식이 틀리면(없는 개념을 가리키는 연결, 관계 문장이 빠진 관계 연결 등) 앱 화면에 고칠 곳이 나온다. 검사는 테스트로도 돌릴 수 있다.

```bash
node --test tests/*.test.mjs
```

## 배포 (Cloudflare)

배포 주소: https://concept-map-demo.gkgk545.workers.dev

Cloudflare 프로젝트 `concept-map-demo`는 Workers 쪽(새 Pages)에 있어 주소가 `pages.dev`가 아니라 `workers.dev`다. 빌드 명령 없이, 커밋된 파일만 뽑아 정적 파일로 올린다(작업 폴더를 그대로 올리면 `.claude/` 같은 커밋하지 않은 파일까지 공개된다).

```bash
rm -rf /tmp/concept-map-deploy && mkdir /tmp/concept-map-deploy
git archive HEAD | tar -x -C /tmp/concept-map-deploy
npx wrangler@4.151.1 deploy --name concept-map-demo --assets /tmp/concept-map-deploy --compatibility-date 2026-10-12
```

처음 한 번은 `npx wrangler@4.151.1 login`으로 Cloudflare 로그인을 승인해야 한다. 올리기 전에 마지막 줄 끝에 `--dry-run`을 붙이면 실제로 배포하지 않고 올릴 파일만 확인할 수 있다.

## 구조

| 파일 | 하는 일 |
| --- | --- |
| `js/model.js` | 단원 검사, 개념 짝 비교, 달성도·연결성 계산(테스트 대상) |
| `js/explore2d.js` | 탐색 2D(G6): 위계 순서로 나타나기, 흐르는 선수 학습 연결 |
| `js/g6-elements.js` | 2D·만들기가 함께 쓰는 개념 카드·흐르는 연결·배경 |
| `js/explore3d.js` | 탐색 3D(3d-force-graph) |
| `js/make.js`, `js/dialog.js` | 만들기 모드와 관계 문장 입력창 |
| `js/panel.js` | 오른쪽 패널: 레이더·달성도 게이지(d3) |
| `js/store.js` | 브라우저 저장(localStorage) |
| `vendor/` | @antv/g6 5.1.1, 3d-force-graph 1.80.1, d3 7.9.0 배포 파일 |
