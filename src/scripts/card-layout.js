import { getLocale, ui } from "../i18n/translations.js";

const ORDER_KEY = "timee.card-order.v2";
const COLLAPSED_KEY = "timee.card-collapsed.v2";
const HIDDEN_KEY = "timee.card-hidden.v1";
const LEGACY_ORDER_KEY = "timee.card-order.v1";
const DEFAULT_ORDER = ["location", "weather", "coordinates", "time", "timezone"];

const locale = getLocale();
const text = ui[locale];
const CARD_LABELS = {
  location: text.location.title,
  weather: text.weather.title,
  coordinates: text.coordinates.title,
  time: text.time.title,
  timezone: text.timezone.title
};

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The interface keeps working even when browser storage is unavailable.
  }
}

function normalizeKeys(values) {
  if (!Array.isArray(values)) return [];
  const normalized = [];
  for (const value of values) {
    const key = value === "local-time" || value === "utc-time" ? "time" : value;
    if (DEFAULT_ORDER.includes(key) && !normalized.includes(key)) normalized.push(key);
  }
  return normalized;
}

function normalizeOrder(values) {
  const valid = normalizeKeys(values);
  const missing = DEFAULT_ORDER.filter((key) => !valid.includes(key));
  return [...valid, ...missing];
}

function getSavedOrder() {
  const current = safeRead(ORDER_KEY, null);
  if (Array.isArray(current)) return normalizeOrder(current);

  const legacy = safeRead(LEGACY_ORDER_KEY, DEFAULT_ORDER);
  const migrated = normalizeOrder(legacy);
  safeWrite(ORDER_KEY, migrated);
  return migrated;
}

function getCards(layout) {
  return [...layout.querySelectorAll(":scope > .layout-card")];
}

function getVisibleCards(layout) {
  return getCards(layout).filter((card) => !card.hidden);
}

function saveOrder(layout) {
  safeWrite(ORDER_KEY, getCards(layout).map((card) => card.dataset.cardKey));
}

function saveCollapsed(layout) {
  safeWrite(
    COLLAPSED_KEY,
    getCards(layout)
      .filter((card) => card.classList.contains("is-collapsed"))
      .map((card) => card.dataset.cardKey)
  );
}

function saveHidden(layout) {
  safeWrite(
    HIDDEN_KEY,
    getCards(layout)
      .filter((card) => card.hidden)
      .map((card) => card.dataset.cardKey)
  );
}

function cardLabel(card) {
  return CARD_LABELS[card.dataset.cardKey] || card.querySelector("h2")?.textContent?.trim() || "Card";
}

function setCollapsed(card, collapsed, persist = true) {
  const body = card.querySelector(":scope > .layout-card-body");
  const button = card.querySelector("[data-collapse-toggle]");
  if (!body || !button) return;

  const label = cardLabel(card);
  card.classList.toggle("is-collapsed", collapsed);
  body.hidden = collapsed;
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute("aria-label", collapsed ? text.common.expandAria(label) : text.common.collapseAria(label));
  button.title = collapsed ? text.common.expand : text.common.collapse;

  if (persist) saveCollapsed(card.parentElement);
}

function setCardVisible(layout, key, visible, persist = true) {
  const card = layout.querySelector(`:scope > [data-card-key="${key}"]`);
  if (!card) return;
  card.hidden = !visible;

  const checkbox = document.querySelector(`[data-card-visibility="${key}"]`);
  if (checkbox) checkbox.checked = visible;

  if (persist) saveHidden(layout);
  updateMoveButtons(layout);
  updateEmptyState(layout);
}

function updateEmptyState(layout) {
  const empty = document.getElementById("card-layout-empty");
  if (empty) empty.hidden = getVisibleCards(layout).length !== 0;
}

function applySavedState(layout) {
  const order = getSavedOrder();
  const collapsed = normalizeKeys(safeRead(COLLAPSED_KEY, []));
  const hidden = normalizeKeys(safeRead(HIDDEN_KEY, []));

  order.forEach((key) => {
    const card = layout.querySelector(`:scope > [data-card-key="${key}"]`);
    if (card) layout.append(card);
  });

  getCards(layout).forEach((card) => {
    const key = card.dataset.cardKey;
    setCollapsed(card, collapsed.includes(key), false);
    setCardVisible(layout, key, !hidden.includes(key), false);
  });

  updateEmptyState(layout);
}

