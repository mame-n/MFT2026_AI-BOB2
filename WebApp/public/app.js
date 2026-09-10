import { LEVELS, judge, finalGrade, finalPointCount, averageConfidence, scoredConfidenceAverage, shuffle } from './game.js';
import { BobBleTransport, bleConnectionTargets, connectSerial, connectMidi } from './transports.js';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const state = {
  running: false,
  cancelled: false,
  cancelMode: '',
  level: 'beginner',
  scores: [],
  latestByMotion: {},
  samplesByBob: {},
  session: 1,
  createAi: {
    rawLines: 0,
    parsedLines: 0,
    rejectedLines: 0,
    latestRaw: '',
    dances: Array.from({ length: 4 }, () => ({
      L: { count: 0, confidence: null, at: null },
      R: { count: 0, confidence: null, at: null }
    })),
    idle: {
      L: { count: 0, confidence: null, at: null },
      R: { count: 0, confidence: null, at: null },
      '統合': { count: 0, confidence: null, at: null }
    }
  }
};
const bobs = [
  { id: 0, motion: 0, motionName: 'バイバイ', modelName: 'danceNo0', averageLabelId: 'averageLabel1', led: 'blank', status: '待機中', connected: false },
  { id: 1, motion: 1, motionName: '左右フリフリ', modelName: 'danceNo1', averageLabelId: 'averageLabel2', led: 'blank', status: '待機中', connected: false },
  { id: 2, motion: 2, motionName: '変なおじさん', modelName: 'danceNo2', averageLabelId: 'averageLabel3', led: 'blank', status: '待機中', connected: false },
  { id: 3, motion: 3, motionName: '上でバーン', modelName: 'danceNo3', averageLabelId: 'averageLabel4', led: 'blank', status: '待機中', connected: false }
];
const DEMO_DURATIONS = {
  beginner: [8500, 10800, 13300, 12500],
  advanced: [6500, 8000, 9400, 8900]
};
// ✓を1秒、3・2・1を各0.5秒、GOを高速スクロールした後に演技開始。
// 演技開始から1秒後に採点用サンプリングを始める。
const SAMPLE_START_AFTER_DEMO_COMMAND_MS = 4400;
const LED_PATTERNS = {
  blank: '00000/00000/00000/00000/00000',
  check: '00001/00010/10100/01000/00000', dot: '00000/00000/00100/00000/00000',
  square: '11111/10001/10001/10001/11111', happy: '00000/01010/00000/10001/01110',
  0: '01110/10001/10001/10001/01110', 1: '00100/01100/00100/00100/01110',
  2: '01110/10001/00010/00100/11111', 3: '11110/00001/01110/00001/11110',
  M: '10001/11011/10101/10001/10001', L: '10000/10000/10000/10000/11111',
  cry: '01010/11011/10001/01110/10001', triangle: '00100/01010/01010/10001/11111',
  circle: '01110/10001/10001/10001/01110', double: '01110/10001/10101/10001/01110',
  diamond: '00000/00100/01010/00100/00000',
  U: '10001/10001/10001/10001/01110', N: '10001/11001/10101/10011/10001',
  S: '01111/10000/01110/00001/11110', O: '01110/10001/10001/10001/01110',
  G: '01110/10000/10111/10001/01110', D: '11110/10001/10001/10001/11110',
  P: '11110/10001/11110/10000/10000', E: '11111/10000/11110/10000/11111',
  R: '11110/10001/11110/10100/10010', F: '11111/10000/11110/10000/10000'
};
let ledRevision = 0;
const ledHtml = key => (LED_PATTERNS[key] || LED_PATTERNS.blank).replaceAll('/', '').split('').map(x => `<i class="${x === '1' ? 'on' : ''}"></i>`).join('');
function setBobLed(id, led, status) { const bob = bobs[id]; if (!bob) return; bob.led = String(led); if (status) bob.status = status; renderBobs(id); }
async function showDemoSequence(bob, level) {
  const revision = ++ledRevision;
  setBobLed(bob.id, 'check', `${bob.motionName} · 選択`); await sleep(1000);
  for (const key of [3, 2, 1]) { if (revision !== ledRevision || state.cancelled) return; setBobLed(bob.id, key, `${bob.motionName} · カウントダウン`); await sleep(500); }
  if (revision !== ledRevision || state.cancelled) return;
  setBobLed(bob.id, 'G', 'GO'); await sleep(350);
  if (revision !== ledRevision || state.cancelled) return;
  setBobLed(bob.id, 'O', 'GO'); await sleep(350);
  if (revision === ledRevision) setBobLed(bob.id, 'happy', `${bob.motionName} · 模範演技中`);
}

