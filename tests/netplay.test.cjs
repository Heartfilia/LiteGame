const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { NES } = require('../games/nes/vendor/jsnes.min.js');
const Netplay = require('../assets/js/netplay.js');

test('Netplay room code and server URL validators enforce v1 security rules', () => {
  assert.equal(Netplay.normalizeRoomCode('482 910'), '482910');
  assert.equal(Netplay.normalizeRoomCode('123-456'), '123456');
  assert.throws(() => Netplay.normalizeRoomCode('000000'), /房间号/);
  assert.throws(() => Netplay.normalizeRoomCode('12345'), /房间号/);
  assert.throws(() => Netplay.normalizeRoomCode('12ab56'), /房间号/);

  assert.equal(Netplay.normalizeServer('https://save.example.com/'), 'https://save.example.com');
  assert.equal(Netplay.normalizeServer('http://127.0.0.1:8766'), 'http://127.0.0.1:8766');
  assert.equal(Netplay.normalizeServer('http://localhost:9000'), 'http://localhost:9000');
  assert.throws(() => Netplay.normalizeServer('http://save.example.com'), /HTTPS/);
  assert.throws(() => Netplay.normalizeServer('https://save.example.com/api'), /根地址/);
  assert.throws(() => Netplay.normalizeServer('https://user:pass@save.example.com'), /根地址/);
});

test('10-byte binary lockstep frame codec roundtrips masks, session IDs and redundancy', () => {
  const encoded = Netplay.encodeInputFrame(259, 104857, 0x03ff, 0x0155);
  assert.equal(encoded.byteLength, 10);
  const decoded = Netplay.decodeInputFrame(encoded.buffer);
  assert.deepEqual(decoded, {
    sessionId: 3,
    frame: 104857,
    mask: 0x03ff,
    prevMask: 0x0155,
    hasPrev: true
  });
  assert.equal(Netplay.decodeInputFrame(new Uint8Array([2, 1, 0, 0, 0, 1, 0, 1])), null);
  assert.equal(Netplay.decodeInputFrame(new Uint8Array([1, 1, 0, 0])), null);
});

test('Lockstep queue recovers single dropped packet from prevMask and ignores stale sessions', () => {
  const host = Netplay.createLockstep({ role: 1, sessionId: 5, delay: 2 });
  const guest = Netplay.createLockstep({ role: 2, sessionId: 5, delay: 2 });

  const hostOut = [], guestOut = [];
  // Step frames 0 and 1 (pre-seeded delay window), producing frames 2 and 3.
  for (let i = 0; i < 2; i++) {
    host.produceLocal(f => f === 2 ? 0b0011 : 0b0101, pkt => hostOut.push(pkt));
    guest.produceLocal(f => f === 2 ? 0b1000 : 0b1100, pkt => guestOut.push(pkt));
    assert.ok(host.consumeFrame());
    assert.ok(guest.consumeFrame());
  }
  assert.equal(hostOut.length, 2);
  assert.equal(guestOut.length, 2);

  // Stale session packet must be rejected.
  assert.equal(host.receive(Netplay.encodeInputFrame(4, 2, 0x03ff, 0)), false);
  assert.equal(host.canStep(), false);

  // Simulate dropping guest's frame-2 packet; only frame-3 packet arrives carrying prevMask for frame 2!
  assert.equal(host.receive(guestOut[1]), true);
  assert.equal(guest.receive(hostOut[0]), true);
  assert.equal(guest.receive(hostOut[1]), true);

  assert.deepEqual(host.consumeFrame(), { frame: 2, p1: 0b0011, p2: 0b1000 });
  assert.deepEqual(guest.consumeFrame(), { frame: 2, p1: 0b0011, p2: 0b1000 });
  assert.deepEqual(host.consumeFrame(), { frame: 3, p1: 0b0101, p2: 0b1100 });
  assert.deepEqual(guest.consumeFrame(), { frame: 3, p1: 0b0101, p2: 0b1100 });
});

