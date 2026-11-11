/* bc-market.js — marketplace (6 photos, clean cards, edit/sold) + Bara Cee Helper chatbot. */
(() => {
  const MB = 1048576;

  /* ======================= MARKET ======================= */
  window.rMarket = async function () {
    $('#main').innerHTML = `
      <div class="v wide">
        <div class="row" style="margin-bottom:12px"><h2 style="margin:0">Market</h2><button class="btn sm sp" id="sell"><i class="fa-solid fa-plus"></i> Sell</button></div>
        <input id="mq" placeholder="Search items or services" style="margin-bottom:12px">
        <div class="lst-grid" id="mg"></div>
        <h2 style="margin:24px 0 10px">My listings</h2><div id="mine"></div>
      </div>`;
    if (BC.marketQ) { $('#mq').value = BC.marketQ; BC.marketQ = ''; }

    const load = async () => {
      try {
        const l = await api('/listings?q=' + encodeURIComponent($('#mq').value));
        $('#mg').innerHTML = l.map(x => `
          <article class="lst">
            <div class="lst-img">${x.images && x.images.length ? BC.carousel(x.images.map(u => ({ url: u, kind: 'image' }))) : '<div class="lst-ph"><i class="fa-solid fa-box"></i></div>'}</div>
            <div class="lst-body">
              <div class="lst-top"><h3 class="lst-title">${esc(x.title)}</h3><span class="lst-price">KSh ${Number(x.price).toLocaleString()}</span></div>
              ${x.description ? `<p class="lst-desc">${esc(x.description)}</p>` : ''}
              <div class="lst-seller">${avatar(x.user, 'sm')}<div>${name(x.user)}<span class="mute">@${esc(x.user.username)}</span></div></div>
              ${x.user.id !== me.id ? `<button class="btn sm msg" data-u="${x.user.id}" data-n="${esc(x.user.username)}" data-t="${esc(x.title)}"><i class="fa-regular fa-message"></i> Message seller</button>` : '<span class="pill">Your listing</span>'}
            </div>
          </article>`).join('') || '<p class="mute">Nothing here yet. Be the first to sell.</p>';
        BC.bindCarousels($('#mg'));
        document.querySelectorAll('#mg .msg').forEach(b => b.onclick = () => {
          chatWith = { id: b.dataset.u, username: b.dataset.n, type: 'student', prefill: `Hi, is "${b.dataset.t}" still available?` };
          go('inbox');
        });
      } catch (e) { $('#mg').innerHTML = `<p class="mute">${esc(e.message)}</p>`; }
    };

    const mine = async () => {
      try {
        const l = await api('/my-listings'), now = Date.now();
        $('#mine').innerHTML = l.map(x => {
          const live = new Date(x.expiresAt) > now, st = x.sold ? ['Sold', ''] : live ? ['Live', 'ok'] : ['Expired', ''];
          return `<div class="card mine">
            <div class="mine-i">${x.images && x.images[0] ? `<img src="${esc(assetUrl(x.images[0]))}" alt="">` : '<i class="fa-solid fa-box"></i>'}</div>
            <div class="mine-t"><b>${esc(x.title)}</b> <span class="pill ${st[1]}">${st[0]}</span>
              <div class="mute">KSh ${Number(x.price).toLocaleString()} · ${x.sold ? 'Marked as sold' : live ? 'Hidden in ' + Math.max(1, Math.round((new Date(x.expiresAt) - now) / 36e5)) + 'h' : 'Deleted for good ' + new Date(x.deleteAt).toLocaleDateString()}</div></div>
            <div class="mine-a">
              <button class="btn sm ghost ed" data-id="${x._id}" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
              <button class="btn sm ghost sd2" data-id="${x._id}" data-s="${x.sold ? 0 : 1}">${x.sold ? 'Relist' : 'Mark sold'}</button>
              <button class="btn sm ghost rn" data-id="${x._id}"><i class="fa-solid fa-rotate"></i><span class="hide-s"> Renew</span></button>
              <button class="btn sm ghost dl" data-id="${x._id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
            </div></div>`;
        }).join('') || '<p class="mute">You have no listings.</p>';
        const act = (sel, fn) => document.querySelectorAll(sel).forEach(b => b.onclick = async () => { try { if (await fn(b) === false) return; load(); mine(); } catch (e) { toast(e.message); } });
        act('.rn', async b => { await api(`/listings/${b.dataset.id}/renew`, { method: 'POST' }); toast('Listing renewed'); });
        act('.sd2', b => api(`/listings/${b.dataset.id}/sold`, { method: 'POST', body: { sold: b.dataset.s === '1' } }));
        act('.dl', async b => {
          if (!await BC.confirm({ title: 'Delete this listing?', message: 'It will be removed for good. This can’t be undone.', confirm: 'Delete', danger: true })) return false;
          await api('/listings/' + b.dataset.id, { method: 'DELETE' }); toast('Listing deleted');
        });
        document.querySelectorAll('.ed').forEach(b => b.onclick = () => {
          const it = l.find(x => x._id === b.dataset.id);
          modal(`<h2>Edit listing</h2><label>Item name</label><input id="elt" maxlength="80" value="${esc(it.title)}">
            <label>Price (KSh)</label><input id="elp" type="number" inputmode="numeric" value="${it.price}">
            <label>Description</label><textarea id="eld" rows="3" maxlength="300">${esc(it.description)}</textarea>
            <div class="err" id="er"></div><div class="row" style="margin-top:14px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn sp" id="els">Save changes</button></div>`);
          $('#els').onclick = async () => {
            try { await api('/listings/' + it._id, { method: 'PATCH', body: { title: $('#elt').value, price: $('#elp').value, description: $('#eld').value } }); closeModal(); toast('Listing updated'); load(); mine(); }
            catch (e) { $('#er').textContent = e.message; }
          };
        });
      } catch (e) { $('#mine').innerHTML = `<p class="mute">${esc(e.message)}</p>`; }
    };

    $('#mq').oninput = load; $('#sell').onclick = () => sell(load, mine);
    load(); mine();
  };

  window.sell = function (load, mine) {
    let files = [];
    modal(`<h2>Sell something</h2>
      <label>Item name</label><input id="lt" maxlength="80">
      <label>Price (KSh)</label><input id="lpr" type="number" inputmode="numeric">
      <label>Description <span class="mute" id="dc">0/300</span></label><textarea id="ld" rows="3" maxlength="300" placeholder="Condition, size, where to meet…"></textarea>
      <label>Photos (up to 6, 10MB each)</label>
      <div class="prev-grid sell" id="sp"></div>
      <label class="btn ghost sm" style="margin-top:6px"><i class="fa-regular fa-image"></i> Add photos<input type="file" id="lf" accept="image/*" multiple hidden></label>
      <p class="mute" style="margin-top:10px">Listings are visible for 30 hours. You can renew them for 3 more days before they’re deleted.</p>
      <div class="err" id="er"></div>
      <div class="row" style="margin-top:12px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn sp" id="pub">Publish</button></div>`);
    const paint = () => {
      $('#sp').innerHTML = files.map((f, i) => `<div class="prev-i"><img src="${f.url}" alt=""><button class="prev-x" data-i="${i}" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></div>`).join('');
      document.querySelectorAll('#sp .prev-x').forEach(b => b.onclick = () => { files.splice(+b.dataset.i, 1); paint(); });
    };
    $('#ld').oninput = e => { $('#dc').textContent = e.target.value.length + '/300'; };
    $('#lf').onchange = async e => {
      for (const f of [...e.target.files]) {
        if (files.length >= 6) { $('#er').textContent = 'Maximum 6 photos.'; break; }
        if (f.size > 10 * MB) { $('#er').textContent = `${f.name} is larger than 10MB.`; continue; }
        const out = await BC.cropImage(f); if (!out) continue;
        files.push({ file: out, url: URL.createObjectURL(out) }); paint();
      }
      e.target.value = '';
    };
    $('#pub').onclick = async () => {
      const fd = new FormData();
      fd.append('title', $('#lt').value); fd.append('price', $('#lpr').value); fd.append('description', $('#ld').value);
      files.forEach(f => fd.append('files', f.file, f.file.name));
      $('#pub').disabled = true; $('#pub').textContent = 'Publishing…';
      try { await api('/listings', { method: 'POST', body: fd }); closeModal(); toast('Your listing has been published'); load(); mine(); }
      catch (e) { $('#er').textContent = e.message; $('#pub').disabled = false; $('#pub').textContent = 'Publish'; }
    };
  };

  /* ======================= CHATBOT (site helper) ======================= */
  let scope = 'all', busy = false;
  const SC = [['all', 'All'], ['posts', 'Posts'], ['people', 'People'], ['market', 'Market'], ['help', 'Help']];
  bw.innerHTML = `
    <div class="bot-h"><b><i class="fa-solid fa-robot"></i> Bara Cee Helper</b><button class="ico" id="botx" aria-label="Close helper"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="bot-chips" id="bsc">${SC.map(([k, l]) => `<button class="chip ${k === 'all' ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="bot-log" id="bl"></div>
    <div class="bot-in"><input id="bi" placeholder="Ask, or paste a @username" maxlength="200" autocomplete="off"><button class="btn" id="bs" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button></div>`;
  const log = $('#bl');
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const chips = list => `<div class="bot-sug">${list.map(s => `<button class="chip" data-ask="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  const resHTML = r => {
    if (r.kind === 'user') return `<button class="bres" data-user="${r.id}">${avatar({ username: r.username, avatar: r.avatar }, 'sm')}<span><b>${esc(r.displayName || r.username)}${r.verified ? ' <i class="fa-solid fa-circle-check vf"></i>' : ''}</b><small>@${esc(r.username)} · ${esc(r.type)}</small></span><i class="fa-solid fa-chevron-right"></i></button>`;
    if (r.kind === 'post') return `<button class="bres" data-post="${r.id}"><i class="fa-regular fa-file-lines bi"></i><span><b>@${esc(r.user.username)} · ${BC.when(r.createdAt)}</b><small>${esc(r.text || 'Photo / video post')}</small></span><i class="fa-solid fa-arrow-up-right-from-square"></i></button>`;
    return `<button class="bres" data-listing="${esc(r.title)}"><i class="fa-solid fa-tag bi"></i><span><b>${esc(r.title)}</b><small>KSh ${Number(r.price).toLocaleString()} · @${esc(r.seller)}</small></span><i class="fa-solid fa-chevron-right"></i></button>`;
  };
  const addUser = t => { log.insertAdjacentHTML('beforeend', `<div class="bm me">${esc(t)}</div>`); scroll(); };
  const addBot = d => {
    log.insertAdjacentHTML('beforeend', `<div class="bm"><p>${esc(d.reply)}</p>${(d.results || []).map(resHTML).join('')}${d.go ? `<button class="chip go" data-go="${d.go}">Open ${d.go === 'notifs' ? 'alerts' : d.go} <i class="fa-solid fa-arrow-right"></i></button>` : ''}${d.suggestions ? chips(d.suggestions) : ''}</div>`);
    scroll();
  };
  addBot({ reply: 'Hi! I can guide you around Bara Cee, find posts, and tell you about people — paste a @username or describe a post.', suggestions: ['How do I sell an item?', 'How do I block someone?', 'Find posts about food'] });

  async function ask(text) {
    const v = (text || '').trim(); if (!v || busy) return;
    busy = true; $('#bs').disabled = true; $('#bi').value = ''; addUser(v);
    log.insertAdjacentHTML('beforeend', '<div class="bm typ" id="bt"><span class="tdots"><i></i><i></i><i></i></span></div>'); scroll();
    try { const d = await api('/ai', { method: 'POST', body: { text: v, scope } }); $('#bt')?.remove(); addBot(d); }
    catch (e) { $('#bt')?.remove(); addBot({ reply: e.message }); }
    busy = false; $('#bs').disabled = false;
  }
  $('#bs').onclick = () => ask($('#bi').value);
  $('#bi').onkeydown = e => { if (e.key === 'Enter') ask($('#bi').value); };
  $('#botx').onclick = () => bw.classList.remove('on');
  $('#bsc').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; scope = b.dataset.k; document.querySelectorAll('#bsc .chip').forEach(c => c.classList.toggle('on', c === b)); };
  log.onclick = e => {
    const t = e.target.closest('[data-ask],[data-post],[data-user],[data-listing],[data-go]'); if (!t) return;
    if (t.dataset.ask) return ask(t.dataset.ask);
    bw.classList.remove('on');
    if (t.dataset.post) { filt = { postId: t.dataset.post }; go('home'); }
    else if (t.dataset.user) BC.showUser(t.dataset.user);
    else if (t.dataset.listing) { BC.marketQ = t.dataset.listing; go('market'); }
    else if (t.dataset.go) go(t.dataset.go);
  };

  /* app.js already ran start() before these files loaded — re-render once. */
  if (me) go(view);
})();