(function () {
  "use strict";

  var STORAGE_KEY = "expirydesk:v1";
  var CATEGORIES = ["Food", "Medicine", "Cosmetics", "Documents", "Other"];
  var STATES = ["active", "used", "discarded"];

  var state = { items: [], threshold: 7 };
  var storageBroken = false;
  var editingId = null;
  var dashboardPreset = null;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- dates: local calendar days only ---------- */
  function parseLocalDate(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || "");
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
    return d;
  }
  function todayMidnight() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  function diffDays(expiryStr) {
    var d = parseLocalDate(expiryStr);
    if (!d) return null;
    return Math.round((d.getTime() - todayMidnight().getTime()) / 86400000);
  }
  function countdownText(diff) {
    if (diff === 0) return "Expires today";
    if (diff > 0) return "Expires in " + diff + (diff === 1 ? " day" : " days");
    var n = -diff;
    return "Expired " + n + (n === 1 ? " day ago" : " days ago");
  }
  function statusOf(item) {
    if (item.state !== "active") return item.state;
    var diff = diffDays(item.expiry);
    if (diff === null) return "safe";
    if (diff < 0) return "expired";
    if (diff <= state.threshold) return "soon";
    return "safe";
  }

  /* ---------- storage ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.items)) return;
      var items = [];
      data.items.forEach(function (it) {
        if (it && typeof it.id === "string" && typeof it.name === "string" && it.name.trim() &&
            CATEGORIES.indexOf(it.category) !== -1 && parseLocalDate(it.expiry) &&
            typeof it.notes === "string" && STATES.indexOf(it.state) !== -1) {
          items.push({ id: it.id, name: it.name, category: it.category, expiry: it.expiry, notes: it.notes, state: it.state });
        }
      });
      state.items = items;
      if ([3, 7, 14, 30].indexOf(data.threshold) !== -1) state.threshold = data.threshold;
    } catch (e) {
      storageBroken = true;
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageBroken = false;
    } catch (e) {
      storageBroken = true;
    }
    showStorageWarning();
  }
  function showStorageWarning() {
    var el = $("storageWarning");
    if (storageBroken) {
      el.textContent = "Your browser storage is not available, so changes will not survive a reload. Check your browser settings and try again.";
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  /* ---------- helpers for safe DOM ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function armButton(btn, armedText, ms, action) {
    var original = btn.textContent;
    if (btn.dataset.armed === "1") {
      delete btn.dataset.armed;
      btn.textContent = original;
      action();
      return;
    }
    btn.dataset.armed = "1";
    btn.textContent = armedText;
    btn.classList.add("danger-armed");
    setTimeout(function () {
      if (btn.dataset.armed === "1") {
        delete btn.dataset.armed;
        btn.textContent = original;
        btn.classList.remove("danger-armed");
      }
    }, ms || 3000);
  }

  /* ---------- item cards ---------- */
  function actionButton(label, fn) {
    var b = el("button", null, label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }
  function buildCard(item) {
    var status = statusOf(item);
    var diff = diffDays(item.expiry);
    var card = el("div", "item-card");
    var top = el("div", "item-top");
    top.appendChild(el("span", "item-name", item.name));
    top.appendChild(el("span", "category-chip", item.category));
    var badgeText = { safe: "Safe", soon: "Expiring soon", expired: "Expired", used: "Used", discarded: "Discarded" }[status];
    top.appendChild(el("span", "badge badge-" + status, badgeText));
    card.appendChild(top);
    var meta = el("div", null);
    meta.appendChild(el("span", "item-date", "Expires " + item.expiry));
    if (item.state === "active" && diff !== null) {
      meta.appendChild(document.createTextNode(" · "));
      var cd = el("span", "item-countdown " + status, countdownText(diff));
      meta.appendChild(cd);
    }
    card.appendChild(meta);
    if (item.notes) card.appendChild(el("p", "item-notes", item.notes));
    var actions = el("div", "item-actions");
    actions.appendChild(actionButton("Edit", function () { startEdit(item.id); }));
    if (item.state === "active") {
      actions.appendChild(actionButton("Mark used", function () { setState(item.id, "used"); }));
      actions.appendChild(actionButton("Mark discarded", function () { setState(item.id, "discarded"); }));
    } else {
      actions.appendChild(actionButton("Restore to active", function () { setState(item.id, "active"); }));
    }
    var del = actionButton("Delete", function () {});
    del.classList.add("danger");
    del.addEventListener("click", function () {
      armButton(del, "Tap again to delete", 3000, function () {
        state.items = state.items.filter(function (it) { return it.id !== item.id; });
        save();
        renderAll();
      });
    });
    actions.appendChild(del);
    card.appendChild(actions);
    return card;
  }
  function setState(id, next) {
    state.items.forEach(function (it) { if (it.id === id) it.state = next; });
    save();
    renderAll();
  }

  /* ---------- views ---------- */
  function showView(name) {
    ["dashboard", "items", "add", "settings"].forEach(function (v) {
      $("view-" + v).hidden = (v !== name);
    });
    document.querySelectorAll("[data-nav]").forEach(function (b) {
      if (b.dataset.nav === name) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    if (name === "items" && dashboardPreset) {
      $("statusFilter").value = dashboardPreset;
      dashboardPreset = null;
      renderItems();
    }
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("[data-nav]").forEach(function (b) {
    b.addEventListener("click", function () { showView(b.dataset.nav); });
  });
  document.querySelectorAll("[data-stat-filter]").forEach(function (b) {
    b.addEventListener("click", function () {
      dashboardPreset = b.dataset.statFilter;
      showView("items");
    });
  });

  /* ---------- dashboard ---------- */
  function renderDashboard() {
    var active = state.items.filter(function (it) { return it.state === "active"; });
    var soon = active.filter(function (it) { return statusOf(it) === "soon"; });
    var expired = active.filter(function (it) { return statusOf(it) === "expired"; });
    $("statSoon").textContent = String(soon.length);
    $("statExpired").textContent = String(expired.length);
    $("statActive").textContent = String(active.length);

    var byDate = function (a, b) { return a.expiry < b.expiry ? -1 : (a.expiry > b.expiry ? 1 : 0); };
    var soonList = $("soonList");
    soonList.textContent = "";
    soon.slice().sort(byDate).slice(0, 5).forEach(function (it) { soonList.appendChild(buildCard(it)); });
    $("soonEmpty").hidden = soon.length > 0;
    var expList = $("expiredList");
    expList.textContent = "";
    expired.slice().sort(byDate).slice(0, 5).forEach(function (it) { expList.appendChild(buildCard(it)); });
    $("expiredEmpty").hidden = expired.length > 0;
  }

  /* ---------- all items ---------- */
  function renderItems() {
    var q = ($("searchInput").value || "").trim().toLowerCase();
    var cat = $("categoryFilter").value;
    var st = $("statusFilter").value;
    var sort = $("sortSelect").value;
    var list = state.items.filter(function (it) {
      if (cat !== "all" && it.category !== cat) return false;
      if (st === "active" && it.state !== "active") return false;
      if (st !== "all" && st !== "active" && statusOf(it) !== st) return false;
      if (q && it.name.toLowerCase().indexOf(q) === -1 && it.notes.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (sort === "alpha") return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0);
      if (sort === "latest") return a.expiry < b.expiry ? 1 : (a.expiry > b.expiry ? -1 : 0);
      return a.expiry < b.expiry ? -1 : (a.expiry > b.expiry ? 1 : 0);
    });
    var container = $("itemsList");
    container.textContent = "";
    list.forEach(function (it) { container.appendChild(buildCard(it)); });
    $("resultCount").textContent = list.length + (list.length === 1 ? " item shown" : " items shown") + " of " + state.items.length + " total.";
    $("itemsEmpty").hidden = state.items.length > 0;
    $("itemsNoMatch").hidden = !(state.items.length > 0 && list.length === 0);
  }

  /* ---------- add / edit ---------- */
  function resetForm() {
    editingId = null;
    $("formHeading").textContent = "Add Item";
    $("submitBtn").textContent = "Save item";
    $("cancelEditBtn").hidden = true;
    $("itemForm").reset();
    $("formMessage").hidden = true;
    ["nameError", "categoryError", "dateError"].forEach(function (id) { $(id).hidden = true; });
    ["itemName", "itemCategory", "itemDate"].forEach(function (id) { $(id).removeAttribute("aria-invalid"); });
  }
  function startEdit(id) {
    var item = null;
    state.items.forEach(function (it) { if (it.id === id) item = it; });
    if (!item) return;
    editingId = id;
    $("formHeading").textContent = "Edit Item";
    $("submitBtn").textContent = "Save changes";
    $("cancelEditBtn").hidden = false;
    $("itemName").value = item.name;
    $("itemCategory").value = item.category;
    $("itemDate").value = item.expiry;
    $("itemNotes").value = item.notes;
    $("formMessage").hidden = true;
    showView("add");
  }
  $("cancelEditBtn").addEventListener("click", function () { resetForm(); showView("items"); });
  $("itemForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("itemName").value.trim();
    var category = $("itemCategory").value;
    var expiry = $("itemDate").value;
    var notes = $("itemNotes").value.trim();
    var ok = true;
    function flag(inputId, errId, bad) {
      $(errId).hidden = !bad;
      if (bad) $(inputId).setAttribute("aria-invalid", "true");
      else $(inputId).removeAttribute("aria-invalid");
      if (bad) ok = false;
    }
    flag("itemName", "nameError", !name);
    flag("itemCategory", "categoryError", CATEGORIES.indexOf(category) === -1);
    flag("itemDate", "dateError", !parseLocalDate(expiry));
    if (!ok) return;
    if (editingId) {
      state.items.forEach(function (it) {
        if (it.id === editingId) { it.name = name; it.category = category; it.expiry = expiry; it.notes = notes; }
      });
    } else {
      var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ("id-" + Date.now() + "-" + Math.floor(Math.random() * 1000000));
      state.items.push({ id: id, name: name, category: category, expiry: expiry, notes: notes, state: "active" });
    }
    save();
    var msg = $("formMessage");
    msg.textContent = editingId ? "Changes saved." : "Item saved.";
    msg.classList.remove("error");
    msg.hidden = false;
    resetForm();
    renderAll();
    showView("items");
  });

  /* ---------- filters ---------- */
  ["searchInput", "categoryFilter", "statusFilter", "sortSelect"].forEach(function (id) {
    $(id).addEventListener("input", renderItems);
    $(id).addEventListener("change", renderItems);
  });

  /* ---------- settings ---------- */
  document.querySelectorAll('input[name="threshold"]').forEach(function (r) {
    r.addEventListener("change", function () {
      state.threshold = Number(r.value);
      save();
      renderAll();
    });
  });
  function syncThresholdRadios() {
    document.querySelectorAll('input[name="threshold"]').forEach(function (r) {
      r.checked = (Number(r.value) === state.threshold);
    });
  }
  $("exportBtn").addEventListener("click", function () {
    var payload = { app: "ExpiryDesk", version: 1, exportedAt: new Date().toISOString(), threshold: state.threshold, items: state.items };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    var d = new Date();
    var stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    a.download = "expirydesk-backup-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    var msg = $("backupMessage");
    msg.textContent = "Backup exported with " + state.items.length + (state.items.length === 1 ? " item." : " items.");
    msg.classList.remove("error");
    msg.hidden = false;
  });
  $("importFile").addEventListener("change", function () {
    var file = $("importFile").files[0];
    var msg = $("backupMessage");
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.items)) throw new Error("bad shape");
        // All-or-nothing validation: any invalid record rejects the whole file,
        // and nothing (items or threshold) is changed.
        var seenInFile = {};
        var invalid = 0;
        data.items.forEach(function (it) {
          if (!it || typeof it.id !== "string" || !it.id ||
              typeof it.name !== "string" || !it.name.trim() ||
              CATEGORIES.indexOf(it.category) === -1 || !parseLocalDate(it.expiry) ||
              typeof it.notes !== "string" || STATES.indexOf(it.state) === -1 ||
              seenInFile[it.id]) { invalid++; return; }
          seenInFile[it.id] = true;
        });
        if (invalid > 0) {
          msg.textContent = "Import rejected: " + invalid + (invalid === 1 ? " record is invalid" : " records are invalid") + " (bad date, category, status, missing field, or a duplicate ID inside the file). Nothing was changed.";
          msg.classList.add("error");
          msg.hidden = false;
          return;
        }
        var existing = {};
        state.items.forEach(function (it) { existing[it.id] = true; });
        var added = 0, skipped = 0;
        data.items.forEach(function (it) {
          if (existing[it.id]) { skipped++; return; }
          existing[it.id] = true;
          state.items.push({ id: it.id, name: it.name.trim(), category: it.category, expiry: it.expiry, notes: it.notes, state: it.state });
          added++;
        });
        if ([3, 7, 14, 30].indexOf(data.threshold) !== -1 && added > 0) state.threshold = data.threshold;
        save();
        syncThresholdRadios();
        renderAll();
        msg.textContent = "Import done: " + added + " added, " + skipped + " already present skipped.";
        msg.classList.remove("error");
        msg.hidden = false;
      } catch (e) {
        msg.textContent = "That file is not a valid ExpiryDesk backup. Nothing was changed.";
        msg.classList.add("error");
        msg.hidden = false;
      }
    };
    reader.onerror = function () {
      msg.textContent = "The file could not be read. Nothing was changed.";
      msg.classList.add("error");
      msg.hidden = false;
    };
    reader.readAsText(file);
    $("importFile").value = "";
  });
  $("clearBtn").addEventListener("click", function () {
    var btn = $("clearBtn");
    armButton(btn, "Tap again to clear everything", 3000, function () {
      state.items = [];
      state.threshold = 7;
      try { localStorage.removeItem(STORAGE_KEY); storageBroken = false; } catch (e) { storageBroken = true; }
      showStorageWarning();
      syncThresholdRadios();
      renderAll();
      var msg = $("clearMessage");
      msg.textContent = "All data cleared.";
      msg.classList.remove("error");
      msg.hidden = false;
    });
    btn.classList.add("armed");
    setTimeout(function () { btn.classList.remove("armed"); }, 3000);
  });

  /* ---------- boot ---------- */
  function renderAll() {
    renderDashboard();
    renderItems();
    syncThresholdRadios();
  }
  load();
  showStorageWarning();
  renderAll();
  showView("dashboard");
})();
