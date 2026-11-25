/* ============================================================
   app.js — The "brain" of the website.
   It reads the data from data.js, content.js and translations.js
   and builds the page. Sections:
     1. Helpers             6. Map
     2. Language/Theme/A11y 7. Nearby & Location Share
     3. Cards               8. Search
     4. Contacts            9. Motion, Toast & Tutorial
     5. Categories & Prep  10. Start-up
   ============================================================ */
"use strict";

/* ---------------- 1. HELPERS ---------------- */

// Short names for finding things on the page
const $  = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

// Crisp SF-style inline SVG icons for UI chrome (semantic domain icons stay untouched)
const svgIcon = paths =>
  `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICON_PHONE = svgIcon('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>');
const ICON_MAIL = svgIcon('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>');
const ICON_MOON = svgIcon('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>');
const ICON_SUN = svgIcon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>');
const ICON_PIN = svgIcon('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>');
const ICON_MAP = svgIcon('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>');
const ICON_RULER = svgIcon('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>');
const ICON_INFO = svgIcon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>');
const ICON_CHECK = svgIcon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>');
const ICON_ALERT = svgIcon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>');
const ICON_SEARCH = svgIcon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>');
const ICON_GLOBE = svgIcon('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>');

// Makes text safe to put inside HTML (stops accidental HTML injection)
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

// Save and load small settings in the browser
function savePref(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
function loadPref(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; } }

// Placeholder email for reporting wrong/outdated numbers — replace with your own email address
const REPORT_EMAIL = "YOUR-EMAIL@example.com";

// Turns "(032) 383-1658" or "383-1658" into "+63323831658" and "09274012389" into "+639274012389".
// Short hotline numbers like 911 stay as they are.
function toDial(display) {
  const digits = String(display || "").replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  if (digits.length === 7) return "+6332" + digits;
  if (digits.startsWith("0")) return "+63" + digits.slice(1);
  return digits;
}

// Distance between two GPS points in kilometers (Haversine formula)
function distanceKm(a, b) {
  const R = 6371;
  const rad = deg => deg * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function hasCoords(place) {
  return typeof place.lat === "number" && typeof place.lng === "number";
}

// Look up a contact quickly by its id
const CONTACT_BY_ID = {};
CONTACTS.forEach(c => { CONTACT_BY_ID[c.id] = c; });

/* ---------------- 2. LANGUAGE, THEME & ACCESSIBILITY ---------------- */

const state = {
  lang: TRANSLATIONS[loadPref("lang", "en")] ? loadPref("lang", "en") : "en",
  theme: document.documentElement.getAttribute("data-theme") || "light",
  textSize: loadPref("textSize", "normal"),
  contrast: loadPref("contrast", "normal"),
  category: "medical",
  mapTypes: new Set(Object.keys(FACILITY_TYPES)),
  nearbyOrigin: "labogon",
  nearbyType: "all",
  userPos: null,
  nearbyMessageKey: "",
  tutorialStep: 0
};

// t("key") returns the text in the chosen language
function t(key, vars) {
  const table = TRANSLATIONS[state.lang] || {};
  let text = table[key] ?? TRANSLATIONS.en[key] ?? key;
  if (vars) Object.keys(vars).forEach(k => { text = text.replace("{" + k + "}", vars[k]); });
  return text;
}

// Fill every element that has data-i18n="..." with translated text
function applyStaticText() {
  document.documentElement.lang = state.lang;
  $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $$("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  const langSelect = $("#lang-select");
  if (langSelect) langSelect.value = state.lang;
  updateThemeButton();
  updateA11yControls();
  const badge = $("#offline-ready-badge");
  if (badge) updateOfflineReadyBadge();
  updateDynamicIslandStatus();
  const lastReviewed = $("#last-reviewed");
  if (lastReviewed && typeof DATA_META !== "undefined") {
    lastReviewed.textContent = DATA_META.lastReviewed;
  }
}

function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  state.lang = lang;
  savePref("lang", lang);
  renderAll();
}

function updateThemeButton() {
  const btn = $("#theme-toggle");
  if (!btn) return;
  const isDark = state.theme === "dark";
  btn.innerHTML = `${isDark ? ICON_SUN : ICON_MOON} <span>${esc(isDark ? t("theme_to_light") : t("theme_to_dark"))}</span>`;
  btn.setAttribute("aria-pressed", String(isDark));
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", state.theme);
  savePref("theme", state.theme);
  updateThemeButton();
  if (window.LabogonMaps && typeof window.LabogonMaps.setTheme === "function") {
    window.LabogonMaps.setTheme(state.theme);
  }
}

function applyTextSize(size) {
  if (size !== "normal" && size !== "large" && size !== "xlarge") size = "normal";
  state.textSize = size;
  document.documentElement.setAttribute("data-text-size", size);
  savePref("textSize", size);
  updateA11yControls();
}

function toggleContrast() {
  state.contrast = state.contrast === "high" ? "normal" : "high";
  document.documentElement.setAttribute("data-contrast", state.contrast);
  savePref("contrast", state.contrast);
  updateA11yControls();
}

function updateA11yControls() {
  $$("[data-text-size]").forEach(btn => {
    btn.setAttribute("aria-pressed", String(btn.dataset.textSize === state.textSize));
  });
  const contrastBtn = $("#contrast-toggle");
  if (contrastBtn) {
    const isHigh = state.contrast === "high";
    contrastBtn.setAttribute("aria-pressed", String(isHigh));
  }
}

/* ---------------- 3. CARDS (reusable pieces) ---------------- */

function statusBadge(status) {
  return `<span class="badge badge-${esc(status)}">${esc(t("status_" + status))}</span>`;
}

function callButton(contact, small, extraClass = "") {
  const label = `${t("call")} ${contact.name} ${contact.number}`;
  const is911 = contact.number.replace(/\D/g, "") === "911";
  const pulse = is911 ? " btn-call-pulse" : "";
  return `<a class="btn btn-call ${small ? "btn-small" : ""}${pulse}${extraClass}" href="tel:${toDial(contact.number)}"
             aria-label="${esc(label)}">${ICON_PHONE} <span>${esc(t("call"))}</span></a>`;
}

// Build mailto: link for reporting wrong or outdated contact numbers
function reportMailtoLink(contact) {
  const today = new Date().toISOString().slice(0, 10);
  const subject = encodeURIComponent(t("report_mail_subject", { name: contact.name }));
  const body = encodeURIComponent(
    t("report_mail_body", {
      name: contact.name,
      number: contact.number,
      date: today
    })
  );
  return `mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`;
}

// Big card for one contact (used in the contacts list and in search)
function contactCard(c) {
  return `
    <article class="card contact-card status-${esc(c.status)}">
      <div class="contact-top">
        <h4>${esc(c.name)}</h4>
        ${statusBadge(c.status)}
      </div>
      <p class="number">${esc(c.number)}</p>
      ${callButton(c, false)}
      <a class="report-link" href="${esc(reportMailtoLink(c))}">
        ${ICON_MAIL} <span>${esc(t("report_number_btn"))}</span>
      </a>
    </article>`;
}

// Small row: contact name + status + call button (used inside place cards)
function miniContact(c) {
  return `
    <div class="mini-contact">
      <span class="who">${esc(c.name)} ${statusBadge(c.status)}<br><strong>${esc(c.number)}</strong></span>
      ${callButton(c, true)}
    </div>`;
}

function mapsLink(place) {
  const query = hasCoords(place)
    ? `${place.lat},${place.lng}`
    : encodeURIComponent(`${place.name} Mandaue City Cebu`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

// Card for one place (hospital, fire station, etc.)
function facilityCard(f, distance) {
  const type = FACILITY_TYPES[f.type];
  const contacts = f.contactIds.map(id => CONTACT_BY_ID[id]).filter(Boolean);
  const resolved = resolvedFacilityMap[f.id];
  const effectiveLatLng = hasCoords(f) ? { lat: f.lat, lng: f.lng } : resolved;
  const effectiveDist = typeof distance === "number"
    ? distance
    : (effectiveLatLng ? distanceKm(state.userPos || MAP_CENTER, effectiveLatLng) : null);

  let distanceLine = "";
  if (typeof effectiveDist === "number") {
    distanceLine = `<p class="distance">${ICON_RULER} <span>${esc(t("km_away", { d: effectiveDist.toFixed(1) }))}</span></p>`;
  } else {
    distanceLine = `<p class="facility-meta">${esc(t("dist_unknown"))}</p>`;
  }

  const isPinned = Boolean(hasCoords(f) || resolved);
  const displayAddress = f.address || (resolved && resolved.address) || null;
  const mapHref = (resolved && resolved.googleMapsURI) || mapsLink(f);

  const contactsHtml = contacts.length
    ? `<div class="facility-contacts">${contacts.map(miniContact).join("")}</div>`
    : "";

  return `
    <article class="card facility-card">
      <h4><span aria-hidden="true">${type.icon}</span> ${esc(f.name)}</h4>
      <p class="facility-meta">${esc(t("type_" + f.type))} · ${esc(t("scope_" + f.scope))}</p>
      <p class="facility-meta">${ICON_PIN} <span>${displayAddress ? esc(displayAddress) : esc(t("no_address"))}</span></p>
      ${distanceLine}
      ${isPinned ? `<p class="facility-meta">${ICON_MAP} <span>${esc(t("coords_on_map"))}</span></p>` : `<p class="facility-meta">${ICON_INFO} <span>${esc(t("coords_pending"))}</span></p>`}
      ${contactsHtml}
      <a class="btn btn-outline btn-small" href="${esc(mapHref)}" target="_blank" rel="noopener noreferrer">
        ${ICON_MAP} <span>${esc(t("open_maps"))}</span></a>
    </article>`;
}

/* ---------------- 4. CONTACTS ---------------- */

function renderQuickCalls() {
  const container = $("#quick-calls");
  if (!container) return;
  const ids = ["nat-911", "labogon-ert-globe-1", "labogon-ert-suntnt-1"];
  container.innerHTML = ids.map(id => {
    const c = CONTACT_BY_ID[id];
    if (!c) return "";
    const is911 = c.number.replace(/\D/g, "") === "911";
    const pulseClass = is911 ? " btn-call-pulse" : "";
    const subLabel = is911 ? "National" : `Labogon ERT · ${c.typeLabel || ""}`;
    return `<a class="btn btn-call quick-call-btn${pulseClass}" href="tel:${toDial(c.number)}"
               aria-label="${esc(t("call") + " " + c.name + " " + c.number)}">
               <span class="quick-call-top">${ICON_PHONE} <span>${esc(c.number)}</span></span>
               <span class="quick-call-sub">${esc(subLabel)}</span>
            </a>`;
  }).join("");
}

function renderLegend() {
  const legendEl = $("#legend");
  const hasUnverified = CONTACTS.some(c => c.status === "unverified" || c.status === "needs_confirmation");
  const statuses = hasUnverified
    ? ["official", "credible", "needs_confirmation", "unverified"]
    : ["official"];
  if (legendEl) legendEl.innerHTML = statuses.map(statusBadge).join("");

  const banner = $("#unverified-banner");
  if (banner) banner.hidden = !hasUnverified;
}

function hotlineTile(c) {
  const typeText = c.typeLabel || c.name;
  return `
    <div class="hotline-tile">
      <div class="hotline-info">
        <span class="hotline-type">${esc(typeText)}</span>
        <p class="hotline-number">${esc(c.number)}</p>
      </div>
      <div class="hotline-actions">
        ${callButton(c, true)}
        <a class="report-link" href="${esc(reportMailtoLink(c))}">
          ${ICON_MAIL} <span>${esc(t("report_number_btn"))}</span>
        </a>
      </div>
    </div>`;
}

function agencyCard(agency, list) {
  const count = list.length;
  const colsClass = count === 1
    ? "cols-1"
    : count === 3
      ? "cols-3"
      : count === 4
        ? "cols-4"
        : count >= 5
          ? "cols-5"
          : "cols-2";
  const contactLine = agency.contactPerson
    ? `<p class="agency-contact">${esc(agency.contactPerson)}</p>`
    : "";
  return `
    <article class="card agency-card">
      <div class="agency-head">
        <div class="agency-title-wrap">
          <span class="agency-num" aria-hidden="true">${esc(agency.order)}</span>
          <div class="agency-headings">
            <h3 class="agency-title">${esc(agency.name)}</h3>
            ${contactLine}
          </div>
        </div>
        ${statusBadge(agency.status || "official")}
      </div>
      <div class="agency-rows ${colsClass}">
        ${list.map(hotlineTile).join("")}
      </div>
    </article>`;
}

function renderContacts() {
  const listEl = $("#contacts-list");
  if (!listEl) return;

  if (typeof AGENCIES !== "undefined" && Array.isArray(AGENCIES)) {
    const html = AGENCIES.map(agency => {
      const list = CONTACTS.filter(c => c.agencyId === agency.id);
      return list.length ? agencyCard(agency, list) : "";
    }).join("");
    listEl.innerHTML = html ? `<div class="agency-stack">${html}</div>` : `<p>${esc(t("no_contacts"))}</p>`;
  } else {
    let html = "";
    ["labogon", "city", "national"].forEach(group => {
      const list = CONTACTS.filter(c => c.group === group);
      if (list.length === 0) return;
      html += `<h3 class="group-title">${esc(t("group_" + group))}</h3>
               <div class="card-grid">${list.map(contactCard).join("")}</div>`;
    });
    listEl.innerHTML = html || `<p>${esc(t("no_contacts"))}</p>`;
  }
  observeReveals("#contacts-list");
}

/* ---------------- 5. EMERGENCY CATEGORIES, GO-BAG & FIRST-AID ---------------- */

function renderCategories(shouldAnimatePanel = false) {
  const gridEl = $("#category-grid");
  if (!gridEl) return;
  gridEl.innerHTML = CATEGORIES.map(cat => `
    <button class="category-btn" type="button" data-cat="${esc(cat.id)}"
            aria-pressed="${state.category === cat.id}">
      <span class="icon" aria-hidden="true">${cat.icon}</span>
      <span>${esc(t("cat_" + cat.id))}</span>
    </button>`).join("");

  $$("#category-grid .category-btn").forEach(btn => {
    btn.addEventListener("click", () => selectCategory(btn.dataset.cat));
  });
  observeReveals("#category-grid");
  renderCategoryPanel(shouldAnimatePanel);
}

function selectCategory(id) {
  state.category = id;
  renderCategories(true);
}

function renderCategoryPanel(animate = false) {
  const panel = $("#category-panel");
  if (!panel) return;
  const cat = CATEGORIES.find(c => c.id === state.category);

  if (!cat) {
    panel.innerHTML = `<p>${esc(t("select_category"))}</p>`;
    return;
  }

  const steps = cat.steps[state.lang] || cat.steps.en;
  const donts = (cat.donts && (cat.donts[state.lang] || cat.donts.en)) || [];
  const contacts = cat.contactIds.map(id => CONTACT_BY_ID[id]).filter(Boolean);

  const stepsHtml = steps.map((step, idx) => {
    const title = typeof step === "string" ? "" : step.title;
    const detail = typeof step === "string" ? step : step.detail;
    return `
      <li class="step-item" style="animation-delay: ${Math.min(idx, 6) * 40}ms">
        <div class="step-marker" aria-hidden="true">${idx + 1}</div>
        <div class="step-body">
          <span class="step-kicker">${esc(t("step_badge", { n: idx + 1 }))}</span>
          ${title ? `<strong class="step-title">${esc(title)}</strong>` : ""}
          <p class="step-detail">${esc(detail)}</p>
        </div>
      </li>`;
  }).join("");

  const dontsHtml = donts.length ? `
    <div class="donts-box" role="note">
      <h4>${ICON_ALERT} <span>${esc(t("donts_title"))}</span></h4>
      <ul class="donts-list">
        ${donts.map(item => `<li>${esc(item)}</li>`).join("")}
      </ul>
    </div>` : "";

  panel.innerHTML = `
    <h3>${cat.icon} ${esc(t("cat_" + cat.id))}</h3>
    <h4 class="panel-subhead">${esc(t("steps_title"))}</h4>
    <ol class="step-list">${stepsHtml}</ol>
    ${dontsHtml}
    <h4 class="panel-subhead">${esc(t("who_to_call"))}</h4>
    <div class="call-row">${contacts.map(miniContact).join("")}</div>`;

  if (animate) {
    panel.classList.remove("is-animating");
    void panel.offsetWidth;
    panel.classList.add("is-animating");
  }
}

// Load saved Go-Bag checked item IDs from localStorage
function loadGoBagState() {
  try {
    const raw = localStorage.getItem("gobag_checked");
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    return new Set();
  }
}

function saveGoBagState(checkedSet) {
  savePref("gobag_checked", JSON.stringify(Array.from(checkedSet)));
}

function renderGoBag() {
  const listEl = $("#gobag-list");
  const progressEl = $("#gobag-progress");
  if (!listEl || typeof GO_BAG_ITEMS === "undefined") return;

  const checkedSet = loadGoBagState();

  listEl.innerHTML = GO_BAG_ITEMS.map(item => {
    const checked = checkedSet.has(item.id);
    const label = item.label[state.lang] || item.label.en;
    return `
      <li>
        <label class="gobag-label${checked ? " is-checked" : ""}">
          <input type="checkbox" data-gobag-id="${esc(item.id)}" ${checked ? "checked" : ""} />
          <span>${esc(label)}</span>
        </label>
      </li>`;
  }).join("");

  const updateProgress = () => {
    if (progressEl) {
      progressEl.textContent = t("gobag_progress", {
        done: checkedSet.size,
        total: GO_BAG_ITEMS.length
      });
    }
  };
  updateProgress();

  $$("input[data-gobag-id]", listEl).forEach(cb => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.gobagId;
      if (cb.checked) checkedSet.add(id);
      else checkedSet.delete(id);
      cb.closest(".gobag-label")?.classList.toggle("is-checked", cb.checked);
      saveGoBagState(checkedSet);
      updateProgress();
    });
  });
}

function renderFirstAid() {
  const gridEl = $("#firstaid-grid");
  if (!gridEl || typeof FIRST_AID_CARDS === "undefined") return;

  gridEl.innerHTML = FIRST_AID_CARDS.map(card => {
    const title = card.title[state.lang] || card.title.en;
    const steps = card.steps[state.lang] || card.steps.en;
    return `
      <article class="card firstaid-card">
        <h4><span aria-hidden="true">${card.icon}</span> ${esc(title)}</h4>
        <ol class="firstaid-steps">
          ${steps.map(s => `<li>${esc(s)}</li>`).join("")}
        </ol>
        <p class="firstaid-disclaimer">${esc(t("firstaid_disclaimer"))}</p>
      </article>`;
  }).join("");

  observeReveals("#preparedness");
}

/* ---------------- 6. MAP ---------------- */

let mapInitialized = false;
let resolvedFacilityMap = {};

// Strict lookup rules for ONLY the verified facilities in data.js.
// Places with conflicting/unconfirmed base locations (e.g., ERUF, Red Cross) are omitted from auto-pinning.
const VERIFIED_FACILITY_RULES = {
  "fac-labogon-hall": {
    searchQuery: "Barangay Labogon Hall, Labogon, Mandaue City, Cebu",
    matchAll: ["labogon"]
  },
  "fac-labogon-health": {
    searchQuery: "Labogon Health Center, Mandaue City, Cebu",
    matchAll: ["labogon", "health"]
  },
  "fac-labogon-gym": {
    searchQuery: "Barangay Labogon Gymnasium, Mandaue City, Cebu",
    matchAll: ["labogon"],
    matchAny: ["gym", "gymnasium", "sports", "barangay"]
  },
  "fac-fire": {
    searchQuery: "Mandaue City Fire Station, Centro, Mandaue City, Cebu",
    matchAll: ["mandaue"],
    matchAny: ["fire", "bfp"]
  },
  "fac-police": {
    searchQuery: "Mandaue City Police Office, Mandaue City, Cebu",
    matchAll: ["mandaue", "police"]
  },
  "fac-mch": {
    searchQuery: "Mandaue City Hospital, Mandaue City, Cebu",
    matchAll: ["mandaue", "hospital"],
    exclude: ["chong hua", "eversley", "ucmed"]
  },
  "fac-chonghua": {
    searchQuery: "Chong Hua Hospital Mandaue, Mantawi International Drive, Mandaue City",
    matchAll: ["chong hua"]
  },
  "fac-command": {
    searchQuery: "Bantay Mandaue Command Center, Mandaue City Hall, Mandaue City",
    matchAll: ["mandaue"],
    matchAny: ["command", "bantay", "drrmo", "cdrr", "city hall"]
  }
};

function buildVerifiedFacilityLookups() {
  return FACILITIES
    .filter(f => Boolean(VERIFIED_FACILITY_RULES[f.id]))
    .map(f => {
      const rule = VERIFIED_FACILITY_RULES[f.id];
      return {
        id: f.id,
        name: f.name,
        category: f.type,
        typeLabel: `${t("type_" + f.type)} · ${t("scope_" + f.scope)}`,
        address: f.address,
        searchQuery: rule.searchQuery,
        matchAll: rule.matchAll,
        matchAny: rule.matchAny,
        exclude: rule.exclude,
        mapsUrl: mapsLink(f)
      };
    });
}

function renderMapAttributions(places) {
  const attrEl = $("#map-attributions");
  if (!attrEl) return;
  const seen = new Set();
  const items = [];
  (places || []).forEach(p => {
    (p.attributions || []).forEach(a => {
      if (!a || !a.provider) return;
      const key = `${a.provider}|${a.providerURI || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push(a);
    });
  });
  if (!items.length) {
    attrEl.hidden = true;
    attrEl.innerHTML = "";
    return;
  }
  attrEl.innerHTML = items.map(a =>
    a.providerURI
      ? `<a href="${esc(a.providerURI)}" target="_blank" rel="noopener noreferrer">${esc(a.provider)}</a>`
      : `<span>${esc(a.provider)}</span>`
  ).join(" · ");
  attrEl.hidden = false;
}

