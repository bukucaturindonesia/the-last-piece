const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');
const glow = document.querySelector('.cursor-glow');
const heroImage = document.querySelector('.hero-image');

const updateHeader = () => {
  header?.classList.toggle('scrolled', window.scrollY > 28);
};

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

menuButton?.addEventListener('click', () => {
  if (!mobileMenu || !header) return;
  const open = !mobileMenu.classList.contains('open');
  mobileMenu.classList.toggle('open', open);
  header.classList.toggle('menu-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  mobileMenu.setAttribute('aria-hidden', String(!open));
  document.body.style.overflow = open ? 'hidden' : '';
});

document.querySelectorAll('.mobile-menu a').forEach((link) => {
  link.addEventListener('click', () => {
    mobileMenu?.classList.remove('open');
    header?.classList.remove('menu-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    mobileMenu?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  });
});

const revealElements = [...document.querySelectorAll('.reveal:not(.is-visible)')];

if ('IntersectionObserver' in window && revealElements.length > 0) {
  document.documentElement.classList.add('motion-ready');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  revealElements.forEach((element) => observer.observe(element));

  // Safety fallback: never leave content hidden if the observer is interrupted.
  window.setTimeout(() => {
    document.querySelectorAll('.reveal:not(.is-visible)').forEach((element) => {
      element.classList.add('is-visible');
    });
  }, 2400);
}

if (window.matchMedia('(pointer:fine)').matches) {
  if (glow) {
    glow.style.opacity = '1';
    window.addEventListener('pointermove', (event) => {
      glow.style.left = `${event.clientX}px`;
      glow.style.top = `${event.clientY}px`;
    }, { passive: true });
  }

  window.addEventListener('scroll', () => {
    if (!heroImage || window.scrollY > window.innerHeight) return;
    heroImage.style.transform = `scale(1.035) translateY(${window.scrollY * 0.035}px)`;
  }, { passive: true });
}

/* Full-screen internal route transition. */
(() => {
  const routeLabels = new Map([
    ['/', 'THE LAST PIECE'],
    ['/the-lore/', 'THE LORE'],
    ['/the-search/', 'THE SEARCH'],
    ['/roadmap/', 'ROADMAP'],
    ['/faq/', 'FAQ']
  ]);

  const normalizePath = (path) => {
    if (!path || path === '/') return '/';
    return path.endsWith('/') ? path : `${path}/`;
  };

  const loader = document.createElement('div');
  loader.className = 'page-transition-loader';
  loader.setAttribute('data-page-transition-loader', '');
  loader.setAttribute('aria-hidden', 'true');
  loader.innerHTML = `
    <div class="page-transition-loader__scene">
      <img class="page-transition-loader__frog" src="/assets/loading-frog.webp" alt="" width="960" height="640" />
      <span class="page-transition-loader__coin" aria-hidden="true">$</span>
      <div class="page-transition-loader__copy">
        <span class="page-transition-loader__eyebrow">ENTERING THE NEXT CLUE</span>
        <strong class="page-transition-loader__label" data-transition-label>THE LAST PIECE</strong>
        <span class="page-transition-loader__bar" aria-hidden="true"></span>
      </div>
    </div>`;
  document.body.append(loader);

  const labelNode = loader.querySelector('[data-transition-label]');
  let navigating = false;

  const activate = (label) => {
    if (labelNode) labelNode.textContent = label;
    loader.classList.add('is-active');
    loader.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-page-transitioning');
  };

  document.addEventListener('click', (event) => {
    if (navigating || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    const rawHref = link.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:')) return;

    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin) return;

    const currentPath = normalizePath(window.location.pathname);
    const destinationPath = normalizePath(destination.pathname);
    if (destinationPath === currentPath && destination.hash) return;
    if (destinationPath === currentPath && !destination.hash) return;

    event.preventDefault();
    navigating = true;

    const label = routeLabels.get(destinationPath) || link.textContent.trim() || 'THE NEXT CLUE';
    activate(label.toUpperCase());

    // Long enough to feel intentional, short enough to keep navigation responsive.
    window.setTimeout(() => {
      window.location.assign(destination.href);
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 220 : 980);
  });

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    navigating = false;
    loader.classList.remove('is-active');
    loader.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-page-transitioning');
  });
})();
