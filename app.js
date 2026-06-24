/* ═══════════════════════════════════════════════════════════
   js/app.js
   Global utilities: Toast, Modal, Helpers, Navigation
   ═══════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

let _toastContainer = null;

function getToastContainer() {
  if (!_toastContainer) {
    _toastContainer         = document.createElement("div");
    _toastContainer.id      = "toast-container";
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {"success"|"error"|"info"} type
 * @param {number} duration  - ms before auto-dismiss (0 = permanent)
 */
window.showToast = function(message, type = "info", duration = 4000) {
  const container = getToastContainer();
  const icons     = { success: "✓", error: "✕", info: "i" };

  const toast         = document.createElement("div");
  toast.className     = `toast toast--${type}`;
  toast.innerHTML     = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
  `;
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => toast.style.opacity = "0", duration - 300);
    setTimeout(() => toast.remove(), duration);
  }

  return toast;
};

// ═══════════════════════════════════════════════════════════
// MODAL HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Open a modal by its overlay ID.
 */
window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("open");
};

/**
 * Close a modal by its overlay ID.
 */
window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
};

/**
 * Close modal when clicking the backdrop.
 */
document.addEventListener("click", function(e) {
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("open");
  }
});

/**
 * Close modal on Escape key.
 */
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.open")
      .forEach(el => el.classList.remove("open"));
  }
});

// ═══════════════════════════════════════════════════════════
// LOADING STATES
// ═══════════════════════════════════════════════════════════

/**
 * Set a button's loading state.
 */
window.setLoading = function(btn, loading, originalText) {
  if (loading) {
    btn.disabled             = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML            = `<span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite"></span>`;
  } else {
    btn.disabled   = false;
    btn.textContent = originalText || btn.dataset.originalText || btn.textContent;
  }
};

// ═══════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════

// Navbar scroll effect
const nav = document.querySelector(".nav");
if (nav) {
  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 40);
  }, { passive: true });
}

// Mobile menu toggle
const mobileToggle = document.querySelector(".nav__mobile-toggle");
const mobileMenu   = document.querySelector(".nav__links");
if (mobileToggle && mobileMenu) {
  mobileToggle.addEventListener("click", () => {
    const open = mobileMenu.style.display === "flex";
    mobileMenu.style.display  = open ? "" : "flex";
    mobileMenu.style.flexDirection = "column";
    mobileMenu.style.position = open ? "" : "absolute";
    mobileMenu.style.top      = open ? "" : "var(--nav-h)";
    mobileMenu.style.left     = open ? "" : "0";
    mobileMenu.style.right    = open ? "" : "0";
    mobileMenu.style.background = open ? "" : "var(--surface-1)";
    mobileMenu.style.padding  = open ? "" : "1rem";
    mobileMenu.style.borderBottom = open ? "" : "1px solid var(--border)";
  });
}

// Sidebar mobile toggle
const sidebarToggle = document.querySelector(".sidebar-toggle");
const sidebar       = document.querySelector(".sidebar");
if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function(e) {
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

// ═══════════════════════════════════════════════════════════
// CLIPBOARD
// ═══════════════════════════════════════════════════════════

/**
 * Copy text to clipboard and show a toast.
 */
window.copyToClipboard = async function(text, message = "Copied!") {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message, "success", 2000);
  } catch {
    // Fallback
    const el       = document.createElement("textarea");
    el.value       = text;
    el.style.position = "fixed";
    el.style.opacity  = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    showToast(message, "success", 2000);
  }
};

// ═══════════════════════════════════════════════════════════
// FORM HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Validate a URL string.
 */
window.isValidUrl = function(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
};

/**
 * Normalize a URL (adds https:// if missing).
 */
window.normalizeUrl = function(url) {
  if (!url) return "";
  return url.startsWith("http") ? url : `https://${url}`;
};

/**
 * Validate a username.
 */
window.isValidUsername = function(username) {
  return /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(username) ||
         /^[a-z0-9]{2,30}$/.test(username);
};

/**
 * Format a number with K/M suffixes.
 */
window.formatNumber = function(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
};

/**
 * Format a date to a human-readable string.
 */
window.formatDate = function(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric"
  }).format(date instanceof Date ? date : date.toDate());
};

/**
 * Debounce a function.
 */
window.debounce = function(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Get a URL search parameter.
 */
window.getParam = function(key) {
  return new URLSearchParams(window.location.search).get(key);
};

// ═══════════════════════════════════════════════════════════
// COLOR UTILITIES (for theme customization)
// ═══════════════════════════════════════════════════════════

/**
 * Check if a hex color has sufficient contrast against another.
 * Returns true if contrast ratio >= 4.5 (WCAG AA).
 */
window.hasSufficientContrast = function(hex1, hex2) {
  const lum = (hex) => {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16) / 255;
    const g = parseInt(c.slice(2, 4), 16) / 255;
    const b = parseInt(c.slice(4, 6), 16) / 255;
    const toLinear = v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };
  const l1    = lum(hex1);
  const l2    = lum(hex2);
  const light = Math.max(l1, l2);
  const dark  = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05) >= 4.5;
};

/**
 * Determine if a color is "dark" (to choose white or dark text).
 */
window.isColorDark = function(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Perceived luminance
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
};

// ═══════════════════════════════════════════════════════════
// DRAG & DROP (for link reordering)
// ═══════════════════════════════════════════════════════════

/**
 * Initialize drag-and-drop on a sortable list.
 * @param {string} listId         - ID of the list container
 * @param {Function} onReorder    - Callback with new ordered IDs
 */
window.initSortable = function(listId, onReorder) {
  const list = document.getElementById(listId);
  if (!list) return;

  let dragSrc = null;

  list.querySelectorAll("[data-draggable]").forEach(item => {
    item.setAttribute("draggable", "true");

    item.addEventListener("dragstart", function(e) {
      dragSrc = this;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "");
      this.style.opacity = "0.4";
    });

    item.addEventListener("dragend", function() {
      this.style.opacity = "";
      list.querySelectorAll("[data-draggable]").forEach(i => i.classList.remove("drag-over"));
    });

    item.addEventListener("dragover", function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      return false;
    });

    item.addEventListener("dragenter", function() {
      if (this !== dragSrc) this.classList.add("drag-over");
    });

    item.addEventListener("dragleave", function() {
      this.classList.remove("drag-over");
    });

    item.addEventListener("drop", function(e) {
      e.stopPropagation();
      e.preventDefault();
      if (this !== dragSrc) {
        const items      = [...list.querySelectorAll("[data-draggable]")];
        const srcIndex   = items.indexOf(dragSrc);
        const destIndex  = items.indexOf(this);
        if (srcIndex > destIndex) {
          list.insertBefore(dragSrc, this);
        } else {
          list.insertBefore(dragSrc, this.nextSibling);
        }
        // Collect new order
        const newOrder = [...list.querySelectorAll("[data-draggable]")]
          .map(el => el.dataset.id);
        onReorder(newOrder);
      }
      return false;
    });
  });
};

// ═══════════════════════════════════════════════════════════
// PREFETCH & PERFORMANCE
// ═══════════════════════════════════════════════════════════

// Prefetch links on hover for instant navigation
document.querySelectorAll("a[data-prefetch]").forEach(link => {
  link.addEventListener("mouseenter", () => {
    const rel  = document.createElement("link");
    rel.rel    = "prefetch";
    rel.href   = link.href;
    document.head.appendChild(rel);
  }, { once: true });
});

// ═══════════════════════════════════════════════════════════
// ANNOUNCE PAGE READY
// ═══════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("loaded");
});
