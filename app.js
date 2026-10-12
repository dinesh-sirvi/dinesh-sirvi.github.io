(function () {
  const JSON_URL = new URL("scrap_details_2026-10-10.json", document.baseURI);
  const MM_PER_FOOT = 304.8;

  const UI = {
    en: {
      titleFallback: "Scrap details",
      page: "Page",
      code: "Color code",
      name: "Name",
      thickness: "Thickness",
      size: "Size",
      mask: "Mask",
      grade: "Grade",
      sheets: "Sheets",
      weight: "Weight",
      all: "All",
      emptyMask: "Empty",
      clear: "Clear filters",
      listed: "Listed weight",
      filtered: "Total weight",
      rows: "rows",
      of: "of",
      none: "No rows match these filters.",
      loading: "Loading the sheet…",
      failed: "The sheet could not be loaded from the JSON file.",
      hint: "Several values in one filter all count. Every filter applies together.",
      missing: function (pages) { return "Page " + pages.join(", ") + " is not included."; },
      langName: "Language",
      unitName: "Size unit"
    },
    ja: {
      titleFallback: "スクラップ明細",
      page: "ページ",
      code: "色番",
      name: "呼称",
      thickness: "厚味",
      size: "実寸法",
      mask: "マスク",
      grade: "等級",
      sheets: "枚数",
      weight: "重量",
      all: "すべて",
      emptyMask: "空",
      clear: "条件を解除",
      listed: "掲載重量",
      filtered: "合計重量",
      rows: "行",
      of: "/",
      none: "条件に合う行がありません。",
      loading: "明細を読み込んでいます…",
      failed: "JSONファイルから明細を読み込めませんでした。",
      hint: "同じ条件では選んだ値のいずれかに一致します。条件どうしはすべて同時に適用されます。",
      missing: function (pages) { return pages.join("、") + "ページは含まれていません。"; },
      langName: "言語",
      unitName: "寸法単位"
    }
  };

  const state = {
    lang: "en",
    unit: localStorage.getItem("scrap-unit") === "ft" ? "ft" : "mm",
    filters: { name: [], thickness: [], size: [], mask: [], grade: [] }
  };

  const els = {
    date: document.getElementById("date"),
    title: document.getElementById("title"),
    who: document.getElementById("who"),
    note: document.getElementById("note"),
    hint: document.getElementById("hint"),
    status: document.getElementById("status"),
    weightLine: document.getElementById("weight-line"),
    weightLabel: document.getElementById("weight-label"),
    weightValue: document.getElementById("weight-value"),
    weightMeta: document.getElementById("weight-meta"),
    filters: document.getElementById("filters"),
    thead: document.getElementById("thead"),
    tbody: document.getElementById("tbody"),
    cards: document.getElementById("cards"),
    langToggle: document.getElementById("lang-toggle"),
    unitToggle: document.getElementById("unit-toggle"),
    top: document.querySelector(".top")
  };

  const controls = {};
  let data = null;

  function t() { return UI[state.lang]; }

  function tenths(kg) {
    return Math.round(Number(kg).toFixed(1) * 10);
  }

  function formatKg(kg) {
    return (tenths(kg) / 10).toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }

  function formatInt(n) {
    return Number(n).toLocaleString("en-US");
  }

  function feet(mm) {
    return (mm / MM_PER_FOOT).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function sizeText(row) {
    if (state.unit === "ft") return feet(row.width_mm) + " × " + feet(row.length_mm) + " ft";
    return formatInt(row.width_mm) + " × " + formatInt(row.length_mm) + " mm";
  }

  function thicknessText(row) {
    return Number(row.thickness_mm).toFixed(1) + " mm";
  }

  function nameText(row) {
    return state.lang === "ja" ? row.name_ja : row.name_en;
  }

  function maskText(row) {
    if (!row.mask) return "—";
    return state.lang === "ja" ? row.mask : (row.mask_en || row.mask);
  }

  function dateText(doc) {
    const parts = doc.date.split("-");
    const y = parts[0];
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (state.lang === "ja") return y + "年" + m + "月" + d + "日（" + doc.weekday_ja + "）";
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return doc.weekday_en + ", " + d + " " + months[m - 1] + " " + y;
  }

  function filtersActive() {
    return Object.keys(state.filters).some(function (key) { return state.filters[key].length > 0; });
  }

  function chosen(list, value) {
    return list.length === 0 || list.indexOf(value) !== -1;
  }

  function matchRow(row) {
    const f = state.filters;
    return chosen(f.name, row.name_ja)
      && chosen(f.thickness, Number(row.thickness_mm).toFixed(1))
      && chosen(f.size, row.size)
      && chosen(f.mask, row.mask || "__empty")
      && chosen(f.grade, row.grade);
  }

  function unique(rows, pick) {
    const seen = new Set();
    const out = [];
    rows.forEach(function (row) {
      const item = pick(row);
      if (seen.has(item.key)) return;
      seen.add(item.key);
      out.push(item);
    });
    return out;
  }

  function buildToggles() {
    els.langToggle.replaceChildren();
    els.unitToggle.replaceChildren();
    [["en", "English"], ["ja", "日本語"]].forEach(function (pair) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = pair[1];
      btn.setAttribute("aria-pressed", state.lang === pair[0] ? "true" : "false");
      btn.addEventListener("click", function () {
        state.lang = pair[0];
        paint();
      });
      els.langToggle.appendChild(btn);
    });
    [["mm", "mm"], ["ft", "ft"]].forEach(function (pair) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = pair[1];
      btn.setAttribute("aria-pressed", state.unit === pair[0] ? "true" : "false");
      btn.addEventListener("click", function () {
        state.unit = pair[0];
        localStorage.setItem("scrap-unit", state.unit);
        paint();
      });
      els.unitToggle.appendChild(btn);
    });
    els.langToggle.setAttribute("aria-label", t().langName);
    els.unitToggle.setAttribute("aria-label", t().unitName);
  }

  function readChecks(box) {
    const next = [];
    box.querySelectorAll("input:checked").forEach(function (el) { next.push(el.value); });
    return next;
  }

  function buildFilters() {
    ["name", "thickness", "size", "mask", "grade"].forEach(function (key) {
      const field = document.createElement("div");
      field.className = "field";
      const span = document.createElement("span");
      const box = document.createElement("div");
      box.className = "choices";
      box.dataset.key = key;
      field.append(span, box);
      els.filters.appendChild(field);
      controls[key] = { span: span, box: box };
    });

    const clearField = document.createElement("div");
    clearField.className = "field clear";
    const clearLabel = document.createElement("span");
    clearLabel.textContent = " ";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.id = "clear";
    clearBtn.addEventListener("click", function () {
      state.filters = { name: [], thickness: [], size: [], mask: [], grade: [] };
      paint();
    });
    clearField.append(clearLabel, clearBtn);
    els.filters.appendChild(clearField);
    controls.clear = clearBtn;

    els.filters.addEventListener("submit", function (event) { event.preventDefault(); });
  }

  function renderChoices(key, items) {
    const box = controls[key].box;
    const selected = {};
    state.filters[key].forEach(function (value) { selected[value] = true; });
    box.replaceChildren();
    items.forEach(function (item) {
      const label = document.createElement("label");
      label.className = "choice";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = item.value;
      input.checked = !!selected[item.value];
      if (input.checked) label.classList.add("is-on");
      input.addEventListener("change", function () {
        label.classList.toggle("is-on", input.checked);
        state.filters[key] = readChecks(box);
        paintResults();
      });
      const text = document.createElement("span");
      text.textContent = item.label;
      label.append(input, text);
      box.appendChild(label);
    });
  }

  function refreshFilterChoices() {
    const rows = data.rows;
    const copy = t();

    const names = unique(rows, function (row) {
      return { key: row.name_ja, value: row.name_ja, label: nameText(row) };
    }).sort(function (a, b) { return a.label.localeCompare(b.label, state.lang === "ja" ? "ja" : "en"); });

    const thicknesses = unique(rows, function (row) {
      const key = Number(row.thickness_mm).toFixed(1);
      return { key: key, value: key, label: key + " mm" };
    }).sort(function (a, b) { return Number(a.value) - Number(b.value); });

    const sizes = unique(rows, function (row) {
      return { key: row.size, value: row.size, label: sizeText(row), width: row.width_mm, length: row.length_mm };
    }).sort(function (a, b) { return a.width - b.width || a.length - b.length; });

    const masks = unique(rows, function (row) {
      if (!row.mask) return { key: "__empty", value: "__empty", label: copy.emptyMask };
      return { key: row.mask, value: row.mask, label: state.lang === "ja" ? row.mask : (row.mask_en || row.mask) };
    });

    const grades = unique(rows, function (row) {
      return { key: row.grade, value: row.grade, label: row.grade };
    }).sort(function (a, b) { return a.value.localeCompare(b.value); });

    [
      ["name", names],
      ["thickness", thicknesses],
      ["size", sizes],
      ["mask", masks],
      ["grade", grades]
    ].forEach(function (pair) {
      controls[pair[0]].span.textContent = copy[pair[0]];
      renderChoices(pair[0], pair[1]);
    });

    controls.clear.textContent = copy.clear;
    controls.clear.disabled = !filtersActive();
  }

  function badge(grade) {
    const node = document.createElement("span");
    node.className = "badge" + (grade === "S" ? " s" : "");
    node.textContent = grade;
    return node;
  }

  function paintResults() {
    const copy = t();
    const matched = data.rows.filter(matchRow);
    const totalTenths = matched.reduce(function (sum, row) { return sum + tenths(row.weight_kg); }, 0);
    const active = filtersActive();

    els.top.classList.toggle("is-filtered", active);
    els.weightLabel.textContent = active ? copy.filtered : copy.listed;
    els.weightValue.textContent = formatKg(totalTenths / 10);
    els.weightMeta.textContent = state.lang === "ja"
      ? formatInt(matched.length) + "行 / " + formatInt(data.rows.length) + "行"
      : formatInt(matched.length) + " of " + formatInt(data.rows.length) + " rows";
    controls.clear.disabled = !active;

    const headers = [
      [copy.page, false],
      [copy.code, false],
      [copy.name, false],
      [copy.thickness, true],
      [copy.size + " (" + (state.unit === "ft" ? "ft" : "mm") + ")", false],
      [copy.mask, false],
      [copy.sheets, true],
      [copy.grade, false],
      [copy.weight + " (kg)", true]
    ];
    const headRow = document.createElement("tr");
    headers.forEach(function (col) {
      const th = document.createElement("th");
      th.textContent = col[0];
      th.scope = "col";
      if (col[1]) th.className = "num";
      headRow.appendChild(th);
    });
    els.thead.replaceChildren(headRow);

    const mobile = window.matchMedia("(max-width: 1099px)").matches;
    els.tbody.replaceChildren();
    els.cards.replaceChildren();
    els.status.hidden = matched.length !== 0;
    els.status.textContent = matched.length ? "" : copy.none;

    if (!matched.length) return;

    if (mobile) {
      matched.forEach(function (row) {
        const card = document.createElement("article");
        card.className = "card" + (row.grade === "S" ? " grade-s" : "");
        const top = document.createElement("div");
        top.className = "card-top";
        const code = document.createElement("span");
        code.className = "card-code";
        code.textContent = row.color_code;
        top.append(code, badge(row.grade));
        const name = document.createElement("p");
        name.className = "card-name";
        name.textContent = nameText(row);
        const spec = document.createElement("p");
        spec.className = "card-spec";
        spec.textContent = thicknessText(row) + " · " + sizeText(row);
        const foot = document.createElement("div");
        foot.className = "card-foot";
        const meta = document.createElement("span");
        const sheets = state.lang === "ja"
          ? formatInt(row.sheet_count) + "枚"
          : formatInt(row.sheet_count) + " sheets";
        meta.textContent = copy.page + " " + row.page + " · " + copy.mask + " " + maskText(row) + " · " + sheets;
        const weight = document.createElement("span");
        weight.className = "card-weight";
        weight.textContent = formatKg(row.weight_kg) + " kg";
        foot.append(meta, weight);
        card.append(top, name, spec, foot);
        els.cards.appendChild(card);
      });
      return;
    }

    matched.forEach(function (row) {
      const tr = document.createElement("tr");
      if (row.grade === "S") tr.className = "grade-s";
      const cells = [
        [String(row.page), false],
        [row.color_code, false],
        [nameText(row), false],
        [thicknessText(row), true],
        [sizeText(row), false],
        [maskText(row), false],
        [formatInt(row.sheet_count), true],
        [null, false],
        [formatKg(row.weight_kg), true]
      ];
      cells.forEach(function (cell, index) {
        const td = document.createElement("td");
        if (cell[1]) td.className = "num";
        if (index === 7) td.appendChild(badge(row.grade));
        else td.textContent = cell[0];
        tr.appendChild(td);
      });
      els.tbody.appendChild(tr);
    });
  }

  function paint() {
    const doc = data.document;
    const copy = t();
    document.documentElement.lang = state.lang === "ja" ? "ja" : "en";
    document.title = state.lang === "ja" ? doc.title_ja : doc.title_en;
    els.date.textContent = dateText(doc);
    els.title.textContent = state.lang === "ja" ? doc.title_ja : doc.title_en;
    els.who.textContent = state.lang === "ja" ? doc.addressee_ja : doc.addressee_en;
    els.note.textContent = doc.pages_missing && doc.pages_missing.length ? copy.missing(doc.pages_missing) : "";
    els.hint.textContent = copy.hint;
    buildToggles();
    refreshFilterChoices();
    paintResults();
  }

  els.status.textContent = UI.en.loading;

  fetch(JSON_URL, { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    })
    .then(function (json) {
      data = json;
      buildFilters();
      paint();
      const layout = window.matchMedia("(max-width: 1099px)");
      layout.addEventListener("change", paintResults);
      const syncSticky = function () {
        document.documentElement.style.setProperty("--sticky-top", els.top.offsetHeight + "px");
      };
      syncSticky();
      window.addEventListener("resize", syncSticky);
    })
    .catch(function () {
      els.status.hidden = false;
      els.status.textContent = t().failed;
    });
})();
