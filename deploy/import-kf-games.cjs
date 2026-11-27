#!/usr/bin/env node
/* 导入「ふるかわけい」授权小游戏
 *
 * 依据作者授权（可在中国地区部署、不得部署在日本），把原作页面抓下来做本地化：
 *   1. 去掉 Google Analytics 与站内广告脚本、canonical、JSON-LD
 *   2. 注入中文语言包（deploy/kf-zh/<slug>.js），默认语言改为 zh，语言下拉补上「中文」
 *   3. importmap 里的 three.js 换成本地文件，避免国内访问 jsDelivr 卡住
 *   4. 「返回顶部」改成回 LiteGame 大厅，底部加原作署名
 *   5. 复制 icon / 封面，并把目录条目写进 assets/js/games.js 的 KF-IMPORT 区块
 *
 * 用法：node deploy/import-kf-games.cjs [--only slug1,slug2] [--dry]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'kf-manifest.json'), 'utf8'));
const THREE_VERSION = '0.160.0';
const THREE_CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;
const CATALOG_START = '    // KF-IMPORT START';
const CATALOG_END = '    // KF-IMPORT END';

const args = process.argv.slice(2);
const onlyArg = args.indexOf('--only');
const only = onlyArg >= 0 ? String(args[onlyArg + 1] || '').split(',').filter(Boolean) : null;
const dry = args.includes('--dry');

async function get(url, { binary = false } = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'LiteGame-import/1.0 (authorized localization)' },
        redirect: 'follow'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
      return binary ? Buffer.from(await response.arrayBuffer()) : response.text();
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

function writeFile(rel, data) {
  const target = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  return rel;
}

function must(condition, message) {
  if (!condition) throw new Error('页面结构与预期不符：' + message);
}

/** 去掉统计/广告/指向原站的结构化数据 */
function stripThirdParty(html) {
  let out = html;
  out = out.replace(/<script[^>]*googletagmanager\.com[^>]*><\/script>\s*/g, '');
  out = out.replace(/<script(?![^>]*type="module")[^>]*>[\s\S]*?gtag\([\s\S]*?<\/script>\s*/g, '');
  out = out.replace(/<script[^>]*\bsrc="[^"]*ad\.js"[^>]*><\/script>\s*/g, '');
  out = out.replace(/<link[^>]*rel="canonical"[^>]*>\s*/g, '');
  out = out.replace(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>\s*/g, '');
  out = out.replace(/<div[^>]*id="adSlot"[^>]*>[\s\S]*?<\/div>\s*/g, '');
  // Google Fonts 在国内常被墙，去掉后走系统字体回落
  out = out.replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
  return out;
}

function localizeThree(html) {
  return html
    .replaceAll(`${THREE_CDN}/build/three.module.js`, '../lib/three/build/three.module.js')
    .replaceAll(`${THREE_CDN}/examples/jsm/`, '../lib/three/examples/jsm/');
}

function applyMeta(html, game) {
  let out = html;
  out = out.replace(/<html([^>]*)\blang="[^"]*"/i, '<html$1lang="zh-CN"');
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${game.title} · LiteGame</title>`);
  out = out.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${game.description}">`
  );
  out = out.replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${game.title} · LiteGame">`);
  out = out.replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${game.description}">`);
  return out;
}

/** 从 openIndex 的 `{` 开始，找到与之配对的 `}`（跳过字符串与注释） */
function matchBrace(text, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); if (i < 0) return text.length; continue; }
    if (ch === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i); if (i < 0) return text.length; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 找到形如 const DICT = { ja: {...}, ko: {...} } 的语言表（变量名各游戏不同） */
