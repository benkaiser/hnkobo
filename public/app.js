/* Comment expand/collapse toggle.
   Written in conservative ES5 with no :scope, closest(), or classList.toggle()
   return-value reliance, so it works on the Kobo's old WebKit browser. */
(function () {
  function hasClass(el, cls) {
    return (' ' + el.className + ' ').indexOf(' ' + cls + ' ') !== -1;
  }
  function addClass(el, cls) {
    if (!hasClass(el, cls)) el.className = (el.className + ' ' + cls).replace(/^\s+/, '');
  }
  function removeClass(el, cls) {
    el.className = (' ' + el.className + ' ')
      .replace(' ' + cls + ' ', ' ')
      .replace(/^\s+|\s+$/g, '');
  }
  // First direct child element of `parent` that has class `cls`.
  function directChildByClass(parent, cls) {
    var n = parent.firstChild;
    while (n) {
      if (n.nodeType === 1 && hasClass(n, cls)) return n;
      n = n.nextSibling;
    }
    return null;
  }
  function countComments(root) {
    if (root.getElementsByClassName) return root.getElementsByClassName('comment').length;
    return root.querySelectorAll ? root.querySelectorAll('.comment').length : 0;
  }

  function wire() {
    var comments = document.getElementsByClassName
      ? document.getElementsByClassName('comment')
      : document.querySelectorAll('.comment');

    for (var i = 0; i < comments.length; i++) {
      (function (comment) {
        var kids = directChildByClass(comment, 'kids');
        if (!kids) return;

        // The toggle button lives inside the .cmeta line of this comment.
        var meta = directChildByClass(comment, 'cmeta');
        var btn = meta ? directChildByClass(meta, 'toggle') : null;
        if (!btn) {
          var tlist = comment.getElementsByClassName
            ? comment.getElementsByClassName('toggle')
            : comment.querySelectorAll('.toggle');
          btn = tlist && tlist.length ? tlist[0] : null;
        }
        if (!btn) return;

        var count = countComments(kids);

        function render() {
          if (hasClass(kids, 'collapsed')) {
            btn.setAttribute('aria-expanded', 'false');
            btn.innerHTML = '+ ' + count + ' replies';
          } else {
            btn.setAttribute('aria-expanded', 'true');
            btn.innerHTML = '\u2013';
          }
        }

        btn.onclick = function (e) {
          if (e && e.preventDefault) e.preventDefault();
          if (hasClass(kids, 'collapsed')) {
            removeClass(kids, 'collapsed');
          } else {
            addClass(kids, 'collapsed');
          }
          render();
          return false;
        };

        render();
      })(comments[i]);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    wire();
  } else if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', wire, false);
  }
  // Extra safety net for old browsers that ignore `defer` / don't fire
  // DOMContentLoaded reliably. wire() assigns onclick, so re-running is harmless.
  if (window.addEventListener) {
    window.addEventListener('load', wire, false);
  } else if (window.attachEvent) {
    window.attachEvent('onload', wire);
  }
})();
