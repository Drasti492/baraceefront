/* bc-hookup.js — adults-only anonymous "Hookup" section. Load after bc-market.js. */
(() => {
  const LOOK = { relationship: ['fa-ring', 'Relationship'], dating: ['fa-champagne-glasses', 'Dating'], friendship: ['fa-user-group', 'Friendship first'], casual: ['fa-fire', 'Something casual'], buddy: ['fa-dumbbell', 'Study / gym buddy'] };
  const STAT = { single: 'Single', complicated: 'It’s complicated' };
  const HK = { me: null, tab: 'feed', chat: null, filter: {}, timer: null };
  const g = (gender, big) => `<span class="hk-g ${gender} ${big ? 'big' : ''}"><i class="fa-solid ${gender === 'male' ? 'fa-mars' : 'fa-venus'}"></i></span>`;
  const chips = a => (a || []).map(k => `<span class="hk-chip"><i class="fa-solid ${LOOK[k]?.[0] || 'fa-heart'}"></i>${LOOK[k]?.[1] || k}</span>`).join('');
  const userLink = c => c.username ? `<a class="hk-un" data-uid="${c.userId}"><i class="fa-solid fa-at"></i>${esc(c.username)}</a>` : '';

  /* ---------- entry point + top-bar icon ---------- */
  const top = $('.top-r');
  if (top && !$('#hkBtn')) {
    top.insertAdjacentHTML('afterbegin', '<button class="ico" id="hkBtn" data-tip="Hookup" aria-label="Hookup"><i class="fa-solid fa-heart"></i></button>');
    $('#hkBtn').onclick = () => go('hookup');
  }
  const baseGo = window.go;
  window.go = function (v) {
    clearInterval(HK.timer);
    if (v !== 'hookup') return baseGo(v);
    view = 'hookup';
    document.querySelectorAll('#nav button').forEach(b => b.classList.remove('on'));
    rHookup(); $('#main').scrollTop = 0;
  };

  window.rHookup = async function () {
    $('#main').innerHTML = '<div class="v wide"><p class="mute">Loading…</p></div>';
    try {
      const d = await api('/hookup/me');
      if (d.joined && d.flagged) return $('#main').innerHTML = '<div class="v"><div class="card empty"><i class="fa-solid fa-shield-halved"></i><p><b>Your Hookup access is under review.</b></p><p>Our team will check your account.</p></div></div>';
      HK.me = d.joined ? d.profile : null;
      d.joined ? shell() : intro();
    } catch (e) { $('#main').innerHTML = `<div class="v"><div class="card"><p class="mute">${esc(e.message)}</p></div></div>`; }
  };

  /* ---------- onboarding ---------- */
  function intro() {
    $('#main').innerHTML = `
      <div class="v"><div class="card hk-intro">
        <div class="hk-hero"><i class="fa-solid fa-heart"></i></div>
        <h2>Hookup</h2>
        <p class="hk-lead">Meet other adults around campus — without showing your name.</p>
        <ul class="hk-points">
          <li><i class="fa-solid fa-user-secret"></i><span><b>You get an anonymous ID</b>Others only see your ID, gender icon and what you choose to share. Never your username.</span></li>
          <li><i class="fa-solid fa-id-card"></i><span><b>You decide who sees you</b>Use “Show my profile” to share your username with one person, when you’re ready.</span></li>
          <li><i class="fa-solid fa-comments"></i><span><b>Separate private chats</b>Hookup messages never appear in your normal inbox.</span></li>
          <li><i class="fa-solid fa-shield-halved"></i><span><b>Adults only (18+)</b>Block and report anyone, any time. Never send money or meet alone in private places.</span></li>
        </ul>
        <button class="btn big" id="hkJoin" style="width:100%">Join Hookup</button>
        <p class="mute" style="text-align:center;margin-top:8px">You can leave and delete everything at any time.</p>
      </div></div>`;
    $('#hkJoin').onclick = joinForm;
  }

  function joinForm() {
    const max = new Date(); max.setFullYear(max.getFullYear() - 18);
    const sel = { gender: '', lookingFor: [] };
    $('#main').innerHTML = `
      <div class="v"><div class="card">
        <button class="lnk back" id="jb"><i class="fa-solid fa-arrow-left"></i> Back</button>
        <h2>Create your anonymous profile</h2>
        <label class="hk-l">Date of birth <span class="mute">(private — only used to check you’re 18+)</span></label>
        <input type="date" id="jd" max="${max.toISOString().slice(0, 10)}">
        <label class="hk-l">I am</label>
        <div class="hk-pick" id="jg"><button type="button" data-g="male" class="hk-opt"><span class="hk-g male"><i class="fa-solid fa-mars"></i></span>Male</button><button type="button" data-g="female" class="hk-opt"><span class="hk-g female"><i class="fa-solid fa-venus"></i></span>Female</button></div>
        <div class="form-grid">
          <div><label class="hk-l">Status</label><select id="js"><option value="single">Single</option><option value="complicated">It’s complicated</option></select></div>
          <div><label class="hk-l">Interested in</label><select id="ji"><option value="everyone">Everyone</option><option value="women">Women</option><option value="men">Men</option></select></div>
        </div>
        <label class="hk-l">Looking for <span class="mute">(choose up to 4)</span></label>
        <div class="hk-chips" id="jl">${Object.entries(LOOK).map(([k, [i, l]]) => `<button type="button" class="chip" data-k="${k}"><i class="fa-solid ${i}"></i> ${l}</button>`).join('')}</div>
        <label class="hk-l">About you <span class="mute" id="jc">0/200</span></label><textarea id="jb2" rows="3" maxlength="200" placeholder="A short intro. No names, phone numbers or links."></textarea>
        <div class="form-grid">
          <div><label class="hk-l">Interests</label><input id="jint" maxlength="100" placeholder="Music, football, movies…"></div>
          <div><label class="hk-l">Area near campus</label><input id="jar" maxlength="60" placeholder="e.g. off-campus, hostels"></div>
        </div>
        <label class="hk-agree"><input type="checkbox" id="ja"><span>I confirm I am <b>18 or older</b>, I will respect others, and I won’t share anyone’s identity or ask for money.</span></label>
        <div class="err" id="er"></div>
        <button class="btn big" id="jgo" style="width:100%;margin-top:12px">Create my ID</button>
      </div></div>`;
    $('#jb').onclick = intro;
    $('#jb2').oninput = e => { $('#jc').textContent = e.target.value.length + '/200'; };
    document.querySelectorAll('#jg .hk-opt').forEach(b => b.onclick = () => { sel.gender = b.dataset.g; document.querySelectorAll('#jg .hk-opt').forEach(x => x.classList.toggle('on', x === b)); });
    document.querySelectorAll('#jl .chip').forEach(b => b.onclick = () => {
      const k = b.dataset.k, i = sel.lookingFor.indexOf(k);
      if (i >= 0) sel.lookingFor.splice(i, 1); else if (sel.lookingFor.length < 4) sel.lookingFor.push(k); else return toast('Choose up to 4.');
      b.classList.toggle('on', i < 0);
    });
    $('#jgo').onclick = async () => {
      $('#jgo').disabled = true;
      try {
        const d = await api('/hookup/join', { method: 'POST', body: { birthDate: $('#jd').value, gender: sel.gender, status: $('#js').value, interestedIn: $('#ji').value, lookingFor: sel.lookingFor, bio: $('#jb2').value, interests: $('#jint').value, area: $('#jar').value, agree: $('#ja').checked } });
        HK.me = d.profile; HK.tab = 'feed';
        modal(`<div style="text-align:center"><div class="hk-hero sm"><i class="fa-solid fa-check"></i></div><h2>You’re in!</h2><p class="mute">Your anonymous ID is</p><div class="hk-bigid">${esc(d.profile.alias)}</div><p class="mute" style="margin:8px 0 14px">This is the only thing others see. Keep your username private until you choose to share it.</p><button class="btn" style="width:100%" onclick="closeModal()">Enter Hookup</button></div>`);
        shell();
      } catch (e) { $('#er').textContent = e.message; $('#jgo').disabled = false; }
    };
  }

  /* ---------- shell + tabs ---------- */
  const TABS = [['feed', 'fa-newspaper', 'Feed'], ['people', 'fa-user-group', 'People'], ['chats', 'fa-comments', 'Chats'], ['me', 'fa-id-card', 'My profile']];
  function shell() {
    $('#main').innerHTML = `
      <div class="v wide hk">
        <div class="hk-top"><div><h2>Hookup</h2><span class="mute">Your ID · <b class="hk-id">${esc(HK.me.alias)}</b></span></div>${g(HK.me.gender, true)}</div>
        <div class="hk-tabs">${TABS.map(([k, i, l]) => `<button class="${HK.tab === k ? 'on' : ''}" data-t="${k}"><i class="fa-solid ${i}"></i><span>${l}</span></button>`).join('')}</div>
        <div id="hkb"></div>
      </div>`;
    document.querySelectorAll('.hk-tabs button').forEach(b => b.onclick = () => { HK.tab = b.dataset.t; if (HK.tab !== 'chats') HK.chat = null; shell(); });
    clearInterval(HK.timer);
    ({ feed: tabFeed, people: tabPeople, chats: tabChats, me: tabMe })[HK.tab]();
  }

  /* ---------- shared card actions ---------- */
  const startChat = alias => { HK.tab = 'chats'; HK.chat = alias; shell(); };
  async function personMenu(btn, c) {
    document.querySelector('.ctx-menu')?.remove();
    const r = btn.getBoundingClientRect(), m = document.createElement('div');
    m.className = 'ctx-menu';
    m.innerHTML = `<button data-a="msg"><i class="fa-regular fa-paper-plane"></i> Message</button><button data-a="rep"><i class="fa-solid fa-flag"></i> Report</button><button data-a="blk" class="danger"><i class="fa-solid fa-ban"></i> Block</button>`;
    document.body.appendChild(m);
    m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = r.bottom + 4 + 'px';
    setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
    m.onclick = e => { const a = e.target.closest('button')?.dataset.a; if (a === 'msg') startChat(c.alias); if (a === 'rep') reportDlg(c); if (a === 'blk') blockDlg(c); };
  }
  async function blockDlg(c, after) {
    if (!await BC.confirm({ title: `Block ${c.alias}?`, message: 'You won’t see each other anywhere on Hookup and any shared profile access is removed.', confirm: 'Block', danger: true, icon: 'fa-ban' })) return;
    try { await api('/hookup/block/' + c.alias, { method: 'POST' }); toast('Blocked'); after ? after() : shell(); } catch (e) { toast(e.message); }
  }
  function reportDlg(c) {
    modal(`<h2>Report ${esc(c.alias)}</h2><label>Reason</label><select id="rr"><option value="harassment">Harassment or pressure</option><option value="scam">Scam or asking for money</option><option value="spam">Spam</option><option value="underage">Seems under 18</option><option value="other">Something else</option></select>
      <label>Details (optional)</label><textarea id="rt" rows="3" maxlength="200"></textarea>
      <p class="mute" style="margin-top:6px">They will also be blocked for you. Reports go to the Bara Cee team.</p>
      <div class="row" style="margin-top:12px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn danger sp" id="rg">Report</button></div>`);
    $('#rg').onclick = async () => { try { await api('/hookup/report/' + c.alias, { method: 'POST', body: { reason: $('#rr').value, text: $('#rt').value } }); closeModal(); toast('Thanks — we’ll review it.'); shell(); } catch (e) { toast(e.message); } };
  }

  /* ---------- FEED ---------- */
  function tabFeed() {
    $('#hkb').innerHTML = `
      <div class="card hk-comp">
        <textarea id="hpt" rows="2" maxlength="300" placeholder="Say something to people on campus… (no links or phone numbers)"></textarea>
        <div class="comp-bar">
          <select id="hpa" style="width:auto;padding:6px 10px"><option value="all">Everyone</option><option value="selected">Selected IDs only</option></select>
          <span class="mute cnt" id="hpc">0/300</span>
          <button class="btn sm" id="hpb"><i class="fa-solid fa-paper-plane"></i> Post</button>
        </div>
        <input id="hpi" placeholder="Enter IDs separated by commas, e.g. HK-7F2A9C, HK-31BD05" style="margin-top:8px" hidden>
      </div>
      <div id="hpl"><p class="mute">Loading…</p></div>`;
    $('#hpt').oninput = e => { $('#hpc').textContent = e.target.value.length + '/300'; };
    $('#hpa').onchange = e => { $('#hpi').hidden = e.target.value !== 'selected'; };
    $('#hpb').onclick = async () => {
      const text = $('#hpt').value.trim(); if (!text) return toast('Write something first.');
      const body = { text, audience: $('#hpa').value, aliases: $('#hpi').value.split(/[\s,]+/).filter(Boolean) };
      $('#hpb').disabled = true;
      try { await api('/hookup/posts', { method: 'POST', body }); toast('Posted'); tabFeed(); } catch (e) { toast(e.message); $('#hpb').disabled = false; }
    };
    const load = async () => {
      try {
        const ps = await api('/hookup/feed'), box = $('#hpl'); if (!box) return;
        box.innerHTML = ps.map(p => `
          <article class="card hk-post" data-id="${p.id}">
            <header class="hk-ph">${g(p.author.gender)}<div class="hk-pn"><b class="hk-id">${esc(p.author.alias)}</b><span class="mute">${p.author.age} · ${STAT[p.author.status] || ''} · ${BC.when(p.createdAt)}${p.audience === 'selected' ? ' · <i class="fa-solid fa-lock"></i> selected' : ''}</span></div>
              <button class="ico pm2" aria-label="More"><i class="fa-solid fa-ellipsis"></i></button></header>
            <p class="post-text">${esc(p.text)}</p>
            <div class="hk-cs">${chips(p.author.lookingFor)}</div>${p.author.username ? `<div style="margin-top:6px">${userLink(p.author)}</div>` : ''}
            <div class="acts"><button class="lk ${p.likedByMe ? 'liked' : ''}" aria-label="Like"><i class="fa-${p.likedByMe ? 'solid' : 'regular'} fa-heart"></i><span>${p.likes}</span></button>
              ${p.mine ? '' : '<button class="hk-msg"><i class="fa-regular fa-paper-plane"></i><span>Message</span></button>'}</div>
          </article>`).join('') || '<div class="card empty"><i class="fa-regular fa-comments"></i><p>No posts yet. Be the first to say hi.</p></div>';
        box.querySelectorAll('.hk-post').forEach(el => {
          const p = ps.find(x => x.id === el.dataset.id);
          el.querySelector('.lk').onclick = async e => { const b = e.currentTarget; try { const d = await api(`/hookup/posts/${p.id}/like`, { method: 'POST' }); b.classList.toggle('liked', d.likedByMe); b.innerHTML = `<i class="fa-${d.likedByMe ? 'solid' : 'regular'} fa-heart"></i><span>${d.likes}</span>`; } catch (er) { toast(er.message); } };
          const m = el.querySelector('.hk-msg'); if (m) m.onclick = () => startChat(p.author.alias);
          el.querySelector('.pm2').onclick = async e => {
            if (!p.mine) return personMenu(e.currentTarget, p.author);
            if (await BC.confirm({ title: 'Delete this post?', message: 'It will be removed for everyone.', confirm: 'Delete', danger: true })) { try { await api('/hookup/posts/' + p.id, { method: 'DELETE' }); tabFeed(); } catch (er) { toast(er.message); } }
          };
        });
      } catch (e) { $('#hpl') && ($('#hpl').innerHTML = `<p class="mute">${esc(e.message)}</p>`); }
    };
    load(); HK.timer = setInterval(() => { if (!document.hidden && view === 'hookup' && !$('#hpt')?.value) load(); }, 20000);
  }

  /* ---------- PEOPLE ---------- */
  function tabPeople() {
    const f = HK.filter;
    $('#hkb').innerHTML = `
      <div class="hk-filters">
        <input id="pq" placeholder="Search by ID" value="${esc(f.q || '')}">
        <select id="pg"><option value="">Everyone</option><option value="female">Women</option><option value="male">Men</option></select>
        <select id="pl2"><option value="">Looking for: any</option>${Object.entries(LOOK).map(([k, [, l]]) => `<option value="${k}">${l}</option>`).join('')}</select>
      </div>
      <div class="hk-grid" id="pgrid"><p class="mute">Loading…</p></div>`;
    $('#pg').value = f.gender || ''; $('#pl2').value = f.looking || '';
    let t; const load = async () => {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(HK.filter).filter(([, v]) => v)));
      try {
        const ps = await api('/hookup/people?' + q), box = $('#pgrid'); if (!box) return;
        box.innerHTML = ps.map(c => `
          <article class="card hk-card" data-a="${c.alias}">
            <header class="hk-ph">${g(c.gender, true)}<div class="hk-pn"><b class="hk-id">${esc(c.alias)}</b><span class="mute">${c.age} · ${STAT[c.status] || ''}</span></div><button class="ico pm2" aria-label="More"><i class="fa-solid fa-ellipsis"></i></button></header>
            <div class="hk-cs">${chips(c.lookingFor)}</div>
            ${c.bio ? `<p class="hk-bio">${esc(c.bio)}</p>` : ''}
            <ul class="hk-meta">${c.interests ? `<li><i class="fa-solid fa-heart"></i>${esc(c.interests)}</li>` : ''}${c.area ? `<li><i class="fa-solid fa-location-dot"></i>${esc(c.area)}</li>` : ''}</ul>
            ${c.username ? userLink(c) : ''}
            <button class="btn sm hk-mb"><i class="fa-regular fa-paper-plane"></i> Message</button>
          </article>`).join('') || '<div class="card empty" style="grid-column:1/-1"><i class="fa-solid fa-user-group"></i><p>No one matches yet. Try changing the filters.</p></div>';
        box.querySelectorAll('.hk-card').forEach(el => {
          const c = ps.find(x => x.alias === el.dataset.a);
          el.querySelector('.hk-mb').onclick = () => startChat(c.alias);
          el.querySelector('.pm2').onclick = e => personMenu(e.currentTarget, c);
        });
      } catch (e) { $('#pgrid') && ($('#pgrid').innerHTML = `<p class="mute">${esc(e.message)}</p>`); }
    };
    $('#pq').oninput = e => { HK.filter.q = e.target.value; clearTimeout(t); t = setTimeout(load, 300); };
    $('#pg').onchange = e => { HK.filter.gender = e.target.value; load(); };
    $('#pl2').onchange = e => { HK.filter.looking = e.target.value; load(); };
    load();
  }

  /* ---------- CHATS (separate incognito inbox) ---------- */
  function tabChats() {
    $('#hkb').innerHTML = `
      <div class="inbox hk-in ${HK.chat ? 'has-chat' : ''}">
        <aside class="ib-list"><div class="ib-h"><h2>Private chats</h2></div><div class="ib-rows" id="hkl"></div></aside>
        <section class="ib-chat" id="hkc">${HK.chat ? '' : '<div class="ib-empty"><i class="fa-regular fa-comments"></i><p>Select a chat, or message someone from People</p></div>'}</section>
      </div>`;
    const list = async () => {
      try {
        const th = await api('/hookup/chats');
        if (HK.chat && !th.find(t => t.alias === HK.chat)) th.unshift({ alias: HK.chat, gender: '', age: '', last: '', unread: 0 });
        const box = $('#hkl'); if (!box) return;
        box.innerHTML = th.map(t => `
          <button class="ib-row ${HK.chat === t.alias ? 'on' : ''}" data-a="${t.alias}">
            <span class="ib-av">${t.gender ? g(t.gender, true) : '<span class="hk-g big"><i class="fa-solid fa-user"></i></span>'}</span>
            <span class="ib-mid"><span class="ib-top"><b class="ib-name hk-id">${esc(t.alias)}</b><time class="${t.unread ? 'new' : ''}">${t.at ? BC.when(t.at) : ''}</time></span>
              <span class="ib-bot"><span class="ib-last">${t.lastMine ? '<i class="fa-solid fa-check"></i> ' : ''}${esc(t.last || 'Start chatting')}</span>${t.unread ? `<span class="ib-badge">${t.unread}</span>` : ''}</span></span>
          </button>`).join('') || '<p class="mute" style="padding:16px">No chats yet. Find someone in People and say hi.</p>';
        box.querySelectorAll('.ib-row').forEach(b => b.onclick = () => { HK.chat = b.dataset.a; tabChats(); });
      } catch {}
    };
    list();
    if (HK.chat) openChat(HK.chat);
    HK.timer = setInterval(() => { if (document.hidden || view !== 'hookup' || HK.tab !== 'chats') return; list(); HK.reload && HK.reload(false); }, 4000);
  }

  async function openChat(alias) {
    const pane = $('#hkc'); let sig = '', data = null;
    const paint = async force => {
      let d; try { d = await api('/hookup/chats/' + alias); } catch (e) { if (force) { pane.innerHTML = `<div class="ib-empty"><i class="fa-solid fa-ban"></i><p>${esc(e.message)}</p></div>`; } return; }
      const s = d.messages.map(m => m.id + (m.readAt ? 1 : 0)).join() + d.iShared + !!d.theirShare + d.iBlocked;
      if (!force && s === sig && $('#hmm')) return;
      sig = s; data = d;
      const typed = $('#hmi')?.value || '', hadFocus = document.activeElement && document.activeElement.id === 'hmi';
      const first = !$('#hmm'), keep = $('#hmm')?.scrollTop || 0, atBottom = first || ($('#hmm').scrollHeight - $('#hmm').scrollTop - $('#hmm').clientHeight < 90);
      pane.innerHTML = `
        <div class="chat-head">
          <button class="ico ib-back" id="hkb2" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>
          <span class="ch-who">${g(d.with.gender, true)}<span class="ch-t"><b class="hk-id">${esc(d.with.alias)}</b><span class="ch-s">${d.with.age} · ${STAT[d.with.status] || ''}</span></span></span>
          <button class="ico sp" id="hkm" aria-label="Chat options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
        </div>
        ${d.theirShare ? `<div class="hk-shared"><i class="fa-solid fa-id-card"></i><span><b>${esc(d.with.alias)} shared their profile</b><small>@${esc(d.theirShare.username)}</small></span><button class="btn sm" id="hkv">View profile</button></div>` : ''}
        <div class="msgs" id="hmm">${d.messages.map(m => m.kind !== 'text'
          ? `<div class="m-day"><span>${m.mine ? 'You' : esc(d.with.alias)} ${esc(m.text)}</span></div>`
          : `<div class="m-row ${m.mine ? 'me' : 'them'}"><div class="m">${esc(m.text)}</div><div class="m-time">${BC.hhmm(m.createdAt)} ${m.mine ? `<i class="fa-solid ${m.readAt ? 'fa-check-double rd' : 'fa-check'}"></i>` : ''}</div></div>`).join('') || '<p class="mute" style="text-align:center;margin-top:20px">Say hi. Keep it respectful.</p>'}</div>
        <div class="hk-warn"><i class="fa-solid fa-triangle-exclamation"></i> Never send money. Meet in public places and tell a friend.</div>
        <div class="chat-compose ${d.iBlocked ? 'off' : ''}"><input id="hmi" placeholder="${d.iBlocked ? 'You blocked this ID' : 'Type a message'}" maxlength="1000" autocomplete="off" ${d.iBlocked ? 'disabled' : ''}><button class="btn" id="hms" aria-label="Send" ${d.iBlocked ? 'disabled' : ''}><i class="fa-solid fa-paper-plane"></i></button></div>`;
      const mm = $('#hmm'); mm.scrollTop = atBottom ? mm.scrollHeight : keep;
      if (typed && !d.iBlocked) { $('#hmi').value = typed; if (hadFocus) $('#hmi').focus(); }
      $('#hkb2').onclick = () => { HK.chat = null; HK.reload = null; tabChats(); };
      if ($('#hkv')) $('#hkv').onclick = () => BC.showUser(d.theirShare.userId);
      $('#hkm').onclick = e => {
        document.querySelector('.ctx-menu')?.remove();
        const r = e.currentTarget.getBoundingClientRect(), m = document.createElement('div'); m.className = 'ctx-menu';
        m.innerHTML = `<button data-a="show"><i class="fa-solid fa-id-card"></i> ${d.iShared ? 'Stop sharing my profile' : 'Show my profile'}</button><button data-a="rep"><i class="fa-solid fa-flag"></i> Report</button><button data-a="blk" class="danger"><i class="fa-solid fa-ban"></i> ${d.iBlocked ? 'Unblock' : 'Block'}</button>`;
        document.body.appendChild(m);
        m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = r.bottom + 4 + 'px';
        setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
        m.onclick = async ev => {
          const a = ev.target.closest('button')?.dataset.a;
          if (a === 'show') {
            const ok = await BC.confirm(d.iShared
              ? { title: 'Stop sharing your profile?', message: `${d.with.alias} will no longer be able to open your profile.`, confirm: 'Stop sharing', icon: 'fa-eye-slash' }
              : { title: 'Show your profile?', message: `${d.with.alias} will see your real username (@${me.username}) and can open your profile. Only do this if you trust them.`, confirm: 'Show my profile', icon: 'fa-id-card' });
            if (ok) { try { await api(`/hookup/chats/${alias}/reveal`, { method: 'POST', body: { share: !d.iShared } }); paint(true); } catch (er) { toast(er.message); } }
          }
          if (a === 'rep') reportDlg(d.with);
          if (a === 'blk') { if (d.iBlocked) { try { await api('/hookup/block/' + alias, { method: 'DELETE' }); paint(true); } catch (er) { toast(er.message); } } else blockDlg(d.with, () => { HK.chat = null; tabChats(); }); }
        };
      };
      const send = async () => {
        const v = $('#hmi').value.trim(); if (!v) return; $('#hms').disabled = true;
        try { await api('/hookup/chats/' + alias, { method: 'POST', body: { text: v } }); $('#hmi').value = ''; await paint(true); }
        catch (e) { toast(e.message); } finally { const b = $('#hms'); if (b && !d.iBlocked) b.disabled = false; }
      };
      $('#hms').onclick = send; $('#hmi').onkeydown = e => { if (e.key === 'Enter') send(); };
    };
    HK.reload = paint;
    paint(true);
  }

  /* ---------- MY PROFILE ---------- */
  function tabMe() {
    const p = HK.me;
    $('#hkb').innerHTML = `
      <div class="card hk-me">
        <div class="hk-ph">${g(p.gender, true)}<div class="hk-pn"><b class="hk-id" style="font-size:18px">${esc(p.alias)}</b><span class="mute">${p.age} · ${STAT[p.status] || ''} · interested in ${p.interestedIn}</span></div><button class="btn ghost sm sp" id="mEdit"><i class="fa-solid fa-pen"></i> Edit</button></div>
        <div class="hk-cs">${chips(p.lookingFor)}</div>
        ${p.bio ? `<p class="hk-bio">${esc(p.bio)}</p>` : '<p class="mute">Add a short intro so people know what you’re about.</p>'}
        <ul class="hk-meta">${p.interests ? `<li><i class="fa-solid fa-heart"></i>${esc(p.interests)}</li>` : ''}${p.area ? `<li><i class="fa-solid fa-location-dot"></i>${esc(p.area)}</li>` : ''}</ul>
        <p class="mute" style="margin-top:8px"><i class="fa-solid fa-user-secret"></i> Others only see this card. Your username and name stay hidden.</p>
      </div>
      <div class="card">
        <div class="set-row"><div><b>Visible to others</b><span class="mute">Turn off to hide your ID from People and the Feed</span></div><label class="sw"><input type="checkbox" id="mAct" ${p.active ? 'checked' : ''}><span></span></label></div>
        <div class="set-row"><div><b>Show my username to everyone</b><span class="mute">Not recommended. Prefer “Show my profile” inside a chat.</span></div><label class="sw"><input type="checkbox" id="mShow" ${p.showUsername ? 'checked' : ''}><span></span></label></div>
        <div class="set-row"><div><b>Blocked IDs</b><span class="mute">Manage people you blocked on Hookup</span></div><button class="btn ghost sm" id="mBl">View</button></div>
      </div>
      <div class="card"><div class="set-row"><div><b style="color:var(--danger)">Leave Hookup</b><span class="mute">Deletes your ID, posts, chats and blocks permanently</span></div><button class="btn danger sm" id="mLeave">Leave</button></div></div>`;
    const patch = async b => { try { const d = await api('/hookup/profile', { method: 'PATCH', body: b }); HK.me = d.profile; toast('Saved'); } catch (e) { toast(e.message); tabMe(); } };
    $('#mAct').onchange = e => patch({ active: e.target.checked });
    $('#mShow').onchange = async e => {
      if (e.target.checked && !await BC.confirm({ title: 'Show your username to everyone?', message: 'Everyone on Hookup will see your real username and can open your profile. This removes your anonymity.', confirm: 'Show it', danger: true, icon: 'fa-eye' })) { e.target.checked = false; return; }
      patch({ showUsername: e.target.checked });
    };
    $('#mEdit').onclick = editMe;
    $('#mBl').onclick = async () => {
      modal('<h2>Blocked IDs</h2><div id="pl"><p class="mute">Loading…</p></div><button class="btn ghost" style="width:100%;margin-top:12px" onclick="closeModal()">Close</button>');
      try {
        const l = await api('/hookup/blocks');
        $('#pl').innerHTML = l.map(c => `<div class="row plr">${g(c.gender)}<b class="hk-id">${esc(c.alias)}</b><button class="btn ghost sm sp ub" data-a="${c.alias}">Unblock</button></div>`).join('') || '<p class="mute">You haven’t blocked anyone.</p>';
        document.querySelectorAll('#pl .ub').forEach(b => b.onclick = async () => { try { await api('/hookup/block/' + b.dataset.a, { method: 'DELETE' }); b.closest('.plr').remove(); } catch (e) { toast(e.message); } });
      } catch (e) { $('#pl').innerHTML = `<p class="mute">${esc(e.message)}</p>`; }
    };
    $('#mLeave').onclick = async () => {
      if (!await BC.confirm({ title: 'Leave Hookup?', message: 'Your anonymous ID, posts, chats and blocks will be deleted permanently. You can join again later with a new ID.', confirm: 'Leave and delete', danger: true, icon: 'fa-door-open' })) return;
      try { await api('/hookup/profile', { method: 'DELETE' }); HK.me = null; toast('You left Hookup'); intro(); } catch (e) { toast(e.message); }
    };
  }

  function editMe() {
    const p = HK.me, sel = [...p.lookingFor];
    modal(`<h2>Edit Hookup profile</h2>
      <div class="form-grid"><div><label>Status</label><select id="es"><option value="single" ${p.status === 'single' ? 'selected' : ''}>Single</option><option value="complicated" ${p.status === 'complicated' ? 'selected' : ''}>It’s complicated</option></select></div>
      <div><label>Interested in</label><select id="ei">${['everyone', 'women', 'men'].map(x => `<option value="${x}" ${p.interestedIn === x ? 'selected' : ''}>${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select></div></div>
      <label>Looking for (up to 4)</label><div class="hk-chips" id="el">${Object.entries(LOOK).map(([k, [i, l]]) => `<button type="button" class="chip ${sel.includes(k) ? 'on' : ''}" data-k="${k}"><i class="fa-solid ${i}"></i> ${l}</button>`).join('')}</div>
      <label>About you</label><textarea id="eb" rows="3" maxlength="200">${esc(p.bio)}</textarea>
      <div class="form-grid"><div><label>Interests</label><input id="ein" maxlength="100" value="${esc(p.interests)}"></div><div><label>Area near campus</label><input id="ear" maxlength="60" value="${esc(p.area)}"></div></div>
      <div class="err" id="er"></div><div class="row" style="margin-top:12px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn sp" id="esv">Save changes</button></div>`);
    document.querySelectorAll('#el .chip').forEach(b => b.onclick = () => { const k = b.dataset.k, i = sel.indexOf(k); if (i >= 0) sel.splice(i, 1); else if (sel.length < 4) sel.push(k); else return toast('Choose up to 4.'); b.classList.toggle('on', i < 0); });
    $('#esv').onclick = async () => {
      try { const d = await api('/hookup/profile', { method: 'PATCH', body: { status: $('#es').value, interestedIn: $('#ei').value, lookingFor: sel, bio: $('#eb').value, interests: $('#ein').value, area: $('#ear').value } }); HK.me = d.profile; closeModal(); toast('Saved'); tabMe(); }
      catch (e) { $('#er').textContent = e.message; }
    };
  }
})();