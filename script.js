// ===================== TABS =====================
const tabBtns = document.querySelectorAll('.tab-btn');
const panels = { inspect: document.getElementById('panel-inspect'), editor: document.getElementById('panel-editor') };

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-selected', 'false'); });
    btn.classList.add('is-active'); btn.setAttribute('aria-selected', 'true');
    Object.values(panels).forEach(p => p.classList.remove('is-active'));
    panels[btn.dataset.tab].classList.add('is-active');
  });
});

const subtabBtns = document.querySelectorAll('.subtab-btn');
subtabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    subtabBtns.forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('is-active'));
    document.querySelector(`[data-sub-panel="${btn.dataset.sub}"]`).classList.add('is-active');
  });
});

// ===================== READOUT STRIP =====================
const clockEl = document.getElementById('readout-clock');
const bytesEl = document.getElementById('readout-bytes');
const linesEl = document.getElementById('readout-lines');
const statusEl = document.getElementById('readout-status');
const startTime = Date.now();

function pad(n){ return String(n).padStart(2,'0'); }
setInterval(() => {
  const s = Math.floor((Date.now() - startTime) / 1000);
  clockEl.textContent = `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`;
}, 1000);

function setReadout(bytes, lines, status){
  if (bytes !== undefined) bytesEl.textContent = bytes.toLocaleString();
  if (lines !== undefined) linesEl.textContent = lines.toLocaleString();
  if (status !== undefined) statusEl.textContent = status;
}

// ===================== INSPECTOR =====================
const urlInput = document.getElementById('url-input');
const btnInspect = document.getElementById('btn-inspect');
const proxySelect = document.getElementById('proxy-select');
const btnManualToggle = document.getElementById('btn-manual');
const manualBox = document.getElementById('manual-paste');
const manualInput = document.getElementById('manual-input');
const btnManualRun = document.getElementById('btn-manual-run');
const emptyState = document.getElementById('inspect-empty');
const resultsBox = document.getElementById('inspect-results');
const statGrid = document.getElementById('stat-grid');

function proxyUrl(target){
  const encoded = encodeURIComponent(target);
  if (proxySelect.value === 'corsproxy') return `https://corsproxy.io/?url=${encoded}`;
  return `https://api.allorigin.win/raw?url=${encoded}`;
}

btnManualToggle.addEventListener('click', () => manualBox.classList.toggle('hidden'));

btnInspect.addEventListener('click', async () => {
  let target = urlInput.value.trim();
  if (!target) return;
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

  setReadout(undefined, undefined, 'FETCHING…');
  btnInspect.disabled = true;
  btnInspect.textContent = 'Working…';

  try {
    const res = await fetch(proxyUrl(target));
    if (!res.ok) throw new Error('Relay returned ' + res.status);
    const html = await res.text();
    analyzeSource(html, target);
    setReadout(undefined, undefined, 'DONE');
  } catch (err) {
    setReadout(undefined, undefined, 'BLOCKED');
    alert(
      'Could not fetch that page through the relay (some sites block CORS proxies entirely).\n\n' +
      'Try the other relay in the dropdown, or open the page, view its source ' +
      '(Ctrl/Cmd+U or DevTools → Elements → copy outerHTML) and use "manual paste" instead.\n\n' +
      'Details: ' + err.message
    );
  } finally {
    btnInspect.disabled = false;
    btnInspect.textContent = 'Inspect';
  }
});

btnManualRun.addEventListener('click', () => {
  const html = manualInput.value;
  if (!html.trim()) return;
  analyzeSource(html, urlInput.value.trim() || '(pasted source)');
  setReadout(undefined, undefined, 'DONE');
});

