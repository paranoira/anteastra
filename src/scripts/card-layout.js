import { getLocale, ui } from "../i18n/translations.js";

const ORDER_KEY = "timee.card-order.v2";
const COLLAPSED_KEY = "timee.card-collapsed.v2";
const HIDDEN_KEY = "timee.card-hidden.v1";
const LEGACY_ORDER_KEY = "timee.card-order.v1";
const DEFAULT_ORDER = ["location", "astronomy", "weather", "coordinates", "time", "timezone"];

const locale = getLocale();
const text = ui[locale];
const CARD_LABELS = {
  location: text.location.title,
  astronomy: text.astronomy.title,
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
    return true;
  } catch {
    // The interface keeps working even when browser storage is unavailable.
    return false;
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
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
  if (!valid.includes("astronomy")) {
    const locationIndex = valid.indexOf("location");
    valid.splice(locationIndex >= 0 ? locationIndex + 1 : 0, 0, "astronomy");
  }
  const missing = DEFAULT_ORDER.filter((key) => !valid.includes(key));
  return [...valid, ...missing];
}

function getSavedOrder() {
  const current = safeRead(ORDER_KEY, null);
  if (Array.isArray(current)) return normalizeOrder(current);

  const legacy = safeRead(LEGACY_ORDER_KEY, null);
  if (!Array.isArray(legacy)) return [...DEFAULT_ORDER];

  const migrated = normalizeOrder(legacy);
  if (safeWrite(ORDER_KEY, migrated)) safeRemove(LEGACY_ORDER_KEY);
  return migrated;
}

function getCards(layout) {
  return [...layout.querySelectorAll(":scope > .layout-card")];
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

function setCardVisible(layout, key, visible) {
  const card = layout.querySelector(`:scope > [data-card-key="${key}"]`);
  if (card) card.hidden = !visible;
}

function updateEmptyState(layout) {
  const empty = document.getElementById("card-layout-empty");
  if (empty) empty.hidden = getCards(layout).some((card) => !card.hidden);
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
    setCardVisible(layout, key, !hidden.includes(key));
  });

  updateEmptyState(layout);
}

function createDraft(layout) {
  return {
    order: getCards(layout).map((card) => card.dataset.cardKey),
    visible: new Set(
      getCards(layout)
        .filter((card) => !card.hidden)
        .map((card) => card.dataset.cardKey)
    ),
    resetCollapsed: false
  };
}

function updateOrderList(orderList, draft) {
  draft.order.forEach((key) => {
    const item = orderList.querySelector(`[data-card-order-key="${key}"]`);
    if (item) orderList.append(item);
  });

  const items = [...orderList.querySelectorAll("[data-card-order-key]")];
  items.forEach((item, index) => {
    const key = item.dataset.cardOrderKey;
    const visible = draft.visible.has(key);
    const state = item.querySelector("[data-card-order-state]");
    const up = item.querySelector('[data-order-move="up"]');
    const down = item.querySelector('[data-order-move="down"]');

    item.dataset.visible = String(visible);
    if (state) state.textContent = visible ? text.common.visible : text.common.hidden;
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === items.length - 1;
  });
}

function renderDraft(dialog, draft) {
  dialog.querySelectorAll("[data-card-visibility]").forEach((checkbox) => {
    checkbox.checked = draft.visible.has(checkbox.dataset.cardVisibility);
  });

  const orderList = dialog.querySelector("#layout-order-list");
  if (orderList) updateOrderList(orderList, draft);

  const orderStatus = dialog.querySelector("#layout-order-status");
  if (orderStatus) orderStatus.textContent = "";
}

function announceOrder(orderStatus, draft, key) {
  if (!orderStatus) return;
  const position = draft.order.indexOf(key) + 1;
  orderStatus.textContent = text.common.orderPositionAria(CARD_LABELS[key] || key, position, draft.order.length);
}

function moveDraftCard(orderList, orderStatus, draft, key, direction) {
  const index = draft.order.indexOf(key);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= draft.order.length) return;

  [draft.order[index], draft.order[targetIndex]] = [draft.order[targetIndex], draft.order[index]];
  updateOrderList(orderList, draft);
  announceOrder(orderStatus, draft, key);

  const movedItem = orderList.querySelector(`[data-card-order-key="${key}"]`);
  const preferredButton = movedItem?.querySelector(`[data-order-move="${direction}"]`);
  const fallbackDirection = direction === "up" ? "down" : "up";
  const fallbackButton = movedItem?.querySelector(`[data-order-move="${fallbackDirection}"]`);
  (preferredButton?.disabled ? fallbackButton : preferredButton)?.focus();
}

function applyDraft(layout, draft) {
  draft.order.forEach((key) => {
    const card = layout.querySelector(`:scope > [data-card-key="${key}"]`);
    if (card) layout.append(card);
  });

  getCards(layout).forEach((card) => {
    setCardVisible(layout, card.dataset.cardKey, draft.visible.has(card.dataset.cardKey));
    if (draft.resetCollapsed) setCollapsed(card, false, false);
  });

  const usesDefaults =
    draft.order.every((key, index) => key === DEFAULT_ORDER[index]) &&
    draft.visible.size === DEFAULT_ORDER.length &&
    DEFAULT_ORDER.every((key) => draft.visible.has(key));

  if (usesDefaults) {
    safeRemove(ORDER_KEY);
    safeRemove(LEGACY_ORDER_KEY);
    safeRemove(HIDDEN_KEY);
  } else {
    saveOrder(layout);
    saveHidden(layout);
  }
  if (draft.resetCollapsed) safeRemove(COLLAPSED_KEY);
  updateEmptyState(layout);
}

