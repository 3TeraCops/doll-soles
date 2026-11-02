/* Форма заказа 3D-печати кукольных подошв.
   Порядок: форма → «Заказ оформлен» → возврат к форме.
   Уведомление в Telegram подключается позже (см. notifyOrder). */

const MODELS = [
  { id: "classic", name: "Классическая", desc: "каблук 4–6 см" },
  { id: "ballet", name: "Балетная", desc: "плоская, без каблука" },
  { id: "platform", name: "Платформа", desc: "утолщённая подошва" },
  { id: "wineglass", name: "Каблук-рюмочка", desc: "5–7 см" },
  { id: "wedge", name: "Танкетка", desc: "плавный подъём" },
  { id: "insole", name: "Стелька с супинатором", desc: "анатомическая" },
  { id: "sandal", name: "Сандалетка", desc: "тонкие ремешки" },
  { id: "boot", name: "Ботинок", desc: "закрытая пятка" },
  { id: "sneaker", name: "Кроссовочная", desc: "плоский ход" },
  { id: "mini", name: "Для кукол 1/4", desc: "уменьшенная" }
];

const COLORS = [
  { id: "skin", name: "Телесный", hex: "#E8C4A8" },
  { id: "black", name: "Чёрный", hex: "#1B1B22" },
  { id: "white", name: "Белый", hex: "#F3F2F7" },
  { id: "gray", name: "Серый", hex: "#A8A6B4" },
  { id: "clear", name: "Полупрозрачный", hex: "#DAD7E6", opacity: 0.55 }
];

const TELEGRAM_ENDPOINT = "https://doll-soles-order.netlify.app/.netlify/functions/order";
const ORDER_SEQ_KEY = "dollsoles.orderSeq";
const ORDER_SEQ_START = 2480;

const formView = document.getElementById("formView");
const successView = document.getElementById("successView");
const positionsEl = document.getElementById("positions");
const addBtn = document.getElementById("addPosition");
const orderNumberEl = document.getElementById("orderNumber");
const orderItemsEl = document.getElementById("orderItems");
const orderTotalEl = document.getElementById("orderTotal");

const modelById = (id) => MODELS.find((m) => m.id === id) || MODELS[0];
const colorById = (id) => COLORS.find((c) => c.id === id) || COLORS[0];
const modelTitle = (m) => (m.desc ? `${m.name} — ${m.desc}` : m.name);
const plural = (n, one, few, many) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

/* ---------------- state ---------------- */
let positions = [];
const positionViews = [];

/* ---------------- select (searchable listbox) ---------------- */
function createSelect({ options, value, labelText, labelId, onChange }) {
  const wrap = document.createElement("div");
  wrap.className = "dropdown";
  const valueId = `sel-value-${Math.random().toString(36).slice(2, 8)}`;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "select";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  if (labelId) {
    trigger.setAttribute("aria-labelledby", `${labelId} ${valueId}`);
  } else {
    trigger.setAttribute("aria-label", labelText);
  }

  const valueEl = document.createElement("span");
  valueEl.className = "select-value";
  valueEl.id = valueId;
  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevron.setAttribute("class", "ic chev-down");
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = '<use href="#i-chevron"/>';
  const chevronUp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevronUp.setAttribute("class", "ic chev-up");
  chevronUp.setAttribute("aria-hidden", "true");
  chevronUp.innerHTML = '<use href="#i-chevron-up"/>';
  trigger.append(valueEl, chevron, chevronUp);

  const popup = document.createElement("div");
  popup.className = "popup";
  popup.hidden = true;

  const search = document.createElement("div");
  search.className = "search";
  search.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-search"/></svg>';
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Поиск модели";
  input.setAttribute("aria-label", "Поиск модели");
  search.appendChild(input);

  const list = document.createElement("ul");
  list.className = "options";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", labelText);

  popup.append(search, list);
  wrap.append(trigger, popup);

  let currentId = value;
  let filtered = options.slice();
  let activeIndex = -1;

  const setValue = (id, notify = true) => {
    currentId = id;
    const option = options.find((o) => o.id === id) || options[0];
    valueEl.textContent = option.name;
    list.querySelectorAll(".option").forEach((li) => {
      li.setAttribute("aria-selected", String(li.dataset.id === currentId));
    });
    if (notify) onChange(id);
  };

  function renderList() {
    list.textContent = "";
    const query = input.value.trim().toLowerCase();
    filtered = options.filter((o) => modelTitle(o).toLowerCase().includes(query));
    if (!filtered.length) {
      const empty = document.createElement("li");
      empty.className = "option-empty";
      empty.textContent = "Ничего не найдено";
      list.appendChild(empty);
      return;
    }
    filtered.forEach((o) => {
      const li = document.createElement("li");
      li.className = "option";
      li.dataset.id = o.id;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(o.id === currentId));
      li.tabIndex = -1;
      li.innerHTML =
        '<span class="option-label"></span>' +
        '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>';
      li.querySelector(".option-label").textContent = modelTitle(o);
      li.addEventListener("click", () => {
        setValue(o.id);
        close(true);
      });
      list.appendChild(li);
    });
  }

  function setActive(index) {
    const items = [...list.querySelectorAll(".option")];
    if (!items.length) return;
    activeIndex = (index + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle("is-active", i === activeIndex));
    items[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function open() {
    if (!popup.hidden) return;
    popup.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    input.value = "";
    renderList();
    activeIndex = options.findIndex((o) => o.id === currentId);
    if (activeIndex >= 0) setActive(activeIndex);
    input.focus({ preventScroll: true });
  }

  function close(focusTrigger) {
    if (popup.hidden) return;
    popup.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (focusTrigger) trigger.focus({ preventScroll: true });
  }

  trigger.addEventListener("click", () => (popup.hidden ? open() : close(false)));

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open();
    }
  });

  input.addEventListener("input", () => {
    renderList();
    activeIndex = 0;
    setActive(0);
  });

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[activeIndex];
      if (item) {
        setValue(item.id);
        close(true);
      }
    }
  }

  input.addEventListener("keydown", onKeydown);
  list.addEventListener("keydown", onKeydown);

  document.addEventListener("pointerdown", (event) => {
    if (!wrap.contains(event.target)) close(false);
  });

  setValue(value, false);
  return { element: wrap, getValue: () => currentId, open, close, trigger };
}