async function showFinalLedSequence(points) {
  const revision = ++ledRevision;
  for (const frame of ['dot', 'diamond', 'circle', 'square']) {
    if (revision !== ledRevision || state.cancelled) return;
    bobs.forEach(bob => { bob.led = frame; bob.status = '採点中'; }); renderBobs();
    await countdown(500);
  }
  bobs.forEach(bob => { bob.led = 'blank'; bob.status = '結果発表'; }); renderBobs();
  for (let id = 0; id < points; id++) {
    if (revision !== ledRevision || state.cancelled) return;
    bobs[id].led = 'double'; renderBobs(id);
    if (id < points - 1) await countdown(700);
  }
}
const ble = new BobBleTransport((count, devices = []) => {
  const connected = count > 0;
  const complete = count >= 4;
  const connectedIds = new Set(devices.map(device => device.id));
  bobs.forEach(bob => {
    const wasConnected = bob.connected;
    bob.connected = connectedIds.has(bob.id);
    if (!wasConnected && bob.connected && bob.led === 'blank') { bob.led = 'diamond'; bob.status = '接続済み'; }
    if (wasConnected && !bob.connected) bob.status = '切断';
  });
  const idLabel = [...connectedIds].sort((a, b) => a - b).map(id => `ID ${id}`).join(', ');
  $('bleStatus').textContent = `${count} / 4台 · Bluetooth${idLabel ? ` · ${idLabel}` : ''}`;
  $('bleDot').classList.toggle('live', connected);
  $('bleButton').classList.toggle('connected', connected);
  $('bleButton').disabled = false;
  $('bleButton').textContent = complete ? '4台 接続済み' : '接続管理';
  renderBobs();
});

function renderBobs(active = -1) {
  $('bobGrid').innerHTML = bobs.map(b => `<article class="bob ${b.id === active ? 'active' : ''} ${b.status === '完了' ? 'done' : ''} ${b.connected ? 'connected' : 'disconnected'}"><header><span>BOB 0${b.id + 1}</span><span>ID ${b.id}</span></header><div class="face" aria-label="LED表示 ${b.led}">${ledHtml(b.led)}</div><b>MOVE ${String(b.motion).padStart(2, '0')}</b><small>${b.status}</small><small class="link-state">${b.connected ? '● BLE接続済み' : '○ 未接続'}</small><div class="bob-test-controls" aria-label="BOB ${b.id + 1} 動作確認"><button data-bob-test="0" data-bob-id="${b.id}" title="両腕を上げて保持" ${b.connected ? '' : 'disabled'}>A</button><button data-bob-test="1" data-bob-id="${b.id}" title="IDを2秒間表示" ${b.connected ? '' : 'disabled'}>B</button><button data-bob-test="2" data-bob-id="${b.id}" title="両腕を下げ、右0.2秒・左0.4秒・右0.2秒旋回（LED変更なし）" ${b.connected ? '' : 'disabled'}>ロゴ</button></div></article>`).join('');
}
function log(message, area = 'other') {
  const li = document.createElement('li');
  li.innerHTML = `<time>${new Date().toLocaleTimeString('ja-JP')}</time>${message}`;
  $({ motion1: 'eventLog1', motion2: 'eventLog2', other: 'eventLogOther' }[area]).prepend(li);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}
