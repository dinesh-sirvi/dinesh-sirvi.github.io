(function () {
  const JSON_URL = new URL("scrap_details_2026-10-10.json", document.baseURI);
  const MM_PER_FOOT = 304.8;

  const UI = {
    en: {
      titleFallback: "Scrap details",
      search: "Search",
      searchPh: "Color code or name",
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
      hint: "Every selected filter applies together.",
      missing: function (pages) { return "Page " + pages.join(", ") + " is not included."; },
      langName: "Language",
      unitName: "Size unit"
    },
    ja: {
      titleFallback: "スクラップ明細",
      search: "検索",
      searchPh: "色番・呼称",
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
      hint: "選んだ条件はすべて同時に適用されます。",
      missing: function (pages) { return pages.join("、") + "ページは含まれていません。"; },
      langName: "言語",
      unitName: "寸法単位"
    }
  };

  const state = {
    lang: "en",
    unit: localStorage.getItem("scrap-unit") === "ft" ? "ft" : "mm",
    filters: { q: "", page: "", code: "", name: "", thickness: "", size: "", mask: "", grade: "" }
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
    return Object.values(state.filters).some(function (v) { return String(v).trim() !== ""; });
  }

  function matchRow(row) {
    const f = state.filters;
    if (f.q.trim()) {
      const hay = (row.color_code + " " + row.name_ja + " " + row.name_en).toLowerCase();
      if (hay.indexOf(f.q.trim().toLowerCase()) === -1) return false;
    }
    if (f.page && String(row.page) !== f.page) return false;
    if (f.code && row.color_code !== f.code) return false;
    if (f.name && row.name_ja !== f.name) return false;
    if (f.thickness && Number(row.thickness_mm).toFixed(1) !== f.thickness) return false;
    if (f.size && row.size !== f.size) return false;
    if (f.mask === "__empty" && row.mask) return false;
    if (f.mask && f.mask !== "__empty" && row.mask !== f.mask) return false;
    if (f.grade && row.grade !== f.grade) return false;
    return true;
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

  function option(value, label) {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    return node;
  }

  function fillSelect(select, items, current) {
    const next = document.createDocumentFragment();
    items.forEach(function (item) { next.appendChild(option(item.value, item.label)); });
    select.replaceChildren(next);
    select.value = items.some(function (item) { return item.value === current; }) ? current : "";
    if (select.value !== current) state.filters[select.dataset.key] = select.value;
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

  function buildFilters() {
    const spec = [
      ["q", "search", "search"],
      ["page", "page", "select"],
      ["code", "code", "select"],
      ["name", "name", "select"],
      ["thickness", "thickness", "select"],
      ["size", "size", "select"],
      ["mask", "mask", "select"],
      ["grade", "grade", "select"]
    ];
    els.filters.replaceChildren();
    spec.forEach(function (item) {
      const key = item[0];
      const labelKey = item[1];
      const kind = item[2];
      const field = document.createElement("label");
      field.className = "field" + (key === "q" ? " search" : "");
      const span = document.createElement("span");
      span.dataset.label = labelKey;
      const input = kind === "search" ? document.createElement("input") : document.createElement("select");
      if (kind === "search") {
        input.type = "search";
        input.dataset.key = "q";
        input.addEventListener("input", function () {
          state.filters.q = input.value;
          paintResults();
        });
      } else {
        input.dataset.key = key;
        input.addEventListener("change", function () {
          state.filters[key] = input.value;
          paintResults();
        });
      }
      field.append(span, input);
      els.filters.appendChild(field);
      controls[key] = { span: span, input: input };
    });

    const clearField = document.createElement("div");
    clearField.className = "field clear";
    const clearLabel = document.createElement("span");
    clearLabel.textContent = " ";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.id = "clear";
    clearBtn.addEventListener("click", function () {
      state.filters = { q: "", page: "", code: "", name: "", thickness: "", size: "", mask: "", grade: "" };
      controls.q.input.value = "";
      paint();
    });
    clearField.append(clearLabel, clearBtn);
    els.filters.appendChild(clearField);
    controls.clear = clearBtn;

    els.filters.addEventListener("submit", function (event) { event.preventDefault(); });
  }

  function refreshFilterChoices() {
    const rows = data.rows;
    const copy = t();
    controls.q.span.textContent = copy.search;
    controls.q.input.placeholder = copy.searchPh;
    controls.q.input.value = state.filters.q;

    const pages = unique(rows, function (row) {
      return { key: String(row.page), value: String(row.page), label: String(row.page) };
    }).sort(function (a, b) { return Number(a.value) - Number(b.value); });

    const codes = unique(rows, function (row) {
      return { key: row.color_code, value: row.color_code, label: row.color_code };
    }).sort(function (a, b) { return a.value.localeCompare(b.value, "en", { numeric: true }); });

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
      ["page", pages],
      ["code", codes],
      ["name", names],
      ["thickness", thicknesses],
      ["size", sizes],
      ["mask", masks],
      ["grade", grades]
    ].forEach(function (pair) {
      const key = pair[0];
      controls[key].span.textContent = copy[key];
      fillSelect(controls[key].input, [{ value: "", label: copy.all }].concat(pair[1]), state.filters[key]);
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
