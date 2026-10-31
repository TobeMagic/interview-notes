/* 八股志 · 交互：目录筛选、阅读进度、键盘快捷键 */
(function () {
  'use strict';

  /* ---------- 首页筛选 ---------- */
  var filterBar = document.querySelector('.filters');
  if (filterBar) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('.tbl tbody tr'));
    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      var f = btn.getAttribute('data-filter');
      filterBar.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b === btn);
      });
      rows.forEach(function (tr) {
        var show =
          f === 'all' ||
          tr.getAttribute('data-group') === f ||
          (f === 'done' && tr.getAttribute('data-status') === 'done');
        tr.hidden = !show;
      });
    });
  }

  /* ---------- 正文目录高亮 ---------- */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc-a'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) {
      var id = decodeURIComponent(a.getAttribute('href').slice(1));
      var el = document.getElementById(id);
      if (el) map[id] = a;
    });
    var current = null;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var a = map[en.target.id];
          if (!a || a === current) return;
          if (current) current.classList.remove('on');
          a.classList.add('on');
          current = a;
        });
      },
      { rootMargin: '-10% 0px -75% 0px', threshold: 0 }
    );
    Object.keys(map).forEach(function (id) {
      io.observe(document.getElementById(id));
    });
  }

  /* ---------- 外部链接新窗口 ---------- */
  document.querySelectorAll('.doc-body a[href^="http"]').forEach(function (a) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  /* ---------- 键盘：← → 翻篇 ---------- */
  var prev = document.querySelector('.pager.prev');
  var next = document.querySelector('.pager.next');
  document.addEventListener('keydown', function (e) {
    if (e.target.matches('input, textarea, select')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft' && prev) window.location.href = prev.href;
    if (e.key === 'ArrowRight' && next) window.location.href = next.href;
  });
})();
