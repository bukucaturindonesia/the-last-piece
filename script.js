(() => {
  'use strict';

  const PROJECT = Object.freeze({
    website: 'https://the-last-piece.vercel.app/',
    x: 'https://x.com/LastPieceCoinHd',
    telegram: 'https://t.me/thastpiece',
    pump: 'https://pump.fun/coin/4ZvfjSV39AV8X56idKU2vA2VEBktXiQ7jyNxjoACpump',
    contract: '4ZvfjSV39AV8X56idKU2vA2VEBktXiQ7jyNxjoACpump'
  });

  document.querySelectorAll('[data-official-link]').forEach((link) => {
    const key = link.getAttribute('data-official-link');
    const href = key ? PROJECT[key] : null;
    if (href) link.setAttribute('href', href);
  });

  document.querySelectorAll('[data-contract]').forEach((node) => {
    node.textContent = PROJECT.contract;
  });

  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('.menu-toggle');
  const mobilePanel = document.querySelector('.mobile-panel');

  const getMenuFocusables = () => {
    if (!menuButton || !mobilePanel) return [];
    return [menuButton, ...mobilePanel.querySelectorAll('a[href], button:not([disabled])')]
      .filter((element) => element.getClientRects().length > 0);
  };

  const setMenuState = (open, { restoreFocus = false } = {}) => {
    if (!menuButton || !mobilePanel) return;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    mobilePanel.classList.toggle('is-open', open);
    mobilePanel.setAttribute('aria-hidden', String(!open));
    mobilePanel.toggleAttribute('inert', !open);
    header?.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);

    if (open) {
      window.setTimeout(() => mobilePanel.querySelector('a[href]')?.focus(), 0);
    } else if (restoreFocus) {
      menuButton.focus();
    }
  };

  mobilePanel?.setAttribute('inert', '');

  menuButton?.addEventListener('click', () => {
    setMenuState(menuButton.getAttribute('aria-expanded') !== 'true');
  });

  mobilePanel?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenuState(false));
  });

  document.addEventListener('keydown', (event) => {
    const menuOpen = menuButton?.getAttribute('aria-expanded') === 'true';

    if (event.key === 'Escape' && menuOpen) {
      event.preventDefault();
      setMenuState(false, { restoreFocus: true });
      return;
    }

    if (event.key !== 'Tab' || !menuOpen) return;
    const focusables = getMenuFocusables();
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1080) setMenuState(false);
  }, { passive: true });

  const updateHeader = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 20);
  };
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const revealNodes = [...document.querySelectorAll('.reveal:not(.is-visible)')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealNodes.forEach((node) => node.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });

    revealNodes.forEach((node) => observer.observe(node));

    window.setTimeout(() => {
      document.querySelectorAll('.reveal:not(.is-visible)').forEach((node) => node.classList.add('is-visible'));
    }, 2800);
  }

  const copyButtons = document.querySelectorAll('[data-copy-contract]');

  const writeClipboard = async (value) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard copy failed');
  };

  copyButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const label = button.querySelector('[data-copy-label]');
      const copyZone = button.closest('[data-copy-zone], .contract-box');
      const status = copyZone?.querySelector('[data-copy-status]');

      try {
        await writeClipboard(PROJECT.contract);
        if (label) label.textContent = 'Copied';
        if (status) status.textContent = 'Full contract address copied.';
      } catch {
        if (label) label.textContent = 'Copy failed';
        if (status) status.textContent = 'Copy failed. Select the address manually.';
      }

      window.setTimeout(() => {
        if (label) label.textContent = 'Copy contract';
        if (status) status.textContent = '';
      }, 2600);
    });
  });
})();