function initMap() {
  if (mapInitialized) return;
  if (!window.LabogonMaps || typeof window.LabogonMaps.initGoogleMap !== "function") {
    window.addEventListener("labogon-maps-ready", initMap, { once: true });
    return;
  }
  mapInitialized = true;

  window.LabogonMaps.initGoogleMap({
    containerId: "map",
    center: MAP_CENTER,
    centerLabel: t("map_center_label"),
    theme: state.theme,
    language: state.lang,
    openMapsLabel: t("open_maps"),
    verifiedFacilities: buildVerifiedFacilityLookups(),
    onVerifiedPlacesResolved: places => {
      const nextMap = {};
      (places || []).forEach(p => { nextMap[p.id] = p; });
      resolvedFacilityMap = nextMap;
      renderMapAttributions(places);
      renderFacilityList();
      renderNearby();
    },
    onError: () => {
      const mapEl = $("#map");
      const fbEl = $("#map-fallback");
      if (mapEl) mapEl.hidden = true;
      if (fbEl) fbEl.hidden = false;
    }
  });
}

function renderMapFilters() {
  const filtersEl = $("#map-filters");
  if (!filtersEl) return;
  filtersEl.innerHTML = Object.keys(FACILITY_TYPES).map(type => `
    <button class="chip" type="button" data-type="${esc(type)}"
            aria-pressed="${state.mapTypes.has(type)}">
      ${FACILITY_TYPES[type].icon} ${esc(t("type_" + type))}
    </button>`).join("");

  $$("#map-filters .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const type = chip.dataset.type;
      if (state.mapTypes.has(type)) state.mapTypes.delete(type); else state.mapTypes.add(type);
      renderMapFilters();
      renderMapMarkers();
      renderFacilityList();
    });
  });
}