function renderCreateAiDiagnostics() {
  $('createAiStatus').textContent = `受信 ${state.createAi.rawLines}行 / 有効 ${state.createAi.parsedLines}行 / 無視 ${state.createAi.rejectedLines}行`;
  $('createAiLastRaw').textContent = state.createAi.latestRaw || '未受信';
  const valueCell = item => item.count
    ? `<b>${Math.round(item.confidence)}%</b><small>${item.count}件 · ${item.at.toLocaleTimeString('ja-JP')}</small>`
    : '<span>--</span><small>0件</small>';
  const danceRows = state.createAi.dances.map((dance, index) => `
    <section class="createai-motion">
      <h3>d${index}</h3>
      <div><span>d${index}-L</span>${valueCell(dance.L)}</div>
      <div><span>d${index}-R</span>${valueCell(dance.R)}</div>
    </section>
  `).join('');
  $('createAiDiagBody').innerHTML = `${danceRows}
    <section class="createai-motion idle">
      <h3>idle</h3>
      <div><span>idle-L</span>${valueCell(state.createAi.idle.L)}</div>
      <div><span>idle-R</span>${valueCell(state.createAi.idle.R)}</div>
      <div><span>idle</span>${valueCell(state.createAi.idle['統合'])}</div>
    </section>`;
}
function renderRawSerialLine(raw, data) {
  const li = document.createElement('li');
  li.className = data ? 'parsed' : 'rejected';
  const parsed = data ? `OK ${data.type === 'idle' ? 'idle' : `d${data.motion}`} ${data.side} ${Math.round(Number(data.confidence) || 0)}%` : '無視';
  li.innerHTML = `<time>${new Date().toLocaleTimeString('ja-JP')}</time><code>${escapeHtml(raw)}</code><b>${parsed}</b>`;
  $('rawSerialLog').prepend(li);
  while ($('rawSerialLog').children.length > 120) $('rawSerialLog').lastChild.remove();
}
function updateCreateAiDiagnosticValue(data) {
  const confidence = Math.max(0, Math.min(100, Number(data.confidence) || 0));
  const side = data.side || '統合';
  const item = data.type === 'idle'
    ? state.createAi.idle[side]
    : state.createAi.dances[Number(data.motion)]?.[side];
  if (!item) return;
  item.count++;
  item.confidence = confidence;
  item.at = new Date();
}
function setPhase(label, progress) { $('phaseLabel').textContent = label; $('systemStatus').textContent = label; $('progressBar').style.width = `${progress}%`; }
function setLevel(level) { if (state.running) return; state.level = level; document.querySelectorAll('.level').forEach(x => x.classList.toggle('active', x.dataset.level === level)); $('modeLabel').textContent = LEVELS[level].label; log(`難易度を「${LEVELS[level].label}」に設定`); }
function send(id, payload) { log(`BOB ${id + 1} ← ${payload.cmd}`); return ble.send(id, payload); }

let bleCandidates = [];
let blePickerBusy = false;
let blePickerCancelled = false;

function bleCandidateName(candidate, index) {
  const bracketName = candidate.name?.match(/\[[^\]]+\]/)?.[0];
  return bracketName || candidate.name?.replace(/^BBC micro:bit\s*/i, '') || `micro:bit候補 ${index + 1}`;
}

function setBlePickerBusy(busy) {
  blePickerBusy = busy;
  $('bleRescanButton').disabled = busy;
  $('bleConnectAllButton').disabled = busy || !bleCandidates.some(item => !item.connected);
  $('bleDeviceList').querySelectorAll('button').forEach(button => { button.disabled = busy; });
}

function renderBleCandidates() {
  const list = $('bleDeviceList');
  list.replaceChildren();
  if (!bleCandidates.length) {
    const empty = document.createElement('li');
    empty.className = 'ble-device-item';
    empty.textContent = '接続可能なBOB2 micro:bitが見つかりませんでした。';
    list.append(empty);
  }
  bleCandidates.forEach((candidate, index) => {
    const item = document.createElement('li');
    item.className = `ble-device-item${candidate.connected ? ' connected' : ''}${candidate.failed ? ' failed' : ''}`;
    const info = document.createElement('div');
    const name = document.createElement('b');
    name.textContent = bleCandidateName(candidate, index);
    const detail = document.createElement('small');
    const rssi = Number.isFinite(candidate.rssi) ? ` · RSSI ${candidate.rssi}` : '';
    detail.textContent = `${candidate.address}${rssi}`;
    const result = document.createElement('span');
    result.className = 'device-result';
    result.textContent = candidate.result || (candidate.connected ? `接続済み · ID ${candidate.id}` : '未接続');
    info.append(name, detail, result);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = candidate.connected ? '接続済み' : 'この1台を接続';
    button.disabled = candidate.connected || blePickerBusy;
    button.addEventListener('click', () => connectBleCandidate(candidate));
    item.append(info, button);
    list.append(item);
  });
  $('bleConnectAllButton').disabled = blePickerBusy || !bleCandidates.some(item => !item.connected);
}

async function scanBleCandidates() {
  setBlePickerBusy(true);
  $('bleScanState').textContent = '8秒間スキャンしています…';
  try {
    bleCandidates = await ble.scan();
    const available = bleCandidates.filter(item => !item.connected).length;
    $('bleScanState').textContent = `${bleCandidates.length}台を表示 · 未接続 ${available}台`;
    renderBleCandidates();
  } catch (error) {
    bleCandidates = [];
    $('bleScanState').textContent = `スキャン失敗: ${error.message}`;
    renderBleCandidates();
    log(`Bluetooth: ${error.message}`);
  } finally {
    setBlePickerBusy(false);
  }
}

