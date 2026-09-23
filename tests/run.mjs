// sudoku.html 인라인 스크립트를 Node vm 에서 실행하는 무의존성 테스트 러너.
// 브라우저가 없는 환경에서도 TestRunner(로고×3 테스트)와 통합 테스트를 실제로 돌리기 위함.
// DOM 은 이 게임이 쓰는 API 만 최소한으로 흉내 낸다 (완전한 DOM 구현이 목적이 아님).
// 실행: node tests/run.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC  = fs.readFileSync(path.join(ROOT, 'sudoku.html'), 'utf8');

/* ── 최소 DOM ─────────────────────────────────────── */
class FakeClassList {
  constructor() { this.set = new Set(); }
  add(...cs)    { cs.forEach(c => this.set.add(c)); }
  remove(...cs) { cs.forEach(c => this.set.delete(c)); }
  contains(c)   { return this.set.has(c); }
  toggle(c, force) {
    const on = force === undefined ? !this.set.has(c) : !!force;
    if (on) this.set.add(c); else this.set.delete(c);
    return on;
  }
}

class FakeElement {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.id = attrs.id || '';
    this.classList = new FakeClassList();
    if (attrs.class) this.className = attrs.class;
    this.dataset = {};
    for (const [k, v] of Object.entries(attrs))
      if (k.startsWith('data-')) this.dataset[k.slice(5)] = v;
    this.style = { setProperty(k, v) { this[k] = v; } };
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this._text = '';
    this._html = '';
    this.value = ''; this.checked = false; this.files = []; this.onclick = null;
  }
  get className()  { return [...this.classList.set].join(' '); }
  set className(v) { this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set textContent(v) { this.children = []; this._text = String(v); }
  get innerHTML()  { return this._html; }
  set innerHTML(v) { this.children = []; this._text = ''; this._html = String(v); }
  appendChild(el)  { el.parentNode = this; this.children.push(el); return el; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatch(type, ev = {}) {
    // 이벤트 위임(closest)이 동작하도록 부모로 버블링
    ev.target ||= this; ev.preventDefault ||= () => {};
    for (let el = this; el; el = el.parentNode) (el.listeners[type] || []).forEach(fn => fn(ev));
  }
  click() { this.dispatch('click'); }
  matches(sel) { return simpleMatch(this, sel); }
  closest(sel) { for (let el = this; el; el = el.parentNode) if (el.matches && el.matches(sel)) return el; return null; }
  *descendants() { for (const c of this.children) { yield c; yield* c.descendants(); } }
  querySelectorAll(sel) {
    // 후손 선택자 'A B' 지원: 마지막 조각과 일치하는 요소의 조상이 앞 조각들과 순서대로 일치해야 함
    const parts = sel.trim().split(/\s+/);
    return [...this.descendants()].filter(el => {
      if (!simpleMatch(el, parts[parts.length - 1])) return false;
      let i = parts.length - 2;
      for (let a = el.parentNode; a && i >= 0; a = a.parentNode) if (simpleMatch(a, parts[i])) i--;
      return i < 0;
    });
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function simpleMatch(el, sel) {
  const re = /(#[\w-]+)|(\.[\w-]+)|\[([\w-]+)="([^"]*)"\]|^(\w+)/g;
  let m, any = false;
  while ((m = re.exec(sel))) {
    any = true;
    if (m[1] && el.id !== m[1].slice(1)) return false;
    if (m[2] && !el.classList.contains(m[2].slice(1))) return false;
    if (m[3] && String(el.dataset[m[3].replace(/^data-/, '')]) !== m[4]) return false;
    if (m[5] && el.tagName !== m[5].toUpperCase()) return false;
  }
  return any;
}

/* body 마크업(스크립트 이전)을 태그 스택으로 파싱해 트리 구성 */
function buildBody(html) {
  const body = new FakeElement('body');
  const VOID = new Set(['input', 'br', 'img', 'meta', 'hr']);
  const stack = [body];
  const tagRe = /<(\/?)(\w+)([^>]*?)(\/?)>/g;
  let m;
  while ((m = tagRe.exec(html))) {
    const [, close, tag, attrStr] = m;
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    const attrs = {};
    attrStr.replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => { attrs[k] = v; });
    const el = stack[stack.length - 1].appendChild(new FakeElement(tag, attrs));
    if (!VOID.has(tag.toLowerCase()) && !m[4]) stack.push(el);
  }
  return body;
}

/* ── 가짜 타이머 (setTimeout / setInterval / rAF 를 수동으로 진행) ── */
function makeClock() {
  let now = 0, seq = 0;
  const q = new Map();
  const add = (fn, ms, every) => { const id = ++seq; q.set(id, { fn, at: now + (ms || 0), every }); return id; };
  const clear = id => q.delete(id);
  function runUntil(limit) {
    for (let guard = 0; guard < 1e6; guard++) {
      let nextId = null, next = null;
      for (const [id, t] of q) if (t.at <= limit && (!next || t.at < next.at || (t.at === next.at && id < nextId))) { next = t; nextId = id; }
      if (!next) break;
      now = Math.max(now, next.at);
      if (next.every) next.at += next.every; else q.delete(nextId);
      next.fn();
    }
    now = Math.max(now, limit);
  }
  return {
    setTimeout: (fn, ms) => add(fn, ms, 0),
    setInterval: (fn, ms) => add(fn, ms, ms || 1),
    clearTimeout: clear, clearInterval: clear,
    requestAnimationFrame: fn => add(() => fn(now), 16, 0),
    advance: ms => runUntil(now + ms),
    // 인터벌(게임 타이머)은 돌리지 않고 일회성 타이머만 모두 소진
    flush() {
      for (let guard = 0; guard < 1e5; guard++) {
        const once = [...q.entries()].filter(([, t]) => !t.every).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!once) return;
        q.delete(once[0]); now = Math.max(now, once[1].at); once[1].fn();
      }
    },
  };
}

function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    clear: () => m.clear(),
    _dump: () => Object.fromEntries([...m].sort()),
  };
}

