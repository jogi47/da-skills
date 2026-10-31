(function () {
  var panels = Array.prototype.slice.call(document.querySelectorAll('details.panel'));

  function openTarget(id, scroll) {
    var item = id && document.getElementById(id);
    var panel = item && item.querySelector('details.panel');
    if (!panel) { return false; }
    panel.open = true;
    if (scroll) { item.scrollIntoView({ block: 'start' }); }
    return true;
  }

  // Open and scroll here rather than leave it to the link: the page may run in a frame that
  // ignores in-page links.
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    if (link && openTarget(link.getAttribute('href').slice(1), true)) { e.preventDefault(); }
  });
  window.addEventListener('hashchange', function () { openTarget(location.hash.slice(1), true); });
  if (location.hash) { openTarget(location.hash.slice(1), true); }

  // A printed copy shows everything.
  window.addEventListener('beforeprint', function () { panels.forEach(function (panel) { panel.open = true; }); });
})();

(function () {
  var viewer = document.getElementById('viewer');
  var img = document.getElementById('viewer-img');
  var caption = document.getElementById('viewer-caption');
  var pos = document.getElementById('viewer-pos');
  var prev = document.getElementById('viewer-prev');
  var next = document.getElementById('viewer-next');
  var group = [];
  var index = 0;
  var opener = null;

  function show() {
    var shot = group[index];
    img.src = shot.dataset.src;
    img.alt = shot.querySelector('img').alt;
    caption.textContent = shot.dataset.caption;
    pos.textContent = (index + 1) + ' / ' + group.length;
    prev.disabled = index === 0;
    next.disabled = index === group.length - 1;
  }

  function open(shot) {
    opener = shot;
    group = Array.prototype.slice.call(shot.parentElement.querySelectorAll('.shot'));
    index = group.indexOf(shot);
    show();
    viewer.hidden = false;
    document.getElementById('viewer-close').focus();
    if (viewer.requestFullscreen) { viewer.requestFullscreen().catch(function () {}); }
  }

  function close() {
    viewer.hidden = true;
    if (document.fullscreenElement && document.exitFullscreen) { document.exitFullscreen().catch(function () {}); }
    if (opener) { opener.focus(); }
  }

  document.querySelectorAll('.shot').forEach(function (shot) {
    shot.addEventListener('click', function () { open(shot); });
  });
  document.getElementById('viewer-close').addEventListener('click', close);
  prev.addEventListener('click', function () { if (index > 0) { index--; show(); } });
  next.addEventListener('click', function () { if (index < group.length - 1) { index++; show(); } });
  viewer.addEventListener('click', function (e) {
    if (e.target === viewer || e.target.classList.contains('viewer-stage')) { close(); }
  });
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && !viewer.hidden) { viewer.hidden = true; if (opener) { opener.focus(); } }
  });
  document.addEventListener('keydown', function (e) {
    if (viewer.hidden) { return; }
    if (e.key === 'Escape') { close(); }
    if (e.key === 'ArrowLeft' && index > 0) { index--; show(); }
    if (e.key === 'ArrowRight' && index < group.length - 1) { index++; show(); }
  });
})();