/* ---------------- position ---------------- */
function createPositionView(state, index) {
  const el = document.createElement("section");
  el.className = "position";
  el.setAttribute("aria-label", `Позиция ${index + 1}`);

  const head = document.createElement("div");
  head.className = "position-head";
  const title = document.createElement("span");
  title.className = "position-title";
  title.textContent = `Позиция ${index + 1}`;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "icon-btn remove";
  removeBtn.setAttribute("aria-label", `Удалить позицию ${index + 1}`);
  removeBtn.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg>';
  removeBtn.addEventListener("click", () => removePosition(index));

  head.append(title, removeBtn);

  const modelField = document.createElement("div");
  modelField.className = "field";
  const modelLabel = document.createElement("span");
  modelLabel.className = "field-label";
  modelLabel.textContent = "Модель";
  modelLabel.id = `model-label-${Math.random().toString(36).slice(2, 8)}`;
  const select = createSelect({
    options: MODELS,
    value: state.modelId,
    labelText: "Модель",
    labelId: modelLabel.id,
    onChange: (id) => {
      state.modelId = id;
    }
  });
  modelField.append(modelLabel, select.element);

  const colorField = document.createElement("div");
  colorField.className = "field";
  const colorLabel = document.createElement("span");
  colorLabel.className = "field-label";
  colorLabel.textContent = "Цвет";
  const chips = document.createElement("div");
  chips.className = "chips";
  chips.setAttribute("role", "radiogroup");
  chips.setAttribute("aria-label", "Цвет");

  COLORS.forEach((color) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.setAttribute("role", "radio");
    chip.setAttribute("aria-checked", String(color.id === state.colorId));
    chip.innerHTML = '<span class="swatch"></span><span class="chip-label"></span>';
    chip.querySelector(".swatch").style.background = color.hex;
    if (color.opacity) chip.querySelector(".swatch").style.opacity = String(color.opacity);
    chip.querySelector(".chip-label").textContent = color.name;
    chip.addEventListener("click", () => {
      state.colorId = color.id;
      chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-checked", String(c === chip)));
    });
    chips.appendChild(chip);
  });
  colorField.append(colorLabel, chips);

  const qtyField = document.createElement("div");
  qtyField.className = "field";
  const qtyLabel = document.createElement("span");
  qtyLabel.className = "field-label";
  qtyLabel.textContent = "Количество пар";
  const stepper = document.createElement("div");
  stepper.className = "stepper";

  const minus = document.createElement("button");
  minus.type = "button";
  minus.className = "step-btn";
  minus.setAttribute("aria-label", "Уменьшить количество пар");
  minus.textContent = "−";

  const value = document.createElement("span");
  value.className = "step-value";
  value.setAttribute("aria-live", "polite");

  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "step-btn plus";
  plus.setAttribute("aria-label", "Увеличить количество пар");
  plus.textContent = "+";

  const renderQty = () => {
    value.textContent = String(state.pairs);
    minus.disabled = state.pairs <= 1;
    value.setAttribute("aria-label", `${state.pairs} ${plural(state.pairs, "пара", "пары", "пар")}`);
  };

  minus.addEventListener("click", () => {
    if (state.pairs > 1) {
      state.pairs -= 1;
      renderQty();
    }
  });
  plus.addEventListener("click", () => {
    state.pairs += 1;
    renderQty();
  });
  renderQty();

  stepper.append(minus, value, plus);
  qtyField.append(qtyLabel, stepper);

  el.append(head, modelField, colorField, qtyField);

  return { el, title, removeBtn, select, head, renderQty };
}

