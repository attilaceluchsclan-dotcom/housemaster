// Housemaster login gate: email + password (Supabase Auth). Loaded right after supabase-js on every page.
// Uses the page's own `sb` client (same saved session), so nothing else on the page changes.
(function () {
  const KEY = 'sb-clteinrzpebrkrkthsvx-auth-token';
  let lang = 'sk';
  try { lang = localStorage.getItem('hm_lang') || 'sk'; } catch (e) {}
  const T = {
    sk: { title: 'Prihlásenie', email: 'E-mail', pass: 'Heslo', login: 'PRIHLÁSIŤ', create: 'VYTVORIŤ ÚČET',
          newAcc: 'Prvýkrát tu? Vytvor si účet', haveAcc: 'Už mám účet — prihlásiť', passHint: 'Heslo aspoň 8 znakov.',
          bad: 'Nesprávny e-mail alebo heslo.', exists: 'Tento e-mail už má účet — prihlás sa.',
          err: 'Chyba — skús znova o chvíľu.', noAccess: 'Tento e-mail zatiaľ nemá prístup do Housemaster. Povedz Attilovi, nech ťa pridá.', other: 'Odhlásiť', wait: 'Počkaj…' },
    en: { title: 'Sign in', email: 'Email', pass: 'Password', login: 'SIGN IN', create: 'CREATE ACCOUNT',
          newAcc: 'First time? Create an account', haveAcc: 'I have an account — sign in', passHint: 'Password at least 8 characters.',
          bad: 'Wrong email or password.', exists: 'This email already has an account — sign in.',
          err: 'Error — try again in a moment.', noAccess: 'This email has no access to Housemaster yet. Ask Attila to add you.', other: 'Sign out', wait: 'Wait…' }
  };
  const t = k => (T[lang] || T.sk)[k];

  let hasSession = false;
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); hasSession = !!(s && (s.refresh_token || (s.currentSession && s.currentSession.refresh_token))); } catch (e) {}

  const css = `#hmAuth{position:fixed;inset:0;z-index:9999;background:#15131a;color:#ece9f2;display:flex;align-items:center;justify-content:center;padding:16px;font:16px/1.45 "IBM Plex Sans",-apple-system,"Segoe UI",Roboto,sans-serif}
#hmAuth .bx{width:100%;max-width:380px}
#hmAuth h1{font:800 2.6rem/1 "Barlow Condensed","Arial Narrow",Arial,sans-serif;letter-spacing:.06em;margin:0 0 4px}
#hmAuth h2{font:700 1.2rem "Barlow Condensed","Arial Narrow",Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#b59be4;margin:0 0 20px}
#hmAuth input{width:100%;box-sizing:border-box;padding:16px;border-radius:14px;border:1px solid #37323f;background:#1f1c26;color:#ece9f2;font-size:1.2rem;margin-bottom:10px}
#hmAuth input.code{letter-spacing:.4em;text-align:center;font-weight:700;font-size:1.6rem}
#hmAuth button{width:100%;height:62px;border:none;border-radius:16px;background:#7c4dff;color:#fff;font:700 1.4rem "Barlow Condensed","Arial Narrow",Arial,sans-serif;letter-spacing:.06em;cursor:pointer}
#hmAuth button.link{height:auto;background:none;color:#a7a1b4;font:500 .95rem inherit;margin-top:14px;text-decoration:underline}
#hmAuth .msg{color:#a7a1b4;margin:10px 0;min-height:1.4em}
#hmAuth .msg.bad{color:#ef5350}`;

  function show(html) {
    let el = document.getElementById('hmAuth');
    if (!el) {
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      el = document.createElement('div'); el.id = 'hmAuth';
      (document.body || document.documentElement).appendChild(el);
    }
    el.innerHTML = `<div class="bx"><h1>HOUSEMASTER</h1><h2>${t('title')}</h2>${html}</div>`;
    return el;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function emailStep(prefill, msg, create) {
    const el = show(`<input id="hmEmail" type="email" autocomplete="email" inputmode="email" placeholder="${t('email')}" value="${esc(prefill || '')}">
      <input id="hmPass" type="password" autocomplete="${create ? 'new-password' : 'current-password'}" placeholder="${t('pass')}">
      <button id="hmGo">${create ? t('create') : t('login')}</button>
      <div class="msg ${msg ? 'bad' : ''}">${msg ? esc(msg) : (create ? t('passHint') : '')}</div>
      <button class="link" id="hmSwitch">${create ? t('haveAcc') : t('newAcc')}</button>`);
    const go = async () => {
      const email = el.querySelector('#hmEmail').value.trim().toLowerCase();
      const password = el.querySelector('#hmPass').value;
      if (!/.+@.+\..+/.test(email) || !password) return;
      if (create && password.length < 8) return emailStep(email, t('passHint'), true);
      const b = el.querySelector('#hmGo'); b.disabled = true; b.textContent = t('wait');
      const res = create ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
      if (res.error) {
        console.error(res.error);
        const m = /already|registered|exists/i.test(res.error.message || '') ? t('exists') : (create ? (res.error.message || t('err')) : t('bad'));
        return emailStep(email, m, create && !/already|registered|exists/i.test(res.error.message || ''));
      }
      if (create && !res.data.session) return emailStep(email, t('exists'), false);
      location.reload();
    };
    el.querySelector('#hmGo').onclick = go;
    el.querySelector('#hmPass').onkeydown = e => { if (e.key === 'Enter') go(); };
    el.querySelector('#hmSwitch').onclick = () => emailStep(el.querySelector('#hmEmail').value.trim(), '', !create);
  }

  function noAccess(email) {
    const el = show(`<div class="msg bad">${esc(t('noAccess'))}<br>${esc(email || '')}</div><button id="hmOut">${t('other')}</button>`);
    el.querySelector('#hmOut').onclick = async () => { try { await sb.auth.signOut(); } catch (e) {} location.reload(); };
  }

  // Headers for calls to our own /api/* routes
  window.hmAuthHeaders = async function () {
    const { data } = await sb.auth.getSession();
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ((data.session && data.session.access_token) || '') };
  };

  window.hmSignOut = async function () { try { await sb.auth.signOut(); } catch (e) {} location.reload(); };

  // No saved login: block the page right away.
  if (!hasSession) {
    if (document.body) emailStep(); else document.addEventListener('DOMContentLoaded', () => emailStep());
    return;
  }
  // Saved login: check it is still valid and allowed.
  window.addEventListener('load', async () => {
    try {
      const { data } = await sb.auth.getSession();
      if (!data.session) return emailStep();
      const { data: ok, error } = await sb.rpc('is_allowed');
      if (error) { console.error(error); return; }          // don't lock out on a network hiccup
      if (ok !== true) noAccess(data.session.user && data.session.user.email);
    } catch (e) { console.error(e); }
  });
})();
