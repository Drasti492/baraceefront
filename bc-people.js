/* bc-people.js — profiles, disciples, ratings, block, edit profile, settings, privacy, support. */
(() => {
  // Create a free form at formspree.io and paste its URL here (looks like https://formspree.io/f/abcdwxyz)
  const FORMSPREE_URL = 'https://formspree.io/f/mljbrnpn';
  const YEARS = ['1st year', '2nd year', '3rd year', '4th year', 'Super senior', 'Alumni'];
  const dispName = u => u.bizName && u.type === 'business' ? u.bizName : (u.displayName || u.username);

  /* ---------- open a profile ---------- */
  BC.showUser = async id => {
    if (!id) return;
    if (id === me.id) return go('profile');
    BC.prev = view; view = 'user';
    document.querySelectorAll('#nav button').forEach(b => b.classList.remove('on'));
    closeModal();
    $('#main').innerHTML = '<div class="v"><p class="mute">Loading profile…</p></div>';
    $('#main').scrollTop = 0;
    try { render(await api(`/users/${id}/profile`)); }
    catch (e) { $('#main').innerHTML = `<div class="v"><div class="card"><p class="mute">${esc(e.message)}</p><button class="btn ghost sm" id="bk">Back</button></div></div>`; $('#bk').onclick = () => go('home'); }
  };
  window.rProfile = async () => {
    try { render(await api(`/users/${me.id}/profile`)); } catch (e) { toast(e.message); }
  };

  const stars = (n, mine) => [1, 2, 3, 4, 5].map(i => `<button class="star ${i <= mine ? 'on' : ''}" data-s="${i}" aria-label="${i} star${i > 1 ? 's' : ''}"><i class="fa-${i <= mine ? 'solid' : 'regular'} fa-star"></i></button>`).join('');

  function render(d) {
    const u = d.user, st = d.stats, isMe = d.isMe, [ico, label] = TI[u.type] || ['fa-user', 'Member'];
    const items = [];
    const add = (ic, lab, val) => { if (val) items.push(`<li><span class="ii"><i class="fa-solid ${ic}"></i></span><div><small>${lab}</small><b>${val}</b></div></li>`); };
    add('fa-location-dot', 'Stays at', esc(u.stay));
    if (u.type === 'student') { add('fa-book-open', 'Course', esc(u.course)); add('fa-graduation-cap', 'Year', esc(u.yearOfStudy)); }
    if (u.type === 'business') { add('fa-store', 'Business', esc(u.bizName)); add('fa-map-pin', 'Location', esc(u.bizLocation)); }
    add('fa-cake-candles', 'Age', u.age);
    add('fa-heart', 'Hobbies', esc(u.hobbies));
    if (u.website) add('fa-link', 'Website', `<a class="chip-link" href="${esc(u.website)}" target="_blank" rel="noopener noreferrer">${esc(u.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}<i class="fa-solid fa-arrow-up-right-from-square"></i></a>`);
    add('fa-calendar', 'Joined', new Date(u.joinedAt).toLocaleDateString([], { month: 'short', year: 'numeric' }));
    const status = u.online ? '<span class="pill ok"><i class="fa-solid fa-circle" style="font-size:7px"></i> Online</span>'
      : u.lastSeen ? `<span class="pill">${BC.lastSeen(u.lastSeen)}</span>` : '';

    $('#main').innerHTML = `
      <div class="v">
        ${isMe ? '' : '<button class="lnk back" id="bk"><i class="fa-solid fa-arrow-left"></i> Back</button>'}
        <div class="card prof">
          <div class="prof-top">
            <span class="prof-av">${avatar({ ...u, online: isMe ? true : u.online }, 'lg')}
              ${isMe ? '<label class="prof-cam" aria-label="Change photo"><i class="fa-solid fa-camera"></i><input type="file" id="avf" accept="image/*" hidden></label>' : ''}</span>
            <div class="prof-id">
              <h2>${esc(dispName(u))}${u.verified ? ' <i class="fa-solid fa-circle-check vf" title="Verified"></i>' : ''}</h2>
              <div class="prof-un">@${esc(u.username)}</div>
              <div class="pill-row"><span class="pill"><i class="fa-solid ${ico}"></i> ${label}</span>${status}${isMe && d.user.lockPosts ? '<span class="pill"><i class="fa-solid fa-lock"></i> Posts locked</span>' : ''}</div>
            </div>
          </div>
          <div class="prof-stats">
            <div><b>${st.disciples}</b><span>Disciples</span></div>
            <div><b>${st.discipling}</b><span>Discipling</span></div>
            <div><b>${st.posts}</b><span>Posts</span></div>
            <div><b>${st.rating.n ? st.rating.avg : '–'}<i class="fa-solid fa-star" style="color:var(--warn);font-size:11px;margin-left:3px"></i></b><span>${st.rating.n} rating${st.rating.n === 1 ? '' : 's'}</span></div>
          </div>
          ${u.bio ? `<p class="prof-bio">${esc(u.bio)}</p>` : isMe ? '<p class="prof-bio mute">Add a short bio so people know who you are.</p>' : ''}
          ${items.length ? `<ul class="info">${items.join('')}</ul>` : ''}
          <div class="prof-actions">
            ${isMe ? `<button class="btn sm" id="epb"><i class="fa-solid fa-pen"></i> Edit profile</button><button class="btn ghost sm" id="stb"><i class="fa-solid fa-gear"></i> Settings</button>`
              : `<button class="btn sm ${d.iDisciple ? 'ghost' : ''}" id="dsc" ${d.iBlocked || d.blockedMe ? 'disabled' : ''}><i class="fa-solid ${d.iDisciple ? 'fa-check' : 'fa-user-plus'}"></i> ${d.iDisciple ? 'Disciple' : 'Be a disciple'}</button>
                 <button class="btn ghost sm" id="pmsg"><i class="fa-regular fa-paper-plane"></i> Message</button>
                 <button class="btn ghost sm icon" id="pmore" aria-label="More"><i class="fa-solid fa-ellipsis"></i></button>`}
          </div>
          ${!isMe && !d.iBlocked && !d.blockedMe ? `<div class="rate-row"><span>Rate ${esc(u.username)}</span><span class="stars" id="stars">${stars(0, st.rating.mine)}</span></div>` : ''}
          ${d.iBlocked ? '<p class="mute" style="margin-top:10px"><i class="fa-solid fa-ban"></i> You blocked this account.</p>' : ''}
        </div>
        <h3 class="sec-h">Posts</h3>
        <div id="uposts"><p class="mute">Loading posts…</p></div>
      </div>`;

    if ($('#bk')) $('#bk').onclick = () => go(BC.prev && BC.prev !== 'user' ? BC.prev : 'home');
    if (isMe) {
      $('#epb').onclick = () => editProfile(u);
      $('#stb').onclick = () => go('settings');
      $('#avf').onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        if (f.size > 10 * 1048576) return toast('Photo too large (10MB max)');
        const out = await BC.cropImage(f); if (!out) return;
        const fd = new FormData(); fd.append('f', out);
        try { await api('/avatar', { method: 'POST', body: fd }); me = await api('/me'); rProfile(); toast('Profile photo updated'); } catch (err) { toast(err.message); }
      };
    } else {
      $('#pmsg').onclick = () => { chatWith = { id: u.id, username: u.username, type: u.type, avatar: u.avatar }; go('inbox'); };
      $('#dsc').onclick = async () => {
        try { await api(`/users/${u.id}/disciple`, { method: 'POST' }); BC.showUser(u.id); } catch (e) { toast(e.message); }
      };
      $('#pmore').onclick = e => {
        document.querySelector('.ctx-menu')?.remove();
        const r = e.currentTarget.getBoundingClientRect(), m = document.createElement('div');
        m.className = 'ctx-menu';
        m.innerHTML = `<button data-a="copy"><i class="fa-solid fa-link"></i> Copy profile name</button>
          <button data-a="blk" class="danger"><i class="fa-solid fa-ban"></i> ${d.iBlocked ? 'Unblock' : 'Block'} @${esc(u.username)}</button>`;
        document.body.appendChild(m);
        m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
        m.style.top = r.bottom + 4 + 'px';
        setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
        m.onclick = async ev => {
          const a = ev.target.closest('button')?.dataset.a;
          if (a === 'copy') { navigator.clipboard?.writeText('@' + u.username); toast('Copied'); }
          if (a === 'blk') await toggleBlock(u, d.iBlocked, () => BC.showUser(u.id));
        };
      };
      document.querySelectorAll('#stars .star').forEach(b => b.onclick = async () => {
        const n = +b.dataset.s, cur = st.rating.mine;
        try { await api(`/users/${u.id}/rate`, { method: 'POST', body: { stars: n === cur ? 0 : n } }); BC.showUser(u.id); } catch (e) { toast(e.message); }
      });
    }

    const reload = async () => {
      try {
        const r = await api(`/users/${u.id}/posts`);
        const box = $('#uposts'); if (!box) return;
        if (r.locked) box.innerHTML = '<div class="card empty"><i class="fa-solid fa-lock"></i><p>This account’s posts are locked.</p></div>';
        else BC.renderPosts(box, r.posts, '<div class="card empty"><i class="fa-regular fa-image"></i><p>No posts yet.</p></div>');
      } catch (e) { $('#uposts').innerHTML = `<p class="mute">${esc(e.message)}</p>`; }
    };
    BC.reloadPosts = reload; reload();
  }
  BC.toggleBlock = (u, isBlocked, after) => toggleBlock(u, isBlocked, after);
  async function toggleBlock(u, isBlocked, after) {
    const ok = await BC.confirm(isBlocked
      ? { title: `Unblock @${u.username}?`, message: 'They will be able to message you and comment on your posts again.', confirm: 'Unblock', icon: 'fa-unlock' }
      : { title: `Block @${u.username}?`, message: 'They can still see your profile and posts, but they won’t be able to message you, comment on your posts, rate you or become your disciple.', confirm: 'Block', danger: true, icon: 'fa-ban' });
    if (!ok) return;
    try { await api(`/users/${u.id}/block`, { method: isBlocked ? 'DELETE' : 'POST' }); toast(isBlocked ? 'Unblocked' : 'Blocked'); after && after(); } catch (e) { toast(e.message); }
  }

  /* ---------- edit profile ---------- */
  function editProfile(u) {
    const stu = me.type === 'student';
    modal(`
      <h2>Edit profile</h2>
      <div class="form-grid">
        <div><label>Display name</label><input id="epN" maxlength="40" value="${esc(u.displayName)}"></div>
        <div><label>Username</label><input id="epU" maxlength="20" value="${esc(u.username)}"></div>
      </div>
      <label>Bio <span class="mute" id="bcnt">${(u.bio || '').length}/160</span></label>
      <textarea id="epB" rows="3" maxlength="160" placeholder="Tell people about yourself">${esc(u.bio)}</textarea>
      <label>Where you stay (on campus, off campus, estate…)</label><input id="epS" maxlength="60" value="${esc(u.stay)}">
      ${stu ? `<div class="form-grid">
        <div><label>Course</label><input id="epC" maxlength="60" value="${esc(u.course)}"></div>
        <div><label>Year of study</label><select id="epY"><option value="">Select</option>${YEARS.map(y => `<option ${u.yearOfStudy === y ? 'selected' : ''}>${y}</option>`).join('')}</select></div></div>` : ''}
      <div class="form-grid">
        <div><label>Age (optional)</label><input id="epA" type="number" min="13" max="100" value="${u.age || ''}"></div>
        <div><label>Hobbies</label><input id="epH" maxlength="100" value="${esc(u.hobbies)}"></div>
      </div>
      <label>Website</label><input id="epW" maxlength="100" value="${esc(u.website)}" placeholder="https://">
      <div class="mute" style="margin-top:8px">Everything except your username is optional. Control who sees your age and course in Settings › Privacy.</div>
      <div class="err" id="er"></div>
      <div class="row" style="margin-top:14px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn sp" id="epS2">Save changes</button></div>`);
    $('#epB').oninput = e => { $('#bcnt').textContent = e.target.value.length + '/160'; };
    $('#epS2').onclick = async () => {
      const body = { displayName: $('#epN').value, username: $('#epU').value, bio: $('#epB').value, stay: $('#epS').value, age: $('#epA').value, hobbies: $('#epH').value, website: $('#epW').value };
      if (stu) { body.course = $('#epC').value; body.yearOfStudy = $('#epY').value; }
      $('#epS2').disabled = true;
      try { me = await api('/profile', { method: 'PATCH', body }); closeModal(); rProfile(); toast('Profile saved'); }
      catch (e) { $('#er').textContent = e.message; $('#epS2').disabled = false; }
    };
  }

  /* ======================= SETTINGS ======================= */
  const sw = (id, t, d, on) => `<div class="set-row"><div><b>${t}</b><span class="mute">${d}</span></div><label class="sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></label></div>`;
  window.rSettings = function (sec) {
    if (typeof sec !== 'string') sec = '';
    const back = sec ? '<button class="lnk back" id="sbk"><i class="fa-solid fa-arrow-left"></i> Settings</button>' : '';
    const nav = (k, ic, t, d) => `<button class="set-nav" data-s="${k}"><i class="fa-solid ${ic}"></i><span><b>${t}</b><small>${d}</small></span><i class="fa-solid fa-chevron-right"></i></button>`;
    let body = '';
    if (!sec) body = `<div class="card nopad">
      ${nav('privacy', 'fa-shield-halved', 'Privacy', 'Choose what shows on your profile')}
      ${nav('appearance', 'fa-circle-half-stroke', 'Appearance', 'Light, dark or automatic')}
      ${nav('blocked', 'fa-ban', 'Blocked accounts', 'Manage people you blocked')}
      ${nav('password', 'fa-key', 'Password', 'Change your password')}
      ${nav('support', 'fa-life-ring', 'Support', 'Send a message to the team')}
      <button class="set-nav danger" id="slo"><i class="fa-solid fa-right-from-bracket"></i><span><b>Log out</b></span></button></div>`;
    if (sec === 'privacy') body = `<div class="card"><h2>Privacy</h2>
      ${sw('pAge', 'Show my age', 'Display your age on your profile', me.showAge)}
      ${sw('pEdu', 'Show course & year', 'Display your education on your profile', me.showEducation)}
      ${sw('pLs', 'Show last seen', 'Let others see when you were last active', me.showLastSeen)}
      ${sw('pOn', 'Show online status', 'Show the green online dot', me.showOnlineStatus)}
      ${sw('pLock', 'Lock my posts', 'Only you can see your posts. Turn off to make them public', me.lockPosts)}</div>`;
    if (sec === 'appearance') body = `<div class="card"><h2>Appearance</h2><div class="set-row"><div><b>Theme</b><span class="mute">Match your device or pick one</span></div>
      <select id="sth" style="width:auto"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div></div>`;
    if (sec === 'blocked') body = `<div class="card"><h2>Blocked accounts</h2><div id="bl2"><p class="mute">Loading…</p></div></div>`;
    if (sec === 'password') body = `<div class="card"><h2>Change password</h2>
      <label>Current password</label><input id="pc" type="password" autocomplete="current-password">
      <label>New password (6+ characters)</label><input id="pn" type="password" autocomplete="new-password">
      <div class="err" id="er"></div><button class="btn" id="pw" style="margin-top:12px">Update password</button></div>`;
    if (sec === 'support') body = `<div class="card"><h2>Support</h2><p class="mute">Tell us what went wrong or what you need. Keep it short — 150 characters.</p>
      <textarea id="sup" rows="4" maxlength="150" placeholder="Describe your problem…"></textarea>
      <div class="mute" style="text-align:right"><span id="scnt">0/150</span></div>
      <div class="err" id="er"></div><button class="btn" id="sbm" style="margin-top:8px"><i class="fa-solid fa-paper-plane"></i> Submit</button></div>`;

    $('#main').innerHTML = `<div class="v">${back || '<h2>Settings</h2>'}${body}</div>`;
    if ($('#sbk')) $('#sbk').onclick = () => rSettings();
    document.querySelectorAll('.set-nav[data-s]').forEach(b => b.onclick = () => rSettings(b.dataset.s));
    if ($('#slo')) $('#slo').onclick = async () => { if (await BC.confirm({ title: 'Log out?', message: 'You will need to log in again to use Bara Cee.', confirm: 'Log out', icon: 'fa-right-from-bracket' })) logout(); };

    const save = async patch => { try { me = await api('/settings', { method: 'PATCH', body: patch }); toast('Saved'); } catch (e) { toast(e.message); rSettings(sec); } };
    [['pAge', 'showAge'], ['pEdu', 'showEducation'], ['pLs', 'showLastSeen'], ['pOn', 'showOnlineStatus'], ['pLock', 'lockPosts']].forEach(([id, k]) => { if ($('#' + id)) $('#' + id).onchange = e => save({ [k]: e.target.checked }); });
    if ($('#sth')) {
      $('#sth').value = me.theme || 'system';
      $('#sth').onchange = e => { const t = e.target.value; setTheme(t === 'system' ? (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') : t); save({ theme: t }); };
    }
    if ($('#bl2')) api('/blocks').then(l => {
      $('#bl2').innerHTML = l.map(u => `<div class="row" style="padding:8px 0">${avatar(u, 'sm')}${name(u)}<button class="btn ghost sm sp ub" data-id="${u.id}">Unblock</button></div>`).join('') || '<p class="mute">You haven’t blocked anyone.</p>';
      document.querySelectorAll('.ub').forEach(b => b.onclick = () => toggleBlock(l.find(x => x.id === b.dataset.id), true, () => rSettings('blocked')));
    }).catch(e => { $('#bl2').innerHTML = `<p class="mute">${esc(e.message)}</p>`; });
    if ($('#pw')) $('#pw').onclick = async () => {
      try { await api('/auth/change-password', { method: 'POST', body: { current: $('#pc').value, password: $('#pn').value } }); $('#pc').value = $('#pn').value = ''; $('#er').textContent = ''; toast('Password updated'); }
      catch (e) { $('#er').textContent = e.message; }
    };
    if ($('#sup')) {
      $('#sup').oninput = e => { $('#scnt').textContent = e.target.value.length + '/150'; };
      $('#sbm').onclick = async () => {
        const msg = $('#sup').value.trim();
        if (msg.length < 5) return $('#er').textContent = 'Please write a little more.';
        if (FORMSPREE_URL.includes('YOUR_FORM_ID')) return $('#er').textContent = 'Support form is not set up yet.';
        $('#sbm').disabled = true;
        try {
          const r = await fetch(FORMSPREE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ username: me.username, email: me.email, message: msg }) });
          if (!r.ok) throw new Error();
          $('#sup').value = ''; $('#er').textContent = ''; toast('Message sent. Thank you!');
        } catch { $('#er').textContent = 'Could not send. Please try again.'; }
        $('#sbm').disabled = false;
      };
    }
  };
  $('#settingsBtn').onclick = () => go('settings');
})();