async function connectBleCandidate(candidate, keepBusy = false) {
  if (candidate.connected) return true;
  if (!keepBusy) setBlePickerBusy(true);
  candidate.failed = false;
  candidate.result = '接続中…（IDを確認しています）';
  renderBleCandidates();
  try {
    const id = await ble.connectCandidate(candidate);
    candidate.connected = true;
    candidate.id = id;
    candidate.result = `接続成功 · ID ${id}`;
    log(`BOB2 micro:bitを接続（ID ${id}）`);
    return true;
  } catch (error) {
    candidate.failed = true;
    candidate.result = `接続失敗 · ${error.message}`;
    log(`Bluetooth: ${bleCandidateName(candidate, bleCandidates.indexOf(candidate))} — ${error.message}`);
    return false;
  } finally {
    renderBleCandidates();
    if (!keepBusy) setBlePickerBusy(false);
  }
}

async function connectAllBleCandidates() {
  blePickerCancelled = false;
  setBlePickerBusy(true);
  const targets = bleConnectionTargets(bleCandidates, ble.devices.length);
  let success = 0;
  for (const candidate of targets) {
    if (blePickerCancelled) break;
    if (await connectBleCandidate(candidate, true)) success++;
  }
  await ble.refresh();
  $('bleScanState').textContent = blePickerCancelled
    ? `一括接続をキャンセルしました · 今回成功 ${success}台`
    : `一括接続完了 · 今回成功 ${success}/${targets.length}台`;
  setBlePickerBusy(false);
  renderBleCandidates();
}

async function openBleDialog() {
  blePickerCancelled = false;
  $('bleDialog').showModal();
  if (ble.devices.length >= 4) {
    bleCandidates = ble.devices.map(device => ({ ...device, connected: true, rssi: null }));
    $('bleScanState').textContent = '4台すべて接続済みです';
    renderBleCandidates();
    setBlePickerBusy(false);
    return;
  }
  await scanBleCandidates();
}

function closeBleDialog() {
  blePickerCancelled = true;
  $('bleDialog').close();
}
function updateMotion(data) {
  const rawConfidence = Number(data.confidence) || 0;
  const confidence = Math.max(0, Math.min(1, rawConfidence / 100));
  const side = data.side || '統合';
  const motion = Number(data.motion);
  const confidencePercent = Math.round(confidence * 100);
  $('motionReadout').textContent = `danceNo${motion} · ${side}`;
  $('confidenceMeter').value = confidence; $('confidenceLabel').textContent = `${confidencePercent}%`;
  log(`動作受信 — ${side} / danceNo${motion} / 確信度 ${confidencePercent}%`, motion === 0 ? 'motion1' : motion === 1 ? 'motion2' : 'other');
  state.latestByMotion[motion] = confidence;
}
function updateSerialDiagnostics(raw, data) {
  state.createAi.rawLines++;
  state.createAi.latestRaw = raw;
  if (data) {
    state.createAi.parsedLines++;
    updateCreateAiDiagnosticValue(data);
  } else state.createAi.rejectedLines++;
  renderRawSerialLine(raw, data);
  renderCreateAiDiagnostics();
}
async function countdown(ms) { const until = Date.now() + ms; while (Date.now() < until) { if (state.cancelled) throw new Error('cancelled'); await sleep(Math.min(100, until - Date.now())); } }
async function sampleAverage(motion, labelId, count = 20, intervalMs = 250) {
  const samples = [];
  for (let i = 0; i < count; i++) {
    await countdown(intervalMs);
    samples.push(state.latestByMotion[motion] || 0);
    const currentAverage = scoredConfidenceAverage(samples);
    $(labelId).textContent = samples.length === 1 ? `--% (1/${count}・除外)` : `${Math.round(currentAverage * 100)}% (${samples.length}/${count})`;
  }
  return { samples, average: scoredConfidenceAverage(samples) };
}
function renderSampleHistory() {
  $('sampleHistoryBody').innerHTML = Array.from({ length: 20 }, (_, index) => `
    <tr${index === 0 ? ' class="excluded-sample"' : ''}><th scope="row">${String(index + 1).padStart(2, '0')}${index === 0 ? ' (除外)' : ''}</th>${bobs.map(bob => { const value = state.samplesByBob[bob.id]?.[index]; return `<td>${value === undefined ? '--' : `${Math.round(value * 100)}%`}</td>`; }).join('')}</tr>
  `).join('');
  bobs.forEach(bob => { const samples = state.samplesByBob[bob.id] || []; $(`sampleAverage${bob.id + 1}`).textContent = samples.length > 1 ? `${Math.round(scoredConfidenceAverage(samples) * 100)}%` : '--'; });
  $('sampleHistory').hidden = false;
}

