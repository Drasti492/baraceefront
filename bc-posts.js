/* bc-posts.js — feed, composer (crop/trim), comments, post menu, share card, grouped stories. */
(() => {
  const MB = 1048576;
  const linkify = t => esc(t).replace(/#(\w+)/g, '<a href="#" class="ht" data-t="$1">#$1</a>');
  const dispName = u => u.bizName && u.type === 'business' ? u.bizName : (u.displayName || u.username);

  /* ======================= HOME ======================= */
  window.rHome = async function () {
    $('#main').innerHTML = `
      <div class="v">
        <div class="card"><div class="stories" id="st"></div></div>
        <div class="card composer">
          <textarea id="ptx" rows="2" maxlength="500" placeholder="What's happening around campus? Use #hashtags"></textarea>
          <div id="prev"></div>
          <div class="comp-bar">
            <label class="btn ghost sm" title="Add photos"><i class="fa-regular fa-image"></i><span class="hide-s"> Photo</span>
              <input type="file" id="pf" accept="image/*" multiple hidden></label>
            <label class="btn ghost sm" title="Add video"><i class="fa-solid fa-video"></i><span class="hide-s"> Video</span>
              <input type="file" id="pv" accept="video/*" hidden></label>
            <span class="mute cnt" id="pcnt">0/500</span>
            <button class="btn sm sp" id="pb"><i class="fa-solid fa-paper-plane"></i> Post</button>
          </div>
          <div class="mute hint">Up to 3 photos (10MB each) or one 15-second video.</div>
        </div>
        <div class="filters">
          <select id="fs"><option value="new">Newest</option><option value="oldest">Oldest</option><option value="popular">Most liked</option></select>
          <select id="ft"><option value="">All people</option><option value="student">Students</option><option value="business">Businesses</option><option value="community">Community</option></select>
          ${filt.tag ? `<button class="btn ghost sm" id="clr">#${esc(filt.tag)} <i class="fa-solid fa-xmark"></i></button>` : ''}
        </div>
        <div id="feed"></div>
      </div>`;
    $('#fs').value = filt.sort || 'new';
    $('#ft').value = filt.type || '';
    $('#fs').onchange = e => { filt.sort = e.target.value; loadFeed(); };
    $('#ft').onchange = e => { filt.type = e.target.value; loadFeed(); };
    if ($('#clr')) $('#clr').onclick = () => { delete filt.tag; rHome(); };

    const q = new URLSearchParams(location.search).get('post');
    if (q) { filt.postId = q; history.replaceState({}, '', location.pathname); }

    bindComposer();
    loadStories();
    loadFeed();
  };

  /* ---------- composer with crop / trim / preview ---------- */
  function bindComposer() {
    let pend = [];
    const ta = $('#ptx');
    ta.oninput = () => { const n = ta.value.length; $('#pcnt').textContent = n + '/500'; $('#pcnt').classList.toggle('warn', n > 470); };
    const renderPrev = () => {
      $('#prev').innerHTML = pend.length ? `<div class="prev-grid n${pend.length}">${pend.map((m, i) => `
        <div class="prev-i">
          ${m.kind === 'video' ? `<video src="${m.url}" muted playsinline></video><span class="prev-vid"><i class="fa-solid fa-play"></i></span>` : `<img src="${m.url}" alt="">`}
          <button class="prev-x" data-i="${i}" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button>
          ${m.kind === 'image' && m.orig.type !== 'image/gif' ? `<button class="prev-e" data-i="${i}" aria-label="Crop again"><i class="fa-solid fa-crop-simple"></i></button>` : ''}
        </div>`).join('')}</div>` : '';
      document.querySelectorAll('.prev-x').forEach(b => b.onclick = () => { pend.splice(+b.dataset.i, 1); renderPrev(); });
      document.querySelectorAll('.prev-e').forEach(b => b.onclick = async () => {
        const m = pend[+b.dataset.i], out = await BC.cropImage(m.orig);
        if (out) { m.file = out; m.url = URL.createObjectURL(out); renderPrev(); }
      });
    };
    $('#pf').onchange = async e => {
      const files = [...e.target.files]; e.target.value = '';
      if (pend.some(m => m.kind === 'video')) return toast('Remove the video to add photos.');
      for (const f of files) {
        if (pend.length >= 3) { toast('Maximum 3 photos per post.'); break; }
        if (f.size > 10 * MB) { toast(`${f.name} is larger than 10MB.`); continue; }
        const out = await BC.cropImage(f);
        if (!out) continue;
        pend.push({ file: out, orig: f, url: URL.createObjectURL(out), kind: 'image' });
        renderPrev();
      }
    };
    $('#pv').onchange = async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      if (pend.length) return toast('Remove your photos to add a video.');
      if (f.size > 150 * MB) return toast('That video is too large.');
      const out = await BC.trimVideo(f);
      if (!out) return;
      if (out.size > 25 * MB) return toast('Clip is over 25MB. Choose a shorter or smaller video.');
      pend = [{ file: out, orig: out, url: URL.createObjectURL(out), kind: 'video' }];
      renderPrev();
    };
    $('#pb').onclick = async () => {
      const text = ta.value.trim();
      if (!text && !pend.length) return toast('Write something or add media.');
      const fd = new FormData();
      fd.append('text', text);
      pend.forEach(m => fd.append('files', m.file, m.file.name));
      const b = $('#pb'); b.disabled = true; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting…';
      try { await api('/posts', { method: 'POST', body: fd }); toast('Posted'); rHome(); side(); }
      catch (err) { toast(err.message); b.disabled = false; b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Post'; }
    };
  }

  /* ======================= FEED ======================= */
  window.loadFeed = async function () {
    const params = { ...filt }; delete params.postId;
    try {
      let ps = await api('/posts?' + new URLSearchParams(params));
      if (filt.postId) {
        try {
          const one = await api('/posts/' + filt.postId);
          ps = [one, ...ps.filter(p => p.id !== one.id)];
          one._pinned = true;
        } catch (e) { toast('That post is no longer available.'); }
        delete filt.postId;
      }
      BC.reloadPosts = loadFeed;
      BC.renderPosts($('#feed'), ps, '<p class="mute" style="padding:8px">No posts match. Be the first!</p>');
      if (ps[0] && ps[0]._pinned) { const c = $('#feed .post'); c && c.classList.add('flash'); }
    } catch (e) { $('#feed').innerHTML = `<p class="mute">${esc(e.message)}</p>`; }
  };

  const postCard = p => `
    <article class="card post" data-id="${p.id}">
      <header class="post-h">
        <div class="who">${avatar(p.user)}
          <div class="who-t">${name(p.user)}<span class="mute">@${esc(p.user.username)} · ${BC.when(p.createdAt)}${p.editedAt ? ' · edited' : ''}</span></div>
        </div>
        <button class="ico pm" aria-label="More options"><i class="fa-solid fa-ellipsis"></i></button>
      </header>
      ${p.text ? `<p class="post-text">${linkify(p.text)}</p>` : ''}
      ${BC.carousel(p.media)}
      <div class="acts">
        <button class="lk ${p.likedByMe ? 'liked' : ''}" aria-label="Like"><i class="fa-${p.likedByMe ? 'solid' : 'regular'} fa-heart"></i><span>${p.likes}</span></button>
        <button class="cmb" aria-label="Comments"><i class="fa-regular fa-comment"></i><span>${p.commentCount}</span></button>
        ${p.user.id !== me.id ? `<button class="msg" aria-label="Message"><i class="fa-regular fa-paper-plane"></i></button>` : ''}
        <button class="shb" aria-label="Share"><i class="fa-solid fa-share-nodes"></i></button>
      </div>
      <div class="cms" hidden></div>
    </article>`;

  BC.renderPosts = (el, posts, empty = '') => {
    el.innerHTML = posts.map(postCard).join('') || empty;
    BC.bindCarousels(el);
    el.querySelectorAll('.post').forEach(card => bindPost(card, posts.find(x => x.id === card.dataset.id)));
    el.querySelectorAll('.ht').forEach(a => a.onclick = e => { e.preventDefault(); filt = { tag: a.dataset.t }; go('home'); });
  };

  function bindPost(card, p) {
    const id = p.id;
    card.querySelector('.lk').onclick = async e => {
      const b = e.currentTarget; if (b.disabled) return; b.disabled = true;
      try {
        const d = await api(`/posts/${id}/like`, { method: 'POST' });
        b.classList.toggle('liked', d.likedByMe);
        b.innerHTML = `<i class="fa-${d.likedByMe ? 'solid' : 'regular'} fa-heart"></i><span>${d.likes}</span>`;
      } catch (err) { toast(err.message); } finally { b.disabled = false; }
    };
    let mounted = false;
    card.querySelector('.cmb').onclick = () => {
      const box = card.querySelector('.cms');
      box.hidden = !box.hidden;
      if (!mounted) { mounted = true; mountComments(card, p); }
    };
    const dm = card.querySelector('.msg');
    if (dm) dm.onclick = () => { chatWith = { id: p.user.id, username: p.user.username, type: p.user.type, avatar: p.user.avatar }; go('inbox'); };
    card.querySelector('.shb').onclick = () => sharePost(p);
    card.querySelector('.pm').onclick = e => postMenu(e.currentTarget, p);
  }

  /* ---------- 3-dot post menu ---------- */
  function postMenu(btn, p) {
    document.querySelector('.ctx-menu')?.remove();
    const mine = p.user.id === me.id, r = btn.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'ctx-menu';
    el.innerHTML = `
      ${mine ? (p.canEdit ? '<button data-a="edit"><i class="fa-solid fa-pen"></i> Edit post</button>'
        : '<button disabled class="dis"><i class="fa-solid fa-pen"></i> Edit (closed after 3 hours)</button>') : ''}
      <button data-a="share"><i class="fa-solid fa-share-nodes"></i> Share</button>
      <button data-a="copy"><i class="fa-solid fa-link"></i> Copy link</button>
      ${mine ? '<button data-a="del" class="danger"><i class="fa-solid fa-trash"></i> Delete post</button>' : ''}`;
    document.body.appendChild(el);
    el.style.left = Math.max(8, Math.min(r.right - el.offsetWidth, innerWidth - el.offsetWidth - 8)) + 'px';
    el.style.top = Math.min(r.bottom + 4, innerHeight - el.offsetHeight - 8) + 'px';
    setTimeout(() => document.addEventListener('click', () => el.remove(), { once: true }), 0);
    el.onclick = async e => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'edit') editPost(p);
      if (a === 'share') sharePost(p);
      if (a === 'copy') { await navigator.clipboard?.writeText(`${location.origin}/?post=${p.id}`); toast('Link copied'); }
      if (a === 'del') {
        const ok = await BC.confirm({ title: 'Delete this post?', message: 'This will permanently remove the post and its comments. This can’t be undone.', confirm: 'Delete', danger: true });
        if (!ok) return;
        try { await api('/posts/' + p.id, { method: 'DELETE' }); toast('Post deleted'); BC.reloadPosts && BC.reloadPosts(); side(); }
        catch (err) { toast(err.message); }
      }
    };
  }
  function editPost(p) {
    modal(`
      <h2>Edit post</h2>
      <textarea id="epx" rows="4" maxlength="500">${esc(p.text)}</textarea>
      <div class="mute" style="margin-top:6px">You can edit a post for 3 hours after posting.</div>
      <div class="err" id="er"></div>
      <div class="row" style="margin-top:14px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn sp" id="eps">Save changes</button></div>`);
    $('#eps').onclick = async () => {
      try { await api('/posts/' + p.id, { method: 'PATCH', body: { text: $('#epx').value } }); closeModal(); toast('Post updated'); BC.reloadPosts && BC.reloadPosts(); }
      catch (e) { $('#er').textContent = e.message; }
    };
  }

  /* ======================= COMMENTS ======================= */
  const cmtHTML = (c, ownerId, isReply) => {
    const u = c.user, canDel = u.id === me.id || ownerId === me.id;
    return `
      <div class="cmt ${isReply ? 'rep' : ''}" data-id="${c.id}">
        ${avatar(u, 'sm')}
        <div class="cmt-main">
          <div class="cmt-head">
            <span class="cmt-name" data-uid="${u.id}">${esc(dispName(u))}${u.verified ? ' <i class="fa-solid fa-circle-check vf"></i>' : ''}</span>
            <span class="cmt-un">@${esc(u.username)}</span>
            ${u.id === ownerId ? '<span class="pill">Author</span>' : ''}
            <span class="cmt-when">· ${BC.when(c.createdAt)}</span>
          </div>
          <div class="cmt-text">${c.replyTo ? `<a class="cmt-mn" data-uid="${c.replyTo.id}">@${esc(c.replyTo.username)}</a> ` : ''}${esc(c.text)}</div>
          <div class="cmt-acts">
            <button class="lnk cr">Reply</button>
            ${!isReply && c.replyCount ? `<button class="lnk tg" data-n="${c.replyCount}">View ${c.replyCount} ${c.replyCount > 1 ? 'replies' : 'reply'}</button>` : ''}
            ${canDel ? '<button class="lnk cd">Delete</button>' : ''}
          </div>
          ${isReply ? '' : '<div class="cmt-reps" hidden></div>'}
        </div>
        <button class="cmt-like ${c.likedByMe ? 'liked' : ''}" aria-label="Like comment"><i class="fa-${c.likedByMe ? 'solid' : 'regular'} fa-heart"></i><span>${c.likes || ''}</span></button>
      </div>`;
  };

  async function mountComments(card, p) {
    const box = card.querySelector('.cms'), ownerId = p.user.id;
    let skip = 0, total = 0, replying = null, count = p.commentCount;
    box.innerHTML = `
      <div class="cmt-list"><p class="mute" style="padding:6px 0">Loading comments…</p></div>
      <button class="lnk more" hidden></button>
      <div class="cmt-replying" hidden></div>
      <div class="cmt-compose">
        <input class="ci" maxlength="500" placeholder="Add a comment…" aria-label="Add a comment">
        <button class="cs" aria-label="Post comment"><i class="fa-solid fa-paper-plane"></i></button>
      </div>`;
    const list = box.querySelector('.cmt-list'), more = box.querySelector('.more'), chip = box.querySelector('.cmt-replying'), ci = box.querySelector('.ci');
    const bump = d => { count += d; card.querySelector('.cmb span').textContent = count; };

    const load = async first => {
      try {
        const d = await api(`/posts/${p.id}/comments?skip=${skip}&limit=${first ? 3 : 20}`);
        total = d.total;
        if (first) list.innerHTML = '';
        list.insertAdjacentHTML('beforeend', d.comments.map(c => cmtHTML(c, ownerId, false)).join(''));
        if (first && !d.comments.length) list.innerHTML = '<p class="mute" style="padding:6px 0">No comments yet. Start the conversation.</p>';
        skip += d.comments.length;
        more.hidden = skip >= total;
        more.textContent = `View ${total - skip} more comment${total - skip > 1 ? 's' : ''}`;
      } catch (e) { list.innerHTML = `<p class="mute">${esc(e.message)}</p>`; }
    };
    more.onclick = () => load(false);
    load(true);

    const setReply = r => {
      replying = r;
      chip.hidden = !r;
      chip.innerHTML = r ? `<span>Replying to <b>@${esc(r.username)}</b></span><button class="ico" aria-label="Cancel reply"><i class="fa-solid fa-xmark"></i></button>` : '';
      if (r) { chip.querySelector('button').onclick = () => setReply(null); ci.focus(); }
    };
    const loadReplies = async root => {
      const reps = root.querySelector('.cmt-reps');
      try {
        const rs = await api(`/comments/${root.dataset.id}/replies`);
        reps.innerHTML = rs.map(c => cmtHTML(c, ownerId, true)).join('');
        reps.hidden = false;
        let tg = root.querySelector('.tg');
        if (!tg) { root.querySelector('.cmt-acts .cr').insertAdjacentHTML('afterend', '<button class="lnk tg"></button>'); tg = root.querySelector('.tg'); }
        tg.dataset.n = rs.length; tg.textContent = 'Hide replies';
      } catch (e) { toast(e.message); }
    };

    list.onclick = async e => {
      const row = e.target.closest('.cmt'); if (!row) return;
      const id = row.dataset.id;
      if (e.target.closest('.cr')) {
        setReply({ id, username: row.querySelector('.cmt-un').textContent.replace('@', '') });
        box.dataset.root = (row.classList.contains('rep') ? row.closest('.cmt:not(.rep)') : row).dataset.id;
      } else if (e.target.closest('.tg')) {
        const t = e.target.closest('.tg'), reps = row.querySelector('.cmt-reps');
        if (!reps.hidden) { reps.hidden = true; const n = +t.dataset.n; t.textContent = `View ${n} ${n > 1 ? 'replies' : 'reply'}`; }
        else loadReplies(row);
      } else if (e.target.closest('.cd')) {
        const ok = await BC.confirm({ title: 'Delete comment?', message: 'This comment will be removed.', confirm: 'Delete', danger: true });
        if (!ok) return;
        try { await api('/comments/' + id, { method: 'DELETE' }); row.remove(); bump(-1); } catch (err) { toast(err.message); }
      } else if (e.target.closest('.cmt-like')) {
        const b = e.target.closest('.cmt-like');
        try {
          const d = await api(`/comments/${id}/like`, { method: 'POST' });
          b.classList.toggle('liked', d.likedByMe);
          b.innerHTML = `<i class="fa-${d.likedByMe ? 'solid' : 'regular'} fa-heart"></i><span>${d.likes || ''}</span>`;
        } catch (err) { toast(err.message); }
      }
    };

    const send = async () => {
      const text = ci.value.trim(); if (!text) return;
      const s = box.querySelector('.cs'); s.disabled = true;
      try {
        const body = { text }; if (replying) body.replyToComment = replying.id;
        const c = await api(`/posts/${p.id}/comments`, { method: 'POST', body });
        ci.value = ''; bump(1);
        if (c.parent) { const root = list.querySelector(`.cmt[data-id="${c.parent}"]`); if (root) await loadReplies(root); else toast('Reply posted'); }
        else {
          list.querySelector('p.mute')?.remove();
          list.insertAdjacentHTML('afterbegin', cmtHTML(c, ownerId, false)); skip++;
        }
        setReply(null);
      } catch (e) { toast(e.message); } finally { s.disabled = false; }
    };
    box.querySelector('.cs').onclick = send;
    ci.onkeydown = e => { if (e.key === 'Enter') send(); };
  }

  /* ======================= SHARE CARD ======================= */
  function wrap(ctx, text, x, y, maxW, lh, maxLines) {
    const words = text.split(/\s+/); let line = '', n = 0;
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) {
        if (++n >= maxLines) { ctx.fillText(line.replace(/\s*\S*$/, '') + '…', x, y); return y + lh; }
        ctx.fillText(line, x, y); y += lh; line = w;
      } else line = t;
    }
    ctx.fillText(line, x, y); return y + lh;
  }
  const loadImg = src => new Promise(r => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

  async function shareCard(p) {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0b6e4f'); g.addColorStop(1, '#063d2c');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.arc(W - 60, 120, 320, 0, 7); x.fill();
    // header: author + BC logo on the right
    x.fillStyle = '#fff'; x.beginPath(); x.arc(110, 110, 46, 0, 7); x.fill();
    x.fillStyle = '#0b6e4f'; x.font = '700 44px DM Sans, sans-serif'; x.textAlign = 'center'; x.fillText(p.user.username[0].toUpperCase(), 110, 126);
    x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = '700 40px DM Sans, sans-serif'; x.fillText(BC.clip(dispName(p.user), 24), 180, 104);
    x.font = '400 32px DM Sans, sans-serif'; x.fillStyle = 'rgba(255,255,255,.75)'; x.fillText('@' + p.user.username, 180, 148);
    x.fillStyle = '#fff'; x.beginPath(); x.arc(W - 120, 110, 64, 0, 7); x.fill();
    x.fillStyle = '#0b6e4f'; x.font = '800 54px DM Sans, sans-serif'; x.textAlign = 'center'; x.fillText('BC', W - 120, 130); x.textAlign = 'left';
    // body
    let y = 270;
    const first = p.media.find(m => m.kind === 'image'), img = first ? await loadImg(assetUrl(first.url)) : null;
    if (img) {
      const bw = W - 160, bh = 620, s = Math.max(bw / img.width, bh / img.height);
      x.save(); x.beginPath(); x.roundRect(80, y, bw, bh, 36); x.clip();
      x.drawImage(img, 80 + (bw - img.width * s) / 2, y + (bh - img.height * s) / 2, img.width * s, img.height * s); x.restore();
      y += bh + 70;
    }
    x.fillStyle = '#fff'; x.font = `600 ${img ? 44 : 58}px DM Sans, sans-serif`;
    wrap(x, p.text || (p.media.some(m => m.kind === 'video') ? 'Watch this video on Bara Cee' : ''), 80, y + (img ? 0 : 60), W - 160, img ? 62 : 80, img ? 4 : 10);
    // footer
    x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, H - 150, W, 150);
    x.fillStyle = '#fff'; x.font = '700 40px DM Sans, sans-serif'; x.fillText('Bara Cee', 80, H - 82);
    x.font = '400 30px DM Sans, sans-serif'; x.fillStyle = 'rgba(255,255,255,.8)'; x.fillText('Tap the link to see this post', 80, H - 38);
    return new Promise(r => c.toBlob(r, 'image/png'));
  }

  async function sharePost(p) {
    const link = `${location.origin}/?post=${p.id}`;
    modal(`<h2>Share post</h2><div class="share-prev" id="sp"><p class="mute"><i class="fa-solid fa-spinner fa-spin"></i> Creating card…</p></div>
      <div class="share-btns" id="sb" hidden>
        <button class="btn" id="sn"><i class="fa-solid fa-share-nodes"></i> Share</button>
        <a class="btn ghost" id="sw" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
        <button class="btn ghost" id="sd"><i class="fa-solid fa-download"></i> Save</button>
        <button class="btn ghost" id="sc"><i class="fa-solid fa-link"></i> Copy link</button>
      </div><button class="btn ghost" style="width:100%;margin-top:10px" onclick="closeModal()">Close</button>`);
    let blob = null;
    try { blob = await shareCard(p); } catch { /* canvas blocked: fall back to link only */ }
    const sp = $('#sp'); if (!sp) return;
    sp.innerHTML = blob ? `<img src="${URL.createObjectURL(blob)}" alt="Share card">` : '<p class="mute">Preview unavailable. You can still share the link.</p>';
    $('#sb').hidden = false;
    const text = `${BC.clip(p.text || 'Check this out on Bara Cee', 100)} — @${p.user.username} on Bara Cee`;
    $('#sw').href = `https://wa.me/?text=${encodeURIComponent(text + '\n' + link)}`;
    $('#sc').onclick = async () => { await navigator.clipboard?.writeText(link); toast('Link copied'); };
    $('#sd').onclick = () => { if (!blob) return toast('Card unavailable.'); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bara-cee-post.png'; a.click(); };
    $('#sn').onclick = async () => {
      try {
        const file = blob && new File([blob], 'bara-cee-post.png', { type: 'image/png' });
        if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: text + '\n' + link });
        else if (navigator.share) await navigator.share({ text, url: link });
        else { await navigator.clipboard?.writeText(link); toast('Link copied. Paste it anywhere.'); }
      } catch {}
    };
  }

  /* ======================= STORIES (one circle per person) ======================= */
  let groups = [], timer = null;
  window.loadStories = async function () {
    let flat = []; try { flat = await api('/stories'); } catch {}
    stories = flat;
    const map = new Map();
    flat.forEach(s => { if (!map.has(s.user.id)) map.set(s.user.id, { user: s.user, items: [] }); map.get(s.user.id).items.push(s); });
    groups = [...map.values()].sort((a, b) => (b.user.id === me.id) - (a.user.id === me.id) || new Date(b.items.at(-1).createdAt) - new Date(a.items.at(-1).createdAt));
    const mine = groups.find(g => g.user.id === me.id);
    const ring = (u, inner) => `<div class="ring">${u.avatar ? `<img class="av" src="${esc(assetUrl(u.avatar))}" alt="">` : `<span class="av">${esc(u.username[0].toUpperCase())}</span>`}${inner || ''}</div>`;
    const el = $('#st'); if (!el) return;
    el.innerHTML = `
      <div class="story ${mine ? '' : 'add'}" data-g="${mine ? groups.indexOf(mine) : 'add'}">
        ${ring(me, '<button class="plus" id="addSt" aria-label="Add story"><i class="fa-solid fa-plus"></i></button>')}Your story
      </div>` +
      groups.filter(g => g !== mine).map(g => `<div class="story" data-g="${groups.indexOf(g)}">${ring(g.user)}<span>${esc(g.user.username.slice(0, 9))}</span></div>`).join('');
    $('#addSt').onclick = e => { e.stopPropagation(); addStory(); };
    el.querySelectorAll('.story').forEach(s => s.onclick = () => s.dataset.g === 'add' ? addStory() : openGroup(+s.dataset.g, 0));
  };
  BC.openStoryById = id => {
    for (let gi = 0; gi < groups.length; gi++) { const ii = groups[gi].items.findIndex(s => s.id === id); if (ii >= 0) return openGroup(gi, ii); }
    toast('This story is no longer available.');
  };

  function openGroup(gi, ii) {
    clearTimeout(timer);
    const g = groups[gi]; if (!g) return closeModal();
    const s = g.items[ii], vid = BC.isVid(s.media), mineStory = g.user.id === me.id;
    modal(`
      <div class="sv">
        <div class="sv-bars">${g.items.map((_, k) => `<i class="${k < ii ? 'done' : k === ii ? 'cur' : ''}"></i>`).join('')}</div>
        <div class="sv-head">
          <div class="sv-who" data-uid="${g.user.id}">${avatar(g.user, 'sm')}<b>${esc(dispName(g.user))}</b><span class="mute">${BC.when(s.createdAt)}</span></div>
          <button class="ico" id="svx" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="story-box">
          ${s.media ? (vid ? `<video id="svv" controls autoplay playsinline src="${esc(assetUrl(s.media))}"></video>` : `<img src="${esc(assetUrl(s.media))}" alt="">`) : ''}
          ${s.text ? `<div class="sv-text">${esc(s.text)}</div>` : ''}
        </div>
        ${mineStory ? '' : `<div class="sv-reply"><input id="sr" maxlength="1000" placeholder="Reply to ${esc(g.user.username)}…" autocomplete="off"><button class="btn" id="srb" aria-label="Send reply"><i class="fa-solid fa-paper-plane"></i></button></div>`}
        <div class="sv-nav"><button class="btn ghost sm" id="svp" ${gi || ii ? '' : 'disabled'}><i class="fa-solid fa-chevron-left"></i> Prev</button>
          <button class="btn ghost sm" id="svn">Next <i class="fa-solid fa-chevron-right"></i></button></div>
      </div>`);
    const next = () => ii + 1 < g.items.length ? openGroup(gi, ii + 1) : gi + 1 < groups.length ? openGroup(gi + 1, 0) : closeModal();
    const prev = () => ii > 0 ? openGroup(gi, ii - 1) : gi > 0 ? openGroup(gi - 1, groups[gi - 1].items.length - 1) : null;
    $('#svx').onclick = () => { clearTimeout(timer); closeModal(); };
    $('#svn').onclick = next; $('#svp').onclick = prev;
    const guard = fn => () => $('#modal').classList.contains('on') && fn();
    if (vid) $('#svv').onended = guard(next); else timer = setTimeout(guard(next), 6000);
    if ($('#sr')) {
      $('#sr').onfocus = () => { clearTimeout(timer); $('#svv')?.pause(); };
      const send = async () => {
        const v = $('#sr').value.trim(); if (!v) return;
        try { await api(`/stories/${s.id}/reply`, { method: 'POST', body: { text: v } }); toast('Reply sent'); closeModal(); }
        catch (e) { toast(e.message); }
      };
      $('#srb').onclick = send; $('#sr').onkeydown = e => { if (e.key === 'Enter') send(); };
    }
  }
})();