function activateTab(dialog, tab, moveFocus = true) {
  const tabs = [...dialog.querySelectorAll('[role="tab"]')];
  tabs.forEach((candidate) => {
    const selected = candidate === tab;
    candidate.setAttribute("aria-selected", String(selected));
    candidate.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(candidate.getAttribute("aria-controls"));
    if (panel) panel.hidden = !selected;
  });
  const content = dialog.querySelector(".layout-settings-content");
  if (content) content.scrollTop = 0;
  if (moveFocus) tab.focus();
}

export function initCardLayout() {
  const layout = document.getElementById("card-layout");
  const dialog = document.getElementById("layout-settings-dialog");
  const settingsButton = document.getElementById("layout-settings-button");
  const closeButton = document.getElementById("layout-settings-close");
  const cancelButton = document.getElementById("layout-cancel-button");
  const applyButton = document.getElementById("layout-apply-button");
  const resetButton = document.getElementById("layout-reset-button");
  const emptySettingsButton = document.getElementById("card-layout-empty-settings");
  const tablist = dialog?.querySelector('[role="tablist"]');
  const cardsTab = document.getElementById("layout-cards-tab");
  const orderList = document.getElementById("layout-order-list");
  const orderStatus = document.getElementById("layout-order-status");

  if (!layout || !dialog || !settingsButton || !cardsTab || !orderList) return;

  let draft = null;
  let opener = null;
  let draggedItem = null;

  applySavedState(layout);

  const closeSettings = (returnValue = "cancel") => {
    const focusTarget = opener;
    dialog.close(returnValue);
    requestAnimationFrame(() => {
      const emptyState = focusTarget?.closest("#card-layout-empty");
      const nextFocus = emptyState?.hidden ? settingsButton : focusTarget;
      nextFocus?.focus();
    });
  };

  const openSettings = (source) => {
    if (dialog.open) return;
    opener = source;
    draft = createDraft(layout);
    renderDraft(dialog, draft);
    activateTab(dialog, cardsTab, false);
    dialog.showModal();
    requestAnimationFrame(() => cardsTab.focus());
  };

  settingsButton.addEventListener("click", () => openSettings(settingsButton));
  emptySettingsButton?.addEventListener("click", () => openSettings(emptySettingsButton));
  closeButton?.addEventListener("click", () => closeSettings());
  cancelButton?.addEventListener("click", () => closeSettings());

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeSettings();
  });

  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeSettings();
  });

  dialog.addEventListener("close", () => {
    dialog.querySelectorAll(".is-dragging").forEach((item) => item.classList.remove("is-dragging"));
    draft = null;
    opener = null;
    draggedItem = null;
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeSettings();
  });

  tablist?.addEventListener("click", (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) activateTab(dialog, tab);
  });

  tablist?.addEventListener("keydown", (event) => {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const currentIndex = tabs.indexOf(event.target.closest('[role="tab"]'));
    if (currentIndex < 0) return;

    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    activateTab(dialog, tabs[nextIndex]);
  });

  dialog.querySelectorAll("[data-card-visibility]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (!draft) return;
      const key = checkbox.dataset.cardVisibility;
      if (checkbox.checked) draft.visible.add(key);
      else draft.visible.delete(key);
      updateOrderList(orderList, draft);
    });
  });

  orderList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-order-move]");
    const item = button?.closest("[data-card-order-key]");
    if (!button || !item || !draft) return;
    moveDraftCard(orderList, orderStatus, draft, item.dataset.cardOrderKey, button.dataset.orderMove);
  });

  orderList.addEventListener("dragstart", (event) => {
    const handle = event.target.closest("[data-order-drag-handle]");
    const item = handle?.closest("[data-card-order-key]");
    if (!item || !draft) {
      event.preventDefault();
      return;
    }

    draggedItem = item;
    item.classList.add("is-dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", item.dataset.cardOrderKey);
    }
  });

  orderList.addEventListener("dragover", (event) => {
    if (!draggedItem) return;
    event.preventDefault();
    const target = event.target.closest("[data-card-order-key]");
    if (!target || target === draggedItem) return;

    const rect = target.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    orderList.insertBefore(draggedItem, before ? target : target.nextElementSibling);
  });

  orderList.addEventListener("dragend", () => {
    if (!draggedItem || !draft) return;
    const key = draggedItem.dataset.cardOrderKey;
    draggedItem.classList.remove("is-dragging");
    draggedItem = null;
    draft.order = [...orderList.querySelectorAll("[data-card-order-key]")].map((item) => item.dataset.cardOrderKey);
    updateOrderList(orderList, draft);
    announceOrder(orderStatus, draft, key);
  });

  resetButton?.addEventListener("click", () => {
    if (!draft) return;
    draft.order = [...DEFAULT_ORDER];
    draft.visible = new Set(DEFAULT_ORDER);
    draft.resetCollapsed = true;
    renderDraft(dialog, draft);
  });

  applyButton?.addEventListener("click", () => {
    if (!draft) return;
    applyDraft(layout, draft);
    closeSettings("confirm");
  });

  layout.addEventListener("click", (event) => {
    const card = event.target.closest(".layout-card");
    if (!card || !event.target.closest("[data-collapse-toggle]")) return;
    setCollapsed(card, !card.classList.contains("is-collapsed"));
  });
}
