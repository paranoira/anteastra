const ORDER_KEY = "timee.card-order.v1";
const COLLAPSED_KEY = "timee.card-collapsed.v1";

const DEFAULT_ORDER = [
  "location",
  "weather",
  "coordinates",
  "local-time",
  "utc-time",
  "timezone"
];

function safeRead(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A felület működik tovább, csak a beállítás nem marad meg.
  }
}

function getCardKey(card) {
  if (card.id === "weather-card") return "weather";
  if (card.classList.contains("action-card")) return "location";
  return card.querySelector("h2[id]")?.id?.replace(/-title$/, "") || null;
}

function getCardTitle(card) {
  return card.querySelector("h2")?.textContent?.trim() || "Kártya";
}

function createButton(className, label, title) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.title = title;
  button.setAttribute("aria-label", title);
  return button;
}

function enhanceCard(card, collapsedKeys) {
  const key = getCardKey(card);
  if (!key) return null;

  card.dataset.cardKey = key;
  card.classList.add("layout-card");

  if (["location", "weather", "coordinates", "timezone"].includes(key)) {
    card.classList.add("layout-card-wide");
  }

  const titleText = getCardTitle(card);
  const body = document.createElement("div");
  body.className = "card-collapsible-content";
  while (card.firstChild) body.append(card.firstChild);

  const controls = document.createElement("div");
  controls.className = "card-layout-controls";

  const title = document.createElement("strong");
  title.className = "card-layout-title";
  title.textContent = titleText;

  const actions = document.createElement("div");
  actions.className = "card-layout-actions";

  const drag = createButton("card-drag-button", "↕", `${titleText} mozgatása`);
  const up = createButton("card-move-button", "↑", `${titleText} mozgatása felfelé`);
  const down = createButton("card-move-button", "↓", `${titleText} mozgatása lefelé`);
  const toggle = createButton("card-collapse-button", "Összecsukás", `${titleText} összecsukása`);

  up.dataset.move = "up";
  down.dataset.move = "down";
  toggle.dataset.collapseToggle = "true";

  actions.append(drag, up, down, toggle);
  controls.append(title, actions);
  card.append(controls, body);

  setCollapsed(card, collapsedKeys.includes(key), false);
  return card;
}

function setCollapsed(card, collapsed, persist = true) {
  const body = card.querySelector(".card-collapsible-content");
  const toggle = card.querySelector("[data-collapse-toggle]");
  const title = card.querySelector(".card-layout-title")?.textContent || "Kártya";

  card.classList.toggle("is-collapsed", collapsed);
  body.hidden = collapsed;
  toggle.textContent = collapsed ? "Kinyitás" : "Összecsukás";
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.setAttribute("aria-label", `${title} ${collapsed ? "kinyitása" : "összecsukása"}`);

  if (persist) saveCollapsed(card.closest(".card-layout"));
}

function saveOrder(layout) {
  const order = [...layout.querySelectorAll(".layout-card")].map((card) => card.dataset.cardKey);
  safeWrite(ORDER_KEY, order);
}

function saveCollapsed(layout) {
  const collapsed = [...layout.querySelectorAll(".layout-card.is-collapsed")].map((card) => card.dataset.cardKey);
  safeWrite(COLLAPSED_KEY, collapsed);
}

function normalizeOrder(savedOrder, cards) {
  const available = new Set(cards.map((card) => card.dataset.cardKey));
  const valid = Array.isArray(savedOrder) ? savedOrder.filter((key) => available.has(key)) : [];
  const missing = DEFAULT_ORDER.filter((key) => available.has(key) && !valid.includes(key));
  return [...valid, ...missing];
}

function moveCard(card, direction) {
  const layout = card.parentElement;
  const sibling = direction === "up" ? card.previousElementSibling : card.nextElementSibling;
  if (!sibling) return;

  if (direction === "up") layout.insertBefore(card, sibling);
  else layout.insertBefore(sibling, card);

  saveOrder(layout);
  updateMoveButtons(layout);
}

function updateMoveButtons(layout) {
  const cards = [...layout.querySelectorAll(".layout-card")];
  cards.forEach((card, index) => {
    card.querySelector('[data-move="up"]').disabled = index === 0;
    card.querySelector('[data-move="down"]').disabled = index === cards.length - 1;
  });
}

