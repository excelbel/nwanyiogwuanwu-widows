// fix-readmore.js
// Convert placeholder copy or empty anchors into real links for the blog grid
document.addEventListener('DOMContentLoaded', () => {
  const PLACEHOLDER = 'Open full post. Replace this alert with a link to the full post or a modal.';

  function slugify(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function setLinkAttributes(el, slug) {
    if (!el) return;
    const href = slug ? `post.html?slug=${encodeURIComponent(slug)}` : 'post.html';
    if (el.tagName === 'A') {
      el.setAttribute('href', href);
    } else if (el.tagName === 'BUTTON') {
      // for buttons we set a data-href so the click handler can navigate
      el.setAttribute('data-href', href);
    }
  }

  function fixNode(node) {
    if (!(node instanceof Element)) {
      // if it's a text node inside an element, try its parent
      return;
    }

    // If the node itself contains the placeholder text somewhere, replace that text with a link
    // We search for text nodes that include the placeholder to avoid wiping out other markup
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
    const toReplace = [];
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      if (textNode.nodeValue && textNode.nodeValue.includes(PLACEHOLDER)) {
        toReplace.push(textNode);
      }
    }

    toReplace.forEach(textNode => {
      const parentEl = textNode.parentElement;
      if (!parentEl) return;
      const card = parentEl.closest('.blog-card');
      const slug = card?.dataset.slug || (card?.dataset.title && slugify(card.dataset.title));
      const link = document.createElement('a');
      link.className = 'read-more-link';
      link.textContent = 'Open Full Post →';
      link.href = slug ? `post.html?slug=${encodeURIComponent(slug)}` : 'post.html';
      // replace the placeholder text portion only
      const parts = textNode.nodeValue.split(PLACEHOLDER);
      const frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode(parts.shift() || ''));
      frag.appendChild(link);
      if (parts.length) frag.appendChild(document.createTextNode(parts.join(PLACEHOLDER)));
      parentEl.replaceChild(frag, textNode);
    });

    // Fix anchors with empty href or href '#', and buttons without data-href
    node.querySelectorAll('a, button').forEach(el => {
      if (!(el instanceof Element)) return;
      const isAnchor = el.tagName === 'A';
      const href = isAnchor ? el.getAttribute('href') : el.getAttribute('data-href');
      const onclick = el.getAttribute('onclick') || '';
      const card = el.closest('.blog-card');
      const slug = card?.dataset.slug || (card?.dataset.title && slugify(card.dataset.title));

      // remove inline onclick placeholder if it contains the placeholder text
      if (onclick.includes(PLACEHOLDER)) {
        el.removeAttribute('onclick');
      }

      if (isAnchor) {
        if (!href || href === '#') {
          setLinkAttributes(el, slug);
        }
      } else {
        // button
        if (!el.hasAttribute('data-href')) {
          setLinkAttributes(el, slug);
        }
      }
    });
  }

  // Fix existing nodes in the blog grid
  document.querySelectorAll('.blog-card, .blog-card *').forEach(fixNode);

  // Click handler for any dynamically added empty links or buttons
  document.addEventListener('click', e => {
    const tgt = e.target.closest('a, button');
    if (!tgt) return;

    const card = tgt.closest('.blog-card');
    const slug = card?.dataset.slug || (card?.dataset.title && slugify(card.dataset.title));
    if (!slug) return;

    if (tgt.tagName === 'A') {
      const href = tgt.getAttribute('href');
      if (!href || href === '#') {
        e.preventDefault();
        location.assign(`post.html?slug=${encodeURIComponent(slug)}`);
      }
      // otherwise let default anchor behavior occur
    } else if (tgt.tagName === 'BUTTON') {
      const dataHref = tgt.getAttribute('data-href');
      if (!dataHref) {
        e.preventDefault();
        location.assign(`post.html?slug=${encodeURIComponent(slug)}`);
      } else {
        // if data-href exists, navigate there
        e.preventDefault();
        location.assign(dataHref);
      }
    }
  });

  // Observe future additions to fix placeholders automatically
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(n => {
        if (n instanceof Element) {
          // fix the node itself and its descendants
          fixNode(n);
          n.querySelectorAll?.('.blog-card, .blog-card *')?.forEach(fixNode);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Read more button toggles inside DOMContentLoaded to avoid running before elements exist
  document.querySelectorAll('.read-more-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      if (!targetId) return;
      const content = document.getElementById(targetId);
      if (!content) return;

      const isShown = content.classList.contains('show');
      if (isShown) {
        content.classList.remove('show');
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = 'Read More →';
      } else {
        content.classList.add('show');
        btn.setAttribute('aria-expanded', 'true');
        btn.textContent = 'Read Less →';
      }
    });
  });
});

