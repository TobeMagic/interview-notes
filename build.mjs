#!/usr/bin/env node
/**
 * 八股志生成器。
 *
 * 源文件分层：
 *   # 篇名
 *   ## 大章
 *   ### 1.🌟小节标题
 *
 * 标记：
 *   **一句话**：核心结论     → 导语块
 *   **背景**：／**原理**：／**细节**：／**注意**：  → 小标题段落
 *   **面经**：公司/轮次/链接 → 引用条
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { SITE, MODULES, GROUPS } from './site.config.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const DIST = path.join(ROOT, 'dist');
const CHECK = process.argv.includes('--check');

marked.setOptions({ gfm: true, breaks: false });

/* ---------------------------------------------------------------- 工具 */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\w\u4e00-\u9fa5\- ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'sec';

function parseHeading(raw) {
  let text = raw.trim();
  const star = /🌟/.test(text);
  text = text.replace(/🌟/g, '').trim();
  const m = text.match(/^(\d+)\s*[.、．]\s*(.*)$/);
  if (m) return { no: m[1], star, title: m[2].trim() };
  return { no: null, star, title: text };
}

/* ---------------------------------------------------------------- 解析 */

const APPENDIX_RE = /面经汇总|这一篇没写|这一章没写|^依据$/;

function parseDoc(raw) {
  const lines = raw.split('\n');
  const chapters = [];
  let intro = [];
  let cur = null;
  let sec = null;
  let fence = false;

  const pushSec = () => {
    if (sec && cur) cur.sections.push(sec);
    sec = null;
  };
  const pushChapter = () => {
    pushSec();
    if (cur) chapters.push(cur);
    cur = null;
  };

  for (const line of lines) {
    if (/^```/.test(line)) fence = !fence;
    if (!fence && /^#\s+/.test(line)) continue;

    if (!fence && /^##\s+/.test(line)) {
      pushChapter();
      const title = line.replace(/^##\s+/, '').trim().replace(/🌟/g, '');
      cur = { title, id: 'c-' + slugify(title), sections: [], pre: [] };
      continue;
    }
    if (!fence && /^###\s+/.test(line)) {
      pushSec();
      if (!cur) cur = { title: '正文', id: 'c-zhengwen', sections: [], pre: [] };
      const { no, star, title } = parseHeading(line.replace(/^###\s+/, ''));
      sec = { no, star, title, id: 's-' + slugify((no ? no + '-' : '') + title), lines: [] };
      continue;
    }

    if (sec) sec.lines.push(line);
    else if (cur) cur.pre.push(line);
    else intro.push(line);
  }
  pushChapter();

  const kept = chapters.filter((c) => c.title);
  return {
    intro: intro.join('\n').trim(),
    chapters: kept.filter((c) => !APPENDIX_RE.test(c.title)),
    appendix: kept.filter((c) => APPENDIX_RE.test(c.title)),
  };
}

/* ---------------------------------------------------------------- 渲染 */

const CALLOUTS = {
  背景: 'bg',
  原理: 'why',
  细节: 'detail',
  注意: 'warn',
  结论: 'concl',
  对比: 'detail',
  做法: 'detail',
};

function renderBody(md) {
  let html = marked.parse(md || '');

  html = html.replace(/<p><strong>一句话<\/strong>[：:]\s*([\s\S]*?)<\/p>/g,
    (_, inner) => `<div class="oneline"><span class="oneline-tag">一句话</span><div class="oneline-body">${inner.trim()}</div></div>`);

  // **背景**：xxx → 带小标题的段落
  html = html.replace(
    /<p><strong>([^<]{2,4})<\/strong>[：:]\s*([\s\S]*?)<\/p>/g,
    (m, label, inner) => {
      const kind = CALLOUTS[label];
      if (!kind) return m;
      return `<div class="callout callout--${kind}"><span class="callout-l">${label}</span><div class="callout-b">${inner.trim()}</div></div>`;
    }
  );

  // 列表形式的背景/原理
  html = html.replace(
    /<p><strong>([^<]{2,4})<\/strong>[：:]\s*<\/p>\s*(<(?:ul|ol)>[\s\S]*?<\/(?:ul|ol)>)/g,
    (m, label, list) => {
      const kind = CALLOUTS[label];
      if (!kind) return m;
      return `<div class="callout callout--${kind}"><span class="callout-l">${label}</span><div class="callout-b">${list}</div></div>`;
    }
  );

  html = html.replace(/<p><strong>面经<\/strong>[：:]\s*([\s\S]*?)<\/p>/g, (_, inner) => {
    const txt = inner.trim();
    if (!txt || /^暂无/.test(txt)) return '';
    return `<div class="src"><span class="src-tag">面经</span><div class="src-body">${txt}</div></div>`;
  });

  html = html.replace(/<p><strong>面经<\/strong>[：:]\s*<\/p>\s*(<ul>[\s\S]*?<\/ul>)/g,
    (_, ul) => `<div class="src"><span class="src-tag">面经</span><div class="src-body">${ul}</div></div>`);

  return html;
}

function renderSection(item, ci, si) {
  const badge = item.no ? `<span class="q-no">${esc(item.no)}</span>` : '';
  return `<section class="sec" id="${item.id}" data-chapter="${ci}" data-sec="${si}" data-title="${esc(item.title)}">
  <h3 class="sec-h">${badge}<span class="sec-t">${item.star ? '<em>★</em>' : ''}${esc(item.title)}</span><a class="sec-anchor" href="#${item.id}" aria-label="锚点">#</a></h3>
  <div class="sec-body">${renderBody(item.lines.join('\n'))}</div>
</section>`;
}

function renderChapter(ch, ci) {
  const secs = ch.sections.filter((x) => x.title);
  return `<section class="chapter" id="${ch.id}" data-chapter="${ci}">
  <header class="ch-h">
    <div class="ch-line"></div>
    <span class="ch-idx">第 ${String(ci + 1).padStart(2, '0')} 章</span>
    <h2>${esc(ch.title)}</h2>
    <span class="ch-count">${secs.length} 节</span>
  </header>
  ${ch.pre.length ? `<div class="ch-pre">${renderBody(ch.pre.join('\n'))}</div>` : ''}
  ${secs.map((x, si) => renderSection(x, ci, si)).join('\n')}
</section>`;
}

function renderAppendix(chs) {
  if (!chs.length) return '';
  return `<section class="appendix">
  ${chs.map((ch) => `<div class="appx-block" id="${ch.id}">
    <h2 class="appx-h">${esc(ch.title)}</h2>
    ${ch.pre.length ? renderBody(ch.pre.join('\n')) : ''}
    ${ch.sections.filter((x) => x.title).map((x, i) => renderSection(x, 99, i)).join('')}
  </div>`).join('\n')}
</section>`;
}

/* ---------------------------------------------------------------- 统计 */

function statsOf(chapters) {
  const secs = chapters.flatMap((c) => c.sections).filter((x) => x.title);
  const cited = secs.filter((x) => {
    const t = x.lines.join('\n');
    return /\*\*面经\*\*/.test(t) && !/暂无/.test(t);
  }).length;
  return { chapters: chapters.length, sections: secs.length, stars: secs.filter((x) => x.star).length, cited };
}

/* ---------------------------------------------------------------- 模板 */

function shell({ title, body, bodyClass = '', depth = 0 }) {
  const up = '../'.repeat(depth);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(SITE.description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(SITE.description)}">
<meta name="theme-color" content="#F5F0E6">
<link rel="stylesheet" href="${up}assets/style.css">
</head>
<body class="${bodyClass}">
${body}
<script src="${up}assets/site.js" defer></script>
</body>
</html>`;
}

function masthead(depth = 0) {
  const up = '../'.repeat(depth);
  const home = depth === 0 ? './' : up;
  return `<header class="masthead">
  <div class="mast-inner">
    <a href="${home}" class="brand"><h1>${SITE.title}</h1><span class="brand-sub">${SITE.subtitle}</span></a>
    <nav class="mast-nav">
      ${GROUPS.map((g) => `<a href="${home}#g-${encodeURIComponent(g)}">${g}</a>`).join('')}
      <a href="${SITE.repo}" target="_blank" rel="noopener" class="nav-gh">GitHub</a>
    </nav>
  </div>
</header>`;
}

function footer(doneCount, totalSec) {
  return `<footer class="site-foot">
  <div class="foot-inner">
    <div class="foot-col">
      <div class="foot-mark">${SITE.title}</div>
      <p>开源面试笔记。${doneCount} / ${MODULES.length} 篇完稿，共 ${totalSec} 节。</p>
    </div>
    <div class="foot-col">
      <div class="foot-h">写法</div>
      <p>每节讲清背景、原理、细节。<br>公司原题挂在节下。<br>过时的答案标版本分界。</p>
    </div>
    <div class="foot-col">
      <div class="foot-h">来源</div>
      <p>答案以官方文档为准。<br>面经只留公司、轮次、原题、链接。<br>不搬他人答案正文。</p>
    </div>
    <div class="foot-col">
      <div class="foot-h">License</div>
      <p>${SITE.license}<br><a href="${SITE.repo}" target="_blank" rel="noopener">${SITE.repo.replace('https://', '')}</a></p>
    </div>
  </div>
</footer>`;
}

/* ---------------------------------------------------------------- 首页 */

function buildIndex(docs) {
  const done = MODULES.filter((m) => m.status === 'done');
  const totalSec = docs.reduce((a, d) => a + d.stats.sections, 0);
  const totalCite = docs.reduce((a, d) => a + d.stats.cited, 0);

  const rows = GROUPS.map((g) =>
    MODULES.filter((m) => m.group === g)
      .map((m) => {
        const d = docs.find((x) => x.mod.slug === m.slug);
        const s = d?.stats || { chapters: 0, sections: 0, cited: 0 };
        const idx = String(MODULES.indexOf(m) + 1).padStart(2, '0');
        return `<tr data-group="${g}" data-status="${m.status}">
        <td class="c-num">${idx}</td>
        <td class="c-name"><a href="./${m.slug}/"><span class="n">${esc(m.title)}</span><small>${esc(m.counterpart)}</small></a></td>
        <td class="c-sec">${s.chapters || '—'}</td>
        <td class="c-q">${s.sections || '—'}</td>
        <td class="c-cite">${s.cited || '—'}</td>
        <td class="c-status"><span class="st st--${m.status}">${m.status === 'done' ? '完稿' : '大纲'}</span></td>
        <td class="c-go">→</td>
      </tr>`;
      })
      .join('')
  ).join('');

  const body = `${masthead(0)}
<main>
  <section class="lead">
    <div class="lead-main">
      <div class="kicker">本期要目</div>
      <h2>把「面试会问什么」写成<em>能从头读到尾</em>的东西。</h2>
      <p class="drop">市面上讲 Java 的八股文已经足够多，前端、Node、Go 和 PostgreSQL 这一侧却散落在面经帖、博客和口口相传里。这本册子按模块收拢：每一篇是一章，章下按节编号，每一节都先把背景交代清楚，再讲原理，最后落到细节和坑。</p>
      <p>不写「一句话糊弄完就追问」的速查卡。要能看懂，也要能背下来。公司原题挂在节下，只留<strong>公司、轮次、原题一句、链接</strong>；关键结论标注官方文档出处。</p>
      <p>网上大量答案已经过时。<strong>Go 1.24 的 map 不再是分桶加溢出桶，TypeScript 7 的编译器已经是 Go 写的原生端口</strong>——这类版本分界在正文里逐条标出。</p>
    </div>
    <aside class="lead-side">
      <div class="side-h">每节的写法</div>
      <ol class="rules">
        <li><b>背景</b>这个问题从哪来，不解决会怎样</li>
        <li><b>原理</b>机制怎么转，关键数据结构长什么样</li>
        <li><b>细节</b>版本差异、边界情况、常见踩坑</li>
      </ol>
      <div class="side-stats">
        <div><b>${MODULES.length}</b><span>篇</span></div>
        <div><b>${done.length}</b><span>完稿</span></div>
        <div><b>${totalSec}</b><span>节</span></div>
        <div><b>${totalCite}</b><span>带原题</span></div>
      </div>
    </aside>
  </section>

  <section class="catalog">
    <div class="sec-head"><h2>目录</h2><div class="fill"></div><span class="cnt">${MODULES.length} 篇 / ${done.length} 篇完稿</span></div>
    <div class="filters" role="group" aria-label="筛选">
      <button class="on" data-filter="all">全部 ${MODULES.length}</button>
      ${GROUPS.map((g) => `<button data-filter="${g}">${g} ${MODULES.filter((m) => m.group === g).length}</button>`).join('')}
      <button data-filter="done">已完稿 ${done.length}</button>
    </div>
    <table class="tbl">
      <thead><tr><th class="c-num">#</th><th>模块</th><th class="c-sec">章</th><th class="c-q">节</th><th class="c-cite">带原题</th><th class="c-status">状态</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>

  <section class="cta">
    <div class="cta-inner">
      <div>
        <h3>发现错误，或者有更好的讲法？</h3>
        <p>内容以官方文档为准。面经只作线索，不搬他人答案正文。提交 PR 时请附上出处。</p>
      </div>
      <a class="cta-btn" href="${SITE.repo}" target="_blank" rel="noopener">在 GitHub 上查看 →</a>
    </div>
  </section>
</main>
${footer(done.length, totalSec)}`;

  return shell({ title: `${SITE.title} · ${SITE.subtitle}`, body, bodyClass: 'page-home', depth: 0 });
}

/* ---------------------------------------------------------------- 模块页 */

function buildModule(doc, pos) {
  const { mod, chapters, stats } = doc;
  const prev = MODULES[pos - 1];
  const next = MODULES[pos + 1];

  const sideNav = GROUPS.map(
    (g) => `<div class="side-group">${g}</div>
    ${MODULES.filter((m) => m.group === g)
      .map(
        (m) => `<a href="../${m.slug}/" class="side-link${m.slug === mod.slug ? ' on' : ''}">
        <span>${esc(m.title)}</span>${m.status === 'done' ? '<i class="dot dot--done"></i>' : '<i class="dot"></i>'}
      </a>`
      )
      .join('')}`
  ).join('');

  // 右侧：当前所在章 + 全部小节，滚动联动
  const rail = chapters
    .map((c, i) => {
      const secs = c.sections.filter((x) => x.title);
      return `<div class="rail-ch" data-chapter="${i}">
      <a class="rail-ch-t" href="#${c.id}"><i>${String(i + 1).padStart(2, '0')}</i>${esc(c.title)}</a>
      <ol class="rail-secs">
        ${secs.map((s, si) => `<li><a href="#${s.id}" data-chapter="${i}" data-sec="${si}">${s.no ? `<i>${esc(s.no)}</i>` : ''}${esc(s.title)}</a></li>`).join('')}
      </ol>
    </div>`;
    })
    .join('');

  const body = `${masthead(1)}
<div class="doc-shell">
  <aside class="doc-side"><div class="doc-side-inner">${sideNav}</div></aside>

  <main class="doc-main">
    <div class="mobile-bar">
      <button class="mb-toggle" id="mb-toggle" aria-expanded="false" aria-controls="mb-panel">
        <span class="mb-cur" id="mb-cur">目录</span>
        <span class="mb-ico">☰</span>
      </button>
      <div class="mb-panel" id="mb-panel">
        <div class="mb-panel-in">
          ${chapters.map((c, i) => `<div class="mb-ch">
            <a class="mb-ch-t" href="#${c.id}"><i>${String(i + 1).padStart(2, '0')}</i>${esc(c.title)}</a>
            <ol class="mb-secs">${c.sections.filter((x) => x.title).map((s2) => `<li><a href="#${s2.id}">${s2.no ? `<i>${esc(s2.no)}</i>` : ''}${esc(s2.title)}</a></li>`).join('')}</ol>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="doc-crumb">
      <a href="../">${SITE.title}</a><span>/</span><span>${mod.group}</span><span>/</span><b>${esc(mod.title)}</b>
      <span class="crumb-status st st--${mod.status}">${mod.status === 'done' ? '完稿' : '大纲'}</span>
    </div>

    <header class="doc-head">
      <div class="doc-no">${String(pos + 1).padStart(2, '0')}</div>
      <h1>${esc(mod.title)}</h1>
      <p class="doc-sub">对标 ${esc(mod.counterpart)}</p>
      <div class="doc-meta">
        <span>${stats.chapters} 章</span>
        <span>${stats.sections} 节</span>
        <span>${stats.stars} 节高频</span>
        <span>${stats.cited} 节带原题</span>
      </div>
      ${mod.status === 'outline' ? '<div class="doc-warn">这一篇目前是题目大纲：章节已经列全，部分小节的内容待补。</div>' : ''}
    </header>

    <article class="doc-body">
      ${chapters.map((c, i) => renderChapter(c, i)).join('\n')}
      ${renderAppendix(doc.appendix || [])}
    </article>

    <nav class="doc-pager">
      ${prev ? `<a class="pager prev" href="../${prev.slug}/"><span>上一篇</span><b>${esc(prev.title)}</b></a>` : '<span></span>'}
      ${next ? `<a class="pager next" href="../${next.slug}/"><span>下一篇</span><b>${esc(next.title)}</b></a>` : '<span></span>'}
    </nav>
  </main>

  <aside class="doc-rail">
    <div class="rail-sticky">
      <div class="rail-now">
        <div class="rail-now-k">正在阅读</div>
        <div class="rail-now-ch" id="rail-now-ch">${esc(chapters[0]?.title || '')}</div>
        <div class="rail-now-sec" id="rail-now-sec"></div>
      </div>
      <div class="rail-progress"><span id="rail-bar"></span></div>
      <div class="rail-list">${rail}</div>
    </div>
  </aside>
</div>
${footer(MODULES.filter((m) => m.status === 'done').length, 0)}`;

  return shell({ title: `${mod.title} · ${SITE.title}`, body, bodyClass: 'page-doc', depth: 1 });
}

/* ---------------------------------------------------------------- 主流程 */

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });

  const docs = [];
  for (const mod of MODULES) {
    const file = path.join(CONTENT, `${mod.slug}.md`);
    if (!fs.existsSync(file)) {
      if (CHECK) console.warn(`缺少 content/${mod.slug}.md`);
      continue;
    }
    const parsed = parseDoc(fs.readFileSync(file, 'utf8'));
    docs.push({ mod, ...parsed, stats: statsOf(parsed.chapters) });
  }

  fs.writeFileSync(path.join(DIST, 'assets', 'style.css'), fs.readFileSync(path.join(ROOT, 'assets', 'style.css')));
  fs.copyFileSync(path.join(ROOT, 'assets', 'site.js'), path.join(DIST, 'assets', 'site.js'));
  fs.writeFileSync(path.join(DIST, 'index.html'), buildIndex(docs));

  docs.forEach((doc) => {
    const dir = path.join(DIST, doc.mod.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), buildModule(doc, MODULES.indexOf(doc.mod)));
  });

  fs.writeFileSync(
    path.join(DIST, '404.html'),
    shell({
      title: `404 · ${SITE.title}`,
      depth: 0,
      body: `${masthead(0)}<main class="notfound"><h1>404</h1><p>这一页不存在，或者还没写。</p><a href="./">回目录</a></main>`,
    })
  );
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

  console.log(`✓ 生成 ${docs.length} 篇 → dist/`);
  if (CHECK) {
    for (const d of docs) {
      console.log(`  ${d.mod.slug.padEnd(16)}${String(d.stats.chapters).padStart(4)} 章 ${String(d.stats.sections).padStart(4)} 节  ${String(d.stats.cited).padStart(3)} 带原题`);
    }
  }
}

main();