function findLanguageTables(html) {
  const tables = [];
  for (const m of html.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g)) {
    const open = html.indexOf('{', m.index);
    const end = matchBrace(html, open);
    if (end < 0) continue;
    const block = html.slice(open, end);
    if (/\bja\s*:\s*\{/.test(block) && /\b(ko|en|th)\s*:\s*\{/.test(block)) {
      tables.push({ name: m[1], open, end, size: block.length });
    }
  }
  return tables;
}

/** 真正的语言表：被 `X[lang][k]` 取用的那个；找不到就退回最大的 */
function findLanguageTable(html) {
  const tables = findLanguageTables(html);
  if (!tables.length) {
    // 回退：从 ja: 往前找最近的 const 定义，再往后找行首的 };
    const jaPos = html.search(/\bja\s*:\s*\{/);
    if (jaPos > 0) {
      const head = html.slice(0, jaPos);
      const decls = [...head.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g)];
      const last = decls[decls.length - 1];
      const end = html.indexOf('\n};', jaPos);
      if (last && end > jaPos) {
        return { name: last[1], open: html.indexOf('{', last.index), end: end + 2, size: end - last.index };
      }
    }
    return null;
  }
  const used = tables.find((t) => new RegExp('\\b' + t.name + '\\s*\\[\\s*lang\\s*\\]').test(html));
  return used || tables.sort((a, b) => b.size - a.size)[0];
}

/** 有些游戏除主语言表外还有按语言索引的副表（台词、菜名等）。
 *  没有中文内容时先退回英文，避免 [lang] 取到 undefined 直接崩。 */
function aliasExtraTables(html, primaryName) {
  const names = new Set();
  for (const m of html.matchAll(/([A-Za-z_$][\w$]*)\s*\[\s*lang\s*\]/g)) names.add(m[1]);
  names.delete(primaryName);
  const inserts = [];
  for (const name of names) {
    const re = new RegExp('const\\s+' + name + '\\s*=\\s*\\{', 'g');
    const m = re.exec(html);
    if (!m) continue;
    const open = html.indexOf('{', m.index);
    const end = matchBrace(html, open);
    if (end < 0) continue;
    const block = html.slice(open, end);
    if (!/\bja\s*:/.test(block) && !/\ben\s*:/.test(block)) continue;
    inserts.push({ end, name });
  }
  inserts.sort((a, b) => b.end - a.end);
  let out = html;
  for (const item of inserts) {
    out = out.slice(0, item.end + 1) +
      `\nObject.assign(${item.name}, { zh: ${item.name}.zh || ${item.name}.en });` +
      out.slice(item.end + 1);
  }
  return out;
}

/** 注入中文语言包，并把默认语言设为中文 */
function injectChinese(html, zhSource, options = {}) {
  let out = html;

  // 1) 语言包：插在“定义语言表的那个脚本”之前，module 与经典脚本都适用
  const zhScript = `<script>/* 中文本地化：LiteGame（经作者授权） */\n${zhSource.trim()}\n</script>\n`;
  const tableAt = findLanguageTable(out);
  if (!tableAt && options.noDict) {
    console.log('   · 这个作品没有语言表，只替换标题与导航');
    return out;
  }
  must(tableAt, '找不到语言表');
  const scriptOpen = out.lastIndexOf('<script', tableAt.open);
  must(scriptOpen > 0, '语言表不在 script 标签里');
  out = out.slice(0, scriptOpen) + zhScript + out.slice(scriptOpen);

  // 2) 找到语言表并合并 zh（不同游戏变量名可能是 L / DICT / 其他）
  const table = findLanguageTable(out);
  must(table, '找不到 ja/ko 语言表');
  out = out.slice(0, table.end + 1) +
    `\nconst __KF_ZH_LANG = Object.assign(${table.name}, { zh: window.__KF_ZH__ || {} });` +
    `\nfor (const __k in ${table.name}.ja) if (${table.name}.zh[__k] == null) ${table.name}.zh[__k] = ${table.name}.ja[__k];` +
    `\nif (!${table.name}.zh.lang) ${table.name}.zh.lang = '中文';` +
    `\ntry { const __fix = () => { const __s = document.querySelector('#lang'); if (__s && __s.tagName === 'SELECT') { if (!__s.querySelector('option[value="zh"]')) { const __o = document.createElement('option'); __o.value = 'zh'; __o.textContent = '中文'; __s.append(__o); } __s.value = 'zh'; } }; __fix(); setTimeout(__fix, 300); setTimeout(__fix, 1500); } catch (__e) {}\n` +
    out.slice(table.end + 1);

  // 3) 默认语言：有中文包就用 zh，否则回落 en
  if (/\blet\s+lang\s*=\s*[^;\n]+;/.test(out)) {
    out = out.replace(/\blet\s+lang\s*=\s*[^;\n]+;/, "let lang = (window.__KF_ZH__ ? 'zh' : 'en');");
  } else {
    console.warn('  ! 没有找到 let lang 初始化，默认语言可能不是中文');
  }

  // 3.5) 副表退回英文，避免缺中文时崩溃
  out = aliasExtraTables(out, table.name);

  // 3.55) 有些作品用 LANGS 白名单兜底，不在名单里的语言会被重置成 en
  out = out.replace(/const\s+LANGS\s*=\s*\[([^\]]*)\]/, (all, inner) =>
    /['"]zh['"]/.test(inner) ? all : `const LANGS=[${inner.trim().replace(/,$/, '')},'zh']`);

  // 3.58) 有的作品紧跟着从 localStorage 还原语言，会把默认值覆盖掉
  out = out.replace(/try\{\s*lang\s*=\s*localStorage\.getItem\(([^)]*)\)\s*\}catch\{\}/,
    "try{lang=window.__KF_ZH__?'zh':localStorage.getItem($1)}catch{}");

  // 3.6) 有些作品会把 lang 从 localStorage 读回来，覆盖前面的默认值；
  //      在真正 applyLang() 之前再强制一次中文。
  if (/\bapplyLang\s*\(\s*\)\s*;/.test(out)) {
    out = out.replace(/(\n[ \t]*)(applyLang\s*\(\s*\)\s*;)/, '$1if (window.__KF_ZH__) lang = \'zh\';$1$2');
  }

  // 4) 语言下拉补一项
  if (/<select id="lang"[^>]*>/.test(out)) {
    out = out.replace(/(<select id="lang"[^>]*>)([\s\S]*?)(<\/select>)/,
      (all, open, options, close) => open + options.replace('</option>', '</option><option value="zh">中文</option>') + close);
  }
  return out;
}

function addCredit(html, credit) {
  const footer = `<footer style="position:fixed;left:10px;bottom:6px;z-index:60;font:11px/1.5 -apple-system,sans-serif;color:#a49a87;opacity:.55;pointer-events:none;max-width:70vw">${credit}</footer>\n`;
  return html.replace('</body>', footer + '</body>');
}

function fixNavigation(html) {
  // 属性顺序两种写法都有，整段取出来再改 href
  return html.replace(/<a\b[^>]*\bid="back"[^>]*>/g, (tag) =>
    tag.replace(/\bhref="[^"]*"/, 'href="../../index.html#/category/premium"'));
}

async function vendorRapier(html) {
  const marker = '@dimforge/rapier3d-compat';
  if (!html.includes(marker)) return html;
  const target = 'games/lib/rapier/rapier.es.js';
  if (!fs.existsSync(path.join(ROOT, target))) {
    const match = html.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/@dimforge\/rapier3d-compat@[\d.]+\/rapier\.es\.js/);
    if (!match) console.warn('  ! 找到 rapier 依赖但认不出地址，未本地化');
    else {
      writeFile(target, await get(match[0]));
      console.log('   ✓ 本地化 rapier 物理引擎');
    }
  }
  return html.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@dimforge\/rapier3d-compat@[\d.]+\/rapier\.es\.js/g,
    '../lib/rapier/rapier.es.js');
}

