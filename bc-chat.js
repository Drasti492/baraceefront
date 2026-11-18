/* bc-chat.js (v2) — WhatsApp-style inbox, realtime + auto refresh, last seen, typing, block, photos, view-once, notifications. */
(() => {
  let socket = null, reloadChat = null, replyTo = null, info = null, typingFrom = null, typingTimer = null;
  let TH = [], lastSig = '', listQ = '';

  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const listTime = d => {
    if (!d) return '';
    const t = new Date(d), n = new Date();
    return sameDay(t, n) ? BC.hhmm(t) : sameDay(t, new Date(n - 86400000)) ? 'Yesterday' : t.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };
  const dayLabel = d => {
    const t = new Date(d), n = new Date();
    return sameDay(t, n) ? 'Today' : sameDay(t, new Date(n - 86400000)) ? 'Yesterday' : t.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short', ...(t.getFullYear() !== n.getFullYear() ? { year: 'numeric' } : {}) });
  };
  const status = u => u.online ? '<span class="st on">online</span>' : u.lastSeen ? `<span class="st">${BC.lastSeen(u.lastSeen)}</span>` : '';

  /* ---------- socket ---------- */
  function connect() {
    if (socket || !tok() || typeof io === 'undefined') return;
    socket = io(API_BASE, { auth: { token: tok() } });
    socket.on('message:new', m => {
      if (view !== 'inbox') return m.from !== me.id && toast('New message');
      const other = m.from === me.id ? m.to : m.from;
      refreshList();
      if (chatWith && chatWith.id === other && reloadChat) reloadChat();
    });
    socket.on('message:update', () => { if (view === 'inbox') { refreshList(); reloadChat && reloadChat(); } });
    socket.on('notification:new', n => { updateNotifBadge(); view === 'notifs' ? rNotifs() : toast(n.body); });
    socket.on('presence:update', u => {
      const row = TH.find(t => t.id === u.userId);
      if (row) { if (u.online !== undefined) row.online = u.online; if (u.lastSeen) row.lastSeen = u.lastSeen; if (view === 'inbox') renderList(); }
      if (view === 'inbox' && info && chatWith && u.userId === chatWith.id) {
        if (u.online !== undefined) info.online = u.online;
        if (u.lastSeen) info.lastSeen = u.lastSeen;
        paintStatus();
      }
    });
    socket.on('typing', t => {
      if (!chatWith || t.from !== chatWith.id) return;
      typingFrom = t.typing ? t.from : null;
      clearTimeout(typingTimer);
      if (t.typing) typingTimer = setTimeout(() => { typingFrom = null; paintStatus(); }, 4000);
      paintStatus();
    });
  }
  setInterval(() => {
    if (!tok() && socket) { socket.disconnect(); socket = null; }
    else if (tok() && me) connect();
  }, 2000);

  /* ---------- background auto refresh (works even if the socket drops) ---------- */
  setInterval(() => {
    if (document.hidden || !tok() || !me) return;
    if (view === 'inbox') { refreshList(); reloadChat && reloadChat(false); }
  }, 5000);
  setInterval(() => { if (!document.hidden && tok() && me) updateNotifBadge(); }, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !tok() || !me) return;
    updateNotifBadge();
    if (view === 'inbox') { refreshList(); reloadChat && reloadChat(); } else if (view === 'notifs') rNotifs();
  });
  $('#nav').addEventListener('click', e => { if (e.target.closest('button[data-k="inbox"]')) BC.listFirst = true; }, true);

  function paintStatus() {
    const el = $('#chs'); if (!el || !info) return;
    if (typingFrom) { el.innerHTML = 'typing<span class="tdots"><i></i><i></i><i></i></span>'; el.className = 'ch-s typ'; return; }
    el.className = 'ch-s' + (info.online ? ' on' : '');
    el.textContent = info.online ? 'online' : info.lastSeen ? BC.lastSeen(info.lastSeen) : '';
  }

  /* ---------- chat list (WhatsApp style) ---------- */
  const rowHTML = t => `
    <button class="ib-row ${chatWith && chatWith.id === t.id ? 'on' : ''}" data-id="${t.id}">
      <span class="ib-av">${avatar(t).replace(/data-uid="[^"]*"/, '')}</span>
      <span class="ib-mid">
        <span class="ib-top"><b class="ib-name">${esc(t.username)}${t.verified ? ' <i class="fa-solid fa-circle-check vf"></i>' : ''}</b><time class="${t.unread ? 'new' : ''}">${listTime(t.at)}</time></span>
        <span class="ib-bot"><span class="ib-last">${t.lastMine ? '<i class="fa-solid fa-check"></i> ' : ''}${esc(t.last || 'Start a conversation')}</span>${t.unread ? `<span class="ib-badge">${t.unread}</span>` : ''}</span>
        ${status(t)}
      </span>
    </button>`;
  function renderList() {
    const el = $('#ibl'); if (!el) return;
    const q = listQ.trim().toLowerCase();
    const rows = TH.filter(t => !q || t.username.toLowerCase().includes(q));
    el.innerHTML = rows.map(rowHTML).join('') || `<p class="mute" style="padding:16px">${q ? 'No chats match.' : 'No chats yet. Message someone from the feed, a profile or the Market.'}</p>`;
    el.querySelectorAll('.ib-row').forEach(b => b.onclick = () => {
      const t = TH.find(x => x.id === b.dataset.id);
      chatWith = { id: t.id, username: t.username, type: t.type, avatar: t.avatar };
      rInbox();
    });
  }
  async function refreshList() {
    try {
      const fresh = await api('/threads');
      if (chatWith && !fresh.find(t => t.id === chatWith.id)) fresh.unshift({ ...chatWith });
      TH = fresh; renderList();
    } catch {}
  }

  /* ---------- inbox page ---------- */
  window.rInbox = async function () {
    const mobile = innerWidth <= 700;
    if (BC.listFirst) { if (mobile) chatWith = null; BC.listFirst = false; }
    try { TH = await api('/threads'); } catch { TH = []; }
    if (chatWith && !TH.find(t => t.id === chatWith.id)) TH.unshift({ ...chatWith });
    if (!chatWith && TH.length && !mobile) chatWith = TH[0];
    replyTo = null; reloadChat = null; info = null; typingFrom = null; lastSig = ''; listQ = '';

    $('#main').innerHTML = `
      <div class="v inbox-v"><div class="inbox ${chatWith ? 'has-chat' : ''}">
        <aside class="ib-list">
          <div class="ib-h"><h2>Chats</h2></div>
          <div class="ib-search"><i class="fa-solid fa-magnifying-glass"></i><input id="ibq" placeholder="Search chats" autocomplete="off"></div>
          <div class="ib-rows" id="ibl"></div>
        </aside>
        <section class="ib-chat">${chatWith ? `
          <div class="chat-head">
            <button class="ico ib-back" id="ibb" aria-label="Back to chats"><i class="fa-solid fa-arrow-left"></i></button>
            <span class="ch-who" data-uid="${chatWith.id}">${avatar(chatWith, 'sm')}<span class="ch-t"><b>${esc(chatWith.username)}</b><span class="ch-s" id="chs"></span></span></span>
            <button class="ico sp" id="chm" aria-label="Chat options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
          </div>
          <div class="msgs" id="ms"></div>
          <div id="rb"></div>
          <div class="chat-compose" id="cc">
            <label class="ico attach" aria-label="Send a photo"><i class="fa-regular fa-image"></i><input type="file" id="cf" accept="image/*" hidden></label>
            <input id="mi" placeholder="Type a message" maxlength="2000" autocomplete="off">
            <button class="btn" id="sd" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>
          </div>` : '<div class="ib-empty"><i class="fa-regular fa-comments"></i><p>Select a chat to start messaging</p></div>'}
        </section>
      </div></div>`;
    renderList();
    $('#ibq').oninput = e => { listQ = e.target.value; renderList(); };
    if (!chatWith) return;
    $('#ibb').onclick = () => { chatWith = null; rInbox(); };

    const applyBlock = () => {
      const off = info && (info.iBlocked || info.blockedMe);
      $('#mi').disabled = $('#sd').disabled = !!off;
      $('#cc').classList.toggle('off', !!off);
      $('#mi').placeholder = !info ? 'Type a message' : info.blockedMe ? 'You can’t message this person' : info.iBlocked ? 'You blocked this person' : 'Type a message';
    };
    api(`/chat/${chatWith.id}/info`).then(d => { info = d; paintStatus(); applyBlock(); }).catch(() => {});

    $('#chm').onclick = e => {
      document.querySelector('.ctx-menu')?.remove();
      const r = e.currentTarget.getBoundingClientRect(), m = document.createElement('div');
      m.className = 'ctx-menu';
      m.innerHTML = `<button data-a="p"><i class="fa-regular fa-user"></i> View profile</button><button data-a="b" class="danger"><i class="fa-solid fa-ban"></i> ${info?.iBlocked ? 'Unblock' : 'Block'}</button>`;
      document.body.appendChild(m);
      m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = r.bottom + 4 + 'px';
      setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
      m.onclick = ev => {
        const a = ev.target.closest('button')?.dataset.a;
        if (a === 'p') BC.showUser(chatWith.id);
        if (a === 'b') BC.toggleBlock(chatWith, !!info?.iBlocked, () => rInbox());
      };
    };

    let cache = [];
    const barHTML = () => {
      $('#rb').innerHTML = replyTo ? `<div class="reply-bar"><div><b>Replying to ${replyTo.from === me.id ? 'yourself' : esc(chatWith.username)}</b><span>${esc(BC.clip(replyTo.text || 'Photo', 80))}</span></div><button class="ico" id="rx" aria-label="Cancel reply"><i class="fa-solid fa-xmark"></i></button></div>` : '';
      if (replyTo) $('#rx').onclick = () => { replyTo = null; barHTML(); };
    };
    const bubble = m => {
      const mine = m.from === me.id;
      const q = m.replyTo ? (m.replyTo.unavailable || m.replyTo.deleted ? '<div class="m-quote"><i>Original message unavailable</i></div>'
        : `<div class="m-quote" data-q="${m.replyTo.id}"><b>${m.replyTo.from === me.id ? 'You' : esc(chatWith.username)}</b>${esc(BC.clip(m.replyTo.text, 100))}</div>`) : '';
      const s = m.storyReply ? `<div class="m-story ${m.storyReply.expired ? 'gone' : ''}" data-sid="${m.storyReply.id}" data-exp="${m.storyReply.expired ? 1 : 0}">
        ${m.storyReply.media && !BC.isVid(m.storyReply.media) ? `<img src="${esc(assetUrl(m.storyReply.media))}" alt="">` : '<span class="ph"><i class="fa-regular fa-circle-play"></i></span>'}
        <span>${mine ? 'You replied to their story' : 'Replied to your story'}${m.storyReply.expired ? ' · expired' : ''}</span></div>` : '';
      let body;
      if (m.deleted) body = '<i>Message deleted</i>';
      else if (m.kind === 'image') body = `<img class="m-img" data-src="${esc(assetUrl(m.media))}" src="${esc(assetUrl(m.media))}" alt="Photo">${m.text ? `<div class="m-cap">${esc(m.text)}</div>` : ''}`;
      else if (m.kind === 'once') {
        const label = m.opened ? 'Opened' : mine ? 'Photo · View once' : 'Tap to view';
        body = `<button type="button" class="vo ${m.opened ? 'done' : ''}" data-id="${m.id}" ${mine || m.opened ? 'disabled' : ''}><i class="fa-solid ${m.opened ? 'fa-eye' : 'fa-hourglass-half'}"></i><span>${label}</span></button>${m.text ? `<div class="m-cap">${esc(m.text)}</div>` : ''}`;
      } else body = esc(m.text);
      const tick = mine ? `<i class="fa-solid ${m.readAt ? 'fa-check-double rd' : 'fa-check'}"></i>` : '';
      return `<div class="m-row ${mine ? 'me' : 'them'}" data-id="${m.id}"><div class="m ${m.deleted ? 'gone' : ''}">${s}${q}${body}</div>
        <div class="m-time">${m.hearts ? `<i class="fa-solid fa-heart" style="color:var(--bad)"></i> ${m.hearts} · ` : ''}${BC.hhmm(m.createdAt)} ${tick}</div></div>`;
    };
    const menu = (m, x, y) => {
      document.querySelector('.ctx-menu')?.remove();
      const el = document.createElement('div');
      el.className = 'ctx-menu';
      el.innerHTML = `<button data-a="reply"><i class="fa-solid fa-reply"></i> Reply</button>
        <button data-a="heart"><i class="fa-${m.heartedByMe ? 'solid' : 'regular'} fa-heart"></i> ${m.heartedByMe ? 'Remove like' : 'Like'}</button>
        ${m.kind === 'text' ? '<button data-a="copy"><i class="fa-regular fa-copy"></i> Copy</button>' : ''}
        ${m.from === me.id ? '<button data-a="del" class="danger"><i class="fa-solid fa-trash"></i> Delete</button>' : ''}`;
      document.body.appendChild(el);
      el.style.left = Math.min(x, innerWidth - el.offsetWidth - 8) + 'px'; el.style.top = Math.min(y, innerHeight - el.offsetHeight - 8) + 'px';
      setTimeout(() => document.addEventListener('click', () => el.remove(), { once: true }), 0);
      el.onclick = async e => {
        const a = e.target.closest('button')?.dataset.a; if (!a) return;
        try {
          if (a === 'reply') { replyTo = { id: m.id, from: m.from, text: m.text }; barHTML(); $('#mi').focus(); }
          if (a === 'copy') { await navigator.clipboard?.writeText(m.text); toast('Copied'); }
          if (a === 'heart') { await api(`/messages/${m.id}/heart`, { method: 'PUT' }); load(true); }
          if (a === 'del' && await BC.confirm({ title: 'Delete message?', message: 'It will be removed for everyone in this chat.', confirm: 'Delete', danger: true })) { await api(`/messages/${m.id}`, { method: 'DELETE' }); load(true); }
        } catch (err) { toast(err.message); }
      };
    };

    const load = async force => {
      try {
        const rows = await api('/messages/' + chatWith.id);
        const sig = rows.map(m => [m.id, m.readAt ? 1 : 0, m.hearts, m.opened ? 1 : 0, m.deleted ? 1 : 0].join(':')).join('|');
        if (!force && sig === lastSig) return;
        lastSig = sig; cache = rows;
        const box = $('#ms'); if (!box) return;
        const first = !box.children.length, keep = box.scrollTop;
        const atBottom = first || box.scrollHeight - box.scrollTop - box.clientHeight < 90;
        let day = '';
        box.innerHTML = rows.map(m => {
          const d = new Date(m.createdAt).toDateString(), sep = d !== day ? `<div class="m-day"><span>${dayLabel(m.createdAt)}</span></div>` : '';
          day = d; return sep + bubble(m);
        }).join('') || '<p class="mute" style="text-align:center;margin-top:20px">Say hi</p>';
        box.scrollTop = atBottom ? box.scrollHeight : keep;
        box.querySelectorAll('.m-row').forEach(row => {
          const m = cache.find(x => x.id === row.dataset.id); if (!m || m.deleted) return;
          let t;
          row.oncontextmenu = e => { e.preventDefault(); menu(m, e.clientX, e.clientY); };
          row.ontouchstart = e => { const p = e.touches[0]; t = setTimeout(() => menu(m, p.clientX, p.clientY), 450); };
          row.ontouchend = row.ontouchmove = () => clearTimeout(t);
        });
        box.querySelectorAll('.m-quote[data-q]').forEach(el => el.onclick = () => {
          const t = box.querySelector(`.m-row[data-id="${el.dataset.q}"]`);
          if (t) { t.scrollIntoView({ block: 'center' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1500); }
        });
        box.querySelectorAll('.m-story').forEach(el => el.onclick = () => { if (el.dataset.exp === '1') return toast('This story has expired.'); BC.openStoryById(el.dataset.sid); });
        box.querySelectorAll('.m-img').forEach(el => el.onclick = () => modal(`<img src="${el.dataset.src}" alt="" style="width:100%;border-radius:10px"><button class="btn ghost" style="width:100%;margin-top:10px" onclick="closeModal()">Close</button>`));
        box.querySelectorAll('.vo:not([disabled])').forEach(b => b.onclick = e => { e.stopPropagation(); openOnce(b.dataset.id); });
      } catch (e) { if (force) toast(e.message); }
    };
    reloadChat = f => load(f !== false);

    let typingOn = false, idle;
    const typing = on => { if (socket && typingOn !== on) { typingOn = on; socket.emit('typing', { to: chatWith.id, typing: on }); } };
    $('#mi').oninput = () => { typing(true); clearTimeout(idle); idle = setTimeout(() => typing(false), 2000); };
    const send = async () => {
      const v = $('#mi').value.trim(); if (!v) return;
      $('#sd').disabled = true; typing(false);
      try { await api('/messages/' + chatWith.id, { method: 'POST', body: { text: v, replyTo: replyTo ? replyTo.id : undefined } }); $('#mi').value = ''; replyTo = null; barHTML(); await load(true); refreshList(); }
      catch (e) { toast(e.message); } finally { applyBlock(); }
    };
    $('#sd').onclick = send; $('#mi').onkeydown = e => { if (e.key === 'Enter') send(); };

    $('#cf').onchange = e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      if (f.size > 10 * 1048576) return toast('Photo is larger than 10MB.');
      const url = URL.createObjectURL(f); let once = false;
      modal(`<h2>Send photo</h2><div class="pv-box"><img src="${url}" alt="Preview"></div>
        <input id="pcap" maxlength="200" placeholder="Add a caption (optional)" style="margin-top:10px">
        <button class="once-t" id="onceT" type="button"><i class="fa-solid fa-hourglass-half"></i><span><b>View once</b><small>Opens one time for 10 seconds, then it’s gone</small></span><span class="sw"><input type="checkbox" id="onceC"><span></span></span></button>
        <div class="err" id="er"></div>
        <div class="row" style="margin-top:12px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn sp" id="pgo"><i class="fa-solid fa-paper-plane"></i> Send</button></div>`);
      const sync = () => { once = $('#onceC').checked; $('#onceT').classList.toggle('on', once); };
      $('#onceT').onclick = ev => { if (ev.target.tagName !== 'INPUT') $('#onceC').checked = !$('#onceC').checked; sync(); };
      $('#onceC').onchange = sync;
      $('#pgo').onclick = async () => {
        const fd = new FormData(); fd.append('f', f); fd.append('viewOnce', once ? '1' : '0'); fd.append('text', $('#pcap').value);
        $('#pgo').disabled = true; $('#pgo').textContent = 'Sending…';
        try { await api(`/messages/${chatWith.id}/image`, { method: 'POST', body: fd }); closeModal(); load(true); refreshList(); }
        catch (err) { $('#er').textContent = err.message; $('#pgo').disabled = false; $('#pgo').textContent = 'Send'; }
      };
    };
    if (chatWith.prefill) { $('#mi').value = chatWith.prefill; delete chatWith.prefill; }
    load(true);
  };

  /* ---------- view-once viewer: 10 s, one time, deterrents against capture ---------- */
  async function openOnce(id) {
    let d;
    try { d = await api(`/messages/${id}/view`, { method: 'POST' }); }
    catch (e) { toast(e.message); reloadChat && reloadChat(); return; }
    const sec = d.seconds || 10, o = document.createElement('div');
    o.className = 'vo-view';
    // inline styles so it opens correctly even if a stylesheet is missing
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none';
    const wm = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='230' height='130'><text x='12' y='76' fill='white' fill-opacity='0.17' font-size='18' font-family='sans-serif' transform='rotate(-24 115 65)'>@${me.username} · Bara Cee</text></svg>`);
    o.innerHTML = `
      <div class="vo-top" style="width:100%;max-width:520px;display:flex;justify-content:space-between;align-items:center;color:#fff">
        <div class="vo-clk"><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="16"/><circle class="fg" cx="18" cy="18" r="16"/></svg><span id="vos">${sec}</span></div>
        <button class="ico" id="vox" aria-label="Close" style="color:#fff"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="vo-stage" style="position:relative;max-width:100%;display:grid;place-items:center">
        <img id="voi" alt="" draggable="false" style="max-width:100%;max-height:70dvh;border-radius:10px;pointer-events:none;opacity:0">
        <div class="vo-wm" style="position:absolute;inset:0;pointer-events:none;background-image:url('data:image/svg+xml,${wm}')"></div>
      </div>
      <p class="vo-note" style="color:#ffffffaa;font-size:12px;text-align:center"><i class="fa-solid fa-eye-slash"></i> View once · it closes by itself and can’t be opened again</p>`;
    o.oncontextmenu = e => e.preventDefault();
    o.ondragstart = e => e.preventDefault();
    document.body.appendChild(o);

    let iv = null, ended = false;
    const end = msg => {
      if (ended) return; ended = true;
      clearInterval(iv); o.remove();
      document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', end); document.removeEventListener('keydown', onKey, true);
      if (typeof msg === 'string') toast(msg);
      reloadChat && reloadChat(); refreshList();
    };
    const onVis = () => { if (document.hidden) end(); };
    const onKey = e => {
      const k = e.key;
      if (k === 'PrintScreen' || ((e.metaKey || e.ctrlKey) && (k === 'p' || k === 'P' || k === 's' || k === 'S')) || (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(k)) || (e.shiftKey && e.metaKey && (k === 's' || k === 'S'))) {
        e.preventDefault(); navigator.clipboard?.writeText(' ').catch(() => {}); end('Screenshots are not allowed on view-once photos.');
      }
    };
    document.addEventListener('visibilitychange', onVis); window.addEventListener('blur', end); document.addEventListener('keydown', onKey, true);
    $('#vox').onclick = () => end();

    const img = $('#voi');
    img.onload = () => {
      img.style.opacity = 1;
      const fg = o.querySelector('.fg'); if (fg) fg.style.animation = `voRun ${sec}s linear forwards`;
      const t0 = Date.now();
      iv = setInterval(() => {
        const left = Math.ceil(sec - (Date.now() - t0) / 1000), s = $('#vos');
        if (s) s.textContent = Math.max(left, 0);
        if (left <= 0) end();
      }, 250);
    };
    img.onerror = () => end('Couldn’t load the photo. Check your connection.');
    img.src = assetUrl(d.url);
  }

  /* ---------- notifications (deep links) ---------- */
  const NI = { like: 'fa-heart', comment: 'fa-comment', message: 'fa-message', story_reply: 'fa-circle-play', follow: 'fa-user-plus', system: 'fa-bell' };
  window.rNotifs = async function () {
    $('#main').innerHTML = `<div class="v"><div class="row"><h2 style="margin:0">Notifications</h2><button class="btn ghost sm sp" id="mar">Mark all as read</button></div>
      <div class="card" id="nl" style="margin-top:12px"><p class="mute">Loading…</p></div></div>`;
    $('#mar').onclick = async () => { try { await api('/notifications/read-all', { method: 'PATCH' }); rNotifs(); updateNotifBadge(); } catch (e) { toast(e.message); } };
    try {
      const { notifications } = await api('/notifications');
      $('#nl').innerHTML = notifications.map(n => `<div class="notif-item ${n.readAt ? '' : 'unread'}" data-id="${n.id}">
        <i class="fa-solid ${NI[n.type] || 'fa-bell'} t-student" style="margin-top:3px"></i>
        <div class="notif-body">${esc(n.body)}<div class="mute">${BC.when(n.createdAt)}</div></div>
        <button class="ico nd" aria-label="Delete notification"><i class="fa-solid fa-xmark"></i></button></div>`).join('') || '<p class="mute">You’re all caught up.</p>';
      document.querySelectorAll('.notif-item').forEach(el => {
        const n = notifications.find(x => x.id === el.dataset.id);
        el.querySelector('.nd').onclick = async e => { e.stopPropagation(); try { await api('/notifications/' + n.id, { method: 'DELETE' }); rNotifs(); updateNotifBadge(); } catch (err) { toast(err.message); } };
        el.onclick = () => {
          if (!n.readAt) api(`/notifications/${n.id}/read`, { method: 'PATCH' }).then(updateNotifBadge).catch(() => {});
          if ((n.type === 'message' || n.type === 'story_reply') && n.actor) { chatWith = { id: n.actor.id, username: n.actor.username, type: n.actor.type || 'student', avatar: n.actor.avatar }; go('inbox'); }
          else if (n.type === 'follow' && n.actor) BC.showUser(n.actor.id);
          else if (n.post) { filt = { postId: n.post }; go('home'); }
        };
      });
      updateNotifBadge();
    } catch (e) { $('#nl').innerHTML = `<p class="mute">${esc(e.message)}</p>`; }
  };
})();