async function startGame() {
  if (state.running) return;
  state.running = true; state.cancelled = false; state.cancelMode = ''; state.scores = []; state.samplesByBob = {};
  $('sampleHistory').hidden = true;
  $('startButton').disabled = true; $('stopButton').disabled = false; $('systemDot').classList.add('live'); $('resultOverlay').hidden = true;
  ledRevision++;
  bobs.forEach(b => { b.led = 'blank'; b.status = '待機中'; }); renderBobs();
  const cfg = LEVELS[state.level];
  // WebAppがゲームごとにBOBの演技順を決定する。
  let sessionBobs = shuffle(bobs.filter(bob => bob.connected));
  if (!sessionBobs.length && $('simulationToggle').checked) sessionBobs = shuffle(bobs);
  try {
    if (!sessionBobs.length) throw new Error('BOB2 micro:bitが接続されていません');
    log('ゲームを開始');
    log(`ダンス順: ${sessionBobs.map(bob => `B${bob.id}`).join(' → ')}`);
    await ble.broadcast({ cmd: 'COMPLETE' });
    const measurementTasks = [];
    for (let index = 0; index < sessionBobs.length; index++) {
      const bob = sessionBobs[index];
      const progressBase = index * (88 / sessionBobs.length);
      setPhase(`BOB-0${bob.id + 1} ${bob.motionName}`, 5 + progressBase);
      bob.status = '模範演技中'; renderBobs(bob.id);
      await send(bob.id, { cmd: 'DEMO', motion: 0, level: cfg.command });
      showDemoSequence(bob, cfg.command);
      const measurementTask = (async () => {
        await countdown(SAMPLE_START_AFTER_DEMO_COMMAND_MS);
        $(bob.averageLabelId).textContent = '--% (0/20)';
        state.latestByMotion[bob.motion] = 0;
        if ($('simulationToggle').checked) setTimeout(() => updateMotion({ type: 'motion', side: 'SIM', motion: bob.motion, confidence: 58 + Math.random() * 40 }), 100);
        const measurement = await sampleAverage(bob.motion, bob.averageLabelId);
        state.samplesByBob[bob.id] = measurement.samples;
        const averagePercent = Math.round(measurement.average * 100);
        const result = judge(measurement.average);
        state.scores[bob.id] = result.points;
        log(`${bob.motionName}平均: ${averagePercent}% / BOB ${bob.id + 1}: ${result.points}点`);
        return result;
      })();
      measurementTasks.push(measurementTask);
      // 採点処理は並行させ、BOB2の演技が終わった時点ですぐ次のBOBへ進む。
      await countdown(DEMO_DURATIONS[state.level][bob.id]);
      ledRevision++;
      bob.led = 'blank'; bob.status = '演技完了'; renderBobs();
    }
    setPhase('採点中', 94);
    await Promise.all(measurementTasks);
    const total = sessionBobs.reduce((sum, bob) => sum + (state.scores[bob.id] || 0), 0);
    const normalizedTotal = total * (4 / sessionBobs.length);
    const grade = finalGrade(normalizedTotal), finalPoints = finalPointCount(normalizedTotal);
    setPhase('結果発表', 100);
    await ble.broadcast({ cmd: 'TOTAL', points: finalPoints });
    await showFinalLedSequence(finalPoints);
    await countdown(100);
    await ble.broadcast({ cmd: 'CELEBRATE' });
    bobs.forEach(bob => { bob.status = 'バイバイ'; }); renderBobs();
    await countdown(3000);
    ledRevision++;
    bobs.forEach(bob => { bob.led = 'diamond'; bob.status = '待機中'; }); renderBobs();
    renderSampleHistory();
    $('resultWord').textContent = grade; $('resultScore').textContent = total; $('resultOverlay').hidden = false; log(`ゲーム完了 — ${grade} / ${total}点（LED ${finalPoints}点）`);
  } catch (error) { if (error.message !== 'cancelled') log(`エラー: ${error.message}`); }
  finally { await finish(); }
}
async function finish() {
  if (state.cancelled && state.cancelMode === 'cue') await ble.broadcast({ cmd: 'COMPLETE' });
  state.running = false; $('startButton').disabled = false; $('stopButton').disabled = false; $('systemDot').classList.remove('live');
  if (state.cancelled) {
    ledRevision++;
    bobs.forEach(b => { b.led = state.cancelMode === 'home' ? 'diamond' : 'blank'; b.status = state.cancelMode === 'home' ? '初期位置' : '待機中'; });
    renderBobs(); setPhase('準備中', 0);
    log(state.cancelMode === 'home' ? 'ゲームを中断し、BOB2を初期位置へ移動しました' : 'ゲームを中断しました');
  }
}
async function stopGame() {
  state.cancelMode = 'cue';
  if (state.running) state.cancelled = true;
  else {
    await ble.broadcast({ cmd: 'COMPLETE' });
    $('resultOverlay').hidden = true;
    ledRevision++;
    bobs.forEach(b => { b.led = 'blank'; b.status = '待機中'; }); renderBobs(); setPhase('準備中', 0); log('BOB2を停止し、LEDを消去しました');
  }
}
async function moveBobsHome() {
  state.cancelMode = 'home';
  if (state.running) state.cancelled = true;
  await ble.broadcast({ cmd: 'HOME' });
  $('resultOverlay').hidden = true;
  if (!state.running) {
    ledRevision++;
    bobs.forEach(b => { b.led = 'diamond'; b.status = '初期位置'; }); renderBobs(); setPhase('準備中', 0); log('BOB2の車輪を停止し、両腕を30度へ移動しました');
  }
}