function renumber() {
  const multiple = positions.length > 1;
  positionViews.forEach((view, index) => {
    view.title.textContent = `Позиция ${index + 1}`;
    view.removeBtn.hidden = !multiple;
    view.removeBtn.setAttribute("aria-label", `Удалить позицию ${index + 1}`);
    view.el.setAttribute("aria-label", `Позиция ${index + 1}`);
  });
}

function addPosition(state, focus = false) {
  positions.push(state);
  const view = createPositionView(state, positions.length - 1);
  positionViews.push(view);
  positionsEl.appendChild(view.el);
  renumber();
  if (focus) view.select.trigger.focus({ preventScroll: true });
  return view;
}

function removePosition(index) {
  if (positions.length <= 1) return;
  positions.splice(index, 1);
  const view = positionViews.splice(index, 1)[0];
  view.el.remove();
  renumber();
}

function resetPositions() {
  positions = [];
  positionViews.length = 0;
  positionsEl.textContent = "";
  addPosition({ modelId: "classic", colorId: "skin", pairs: 1 });
}

/* ---------------- order ---------------- */
function nextOrderNumber() {
  let seq = Number(localStorage.getItem(ORDER_SEQ_KEY) || ORDER_SEQ_START);
  seq += 1;
  try {
    localStorage.setItem(ORDER_SEQ_KEY, String(seq));
  } catch (error) {
    /* локальное хранилище может быть недоступно */
  }
  return `3D-${seq}`;
}

function buildOrder() {
  return {
    number: nextOrderNumber(),
    createdAt: new Date().toISOString(),
    positions: positions.map((p) => {
      const model = modelById(p.modelId);
      return {
        modelId: model.id,
        model: modelTitle(model),
        colorId: p.colorId,
        color: colorById(p.colorId).name,
        pairs: p.pairs
      };
    }),
    totalPairs: positions.reduce((sum, p) => sum + p.pairs, 0)
  };
}

async function notifyOrder(order) {
  if (!TELEGRAM_ENDPOINT) {
    console.info("[order] уведомление в Telegram ещё не подключено", order);
    return;
  }
  try {
    await fetch(TELEGRAM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order)
    });
  } catch (error) {
    console.warn("[order] не удалось отправить уведомление", error);
  }
}

function renderSuccess(order) {
  orderNumberEl.textContent = order.number;
  orderItemsEl.textContent = "";

  order.positions.forEach((p) => {
    const item = document.createElement("div");
    item.className = "order-item";
    const name = document.createElement("strong");
    name.textContent = p.model;
    const meta = document.createElement("span");
    meta.textContent = `${p.color} · ${p.pairs} ${plural(p.pairs, "пара", "пары", "пар")}`;
    item.append(name, meta);
    orderItemsEl.appendChild(item);
  });

  orderTotalEl.textContent = `${order.totalPairs} ${plural(order.totalPairs, "пара", "пары", "пар")}`;
}

function showSuccess(order) {
  renderSuccess(order);
  formView.hidden = true;
  successView.hidden = false;
  window.scrollTo(0, 0);
  document.getElementById("successTitle").setAttribute("tabindex", "-1");
  document.getElementById("successTitle").focus({ preventScroll: true });
}

function showForm() {
  successView.hidden = true;
  formView.hidden = false;
  resetPositions();
  window.scrollTo({ top: 0, behavior: "auto" });
  document.getElementById("formTitle").setAttribute("tabindex", "-1");
  document.getElementById("formTitle").focus({ preventScroll: true });
}

/* ---------------- toast ---------------- */
let toastTimer;
function toast(message) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 1800);
}

/* ---------------- wiring ---------------- */
document.getElementById("orderForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const order = buildOrder();
  notifyOrder(order);
  showSuccess(order);
});

addBtn.addEventListener("click", () => addPosition({ modelId: "classic", colorId: "skin", pairs: 1 }, true));

document.getElementById("backToForm").addEventListener("click", showForm);

document.getElementById("copyOrder").addEventListener("click", async () => {
  const value = orderNumberEl.textContent.trim();
  try {
    await navigator.clipboard.writeText(value);
    toast("Номер скопирован");
  } catch (error) {
    toast("Не удалось скопировать");
  }
});

resetPositions();