function moveCard(layout, card, direction) {
  const cards = getVisibleCards(layout);
  const index = cards.indexOf(card);
  if (index < 0) return;

  const target = cards[direction === "up" ? index - 1 : index + 1];
  if (!target) return;

  if (direction === "up") layout.insertBefore(card, target);
  else layout.insertBefore(card, target.nextElementSibling);

  saveOrder(layout);
  updateMoveButtons(layout);
}

function updateMoveButtons(layout) {
  const cards = getVisibleCards(layout);
  cards.forEach((card, index) => {
    const up = card.querySelector('[data-move="up"]');
    const down = card.querySelector('[data-move="down"]');
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === cards.length - 1;
  });
}

function setArrangeMode(layout, enabled) {
  const trigger = document.getElementById("layout-settings-button");
  const arrangeButton = document.getElementById("layout-arrange-button");

  document.body.dataset.layoutArranging = enabled ? "true" : "false";
  layout.classList.toggle("is-arranging", enabled);

  getCards(layout).forEach((card) => {
    card.draggable = enabled && !card.hidden;
  });

  if (trigger) {
    trigger.setAttribute("aria-pressed", String(enabled));
    trigger.setAttribute("aria-label", enabled ? text.common.arrangeDone : text.common.settings);
    trigger.title = enabled ? text.common.arrangeDone : text.common.settings;
  }
  if (arrangeButton) arrangeButton.textContent = enabled ? text.common.arrangeDone : text.common.arrange;

  updateMoveButtons(layout);
}

function resetLayout(layout) {
  DEFAULT_ORDER.forEach((key) => {
    const card = layout.querySelector(`:scope > [data-card-key="${key}"]`);
    if (card) layout.append(card);
  });

  getCards(layout).forEach((card) => {
    setCollapsed(card, false, false);
    setCardVisible(layout, card.dataset.cardKey, true, false);
  });

  localStorage.removeItem(ORDER_KEY);
  localStorage.removeItem(COLLAPSED_KEY);
  localStorage.removeItem(HIDDEN_KEY);
  setArrangeMode(layout, false);
  updateMoveButtons(layout);
  updateEmptyState(layout);
}

function openSettings(dialog) {
  if (!dialog?.open) dialog?.showModal();
}

export function initCardLayout() {
  const layout = document.getElementById("card-layout");
  const dialog = document.getElementById("layout-settings-dialog");
  const settingsButton = document.getElementById("layout-settings-button");
  const closeButton = document.getElementById("layout-settings-close");
  const arrangeButton = document.getElementById("layout-arrange-button");
  const resetButton = document.getElementById("layout-reset-button");
  const emptySettingsButton = document.getElementById("card-layout-empty-settings");

  if (!layout || !dialog || !settingsButton) return;

  applySavedState(layout);
  updateMoveButtons(layout);
  setArrangeMode(layout, false);

  settingsButton.addEventListener("click", () => {
    if (layout.classList.contains("is-arranging")) {
      setArrangeMode(layout, false);
      return;
    }
    openSettings(dialog);
  });

  closeButton?.addEventListener("click", () => dialog.close());
  emptySettingsButton?.addEventListener("click", () => openSettings(dialog));

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.querySelectorAll("[data-card-visibility]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      setCardVisible(layout, checkbox.dataset.cardVisibility, checkbox.checked);
    });
  });

  arrangeButton?.addEventListener("click", () => {
    dialog.close();
    setArrangeMode(layout, true);
  });
  resetButton?.addEventListener("click", () => resetLayout(layout));

  layout.addEventListener("click", (event) => {
    const card = event.target.closest(".layout-card");
    if (!card) return;

    if (event.target.closest("[data-collapse-toggle]")) {
      setCollapsed(card, !card.classList.contains("is-collapsed"));
      return;
    }

    const direction = event.target.closest("[data-move]")?.dataset.move;
    if (direction) moveCard(layout, card, direction);
  });

  let draggedCard = null;

  layout.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".layout-card");
    if (!layout.classList.contains("is-arranging") || !card || card.hidden) {
      event.preventDefault();
      return;
    }

    draggedCard = card;
    card.classList.add("is-dragging");
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  });

  layout.addEventListener("dragover", (event) => {
    if (!draggedCard) return;
    event.preventDefault();

    const target = event.target.closest(".layout-card:not([hidden])");
    if (!target || target === draggedCard) return;

    const rect = target.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    layout.insertBefore(draggedCard, before ? target : target.nextElementSibling);
  });

  layout.addEventListener("dragend", () => {
    draggedCard?.classList.remove("is-dragging");
    draggedCard = null;
    saveOrder(layout);
    updateMoveButtons(layout);
  });
}