function escapeHtml(str){
  return str.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function analyzeSource(html, sourceLabel){
  emptyState.classList.add('hidden');
  resultsBox.classList.remove('hidden');

  const bytes = new Blob([html]).size;
  const lineCount = html.split('\n').length;
  setReadout(bytes, lineCount);

  const doc = new DOMParser().parseFromString(html, 'text/html');

  // ---- pull inline + external assets ----
  const styleTags = [...doc.querySelectorAll('style')].map(s => s.textContent).join('\n\n');
  const externalCss = [...doc.querySelectorAll('link[rel="stylesheet"]')].map(l => l.getAttribute('href')).filter(Boolean);
  const scriptTags = [...doc.querySelectorAll('script:not([src])')].map(s => s.textContent).join('\n\n');
  const externalJs = [...doc.querySelectorAll('script[src]')].map(s => s.getAttribute('src')).filter(Boolean);

  document.getElementById('code-html').textContent = html;
  document.getElementById('code-css').textContent =
    (externalCss.length ? `/* external stylesheets:\n${externalCss.join('\n')}\n*/\n\n` : '') + (styleTags || '/* no inline <style> found */');
  document.getElementById('code-js').textContent =
    (externalJs.length ? `// external scripts:\n// ${externalJs.join('\n// ')}\n\n` : '') + (scriptTags || '// no inline <script> found');

  // ---- structure stats ----
  const imgs = [...doc.querySelectorAll('img')];
  const imgsNoAlt = imgs.filter(i => !i.getAttribute('alt'));
  const links = [...doc.querySelectorAll('a[href]')];
  let internal = 0, external = 0;
  links.forEach(a => {
    const href = a.getAttribute('href');
    if (/^https?:\/\//i.test(href)) {
      try { external += (new URL(href).hostname !== new URL(sourceLabel).hostname) ? 1 : 0; if (new URL(href).hostname === new URL(sourceLabel).hostname) internal++; }
      catch { external++; }
    } else internal++;
  });
  const headingCounts = {};
  for (let i=1;i<=6;i++) headingCounts['h'+i] = doc.querySelectorAll('h'+i).length;

  statGrid.innerHTML = '';
  const stats = [
    { label: 'Page size', num: (bytes/1024).toFixed(1) + ' KB' },
    { label: 'Lines', num: lineCount },
    { label: 'Images', num: imgs.length, warn: imgsNoAlt.length > 0 },
    { label: 'Missing alt', num: imgsNoAlt.length, bad: imgsNoAlt.length > 0 },
    { label: 'Links', num: links.length },
    { label: 'Ext. scripts', num: externalJs.length },
    { label: 'Ext. styles', num: externalCss.length },
    { label: 'H1 tags', num: headingCounts.h1, warn: headingCounts.h1 !== 1 },
  ];
  stats.forEach(s => {
    const cell = document.createElement('div');
    cell.className = 'stat-cell' + (s.bad ? ' bad' : s.warn ? ' warn' : '');
    cell.innerHTML = `<span class="num">${s.num}</span><span class="label">${s.label}</span>`;
    statGrid.appendChild(cell);
  });

  // ---- SEO report ----
  const title = doc.querySelector('title')?.textContent?.trim();
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
  const viewport = doc.querySelector('meta[name="viewport"]');
  const canonical = doc.querySelector('link[rel="canonical"]');
  const ogTags = [...doc.querySelectorAll('meta[property^="og:"]')].length;

  const seo = document.getElementById('seo-report');
  seo.innerHTML = `
    <div class="seo-block">
      <h4>Title &amp; description</h4>
      <ul>
        <li class="${title ? 'seo-ok' : 'seo-bad'}">Title: ${title ? escapeHtml(title) + ` (${title.length} chars)` : 'missing'}</li>
        <li class="${metaDesc ? 'seo-ok' : 'seo-warn'}">Meta description: ${metaDesc ? escapeHtml(metaDesc.slice(0,160)) + ` (${metaDesc.length} chars)` : 'missing'}</li>
      </ul>
    </div>
    <div class="seo-block">
      <h4>Headings</h4>
      <ul>
        ${Object.entries(headingCounts).map(([tag,count]) =>
          `<li class="${tag==='h1' && count!==1 ? 'seo-warn' : 'seo-ok'}">${tag.toUpperCase()}: ${count}${tag==='h1' && count===0 ? ' — no H1 found' : ''}${tag==='h1' && count>1 ? ' — more than one H1' : ''}</li>`
        ).join('')}
      </ul>
    </div>
    <div class="seo-block">
      <h4>Technical</h4>
      <ul>
        <li class="${viewport ? 'seo-ok' : 'seo-warn'}">Viewport meta tag: ${viewport ? 'present' : 'missing (mobile rendering may suffer)'}</li>
        <li class="${canonical ? 'seo-ok' : 'seo-warn'}">Canonical link: ${canonical ? escapeHtml(canonical.getAttribute('href')) : 'missing'}</li>
        <li class="${ogTags ? 'seo-ok' : 'seo-warn'}">Open Graph tags: ${ogTags} found</li>
        <li class="${imgsNoAlt.length === 0 ? 'seo-ok' : 'seo-warn'}">Images without alt text: ${imgsNoAlt.length} of ${imgs.length}</li>
      </ul>
    </div>
  `;
}

// ===================== EDITOR =====================
const srcHtml = document.getElementById('src-html');
const srcCss = document.getElementById('src-css');
const srcJs = document.getElementById('src-js');
const previewFrame = document.getElementById('preview-frame');
const templateSelect = document.getElementById('template-select');
const btnDownload = document.getElementById('btn-download');

const templates = {
  blank: {
    html: `<h1>Hello, world</h1>\n<p>Start typing to edit this page.</p>`,
    css: `body{\n  font-family: system-ui, sans-serif;\n  padding: 40px;\n  color: #222;\n}`,
    js: `console.log('Ready.');`
  },
  'neon-card': {
    html: `<div class="card">\n  <div class="avatar">JS</div>\n  <h2>Jamie Soto</h2>\n  <p>Frontend engineer · building small, fast things.</p>\n  <button id="ping">Say hi</button>\n</div>`,
    css: `body{\n  min-height:100vh; margin:0; display:flex; align-items:center; justify-content:center;\n  background: radial-gradient(circle at 30% 20%, #1c1033, #05010a 70%);\n  font-family: 'Segoe UI', sans-serif;\n}\n.card{\n  background: rgba(255,255,255,0.04);\n  border: 1px solid rgba(255,80,220,0.4);\n  box-shadow: 0 0 30px rgba(255,80,220,0.25);\n  border-radius: 16px; padding: 32px; text-align:center; color:#fff; width:260px;\n}\n.avatar{\n  width:64px;height:64px;border-radius:50%;margin:0 auto 14px;\n  background: linear-gradient(135deg,#ff2fd0,#7a5cff);\n  display:flex;align-items:center;justify-content:center;font-weight:700;\n}\nbutton{\n  margin-top:14px; padding:10px 18px; border-radius:8px; border:none;\n  background: linear-gradient(135deg,#ff2fd0,#7a5cff); color:#fff; cursor:pointer; font-weight:600;\n}`,
    js: `document.getElementById('ping').addEventListener('click', () => {\n  alert('Hi there!');\n});`
  },
  'glass-form': {
    html: `<form class="signup">\n  <h2>Create account</h2>\n  <input type="email" placeholder="Email" required />\n  <input type="password" placeholder="Password" required />\n  <button type="submit">Sign up</button>\n</form>`,
    css: `body{\n  min-height:100vh; margin:0; display:flex; align-items:center; justify-content:center;\n  background: linear-gradient(135deg,#0f2027,#203a43,#2c5364);\n  font-family: system-ui, sans-serif;\n}\n.signup{\n  background: rgba(255,255,255,0.08); backdrop-filter: blur(12px);\n  border: 1px solid rgba(255,255,255,0.2); border-radius:14px;\n  padding: 30px; width: 260px; display:flex; flex-direction:column; gap:12px;\n}\n.signup h2{ color:#fff; margin:0 0 6px; }\n.signup input{\n  padding:10px; border-radius:8px; border:none; outline:none;\n}\n.signup button{\n  padding:10px; border-radius:8px; border:none; background:#fff; font-weight:600; cursor:pointer;\n}`,
    js: `document.querySelector('.signup').addEventListener('submit', (e) => {\n  e.preventDefault();\n  alert('Account created (demo only).');\n});`
  },
  terminal: {
    html: `<div id="term"></div>`,
    css: `body{ margin:0; background:#000; }\n#term{\n  font-family: 'Courier New', monospace; color:#0f0; padding:20px; font-size:14px; white-space:pre-wrap;\n}`,
    js: `const lines = ['Booting kernel...', 'Mounting filesystems...', 'Starting services...', 'Ready.'];\nconst term = document.getElementById('term');\nlet i = 0;\nfunction next(){\n  if (i < lines.length){\n    term.textContent += lines[i] + '\\n';\n    i++;\n    setTimeout(next, 500);\n  }\n}\nnext();`
  }
};

function loadTemplate(name){
  const t = templates[name] || templates.blank;
  srcHtml.value = t.html; srcCss.value = t.css; srcJs.value = t.js;
  renderPreview();
}

function renderPreview(){
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>${srcCss.value}</style></head><body>${srcHtml.value}<script>${srcJs.value}<\/script></body></html>`;
  previewFrame.srcdoc = doc;
}

let debounceTimer;
[srcHtml, srcCss, srcJs].forEach(el => {
  el.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderPreview, 250);
  });
});

templateSelect.addEventListener('change', () => loadTemplate(templateSelect.value));

btnDownload.addEventListener('click', () => {
  const doc = `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<style>\n${srcCss.value}\n</style>\n</head>\n<body>\n${srcHtml.value}\n<script>\n${srcJs.value}\n<\/script>\n</body>\n</html>`;
  const blob = new Blob([doc], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'page.html';
  a.click();
});

// init
loadTemplate('blank');
