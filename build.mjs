#!/usr/bin/env node
/**
 * 八股志生成器。
 *
 * 源文件分层（对齐参考站）：
 *   # 篇名
 *   ## 大章            → 侧边目录一级
 *   ### 1.🌟题目？     → 题目卡片，带编号徽章
 *   #### 追问？        → 题内的下一层追问
 *
 * 标记：
 *   **一句话**：核心答案      → 高亮导语块
 *   **面经**：公司/轮次/链接   → 带标签的引用条
 *   **展开**：               → 普通小标题
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

/** 「### 12.🌟什么是 X？」→ { no: '12', star: true, title: '什么是 X？' } */
function parseQuestionHeading(raw) {
  let text = raw.trim();
  const star = /🌟/.test(text);
  text = text.replace(/🌟/g, '').trim();
  const m = text.match(/^(\d+)\s*[.、．]\s*(.*)$/);
  if (m) return { no: m[1], star, title: m[2].trim() };
  return { no: null, star, title: text };
}

/* ---------------------------------------------------------------- 解析 */

/**
 * 把 markdown 拆成：
 *   { intro, chapters: [{ title, id, questions: [{ no, star, title, id, body }] }] }
 */
function parseDoc(raw) {
  const lines = raw.split('\n');
  const chapters = [];
  let intro = [];
  let cur = null;      // 当前大章
  let q = null;        // 当前题目
  let fence = false;

  const pushQuestion = () => {
    if (q && cur) cur.questions.push(q);
    q = null;
  };
  const pushChapter = () => {
    pushQuestion();
    if (cur) chapters.push(cur);
    cur = null;
  };

  for (const line of lines) {
    if (/^```/.test(line)) fence = !fence;

    if (!fence && /^#\s+/.test(line)) continue; // 篇名由模板渲染

    if (!fence && /^##\s+/.test(line)) {
      pushChapter();
      const title = line.replace(/^##\s+/, '').trim().replace(/🌟/g, '');
      cur = { title, id: 'c-' + slugify(title), questions: [] };
      continue;
    }

    if (!fence && /^###\s+/.test(line)) {
      pushQuestion();
      if (!cur) {
        cur = { title: '正文', id: 'c-zhengwen', questions: [] };
      }
      const { no, star, title } = parseQuestionHeading(line.replace(/^###\s+/, ''));
      q = { no, star, title, id: 'q-' + slugify((no ? no + '-' : '') + title), lines: [] };
      continue;
    }

    // 归属
    if (q) q.lines.push(line);
    else if (cur) cur.questions.push({ no: null, star: false, title: '', id: '', lines: [line], isPreamble: true });
    else intro.push(line);
  }
  pushChapter();

  // 清掉大章里没有题号的前导内容（例如说明段），合并进章前言
  for (const c of chapters) {
    const pre = c.questions.filter((x) => x.isPreamble);
    c.preamble = pre.map((p) => p.lines.join('\n')).join('\n').trim();
    c.questions = c.questions.filter((x) => !x.isPreamble);
  }

  const APPENDIX_RE = /面经汇总|这一篇没写|这一章没写|^依据$/;
  const kept = chapters.filter((c) => c.title);
  const appendix = kept.filter((c) => APPENDIX_RE.test(c.title));
  const body = kept.filter((c) => !APPENDIX_RE.test(c.title));
  return { intro: intro.join('\n').trim(), chapters: body, appendix };
}

/* ---------------------------------------------------------------- 渲染 */

/** 题内正文：处理一句话 / 面经，并给 #### 加样式 */
function renderBody(md) {
  let html = marked.parse(md || '');

  html = html.replace(/<p><strong>一句话<\/strong>[：:]\s*([\s\S]*?)<\/p>/g,
    (_, inner) => `<div class="oneline"><span class="oneline-tag">一句话</span>${inner.trim()}</div>`);

  html = html.replace(/<p><strong>面经<\/strong>[：:]\s*([\s\S]*?)<\/p>/g, (_, inner) => {
    const txt = inner.trim();
    if (!txt || /^暂无/.test(txt)) {
      return `<div class="src src--none"><span class="src-tag">面经</span><div class="src-body">${txt || '暂无已核对的公开原题。'}</div></div>`;
    }
    return `<div class="src"><span class="src-tag">面经</span><div class="src-body">${txt}</div></div>`;
  });

  // 面经列表形式：**面经**：\n\n- ...
  html = html.replace(/<p><strong>面经<\/strong>[：:]\s*<\/p>\s*(<ul>[\s\S]*?<\/ul>)/g,
    (_, ul) => `<div class="src"><span class="src-tag">面经</span><div class="src-body">${ul}</div></div>`);

  html = html.replace(/<p><strong>展开<\/strong>[：:]?\s*<\/p>/g, '<div class="sub-h">展开</div>');

  return html;
}

function renderQuestion(item, idx) {
  const badge = item.no ? `<span class="q-no">${esc(item.no)}</span>` : '';
  const star = item.star ? '<span class="q-star" title="高频">★</span>' : '';
  return `<article class="q" id="${item.id}">
  <h3 class="q-h">${badge}<span class="q-t">${star}${esc(item.title)}</span><a class="q-anchor" href="#${item.id}" aria-label="锚点">#</a></h3>
  <div class="q-body">${renderBody(item.lines.join('\n'))}</div>
</article>`;
}

function renderAppendix(chs) {
  if (!chs.length) return '';
  return `<section class="appendix">
  ${chs
    .map(
      (ch) => `<div class="appx-block" id="${ch.id}">
    <h2 class="appx-h">${esc(ch.title)}</h2>
    ${(ch.preamble ? renderBody(ch.preamble) : '') +
      ch.questions
        .filter((x) => x.title)
        .map((x) => renderQuestion(x))
        .join('')}
  </div>`
    )
    .join('\n')}
</section>`;
}

function renderChapter(ch, ci) {
  const qs = ch.questions.filter((x) => x.title);
  const pre = ch.preamble ? renderBody(ch.preamble) : '';
  return `<section class="chapter" id="${ch.id}">
  <header class="ch-h">
    <span class="ch-idx">${String(ci + 1).padStart(2, '0')}</span>
    <h2>${esc(ch.title)}</h2>
    <span class="ch-count">${qs.length} 题</span>
  </header>
  ${pre}
  ${qs.map((x) => renderQuestion(x)).join('\n')}
</section>`;
}

/* ---------------------------------------------------------------- 统计 */

function statsOf(chapters) {
  const all = chapters.flatMap((c) => c.questions).filter((x) => x.title);
  const stars = all.filter((x) => x.star).length;
  const cited = chapters
    .flatMap((c) => c.questions)
    .filter((x) => /\*\*面经\*\*/.test(x.lines.join('\n')) && !/暂无/.test(x.lines.join('\n'))).length;
  return { chapters: chapters.length, questions: all.length, stars, cited };
}

/* ---------------------------------------------------------------- 模板 */

function shell({ title, body, bodyClass = '', depth = 0 }) {
  const up = '../'.repeat(depth);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(SITE.description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(SITE.description)}">
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
    <div class="mast-title">
      <a href="${home}" class="brand"><h1>${SITE.title}</h1><span class="brand-sub">${SITE.subtitle}</span></a>
      <nav class="mast-nav">
        ${GROUPS.map((g) => `<a href="${home}#g-${encodeURIComponent(g)}">${g}</a>`).join('')}
        <a href="${SITE.repo}" target="_blank" rel="noopener" class="nav-gh">GitHub ↗</a>
      </nav>
    </div>
  </div>
</header>`;
}

function footer(doneCount, totalQ) {
  return `<footer class="site-foot">
  <div class="foot-inner">
    <div class="foot-col">
      <div class="foot-mark">${SITE.title}</div>
      <p>开源面试笔记。${doneCount} / ${MODULES.length} 篇完稿，共 ${totalQ} 题。</p>
    </div>
    <div class="foot-col">
      <div class="foot-h">规矩</div>
      <p>同一场面试连着追问的，合成一题写完。<br>换了机制才另开一题。<br>过时的答案标版本分界。</p>
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
  const totalQ = docs.reduce((a, d) => a + d.stats.questions, 0);
  const totalCite = docs.reduce((a, d) => a + d.stats.cited, 0);

  const rows = GROUPS.map((g) =>
    MODULES.filter((m) => m.group === g)
      .map((m) => {
        const d = docs.find((x) => x.mod.slug === m.slug);
        const s = d?.stats || { chapters: 0, questions: 0, cited: 0 };
        const idx = String(MODULES.indexOf(m) + 1).padStart(2, '0');
        return `<tr data-group="${g}" data-status="${m.status}">
        <td class="c-num">${idx}</td>
        <td class="c-name"><a href="./${m.slug}/"><span class="n">${esc(m.title)}</span><small>${esc(m.counterpart)}</small></a></td>
        <td class="c-sec">${s.chapters || '—'}</td>
        <td class="c-q">${s.questions || '—'}</td>
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
      <h2>把「面试会问什么」写成<em>可以照着背、也可以照着查</em>的东西。</h2>
      <p class="drop">市面上讲 Java 的八股文已经足够多，前端、Node、Go 和 PostgreSQL 这一侧却散落在面经帖、博客和口口相传里。这本册子按模块收拢，每一篇是一章，章下按题目编号，每题先给一句能直接说出口的答案，再展开，再列会被追问什么。</p>
      <p>公司原题挂在题下，只留<strong>公司、轮次、原题一句、链接</strong>。不搬别人的答案，关键结论标注官方文档出处。</p>
      <p>网上大量答案已经过时。<strong>Go 1.24 的 map 不再是分桶加溢出桶，TypeScript 7 的编译器已经是 Go 写的原生端口</strong>——这类版本分界在正文里逐条标出。</p>
    </div>
    <aside class="lead-side">
      <div class="side-h">这册子的三条规矩</div>
      <ol class="rules">
        <li><b>合并</b>同一场面试会连着追问的，合成一题写完</li>
        <li><b>拆分</b>换了机制才另开一题，不硬把 Java 题翻过来</li>
        <li><b>时效</b>过时的答案标出版本分界，不装作没变</li>
      </ol>
      <div class="side-stats">
        <div><b>${MODULES.length}</b><span>篇</span></div>
        <div><b>${done.length}</b><span>完稿</span></div>
        <div><b>${totalQ}</b><span>题</span></div>
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
      <thead><tr><th class="c-num">#</th><th>模块</th><th class="c-sec">章</th><th class="c-q">题</th><th class="c-cite">带原题</th><th class="c-status">状态</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>

  <section class="cta">
    <div class="cta-inner">
      <div>
        <h3>发现错误，或者有更好的答法？</h3>
        <p>内容以官方文档为准。面经只作线索，不搬他人答案正文。提交 PR 时请附上出处。</p>
      </div>
      <a class="cta-btn" href="${SITE.repo}" target="_blank" rel="noopener">在 GitHub 上查看 ↗</a>
    </div>
  </section>
</main>
${footer(done.length, totalQ)}`;

  return shell({ title: `${SITE.title} · ${SITE.subtitle}`, body, bodyClass: 'page-home', depth: 0 });
}

/* ---------------------------------------------------------------- 模块页 */

function buildModule(doc, pos) {
  const { mod, chapters, stats } = doc;
  const prev = MODULES[pos - 1];
  const next = MODULES[pos + 1];

  // 左侧：全册模块
  const side = GROUPS.map(
    (g) => `<div class="side-group">${g}</div>
    ${MODULES.filter((m) => m.group === g)
      .map(
        (m) => `<a href="../${m.slug}/" class="side-link${m.slug === mod.slug ? ' on' : ''}">
        <span>${esc(m.title)}</span>${m.status === 'done' ? '<i class="dot dot--done"></i>' : '<i class="dot"></i>'}
      </a>`
      )
      .join('')}`
  ).join('');

  // 页内目录：章 + 题，可折叠
  const toc = `<nav class="toc" aria-label="本章目录">
    <div class="toc-head"><span>本章目录</span><span class="toc-total">${stats.chapters} 章 · ${stats.questions} 题</span></div>
    ${chapters
      .map((c, i) => {
        const qs = c.questions.filter((x) => x.title);
        return `<details class="toc-ch"${i < 2 ? ' open' : ''}>
        <summary><span class="toc-idx">${String(i + 1).padStart(2, '0')}</span><span class="toc-name">${esc(c.title)}</span><span class="toc-n">${qs.length}</span></summary>
        <ol class="toc-qs">
          ${qs.map((q) => `<li><a href="#${q.id}">${q.no ? `<i>${esc(q.no)}</i>` : ''}${q.star ? '<em>★</em>' : ''}${esc(q.title)}</a></li>`).join('')}
        </ol>
      </details>`;
      })
      .join('')}
  </nav>`;

  const body = `${masthead(1)}
<div class="doc-shell">
  <aside class="doc-side"><div class="doc-side-inner">${side}</div></aside>

  <main class="doc-main">
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
        <span>${stats.questions} 题</span>
        <span>${stats.stars} 道高频</span>
        <span>${stats.cited} 题带原题</span>
      </div>
      ${mod.status === 'outline'
        ? '<div class="doc-warn">这一篇目前是题目大纲：章节和题目已经列全，部分题目的口述答案待补。</div>'
        : ''}
    </header>

    ${toc}

    <article class="doc-body">
      ${chapters.map((c, i) => renderChapter(c, i)).join('\n')}
      ${renderAppendix(doc.appendix || [])}
    </article>

    <nav class="doc-pager">
      ${prev ? `<a class="pager prev" href="../${prev.slug}/"><span>上一篇</span><b>${esc(prev.title)}</b></a>` : '<span></span>'}
      ${next ? `<a class="pager next" href="../${next.slug}/"><span>下一篇</span><b>${esc(next.title)}</b></a>` : '<span></span>'}
    </nav>
  </main>
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
      if (CHECK) console.warn(`⚠️  缺少 content/${mod.slug}.md`);
      continue;
    }
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = parseDoc(raw);
    docs.push({ mod, ...parsed, stats: statsOf(parsed.chapters) });
  }

  fs.writeFileSync(path.join(DIST, 'assets', 'style.css'), fs.readFileSync(path.join(ROOT, 'assets', 'style.css')));
  fs.copyFileSync(path.join(ROOT, 'assets', 'site.js'), path.join(DIST, 'assets', 'site.js'));

  fs.writeFileSync(path.join(DIST, 'index.html'), buildIndex(docs));

  docs.forEach((doc, i) => {
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
    console.log(`  ${'篇'.padEnd(14)} ${'章'.padStart(4)} ${'题'.padStart(5)} ${'★'.padStart(4)} ${'原题'.padStart(6)}`);
    for (const d of docs) {
      console.log(
        `  ${d.mod.slug.padEnd(16)}${String(d.stats.chapters).padStart(4)} ${String(d.stats.questions).padStart(5)} ${String(d.stats.stars).padStart(5)} ${String(d.stats.cited).padStart(6)}`
      );
    }
  }
}

main();
