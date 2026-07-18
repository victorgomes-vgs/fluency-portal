/**
 * Corporate Speech FlipBook — password gate + single-page flip reader
 * Controls a pdf2htmlEX book (book.html) inside an iframe.
 */
(function () {
  'use strict';

  const cfg = window.FLIPBOOK_CONFIG || {};
  const $ = (sel, root) => (root || document).querySelector(sel);

  const gate = $('#gate');
  const app = $('#app');
  const form = $('#gate-form');
  const passwordInput = $('#password');
  const errorEl = $('#gate-error');
  const toggleBtn = $('#toggle-password');
  const iframe = $('#book-frame');
  const loader = $('#loader');
  const pageCurrentInput = $('#page-current');
  const pageTotalEl = $('#page-total');
  const btnPrev = $('#btn-prev');
  const btnNext = $('#btn-next');
  const btnFullscreen = $('#btn-fullscreen');
  const zonePrev = $('#zone-prev');
  const zoneNext = $('#zone-next');

  let currentPage = Math.max(1, cfg.startPage || 1);
  let totalPages = cfg.totalPages || 0;
  let bookDoc = null;
  let pages = [];
  let flipping = false;

  /* ---------- Titles ---------- */
  function applyTitles() {
    const title = cfg.title || 'Corporate Speech';
    const sub = cfg.subtitle || 'Student Digital Edition';
    const brand = cfg.brand || '';
    document.title = title + ' — ' + (brand || 'FlipBook');
    const elTitle = $('#book-title');
    const elSub = $('#book-subtitle');
    const elGateTitle = $('#gate-title');
    const elGateSub = $('#gate-subtitle');
    const elBrand = $('#gate-brand');
    if (elTitle) elTitle.textContent = title;
    if (elSub) elSub.textContent = sub;
    if (elGateTitle) elGateTitle.textContent = title;
    if (elGateSub) elGateSub.textContent = sub + (brand ? ' · ' + brand : '');
    if (elBrand) elBrand.textContent = brand || 'Protected book';
  }

  /* ---------- Password ---------- */
  function isUnlocked() {
    if (!cfg.rememberSession) return false;
    try {
      return sessionStorage.getItem(cfg.sessionKey || 'cs_unlocked') === '1';
    } catch (_) {
      return false;
    }
  }

  function setUnlocked(value) {
    if (!cfg.rememberSession) return;
    try {
      if (value) sessionStorage.setItem(cfg.sessionKey || 'cs_unlocked', '1');
      else sessionStorage.removeItem(cfg.sessionKey || 'cs_unlocked');
    } catch (_) { /* ignore */ }
  }

  function checkPassword(value) {
    const expected = String(cfg.password || '');
    return value === expected;
  }

  function showApp() {
    if (gate) gate.hidden = true;
    document.body.classList.remove('locked');
    if (app) app.classList.add('visible');
    loadBook();
  }

  function showGate() {
    if (gate) gate.hidden = false;
    document.body.classList.add('locked');
    if (app) app.classList.remove('visible');
    if (passwordInput) {
      passwordInput.value = '';
      setTimeout(() => passwordInput.focus(), 80);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    const value = (passwordInput && passwordInput.value) || '';
    if (!value) {
      if (errorEl) errorEl.textContent = 'Digite a senha.';
      return;
    }
    if (!checkPassword(value)) {
      if (errorEl) errorEl.textContent = 'Senha incorreta. Tente novamente.';
      if (passwordInput) {
        passwordInput.select();
        passwordInput.focus();
      }
      return;
    }
    if (errorEl) errorEl.textContent = '';
    setUnlocked(true);
    showApp();
  }

  /* ---------- Book / flip ---------- */
  function loadBook() {
    if (!iframe) return;
    if (loader) loader.classList.remove('hidden');
    iframe.classList.remove('ready');

    const src = cfg.bookSrc || 'book.html';
    // Bust cache lightly so reloads after password work on some hosts
    iframe.src = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=1';

    iframe.onload = function () {
      try {
        bookDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (!bookDoc || !bookDoc.body) {
          throw new Error('Documento do livro inacessível');
        }
        prepareBook(bookDoc);
        goToPage(currentPage, false);
        if (loader) loader.classList.add('hidden');
        iframe.classList.add('ready');
        updateNav();
      } catch (err) {
        console.error(err);
        if (loader) {
          const t = loader.querySelector('.loader-text');
          if (t) {
            t.textContent =
              'Não foi possível carregar o livro. Hospede a pasta em um site (HTTP) e abra pelo domínio — não abra o arquivo direto do Disco.';
          }
        }
      }
    };
  }

  function injectFlipStyles(doc) {
    if (doc.getElementById('flip-reader-style')) return;
    const style = doc.createElement('style');
    style.id = 'flip-reader-style';
    style.textContent = `
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        height: 100% !important;
        overflow: hidden !important;
        background: transparent !important;
      }
      #sidebar {
        display: none !important;
      }
      #page-container {
        position: absolute !important;
        inset: 0 !important;
        left: 0 !important;
        right: 0 !important;
        top: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
        overflow: hidden !important;
        background: transparent !important;
        background-image: none !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        /* zoom encaixa a página no palco (Chrome/Edge/Safari) */
        zoom: var(--page-zoom, 1);
      }
      .pf {
        display: none !important;
        margin: 0 !important;
        box-shadow: 0 12px 40px rgba(0,0,0,0.45) !important;
        position: relative !important;
        flex-shrink: 0 !important;
        transform-origin: center center !important;
      }
      .pf.flip-visible {
        display: block !important;
      }
      .pf.flip-anim-out-left {
        animation: flipOutLeft 0.38s ease forwards;
      }
      .pf.flip-anim-out-right {
        animation: flipOutRight 0.38s ease forwards;
      }
      .pf.flip-anim-in-left {
        animation: flipInLeft 0.38s ease forwards;
      }
      .pf.flip-anim-in-right {
        animation: flipInRight 0.38s ease forwards;
      }
      @keyframes flipOutLeft {
        from { opacity: 1; transform: perspective(1200px) rotateY(0); }
        to { opacity: 0; transform: perspective(1200px) rotateY(-55deg) scale(0.96); }
      }
      @keyframes flipOutRight {
        from { opacity: 1; transform: perspective(1200px) rotateY(0); }
        to { opacity: 0; transform: perspective(1200px) rotateY(55deg) scale(0.96); }
      }
      @keyframes flipInLeft {
        from { opacity: 0; transform: perspective(1200px) rotateY(55deg) scale(0.96); }
        to { opacity: 1; transform: perspective(1200px) rotateY(0) scale(1); }
      }
      @keyframes flipInRight {
        from { opacity: 0; transform: perspective(1200px) rotateY(-55deg) scale(0.96); }
        to { opacity: 1; transform: perspective(1200px) rotateY(0) scale(1); }
      }
      .loading-indicator { display: none !important; }
    `;
    doc.head.appendChild(style);
  }

  function prepareBook(doc) {
    injectFlipStyles(doc);
    pages = Array.from(doc.querySelectorAll('.pf'));
    if (!pages.length) {
      pages = Array.from(doc.querySelectorAll('[id^="pf"]'));
    }
    totalPages = pages.length || totalPages || 1;

    fitPages();
    if (iframe.contentWindow) {
      iframe.contentWindow.addEventListener('resize', fitPages);
    }
    window.addEventListener('resize', fitPages);

    doc.addEventListener(
      'wheel',
      function (e) {
        e.preventDefault();
      },
      { passive: false }
    );
  }

  function fitPages() {
    if (!pages.length || !iframe || !bookDoc) return;
    const stage = iframe.getBoundingClientRect();
    const pad = 28;
    const maxW = Math.max(200, stage.width - pad * 2);
    const maxH = Math.max(200, stage.height - pad * 2);

    // pdf2htmlEX A4: classes .w0 / .h0 (~595.5 × 842.25 CSS px)
    const sample = pages[currentPage - 1] || pages[0];
    let w = 595.5;
    let h = 842.25;
    try {
      const cs = bookDoc.defaultView.getComputedStyle(sample);
      const cw = parseFloat(cs.width);
      const ch = parseFloat(cs.height);
      if (cw > 50) w = cw;
      if (ch > 50) h = ch;
    } catch (_) { /* keep defaults */ }

    const zoom = Math.min(maxW / w, maxH / h, 1.25);
    const container = bookDoc.getElementById('page-container') || bookDoc.body;
    if (container && container.style) {
      container.style.setProperty('--page-zoom', String(zoom));
    }
  }

  function clearAnimClasses(el) {
    el.classList.remove(
      'flip-anim-out-left',
      'flip-anim-out-right',
      'flip-anim-in-left',
      'flip-anim-in-right'
    );
  }

  function goToPage(n, animate) {
    if (!pages.length) return;
    n = Math.max(1, Math.min(totalPages, n | 0));
    const nextEl = pages[n - 1];
    if (!nextEl) return;

    const prevN = currentPage;
    const direction = n > prevN ? 1 : n < prevN ? -1 : 0;

    if (!animate || direction === 0 || !pages[prevN - 1]) {
      pages.forEach(function (p, i) {
        clearAnimClasses(p);
        p.classList.toggle('flip-visible', i === n - 1);
      });
      currentPage = n;
      updateNav();
      fitPages();
      return;
    }

    if (flipping) return;
    flipping = true;
    const fromEl = pages[prevN - 1];
    clearAnimClasses(fromEl);
    clearAnimClasses(nextEl);

    fromEl.classList.add(direction > 0 ? 'flip-anim-out-left' : 'flip-anim-out-right');

    setTimeout(function () {
      fromEl.classList.remove('flip-visible');
      clearAnimClasses(fromEl);
      nextEl.classList.add('flip-visible');
      nextEl.classList.add(direction > 0 ? 'flip-anim-in-right' : 'flip-anim-in-left');
      fitPages();

      setTimeout(function () {
        clearAnimClasses(nextEl);
        currentPage = n;
        flipping = false;
        updateNav();
      }, 380);
    }, 200);
  }

  function updateNav() {
    if (pageCurrentInput) pageCurrentInput.value = String(currentPage);
    if (pageTotalEl) pageTotalEl.textContent = String(totalPages || '—');
    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= totalPages;
    if (zonePrev) zonePrev.disabled = currentPage <= 1;
    if (zoneNext) zoneNext.disabled = currentPage >= totalPages;
  }

  function nextPage() {
    goToPage(currentPage + 1, true);
  }
  function prevPage() {
    goToPage(currentPage - 1, true);
  }

  /* ---------- Fullscreen ---------- */
  function toggleFullscreen() {
    const root = document.documentElement;
    if (!document.fullscreenElement) {
      (root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen).call(root);
      document.body.classList.add('is-fullscreen');
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
      document.body.classList.remove('is-fullscreen');
    }
  }

  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement) document.body.classList.remove('is-fullscreen');
  });

  /* ---------- Keyboard / swipe ---------- */
  function onKey(e) {
    if (gate && !gate.hidden) return;
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        nextPage();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        prevPage();
        break;
      case 'Home':
        e.preventDefault();
        goToPage(1, true);
        break;
      case 'End':
        e.preventDefault();
        goToPage(totalPages, true);
        break;
      case 'f':
      case 'F':
        if (!e.ctrlKey && !e.metaKey) toggleFullscreen();
        break;
      default:
        break;
    }
  }

  let touchStartX = 0;
  function onTouchStart(e) {
    if (e.changedTouches && e.changedTouches[0]) {
      touchStartX = e.changedTouches[0].clientX;
    }
  }
  function onTouchEnd(e) {
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) nextPage();
    else prevPage();
  }

  /* ---------- Wire UI ---------- */
  function bind() {
    applyTitles();

    if (form) form.addEventListener('submit', onSubmit);
    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener('click', function () {
        const isPass = passwordInput.type === 'password';
        passwordInput.type = isPass ? 'text' : 'password';
        toggleBtn.textContent = isPass ? 'Ocultar' : 'Mostrar';
      });
    }

    if (btnPrev) btnPrev.addEventListener('click', prevPage);
    if (btnNext) btnNext.addEventListener('click', nextPage);
    if (zonePrev) zonePrev.addEventListener('click', prevPage);
    if (zoneNext) zoneNext.addEventListener('click', nextPage);
    if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);

    if (pageCurrentInput) {
      pageCurrentInput.addEventListener('change', function () {
        const n = parseInt(pageCurrentInput.value, 10);
        if (!isNaN(n)) goToPage(n, true);
        else updateNav();
      });
      pageCurrentInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          pageCurrentInput.blur();
        }
      });
    }

    document.addEventListener('keydown', onKey);
    const stage = $('.app-stage');
    if (stage) {
      stage.addEventListener('touchstart', onTouchStart, { passive: true });
      stage.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    if (isUnlocked()) showApp();
    else showGate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
