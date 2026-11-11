/* bc-chat.js — realtime socket, inbox (last seen, typing, block, photos, view-once), notifications. */
(() => {
  let socket = null, reloadChat = null, replyTo = null, info = null, typingFrom = null, typingTimer = null;
  const isId = x => /^[a-f0-9]{24}$/i.test(String(x || ''));

  /* ---------- socket ---------- */
  function connect() {
    if (socket || !tok() || typeof io === 'undefined') return;
    socket = io(API_BASE, { auth: { token: tok() } });
    socket.on('message:new', m => {
      const other = m.from === me.id ? m.to : m.from;
      if (view === 'inbox') { chatWith && chatWith.id === other && reloadChat ? reloadChat() : rInbox(); }
      else if (m.from !== me.id) toast('New message');
    });
    socket.on('message:update', () => { if (view === 'inbox' && reloadChat) reloadChat(); });
    socket.on('notification:new', n => { updateNotifBadge(); view === 'notifs' ? rNotifs() : toast(n.body); });
    socket.on('presence:update', u => {
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

  function paintStatus() {
    const el = $('#chs'); if (!el || !info) return;
    if (typingFrom) { el.innerHTML = 'typing<span class="tdots"><i></i><i></i><i></i></span>'; el.className = 'ch-s typ'; return; }
    el.className = 'ch-s' + (info.online ? ' on' : '');
    el.textContent = info.online ? 'Online' : info.lastSeen ? BC.lastSeen(info.lastSeen) : '';
  }

  /* ---------- inbox ---------- */
  window.rInbox = async function () {
    let th = [];
    try { th = await api('/threads'); } catch {}
    if (chatWith && !th.find(t => t.id === chatWith.id)) th.unshift(chatWith);
    if (!chatWith && th.length) chatWith = th[0];
    replyTo = null; reloadChat = null; info = null; typingFrom = null;

    $('#main').innerHTML = `
      <div class="v"><h2>Inbox</h2>
        <div class="chat-wrap">
          <div class="threads">${th.map(t => `
            <button class="th ${chatWith?.id === t.id ? 'on' : ''}" data-id="${t.id}">
              ${avatar(t, 'sm')}
              <span class="th-txt"><b>${esc(t.username)}</b><small>${esc(t.last || '')}</small></span>
              ${t.unread ? `<span class="nav-badge">${t.unread}</span>` : ''}
            </button>`).join('') || '<p class="mute" style="padding:12px">No chats yet. Message someone from the feed, a profile or the Market.</p>'}
          </div>
          <div class="chat-pane">${chatWith ? `
            <div class="chat-head">
              <span data-uid="${chatWith.id}" class="ch-who">${avatar(chatWith, 'sm')}<span class="ch-t"><b>${esc(chatWith.username)}</b><span class="ch-s" id="chs"></span></span></span>
              <button class="ico sp" id="chm" aria-label="Chat options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            </div>
            <div class="msgs" id="ms"></div>
            <div id="rb"></div>
            <div class="chat-compose" id="cc">
              <label class="ico attach" aria-label="Send a photo"><i class="fa-regular fa-image"></i><input type="file" id="cf" accept="image/*" hidden></label>
              <input id="mi" placeholder="Type a message" maxlength="2000" autocomplete="off">
              <button class="btn" id="sd" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>
            </div>` : '<p class="mute" style="padding:16px">Pick a chat.</p>'}
          </div>
        </div>
      </div>`;
    document.querySelectorAll('.th').forEach(b => b.onclick = () => { chatWith = th.find(t => t.id === b.dataset.id); rInbox(); });
    if (!chatWith) return;

    /* header info + block state */
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
      m.innerHTML = `<button data-a="p"><i class="fa-regular fa-user"></i> View profile</button>
        <button data-a="b" class="danger"><i class="fa-solid fa-ban"></i> ${info?.iBlocked ? 'Unblock' : 'Block'}</button>`;
      document.body.appendChild(m);
      m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
      m.style.top = r.bottom + 4 + 'px';
      setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
      m.onclick = ev => {
        const a = ev.target.closest('button')?.dataset.a;
        if (a === 'p') BC.showUser(chatWith.id);
        if (a === 'b') BC.toggleBlock(chatWith, !!info?.iBlocked, () => rInbox());
      };
    };

    /* messages */
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
        body = `<button class="vo ${m.opened ? 'done' : ''}" data-id="${m.id}" ${mine || m.opened ? 'disabled' : ''}><i class="fa-solid ${m.opened ? 'fa-eye' : 'fa-hourglass-half'}"></i><span>${label}</span></button>${m.text ? `<div class="m-cap">${esc(m.text)}</div>` : ''}`;
      } else body = esc(m.text);
      return `<div class="m-row ${mine ? 'me' : 'them'}" data-id="${m.id}"><div class="m ${m.deleted ? 'gone' : ''}">${s}${q}${body}</div>
        <div class="m-time">${BC.hhmm(m.createdAt)}${mine && m.readAt ? ' · Seen' : ''}${m.hearts ? ` · <i class="fa-solid fa-heart" style="color:var(--bad)"></i> ${m.hearts}` : ''}</div></div>`;
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
          if (a === 'heart') { await api(`/messages/${m.id}/heart`, { method: 'PUT' }); load(); }
          if (a === 'del' && await BC.confirm({ title: 'Delete message?', message: 'It will be removed for everyone in this chat.', confirm: 'Delete', danger: true })) { await api(`/messages/${m.id}`, { method: 'DELETE' }); load(); }
        } catch (err) { toast(err.message); }
      };
    };
    const load = async () => {
      try {
        cache = await api('/messages/' + chatWith.id);
        const box = $('#ms'); if (!box) return;
        box.innerHTML = cache.map(bubble).join('') || '<p class="mute">Say hi</p>';
        box.scrollTop = 1e9;
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
        box.querySelectorAll('.m-story').forEach(el => el.onclick = () => {
          if (el.dataset.exp === '1') return toast('This story has expired.');
          BC.openStoryById(el.dataset.sid);
        });
        box.querySelectorAll('.m-img').forEach(el => el.onclick = () => modal(`<img src="${el.dataset.src}" alt="" style="width:100%;border-radius:10px"><button class="btn ghost" style="width:100%;margin-top:10px" onclick="closeModal()">Close</button>`));
        box.querySelectorAll('.vo:not([disabled])').forEach(b => b.onclick = () => openOnce(b.dataset.id));
      } catch (e) { toast(e.message); }
    };
    reloadChat = load;

    /* send text + typing indicator */
    let typingOn = false, idle;
    const typing = on => { if (socket && typingOn !== on) { typingOn = on; socket.emit('typing', { to: chatWith.id, typing: on }); } };
    $('#mi').oninput = () => { typing(true); clearTimeout(idle); idle = setTimeout(() => typing(false), 2000); };
    const send = async () => {
      const v = $('#mi').value.trim(); if (!v) return;
      $('#sd').disabled = true; typing(false);
      try { await api('/messages/' + chatWith.id, { method: 'POST', body: { text: v, replyTo: replyTo ? replyTo.id : undefined } }); $('#mi').value = ''; replyTo = null; barHTML(); await load(); }
      catch (e) { toast(e.message); } finally { applyBlock(); }
    };
    $('#sd').onclick = send; $('#mi').onkeydown = e => { if (e.key === 'Enter') send(); };

    /* photo: preview + view-once */
    $('#cf').onchange = e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      if (f.size > 10 * 1048576) return toast('Photo is larger than 10MB.');
      const url = URL.createObjectURL(f); let once = false;
      modal(`<h2>Send photo</h2><div class="pv-box"><img src="${url}" alt="Preview"></div>
        <input id="pcap" maxlength="200" placeholder="Add a caption (optional)" style="margin-top:10px">
        <button class="once-t" id="onceT" type="button"><i class="fa-solid fa-hourglass-half"></i><span><b>View once</b><small>Disappears 10 seconds after it’s opened</small></span><span class="sw"><input type="checkbox" id="onceC"><span></span></span></button>
        <div class="err" id="er"></div>
        <div class="row" style="margin-top:12px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn sp" id="pgo"><i class="fa-solid fa-paper-plane"></i> Send</button></div>`);
      $('#onceT').onclick = ev => { if (ev.target.tagName !== 'INPUT') $('#onceC').checked = !$('#onceC').checked; once = $('#onceC').checked; $('#onceT').classList.toggle('on', once); };
      $('#onceC').onchange = () => { once = $('#onceC').checked; $('#onceT').classList.toggle('on', once); };
      $('#pgo').onclick = async () => {
        const fd = new FormData(); fd.append('f', f); fd.append('viewOnce', once ? '1' : '0'); fd.append('text', $('#pcap').value);
        $('#pgo').disabled = true; $('#pgo').textContent = 'Sending…';
        try { await api(`/messages/${chatWith.id}/image`, { method: 'POST', body: fd }); closeModal(); load(); }
        catch (err) { $('#er').textContent = err.message; $('#pgo').disabled = false; $('#pgo').textContent = 'Send'; }
      };
    };

    if (chatWith.prefill) { $('#mi').value = chatWith.prefill; delete chatWith.prefill; }
    load();
  };

  /* ---------- view-once viewer (10s animated clock) ---------- */
  async function openOnce(id) {
    try {
      const d = await api(`/messages/${id}/view`, { method: 'POST' });
      const sec = d.seconds || 10, o = document.createElement('div');
      o.className = 'vo-view';
      o.innerHTML = `<div class="vo-top"><div class="vo-clk"><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="16"/><circle class="fg" cx="18" cy="18" r="16" style="animation-duration:${sec}s"/></svg><span id="vos">${sec}</span></div>
        <button class="ico" id="vox" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>
        <img src="${esc(assetUrl(d.url))}" alt="" draggable="false"><p class="vo-note"><i class="fa-solid fa-eye-slash"></i> View once · this photo disappears when you close it</p>`;
      o.oncontextmenu = e => e.preventDefault();
      document.body.appendChild(o);
      let left = sec;
      const end = () => { clearInterval(iv); o.remove(); reloadChat && reloadChat(); };
      const iv = setInterval(() => { left--; const s = $('#vos'); if (s) s.textContent = Math.max(left, 0); if (left <= 0) end(); }, 1000);
      $('#vox').onclick = end;
    } catch (e) { toast(e.message); reloadChat && reloadChat(); }
  }

  /* ---------- notifications (deep links) ---------- */
  const NI = { like: 'fa-heart', comment: 'fa-comment', message: 'fa-message', story_reply: 'fa-circle-play', follow: 'fa-user-plus', system: 'fa-bell' };
  function focusPost(id, tries = 25) {
    const el = document.querySelector(`#feed .post[data-id="${id}"]`);
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); return setTimeout(() => el.classList.remove('flash'), 2000); }
    if (tries > 0) setTimeout(() => focusPost(id, tries - 1), 150); else toast('That post is no longer available.');
  }
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