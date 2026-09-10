const SCORE_CODES = { '×': 0, '△': 1, '○': 2, '◎': 3 };
export function encodeBobCommand(payload) {
  switch (payload.cmd) {
    case 'DEMO': return `0,${payload.motion},${payload.level}`;
    case 'QUESTION': return `1,${payload.id}`;
    case 'SCORE': return `2,${SCORE_CODES[payload.mark] ?? 0},${payload.points ?? 0}`;
    case 'TOTAL': return `3,${payload.points ?? 0}`;
    case 'COMPLETE': return '4';
    case 'HOME': return '5';
    case 'TEST': return `6,${payload.input}`;
    case 'CELEBRATE': return '7';
    default: throw new Error(`BOB2の未対応コマンド: ${payload.cmd}`);
  }
}

export function mergeBleScanDevices(scannedDevices, connectedDevices) {
  const connectedByAddress = new Map(connectedDevices.map(item => [item.address, item]));
  const merged = scannedDevices.map(item => ({
    ...item,
    connected: connectedByAddress.has(item.address),
    id: connectedByAddress.get(item.address)?.id ?? null
  }));
  const scannedAddresses = new Set(merged.map(item => item.address));
  for (const device of connectedDevices) {
    if (!scannedAddresses.has(device.address)) merged.push({ ...device, rssi: null, connected: true });
  }
  return merged;
}

export function bleConnectionTargets(candidates, connectedCount, maximum = 4) {
  return candidates.filter(item => !item.connected).slice(0, Math.max(0, maximum - connectedCount));
}

export class BobBleTransport {
  constructor(onChange) {
    this.devices = [];
    this.onChange = onChange;
    setInterval(() => this.refresh().catch(() => {}), 1000);
  }
  async refresh() {
    const response = await fetch('/api/ble/status');
    if (!response.ok) return;
    const status = await response.json();
    // Node側のBLEブリッジを正とし、Webリロード後も接続を復元する。
    this.devices = status.devices.map(item => ({
      id: item.id,
      address: item.address,
      name: this.devices.find(device => device.address === item.address)?.name || 'BOB2 micro:bit'
    }));
    this.onChange(this.devices.length, this.devices.map(device => ({ ...device })));
  }
  async scan() {
    await this.refresh();
    const scanResponse = await fetch('/api/ble/scan');
    const scan = await scanResponse.json();
    if (!scanResponse.ok) throw new Error(scan.error || 'BLEスキャンに失敗しました');
    return mergeBleScanDevices(scan.devices, this.devices);
  }
  async connectCandidate(selected) {
    await this.refresh();
    const existing = this.devices.find(item => item.address === selected.address);
    if (existing) return existing.id;
    if (this.devices.length >= 4) throw new Error('BOB2 micro:bitは4台接続済みです');
    const response = await fetch('/api/ble/connect', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: selected.address })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'BOB2への接続に失敗しました');
    if (this.devices.some(item => item.id === result.id)) throw new Error(`BOB ID ${result.id}は接続済みです`);
    this.devices.push({ id: result.id, address: selected.address, name: selected.name });
    this.onChange(this.devices.length, this.devices.map(device => ({ ...device })));
    return result.id;
  }
  async add() {
    const candidates = (await this.scan()).filter(item => !item.connected);
    if (!candidates.length) throw new Error('BOB2が見つかりません。BOB2のリセットボタンを押し、LED表示を確認してから再試行してください');
    return this.connectCandidate(candidates[0]);
  }
  async send(id, payload) {
    const target = this.devices.find(x => x.id === id);
    if (!target) return false;
    const command = encodeBobCommand(payload);
    const response = await fetch('/api/ble/send', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, command })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'BOB2への送信に失敗しました');
    return true;
  }
  async broadcast(payload) { await Promise.allSettled(this.devices.map(x => this.send(x.id, payload))); }
}

export async function connectSerial(onMotion, onDisconnect, onSerialLine = () => {}) {
  if (!navigator.serial) throw new Error('Chrome / Edgeで開いてください');
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });
  const reader = port.readable.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split(/\r?\n/); buffer = lines.pop();
        for (const line of lines) {
          const data = parseMotionLine(line);
          onSerialLine(line, data);
          if (data?.type === 'motion') onMotion(data);
        }
      }
    } finally { onDisconnect(); }
  })();
  return port;
}

const RADIO_MOTIONS = { danceNo0: 0, danceNo1: 1, danceNo2: 2, danceNo3: 3 };

export function parseMotionLine(line) {
  try {
    const data = JSON.parse(line);
    return ['motion', 'idle'].includes(data.type) ? data : null;
  } catch { /* Try MakeCode serial.writeValue format below. */ }

  const match = line.trim().match(/^(danceNo0|danceNo1|danceNo2|danceNo3)(?:-([RL]))?\s*[:=]\s*(-?\d+(?:\.\d+)?)$/);
  if (match) return { type: 'motion', side: match[2] || 'R', motion: RADIO_MOTIONS[match[1]], confidence: Number(match[3]) };

  const idleMatch = line.trim().match(/^idle(?:-([RL]))?\s*[:=]\s*(-?\d+(?:\.\d+)?)$/);
  if (idleMatch) return { type: 'idle', side: idleMatch[1] || '統合', confidence: Number(idleMatch[2]) };

  return null;
}

export function handleDj2Go2Message(data, onPlay, onCue, onLevel) {
  const [status, note, velocity] = data;
  if ((status & 0xf0) !== 0x90 || velocity === 0) return;

  const channel = status & 0x0f;

  // DISK1 is MIDI channel 1 and DISK2 is MIDI channel 2.
  if (channel === 0 && note === 0x00) onPlay('beginner');
  else if (channel === 1 && note === 0x00) onPlay('advanced');
  else if (channel <= 1 && note === 0x01) onCue();
  // Keep compatibility with the original DJ2GO MIDI layout.
  else if (channel === 0 && note === 0x3b) onPlay('beginner');
  else if (channel === 0 && note === 0x42) onPlay('advanced');
  else if (channel === 0 && [0x33, 0x3c].includes(note)) onCue();
}

export async function connectMidi(onPlay, onCue, onLevel) {
  if (!navigator.requestMIDIAccess) throw new Error('Web MIDIに対応していません');
  const access = await navigator.requestMIDIAccess();
  const input = [...access.inputs.values()].find(x => /DJ2GO2/i.test(x.name)) || [...access.inputs.values()][0];
  if (!input) throw new Error('MIDIコントローラーが見つかりません');
  input.onmidimessage = ({ data }) => handleDj2Go2Message(data, onPlay, onCue, onLevel);
  return input.name;
}
