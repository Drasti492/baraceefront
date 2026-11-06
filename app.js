const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TI = { student: ['fa-graduation-cap', 'Student'], business: ['fa-store', 'Business'], community: ['fa-people-group', 'Community'] };
const LIM = { img: 3 * 1048576, vid: 15 * 1048576 };
let me = null, view = 'home', filt = {}, chatWith = null, stories = [], pendingFile = null;
const tok = () => localStorage.getItem('bc_token');

async function api(path, o = {}) {
  const h = { ...(tok() ? { Authorization: 'Bearer ' + tok() } : {}) };
  if (o.body && !(o.body instanceof FormData)) { h['Content-Type'] = 'application/json'; o.body = JSON.stringify(o.body); }
  const r = await fetch('/api' + path, { ...o, headers: h }), d = await r.json().catch(() => ({}));
  if (r.status === 401 && tok() && !path.startsWith('/auth')) { logout(); }
  if (!r.ok) throw Object.assign(new Error(d.error || 'Something went wrong'), { data: d });
  return d;
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', 2800); }
const ago = d => { const s = (Date.now() - new Date(d)) / 1000; return s < 60 ? 'now' : s < 3600 ? ~~(s / 60) + 'm' : s < 86400 ? ~~(s / 3600) + 'h' : ~~(s / 86400) + 'd'; };

/* ---------- reusable bits ---------- */
const avatar = (u, c = '') => `<span class="avw ${c}">${u.avatar ? `<img class="av" src="${u.avatar}" alt="">` : `<span class="av">${esc(u.username[0].toUpperCase())}</span>`}<span class="dot ${u.online ? 'on' : ''}" title="${u.online ? 'Online' : 'Offline'}"></span></span>`;
const name = u => `<span class="nm"><i class="fa-solid ${TI[u.type][0]} t-${u.type}" title="${TI[u.type][1]}"></i>${esc(u.bizName && u.type === 'business' ? u.bizName : u.username)}${u.verified ? '<i class="fa-solid fa-circle-check vf" title="Verified business"></i>' : ''}</span>`;

/* ---------- theme ---------- */
function setTheme(t) { document.documentElement.dataset.theme = t; localStorage.setItem('bc_theme', t); const i = $('#themeBtn i'); if (i) i.className = 'fa-solid ' + (t === 'dark' ? 'fa-sun' : 'fa-moon'); }
setTheme(localStorage.getItem('bc_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
$('#themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

/* ---------- auth ---------- */
const modal = h => { $('#sheet').innerHTML = h; $('#modal').classList.add('on'); }, closeModal = () => $('#modal').classList.remove('on');
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
document.querySelectorAll('[data-auth]').forEach(b => b.onclick = () => b.dataset.auth === 'login' ? loginForm() : signupStep(1));

function loginForm() {
  modal(`<h2>Welcome back</h2><label>Username</label><input id="lu" autocomplete="username"><label>Password</label><input id="lp" type="password" autocomplete="current-password"><div class="err" id="er"></div>
  <div class="row" style="margin-top:16px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn sp" id="lg">Login</button></div>
  <p class="mute" style="margin-top:12px">New here? <a href="#" onclick="signupStep(1);return false">Create an account</a></p>`);
  $('#lg').onclick = async () => { try { const d = await api('/auth/login', { method: 'POST', body: { username: $('#lu').value, password: $('#lp').value } }); localStorage.setItem('bc_token', d.token); closeModal(); start(); } catch (e) { $('#er').textContent = e.message; } };
}
const S = { type: 'student' };
function signupStep(n) {
  const isBiz = S.type === 'business', total = isBiz ? 4 : 3, bar = `<div class="steps">${[...Array(total)].map((_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
  const nav = (back, next, label = 'Next') => `<div class="err" id="er"></div><div class="row" style="margin-top:16px">${back ? `<button class="btn ghost" id="bk">Back</button>` : `<button class="btn ghost" onclick="closeModal()">Cancel</button>`}<button class="btn sp" id="nx">${label}</button></div>`;
  const grab = ids => ids.forEach(i => S[i] = $('#' + i)?.value.trim());
  if (n === 1) { modal(`${bar}<h2>Create your account</h2><label>Username</label><input id="username" value="${esc(S.username || '')}" autocomplete="username"><label>Email (we send a confirmation link)</label><input id="email" type="email" value="${esc(S.email || '')}"><label>Password (8+ characters)</label><input id="password" type="password" autocomplete="new-password">${nav(0)}`);
    $('#nx').onclick = () => { grab(['username', 'email', 'password']); if (!/^[a-z0-9_.]{3,20}$/i.test(S.username) || !/^\S+@\S+\.\S+$/.test(S.email) || S.password.length < 8) return $('#er').textContent = 'Check username, email and a password of 8+ characters.'; signupStep(2); }; }
  if (n === 2) { modal(`${bar}<h2>I am a...</h2><div class="types">${Object.entries(TI).map(([k, [i, l]]) => `<button data-k="${k}" class="${S.type === k ? 'on' : ''}"><i class="fa-solid ${i}"></i>${l}</button>`).join('')}</div><p class="mute" style="margin-top:10px">Business owners add a few details next. The verified badge is given only after we visit and confirm your business.</p>${nav(1)}`);
    document.querySelectorAll('.types button').forEach(b => b.onclick = () => { S.type = b.dataset.k; signupStep(2); });
    $('#bk').onclick = () => signupStep(1); $('#nx').onclick = () => signupStep(3); }
  if (n === 3 && isBiz) { modal(`${bar}<h2>Business details</h2><label>Business name</label><input id="bizName" value="${esc(S.bizName || '')}"><label>Location (stage, building, street)</label><input id="bizLocation" value="${esc(S.bizLocation || '')}"><label>Permit / registration no. (optional)</label><input id="bizPermit" value="${esc(S.bizPermit || '')}">${nav(1)}`);
    $('#bk').onclick = () => signupStep(2); $('#nx').onclick = () => { grab(['bizName', 'bizLocation', 'bizPermit']); if (!S.bizName || !S.bizLocation) return $('#er').textContent = 'Business name and location are required.'; signupStep(4); }; }
  if (n === total) { modal(`${bar}<h2>Ready to join</h2><p class="mute">Account: <b>${esc(S.username)}</b> (${TI[S.type][1]})<br>We will email ${esc(S.email)} to confirm it.</p>${nav(1, 1, 'Create account')}`);
    $('#bk').onclick = () => signupStep(total - 1);
    $('#nx').onclick = async () => { try { await api('/auth/signup', { method: 'POST', body: S }); modal(`<h2><i class="fa-solid fa-envelope-circle-check"></i> Check your email</h2><p class="mute">Click the link we sent to confirm, then log in.</p><button class="btn" style="margin-top:14px" onclick="loginForm()">Go to login</button>`); } catch (e) { $('#er').textContent = e.message; } }; }
}
function logout() { localStorage.removeItem('bc_token'); me = null; $('#app').hidden = true; $('#landing').style.display = ''; }
$('#logoutBtn').onclick = logout;

/* ---------- app start ---------- */
const NAV = [['home', 'fa-house', 'Home'], ['market', 'fa-shop', 'Marketplace'], ['inbox', 'fa-message', 'Inbox'], ['profile', 'fa-user', 'Profile']];
async function start() {
  if (!tok()) return;
  try { me = await api('/me'); } catch { return; }
  $('#landing').style.display = 'none'; $('#app').hidden = false;
  $('#nav').innerHTML = NAV.map(([k, i, l]) => `<button data-k="${k}" data-tip="${l}" aria-label="${l}"><i class="fa-solid ${i}"></i><span>${l}</span></button>`).join('');
  document.querySelectorAll('#nav button').forEach(b => b.onclick = () => go(b.dataset.k));
  go('home'); side(); setInterval(() => { api('/ping', { method: 'POST' }).catch(() => { }); side(); }, 60000); api('/ping', { method: 'POST' }).catch(() => { });
}
function go(v) { view = v; document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.k === v)); ({ home: rHome, market: rMarket, inbox: rInbox, profile: rProfile })[v](); $('#main').scrollTop = 0; }
async function side() {
  try {
    const [t, o] = await Promise.all([api('/trending'), api('/online')]);
    $('#trend').innerHTML = t.map(x => `<div class="tag" data-t="${esc(x._id)}"><b>#${esc(x._id)}</b><span class="mute">${x.n} posts</span></div>`).join('') || '<p class="mute">Use #hashtags in posts to start a trend.</p>';
    document.querySelectorAll('.tag').forEach(e => e.onclick = () => { filt = { tag: e.dataset.t }; go('home'); });
    $('#online').innerHTML = o.map(u => `<div class="row" style="margin-bottom:10px">${avatar(u, 'sm')}${name(u)}</div>`).join('') || '<p class="mute">Nobody online yet.</p>';
  } catch { }
}

/* ---------- home: stories + posts ---------- */
async function rHome() {
  $('#main').innerHTML = `<div class="v"><div class="card"><div class="stories" id="st"></div></div>
  <div class="card"><textarea id="ptx" rows="2" placeholder="What's happening around campus? Use #hashtags"></textarea><div id="prev"></div>
  <div class="row" style="margin-top:10px"><label class="btn ghost sm"><i class="fa-solid fa-image"></i> Photo / video<input type="file" id="pf" accept="image/*,video/*" hidden></label><span class="mute">3MB photo, 15MB / 30s video</span><button class="btn sp" id="pb"><i class="fa-solid fa-paper-plane"></i> Post</button></div></div>
  <div class="filters"><select id="fs"><option value="new">Newest</option><option value="oldest">Oldest</option><option value="popular">Most liked</option></select>
  <select id="ft"><option value="">All people</option><option value="student">Students</option><option value="business">Businesses</option><option value="community">Community</option></select>
  ${filt.tag ? `<button class="btn ghost sm" id="clr">#${esc(filt.tag)} <i class="fa-solid fa-xmark"></i></button>` : ''}</div><div id="feed"></div></div>`;
  $('#fs').value = filt.sort || 'new'; $('#ft').value = filt.type || '';
  $('#fs').onchange = e => { filt.sort = e.target.value; loadFeed(); }; $('#ft').onchange = e => { filt.type = e.target.value; loadFeed(); };
  if ($('#clr')) $('#clr').onclick = () => { delete filt.tag; rHome(); };
  $('#pf').onchange = pickMedia; $('#pb').onclick = post; pendingFile = null;
  loadStories(); loadFeed();
}
function pickMedia(e) {
  const f = e.target.files[0]; if (!f) return; const vid = f.type.startsWith('video');
  if (f.size > (vid ? LIM.vid : LIM.img)) return toast('File too large');
  const src = URL.createObjectURL(f);
  const show = () => { pendingFile = f; $('#prev').innerHTML = vid ? `<video class="media" controls src="${src}"></video>` : `<img class="media" src="${src}" alt="">`; };
  if (!vid) return show();
  const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => v.duration > 30 ? toast('Videos must be 30 seconds or less') : show(); v.src = src;
}
async function post() {
  const fd = new FormData(); fd.append('text', $('#ptx').value); if (pendingFile) fd.append('f', pendingFile);
  try { await api('/posts', { method: 'POST', body: fd }); toast('Posted'); rHome(); side(); } catch (e) { toast(e.message); }
}
async function loadFeed() {
  const q = new URLSearchParams(filt).toString();
  try {
    const ps = await api('/posts?' + q);
    $('#feed').innerHTML = ps.map(p => `<div class="card" data-id="${p.id}"><div class="row">${avatar(p.user)}<div>${name(p.user)}<div class="mute">${ago(p.createdAt)}</div></div></div>
    <p style="margin-top:10px;line-height:1.5;overflow-wrap:anywhere">${esc(p.text).replace(/#(\w+)/g, '<a href="#" class="ht" data-t="$1">#$1</a>')}</p>
    ${p.media ? (/\.(mp4|webm|mov)$/i.test(p.media) ? `<video class="media" controls src="${p.media}"></video>` : `<img class="media" src="${p.media}" alt="">`) : ''}
    <div class="acts"><button class="lk" data-tip="Like"><i class="fa-regular fa-heart"></i> ${p.likes}</button><button class="cmb" data-tip="Comments"><i class="fa-regular fa-comment"></i> ${p.comments.length}</button>
    ${p.user.id !== me.id ? `<button class="msg" data-u="${p.user.id}" data-n="${esc(p.user.username)}" data-tip="Message"><i class="fa-regular fa-paper-plane"></i></button>` : ''}<button class="shb" data-tip="Share"><i class="fa-solid fa-share-nodes"></i></button></div>
    <div class="share"><a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(p.text.slice(0, 120) + ' ' + location.origin)}"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a><button class="btn ghost sm ig"><i class="fa-brands fa-instagram"></i> Instagram</button></div>
    <div class="cms" hidden>${p.comments.map(c => `<div class="cm"><b>${esc(c.user)}</b>${esc(c.text)}</div>`).join('')}<div class="row" style="margin-top:8px"><input class="ci" placeholder="Write a comment"><button class="btn sm cs">Send</button></div></div></div>`).join('') || '<p class="mute">No posts match. Be the first!</p>';
    document.querySelectorAll('.ht').forEach(a => a.onclick = e => { e.preventDefault(); filt.tag = a.dataset.t; rHome(); });
    document.querySelectorAll('#feed .card').forEach(c => {
      const id = c.dataset.id;
      c.querySelector('.lk').onclick = async e => { const d = await api(`/posts/${id}/like`, { method: 'POST' }); e.currentTarget.classList.toggle('liked'); e.currentTarget.innerHTML = `<i class="fa-${e.currentTarget.classList.contains('liked') ? 'solid' : 'regular'} fa-heart"></i> ${d.likes}`; };
      c.querySelector('.cmb').onclick = () => c.querySelector('.cms').hidden = !c.querySelector('.cms').hidden;
      c.querySelector('.shb').onclick = () => c.querySelector('.share').classList.toggle('on');
      c.querySelector('.ig').onclick = () => { navigator.clipboard?.writeText(location.origin); toast('Link copied. Paste it in your Instagram story or DM.'); window.open('https://www.instagram.com/', '_blank'); };
      const mb = c.querySelector('.msg'); if (mb) mb.onclick = () => { chatWith = { id: mb.dataset.u, username: mb.dataset.n, type: 'student' }; go('inbox'); };
      c.querySelector('.cs').onclick = async () => { const i = c.querySelector('.ci'); if (!i.value.trim()) return; try { await api(`/posts/${id}/comments`, { method: 'POST', body: { text: i.value } }); loadFeed(); } catch (e) { toast(e.message); } };
    });
  } catch (e) { $('#feed').innerHTML = `<p class="mute">${esc(e.message)}</p>`; }
}
async function loadStories() {
  try { stories = await api('/stories'); } catch { stories = []; }
  $('#st').innerHTML = `<div class="story add" id="addSt"><div class="ring"><span class="av" style="background:var(--line);color:var(--text)"><i class="fa-solid fa-plus"></i></span></div>Add</div>` +
    stories.map((s, i) => `<div class="story" data-i="${i}"><div class="ring">${s.user.avatar ? `<img class="av" src="${s.user.avatar}" alt="">` : `<span class="av">${esc(s.user.username[0].toUpperCase())}</span>`}</div>${esc(s.user.username.slice(0, 9))}</div>`).join('');
  $('#addSt').onclick = addStory; document.querySelectorAll('.story[data-i]').forEach(e => e.onclick = () => viewStory(+e.dataset.i));
}
function addStory() {
  modal(`<h2>Add story</h2><textarea id="stx" rows="3" maxlength="200" placeholder="Share a quick update (gone in 24h)"></textarea><label>Photo / video (optional)</label><input type="file" id="sf" accept="image/*,video/*">
  <div class="row" style="margin-top:14px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn sp" id="ss">Share</button></div>`);
  $('#ss').onclick = async () => { const f = $('#sf').files[0]; if (f && f.size > (f.type.startsWith('video') ? LIM.vid : LIM.img)) return toast('File too large'); const fd = new FormData(); fd.append('text', $('#stx').value); if (f) fd.append('f', f); try { await api('/stories', { method: 'POST', body: fd }); closeModal(); loadStories(); } catch (e) { toast(e.message); } };
}
function viewStory(i) {
  const s = stories[i];
  modal(`<div class="row" style="margin-bottom:10px">${avatar(s.user, 'sm')}${name(s.user)}</div><div class="story-box">${s.media ? (/\.(mp4|webm|mov)$/i.test(s.media) ? `<video controls autoplay src="${s.media}"></video>` : `<img src="${s.media}" alt="">`) : ''}<div>${esc(s.text)}</div></div>
  ${s.user.id !== me.id ? `<div class="row" style="margin-top:12px;flex-wrap:nowrap"><input id="sr" placeholder="Reply to ${esc(s.user.username)}..."><button class="btn" id="srb" aria-label="Send reply"><i class="fa-solid fa-paper-plane"></i></button></div>` : ''}
  <div class="row" style="margin-top:12px"><button class="btn ghost" onclick="closeModal()">Close</button>${i < stories.length - 1 ? `<button class="btn sp" id="nxs">Next <i class="fa-solid fa-chevron-right"></i></button>` : ''}</div>`);
  if ($('#nxs')) $('#nxs').onclick = () => viewStory(i + 1);
  if ($('#srb')) $('#srb').onclick = async () => { const v = $('#sr').value.trim(); if (!v) return; try { await api(`/stories/${s.id}/reply`, { method: 'POST', body: { text: v } }); toast('Reply sent to their inbox'); closeModal(); } catch (e) { toast(e.message); } };
}

/* ---------- marketplace ---------- */
async function rMarket() {
  $('#main').innerHTML = `<div class="v"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Marketplace</h2><button class="btn sp" id="sell"><i class="fa-solid fa-plus"></i> Sell</button></div>
  <input id="mq" placeholder="Search items or services" style="margin-bottom:12px"><div class="grid" id="mg"></div><h2 style="margin:24px 0 12px">My listings</h2><div id="mine"></div></div>`;
  const load = async () => { const l = await api('/listings?q=' + encodeURIComponent($('#mq').value));
    $('#mg').innerHTML = l.map(x => `<div class="item"><div class="pic">${x.image ? `<img src="${x.image}" alt="">` : '<i class="fa-solid fa-box"></i>'}</div><div class="bd"><b>${esc(x.title)}</b><span class="price">KSh ${x.price.toLocaleString()}</span>${name(x.user)}<button class="btn sm msg" data-u="${x.user.id}" data-n="${esc(x.user.username)}"><i class="fa-solid fa-message"></i> Message</button></div></div>`).join('') || '<p class="mute">Nothing here yet.</p>';
    document.querySelectorAll('#mg .msg').forEach(b => b.onclick = () => { chatWith = { id: b.dataset.u, username: b.dataset.n, type: 'student' }; go('inbox'); }); };
  const mine = async () => { const l = await api('/my-listings'), now = Date.now();
    $('#mine').innerHTML = l.map(x => { const live = new Date(x.expiresAt) > now; return `<div class="card row"><div><b>${esc(x.title)}</b> <span class="pill ${live ? 'ok' : ''}">${live ? 'Live' : 'Expired'}</span><div class="mute">${live ? 'Hidden in ' + Math.max(1, Math.round((new Date(x.expiresAt) - now) / 36e5)) + 'h' : 'Deleted for good ' + new Date(x.deleteAt).toLocaleDateString()}</div></div><span class="sp row"><button class="btn sm ghost rn" data-id="${x._id}"><i class="fa-solid fa-rotate"></i> Renew</button><button class="btn sm ghost dl" data-id="${x._id}"><i class="fa-solid fa-trash"></i></button></span></div>`; }).join('') || '<p class="mute">You have no listings.</p>';
    document.querySelectorAll('.rn').forEach(b => b.onclick = async () => { await api(`/listings/${b.dataset.id}/renew`, { method: 'POST' }); load(); mine(); });
    document.querySelectorAll('.dl').forEach(b => b.onclick = async () => { if (confirm('Delete this listing for good?')) { await api('/listings/' + b.dataset.id, { method: 'DELETE' }); load(); mine(); } }); };
  $('#mq').oninput = load; $('#sell').onclick = () => sell(load, mine); load(); mine();
}
function sell(load, mine) {
  modal(`<h2>Sell something</h2><label>Item name</label><input id="lt" maxlength="80"><label>Price (KSh)</label><input id="lpr" type="number" inputmode="numeric"><label>Photo (max 3MB)</label><input type="file" id="lf" accept="image/*"><p class="mute" style="margin-top:10px">Listings show for 30 hours. After that they are hidden, and you can renew them for 3 days before they are deleted for good.</p><div class="err" id="er"></div>
  <div class="row" style="margin-top:14px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn sp" id="pub">Publish</button></div>`);
  $('#pub').onclick = async () => { const f = $('#lf').files[0]; if (f && f.size > LIM.img) return $('#er').textContent = 'Photo too large'; const fd = new FormData(); fd.append('title', $('#lt').value); fd.append('price', $('#lpr').value); if (f) fd.append('f', f);
    try { await api('/listings', { method: 'POST', body: fd }); closeModal(); load(); mine(); } catch (e) { $('#er').innerHTML = esc(e.message) + (e.data?.pay ? '<br><button class="btn sm" id="pay" style="margin-top:8px">Pay KSh 50 via M-Pesa</button>' : ''); if ($('#pay')) $('#pay').onclick = () => payForm('listing'); } };
}
function payForm(purpose, target) {
  modal(`<h2><i class="fa-solid fa-mobile-screen"></i> M-Pesa payment</h2><label>Phone number (07...)</label><input id="ph" inputmode="numeric" maxlength="10"><div class="err" id="er"></div><div class="row" style="margin-top:14px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn sp" id="pp">Send prompt</button></div>`);
  $('#pp').onclick = async () => { try { const d = await api('/pay', { method: 'POST', body: { purpose, target, phone: $('#ph').value } }); closeModal(); toast(d.msg); } catch (e) { $('#er').textContent = e.message; } };
}

/* ---------- inbox ---------- */
async function rInbox() {
  let th = []; try { th = await api('/threads'); } catch { }
  if (chatWith && !th.find(t => t.id === chatWith.id)) th.unshift(chatWith);
  if (!chatWith && th.length) chatWith = th[0];
  $('#main').innerHTML = `<div class="v"><h2>Inbox</h2><div class="card chat"><div class="threads">${th.map(t => `<button class="th ${chatWith?.id === t.id ? 'on' : ''}" data-id="${t.id}">${t.online !== undefined ? avatar(t, 'sm') : ''}${esc(t.username)}</button>`).join('') || '<p class="mute">No chats yet.</p>'}</div>
  <div>${chatWith ? `<div class="msgs" id="ms"></div><div class="row" style="margin-top:10px;flex-wrap:nowrap"><input id="mi" placeholder="Type a message"><button class="btn" id="sd" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button></div>` : '<p class="mute">Pick a chat.</p>'}</div></div></div>`;
  document.querySelectorAll('.th').forEach(b => b.onclick = () => { chatWith = th.find(t => t.id === b.dataset.id); rInbox(); });
  if (!chatWith) return;
  const load = async () => { const m = await api('/messages/' + chatWith.id); $('#ms').innerHTML = m.map(x => `<div class="m ${x.from === me.id ? 'me' : ''}">${esc(x.text)}</div>`).join('') || '<p class="mute">Say hi</p>'; $('#ms').scrollTop = 1e9; };
  const send = async () => { const v = $('#mi').value.trim(); if (!v) return; await api('/messages/' + chatWith.id, { method: 'POST', body: { text: v } }); $('#mi').value = ''; load(); };
  $('#sd').onclick = send; $('#mi').onkeydown = e => e.key === 'Enter' && send(); load();
}

/* ---------- profile ---------- */
function rProfile() {
  $('#main').innerHTML = `<div class="v"><div class="card" style="text-align:center">${avatar({ ...me, online: true }, 'lg')}<h2 style="margin-top:12px">${name(me)}</h2>
  <span class="pill ok"><i class="fa-solid fa-circle" style="font-size:8px"></i> Online</span> <span class="pill"><i class="fa-solid ${TI[me.type][0]}"></i> ${TI[me.type][1]}</span>
  ${me.type === 'business' && !me.verified ? '<p class="mute" style="margin:12px 0">Pending verification. We will visit your business, then give you the verified badge.</p>' : ''}
  <div style="margin-top:14px"><label class="btn ghost sm"><i class="fa-solid fa-camera"></i> Change photo<input type="file" id="avf" accept="image/*" hidden></label></div></div></div>`;
  $('#avf').onchange = async e => { const f = e.target.files[0]; if (!f || f.size > LIM.img) return toast('Photo too large (3MB max)'); const fd = new FormData(); fd.append('f', f); await api('/avatar', { method: 'POST', body: fd }); me = await api('/me'); rProfile(); };
}

/* ---------- search + AI ---------- */
$('#searchBtn').onclick = () => {
  modal(`<h2>Search</h2><input id="sq" placeholder="People or posts" autofocus><div id="sr" style="margin-top:12px"></div>`);
  let t; $('#sq').oninput = e => { clearTimeout(t); t = setTimeout(async () => { const q = e.target.value.trim(); if (q.length < 2) return; const d = await api('/search?q=' + encodeURIComponent(q));
    $('#sr').innerHTML = d.users.map(u => `<div class="row" style="margin-bottom:10px">${avatar(u, 'sm')}${name(u)}<button class="btn sm ghost sp msg" data-u="${u.id}" data-n="${esc(u.username)}"><i class="fa-solid fa-message"></i></button></div>`).join('') + d.posts.map(p => `<div class="cm"><b>${esc(p.user.username)}</b>${esc(p.text.slice(0, 90))}</div>`).join('') || '<p class="mute">No results.</p>';
    document.querySelectorAll('#sr .msg').forEach(b => b.onclick = () => { chatWith = { id: b.dataset.u, username: b.dataset.n, type: 'student' }; closeModal(); go('inbox'); }); }, 300); };
};
const bw = document.createElement('div'); bw.className = 'bot-win';
bw.innerHTML = `<b><i class="fa-solid fa-robot"></i> Bara Cee Helper</b><div class="bot-log" id="bl"><div class="m">Hi! Ask me to find items, services or verified businesses.</div></div><div class="row" style="flex-wrap:nowrap"><input id="bi" placeholder="e.g. laundry service"><button class="btn" id="bs" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button></div>`;
document.body.append(bw);
$('#botBtn').onclick = () => bw.classList.toggle('on');
async function ask() { const v = $('#bi').value.trim(); if (!v) return; $('#bi').value = ''; const l = $('#bl'); l.innerHTML += `<div class="m me">${esc(v)}</div>`; try { const d = await api('/ai', { method: 'POST', body: { text: v } }); l.innerHTML += `<div class="m">${esc(d.reply)}</div>`; } catch (e) { l.innerHTML += `<div class="m">${esc(e.message)}</div>`; } l.scrollTop = 1e9; }
$('#bs').onclick = ask; $('#bi').onkeydown = e => e.key === 'Enter' && ask();

if (new URLSearchParams(location.search).get('verified') === '1') { history.replaceState({}, '', '/'); loginForm(); toast('Email confirmed. Please log in.'); }
start();