test('Two independent Contra JSNES instances stay pixel-identical through 2P lockstep and snapshot resync', async () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../games/nes/catalog.json'), 'utf8'));
  const contra = catalog.games.find(g => g.title === '魂斗罗' && g.status === 'boot');
  assert.ok(contra);
  const rom = fs.readFileSync(path.join(__dirname, '../games/nes', contra.rom));

  let frameHost, frameGuest;
  const nesHost = new NES({ sampleRate: 44100, onAudioSample() {}, onFrame: b => { frameHost = Buffer.from(new Uint32Array(b).buffer); } });
  const nesGuest = new NES({ sampleRate: 48000, onAudioSample() {}, onFrame: b => { frameGuest = Buffer.from(new Uint32Array(b).buffer); } });
  nesHost.loadROM(rom);
  nesGuest.loadROM(rom);

  const lockHost = Netplay.createLockstep({ role: 1, sessionId: 1, delay: 3 });
  const lockGuest = Netplay.createLockstep({ role: 2, sessionId: 1, delay: 3 });
  const appliedHost = [0, 0, 0], appliedGuest = [0, 0, 0];

  function applyMask(nes, stateArr, player, nextMask) {
    const diff = stateArr[player] ^ nextMask;
    for (let b = 0; b < 10; b++) {
      if (diff & (1 << b)) {
        if (nextMask & (1 << b)) nes.buttonDown(player, b);
        else nes.buttonUp(player, b);
      }
    }
    stateArr[player] = nextMask;
  }

  // Scripted 2-player Contra session: SELECT (2P mode), START, then simultaneous 1P + 2P movement & turbo fire.
  const p1Plan = f => {
    if (f === 120 || f === 121) return 1 << 2; // SELECT
    if (f === 132 || f === 133) return 1 << 3; // START
    if (f >= 180) return (1 << 7) | (1 << 0); // RIGHT + A
    return 0;
  };
  const p2Plan = f => {
    if (f >= 180) return (1 << 6) | (1 << 8); // LEFT + TURBO_A
    return 0;
  };

  for (let tick = 0; tick < 240; tick++) {
    const wireH2G = [], wireG2H = [];
    lockHost.produceLocal(p1Plan, pkt => wireH2G.push(pkt));
    lockGuest.produceLocal(p2Plan, pkt => wireG2H.push(pkt));
    for (const pkt of wireH2G) lockGuest.receive(pkt);
    for (const pkt of wireG2H) lockHost.receive(pkt);

    const stepH = lockHost.consumeFrame();
    const stepG = lockGuest.consumeFrame();
    assert.deepEqual(stepH, stepG);
    applyMask(nesHost, appliedHost, 1, stepH.p1);
    applyMask(nesHost, appliedHost, 2, stepH.p2);
    applyMask(nesGuest, appliedGuest, 1, stepG.p1);
    applyMask(nesGuest, appliedGuest, 2, stepG.p2);
    nesHost.frame();
    nesGuest.frame();
  }

  const hashHost1 = crypto.createHash('sha256').update(frameHost).digest('hex');
  const hashGuest1 = crypto.createHash('sha256').update(frameGuest).digest('hex');
  assert.equal(hashHost1, hashGuest1);

  // Mid-game snapshot pack/unpack resync into a fresh reconnected Guest instance.
  const packed = await Netplay.packSnapshot({ state: nesHost.toJSON() });
  const unpacked = await Netplay.unpackSnapshot(packed);
  let frameRejoined;
  const nesRejoined = new NES({ sampleRate: 48000, onAudioSample() {}, onFrame: b => { frameRejoined = Buffer.from(new Uint32Array(b).buffer); } });
  nesRejoined.loadROM(rom);
  nesRejoined.fromJSON(unpacked.state);
  const appliedRejoined = [0, 0, 0];

  // Reset applied controller state cleanly for session 2 on both sides.
  for (let p = 1; p <= 2; p++) for (let b = 0; b < 10; b++) { nesHost.buttonUp(p, b); nesRejoined.buttonUp(p, b); }
  appliedHost[1] = appliedHost[2] = 0;

  const lockH2 = Netplay.createLockstep({ role: 1, sessionId: 2, delay: 2 });
  const lockG2 = Netplay.createLockstep({ role: 2, sessionId: 2, delay: 2 });
  for (let tick = 0; tick < 60; tick++) {
    lockH2.produceLocal(f => (f % 2 === 0 ? (1 << 1) : 0), pkt => lockG2.receive(pkt));
    lockG2.produceLocal(f => (1 << 7) | (1 << 9), pkt => lockH2.receive(pkt));
    const sH = lockH2.consumeFrame(), sG = lockG2.consumeFrame();
    applyMask(nesHost, appliedHost, 1, sH.p1);
    applyMask(nesHost, appliedHost, 2, sH.p2);
    applyMask(nesRejoined, appliedRejoined, 1, sG.p1);
    applyMask(nesRejoined, appliedRejoined, 2, sG.p2);
    nesHost.frame();
    nesRejoined.frame();
  }

  const hashHost2 = crypto.createHash('sha256').update(frameHost).digest('hex');
  const hashRejoined2 = crypto.createHash('sha256').update(frameRejoined).digest('hex');
  assert.equal(hashHost2, hashRejoined2);
});
