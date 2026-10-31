/* 八股志 · 阅读交互 */
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

  /* ---------- 右侧跟随轨 ---------- */
  var secs = Array.prototype.slice.call(document.querySelectorAll('.sec[data-chapter]'));
  var railLinks = Array.prototype.slice.call(document.querySelectorAll('.rail-secs a'));
  var railChapters = Array.prototype.slice.call(document.querySelectorAll('.rail-ch'));
  var nowCh = document.getElementById('rail-now-ch');
  var nowSec = document.getElementById('rail-now-sec');
  var bar = document.getElementById('rail-bar');

  function activate(secEl) {
    if (!secEl) return;
    var ci = secEl.getAttribute('data-chapter');
    var si = secEl.getAttribute('data-sec');

    railChapters.forEach(function (el) {
      el.classList.toggle('on', el.getAttribute('data-chapter') === ci);
    });
    railLinks.forEach(function (a) {
      var on = a.getAttribute('data-chapter') === ci && a.getAttribute('data-sec') === si;
      a.classList.toggle('on', on);
    });

    if (nowCh) {
      var chEl = document.querySelector('.chapter[data-chapter="' + ci + '"]');
      var h = chEl && chEl.querySelector('.ch-h h2');
      nowCh.textContent = h ? h.textContent : '';
    }
    if (nowSec) nowSec.textContent = secEl.getAttribute('data-title') || '';
  }

  var current = null;
  if ('IntersectionObserver' in window && secs.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          if (en.target === current) return;
          current = en.target;
          activate(current);
        });
      },
      { rootMargin: '-88px 0px -70% 0px', threshold: 0 }
    );
    secs.forEach(function (s) {
      io.observe(s);
    });
    activate(secs[0]);
  }

  /* ---------- 移动端目录 ---------- */
  var mbToggle = document.getElementById('mb-toggle');
  var mbPanel = document.getElementById('mb-panel');
  var mbCur = document.getElementById('mb-cur');
  if (mbToggle && mbPanel) {
    mbToggle.addEventListener('click', function () {
      var open = mbPanel.classList.toggle('open');
      mbToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mbPanel.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        mbPanel.classList.remove('open');
        mbToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
  if (mbCur) {
    var syncCur = function () {
      if (nowCh && nowCh.textContent) mbCur.textContent = nowCh.textContent;
    };
    var _act = activate;
    activate = function (el) { _act(el); syncCur(); };
  }

  /* ---------- 阅读进度 ---------- */
  var article = document.querySelector('.doc-body');
  if (bar && article) {
    var onScroll = function () {
      var rect = article.getBoundingClientRect();
      var total = rect.height - window.innerHeight * 0.6;
      var done = -rect.top;
      var p = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
      bar.style.width = (p * 100).toFixed(1) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  /* ---------- 外部链接新窗口 ---------- */
  document.querySelectorAll('.doc-body a[href^="http"], .sec-body a[href^="http"]').forEach(function (a) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  /* ---------- 键盘翻篇 ---------- */
  var prev = document.querySelector('.pager.prev');
  var next = document.querySelector('.pager.next');
  document.addEventListener('keydown', function (e) {
    if (e.target.matches('input, textarea, select')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft' && prev) window.location.href = prev.href;
    if (e.key === 'ArrowRight' && next) window.location.href = next.href;
  });
})();