function renderMapMarkers() {
  if (window.LabogonMaps && typeof window.LabogonMaps.setActiveTypes === "function") {
    window.LabogonMaps.setActiveTypes(Array.from(state.mapTypes));
  }
}

function renderFacilityList() {
  const listEl = $("#facility-list");
  if (!listEl) return;
  const list = FACILITIES.filter(f => state.mapTypes.has(f.type));
  listEl.innerHTML = list.length
    ? list.map(f => facilityCard(f)).join("")
    : `<p>${esc(t("nearby_none"))}</p>`;
  observeReveals("#facility-list");
}

// Ask the browser for the user's GPS position
function getUserLocation(onSuccess, onFail) {
  if (!("geolocation" in navigator)) { onFail("gps_unsupported"); return; }
  navigator.geolocation.getCurrentPosition(
    pos => onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => onFail("gps_denied"),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function showMyLocationOnMap() {
  const statusEl = $("#map-status");
  if (statusEl) statusEl.textContent = t("gps_asking");
  getUserLocation(pos => {
    state.userPos = pos;
    if (statusEl) statusEl.textContent = "";
    if (window.LabogonMaps && typeof window.LabogonMaps.showUserLocation === "function") {
      window.LabogonMaps.showUserLocation(pos, t("you_are_here"));
    }
    updateShareLocationUI();
    renderFacilityList();
    renderNearby();
  }, key => {
    if (statusEl) statusEl.textContent = t(key);
  });
}

/* ---------------- 7. NEARBY ASSISTANCE & SHARE MY LOCATION ---------------- */

function buildLocationShareMessage(pos) {
  const url = `https://maps.google.com/?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
  return {
    url,
    message: t("share_loc_msg", { url })
  };
}

function updateShareLocationUI() {
  const actionsEl = $("#share-loc-actions");
  const smsLink = $("#share-sms-link");
  const previewLink = $("#share-map-preview");
  const statusEl = $("#share-loc-status");
  if (!actionsEl || !state.userPos) return;

  const { url, message } = buildLocationShareMessage(state.userPos);
  if (smsLink) smsLink.href = `sms:?body=${encodeURIComponent(message)}`;
  if (previewLink) {
    previewLink.href = url;
    previewLink.textContent = url;
  }
  if (statusEl) statusEl.textContent = t("share_loc_ready");
  actionsEl.hidden = false;
  pulseDynamicIsland(t("share_loc_ready"));
}

function requestShareLocation() {
  const statusEl = $("#share-loc-status");
  if (statusEl) statusEl.textContent = t("gps_asking");
  getUserLocation(pos => {
    state.userPos = pos;
    updateShareLocationUI();
    renderFacilityList();
    renderNearby();
  }, failKey => {
    if (statusEl) statusEl.textContent = t(failKey);
  });
}

async function copyShareLocation() {
  if (!state.userPos) return;
  const { message } = buildLocationShareMessage(state.userPos);
  const ok = await copyText(message);
  if (ok) showToast(t("copied_toast"));
}

function renderNearbyTypeOptions() {
  const select = $("#nearby-type");
  if (!select) return;
  const options = [`<option value="all">${esc(t("all_types"))}</option>`]
    .concat(Object.keys(FACILITY_TYPES).map(type =>
      `<option value="${esc(type)}">${FACILITY_TYPES[type].icon} ${esc(t("type_" + type))}</option>`));
  select.innerHTML = options.join("");
  select.value = state.nearbyType;
}

function renderNearby() {
  const statusEl = $("#nearby-status");
  const listEl = $("#nearby-list");
  if (!listEl) return;

  const usingGps = state.nearbyOrigin === "gps" && state.userPos;
  const origin = usingGps ? state.userPos : MAP_CENTER;
  const scopeRank = f => (f.scope === "labogon" ? 0 : 1);

  const rows = FACILITIES
    .filter(f => state.nearbyType === "all" || f.type === state.nearbyType)
    .map(f => {
      const coords = hasCoords(f) ? f : resolvedFacilityMap[f.id];
      return { f, d: coords ? distanceKm(origin, coords) : null };
    });

  // Closest first. Places without coordinates go last (Labogon places before the rest of the city).
  rows.sort((a, b) => {
    if (a.d !== null && b.d !== null) return a.d - b.d;
    if (a.d !== null) return -1;
    if (b.d !== null) return 1;
    return scopeRank(a.f) - scopeRank(b.f) || a.f.name.localeCompare(b.f.name);
  });

  if (statusEl) statusEl.textContent = state.nearbyMessageKey ? t(state.nearbyMessageKey) : "";
  listEl.innerHTML = rows.length
    ? rows.map(r => facilityCard(r.f, r.d)).join("")
    : `<p>${esc(t("nearby_none"))}</p>`;
  observeReveals("#nearby-list");
}

function onNearbyOriginChange(value) {
  state.nearbyMessageKey = "";
  if (value === "gps") {
    state.nearbyMessageKey = "gps_asking";
    renderNearby();
    getUserLocation(pos => {
      state.userPos = pos;
      state.nearbyOrigin = "gps";
      state.nearbyMessageKey = "";
      updateShareLocationUI();
      renderNearby();
    }, failKey => {
      state.nearbyOrigin = "labogon";
      const originSel = $("#nearby-origin");
      if (originSel) originSel.value = "labogon";
      state.nearbyMessageKey = failKey;
      renderNearby();
    });
  } else {
    state.nearbyOrigin = "labogon";
    renderNearby();
  }
}

/* ---------------- 8. SEARCH ---------------- */

function runSearch() {
  const input = $("#search-input");
  const box = $("#search-results");
  const clearBtn = $("#search-clear");
  if (!input || !box) return;

  const query = input.value.trim().toLowerCase();
  if (clearBtn) clearBtn.hidden = query === "";

  if (query === "") { box.hidden = true; box.innerHTML = ""; return; }

  // Every word typed must appear somewhere in the text we search
  const words = query.split(/\s+/);
  const matches = text => words.every(w => text.toLowerCase().includes(w));

  const contactHits = CONTACTS.filter(c =>
    matches([c.name, c.number, c.number.replace(/\D/g, ""), t("group_" + c.group), t("status_" + c.status)].join(" ")));

  const placeHits = FACILITIES.filter(f =>
    matches([f.name, f.address || "", t("type_" + f.type), t("scope_" + f.scope)].join(" ")));

  const topicHits = CATEGORIES.filter(cat => {
    const stepsText = (cat.steps[state.lang] || cat.steps.en)
      .map(s => (typeof s === "string" ? s : `${s.title} ${s.detail}`))
      .join(" ");
    const dontsText = ((cat.donts && (cat.donts[state.lang] || cat.donts.en)) || []).join(" ");
    return matches([t("cat_" + cat.id), cat.keywords.join(" "), stepsText, dontsText].join(" "));
  });

  const total = contactHits.length + placeHits.length + topicHits.length;
  let html = `<p><strong>${esc(t("search_found", { n: total }))}</strong></p>`;

  if (total === 0) html = `<p>${esc(t("search_none"))}</p>`;

  if (topicHits.length) {
    html += `<h3>${esc(t("search_topics"))}</h3><div class="chips">` +
      topicHits.map(cat => `<button class="chip" type="button" data-open-cat="${esc(cat.id)}">
        ${cat.icon} ${esc(t("cat_" + cat.id))}</button>`).join("") + `</div>`;
  }
  if (contactHits.length) {
    html += `<h3>${esc(t("search_contacts"))}</h3><div class="card-grid">${contactHits.map(contactCard).join("")}</div>`;
  }
  if (placeHits.length) {
    html += `<h3>${esc(t("search_places"))}</h3><div class="card-grid">${placeHits.map(f => facilityCard(f)).join("")}</div>`;
  }

  box.innerHTML = html;
  box.hidden = false;

  // Clicking a topic chip opens that category and scrolls to it
  $$("[data-open-cat]", box).forEach(btn => {
    btn.addEventListener("click", () => {
      selectCategory(btn.dataset.openCat);
      const emerg = $("#emergencies");
      if (emerg) emerg.scrollIntoView();
    });
  });
}

/* ---------------- 9. MOTION, CLIPBOARD TOAST & TUTORIAL ---------------- */

const prefersReducedMotion = typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : { matches: false };

let toastTimer = null;

function showToast(message) {
  const toast = $("#copy-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  pulseDynamicIsland(message);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

let revealObserver = null;

function setupRevealObserver() {
  if (prefersReducedMotion.matches || typeof IntersectionObserver === "undefined") return;
  document.documentElement.classList.add("reveal-ready");
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -32px 0px", threshold: 0.05 });

  // Also observe main sections so they fade & slide in once on scroll
  $$("main section").forEach(sec => {
    if (sec.classList.contains("hero") || sec.classList.contains("search-section")) return;
    sec.classList.add("reveal-item");
    const rect = sec.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      sec.classList.add("is-visible");
    } else {
      revealObserver.observe(sec);
    }
  });
}

function observeReveals(rootSelector) {
  const root = $(rootSelector);
  if (!root) return;
  const targets = $$(".card, .category-btn, .group-title", root);
  targets.forEach((el, idx) => {
    el.classList.add("reveal-item");
    el.style.setProperty("--reveal-delay", `${Math.min(idx % 6, 5) * 45}ms`);
    if (!revealObserver) {
      el.classList.add("is-visible");
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      el.classList.add("is-visible");
    } else {
      revealObserver.observe(el);
    }
  });
}

function setupScrollEffects() {
  const header = $(".site-header");
  const progressBar = $("#scroll-progress-bar");
  const navLinks = $$(".main-nav a[href^='#'], #mobile-dock a[href^='#']");
  const sectionIds = Array.from(new Set(navLinks.map(a => a.getAttribute("href"))));
  const sections = sectionIds.map(href => $(href)).filter(Boolean);

  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);

    if (progressBar) {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const pct = scrollable > 0 ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)) : 0;
      progressBar.style.width = pct.toFixed(1) + "%";
    }

    const marker = window.scrollY + 180;
    let activeId = "";
    sections.forEach(sec => {
      if (sec.offsetTop <= marker) activeId = "#" + sec.id;
    });
    navLinks.forEach(a => a.classList.toggle("is-active", a.getAttribute("href") === activeId));
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

let islandPulseTimer = null;

function updateDynamicIslandStatus(customLabel) {
  const island = $("#dynamic-island");
  const statusEl = $("#island-status");
  if (!island || !statusEl) return;
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  island.classList.toggle("is-offline", !isOnline);
  if (customLabel) {
    statusEl.textContent = customLabel;
  } else {
    statusEl.textContent = isOnline ? t("island_ready") : t("island_offline");
  }
}

function pulseDynamicIsland(message) {
  const island = $("#dynamic-island");
  if (!island) return;
  updateDynamicIslandStatus(message);
  island.classList.add("is-pulse");
  if (islandPulseTimer) clearTimeout(islandPulseTimer);
  islandPulseTimer = setTimeout(() => {
    island.classList.remove("is-pulse");
    updateDynamicIslandStatus();
  }, 2400);
}

function setDynamicIslandExpanded(open) {
  const island = $("#dynamic-island");
  const toggleBtn = $("#island-toggle");
  const drawer = $("#island-drawer");
  if (!island || !toggleBtn || !drawer) return;
  island.classList.toggle("is-expanded", open);
  toggleBtn.setAttribute("aria-expanded", String(open));
  drawer.hidden = !open;
}

function setupDynamicIsland() {
  const island = $("#dynamic-island");
  const toggleBtn = $("#island-toggle");
  const drawer = $("#island-drawer");
  const shareBtn = $("#island-share-btn");
  if (!island || !toggleBtn || !drawer) return;

  toggleBtn.addEventListener("click", e => {
    e.stopPropagation();
    const isOpen = toggleBtn.getAttribute("aria-expanded") === "true";
    setDynamicIslandExpanded(!isOpen);
  });

  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      setDynamicIslandExpanded(false);
      const target = $("#share-location-box");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
      requestShareLocation();
    });
  }

  $$("a", drawer).forEach(link => {
    link.addEventListener("click", () => setDynamicIslandExpanded(false));
  });

  document.addEventListener("click", e => {
    if (!island.contains(e.target)) setDynamicIslandExpanded(false);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") setDynamicIslandExpanded(false);
  });
}

const TUTORIAL_STEPS = [
  {
    icon: ICON_PHONE,
    titleKey: "tut_1_title",
    descKey: "tut_1_desc",
    tipKey: "tut_1_tip",
    preview: () => `
      <span class="tutorial-mini-btn">${ICON_PHONE} <span>${esc(t("call"))} 911</span></span>
      <span class="tutorial-mini-chip">${ICON_PHONE} <span>09274012389</span></span>`
  },
  {
    icon: ICON_SEARCH,
    titleKey: "tut_2_title",
    descKey: "tut_2_desc",
    tipKey: "tut_2_tip",
    preview: () => `
      <span class="tutorial-mini-chip">🩺 ${esc(t("cat_medical"))}</span>
      <span class="tutorial-mini-chip">🔥 ${esc(t("cat_fire"))}</span>
      <span class="tutorial-mini-chip">🌊 ${esc(t("cat_flood"))}</span>`
  },
  {
    icon: ICON_MAP,
    titleKey: "tut_3_title",
    descKey: "tut_3_desc",
    tipKey: "tut_3_tip",
    preview: () => `
      <span class="tutorial-mini-chip">${ICON_PIN} <span>${esc(t("locate_me"))}</span></span>
      <span class="tutorial-mini-chip">${ICON_RULER} <span>${esc(t("km_away", { d: "0.8" }))}</span></span>`
  },
  {
    icon: ICON_MOON,
    titleKey: "tut_4_title",
    descKey: "tut_4_desc",
    tipKey: "tut_4_tip",
    preview: () => `
      <span class="tutorial-mini-chip">${ICON_GLOBE} <span>English · Bisaya · Tagalog</span></span>
      <span class="tutorial-mini-chip">${ICON_MOON} <span>${esc(t("theme_to_dark"))}</span></span>`
  }
];

let lastFocusedBeforeTutorial = null;

function renderTutorialStep(direction) {
  const modal = $("#tutorial-modal");
  if (!modal) return;
  const total = TUTORIAL_STEPS.length;
  const stepIndex = Math.max(0, Math.min(state.tutorialStep, total - 1));
  state.tutorialStep = stepIndex;
  const step = TUTORIAL_STEPS[stepIndex];

  const counterEl = $("#tutorial-step-counter");
  const progressBar = $("#tutorial-progress-bar");
  const stage = $("#tutorial-stage");
  const dotsEl = $("#tutorial-dots");
  const prevBtn = $("#tutorial-prev");
  const nextBtn = $("#tutorial-next");
  if (!stage || !dotsEl) return;

  if (counterEl) counterEl.textContent = t("tutorial_step_of", { n: stepIndex + 1, total });
  if (progressBar) progressBar.style.width = `${((stepIndex + 1) / total) * 100}%`;

  stage.innerHTML = `
    <div class="tutorial-visual" aria-hidden="true">
      <div class="tutorial-icon-badge">${step.icon}</div>
      <div class="tutorial-preview-pills">${step.preview()}</div>
    </div>
    <h3 class="tutorial-step-title">${esc(t(step.titleKey))}</h3>
    <p id="tutorial-desc" class="tutorial-step-desc">${esc(t(step.descKey))}</p>
    <p class="tutorial-tip">${esc(t(step.tipKey))}</p>`;

  stage.classList.remove("anim-next", "anim-prev");
  if (direction === "next" || direction === "prev") {
    void stage.offsetWidth;
    stage.classList.add(direction === "next" ? "anim-next" : "anim-prev");
  }

  dotsEl.innerHTML = TUTORIAL_STEPS.map((_, i) => `
    <button
      class="tutorial-dot"
      type="button"
      role="tab"
      aria-selected="${i === stepIndex}"
      aria-label="${esc(t("tutorial_step_of", { n: i + 1, total }))}"
      data-step="${i}"
    ></button>`).join("");

  $$(".tutorial-dot", dotsEl).forEach(dot => {
    dot.addEventListener("click", () => {
      const target = Number(dot.dataset.step);
      if (target === state.tutorialStep) return;
      goTutorialStep(target, target > state.tutorialStep ? "next" : "prev");
    });
  });

  if (prevBtn) prevBtn.hidden = stepIndex === 0;
  if (nextBtn) nextBtn.textContent = stepIndex === total - 1 ? t("tutorial_done") : t("tutorial_next");
}

function goTutorialStep(nextIndex, direction) {
  state.tutorialStep = nextIndex;
  renderTutorialStep(direction);
}

function openTutorial(startStep = 0) {
  const modal = $("#tutorial-modal");
  if (!modal) return;
  lastFocusedBeforeTutorial = document.activeElement;
  state.tutorialStep = startStep;
  const optOut = $("#tutorial-dont-show");
  if (optOut) optOut.checked = loadPref("tutorial_hide_on_open", "0") === "1";

  modal.hidden = false;
  document.body.classList.add("modal-open");
  renderTutorialStep();

  const nextBtn = $("#tutorial-next");
  if (nextBtn) nextBtn.focus();
}

function closeTutorial() {
  const modal = $("#tutorial-modal");
  if (!modal || modal.hidden) return;
  const optOut = $("#tutorial-dont-show");
  if (optOut) savePref("tutorial_hide_on_open", optOut.checked ? "1" : "0");

  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (lastFocusedBeforeTutorial && typeof lastFocusedBeforeTutorial.focus === "function") {
    lastFocusedBeforeTutorial.focus();
  }
}

function setupTutorial() {
  const closeBtn = $("#tutorial-close");
  const skipBtn = $("#tutorial-skip");
  const prevBtn = $("#tutorial-prev");
  const nextBtn = $("#tutorial-next");
  const modal = $("#tutorial-modal");

  if (closeBtn) closeBtn.addEventListener("click", closeTutorial);
  if (skipBtn) skipBtn.addEventListener("click", closeTutorial);
  if (prevBtn) prevBtn.addEventListener("click", () => {
    if (state.tutorialStep > 0) goTutorialStep(state.tutorialStep - 1, "prev");
  });
  if (nextBtn) nextBtn.addEventListener("click", () => {
    if (state.tutorialStep < TUTORIAL_STEPS.length - 1) {
      goTutorialStep(state.tutorialStep + 1, "next");
    } else {
      closeTutorial();
    }
  });
  if (modal) {
    modal.addEventListener("click", e => {
      if (e.target === modal) closeTutorial();
    });
  }
  document.addEventListener("keydown", e => {
    if (!modal || modal.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); closeTutorial(); }
    else if (e.key === "ArrowRight" && state.tutorialStep < TUTORIAL_STEPS.length - 1) {
      goTutorialStep(state.tutorialStep + 1, "next");
    } else if (e.key === "ArrowLeft" && state.tutorialStep > 0) {
      goTutorialStep(state.tutorialStep - 1, "prev");
    }
  });
}

let isOfflineReady = false;

function updateOfflineReadyBadge() {
  const badge = $("#offline-ready-badge");
  if (!badge) return;
  badge.innerHTML = isOfflineReady
    ? `${ICON_CHECK} <span>${esc(t("offline_ready"))}</span>`
    : `<span>${esc(t("offline_checking"))}</span>`;
}

function checkOfflineReady() {
  const badge = $("#offline-ready-badge");
  if (!("serviceWorker" in navigator)) {
    if (badge) badge.hidden = true;
    return;
  }
  window.addEventListener("labogon-offline-ready", () => {
    isOfflineReady = true;
    updateOfflineReadyBadge();
  });
  if (navigator.serviceWorker.controller) {
    isOfflineReady = true;
    updateOfflineReadyBadge();
  }
  navigator.serviceWorker.ready
    .then(() => {
      isOfflineReady = true;
      updateOfflineReadyBadge();
    })
    .catch(() => {});
}

let onlineRestoredTimer = null;
let showingRestoredNotice = false;

function updateOfflineBanner() {
  const banner = $("#offline-banner");
  const textEl = $("#offline-banner-text");
  if (!banner || !textEl) return;

  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  if (!isOnline) {
    if (onlineRestoredTimer) {
      clearTimeout(onlineRestoredTimer);
      onlineRestoredTimer = null;
    }
    showingRestoredNotice = false;
    banner.classList.remove("is-online");
    banner.setAttribute("role", "alert");
    textEl.textContent = t("offline_banner");
    banner.hidden = false;
    return;
  }

  if (showingRestoredNotice) {
    banner.classList.add("is-online");
    banner.setAttribute("role", "status");
    textEl.textContent = t("online_restored");
    banner.hidden = false;
  } else {
    banner.classList.remove("is-online");
    banner.hidden = true;
  }
}

function setupConnectivityMonitor() {
  updateOfflineBanner();
  checkOfflineReady();

  window.addEventListener("offline", () => {
    updateOfflineBanner();
    updateDynamicIslandStatus();
  });

  window.addEventListener("online", () => {
    showingRestoredNotice = true;
    updateOfflineBanner();
    updateDynamicIslandStatus();
    if (onlineRestoredTimer) clearTimeout(onlineRestoredTimer);
    onlineRestoredTimer = setTimeout(() => {
      showingRestoredNotice = false;
      updateOfflineBanner();
    }, 4500);

    // Retry map initialization automatically if user loaded the page while offline
    const mapEl = $("#map");
    const fbEl = $("#map-fallback");
    if (!mapInitialized || (fbEl && !fbEl.hidden)) {
      if (fbEl) fbEl.hidden = true;
      if (mapEl) mapEl.hidden = false;
      mapInitialized = false;
      initMap();
    }
  });
}

/* ---------------- 10. START-UP ---------------- */

// Draw everything again (used at start and when the language changes)
function renderAll() {
  applyStaticText();
  updateOfflineBanner();
  renderQuickCalls();
  updateShareLocationUI();
  renderLegend();
  renderContacts();
  renderCategories();
  renderGoBag();
  renderFirstAid();
  renderMapFilters();
  renderMapMarkers();
  renderFacilityList();
  renderNearbyTypeOptions();
  renderNearby();
  runSearch();
  if (window.LabogonMaps && typeof window.LabogonMaps.updateLabels === "function") {
    window.LabogonMaps.updateLabels({
      centerLabel: t("map_center_label"),
      openMapsLabel: t("open_maps"),
      language: state.lang,
      verifiedFacilities: buildVerifiedFacilityLookups()
    });
  }
  const modal = $("#tutorial-modal");
  if (modal && !modal.hidden) renderTutorialStep();
}

async function downloadStandaloneHtml(e) {
  if (e && typeof e.preventDefault === "function") e.preventDefault();
  try {
    let htmlText = "";
    if (window.location.protocol !== "file:") {
      const res = await fetch("/one-labogon.html", { cache: "no-store" });
      if (res.ok) htmlText = await res.text();
    }
    if (!htmlText) {
      htmlText = "<!doctype html>\n" + document.documentElement.outerHTML;
    }
    const blob = new Blob([htmlText], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "one-labogon.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast(t("download_toast"));
  } catch (err) {
    if (window.location.protocol !== "file:") {
      window.location.href = "/one-labogon.html";
    }
  }
}

function init() {
  setupRevealObserver();
  setupScrollEffects();
  setupDynamicIsland();
  setupTutorial();
  setupConnectivityMonitor();

  // Language, theme & accessibility buttons
  const langSelect = $("#lang-select");
  if (langSelect) langSelect.addEventListener("change", e => setLanguage(e.target.value));
  const themeBtn = $("#theme-toggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
  $$("[data-text-size]").forEach(btn => {
    btn.addEventListener("click", () => applyTextSize(btn.dataset.textSize));
  });
  const contrastBtn = $("#contrast-toggle");
  if (contrastBtn) contrastBtn.addEventListener("click", toggleContrast);
  const guideBtn = $("#guide-open-btn");
  if (guideBtn) guideBtn.addEventListener("click", () => openTutorial(0));
  const downloadBtn = $("#download-html-btn");
  if (downloadBtn) downloadBtn.addEventListener("click", downloadStandaloneHtml);
  const downloadFooterLink = $("#download-standalone-link");
  if (downloadFooterLink) downloadFooterLink.addEventListener("click", downloadStandaloneHtml);

  // Location sharing
  const shareBtn = $("#share-loc-btn");
  if (shareBtn) shareBtn.addEventListener("click", requestShareLocation);
  const shareCopyBtn = $("#share-copy-btn");
  if (shareCopyBtn) shareCopyBtn.addEventListener("click", copyShareLocation);

  // Go-bag reset button
  const gobagReset = $("#gobag-reset");
  if (gobagReset) {
    gobagReset.addEventListener("click", () => {
      saveGoBagState(new Set());
      renderGoBag();
    });
  }

  // Map, nearby & search
  const locateBtn = $("#locate-btn");
  if (locateBtn) locateBtn.addEventListener("click", showMyLocationOnMap);
  const nearbyOrigin = $("#nearby-origin");
  if (nearbyOrigin) nearbyOrigin.addEventListener("change", e => onNearbyOriginChange(e.target.value));
  const nearbyType = $("#nearby-type");
  if (nearbyType) nearbyType.addEventListener("change", e => { state.nearbyType = e.target.value; renderNearby(); });
  const searchInput = $("#search-input");
  if (searchInput) searchInput.addEventListener("input", runSearch);
  const searchClear = $("#search-clear");
  if (searchClear && searchInput) {
    searchClear.addEventListener("click", () => { searchInput.value = ""; runSearch(); searchInput.focus(); });
  }

  initMap();
  renderAll();

  if (loadPref("tutorial_hide_on_open", "0") !== "1") {
    openTutorial(0);
  }
}

init();
