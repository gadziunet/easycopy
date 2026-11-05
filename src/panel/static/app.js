// EasyCopy – panel: live progress and small form behaviours. Texts come translated from the API.
(function () {
  'use strict';

  var POLL_MS = 2000;

  function setText(root, field, text) {
    var el = root.querySelector('[data-field="' + field + '"]');
    if (el && el.textContent !== String(text)) el.textContent = text;
  }

  function setProgress(root, value) {
    var el = root.querySelector('progress[data-field="progress"]');
    if (el) el.value = value;
  }

  function getJson(url) {
    return fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) { location.href = '/logowanie'; throw new Error('401'); }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  // ---------- potwierdzenia ----------
  document.addEventListener('submit', function (ev) {
    var msg = ev.target.getAttribute && ev.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) ev.preventDefault();
  });

  // ---------- formularz: User-Agent ----------
  function initUaForm() {
    var browser = document.querySelector('[data-ua-browser]');
    if (!browser) return;
    var os = document.querySelector('[data-ua-os]');
    var custom = document.querySelector('[data-ua-custom]');
    function update() {
      var v = browser.value;
      custom.hidden = v !== 'custom';
      os.disabled = v === 'easycopy' || v === 'custom';
    }
    browser.addEventListener('change', update);
    update();
  }

  // ---------- formularz: harmonogram ----------
  function initRepeat() {
    var repeat = document.querySelector('[data-repeat]');
    if (!repeat) return;
    var parts = document.querySelectorAll('[data-repeat-show]');
    function update() {
      Array.prototype.forEach.call(parts, function (el) {
        el.hidden = el.getAttribute('data-repeat-show').split(' ').indexOf(repeat.value) === -1;
      });
    }
    repeat.addEventListener('change', update);
    update();
  }

  // ---------- dziennik: filtr ----------
  function initLogFilter() {
    var sel = document.querySelector('[data-log-filter]');
    var box = document.querySelector('.log');
    if (!sel || !box) return;
    var key = 'easycopy-log-filter';
    try { if (localStorage.getItem(key)) sel.value = localStorage.getItem(key); } catch (e) { /* bez pamięci */ }
    function update() {
      box.classList.toggle('only-problems', sel.value === 'problems');
      try { localStorage.setItem(key, sel.value); } catch (e) { /* bez pamięci */ }
    }
    sel.addEventListener('change', update);
    update();
  }

  // ---------- strona główna: W toku ----------
  function initActive() {
    var section = document.querySelector('[data-poll="active"]');
    if (!section) return;
    var known = Array.prototype.map.call(section.querySelectorAll('[data-job]'), function (el) { return el.getAttribute('data-job'); });
    function tick() {
      getJson('/api/aktywne').then(function (jobs) {
        var ids = jobs.map(function (j) { return String(j.id); });
        // zadanie się skończyło albo pojawiło nowe – przeładuj, żeby odświeżyć listę archiwów
        var changed = ids.length !== known.length || ids.some(function (id) { return known.indexOf(id) === -1; });
        if (changed) { location.reload(); return; }
        jobs.forEach(function (j) {
          var row = section.querySelector('[data-job="' + j.id + '"]');
          if (!row) return;
          setProgress(row, j.progress);
          if (j.status === 'running') {
            setText(row, 'detail', j.detailText);
          }
        });
        setTimeout(tick, POLL_MS);
      }).catch(function () { setTimeout(tick, POLL_MS * 3); });
    }
    if (known.length) setTimeout(tick, POLL_MS);
  }

  // ---------- szczegóły zadania ----------
  function initJob() {
    var root = document.querySelector('[data-job-id]');
    if (!root) return;
    var id = root.getAttribute('data-job-id');
    var status = root.getAttribute('data-job-status');
    var after = Number(root.getAttribute('data-log-after') || 0);
    if (status !== 'queued' && status !== 'running') return;
    var logBox = root.querySelector('[data-field="log"]');

    function appendLog(entries) {
      if (!entries.length) return;
      var empty = logBox.querySelector('.log-empty');
      if (empty) empty.remove();
      var stick = logBox.scrollTop + logBox.clientHeight >= logBox.scrollHeight - 20;
      entries.forEach(function (l) {
        var row = document.createElement('div');
        row.className = 'log-row k-' + (l.kind || 'info') + (l.problem ? ' problem' : '');
        var t = document.createElement('span');
        t.className = 'sub';
        t.textContent = l.timeText;
        var lab = document.createElement('span');
        lab.className = 'log-label';
        lab.textContent = l.label || '';
        var m = document.createElement('span');
        m.className = 'log-msg';
        m.textContent = l.message;
        row.appendChild(t);
        row.appendChild(lab);
        row.appendChild(m);
        logBox.appendChild(row);
        after = Math.max(after, l.id);
      });
      while (logBox.children.length > 500) logBox.removeChild(logBox.firstChild);
      if (stick) logBox.scrollTop = logBox.scrollHeight;
    }

    function tick() {
      getJson('/api/zadania/' + id + '?po=' + after).then(function (data) {
        var j = data.job;
        if (j.status !== status) { location.reload(); return; }
        setProgress(root, j.progress);
        setText(root, 'pages', j.pages);
        setText(root, 'files', j.files);
        setText(root, 'bytes', j.bytesText);
        setText(root, 'failed', j.failed);
        setText(root, 'queued', j.queuedPages + j.queuedFiles);
        setText(root, 'duration', j.durationText);
        appendLog(data.log);
        setTimeout(tick, POLL_MS);
      }).catch(function () { setTimeout(tick, POLL_MS * 3); });
    }
    if (logBox) logBox.scrollTop = logBox.scrollHeight;
    setTimeout(tick, POLL_MS);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initUaForm();
    initRepeat();
    initLogFilter();
    initActive();
    initJob();
  });
})();