/* ── 게임 한 벌 로드 ─────────────────────────────────── */
function loadGame() {
  const bodyHtml = SRC.slice(SRC.indexOf('<body>') + 6, SRC.indexOf('<script>'));
  const script   = SRC.slice(SRC.indexOf('<script>') + 8, SRC.lastIndexOf('</script>'));
  const body = buildBody(bodyHtml);
  const docEl = new FakeElement('html');
  docEl.innerHTML = SRC;   // CSS 규칙 존재 여부를 소스 문자열로 확인하는 기존 테스트용
  const docListeners = {};
  const document = {
    body, documentElement: docEl, hidden: false, styleSheets: [],
    getElementById: id => (body.id === id ? body : [...body.descendants()].find(e => e.id === id) || null),
    querySelector: s => body.querySelector(s),
    querySelectorAll: s => body.querySelectorAll(s),
    createElement: t => new FakeElement(t),
    addEventListener: (t, fn) => { (docListeners[t] ||= []).push(fn); },
  };
  const clock = makeClock();
  const localStorage = makeLocalStorage();
  const ctx = {
    document, localStorage, console,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval, clearInterval: clock.clearInterval,
    requestAnimationFrame: clock.requestAnimationFrame,
    innerWidth: 400, innerHeight: 800,
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({}),
    location: { reloaded: false, reload() { this.reloaded = true; } },
    addEventListener() {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  // vm 컨텍스트의 전역 조회(Math, Array 등)는 인터셉터를 거쳐 매우 느리므로(실측 20배 이상)
  // 내장 객체를 함수 매개변수로 가려서 실행하고, 이후 코드는 같은 스코프의 직접 eval 로 평가한다.
  // 'use strict' 지시문이 함수 본문 첫 문장으로 유지되어 원본과 같은 strict 모드로 동작함
  const BUILTINS = 'Math,Array,Object,JSON,Set,Map,Number,String,Date,Error';
  const run = vm.runInContext(
    `(function(${BUILTINS}){${script}\n;return code => eval(code);})(${BUILTINS})`,
    ctx, { filename: 'sudoku.html<script>' });
  return { ctx, run, clock, localStorage, document };
}

/* ── 통합 테스트 ──────────────────────────────────────── */
const results = [];
function itest(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: e.message }); }
}
function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}: expected ${e.slice(0, 200)}, got ${a.slice(0, 200)}`);
}

/* 현재 게임을 모두 정답으로 채움 */
function solveCurrentGame(g) {
  g.run(`(() => {
    const st = GameState.getState();
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++)
      if (!st.given[r][c] && st.board[r][c] !== st.solution[r][c]) {
        GameController.handleCellClick(r, c);
        GameController.handleNumberInput(st.solution[r][c]);
      }
  })()`);
}

itest('[2] 완료 모달에 실제 경과 시간이 표시됨 (숫자 입력으로 완료)', () => {
  const g = loadGame();
  g.clock.flush();
  g.run(`GameController.startGame('easy')`);
  g.clock.advance(125000);                       // 2분 5초 경과
  solveCurrentGame(g);
  g.clock.flush();                               // showComplete 지연 실행
  const msg = g.document.getElementById('complete-msg').textContent;
  if (!msg.includes('2분 5초')) throw new Error(`complete-msg = ${JSON.stringify(msg)}`);
});

itest('[2] 완료 모달에 실제 경과 시간이 표시됨 (힌트로 완료)', () => {
  const g = loadGame();
  g.clock.flush();
  g.run(`GameController.startGame('easy')`);
  g.clock.advance(61000);                        // 1분 1초 경과
  // 빈 칸 하나만 남기고 채운 뒤 마지막 칸을 힌트로 완료
  g.run(`(() => {
    const st = GameState.getState(); st.hints = 99;
    const empties = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!st.given[r][c]) empties.push([r, c]);
    const [lr, lc] = empties.pop();
    empties.forEach(([r, c]) => { GameController.handleCellClick(r, c); GameController.handleNumberInput(st.solution[r][c]); });
    GameController.handleCellClick(lr, lc);
    GameController.handleHint();
  })()`);
  g.clock.flush();
  const msg = g.document.getElementById('complete-msg').textContent;
  if (!msg.includes('1분 1초')) throw new Error(`complete-msg = ${JSON.stringify(msg)}`);
});

/* ── 인게임 TestRunner 실행 ───────────────────────────── */
const g = loadGame();
g.clock.flush();
const inPage = g.run(`TestRunner.runAll()`);
g.clock.flush();

let pass = 0, fail = 0;
console.log('▸ 인게임 TestRunner');
for (const r of inPage) {
  if (r.type === 'pass') pass++;
  if (r.type === 'fail') { fail++; console.log(`  ❌ ${r.name}\n     └ ${r.error}`); }
}
console.log(`  ${pass}/${pass + fail} 통과`);
console.log('▸ 통합 테스트 (tests/run.mjs)');
for (const r of results) {
  if (r.ok) { pass++; console.log(`  ✅ ${r.name}`); }
  else { fail++; console.log(`  ❌ ${r.name}\n     └ ${r.error}`); }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
