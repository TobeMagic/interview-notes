#!/usr/bin/env node
/**
 * 八股志生成器（认知记忆版）。
 *
 * 源文件分层：
 *   # 篇名
 *   ## 大章
 *   ### 1.🌟小节标题
 *
 * 认知四步标记（按行分段）：
 *   **记忆锚点**：／**一句话**：  → 顶部记忆钩子卡 (.oneline)
 *   **痛点与直觉**：／**背景**：  → 痛点推导与生活类比 (.callout--bg)
 *   **核心机制**：／**三点组块**： → 视觉图解 + 3±1 组块 (.callout--why)
 *   **考场口述**：               → 30s 第一人称口述串词 (.recite-box)
 *   **面经**：                   → 真实公司原题出处 (.src)
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
  痛点与直觉: 'bg',
  背景: 'bg',
  视觉图解: 'diagram',
  核心机制: 'why',
  三点核心组块: 'why',
  三点组块: 'why',
  核心组块: 'why',
  原理: 'why',
  细节: 'detail',
  展开: 'detail',
  注意: 'warn',
  结论: 'concl',
  对比: 'detail',
  做法: 'detail',
};

const PHASE_RE =
  /^\*\*(记忆锚点|一句话|痛点与直觉|背景|视觉图解|核心机制|三点核心组块|三点组块|核心组块|原理|细节|展开|注意|结论|对比|做法|考场口述|30\s*秒口述|面经)\*\*[：:]\s*(.*)$/;

function renderSegment(seg) {
  const md = seg.lines.join('\n').trim();
  if (!seg.label) {
    return md ? marked.parse(md) : '';
  }

  if (seg.label === '记忆锚点' || seg.label === '一句话') {
    const tag = seg.label === '记忆锚点' ? '记忆锚点' : '一句话';
    return `<div class="oneline"><span class="oneline-tag">${tag}</span><div class="oneline-body">${marked.parse(md)}</div></div>`;
  }

  if (seg.label === '考场口述' || /口述/.test(seg.label)) {
    return `<div class="recite-box"><div class="recite-head"><span class="recite-badge">30s 考场口述</span><span class="recite-tip">先定性 · 拆三点 · 亮底牌</span></div><div class="recite-body">${marked.parse(md)}</div></div>`;
  }

  if (seg.label === '面经') {
    if (!md || /^暂无/.test(md)) return '';
    return `<div class="src"><span class="src-tag">面经</span><div class="src-body">${marked.parse(md)}</div></div>`;
  }

  const kind = CALLOUTS[seg.label] || 'detail';
  return `<div class="callout callout--${kind}"><span class="callout-l">${esc(seg.label)}</span><div class="callout-b">${marked.parse(md)}</div></div>`;
}

function renderBody(md) {
  const lines = (md || '').split('\n');
  const segments = [];
  let cur = { label: null, lines: [] };
  let inFence = false;

  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence) {
      const m = line.match(PHASE_RE);
      if (m) {
        if (cur.label || cur.lines.join('').trim()) segments.push(cur);
        cur = { label: m[1].replace(/\s+/g, ' '), lines: [] };
        if (m[2] && m[2].trim()) cur.lines.push(m[2].trim());
        continue;
      }
    }
    cur.lines.push(line);
  }
  if (cur.label || cur.lines.join('').trim()) segments.push(cur);

  return segments.map(renderSegment).join('\n');
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
      <div class="foot-h">记忆四步法</div>
      <p>记忆锚点 · 痛点与直觉 · 视觉图解与三点组块 · 30s 考场口述。</p>
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
      <div class="kicker">本期要目 · 认知记忆版</div>
      <h2>把「面试会问什么」写成<em>顺着直觉看懂、上场张口能背</em>的东西。</h2>
      <p class="drop">市面上讲 Java 的八股文已经足够多，前端、Node、Go 和 PostgreSQL 这一侧却散落在面经帖、博客和口口相传里。这本册子按认知心理学的记忆规律编排：每一节先给一句带画面感的记忆锚点，再从痛点与生活类比切入，配一张空间结构图和 3 个核心组块，最后落到 30 秒第一人称考场口述串词。</p>
      <p>看懂靠「痛点推导 + 空间图解」，背诵靠「三点组块 + 考场口述」。公司原题挂在节下，只留<strong>公司、轮次、原题一句、链接</strong>；关键结论标注官方文档出处。</p>
      <p>网上大量答案已经过时。<strong>Go 1.24 的 map 不再是分桶加溢出桶，TypeScript 7 的编译器已经是 Go 写的原生端口</strong>——这类版本分界在正文里逐条标出。</p>
    </div>
    <aside class="lead-side">
      <div class="side-h">大脑记忆四步法</div>
      <ol class="rules">
        <li><b>锚点</b>6–12 字画面口诀，一秒唤醒整题骨架</li>
        <li><b>痛点</b>不这么设计会死在哪，挂钩生活直觉</li>
        <li><b>组块</b>空间结构图 + 3 个核心记忆点，不超载</li>
        <li><b>口述</b>30 秒第一人称考场串词，先定性再拆解</li>
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
      <a class="rail-ch-t" href="#${c.id}"><i>${String(i + 1).padStart(2, '0')}</i><span class="rail-ct">${esc(c.title)}</span><span class="rail-n">${secs.length}</span></a>
      <ol class="rail-secs">
        ${secs.map((s, si) => `<li><a href="#${s.id}" data-chapter="${i}" data-sec="${si}">${s.no ? `<i>${esc(s.no)}</i>` : ''}${s.star ? '<em class="rail-star">★</em>' : ''}<span>${esc(s.title)}</span></a></li>`).join('')}
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
            <ol class="mb-secs">${c.sections.filter((x) => x.title).map((s2) => `<li><a href="#${s2.id}">${s2.no ? `<i>${esc(s2.no)}</i>` : ''}${s2.star ? '<em class="rail-star">★</em>' : ''}${esc(s2.title)}</a></li>`).join('')}</ol>
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
