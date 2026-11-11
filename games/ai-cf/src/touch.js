// Independent captured fingers for movement, looking and action buttons.
export class TouchControls {
  constructor(game) {
    this.g = game;
    this.enabled = matchMedia('(pointer:coarse)').matches || new URLSearchParams(location.search).has('touch');
    if (!this.enabled) return;
    const root = document.getElementById('touch'); root.classList.remove('hidden');
    const pad = document.createElement('div'); pad.className = 'pad'; pad.id = 'cf-move'; pad.setAttribute('aria-label', '移动摇杆');
    const knob = document.createElement('i'); pad.append(knob);
    const look = document.createElement('div'); look.id = 'cf-look'; look.setAttribute('aria-label', '滑动调整视角');
    root.append(look, pad);
    const active = () => game.playing && !game.paused && !game.ended && !game.inLoadout;
    const captures = new Map();
    const bind = (node, down, move, up) => {
      node.addEventListener('pointerdown', event => {
        if (!active() || captures.has(node)) return;
        event.preventDefault(); event.stopPropagation();
        captures.set(node, event.pointerId); node.setPointerCapture(event.pointerId); down(event);
      });
      node.addEventListener('pointermove', event => { if (captures.get(node) === event.pointerId && active()) move?.(event); });
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) node.addEventListener(name, event => {
        if (captures.get(node) !== event.pointerId) return;
        captures.delete(node); up?.();
      });
    };
    const player = () => game.player;
    const move = event => {
      const r = pad.getBoundingClientRect(), radius = r.width / 2;
      let x = (event.clientX - r.x - radius) / (radius * .8), y = (event.clientY - r.y - radius) / (radius * .8);
      const length = Math.max(1, Math.hypot(x, y)); x /= length; y /= length;
      knob.style.transform = `translate(${x * radius * .55}px,${y * radius * .55}px)`;
      if (player()) { player().touch.mx = x; player().touch.mz = -y; }
    };
    bind(pad, move, move, () => { knob.style.transform = ''; if (player()) player().touch.mx = player().touch.mz = 0; });
    let lx = 0, ly = 0;
    bind(look, e => { lx = e.clientX; ly = e.clientY; }, e => {
      const p = player(); if (!p) return;
      p.touchLook ||= { x: 0, y: 0 }; p.touchLook.x += (e.clientX - lx) * 1.6; p.touchLook.y += (e.clientY - ly) * 1.6;
      lx = e.clientX; ly = e.clientY;
    });
    const button = (id, text, down, up) => {
      const node = document.createElement('button'); node.id = id; node.className = 'btn'; node.type = 'button'; node.textContent = text;
      root.append(node); bind(node, () => { if (player()) down(player()); }, null, () => { if (player()) up?.(player()); });
    };
    button('cf-fire', '开火', p => { p.touch.fire = p.touch.firePressed = true; }, p => { p.touch.fire = false; });
    button('cf-jump', '跳跃', p => { p.touch.jump = true; });
    button('cf-crouch', '蹲下', p => { p.touch.crouch = !p.touch.crouch; });
    button('cf-reload', '换弹', p => p.pressed.add('KeyR'));
    button('cf-switch', '切枪', p => { p.mouse.wheel = 1; });
    button('cf-scope', '开镜', p => { p.mouse.rp = true; });
    this.reset = () => {
      for (const [node, id] of captures) if (node.hasPointerCapture(id)) node.releasePointerCapture(id);
      captures.clear(); knob.style.transform = '';
      if (player()) Object.assign(player().touch, { mx: 0, mz: 0, fire: false, firePressed: false, jump: false, crouch: false });
    };
    window.addEventListener('resize', () => this.reset());
  }
}