/** 通用 CDN 依赖本地化：jsDelivr / cdnjs 上的第三方库下载到 games/lib/vendor/ 并改写引用 */
async function vendorCdn(html) {
  const SOURCES = [
    { prefix: 'https://cdn.jsdelivr.net/npm/', local: '../lib/vendor/' },
    { prefix: 'https://cdnjs.cloudflare.com/ajax/libs/', local: '../lib/vendor/cdnjs/' }
  ];
  const replacements = new Map();
  const queue = [];
  const seen = new Set();

  const classify = (url) => {
    for (const src of SOURCES) if (url.startsWith(src.prefix)) return src;
    return null;
  };
  const toLocal = (url, src) => src.local + url.slice(src.prefix.length);
  const enqueue = (url) => {
    const src = classify(url);
    if (!src || seen.has(url)) return;
    seen.add(url);
    queue.push(url);
  };

  for (const src of SOURCES) {
    const re = new RegExp(src.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"\'\\s)]+', 'g');
    for (const m of html.matchAll(re)) enqueue(m[0].replace(/[),;]+$/, ''));
  }
  if (!queue.length) return html;

  while (queue.length) {
    const url = queue.shift();
    const src = classify(url);
    const local = toLocal(url, src);
    replacements.set(url, local);
    let data;
    try {
      data = await get(url, { binary: true });
    } catch (error) {
      console.warn(`  ! 依赖下载失败 ${url}: ${error.message}`);
      continue;
    }
    writeFile('games/lib/' + local.replace(/^\.\.\/lib\//, ''), data);
    if (/\.(js|mjs)$/.test(url)) {
      const text = data.toString('utf8');
      const baseDir = url.slice(0, url.lastIndexOf('/') + 1);
      for (const m of text.matchAll(/(?:import|from)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
        enqueue(new URL(m[1], baseDir).href);
      }
    }
  }

  let out = html;
  for (const [from, to] of replacements) out = out.split(from).join(to);
  return out;
}

async function vendorThree(addonPaths) {
  const written = [];
  const corePath = 'games/lib/three/build/three.module.js';
  if (!fs.existsSync(path.join(ROOT, corePath))) {
    writeFile(corePath, await get(`${THREE_CDN}/build/three.module.js`));
    written.push(corePath + ' (core)');
  }
  const queue = [...addonPaths];
  const done = new Set();
  while (queue.length) {
    const spec = queue.shift();
    if (done.has(spec)) continue;
    done.add(spec);
    const rel = `games/lib/three/examples/jsm/${spec}`;
    let source;
    try {
      if (fs.existsSync(path.join(ROOT, rel))) {
        source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      } else {
        source = await get(`${THREE_CDN}/examples/jsm/${spec}`);
        writeFile(rel, source);
        written.push(rel);
      }
    } catch (error) {
      console.warn(`  ! 附加模块下载失败 ${spec}: ${error.message}`);
      continue;
    }
    // 继续拉取模块内部的相对依赖
    const dir = path.posix.dirname(spec);
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const resolved = path.posix.normalize(path.posix.join(dir, match[1]));
      if (!queue.includes(resolved)) queue.push(resolved);
    }
  }
  return written;
}

/** 递归抓取同目录的模块与静态资源（部分游戏把逻辑拆在 robot.js 之类的文件里） */
async function fetchLocalAssets(html, base, dir) {
  const queue = [];
  const seen = new Set();
  const isLocal = (ref) => {
    if (!ref || ref.startsWith('#') || ref.startsWith('data:')) return null;
    if (/^(https?:)?\/\//i.test(ref) || /^mailto:/i.test(ref)) return null;
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) return null;
    // 裸模块名（three、three/addons/…）交给 importmap，不要去站点上找文件
    const looksLikePath = clean.startsWith('./') || clean.startsWith('/') ||
      (!clean.includes('/') && /\.\w{2,5}$/.test(clean));
    if (!looksLikePath) return null;
    const resolved = path.posix.normalize(clean);
    if (resolved.startsWith('..')) return null; // 不把站外路径带进来
    return resolved;
  };
  const enqueue = (ref) => {
    const resolved = isLocal(ref);
    if (resolved && !seen.has(resolved)) { seen.add(resolved); queue.push(resolved); }
  };

  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) enqueue(m[1]);
  // 内联脚本里 new Image().src = 'cat.png' 这类引用
  for (const m of html.matchAll(/['"]([\w./-]+\.(?:png|webp|jpg|jpeg|svg|mp3|ogg|wav|json|glb|gltf))['"]/g)) enqueue(m[1]);
  for (const m of html.matchAll(/(?:import|from)\s*\(?\s*['"]([^'"]+)['"]/g)) enqueue(m[1]);

  const written = [];
  while (queue.length) {
    const rel = queue.shift();
    if (rel === 'index.html') continue;
    let data;
    try {
      data = await get(base + rel, { binary: true });
    } catch (error) {
      console.warn(`  ! 资源缺失 ${rel}: ${error.message}`);
      continue;
    }
    if (/\.(js|mjs)$/.test(rel)) {
      const source = localizeThree(data.toString('utf8'));
      writeFile(`${dir}/${rel}`, source);
      for (const m of source.matchAll(/(?:import|from)\s*\(?\s*['"]([^'"]+)['"]/g)) enqueue(m[1]);
      // 代码里用字符串引用的贴图/音频（TextureLoader().load('cat.png') 这类）
      for (const m of source.matchAll(/['"]([\w./-]+\.(?:png|webp|jpg|jpeg|svg|mp3|ogg|wav|json|glb|gltf))['"]/g)) enqueue(m[1]);
    } else {
      writeFile(`${dir}/${rel}`, data);
    }
    written.push(rel);
  }
  return written;
}

async function importGame(game) {
  const base = `${MANIFEST.source}/games/${game.slug}/`;
  const html = await get(base);
  const zhPath = path.join(__dirname, 'kf-zh', `${game.slug}.js`);
  const hasZh = fs.existsSync(zhPath);
  if (!hasZh && !game.noDict) must(false, `缺少中文语言包 kf-zh/${game.slug}.js`);
  const zhSource = hasZh ? fs.readFileSync(zhPath, 'utf8') : '';

  let out = stripThirdParty(html);
  out = localizeThree(out);
  out = await vendorRapier(out);
  out = await vendorCdn(out);
  out = applyMeta(out, game);
  out = injectChinese(out, zhSource, { noDict: !!game.noDict });
  out = fixNavigation(out);
  if (game.originalTitle) out = out.split(game.originalTitle).join(game.title);
  out = out.replace(/const URL_ = 'https:\/\/keifurukawafunnych\.com\/games\/[^']+\/';/,
    "const URL_ = new URL('./', location.href).href;");
  if (game.peerShim) {
    // 用我们的房间中继顶替 PeerJS：去掉原库，注入兼容层
    out = out.replace(/<script[^>]*peerjs[^>]*><\/script>\s*/gi, '');
    out = out.replace(/\s*import\([^)]*peerjs[^)]*\)/g, '');
    // 原作房号是 4 位短码，我们的房号是 6 位数字：放宽长度校验
    out = out.replace(/code\.length\s*!==\s*4/g, '(code.length < 4 || code.length > 8)');
    // 房号输入框也限了 4 位
    out = out.replace(/maxlength=["']4["']/g, 'maxlength="8"');
    out = out.replace(/maxLength\s*=\s*4\b/g, 'maxLength = 8');
    // 加入按钮的可用条件同样写死了 4 位
    out = out.replace(/disabled\s*=\s*([^;]+?)\.length\s*!==\s*4\s*;/g,
      'disabled = ($1.length < 4 || $1.length > 8);');
    out = out.replace('</body>',
      '<script src="../../assets/js/server-sync.js"></script>\n' +
      '<script src="../../assets/js/room-client.js"></script>\n' +
      '<script src="../../assets/js/peer-shim.js"></script>\n</body>');
  }
  out = addCredit(out, MANIFEST.credit);

  const dir = `games/kf-${game.slug}`;
  writeFile(`${dir}/index.html`, out);
  const extra = await fetchLocalAssets(out, base, dir);
  for (const asset of ['icon.png', 'thumb.webp']) {
    if (!extra.includes(asset)) {
      try {
        writeFile(`${dir}/${asset}`, await get(base + asset, { binary: true }));
      } catch (_) { /* 没有这个资源就跳过 */ }
    }
  }
  // 封面用原作缩略图，目录里引用 webp
  const cover = `assets/images/covers/kf-${game.slug}.webp`;
  try {
    writeFile(cover, await get(base + 'thumb.webp', { binary: true }));
  } catch (error) {
    console.warn(`  ! 封面缺失 ${game.slug}: ${error.message}`);
  }

  const addons = [...out.matchAll(/three\/addons\/([\w./-]+\.js)/g)].map((m) => m[1]);
  return { addons, files: [`${dir}/index.html`, ...extra] };
}

function catalogEntry(game) {
  const tags = game.tags.map((t) => JSON.stringify(t)).join(',');
  return `    {id:'kf-${game.slug}',title:${JSON.stringify(game.title)},category:'premium',url:'games/kf-${game.slug}/index.html?from=premium',cover:'assets/images/covers/kf-${game.slug}.webp',tags:[${tags}],description:${JSON.stringify(game.description)},badge:'NEW',source:'Kei Furukawa（授权移植）'},`;
}

function updateCatalog() {
  // 始终按整份清单重建，避免 --only 时把别的条目冲掉；只收录已经导入过的。
  const games = MANIFEST.games.filter((g) => fs.existsSync(path.join(ROOT, `games/kf-${g.slug}/index.html`)));
  const file = path.join(ROOT, 'assets/js/games.js');
  const source = fs.readFileSync(file, 'utf8');
  must(source.includes(CATALOG_START) && source.includes(CATALOG_END), 'games.js 缺少 KF-IMPORT 标记');
  const entries = games
    .slice()
    .sort((a, b) => (a.order || 99) - (b.order || 99))
    .map(catalogEntry)
    .join('\n');
  const next = source.replace(
    new RegExp(`${CATALOG_START}[\\s\\S]*?${CATALOG_END}`),
    `${CATALOG_START}\n${entries}\n${CATALOG_END}`
  );
  if (!dry) fs.writeFileSync(file, next);
  return games.length;
}

async function main() {
  const games = MANIFEST.games.filter((g) => !only || only.includes(g.slug));
  if (!games.length) throw new Error('清单为空，或 --only 没有匹配到游戏');

  const addons = new Set();
  for (const game of games) {
    process.stdout.write(`→ ${game.slug} (${game.title})\n`);
    const result = await importGame(game);
    result.addons.forEach((a) => addons.add(a));
    console.log(`   ✓ ${result.files.join(', ')}`);
  }

  console.log('→ 本地化 three.js 运行时');
  const written = await vendorThree([...addons]);
  console.log(`   ✓ ${written.length} 个文件${written.length ? '：' + written.slice(0, 4).join(', ') : '（已存在）'}`);

  const count = updateCatalog();
  console.log(`→ 目录已更新：${count} 条目`);
  console.log(dry ? '（dry run，未写盘）' : '完成。');
}

main().catch((error) => {
  console.error('导入失败：', error.message);
  process.exitCode = 1;
});