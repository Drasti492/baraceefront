/* bc-core.js — shared helpers. Load right after app.js. */
window.BC = window.BC || {};
(() => {
  /* ---------- time ---------- */
  BC.when = d => {
    const t = new Date(d), s = (Date.now() - t) / 1000;
    if (s < 60) return 'now';
    if (s < 3600) return ~~(s / 60) + 'm';
    if (s < 86400) return ~~(s / 3600) + 'h';
    return t.toLocaleDateString([], { month: 'short', day: 'numeric', ...(t.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
  };
  BC.hhmm = d => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  BC.lastSeen = d => {
    const t = new Date(d), now = new Date();
    const day = t.toDateString() === now.toDateString() ? 'today at ' :
      t.toDateString() === new Date(now - 86400000).toDateString() ? 'yesterday at ' :
      t.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ';
    return 'last seen ' + day + BC.hhmm(t);
  };
  BC.clip = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
  BC.isVid = u => /\.(mp4|webm|mov)$/i.test(u || '');

  /* ---------- branded confirm dialog (replaces browser confirm) ---------- */
  BC.confirm = ({ title = 'Are you sure?', message = '', confirm = 'Confirm', cancel = 'Cancel', danger = false, icon } = {}) =>
    new Promise(res => {
      const o = document.createElement('div');
      o.className = 'dlg';
      o.innerHTML = `
        <div class="dlg-box" role="alertdialog" aria-modal="true">
          <div class="dlg-ic ${danger ? 'danger' : ''}"><i class="fa-solid ${icon || (danger ? 'fa-trash' : 'fa-circle-question')}"></i></div>
          <h3>${esc(title)}</h3><p>${esc(message)}</p>
          <div class="dlg-btns">
            <button class="btn ghost" data-r="0">${esc(cancel)}</button>
            <button class="btn ${danger ? 'danger' : ''}" data-r="1">${esc(confirm)}</button>
          </div>
        </div>`;
      const key = e => { if (e.key === 'Escape') done(false); };
      const done = v => { o.remove(); document.removeEventListener('keydown', key); res(v); };
      o.onclick = e => {
        if (e.target === o) return done(false);
        const b = e.target.closest('[data-r]');
        if (b) done(b.dataset.r === '1');
      };
      document.addEventListener('keydown', key);
      document.body.appendChild(o);
      o.querySelector('[data-r="1"]').focus();
    });

  /* ---------- swipe carousel (photos / videos) ---------- */
  BC.carousel = (media = []) => {
    if (!media.length) return '';
    const n = media.length;
    return `
      <div class="car">
        <div class="car-track">${media.map(m => `
          <div class="car-slide">${m.kind === 'video'
            ? `<video controls playsinline preload="metadata" src="${esc(assetUrl(m.url))}"></video>`
            : `<img loading="lazy" src="${esc(assetUrl(m.url))}" alt="">`}</div>`).join('')}
        </div>
        ${n > 1 ? `<span class="car-n">1/${n}</span>
          <button class="car-b l" aria-label="Previous"><i class="fa-solid fa-chevron-left"></i></button>
          <button class="car-b r" aria-label="Next"><i class="fa-solid fa-chevron-right"></i></button>
          <div class="car-dots">${media.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
      </div>`;
  };
  BC.bindCarousels = root => root.querySelectorAll('.car').forEach(c => {
    const t = c.querySelector('.car-track'), dots = [...c.querySelectorAll('.car-dots i')], n = c.querySelector('.car-n');
    if (!dots.length) return;
    t.addEventListener('scroll', () => {
      const i = Math.round(t.scrollLeft / t.clientWidth);
      dots.forEach((d, j) => d.classList.toggle('on', j === i));
      if (n) n.textContent = `${i + 1}/${dots.length}`;
    }, { passive: true });
    c.querySelector('.car-b.l').onclick = () => t.scrollBy({ left: -t.clientWidth, behavior: 'smooth' });
    c.querySelector('.car-b.r').onclick = () => t.scrollBy({ left: t.clientWidth, behavior: 'smooth' });
  });

  /* ---------- photo cropper (pan + zoom + ratio) ---------- */
  BC.cropImage = file => new Promise(resolve => {
    if (file.type === 'image/gif') return resolve(file);
    const url = URL.createObjectURL(file), img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that image.'); resolve(null); };
    img.onload = () => {
      const ASP = [['1:1', 1], ['4:5', 0.8], ['16:9', 16 / 9], ['Original', 0]];
      let ar = 1, zoom = 1, ox = 0, oy = 0, fw = 0, fh = 0, sc = 1;
      const o = document.createElement('div');
      o.className = 'dlg';
      o.innerHTML = `
        <div class="dlg-box crop">
          <h3>Crop photo</h3>
          <div class="crop-frame"><canvas id="cc"></canvas></div>
          <div class="crop-asp">${ASP.map((a, i) => `<button class="chip ${i ? '' : 'on'}" data-i="${i}">${a[0]}</button>`).join('')}</div>
          <label class="mute" style="display:flex;gap:10px;align-items:center;margin-top:10px"><i class="fa-solid fa-magnifying-glass-minus"></i>
            <input type="range" id="cz" min="1" max="3" step="0.01" value="1" aria-label="Zoom"><i class="fa-solid fa-magnifying-glass-plus"></i></label>
          <div class="dlg-btns"><button class="btn ghost" data-r="0">Cancel</button><button class="btn" data-r="1">Use photo</button></div>
        </div>`;
      document.body.appendChild(o);
      const cv = o.querySelector('#cc'), ctx = cv.getContext('2d');
      const clamp = () => {
        ox = Math.min(0, Math.max(fw - img.width * sc, ox));
        oy = Math.min(0, Math.max(fh - img.height * sc, oy));
      };
      const draw = () => { clamp(); ctx.clearRect(0, 0, fw, fh); ctx.drawImage(img, ox, oy, img.width * sc, img.height * sc); };
      const layout = () => {
        const a = ar || img.width / img.height, W = Math.min(340, innerWidth - 72), maxH = innerHeight * 0.48;
        fw = W; fh = W / a;
        if (fh > maxH) { fh = maxH; fw = fh * a; }
        cv.width = fw; cv.height = fh;
        const min = Math.max(fw / img.width, fh / img.height);
        sc = min * zoom;
        ox = (fw - img.width * sc) / 2; oy = (fh - img.height * sc) / 2;
        draw();
      };
      layout();
      o.querySelector('#cz').oninput = e => {
        const cx = (fw / 2 - ox) / sc, cy = (fh / 2 - oy) / sc;       // keep centre fixed
        zoom = +e.target.value;
        sc = Math.max(fw / img.width, fh / img.height) * zoom;
        ox = fw / 2 - cx * sc; oy = fh / 2 - cy * sc; draw();
      };
      o.querySelectorAll('.chip').forEach(b => b.onclick = () => {
        o.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
        ar = ASP[+b.dataset.i][1]; zoom = 1; o.querySelector('#cz').value = 1; layout();
      });
      let drag = null;
      cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, ox, oy }; cv.setPointerCapture(e.pointerId); };
      cv.onpointermove = e => { if (!drag) return; ox = drag.ox + e.clientX - drag.x; oy = drag.oy + e.clientY - drag.y; draw(); };
      cv.onpointerup = () => { drag = null; };
      const done = async ok => {
        o.remove(); URL.revokeObjectURL(url);
        if (!ok) return resolve(null);
        const f = Math.min(1080 / fw, 3), out = document.createElement('canvas');
        out.width = Math.round(fw * f); out.height = Math.round(fh * f);
        out.getContext('2d').drawImage(img, ox * f, oy * f, img.width * sc * f, img.height * sc * f);
        let blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.9));
        if (blob.size > 10 * 1048576) blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.7));
        resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      };
      o.onclick = e => { const b = e.target.closest('[data-r]'); if (b) done(b.dataset.r === '1'); };
    };
    img.src = url;
  });

  /* ---------- video trim (max 15 s) ---------- */
  BC.trimVideo = async file => {
    const url = URL.createObjectURL(file);
    const dur = await new Promise(r => {
      const v = document.createElement('video');
      v.preload = 'metadata'; v.onloadedmetadata = () => r(v.duration); v.onerror = () => r(NaN); v.src = url;
    });
    if (!isFinite(dur)) { toast('Could not read that video.'); return null; }
    if (dur <= 15.2) return file;
    return new Promise(resolve => {
      let start = 0;
      const o = document.createElement('div');
      o.className = 'dlg';
      o.innerHTML = `
        <div class="dlg-box crop">
          <h3>Trim video</h3>
          <p>Videos can be 15 seconds long. Choose where your clip starts.</p>
          <video id="tv" src="${url}" controls playsinline style="width:100%;border-radius:10px;max-height:38dvh;background:#000"></video>
          <label class="mute" style="display:block;margin-top:10px">Starts at <b id="ts">0:00</b> · ends at <b id="te">0:15</b></label>
          <input type="range" id="tr" min="0" max="${(dur - 15).toFixed(1)}" step="0.1" value="0" aria-label="Clip start">
          <div class="dlg-btns"><button class="btn ghost" data-r="0">Cancel</button><button class="btn" data-r="1" id="tu">Use this clip</button></div>
        </div>`;
      document.body.appendChild(o);
      const v = o.querySelector('#tv'), fmt = s => `${~~(s / 60)}:${String(~~(s % 60)).padStart(2, '0')}`;
      o.querySelector('#tr').oninput = e => {
        start = +e.target.value; v.currentTime = start;
        o.querySelector('#ts').textContent = fmt(start); o.querySelector('#te').textContent = fmt(start + 15);
      };
      v.ontimeupdate = () => { if (v.currentTime >= start + 15) { v.pause(); v.currentTime = start; } };
      const finish = f => { o.remove(); URL.revokeObjectURL(url); resolve(f); };
      o.onclick = async e => {
        const b = e.target.closest('[data-r]');
        if (!b) return;
        if (b.dataset.r === '0') return finish(null);
        const cap = HTMLVideoElement.prototype.captureStream || HTMLVideoElement.prototype.mozCaptureStream;
        if (!cap || !window.MediaRecorder) { toast("Your browser can't trim videos. Pick a clip of 15 seconds or less."); return finish(null); }
        const btn = o.querySelector('#tu'); btn.disabled = true; btn.textContent = 'Trimming… keep this open';
        v.pause();
        const rv = document.createElement('video');
        rv.src = url; rv.playsInline = true;
        await new Promise(r => { rv.onloadedmetadata = r; });
        rv.currentTime = start;
        await new Promise(r => { rv.onseeked = r; });
        const mime = ['video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
        const rec = new MediaRecorder(cap.call(rv), mime ? { mimeType: mime, videoBitsPerSecond: 2000000 } : {});
        const chunks = [];
        rec.ondataavailable = ev => ev.data.size && chunks.push(ev.data);
        rec.onstop = () => { rv.pause(); finish(new File([new Blob(chunks, { type: 'video/webm' })], 'clip.webm', { type: 'video/webm' })); };
        try { await rv.play(); } catch { toast('Could not start trimming.'); return finish(null); }
        rec.start(250);
        setTimeout(() => rec.state !== 'inactive' && rec.stop(), 15000);
      };
    });
  };

  /* ---------- profile click anywhere (avatar / name with data-uid) ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-uid]');
    if (!t || !t.dataset.uid || e.target.closest('.th, .ctx-menu, input, textarea, select')) return;
    e.preventDefault();
    BC.showUser && BC.showUser(t.dataset.uid);
  });

  /* ---------- live username check on signup ---------- */
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.id !== 'username') return;
    let hint = $('#unameHint');
    if (!hint) { hint = document.createElement('div'); hint.id = 'unameHint'; hint.className = 'mute'; el.after(hint); }
    clearTimeout(el._t);
    const v = el.value.trim().toLowerCase();
    if (!v) { hint.textContent = ''; return; }
    el._t = setTimeout(async () => {
      try {
        const d = await fetch(API_BASE + '/api/users/check-username?u=' + encodeURIComponent(v)).then(r => r.json());
        if (el.value.trim().toLowerCase() !== v) return;
        hint.textContent = d.available ? 'Username is available' : (d.reason || 'Not available');
        hint.style.color = d.available ? 'var(--ok)' : 'var(--bad)';
      } catch {}
    }, 350);
  });

  /* ---------- signup tweaks: 6-char password + Back button on code screen ---------- */
  const baseSignup = window.signupStep;
  window.signupStep = function (n) {
    baseSignup(n);
    if (n !== 1) return;
    document.querySelectorAll('#sheet label').forEach(l => { if (/^Password/.test(l.textContent.trim())) l.textContent = 'Password (6+ characters)'; });
    $('#nx').onclick = () => {
      ['username', 'email', 'password'].forEach(i => { S[i] = $('#' + i).value.trim(); });
      if (!/^[a-z0-9_.]{3,20}$/i.test(S.username) || !/^\S+@\S+\.\S+$/.test(S.email) || S.password.length < 6)
        return $('#er').textContent = 'Check your username, email and a password of at least 6 characters.';
      signupStep(2);
    };
  };
  new MutationObserver(() => {
    const r = $('#resendBtn');
    if (r && !$('#vbBack')) {
      r.insertAdjacentHTML('afterend', '<button class="btn ghost" id="vbBack" style="width:100%;margin-top:8px"><i class="fa-solid fa-arrow-left"></i> Back</button>');
      $('#vbBack').onclick = () => signupStep(1);
    }
  }).observe($('#sheet'), { childList: true });

  /* ---------- login: username OR email, forgot password ---------- */
  const baseLogin = window.loginForm;
  window.loginForm = function () {
    baseLogin();
    const l = $('#sheet label'); if (l) l.textContent = 'Username or email';
    const p = document.createElement('p');
    p.className = 'mute'; p.style.marginTop = '6px';
    p.innerHTML = '<a href="#" class="lk2" id="fpw">Forgot password?</a>';
    $('#sheet').appendChild(p);
    $('#fpw').onclick = e => { e.preventDefault(); forgot(); };
  };
  function forgot() {
    modal(`
      <h2>Reset your password</h2>
      <p class="mute">We'll email you a 6-digit code. You can request up to 3 codes per day.</p>
      <label>Email</label><input id="fe" type="email" autocomplete="email">
      <div class="err" id="er"></div>
      <div class="row" style="margin-top:14px"><button class="btn ghost" id="fb">Back</button><button class="btn sp" id="fs">Send code</button></div>`);
    $('#fb').onclick = loginForm;
    $('#fs').onclick = async () => {
      const email = $('#fe').value.trim();
      $('#fs').disabled = true;
      try {
        await api('/auth/forgot-password', { method: 'POST', body: { email } });
        modal(`
          <h2>Enter your code</h2>
          <p class="mute">If that email is registered, we sent a 6-digit code. It expires in 10 minutes.</p>
          <label>Code</label><input id="fc" maxlength="6" inputmode="numeric" placeholder="000000">
          <label>New password (6+ characters)</label><input id="fp" type="password" autocomplete="new-password">
          <div class="err" id="er"></div>
          <button class="btn" id="fr" style="width:100%;margin-top:14px">Reset password</button>
          <button class="btn ghost" id="fb2" style="width:100%;margin-top:8px"><i class="fa-solid fa-arrow-left"></i> Back</button>`);
        $('#fc').oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); };
        $('#fb2').onclick = forgot;
        $('#fr').onclick = async () => {
          try {
            await api('/auth/reset-password', { method: 'POST', body: { email, code: $('#fc').value, password: $('#fp').value } });
            toast('Password updated. Please log in.'); loginForm();
          } catch (e) { $('#er').textContent = e.message; }
        };
      } catch (e) { $('#er').textContent = e.message; $('#fs').disabled = false; }
    };
  }
})();