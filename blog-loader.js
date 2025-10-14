// blog-loader.js
// Unified loader with search, load-more, read-toggle, and modal.
// Includes HEAD preflight for images and graceful behavior if filters UI is absent.

(function() {
  // CONFIG
  const POSTS_CONTAINER_SELECTOR = '#postsGrid .posts-grid';
  const LOAD_BTN_ID = 'loadMore';
  const LOAD_LABEL_ID = 'loadMoreLabel';
  const LOAD_COUNT_ID = 'loadMoreCount';
  const INITIAL_SHOW = 6;
  const INCREMENT = 6;
  const POSTS_JSON = 'posts.json';
  const PLACEHOLDER_IMAGE = 'https://picsum.photos/800/450?random=999';

  // ELEMENTS (may be null for some optional pieces)
  const loadBtn = document.getElementById(LOAD_BTN_ID);
  const loadLabel = document.getElementById(LOAD_LABEL_ID);
  const loadCount = document.getElementById(LOAD_COUNT_ID);
  const searchInput = document.getElementById('searchInput');
  const filtersContainer = document.querySelector('.filters'); // optional, safe if removed
  const innerGridParent = document.querySelector('#postsGrid');

  if (!innerGridParent) {
    console.warn('Posts container #postsGrid not found. Aborting loader.');
    return;
  }

  // inner grid element (where cards will be appended)
  let innerGrid = innerGridParent.querySelector('.posts-grid');
  if (!innerGrid) {
    // create if missing
    innerGrid = document.createElement('div');
    innerGrid.className = 'posts-grid';
    innerGridParent.appendChild(innerGrid);
  }

  // State
  let allCards = [];
  let visibleCount = INITIAL_SHOW;
  const fallbackPosts = [
    // ... your fallbackPosts here, you can keep the ones you already have or adapt
    {
      "slug": "blog-1",
      "title": "When grief collided with tradition",
      "excerpt": "Silhouette of a woman and two girls at the doorway of a modest house.",
      "image": "images/blog1.jpg",
      "tags": ["Grief", "Tradition"],
      "author": "Irene Ground Initiative",
      "date": "2025-10-08",
      "content": ""
    },
    { "slug": "blog-2", "title": "A single act of kindness can open door of hope", "excerpt": "This is the story of how one generous donor changes everything for a widow named Grace and her children.", "image": "images/blog2.jpg", "tags": ["Donation","Renewed Hope"], "author": "Story by the Communications Unit, Women of Strength Project", "date": "2025-04-08", "content": "" },
    { "slug": "blog-3", "title": "A day volunteers built hope for a widow", "excerpt": "A one day mission turned into a life changing moment for Auntie Mabel and the volunteers who showed up to help.", "image": "images/blog3.jpg", "tags": ["volunteer","impact"], "author": "Grace Ground Initiative", "date": "2025-08-05", "content": "" },
    { "slug": "blog-4", "title": "How Nwanyi Ogwuanwu Widows Foundation restored Hope to Oliaku Uche Njaka", "excerpt": "A story of loss, courage, and renewed hope.", "image": "images/blog3.jpg", "tags": ["Financial Assistance","Family Restoration"], "author": "Communications Team", "date": "2025-08-05", "content": "" },
    { "slug": "blog-5", "title": "Hope Across Borders", "excerpt": "A widow’s desperate cry for help became a story of faith and healing.", "image": "images/blog4.jpg", "tags": ["Medical Support","Child Health","Widow Empowerment"], "author": "Communications Team", "date": "2025-08-05", "content": "" },
    { "slug": "blog-6", "title": "From Struggle to Stability", "excerpt": "How the foundation helped rebuild a business.", "image": "images/blog6.jpg", "tags": ["Economic Empowerment","Widow Support","Business Revival"], "author": "Communications Team", "date": "2025-09-22", "content": "" },
    { "slug": "blog-7", "title": "A Home for Grace", "excerpt": "How the foundation restored dignity to Mrs. Grace Nwoye.", "image": "images/blog7.jpg", "tags": ["Humanitarian Support","Health Assistance","Shelter for Widows"], "author": "Nancy Ground Initiative", "date": "2025-10-03", "content": "" },
    { "slug": "blog-8", "title": "When Hope Was Almost Lost", "excerpt": "How the foundation rescued a widow’s only son from hospital abandonment.", "image": "images/blog8.jpg", "tags": ["Emergency Support","Child Welfare","Widow Advocacy"], "author": "Nancy Ground Initiative", "date": "2025-10-08", "content": "" },
    { "slug": "blog-9", "title": "From Grief to Growth", "excerpt": "How the foundation helped build a tailoring business.", "image": "images/blog9.jpg", "tags": ["Widow Empowerment","Skill Training","Financial Independence"], "author": "Nancy Ground Initiative", "date": "2025-10-10", "content": "" }
  ];

  // Helpers
  function slugify(text) {
    return String(text || '').trim().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/\-+/g, '-')
      .replace(/^\-+|\-+$/g, '');
  }
  function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // HEAD preflight with timeout
  async function urlExistsHead(url, timeoutMs = 3000) {
    if (!url) return false;
    if (url.startsWith('data:')) return true;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-cache', signal: controller.signal });
      clearTimeout(id);
      return res.ok;
    } catch (err) {
      clearTimeout(id);
      return false;
    }
  }

  // Create card element
  function createCard(post) {
    const card = document.createElement('article');
    card.className = 'blog-card';
    const slug = post.slug || slugify(post.title || '');
    card.dataset.slug = slug;
    card.dataset.title = post.title || '';
    card.dataset.tags = (Array.isArray(post.tags) ? post.tags.join(' ') : (post.tags || '')).toLowerCase();

    const imageUrl = post._image || post.image || PLACEHOLDER_IMAGE;
    const titleEsc = escapeHtml(post.title || 'Untitled');
    const excerptEsc = escapeHtml(post.excerpt || '');
    const authorEsc = escapeHtml(post.author || '');
    const dateEsc = escapeHtml(post.date || '');

    card.innerHTML = `
      <img src="${escapeHtml(imageUrl)}" alt="${titleEsc}" class="featured-img" onerror="this.src='${PLACEHOLDER_IMAGE}'">
      <div class="blog-content">
        <div class="meta">${authorEsc ? 'By ' + authorEsc : ''}${authorEsc && dateEsc ? ' • ' : ''}${dateEsc || ''}</div>
        <h4>${titleEsc}</h4>
        <p class="excerpt">${excerptEsc}</p>
        <div class="card-actions">
          <button class="read-toggle" type="button" aria-expanded="false">Read Excerpt</button>
          <a class="read-more" href="post.html?slug=${encodeURIComponent(slug)}">Open Full Post →</a>
        </div>
      </div>
      <div class="readmore-content" style="display:none">
        <p>${escapeHtml((post.content && post.content.slice(0, 400)) || '')}${post.content && post.content.length > 400 ? '…' : ''}</p>
      </div>
    `;
    return card;
  }

  // Attach read-toggle handlers
  function attachReadToggleHandlers() {
    allCards.forEach(card => {
      const toggle = card.querySelector('.read-toggle');
      const content = card.querySelector('.readmore-content');
      if (!toggle || !content) return;
      if (toggle._hasHandler) return;
      toggle._hasHandler = true;
      toggle.addEventListener('click', e => {
        e.preventDefault();
        const isOpen = content.style.display === 'block';
        content.style.display = isOpen ? 'none' : 'block';
        toggle.setAttribute('aria-expanded', String(!isOpen));
        toggle.textContent = isOpen ? 'Read Excerpt' : 'Read Less ↑';
      });
    });
  }

  // Modal handlers
  function attachModalHandlers() {
    let modalBackdrop = document.querySelector('.ggi-modal-backdrop');
    if (!modalBackdrop) {
      modalBackdrop = document.createElement('div');
      modalBackdrop.className = 'ggi-modal-backdrop';
      modalBackdrop.style.display = 'none';
      modalBackdrop.innerHTML = `
        <div class="ggi-modal" role="dialog" aria-modal="true">
          <button class="close-btn" aria-label="Close">✕</button>
          <div class="ggi-inner"></div>
        </div>
      `;
      document.body.appendChild(modalBackdrop);
    }

    const modalInner = modalBackdrop.querySelector('.ggi-inner');
    const modalClose = modalBackdrop.querySelector('.close-btn');

    function showModal() {
      modalBackdrop.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
    function hideModal() {
      modalBackdrop.style.display = 'none';
      document.body.style.overflow = '';
      modalInner.innerHTML = '';
    }

    modalBackdrop.addEventListener('click', e => {
      if (e.target === modalBackdrop) hideModal();
    });
    if (modalClose) modalClose.addEventListener('click', hideModal);

    allCards.forEach(card => {
      const anchor = card.querySelector('.read-more');
      const content = card.querySelector('.readmore-content');
      if (!anchor) return;
      if (anchor._hasHandler) return;
      anchor._hasHandler = true;
      anchor.addEventListener('click', e => {
        e.preventDefault();
        const slug = card.dataset.slug;
        const title = card.dataset.title || card.querySelector('h4')?.textContent || 'Post';
        const body = (content && content.innerHTML && content.innerHTML.trim().length) ? content.innerHTML : `<p>No preview available for "${escapeHtml(title)}"</p>`;
        modalInner.innerHTML = `
          <h1>${escapeHtml(title)}</h1>
          <div class="post-body">${body}</div>
          <p><a href="post.html?slug=${encodeURIComponent(slug)}">Open Full Post →</a></p>
        `;
        showModal();
      });
    });
  }

  // Build filters from posts if filters UI exists (non-destructive)
  function buildFiltersFromPosts(posts) {
    if (!filtersContainer) return;
    const existing = new Set();
    filtersContainer.querySelectorAll('[data-filter]').forEach(btn => existing.add(btn.dataset.filter));
    const tags = new Set();
    posts.forEach(p => {
      (p.tags || []).forEach(t => {
        const tag = String(t || '').toLowerCase().trim();
        if (tag) tags.add(tag);
      });
    });
    tags.forEach(tag => {
      if (existing.has(tag) || tag === 'all') return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.filter = tag;
      btn.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
      filtersContainer.appendChild(btn);
    });
  }

  // Populate posts into DOM
  function populatePosts(posts) {
    innerGrid.innerHTML = '';
    posts.forEach(post => {
      post.tags = Array.isArray(post.tags) ? post.tags : (post.tags ? String(post.tags).split(/\s*,\s*|[\s]+/) : []);
      post.slug = post.slug || slugify(post.title || '');
      const card = createCard(post);
      innerGrid.appendChild(card);
    });

    allCards = Array.from(innerGrid.querySelectorAll('.blog-card'));
    attachReadToggleHandlers();
    attachModalHandlers();
    // ensure load-more script updates button state immediately
    applyVisibility();
  }

  // Preflight images
  async function preflightImages(posts) {
    const missing = [];
    await Promise.all(posts.map(async p => {
      const imgUrl = p.image || '';
      if (!imgUrl) {
        p._image = PLACEHOLDER_IMAGE;
        missing.push({ slug: p.slug, reason: 'no-image-field' });
        return;
      }
      const ok = await urlExistsHead(imgUrl, 3000);
      if (ok) p._image = imgUrl;
      else {
        p._image = PLACEHOLDER_IMAGE;
        missing.push({ slug: p.slug, url: imgUrl });
      }
    }));
    if (missing.length) console.warn('Some post images were missing or unreachable, using placeholders:', missing);
  }

  // Load posts.json with fallback
  async function loadPosts() {
    try {
      const res = await fetch(POSTS_JSON, { cache: 'no-cache' });
      if (!res.ok) throw new Error('Failed to fetch posts.json, status ' + res.status);
      const data = await res.json();
      const postsArray = Array.isArray(data) ? data : Object.keys(data).map(k => data[k]);
      postsArray.forEach(p => {
        p.tags = Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(/\s*,\s*|[\s]+/) : []);
        p.slug = p.slug || slugify(p.title || '');
      });
      await preflightImages(postsArray);
      buildFiltersFromPosts(postsArray);
      populatePosts(postsArray);
      console.info('Loaded posts.json, posts:', postsArray.length);
    } catch (err) {
      console.warn('Could not load posts.json, using fallback posts', err);
      await preflightImages(fallbackPosts);
      buildFiltersFromPosts(fallbackPosts);
      populatePosts(fallbackPosts);
    }
  }

  // ---- Visibility / Load more logic ----
  function applyVisibility() {
    const cards = Array.from(innerGrid.children).filter(n => n.nodeType === 1);
    const total = cards.length;

    if (!loadBtn) return; // nothing to update if no button exists

    if (total === 0) {
      loadBtn.style.display = 'none';
      return;
    } else {
      loadBtn.style.display = '';
    }

    // If visibleCount larger than total, clamp
    if (visibleCount > total) visibleCount = total;

    // Hide or show cards based on current visibleCount and current search/filter state
    // If search or filter is active, we'll compute match set and then apply visibleCount within that subset.
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();
    const activeFilter = (filtersContainer?.querySelector('.active')?.dataset.filter) || null;

    // Build list of matched cards (respect search and filter)
    const matched = [];
    cards.forEach(card => {
      const title = (card.dataset.title || '').toLowerCase();
      const excerpt = (card.querySelector('.excerpt')?.textContent || '').toLowerCase();
      const tags = (card.dataset.tags || '').toLowerCase();
      const combined = (title + ' ' + excerpt + ' ' + tags).trim();
      const matchesSearch = !searchTerm || combined.includes(searchTerm);
      const matchesFilter = !activeFilter || activeFilter === 'all' || tags.split(/\s+/).includes(activeFilter);
      if (matchesSearch && matchesFilter) matched.push(card);
    });

    // First hide all, then reveal the first visibleCount matched cards
    cards.forEach(c => c.style.display = 'none');

    let shown = 0;
    matched.forEach((c, i) => {
      if (shown < visibleCount) {
        c.style.display = '';
        shown++;
      } else {
        c.style.display = 'none';
      }
    });

    const remaining = Math.max(0, matched.length - shown);
    if (loadCount) loadCount.textContent = remaining > 0 ? `(${remaining} more)` : '';

    if (shown >= matched.length) {
      if (loadLabel) loadLabel.textContent = 'Load less';
      if (loadBtn) loadBtn.setAttribute('aria-expanded', 'true');
    } else {
      if (loadLabel) loadLabel.textContent = 'Load more';
      if (loadBtn) loadBtn.setAttribute('aria-expanded', 'false');
    }

    // hide the button entirely if there are 0 matching posts
    if (matched.length === 0) loadBtn.style.display = 'none';
  }

  // Button click behavior
  if (loadBtn) {
    // ensure default label
    if (loadLabel) loadLabel.textContent = 'Load more';
    loadBtn.addEventListener('click', () => {
      // Determine matched set size
      const cards = Array.from(innerGrid.children).filter(n => n.nodeType === 1);
      const searchTerm = (searchInput?.value || '').toLowerCase().trim();
      const activeFilter = (filtersContainer?.querySelector('.active')?.dataset.filter) || null;
      const matched = cards.filter(card => {
        const title = (card.dataset.title || '').toLowerCase();
        const excerpt = (card.querySelector('.excerpt')?.textContent || '').toLowerCase();
        const tags = (card.dataset.tags || '').toLowerCase();
        const combined = (title + ' ' + excerpt + ' ' + tags).trim();
        const matchesSearch = !searchTerm || combined.includes(searchTerm);
        const matchesFilter = !activeFilter || activeFilter === 'all' || tags.split(/\s+/).includes(activeFilter);
        return matchesSearch && matchesFilter;
      });

      // If currently all matched are visible, collapse to initial
      const currentlyVisible = matched.filter(c => c.style.display !== 'none').length;
      if (currentlyVisible >= matched.length) {
        visibleCount = INITIAL_SHOW;
        applyVisibility();
        // scroll to grid top for clarity
        window.scrollTo({ top: Math.max(0, innerGrid.getBoundingClientRect().top + window.scrollY - 80), behavior: 'smooth' });
        return;
      }

      // otherwise increase visibleCount by INCREMENT
      visibleCount = Math.min(matched.length, visibleCount + INCREMENT);
      applyVisibility();

      // smooth scroll to first newly revealed card
      const firstNew = matched.find((c, idx) => idx >= currentlyVisible);
      if (firstNew) {
        const top = firstNew.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  }

  // Observe grid mutations to reapply visibility (works with async loaders)
  const mo = new MutationObserver(mutations => {
    let added = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) { added = true; break; }
    }
    if (added) {
      // reset visibleCount to initial when new data is loaded
      visibleCount = INITIAL_SHOW;
      setTimeout(() => {
        allCards = Array.from(innerGrid.querySelectorAll('.blog-card'));
        attachReadToggleHandlers();
        attachModalHandlers();
        applyVisibility();
      }, 60);
    }
  });
  mo.observe(innerGridParent, { childList: true, subtree: true });

  // Search listener
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      visibleCount = INITIAL_SHOW;
      applyVisibility();
    });
  }

  // Filters listener (if present)
  if (filtersContainer) {
    filtersContainer.addEventListener('click', e => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      filtersContainer.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      visibleCount = INITIAL_SHOW;
      applyVisibility();
    });
  }

  // Build tag click delegation (any element with class 'tag' navigates to blog.html?tag=...)
  document.body.addEventListener('click', (e) => {
    const tagEl = e.target.closest && e.target.closest('.tag');
    if (!tagEl) return;
    const raw = tagEl.getAttribute('data-tag') || tagEl.textContent || '';
    const param = String(raw || '').trim().toLowerCase().replace(/\s+/g,'-').replace(/[^\w-]/g,'');
    if (!param) return;
    e.preventDefault();
    window.location.href = 'blog.html?tag=' + encodeURIComponent(param);
  });

  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPosts);
  } else {
    loadPosts();
  }

})();
