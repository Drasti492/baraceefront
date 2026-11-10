/* features.js — load AFTER app.js. Overrides/extends without touching app.js logic. */
(() => {
  let socket = null, reloadChat = null, replyTo = null;
  const hhmm = d => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isVid = u => /\.(mp4|webm|mov)$/i.test(u || '');
  const clip = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);

  /* ================= REAL-TIME (Socket.IO) ================= */
  function connect() {
    if (socket || !tok() || typeof io === 'undefined') return;
    socket = io(API_BASE, { auth: { token: tok() } });
    socket.on('message:new', m => {
      const other = m.from === me.id ? m.to : m.from;
      if (view === 'inbox') {
        if (chatWith && chatWith.id === other && reloadChat) reloadChat(); else rInbox();
      } else if (m.from !== me.id) toast('New message');
    });
    socket.on('message:update', () => { if (view === 'inbox' && reloadChat) reloadChat(); });
    socket.on('notification:new', n => {
      updateNotifBadge();
      if (view === 'notifs') rNotifs(); else toast(n.body);
    });
  }
  setInterval(() => {
    if (!tok() && socket) { socket.disconnect(); socket = null; }
    else if (tok() && me) connect();
  }, 2000);

  /* ================= INBOX ================= */
  window.rInbox = async function () {
    let th = [];
    try { th = await api('/threads'); } catch {}
    if (chatWith && !th.find(t => t.id === chatWith.id)) th.unshift(chatWith);
    if (!chatWith && th.length) chatWith = th[0];
    replyTo = null; reloadChat = null;

    $('#main').innerHTML = `
      <div class="v"><h2>Inbox</h2>
        <div class="chat-wrap">
          <div class="threads">${th.map(t => `
            <button class="th ${chatWith?.id === t.id ? 'on' : ''}" data-id="${t.id}">
              ${avatar(t, 'sm')}
              <span class="th-txt"><b>${esc(t.username)}</b><small>${esc(t.last || '')}</small></span>
              ${t.unread ? `<span class="nav-badge">${t.unread}</span>` : ''}
            </button>`).join('') || '<p class="mute" style="padding:12px">No chats yet. Message someone from the feed or Market.</p>'}
          </div>
          <div class="chat-pane">${chatWith ? `
            <div class="chat-head">${avatar(chatWith, 'sm')} ${esc(chatWith.username)}</div>
            <div class="msgs" id="ms"></div>
            <div id="rb"></div>
            <div class="chat-compose">
              <input id="mi" placeholder="Type a message" maxlength="2000" autocomplete="off">
              <button class="btn" id="sd" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>
            </div>` : '<p class="mute" style="padding:16px">Pick a chat.</p>'}
          </div>
        </div>
      </div>`;

    document.querySelectorAll('.th').forEach(b => {
      b.onclick = () => { chatWith = th.find(t => t.id === b.dataset.id); rInbox(); };
    });
    if (!chatWith) return;

    let cache = [];
    const bar = () => {
      $('#rb').innerHTML = replyTo ? `
        <div class="reply-bar"><div><b>Replying to ${replyTo.from === me.id ? 'yourself' : esc(chatWith.username)}</b>
        <span>${esc(clip(replyTo.text, 80))}</span></div>
        <button class="ico" id="rx" aria-label="Cancel reply"><i class="fa-solid fa-xmark"></i></button></div>` : '';
      if (replyTo) $('#rx').onclick = () => { replyTo = null; bar(); };
    };

    const bubble = m => {
      const mine = m.from === me.id;
      const q = m.replyTo ? (m.replyTo.unavailable || m.replyTo.deleted
        ? '<div class="m-quote"><i>Original message unavailable</i></div>'
        : `<div class="m-quote" data-q="${m.replyTo.id}"><b>${m.replyTo.from === me.id ? 'You' : esc(chatWith.username)}</b>${esc(clip(m.replyTo.text, 100))}</div>`) : '';
      const s = m.storyReply ? `
        <div class="m-story ${m.storyReply.expired ? 'gone' : ''}" data-sid="${m.storyReply.id}" data-exp="${m.storyReply.expired ? 1 : 0}">
          ${m.storyReply.media && !isVid(m.storyReply.media)
            ? `<img src="${esc(assetUrl(m.storyReply.media))}" alt="">`
            : '<span class="ph"><i class="fa-regular fa-circle-play"></i></span>'}
          <span>${mine ? 'You replied to their story' : 'Replied to your story'}${m.storyReply.expired ? ' · expired' : ''}</span>
        </div>` : '';
      return `
        <div class="m-row ${mine ? 'me' : 'them'}" data-id="${m.id}">
          <div class="m ${m.deleted ? 'gone' : ''}">${s}${q}${m.deleted ? '<i>Message deleted</i>' : esc(m.text)}</div>
          <div class="m-time">${hhmm(m.createdAt)}${mine && m.readAt ? ' · Seen' : ''}${m.hearts ? ` · <i class="fa-solid fa-heart" style="color:var(--bad)"></i> ${m.hearts}` : ''}</div>
        </div>`;
    };

    const closeMenu = () => document.querySelector('.ctx-menu')?.remove();
    const openMenu = (m, x, y) => {
      closeMenu();
      const el = document.createElement('div');
      el.className = 'ctx-menu';
      el.innerHTML = `
        <button data-a="reply"><i class="fa-solid fa-reply"></i> Reply</button>
        <button data-a="heart"><i class="fa-${m.heartedByMe ? 'solid' : 'regular'} fa-heart"></i> ${m.heartedByMe ? 'Remove like' : 'Like'}</button>
        <button data-a="copy"><i class="fa-regular fa-copy"></i> Copy</button>
        ${m.from === me.id ? '<button data-a="del" class="danger"><i class="fa-solid fa-trash"></i> Delete</button>' : ''}`;
      document.body.appendChild(el);
      setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
      el.style.left = Math.min(x, innerWidth - el.offsetWidth - 8) + 'px';
      el.style.top = Math.min(y, innerHeight - el.offsetHeight - 8) + 'px';
      el.onclick = async e => {
        const a = e.target.closest('button')?.dataset.a;
        if (!a) return;
        closeMenu();
        try {
          if (a === 'reply') { replyTo = { id: m.id, from: m.from, text: m.text }; bar(); $('#mi').focus(); }
          if (a === 'copy') { await navigator.clipboard?.writeText(m.text); toast('Copied'); }
          if (a === 'heart') { await api(`/messages/${m.id}/heart`, { method: 'PUT' }); load(); }
          if (a === 'del' && confirm('Delete this message for everyone?')) { await api(`/messages/${m.id}`, { method: 'DELETE' }); load(); }
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
          const m = cache.find(x => x.id === row.dataset.id);
          if (!m || m.deleted) return;
          let timer;
          row.oncontextmenu = e => { e.preventDefault(); openMenu(m, e.clientX, e.clientY); };
          row.ontouchstart = e => { const t = e.touches[0]; timer = setTimeout(() => openMenu(m, t.clientX, t.clientY), 450); };
          row.ontouchend = row.ontouchmove = () => clearTimeout(timer);
        });
        box.querySelectorAll('.m-quote[data-q]').forEach(el => {
          el.onclick = () => {
            const t = box.querySelector(`.m-row[data-id="${el.dataset.q}"]`);
            if (t) { t.scrollIntoView({ block: 'center' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1500); }
          };
        });
        box.querySelectorAll('.m-story').forEach(el => {
          el.onclick = async () => {
            if (el.dataset.exp === '1') return toast('This story has expired.');
            try { stories = await api('/stories'); } catch {}
            const i = stories.findIndex(s => s.id === el.dataset.sid);
            i >= 0 ? viewStory(i) : toast('This story is no longer available.');
          };
        });
      } catch (e) { toast(e.message); }
    };
    reloadChat = load;

    const send = async () => {
      const v = $('#mi').value.trim(); if (!v) return;
      $('#sd').disabled = true;
      try {
        await api('/messages/' + chatWith.id, { method: 'POST', body: { text: v, replyTo: replyTo ? replyTo.id : undefined } });
        $('#mi').value = ''; replyTo = null; bar(); await load();
      } catch (e) { toast(e.message); }
      finally { const b = $('#sd'); if (b) b.disabled = false; }
    };
    $('#sd').onclick = send;
    $('#mi').onkeydown = e => { if (e.key === 'Enter') send(); };
    if (chatWith.prefill) { $('#mi').value = chatWith.prefill; delete chatWith.prefill; }
    load();
  };

  /* ================= NOTIFICATIONS (deep links) ================= */
  const NI = { like: 'fa-heart', comment: 'fa-comment', message: 'fa-message', story_reply: 'fa-circle-play', system: 'fa-bell' };

  function focusPost(id, tries = 25) {
    const el = document.querySelector(`#feed .card[data-id="${id}"]`);
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); return setTimeout(() => el.classList.remove('flash'), 2000); }
    if (tries > 0) setTimeout(() => focusPost(id, tries - 1), 150); else toast('That post is no longer available.');
  }

  window.rNotifs = async function () {
    $('#main').innerHTML = `
      <div class="v">
        <div class="row"><h2 style="margin:0">Notifications</h2>
          <button class="btn ghost sm sp" id="mar">Mark all as read</button></div>
        <div class="card" id="nl" style="margin-top:12px"><p class="mute">Loading…</p></div>
      </div>`;
    $('#mar').onclick = async () => {
      try { await api('/notifications/read-all', { method: 'PATCH' }); rNotifs(); updateNotifBadge(); } catch (e) { toast(e.message); }
    };
    try {
      const { notifications } = await api('/notifications');
      $('#nl').innerHTML = notifications.map(n => `
        <div class="notif-item ${n.readAt ? '' : 'unread'}" data-id="${n.id}">
          <i class="fa-solid ${NI[n.type] || 'fa-bell'} t-student" style="margin-top:3px"></i>
          <div class="notif-body">${esc(n.body)}<div class="mute">${ago(n.createdAt)}</div></div>
          <button class="ico nd" aria-label="Delete notification"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join('') || '<p class="mute">You’re all caught up.</p>';

      document.querySelectorAll('.notif-item').forEach(el => {
        const n = notifications.find(x => x.id === el.dataset.id);
        el.querySelector('.nd').onclick = async e => {
          e.stopPropagation();
          try { await api('/notifications/' + n.id, { method: 'DELETE' }); rNotifs(); updateNotifBadge(); } catch (err) { toast(err.message); }
        };
        el.onclick = async () => {
          if (!n.readAt) api(`/notifications/${n.id}/read`, { method: 'PATCH' }).then(updateNotifBadge).catch(() => {});
          if ((n.type === 'message' || n.type === 'story_reply') && n.actor) {
            chatWith = { id: n.actor.id, username: n.actor.username, type: n.actor.type || 'student', avatar: n.actor.avatar };
            go('inbox');
          } else if (n.post) { filt = {}; go('home'); focusPost(n.post); }
        };
      });
      updateNotifBadge();
    } catch (e) { $('#nl').innerHTML = `<p class="mute">${esc(e.message)}</p>`; }
  };

  /* ================= PROFILE + EDIT ================= */
  window.rProfile = function () {
    const [ico, label] = TI[me.type] || ['fa-user', 'Member'];
    $('#main').innerHTML = `
      <div class="v"><div class="card profile-hero">
        ${avatar({ ...me, online: true }, 'lg')}
        <h2 style="margin-top:12px">${esc(me.displayName || me.username)}</h2>
        <div>${name(me)}</div>
        <div style="margin-top:8px"><span class="pill"><i class="fa-solid ${ico}"></i> ${label}</span></div>
        ${me.type === 'business' && !me.verified ? '<p class="mute" style="margin-top:12px">Pending verification. We will visit your business, then give you the verified badge.</p>' : ''}
        ${me.bio || me.location || me.website ? `<div class="profile-bio">
          ${me.bio ? `<p>${esc(me.bio)}</p>` : ''}
          ${me.location ? `<p class="mute"><i class="fa-solid fa-location-dot"></i> ${esc(me.location)}</p>` : ''}
          ${me.website ? `<p class="mute"><i class="fa-solid fa-link"></i> <a href="${esc(me.website)}" target="_blank" rel="noopener noreferrer">${esc(me.website.replace(/^https?:\/\//, ''))}</a></p>` : ''}
        </div>` : ''}
        <div class="profile-actions">
          <button class="btn sm" id="epb"><i class="fa-solid fa-pen"></i> Edit profile</button>
          <label class="btn ghost sm"><i class="fa-solid fa-camera"></i> Change photo
            <input type="file" id="avf" accept="image/*" hidden></label>
          <button class="btn ghost sm" id="stb"><i class="fa-solid fa-gear"></i> Settings</button>
        </div>
      </div></div>`;
    $('#stb').onclick = () => go('settings');
    $('#epb').onclick = editProfile;
    $('#avf').onchange = async e => {
      const f = e.target.files[0];
      if (!f || f.size > LIM.img) return toast('Photo too large (3MB max)');
      const fd = new FormData(); fd.append('f', f);
      try { await api('/avatar', { method: 'POST', body: fd }); me = await api('/me'); rProfile(); toast('Profile photo updated'); }
      catch (err) { toast(err.message); }
    };
  };

  function editProfile() {
    modal(`
      <h2>Edit profile</h2>
      <label>Display name</label><input id="epN" maxlength="40" value="${esc(me.displayName)}">
      <label>Username</label><input id="epU" maxlength="20" value="${esc(me.username)}">
      <label>Bio</label><textarea id="epB" rows="3" maxlength="160">${esc(me.bio)}</textarea>
      <label>Location</label><input id="epL" maxlength="60" value="${esc(me.location)}">
      <label>Website</label><input id="epW" maxlength="100" value="${esc(me.website)}" placeholder="https://">
      <div class="err" id="er"></div>
      <div class="row" style="margin-top:14px">
        <button class="btn ghost" onclick="closeModal()">Cancel</button>
        <button class="btn sp" id="epS">Save changes</button>
      </div>`);
    $('#epS').onclick = async () => {
      $('#epS').disabled = true;
      try {
        me = await api('/profile', { method: 'PATCH', body: {
          displayName: $('#epN').value, username: $('#epU').value, bio: $('#epB').value,
          location: $('#epL').value, website: $('#epW').value } });
        closeModal(); rProfile(); toast('Profile saved');
      } catch (e) { $('#er').textContent = e.message; $('#epS').disabled = false; }
    };
  }

  /* ================= SETTINGS ================= */
  window.rSettings = function () {
    const row = (id, t, d, on) => `
      <div class="set-row"><div><b>${t}</b><span class="mute">${d}</span></div>
      <input type="checkbox" id="${id}" ${on ? 'checked' : ''}></div>`;
    $('#main').innerHTML = `
      <div class="v">
        <div class="row"><h2 style="margin:0">Settings</h2><button class="btn ghost sm sp" id="sbk">Back</button></div>
        <div class="card settings-list" style="margin-top:12px">
          <div class="set-row"><div><b>Appearance</b><span class="mute">Light, dark or match your device</span></div>
            <select id="sth" style="width:auto"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
          ${row('sOn', 'Show online status', 'Let others see the green dot', me.showOnlineStatus)}
          ${row('sLs', 'Show last seen', 'Let others see when you were last active', me.showLastSeen)}
        </div>
        <div class="card"><h2>Change password</h2>
          <label class="mute">Current password</label><input id="pc" type="password" autocomplete="current-password">
          <label class="mute" style="display:block;margin-top:8px">New password (10+ characters)</label><input id="pn" type="password" autocomplete="new-password">
          <div class="err" id="er"></div>
          <button class="btn" id="pw" style="margin-top:10px">Update password</button></div>
        <div class="card"><button class="btn ghost" id="slo"><i class="fa-solid fa-right-from-bracket"></i> Log out</button></div>
      </div>`;
    $('#sth').value = me.theme || 'system';
    const save = async patch => { try { me = await api('/settings', { method: 'PATCH', body: patch }); toast('Saved'); } catch (e) { toast(e.message); } };
    $('#sbk').onclick = () => go('profile');
    $('#sth').onchange = e => {
      const t = e.target.value;
      setTheme(t === 'system' ? (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') : t);
      save({ theme: t });
    };
    $('#sOn').onchange = e => save({ showOnlineStatus: e.target.checked });
    $('#sLs').onchange = e => save({ showLastSeen: e.target.checked });
    $('#slo').onclick = () => logout();
    $('#pw').onclick = async () => {
      try {
        await api('/auth/change-password', { method: 'POST', body: { current: $('#pc').value, password: $('#pn').value } });
        $('#pc').value = ''; $('#pn').value = ''; $('#er').textContent = ''; toast('Password updated');
      } catch (e) { $('#er').textContent = e.message; }
    };
  };
  $('#settingsBtn').onclick = () => go('settings');

  /* ================= MARKETPLACE (edit / sold / message with item) ================= */
  window.rMarket = async function () {
    $('#main').innerHTML = `
      <div class="v">
        <div class="row" style="margin-bottom:12px"><h2 style="margin:0">Market</h2>
          <button class="btn sp" id="sell"><i class="fa-solid fa-plus"></i> Sell</button></div>
        <input id="mq" placeholder="Search items or services" style="margin-bottom:12px">
        <div class="grid" id="mg"></div>
        <h2 style="margin:24px 0 12px">My listings</h2><div id="mine"></div>
      </div>`;

    const load = async () => {
      try {
        const l = await api('/listings?q=' + encodeURIComponent($('#mq').value));
        $('#mg').innerHTML = l.map(x => `
          <div class="item"><div class="pic">${x.image ? `<img src="${esc(assetUrl(x.image))}" alt="">` : '<i class="fa-solid fa-box"></i>'}</div>
            <div class="bd"><b>${esc(x.title)}</b><span class="price">KSh ${Number(x.price).toLocaleString()}</span>
              ${x.description ? `<span class="mute">${esc(clip(x.description, 60))}</span>` : ''}
              ${name(x.user)}
              ${x.user.id !== me.id ? `<button class="btn sm msg" data-u="${x.user.id}" data-n="${esc(x.user.username)}" data-t="${esc(x.title)}"><i class="fa-solid fa-message"></i> Message</button>` : ''}
            </div></div>`).join('') || '<p class="mute">Nothing here yet. Be the first to sell.</p>';
        document.querySelectorAll('#mg .msg').forEach(b => {
          b.onclick = () => {
            chatWith = { id: b.dataset.u, username: b.dataset.n, type: 'student', prefill: `Hi, is "${b.dataset.t}" still available?` };
            go('inbox');
          };
        });
      } catch (e) { $('#mg').innerHTML = `<p class="mute">${esc(e.message)}</p>`; }
    };

    const mine = async () => {
      try {
        const l = await api('/my-listings'), now = Date.now();
        $('#mine').innerHTML = l.map(x => {
          const live = new Date(x.expiresAt) > now;
          const st = x.sold ? ['Sold', ''] : live ? ['Live', 'ok'] : ['Expired', ''];
          return `
            <div class="card row" data-id="${x._id}">
              <div><b>${esc(x.title)}</b> <span class="pill ${st[1]}">${st[0]}</span>
                <div class="mute">KSh ${Number(x.price).toLocaleString()} · ${x.sold ? 'Marked as sold' : live
                  ? 'Hidden in ' + Math.max(1, Math.round((new Date(x.expiresAt) - now) / 36e5)) + 'h'
                  : 'Deleted for good ' + new Date(x.deleteAt).toLocaleDateString()}</div></div>
              <span class="sp row">
                <button class="btn sm ghost ed" data-id="${x._id}" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="btn sm ghost sd2" data-id="${x._id}" data-s="${x.sold ? 0 : 1}">${x.sold ? 'Relist' : 'Mark sold'}</button>
                <button class="btn sm ghost rn" data-id="${x._id}"><i class="fa-solid fa-rotate"></i> Renew</button>
                <button class="btn sm ghost dl" data-id="${x._id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
              </span></div>`;
        }).join('') || '<p class="mute">You have no listings.</p>';

        const act = (sel, fn) => document.querySelectorAll(sel).forEach(b => b.onclick = async () => {
          try { await fn(b); load(); mine(); } catch (e) { toast(e.message); }
        });
        act('.rn', async b => { await api(`/listings/${b.dataset.id}/renew`, { method: 'POST' }); toast('Listing renewed'); });
        act('.sd2', async b => { await api(`/listings/${b.dataset.id}/sold`, { method: 'POST', body: { sold: b.dataset.s === '1' } }); });
        act('.dl', async b => { if (!confirm('Delete this listing for good?')) throw new Error('Cancelled'); await api('/listings/' + b.dataset.id, { method: 'DELETE' }); toast('Listing deleted'); });
        document.querySelectorAll('.ed').forEach(b => b.onclick = () => {
          const it = l.find(x => x._id === b.dataset.id);
          modal(`
            <h2>Edit listing</h2>
            <label>Item name</label><input id="elt" maxlength="80" value="${esc(it.title)}">
            <label>Price (KSh)</label><input id="elp" type="number" inputmode="numeric" value="${it.price}">
            <label>Description</label><textarea id="eld" rows="3" maxlength="500">${esc(it.description)}</textarea>
            <div class="err" id="er"></div>
            <div class="row" style="margin-top:14px"><button class="btn ghost" onclick="closeModal()">Cancel</button>
              <button class="btn sp" id="els">Save changes</button></div>`);
          $('#els').onclick = async () => {
            try {
              await api('/listings/' + it._id, { method: 'PATCH', body: { title: $('#elt').value, price: $('#elp').value, description: $('#eld').value } });
              closeModal(); toast('Listing updated'); load(); mine();
            } catch (e) { $('#er').textContent = e.message; }
          };
        });
      } catch (e) { $('#mine').innerHTML = `<p class="mute">${esc(e.message)}</p>`; }
    };

    $('#mq').oninput = load;
    $('#sell').onclick = () => sell(load, mine);
    load(); mine();
  };

  /* ================= LIVE USERNAME CHECK (signup) ================= */
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

  /* ================= FORGOT PASSWORD ================= */
  const baseLogin = window.loginForm;
  window.loginForm = function () {
    baseLogin();
    const p = document.createElement('p');
    p.className = 'mute'; p.style.marginTop = '6px';
    p.innerHTML = '<a href="#" id="fpw">Forgot password?</a>';
    $('#sheet').appendChild(p);
    $('#fpw').onclick = e => { e.preventDefault(); forgot(); };
  };

  function forgot() {
    modal(`
      <h2>Reset your password</h2>
      <label>Email</label><input id="fe" type="email" autocomplete="email">
      <div class="err" id="er"></div>
      <div class="row" style="margin-top:14px"><button class="btn ghost" id="fb">Back</button>
        <button class="btn sp" id="fs">Send code</button></div>`);
    $('#fb').onclick = loginForm;
    $('#fs').onclick = async () => {
      const email = $('#fe').value.trim();
      try {
        await api('/auth/forgot-password', { method: 'POST', body: { email } });
        modal(`
          <h2>Enter your code</h2>
          <p class="mute">If that email is registered, we sent a 6-digit code. It expires in 10 minutes.</p>
          <label>Code</label><input id="fc" maxlength="6" inputmode="numeric" placeholder="000000">
          <label>New password (10+ characters)</label><input id="fp" type="password" autocomplete="new-password">
          <div class="err" id="er"></div>
          <button class="btn" id="fr" style="width:100%;margin-top:14px">Reset password</button>`);
        $('#fc').oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); };
        $('#fr').onclick = async () => {
          try {
            await api('/auth/reset-password', { method: 'POST', body: { email, code: $('#fc').value, password: $('#fp').value } });
            toast('Password updated. Please log in.'); loginForm();
          } catch (e) { $('#er').textContent = e.message; }
        };
      } catch (e) { $('#er').textContent = e.message; }
    };
  }

  /* If app.js already finished loading the user before this file ran, re-render. */
  if (me) go(view);
})();