document.querySelectorAll('.level').forEach(button => button.addEventListener('click', () => setLevel(button.dataset.level)));
$('startButton').addEventListener('click', startGame); $('stopButton').addEventListener('click', stopGame);
$('homeButton').addEventListener('click', moveBobsHome);
$('resultClose').addEventListener('click', () => { $('resultOverlay').hidden = true; state.session++; $('sessionNumber').textContent = String(state.session).padStart(3, '0'); setPhase('準備中', 0); });
$('clearLog').addEventListener('click', () => ['eventLog1', 'eventLog2', 'eventLogOther'].forEach(id => $(id).replaceChildren()));
$('soundButton').addEventListener('click', e => { e.currentTarget.classList.toggle('active'); e.currentTarget.textContent = e.currentTarget.classList.contains('active') ? '♫' : '♪'; });
$('serialButton').addEventListener('click', async () => { try { await connectSerial(updateMotion, () => { $('ctrlDot').classList.remove('live'); $('ctrlStatus').textContent = '切断 · USB Serial'; }, updateSerialDiagnostics); $('ctrlDot').classList.add('live'); $('ctrlStatus').textContent = '接続済み · USB Serial'; log('Ctrl micro:bitを接続'); } catch (e) { log(`Serial: ${e.message}`); } });
$('midiButton').addEventListener('click', async () => { try { const name = await connectMidi(level => { setLevel(level); startGame(); }, stopGame, setLevel); $('midiDot').classList.add('live'); $('midiStatus').textContent = `${name} · MIDI`; log(`${name}を接続`); } catch (e) { log(`MIDI: ${e.message}`); } });
$('bleButton').addEventListener('click', openBleDialog);
$('bleRescanButton').addEventListener('click', scanBleCandidates);
$('bleConnectAllButton').addEventListener('click', connectAllBleCandidates);
$('bleCancelButton').addEventListener('click', closeBleDialog);
$('bleDialogClose').addEventListener('click', closeBleDialog);
$('bleDialog').addEventListener('cancel', event => { event.preventDefault(); closeBleDialog(); });
$('bobGrid').addEventListener('click', async event => {
  const button = event.target.closest('[data-bob-test]');
  if (!button) return;
  if (state.running) { log('ゲーム中はBOB2の動作確認を実行できません'); return; }
  const id = Number(button.dataset.bobId), input = Number(button.dataset.bobTest);
  const names = ['A（両腕を上げて保持）', 'B（IDを2秒表示）', 'ロゴ（両腕を下げて右・左・右に旋回）'];
  button.disabled = true;
  try {
    const sent = await send(id, { cmd: 'TEST', input });
    if (!sent) throw new Error(`BOB-${id + 1}は未接続です`);
    log(`BOB ${id + 1}: ${names[input]}テスト`);
  } catch (error) { log(`動作確認: ${error.message}`); }
  finally { button.disabled = false; }
});
renderBobs(); renderCreateAiDiagnostics(); log('コントローラーを起動しました');