function setArrangeMode(layout, toolbar, enabled) {
  layout.classList.toggle("is-arranging", enabled);
  const button = toolbar.querySelector("[data-arrange-toggle]");
  button.setAttribute("aria-pressed", String(enabled));
  button.textContent = enabled ? "Rendezés kész" : "Kártyák rendezése";
  layout.querySelectorAll(".layout-card").forEach((card) => {
    card.draggable = enabled;
  });
}

function resetLayout(layout) {
  DEFAULT_ORDER.forEach((key) => {
    const card = layout.querySelector(`[data-card-key="${key}"]`);
    if (card) layout.append(card);
  });

  layout.querySelectorAll(".layout-card").forEach((card) => setCollapsed(card, false, false));
  localStorage.removeItem(ORDER_KEY);
  localStorage.removeItem(COLLAPSED_KEY);
  updateMoveButtons(layout);
}

function initCardLayout() {
  const main = document.querySelector("main");
  const actionCard = main?.querySelector(":scope > .action-card");
  const weatherCard = main?.querySelector(":scope > .weather-card");
  const dashboard = main?.querySelector(":scope > .dashboard-grid");
  const dataCards = dashboard
    ? [...dashboard.children].filter((item) => item.classList.contains("data-card"))
    : [];

  const sourceCards = [actionCard, weatherCard, ...dataCards].filter(Boolean);
  if (!main || !sourceCards.length || main.querySelector(".card-layout")) return;

  const collapsedKeys = safeRead(COLLAPSED_KEY, []);
  const cards = sourceCards.map((card) => enhanceCard(card, collapsedKeys)).filter(Boolean);

  const toolbar = document.createElement("div");
  toolbar.className = "card-layout-toolbar";
  toolbar.setAttribute("aria-label", "Kártyák beállításai");

  const toolbarText = document.createElement("p");
  toolbarText.textContent = "A sorrend és az összecsukott állapot ebben a böngészőben marad.";

  const toolbarActions = document.createElement("div");
  toolbarActions.className = "card-layout-toolbar-actions";

  const arrangeButton = createButton(
    "button button-secondary",
    "Kártyák rendezése",
    "Kártyák rendezésének bekapcsolása"
  );
  arrangeButton.dataset.arrangeToggle = "true";
  arrangeButton.setAttribute("aria-pressed", "false");

  const resetButton = createButton(
    "button button-quiet",
    "Alaphelyzet",
    "Kártyák alaphelyzetének visszaállítása"
  );
  resetButton.dataset.layoutReset = "true";

  toolbarActions.append(arrangeButton, resetButton);
  toolbar.append(toolbarText, toolbarActions);

  const layout = document.createElement("div");
  layout.className = "card-layout";

  const savedOrder = normalizeOrder(safeRead(ORDER_KEY, DEFAULT_ORDER), cards);

  main.insertBefore(toolbar, actionCard);
  main.insertBefore(layout, actionCard);

  savedOrder.forEach((key) => {
    const card = cards.find((item) => item.dataset.cardKey === key);
    if (card) layout.append(card);
  });

  dashboard?.remove();

  let arranging = false;
  let draggedCard = null;

  toolbar.addEventListener("click", (event) => {
    if (event.target.closest("[data-arrange-toggle]")) {
      arranging = !arranging;
      setArrangeMode(layout, toolbar, arranging);
    }

    if (event.target.closest("[data-layout-reset]")) resetLayout(layout);
  });

  layout.addEventListener("click", (event) => {
    const card = event.target.closest(".layout-card");
    if (!card) return;

    if (event.target.closest("[data-collapse-toggle]")) {
      setCollapsed(card, !card.classList.contains("is-collapsed"));
      return;
    }

    const move = event.target.closest("[data-move]")?.dataset.move;
    if (move) moveCard(card, move);
  });

  layout.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".layout-card");
    if (!arranging || !card) {
      event.preventDefault();
      return;
    }

    draggedCard = card;
    card.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
  });

  layout.addEventListener("dragover", (event) => {
    if (!draggedCard) return;
    event.preventDefault();

    const target = event.target.closest(".layout-card");
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

  updateMoveButtons(layout);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCardLayout, { once: true });
} else {
  initCardLayout();
}
