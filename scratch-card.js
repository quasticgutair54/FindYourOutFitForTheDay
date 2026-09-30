// ===== SCRATCH-CARD REVEAL + CERTIFICATE + SHARE CARD =====
// On every result page the outfit photo arrives covered in a glitchy foil in
// the path's own colours. Scratch it off with your finger (or mouse) - foil
// flakes fly, it crackles, and once most of it is gone the rest dissolves in a
// burst. The shop button stays locked until you've scratched.
// The "NotTheBest Certified" pill becomes a numbered certificate (same number
// every time on this phone), and "Save my card" makes a 1080x1350 image of
// the result - photo, title, certificate, lie-detector score - to post.
//
// Needs quiz-common.js. Call initScratchCard('allout') etc. after the other
// result-page scripts.

function initScratchCard(pathName) {
  'use strict';
  const frame = document.querySelector('.reveal-photo-frame');
  const img = frame && frame.querySelector('img');
  const cta = document.querySelector('.cta-button');
  const certified = document.querySelector('.certified');
  const titleEl = document.querySelector('.result-box h1');
  if (!frame || !img) return;

  const css = getComputedStyle(document.documentElement);
  const C1 = (css.getPropertyValue('--grad-1') || '#ff2d95').trim();
  const C2 = (css.getPropertyValue('--grad-2') || '#ffe600').trim();
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const buzz = p => { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } };

  // ---------- styles ----------
  if (!document.getElementById('sc-style')) {
    const style = document.createElement('style');
    style.id = 'sc-style';
    style.textContent = `
    .sc-layer { position: absolute; inset: 0; z-index: 10; width: 100%; height: 100%; display: block; cursor: grab;
      touch-action: none; border-radius: inherit; transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), filter 0.7s ease; }
    .sc-layer:active { cursor: grabbing; }
    .sc-layer.gone { opacity: 0; transform: scale(1.15); filter: blur(6px); pointer-events: none; }
    .sc-hand { position: absolute; z-index: 11; left: 30%; top: 55%; font-size: 2.2rem; pointer-events: none;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); animation: sc-swipe 2.2s ease-in-out infinite; }
    @keyframes sc-swipe { 0%, 100% { transform: translate(0, 0) rotate(-10deg); } 50% { transform: translate(70px, -30px) rotate(8deg); } }
    .sc-flake { position: fixed; z-index: 60; width: 6px; height: 4px; pointer-events: none; border-radius: 1px;
      animation: sc-flake 0.9s ease-in forwards; }
    @keyframes sc-flake { to { transform: translate(var(--dx), 90px) rotate(var(--r)); opacity: 0; } }
    .sc-skip { display: block; margin: -1rem auto 1.2rem; position: relative; z-index: 4; background: none; border: none;
      color: #fff; opacity: 0.7; font-size: 0.8rem; text-decoration: underline; cursor: pointer; text-shadow: 0 1px 4px #000; }
    .cta-button.sc-locked { opacity: 0.45; filter: grayscale(0.6); pointer-events: none; }
    .cta-button.sc-unlocked { animation: sc-pulse 1.4s ease 2; }
    @keyframes sc-pulse { 50% { transform: scale(1.08); box-shadow: 0 0 0 10px rgba(255,255,255,0.15), 0 14px 36px rgba(0,0,0,0.4); } }
    .certified small { display: block; font-family: 'Courier New', monospace; font-size: 0.72rem; font-weight: normal; letter-spacing: 0.12em; opacity: 0.75; margin-top: 2px; }
    .certified.sc-stamp { animation: sc-stamp 0.5s cubic-bezier(0.2, 1.6, 0.4, 1); }
    @keyframes sc-stamp { from { transform: scale(2.2) rotate(-8deg); opacity: 0; } }
    .sc-save { display: inline-block; margin: 0.9rem 0 0 0.4rem; padding: 0.9rem 1.4rem; border-radius: 999px; cursor: pointer;
      font: bold 0.95rem inherit; font-family: inherit; color: #fff; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.7); }
    .sc-save[disabled] { opacity: 0.6; }
    `;
    document.head.appendChild(style);
  }

  // ---------- certificate ----------
  const PREFIX = { allout: 'AO', somewhatout: 'SO', maybe: 'MB', never: 'NV', twosides: 'TS' }[pathName] || 'NT';
  let cert = lsGet('ntb-cert-' + pathName, null);
  if (!cert) {
    const b = new Uint8Array(3);
    crypto.getRandomValues(b);
    cert = { no: `NTB-${PREFIX}-${String((b[0] << 16 | b[1] << 8 | b[2]) % 100000).padStart(5, '0')}`, at: Date.now() };
    lsSet('ntb-cert-' + pathName, cert);
  }
  const pctText = certified ? certified.textContent.trim() : 'NotTheBest Certified';
  if (certified) {
    certified.innerHTML = `${pctText}<small>CERTIFICATE ${cert.no}</small>`;
    certified.style.visibility = 'hidden'; // stamped in once the card is scratched
  }

  // ---------- the scratch layer ----------
  const canvas = document.createElement('canvas');
  canvas.className = 'sc-layer';
  canvas.setAttribute('aria-label', 'Scratch to reveal your outfit');
  frame.appendChild(canvas);
  const hand = document.createElement('div');
  hand.className = 'sc-hand';
  hand.textContent = '👆';
  frame.appendChild(hand);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let W = 0, H = 0, dpr = 1, revealed = false;

  const skip = document.createElement('button');
  skip.className = 'sc-skip';
  skip.type = 'button';
  skip.textContent = "Can't scratch? Reveal it";
  frame.after(skip);
  skip.addEventListener('click', () => finish());

  if (cta) {
    cta.classList.add('sc-locked');
    cta.dataset.text = cta.textContent;
    cta.textContent = 'Scratch the card first';
  }

  function paintFoil() {
    const r = frame.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    // metallic base in the path's colours
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#d9d9d9'); g.addColorStop(0.25, C1); g.addColorStop(0.5, '#f5f5f5'); g.addColorStop(0.75, C2); g.addColorStop(1, '#9a9a9a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // brushed-metal grain
    for (let i = 0; i < W * H / 40; i++) {
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 14 + 2, 1);
    }
    // glitch bands
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(0,255,240,0.18)' : 'rgba(255,0,170,0.18)';
      ctx.fillRect(0, Math.random() * H, W, Math.random() * 8 + 2);
    }
    // repeating NTB pattern
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.font = 'bold 13px "Courier New", monospace';
    for (let y = -H; y < H; y += 26) {
      for (let x = -W; x < W; x += 58) ctx.fillText('NTB', x + (y / 26 % 2 ? 29 : 0), y);
    }
    ctx.restore();
    // label
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    const bw = Math.min(W - 30, 230), bh = 74;
    roundRect(ctx, (W - bw) / 2, H / 2 - bh / 2, bw, bh, 14);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 22px Impact, "Arial Black", sans-serif';
    ctx.fillText('SCRATCH ME', W / 2, H / 2 - 10);
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('your outfit is under here', W / 2, H / 2 + 16);
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  const ready = () => { if (!revealed) paintFoil(); };
  if (img.complete && img.naturalWidth) ready(); else img.addEventListener('load', ready, { once: true });
  // the frame animates in with a scale; repaint once it has settled
  setTimeout(ready, 1300);
  let resizeT = null;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (!revealed && !scratchedAny) paintFoil(); }, 200); });

  // ---------- scratching ----------
  let last = null, scratchedAny = false, moves = 0;
  const BRUSH = 22;
  let ac = null;
  function crackle() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const len = 0.05, buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
      f.type = 'highpass'; f.frequency.value = 2500; gn.gain.value = 0.05;
      src.buffer = buf; src.connect(f).connect(gn).connect(ac.destination); src.start();
    } catch (e) {}
  }
  function flake(x, y) {
    const f = document.createElement('div');
    f.className = 'sc-flake';
    f.style.left = x + 'px'; f.style.top = y + 'px';
    f.style.background = [C1, C2, '#e6e6e6'][Math.floor(Math.random() * 3)];
    f.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px');
    f.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 950);
  }
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)];
  }
  function scratch(e) {
    const [x, y] = local(e);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = BRUSH * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (last) { ctx.moveTo(last[0], last[1]); ctx.lineTo(x, y); ctx.stroke(); }
    else { ctx.arc(x, y, BRUSH, 0, Math.PI * 2); ctx.fill(); }
    last = [x, y];
    if (!scratchedAny) { scratchedAny = true; hand.remove(); }
    if (++moves % 3 === 0) { crackle(); flake(e.clientX, e.clientY); }
    if (moves % 12 === 0) { buzz(8); checkProgress(); }
  }
  function checkProgress() {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0, total = 0;
    const step = 4 * 12; // sample every 12th pixel
    for (let i = 3; i < data.length; i += step) { total++; if (data[i] < 40) clear++; }
    if (total && clear / total > 0.55) finish();
  }
  canvas.addEventListener('pointerdown', e => { e.stopPropagation(); canvas.setPointerCapture(e.pointerId); last = null; scratch(e); });
  canvas.addEventListener('pointermove', e => { e.stopPropagation(); if (e.buttons || e.pointerType === 'touch') { if (canvas.hasPointerCapture(e.pointerId)) scratch(e); } });
  const up = e => { e.stopPropagation(); last = null; checkProgress(); };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  function finish(quiet) {
    if (revealed) return;
    revealed = true;
    canvas.classList.add('gone');
    hand.remove();
    skip.remove();
    setTimeout(() => canvas.remove(), 750);
    if (!quiet) { buzz([30, 40, 90]); if (typeof launchConfetti === 'function') launchConfetti(18); }
    if (certified) {
      certified.style.visibility = '';
      if (!quiet) certified.classList.add('sc-stamp');
    }
    if (cta) {
      cta.classList.remove('sc-locked');
      cta.textContent = cta.dataset.text || 'Reveal your outfit';
      if (!quiet) cta.classList.add('sc-unlocked');
    }
    lsSet('ntb-scratched-' + pathName, true);
    addSaveButton();
  }

  // ---------- share card ----------
  function addSaveButton() {
    if (!cta || document.querySelector('.sc-save')) return;
    const b = document.createElement('button');
    b.className = 'sc-save';
    b.type = 'button';
    b.textContent = '📸 Save my card';
    cta.after(b);
    b.addEventListener('click', async () => {
      b.disabled = true;
      b.textContent = 'Making it…';
      try {
        const blob = await makeCard();
        const file = new File([blob], `notthebest-${pathName}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'My NotTheBest outfit' }).catch(() => {});
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }
        b.textContent = '📸 Saved';
      } catch (e) {
        b.textContent = 'Could not save. Screenshot instead?';
      }
      setTimeout(() => { b.disabled = false; b.textContent = '📸 Save my card'; }, 2500);
    });
  }

  function wrap(c, text, x, y, maxW, lh) {
    const words = text.split(/\s+/);
    let line = '', lines = [];
    words.forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    lines.forEach((l, i) => c.fillText(l, x, y + i * lh));
    return lines.length * lh;
  }

  function makeCard() {
    return new Promise((resolve, reject) => {
      const cw = 1080, ch = 1350;
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const x = c.getContext('2d');
      // background
      const bg = x.createLinearGradient(0, 0, cw, ch);
      bg.addColorStop(0, '#0b0b10'); bg.addColorStop(1, '#1b1b26');
      x.fillStyle = bg; x.fillRect(0, 0, cw, ch);
      try {
        const glow = x.createRadialGradient(cw / 2, 420, 50, cw / 2, 420, 700);
        glow.addColorStop(0, C1); glow.addColorStop(1, 'transparent');
        x.globalAlpha = 0.35; x.fillStyle = glow; x.fillRect(0, 0, cw, ch); x.globalAlpha = 1;
      } catch (e) { x.globalAlpha = 1; }
      // photo, cover-fit in a rounded card, with the path's duotone
      const pw = 620, ph = 720, px = (cw - pw) / 2, py = 90;
      x.save();
      roundRect(x, px, py, pw, ph, 36);
      x.clip();
      const s = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
      const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
      x.drawImage(img, px + (pw - iw) / 2, py + (ph - ih) / 2, iw, ih);
      x.globalCompositeOperation = 'color';
      const tint = x.createLinearGradient(px, py, px + pw, py + ph);
      tint.addColorStop(0, C1); tint.addColorStop(1, C2);
      x.fillStyle = tint; x.fillRect(px, py, pw, ph);
      x.restore();
      x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 6;
      roundRect(x, px, py, pw, ph, 36); x.stroke();
      // title
      x.fillStyle = '#fff';
      x.textAlign = 'center';
      x.font = '900 64px "Arial Black", Impact, sans-serif';
      const used = wrap(x, (titleEl ? titleEl.textContent : '').trim(), cw / 2, py + ph + 100, 920, 72);
      // certificate pill
      let yy = py + ph + 100 + used + 30;
      const certLine = `${pctText}  ·  ${cert.no}`;
      x.font = 'bold 34px "Courier New", monospace';
      const tw = x.measureText(certLine).width + 60;
      x.fillStyle = '#fff';
      roundRect(x, (cw - tw) / 2, yy - 44, tw, 64, 32); x.fill();
      x.fillStyle = '#111';
      x.fillText(certLine, cw / 2, yy);
      // lie detector score, if they took it
      let honesty = null;
      try { honesty = (JSON.parse(localStorage.getItem('ntb-dossier')) || {}).quiz; } catch (e) {}
      if (honesty && honesty.path === pathName && honesty.honesty !== undefined) {
        x.fillStyle = 'rgba(255,255,255,0.8)';
        x.font = '30px "Courier New", monospace';
        x.fillText(`Lie detector: ${honesty.honesty}% honest`, cw / 2, yy + 70);
      }
      // wordmark
      x.fillStyle = 'rgba(255,255,255,0.9)';
      x.font = '900 46px "Arial Black", Impact, sans-serif';
      x.fillText('N O T   T H E   B E S T', cw / 2, ch - 130);
      // footer
      x.fillStyle = 'rgba(255,255,255,0.6)';
      x.font = 'bold 28px "Courier New", monospace';
      x.fillText(`${location.host || 'notthebest.in'} · find your outfit`, cw / 2, ch - 50);
      c.toBlob(b => b ? resolve(b) : reject(new Error('no blob')), 'image/png');
    });
  }

  // Already scratched this path on this phone? Don't make them do it again.
  if (lsGet('ntb-scratched-' + pathName, false)) {
    const t = () => { finish(true); canvas.remove(); };
    if (img.complete) t(); else img.addEventListener('load', t, { once: true });
  }
}
