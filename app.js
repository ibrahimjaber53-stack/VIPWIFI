/**
 * منظومة حسابات كروت الواي فاي - VIP WIFI v3.5.0-mobile
 * تطوير وتصميم: م/ ابراهيم جابر
 * كود برمجي نقي (Vanilla JS) متكامل لتشغيل فوري، أوفلاين وملائم للتطبيقات APK.
 */

// 1. HIGH-PERFORMANCE GLOBAL LOCAL INDEXEDDB DATABASE PROXY
const LocalDB = {
  db: null,
  init() {
    return new Promise((resolve) => {
      const request = indexedDB.open("VipWifiLocalDBStore", 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("keyvalue")) {
          db.createObjectStore("keyvalue");
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = () => {
        console.warn("IndexedDB rejected. Falling back to localStorage proxy safely.");
        resolve();
      };
    });
  },
  getItem(key) {
    return new Promise((resolve) => {
      if (!this.db) {
        resolve(localStorage.getItem(key));
        return;
      }
      try {
        const tx = this.db.transaction(["keyvalue"], "readonly");
        const store = tx.objectStore("keyvalue");
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(localStorage.getItem(key));
      } catch (err) {
        resolve(localStorage.getItem(key));
      }
    });
  },
  setItem(key, val) {
    return new Promise((resolve) => {
      if (!this.db) {
        localStorage.setItem(key, val);
        resolve();
        return;
      }
      try {
        const tx = this.db.transaction(["keyvalue"], "readwrite");
        const store = tx.objectStore("keyvalue");
        store.put(val, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          localStorage.setItem(key, val);
          resolve();
        };
      } catch (err) {
        localStorage.setItem(key, val);
        resolve();
      }
    });
  },
  removeItem(key) {
    return new Promise((resolve) => {
      if (!this.db) {
        localStorage.removeItem(key);
        resolve();
        return;
      }
      try {
        const tx = this.db.transaction(["keyvalue"], "readwrite");
        const store = tx.objectStore("keyvalue");
        store.delete(key);
        tx.oncomplete = () => resolve();
      } catch (err) {
        localStorage.removeItem(key);
        resolve();
      }
    });
  },
  clear() {
    return new Promise((resolve) => {
      if (!this.db) {
        localStorage.clear();
        resolve();
        return;
      }
      try {
        const tx = this.db.transaction(["keyvalue"], "readwrite");
        const store = tx.objectStore("keyvalue");
        store.clear();
        tx.oncomplete = () => resolve();
      } catch (err) {
        localStorage.clear();
        resolve();
      }
    });
  },
  getAllData() {
    return new Promise((resolve) => {
      if (!this.db) {
        const dump = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          dump[k] = localStorage.getItem(k);
        }
        resolve(dump);
        return;
      }
      try {
        const tx = this.db.transaction(["keyvalue"], "readonly");
        const store = tx.objectStore("keyvalue");
        const cursorReq = store.openCursor();
        const data = {};
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            data[cursor.key] = cursor.value;
            cursor.continue();
          } else {
            resolve(data);
          }
        };
        cursorReq.onerror = () => {
          resolve({});
        };
      } catch (err) {
        resolve({});
      }
    });
  }
};

// 2. CENTRALIZED INSTANT APPLICATION STATE WITH DEFAULTS
let appState = {
  selectedDayNum: "",
  selectedMonthNum: "",
  selectedYearNum: "",
  selectedDayName: "",
  selectedTimeStr: "",
  
  traderName: "", // current active selected trader
  traderPhone: "",
  savedTradersList: [], // array of objects/names: e.g. ["الأصدقاء", "العميد"]
  
  categories: [
    { label: "كارت 20 جنيه", color: "#f8fafc", value: 20 },
    { label: "كارت 30 جنيه", color: "#f0fdf4", value: 30 },
    { label: "كارت 50 جنيه", color: "#ecfdf5", value: 50 },
    { label: "كارت 100 جنيه", color: "#fffbeb", value: 100 }
  ],
  inventory: {}, // { "trader": { "catLabel": count } }
  midMonth: {}, // { "trader": { "catLabel": [{count, date}, ...] } }
  remaining: {}, // { "trader": { "catLabel": count } }
  discountPercentage: 5,
  savedTradersLog: [], // local transaction actions logs
  traderArchive: {}, // archived finalized billing: { "trader_period": InvoiceObject }
  isTraderVersion: false
};

// Default Date calculations in Arabic
const arabicMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const arabicDays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function initDates() {
  const now = new Date();
  appState.selectedDayNum = now.getDate().toString();
  appState.selectedMonthNum = (now.getMonth() + 1).toString();
  appState.selectedYearNum = now.getFullYear().toString();
  appState.selectedDayName = arabicDays[now.getDay()];
  appState.selectedTimeStr = getFormattedTime(now);
}

function getFormattedTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours.toString().padStart(2, '0')}:${minutes} ${period}`;
}

// 3. STARTUP INITIALIZATION SEQUENCE
document.addEventListener("DOMContentLoaded", async () => {
  // Read optional app configuration
  const ver = typeof AppConfig !== "undefined" ? AppConfig.appVersion : "3.5.0-mobile";
  document.getElementById("version-badge").innerText = `الأوفلاين المميز v${ver}`;

  // Check URL params for testing/forced views
  const params = new URLSearchParams(window.location.search);
  const employeeForce = params.get("mode") === "employee";
  const traderForce = params.get("mode") === "trader" || params.get("trader");
  
  if (traderForce) {
    appState.isTraderVersion = true;
    appState.traderName = typeof traderForce === "string" && traderForce !== "true" ? decodeURIComponent(traderForce) : "العميل التجريبي";
    document.getElementById("app-title-text").innerText = `حساب كروت التاجر`;
    document.getElementById("sidebar-trader-name").innerText = `${appState.traderName}`;
  }

  // Bind ticking clock
  startTickingClock();

  // Initialize IndexedDB database connection
  try {
    await LocalDB.init();
    
    // Load state from IndexedDB
    const saved = await LocalDB.getItem("vip_wifi_v3_storage");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) {
          appState = { ...appState, ...parsed };
        }
      } catch (err) {
        console.error("Failed to parse saved IndexedDB JSON:", err);
      }
    }
  } catch (err) {
    console.error("IndexedDB startup crash. Safely skipping splash:", err);
  }

  // If dates are pristine, load actual clock presets
  if (!appState.selectedDayNum) {
    initDates();
  }

  // Sync state values with Inputs UI
  syncStateToInputs();

  // Hide loader
  document.getElementById("splash-screen").style.display = "none";
  document.getElementById("app-container").style.display = "block";

  // If force trader screen, lock bottom bars non-requisites
  if (appState.isTraderVersion) {
    restrictUIForTrader();
    navigateToScreen(2); // Jump straight to inventory
  } else {
    navigateToScreen(1); // Jump to dashboard
  }

  // Attach event listeners for inputs & interactions
  attachUserEvents();
  
  // Render Dynamic Category badges and listings
  refreshCategoriesUI();
  
  // Render dynamic tables
  refreshInventoryTable();
  refreshRemainingTable();
  calculateVoucherInvoice();
  refreshArchiveTable();
  
  showToast("تم تهيئة قاعدة البيانات المحلية للأجهزة بنجاح!", "success");
});

// Dynamic Clock
function startTickingClock() {
  const clockEl = document.getElementById("live-digital-clock");
  const updateText = () => {
    const now = new Date();
    const dayName = arabicDays[now.getDay()];
    const hours = now.getHours();
    const period = hours >= 12 ? 'م' : 'ص';
    const cleanHours = (hours % 12 || 12).toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    clockEl.innerText = `${dayName} | ${cleanHours}:${minutes}:${seconds} ${period}`;
  };
  updateText();
  setInterval(updateText, 1000);
}

// Write Changes to IndexedDB safely
async function saveAppState() {
  await LocalDB.setItem("vip_wifi_v3_storage", JSON.stringify(appState));
}

// 4. RESTRICT TO TRADER VERSION IF FLAGGED
function restrictUIForTrader() {
  // Hide Screen 1, Screen 6 button tabs
  document.getElementById("tab-btn-1").style.display = "none";
  document.getElementById("tab-btn-5").style.display = "none";
  
  // Hide setup items or edit areas
  const setups = document.querySelectorAll(".sidebar-nav-item");
  setups.forEach((item, idx) => {
    if (idx === 0 || idx === 4 || idx === 5) {
      item.style.display = "none";
    }
  });

  // Inject only active trader name
  if (appState.savedTradersList.indexOf(appState.traderName) === -1) {
    appState.savedTradersList.push(appState.traderName);
  }
}

// Sync inputs
function syncStateToInputs() {
  document.getElementById("input-day-num").value = appState.selectedDayNum;
  document.getElementById("input-month-num").value = appState.selectedMonthNum;
  
  const currentY = new Date().getFullYear().toString();
  document.getElementById("input-year-num").value = appState.selectedYearNum || currentY;
  
  updatePeriodDisplayString();
  populateTradersDropdowns();
}

function updatePeriodDisplayString() {
  const d = document.getElementById("input-day-num").value;
  const mIndex = parseInt(document.getElementById("input-month-num").value) - 1;
  const y = document.getElementById("input-year-num").value;
  const mName = arabicMonths[mIndex] || "";
  
  const displayStr = `الجلسة النشطة: يوم الجرد ${d} من شهر ${mName} لعام ${y}`;
  document.getElementById("selected-period-display-text").innerText = displayStr;
}

function populateTradersDropdowns() {
  const dropdown2 = document.getElementById("screen2-trader-select");
  const dropdownA = document.getElementById("archive-filter-trader");
  const dropdownM = document.getElementById("midmonth-cat-select");
  
  // Screen 2 selector
  dropdown2.innerHTML = "";
  if (appState.isTraderVersion) {
    const opt = document.createElement("option");
    opt.value = appState.traderName;
    opt.textContent = `👤 ${appState.traderName}`;
    dropdown2.appendChild(opt);
    dropdown2.disabled = true;
  } else {
    dropdown2.disabled = false;
    appState.savedTradersList.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = `👤 ${name}`;
      if (name === appState.traderName) opt.selected = true;
      dropdown2.appendChild(opt);
    });
  }

  // Archives selector
  dropdownA.innerHTML = '<option value="ALL">جميع التجار والعملاء</option>';
  appState.savedTradersList.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = `👤 ${name}`;
    dropdownA.appendChild(opt);
  });

  // Mid month additions options
  dropdownM.innerHTML = "";
  appState.categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.label;
    opt.textContent = cat.label;
    dropdownM.appendChild(opt);
  });
}

// 5. SCREEN VISIBILITY CHANGING MATRIX
function navigateToScreen(index) {
  const screens = document.querySelectorAll(".app-screen");
  const tabs = document.querySelectorAll(".nav-tab-button");
  
  screens.forEach((sc, idx) => {
    if (idx + 1 === index) {
      sc.classList.add("active");
    } else {
      sc.classList.remove("active");
    }
  });

  tabs.forEach((tb, idx) => {
    if (idx + 1 === index) {
      tb.classList.add("active");
    } else {
      tb.classList.remove("active");
    }
  });

  // Trigger state context loads
  if (index === 2) {
    const select = document.getElementById("screen2-trader-select");
    if (select.value) {
      appState.traderName = select.value;
    }
    refreshInventoryTable();
    refreshMidMonthLogs();
  } else if (index === 3) {
    document.getElementById("screen3-active-trader-header").innerText = `التاجر الخاضع للجرد: ${appState.traderName || 'لم يتم تحديده'}`;
    refreshRemainingTable();
  } else if (index === 4) {
    calculateVoucherInvoice();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navigateAndClose(index) {
  navigateToScreen(index);
  document.getElementById("sidebar-shutter").classList.remove("active");
  document.getElementById("sidebar-drawer-menu").classList.remove("active");
}

// 6. DYNAMIC UI RENDERING ENGINES
function refreshCategoriesUI() {
  const grid = document.getElementById("category-badge-grid");
  grid.innerHTML = "";
  
  appState.categories.forEach((cat, idx) => {
    const el = document.createElement("div");
    el.className = "category-card";
    el.style.backgroundColor = cat.color || "#ffffff";
    
    el.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="category-badge-color" style="background-color: ${cat.color}"></span>
        <div style="display: flex; flex-direction: column;">
          <span style="font-weight: 900; font-size: 12.5px; color: #1e1b4b;">${cat.label}</span>
          <span style="font-size: 10px; color: var(--text-muted); font-weight: 800;">سعر الكارت: ${cat.value} ج.م</span>
        </div>
      </div>
      <button onclick="deleteCategoryByIndex(${idx})" style="border: none; background: transparent; color: var(--danger); font-size: 13px; font-weight:900; cursor: pointer; padding: 4px;" aria-label="حذف">🗑️</button>
    `;
    grid.appendChild(el);
  });
}

function deleteCategoryByIndex(index) {
  if (appState.categories.length <= 1) {
    showToast("لا يمكن تصفير الفئات بالكامل! يجب إبقاء فئة واحدة على الأقل.", "error");
    return;
  }
  const label = appState.categories[index].label;
  if (confirm(`هل أنت متأكد من حذف فئة الكروت (${label})؟ سيتم مسح قيود جردها المرتبطة بالكامل.`)) {
    appState.categories.splice(index, 1);
    saveAppState().then(() => {
      refreshCategoriesUI();
      populateTradersDropdowns();
      refreshInventoryTable();
      refreshRemainingTable();
      calculateVoucherInvoice();
      showToast("تم إزالة الفئة بنجاح من جميع جداول الكروت والموزعين.", "success");
    });
  }
}

// Inventory Screen Builder
function refreshInventoryTable() {
  const tbody = document.getElementById("inventory-table-body");
  tbody.innerHTML = "";
  
  const trader = appState.traderName || "";
  if (!trader) {
    tbody.innerHTML = '<tr><td colspan="3" style="color: var(--text-muted); padding: 16px;">الرجاء اختيار تاجر نشط للبدء!</td></tr>';
    return;
  }

  if (!appState.inventory[trader]) appState.inventory[trader] = {};

  appState.categories.forEach(cat => {
    const tr = document.createElement("tr");
    
    const count = appState.inventory[trader][cat.label] !== undefined ? appState.inventory[trader][cat.label] : "";
    
    tr.innerHTML = `
      <td style="font-weight: 900; color: #1e1b4b; background-color: ${cat.color}">${cat.label}</td>
      <td style="font-size: 10.5px; color: var(--text-muted); font-weight: 850;">إجمالي الباكت المتبدل</td>
      <td>
        <input type="number" 
               class="compact-input inventory-manual-cell" 
               data-cat="${cat.label}" 
               value="${count}" 
               placeholder="0"
               min="0"
               pattern="[0-9]*"
               inputMode="numeric">
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach dynamic updates for inventory cells
  document.querySelectorAll(".inventory-manual-cell").forEach(cell => {
    cell.addEventListener("input", (e) => {
      const catLabel = e.target.getAttribute("data-cat");
      let val = parseInt(e.target.value);
      if (isNaN(val) || val < 0) val = 0;
      
      appState.inventory[trader][catLabel] = val;
      saveAppState().then(() => {
        calculateVoucherInvoice();
      });
    });
    cell.addEventListener("keydown", (e) => {
      if (['-', '+', '.', 'e'].includes(e.key)) {
        e.preventDefault();
      }
    });
  });
}

// Shift middle additions values logging
function refreshMidMonthLogs() {
  const container = document.getElementById("trader-midmonth-logs");
  container.innerHTML = "";
  
  const trader = appState.traderName;
  if (!trader || !appState.midMonth[trader]) {
    container.innerHTML = '<p style="font-size: 10px; color: var(--text-muted); font-weight:800; text-align: center;">لا يوجد سجل توريدات إضافية.</p>';
    return;
  }

  let hasItems = false;
  appState.categories.forEach(cat => {
    const list = appState.midMonth[trader][cat.label] || [];
    list.forEach((item, idx) => {
      hasItems = true;
      const row = document.createElement("div");
      row.style.background = "#ffffff";
      row.style.border = "1px solid var(--border-color)";
      row.style.padding = "6px 10px";
      row.style.borderRadius = "8px";
      row.style.fontSize = "10px";
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      
      row.innerHTML = `
        <div>
          <span style="font-weight: 900; color: var(--success); font-size:11px;">+ ${item.count} كارت</span>
          <span style="color: var(--text-main); font-weight: 850;">من فئة (${cat.label})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="color: var(--text-muted); font-size: 9px;">📆 ${item.date}</span>
          <button onclick="deleteMidMonthEntry('${cat.label}', ${idx})" style="border:none; background:transparent; color: var(--danger); font-size:11px; cursor:pointer;">❌</button>
        </div>
      `;
      container.appendChild(row);
    });
  });

  if (!hasItems) {
    container.innerHTML = '<p style="font-size: 10px; color: var(--text-muted); font-weight:800; text-align: center;">سجل التوريدات الإضافية فارغ حالياً.</p>';
  }
}

function deleteMidMonthEntry(catLabel, idx) {
  const trader = appState.traderName;
  if (confirm("هل تعتزم إلغاء توريدة الكروت الإضافية هذه فعلاً؟")) {
    appState.midMonth[trader][catLabel].splice(idx, 1);
    saveAppState().then(() => {
      refreshMidMonthLogs();
      refreshInventoryTable();
      refreshRemainingTable();
      calculateVoucherInvoice();
      showToast("تم إلغاء وشطب التوريدة بنجاح.", "success");
    });
  }
}

// Remaining Screen Builder
function refreshRemainingTable() {
  const tbody = document.getElementById("remaining-table-body");
  tbody.innerHTML = "";
  
  const trader = appState.traderName || "";
  if (!trader) {
    tbody.innerHTML = '<tr><td colspan="3" style="color: var(--text-muted); padding: 16px;">الرجاء اختيار تاجر نشط أولاً!</td></tr>';
    return;
  }

  if (!appState.remaining[trader]) appState.remaining[trader] = {};

  appState.categories.forEach(cat => {
    const tr = document.createElement("tr");
    
    // total received count (inventory starting + mid-month)
    const startInv = appState.inventory[trader] && appState.inventory[trader][cat.label] !== undefined ? appState.inventory[trader][cat.label] : 0;
    const midAdds = appState.midMonth[trader] && appState.midMonth[trader][cat.label] ? appState.midMonth[trader][cat.label].reduce((sum, item) => sum + (item.count || 0), 0) : 0;
    const totalRec = startInv + midAdds;
    
    // remaining
    const remainingCount = appState.remaining[trader][cat.label] !== undefined ? appState.remaining[trader][cat.label] : "";
    
    tr.innerHTML = `
      <td style="font-weight: 900; color: #1e1b4b; background-color: ${cat.color}">${cat.label}</td>
      <td style="font-size: 11.5px; font-weight: 850; color: var(--primary);">${totalRec} كارت</td>
      <td>
        <input type="number" 
               class="compact-input remaining-manual-cell" 
               data-cat="${cat.label}" 
               value="${remainingCount}" 
               placeholder="0"
               min="0"
               pattern="[0-9]*"
               inputMode="numeric">
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach listeners
  document.querySelectorAll(".remaining-manual-cell").forEach(cell => {
    cell.addEventListener("input", (e) => {
      const catLabel = e.target.getAttribute("data-cat");
      let val = parseInt(e.target.value);
      if (isNaN(val) || val < 0) val = 0;
      
      appState.remaining[trader][catLabel] = val;
      saveAppState().then(() => {
        calculateVoucherInvoice();
      });
    });
    cell.addEventListener("keydown", (e) => {
      if (['-', '+', '.', 'e'].includes(e.key)) {
        e.preventDefault();
      }
    });
  });
}

// 7. POWERFUL FINANCIAL INVOICE COMPILING MATRIX
function calculateVoucherInvoice() {
  const trader = appState.traderName || "";
  const periodStr = `${appState.selectedDayNum} / ${appState.selectedMonthNum} / ${appState.selectedYearNum}`;
  
  // Header badges update
  document.getElementById("invoice-trader-badge").innerText = trader || "لم يحدد";
  document.getElementById("invoice-voucher-trader-name").innerText = `الموزع: ${trader || 'غير مسمى'}`;
  document.getElementById("invoice-voucher-period").innerText = periodStr;
  
  const phone = trader ? (localStorage.getItem(`phone_${trader}`) || "") : "";
  document.getElementById("invoice-voucher-phone").innerText = phone ? `📱 الاتصال: ${phone}` : "تصفية محلية فورية";
  
  // Live formatted document date
  const now = new Date();
  const formatStamp = `بتوقيت: ${arabicDays[now.getDay()]}، ${now.getDate()} ${arabicMonths[now.getMonth()]} ${now.getFullYear()} | الساعة ${getFormattedTime(now)}`;
  document.getElementById("invoice-voucher-time-display").innerText = formatStamp;

  const tbody = document.getElementById("invoice-voucher-tbody");
  tbody.innerHTML = "";

  if (!trader) {
    tbody.innerHTML = '<tr><td colspan="5" style="color: var(--text-muted); padding: 24px; text-align: center;">الرجاء اختيار وتحديد موزع لإنشاء الفاتورة المالية!</td></tr>';
    return;
  }

  let totalSoldCards = 0;
  let totalGrossAmount = 0;

  appState.categories.forEach(cat => {
    // start
    const startInv = appState.inventory[trader] && appState.inventory[trader][cat.label] !== undefined ? appState.inventory[trader][cat.label] : 0;
    // middle
    const midAdds = appState.midMonth[trader] && appState.midMonth[trader][cat.label] ? appState.midMonth[trader][cat.label].reduce((sum, item) => sum + (item.count || 0), 0) : 0;
    const totalRec = startInv + midAdds;
    // remaining
    const rem = appState.remaining[trader] && appState.remaining[trader][cat.label] !== undefined ? appState.remaining[trader][cat.label] : 0;
    
    // sold is capped inside Math.max and remaining capped
    let sold = totalRec - rem;
    if (sold < 0) sold = 0; // cap negatives

    const grossValue = Math.floor(sold * cat.value);
    totalSoldCards += sold;
    totalGrossAmount += grossValue;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight: 850; text-align: right; background-color: ${cat.color}">${cat.label}</td>
      <td style="color: var(--text-muted); font-weight:800;">${totalRec}</td>
      <td style="color: var(--text-muted); font-weight:800;">${rem}</td>
      <td style="color: var(--primary); font-weight: 900; font-size:12.5px;">${sold}</td>
      <td style="text-align: left; font-weight: 950; color: var(--text-main);">${grossValue} ج.م</td>
    `;
    tbody.appendChild(tr);
  });

  // Calculate discount & net rounding
  const rate = Math.floor(Number(appState.discountPercentage) || 0);
  const discountVal = Math.floor((totalGrossAmount * rate) / 100);
  const netAmount = Math.floor(Math.max(0, totalGrossAmount - discountVal));

  document.getElementById("invoice-voucher-discount-rate").innerText = rate;
  document.getElementById("invoice-voucher-total-sold-count").innerText = `${totalSoldCards} كارت مباع`;
  document.getElementById("invoice-voucher-sales-gross").innerText = `${totalGrossAmount} ج.م`;
  document.getElementById("invoice-voucher-discount-val").innerText = `-${discountVal} ج.م`;
  document.getElementById("invoice-voucher-net-total").innerText = `${netAmount} ج.م`;
}

// 8. ARCHIVES WRAPPERS
function refreshArchiveTable() {
  const container = document.getElementById("archives-records-container");
  const emptyPrompt = document.getElementById("archive-empty-prompt");
  
  container.innerHTML = "";
  
  const filterTrader = document.getElementById("archive-filter-trader").value;
  const filterPeriod = document.getElementById("archive-filter-period").value.trim();

  let keys = Object.keys(appState.traderArchive);
  
  // Sort reverse chronologically
  keys.sort().reverse();

  let renderedCount = 0;

  keys.forEach(key => {
    const item = appState.traderArchive[key];
    if (!item) return;

    // Apply filtering
    if (filterTrader !== "ALL" && item.traderName !== filterTrader) return;
    if (filterPeriod && !item.period.includes(filterPeriod)) return;

    renderedCount++;
    const card = document.createElement("div");
    card.className = "section-card";
    card.style.borderRight = "5px solid var(--primary)";
    card.style.padding = "14px";
    card.style.backgroundColor = "#ffffff";

    // Build categories brief descriptions
    let brief = "";
    if (item.listCategoriesValue) {
      brief = item.listCategoriesValue.map(c => `(${c.label}: ${c.sold} مباع)`).join(" • ");
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div style="display: flex; flex-direction: column;">
          <span style="font-weight: 950; font-size:13.5px; color: #1e1b4b;">👤 ${item.traderName}</span>
          <span style="font-size: 10px; color: var(--text-muted); font-weight:800;">📅 دورة الفاتورة: ${item.period}</span>
        </div>
        <div style="text-align: left;">
          <span style="font-weight:950; color: var(--success); font-size: 14px;">${item.netAmount} ج.م</span>
          <span style="display:block; font-size: 9px; color: var(--text-muted); font-weight:800;">الصافي المخلص</span>
        </div>
      </div>
      
      <p style="font-size: 10.5px; color: #334155; font-weight: 850; background: #f8fafc; padding: 6px 10px; border-radius: 6px; line-height: 1.5; margin: 8px 0;">
        📊 <strong>ملخص الجرد الكلي:</strong> ${brief || 'جرد سريع'}
      </p>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 10px; margin-top: 8px;">
        <span style="font-size: 9.5px; color: var(--text-muted); font-weight: 900;">⏱️ تاريخ الترحيل: ${item.dateCreated || 'غير مدون'}</span>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary" onclick="loadArchiveToActive('${key}')" style="padding: 6px 10px; font-size:10px;">📉 استرداد للجداول</button>
          <button class="btn btn-danger" onclick="deleteArchiveEntry('${key}')" style="padding: 6px 10px; font-size:10px; background-color: var(--danger);">🗑️ حذف</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  if (renderedCount > 0) {
    emptyPrompt.style.display = "none";
  } else {
    emptyPrompt.style.display = "block";
  }
}

function loadArchiveToActive(key) {
  const item = appState.traderArchive[key];
  if (!item) return;

  if (confirm(`هل ترغب فعلاً في تنشيط واسترداد كشف جرد التاجر (${item.traderName}) لدورة (${item.period})؟ هذا سيعيد ملأ رصيد كرتك المستلمة والمتبقية في الجداول.`)) {
    appState.traderName = item.traderName;
    
    // Inject inventory and remaining
    if (!appState.inventory[item.traderName]) appState.inventory[item.traderName] = {};
    if (!appState.remaining[item.traderName]) appState.remaining[item.traderName] = {};

    if (item.listCategoriesValue) {
      item.listCategoriesValue.forEach(c => {
        appState.inventory[item.traderName][c.label] = c.inventory;
        appState.remaining[item.traderName][c.label] = c.remaining;
      });
    }

    // Load discount
    appState.discountPercentage = item.discountPercentage || 5;

    saveAppState().then(() => {
      syncStateToInputs();
      navigateToScreen(4); // jump to invoice
      showToast("تم استعادة وتحميل الكشف للجداول بنجاح للتعديل أو المطبوعات!", "success");
    });
  }
}

function deleteArchiveEntry(key) {
  if (confirm("هل أنت متأكد من حذف هذا السجل نهائياً من أرشيف الفواتير الحسابية؟")) {
    delete appState.traderArchive[key];
    saveAppState().then(() => {
      refreshArchiveTable();
      showToast("تم حذف وإزالة الفاتورة بالأرشيف نهائياً.", "success");
    });
  }
}

// 9. BIND USER BUTTON EXECUTORS & LOGIC ENGINES
function attachUserEvents() {
  
  // Date updates inputs
  document.getElementById("input-day-num").addEventListener("input", (e) => {
    appState.selectedDayNum = e.target.value;
    updatePeriodDisplayString();
    saveAppState().then(() => { calculateVoucherInvoice(); });
  });

  document.getElementById("input-month-num").addEventListener("change", (e) => {
    appState.selectedMonthNum = e.target.value;
    updatePeriodDisplayString();
    saveAppState().then(() => { calculateVoucherInvoice(); });
  });

  document.getElementById("input-year-num").addEventListener("input", (e) => {
    appState.selectedYearNum = e.target.value;
    updatePeriodDisplayString();
    saveAppState().then(() => { calculateVoucherInvoice(); });
  });

  // Sidebar controls
  document.getElementById("trigger-sidebar-btn").addEventListener("click", () => {
    document.getElementById("sidebar-shutter").classList.add("active");
    document.getElementById("sidebar-drawer-menu").classList.add("active");
  });

  document.getElementById("close-sidebar-btn").addEventListener("click", () => {
    document.getElementById("sidebar-shutter").classList.remove("active");
    document.getElementById("sidebar-drawer-menu").classList.remove("active");
  });

  document.getElementById("sidebar-shutter").addEventListener("click", () => {
    document.getElementById("sidebar-shutter").classList.remove("active");
    document.getElementById("sidebar-drawer-menu").classList.remove("active");
  });

  // Screen 2 Select Trader
  document.getElementById("screen2-trader-select").addEventListener("change", (e) => {
    appState.traderName = e.target.value;
    saveAppState().then(() => {
      refreshInventoryTable();
      refreshMidMonthLogs();
      calculateVoucherInvoice();
    });
  });

  // Add Trader Form
  document.getElementById("btn-add-trader").addEventListener("click", () => {
    const nameInput = document.getElementById("new-trader-name");
    const phoneInput = document.getElementById("new-trader-phone");
    
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    if (!name) {
      showToast("يرجى إدخال اسم التاجر لإتمام التسجيل!", "error");
      return;
    }

    if (appState.savedTradersList.includes(name)) {
      showToast("هذا الاسم مسجل مسبقاً في قاعدة بيانات التجار!", "error");
      return;
    }

    appState.savedTradersList.push(name);
    if (!appState.inventory[name]) appState.inventory[name] = {};
    if (!appState.remaining[name]) appState.remaining[name] = {};
    if (!appState.midMonth[name]) appState.midMonth[name] = {};

    // Save phone and discount separately in localStorage to remain globally resilient
    if (phone) {
      localStorage.setItem(`phone_${name}`, phone);
    } else {
      localStorage.removeItem(`phone_${name}`);
    }

    saveAppState().then(() => {
      nameInput.value = "";
      phoneInput.value = "";
      
      // select the newly added trader
      appState.traderName = name;
      
      populateTradersDropdowns();
      refreshTradersListUI();
      refreshInventoryTable();
      calculateVoucherInvoice();
      
      showToast(`تم تسجيل الموزع (${name}) بنجاح لقائمة الأجهزة!`, "success");
    });
  });

  // Save/Edit Custom Category modals
  document.getElementById("open-add-category-btn").addEventListener("click", () => {
    document.getElementById("modal-add-category").classList.add("active");
  });

  document.getElementById("btn-cancel-modal-category").addEventListener("click", () => {
    document.getElementById("modal-add-category").classList.remove("active");
  });

  document.getElementById("btn-save-modal-category").addEventListener("click", () => {
    const labelInput = document.getElementById("cat-modal-label");
    const valueInput = document.getElementById("cat-modal-value");
    const colorInput = document.getElementById("cat-modal-color");

    const label = labelInput.value.trim();
    const val = parseFloat(valueInput.value);
    const color = colorInput.value;

    if (!label || isNaN(val) || val < 0) {
      showToast("الرجاء إدخال اسم الفئة وقيمة بيعية صحيحة بالجنيه للمتابعة!", "error");
      return;
    }

    // Add Category
    appState.categories.push({ label, color, value: val });
    saveAppState().then(() => {
      labelInput.value = "";
      valueInput.value = "";
      
      document.getElementById("modal-add-category").classList.remove("active");
      
      refreshCategoriesUI();
      populateTradersDropdowns();
      refreshInventoryTable();
      refreshRemainingTable();
      calculateVoucherInvoice();
      
      showToast(`تم إضافة فئة الكروت (${label}) بنجاح للمنظومة العادية!`, "success");
    });
  });

  // Apply middle adds count
  document.getElementById("btn-apply-add-cards").addEventListener("click", () => {
    const trader = appState.traderName;
    if (!trader) {
      showToast("الرجاء اختيار تاجر أولاً لتوريد كروته وسط الشهر!", "error");
      return;
    }

    const catLabel = document.getElementById("midmonth-cat-select").value;
    const countInput = document.getElementById("midmonth-count-input");
    const count = parseInt(countInput.value);

    if (isNaN(count) || count <= 0) {
      showToast("الرجاء إدخال كمية كروت كافية لعملية التنزيل!", "error");
      return;
    }

    if (!appState.midMonth[trader]) appState.midMonth[trader] = {};
    if (!appState.midMonth[trader][catLabel]) appState.midMonth[trader][catLabel] = [];

    const now = new Date();
    const dateFormatted = `${now.getDate()} / ${now.getMonth() + 1} | الساعة ${getFormattedTime(now)}`;

    appState.midMonth[trader][catLabel].push({ count, date: dateFormatted });

    saveAppState().then(() => {
      countInput.value = "";
      refreshMidMonthLogs();
      refreshInventoryTable();
      refreshRemainingTable();
      calculateVoucherInvoice();
      showToast(`تم صب وإضافة عدد ${count} كارت بنجاح لملف التاجر!`, "success");
    });
  });

  // Discount percentages sliders sync
  const slider = document.getElementById("invoice-discount-slider");
  const number = document.getElementById("invoice-discount-number");
  const label = document.getElementById("discount-percentage-label");

  const syncDiscount = (val) => {
    let disc = parseInt(val) || 0;
    if (disc < 0) disc = 0;
    if (disc > 100) disc = 100;

    slider.value = disc;
    number.value = disc;
    label.innerText = `${disc}%`;

    appState.discountPercentage = disc;
    saveAppState().then(() => {
      calculateVoucherInvoice();
    });
  };

  slider.addEventListener("input", (e) => syncDiscount(e.target.value));
  number.addEventListener("input", (e) => syncDiscount(e.target.value));

  // TAREEL REPORT TO ARCHIVE
  document.getElementById("btn-save-report").addEventListener("click", () => {
    const trader = appState.traderName;
    if (!trader) {
      showToast("لا يوجد تاجر نشط لترحيل معلوماته وحفظها حالياً!", "error");
      return;
    }

    const periodStr = `${appState.selectedDayNum} / ${appState.selectedMonthNum} / ${appState.selectedYearNum}`;
    const archiveKey = `${trader}_${periodStr}`.replace(/\s+/g, "_");

    // Gather categories logs values
    const listValues = [];
    let grossTotal = 0;
    let totalSold = 0;

    appState.categories.forEach(cat => {
      const startInv = appState.inventory[trader] && appState.inventory[trader][cat.label] !== undefined ? appState.inventory[trader][cat.label] : 0;
      const midAdds = appState.midMonth[trader] && appState.midMonth[trader][cat.label] ? appState.midMonth[trader][cat.label].reduce((sum, item) => sum + (item.count || 0), 0) : 0;
      const totalRec = startInv + midAdds;
      const rem = appState.remaining[trader] && appState.remaining[trader][cat.label] !== undefined ? appState.remaining[trader][cat.label] : 0;
      
      let sold = totalRec - rem;
      if (sold < 0) sold = 0;

      const val = Math.floor(sold * cat.value);
      grossTotal += val;
      totalSold += sold;

      listValues.push({
        label: cat.label,
        inventory: startInv,
        midMonthSum: midAdds,
        remaining: rem,
        sold,
        value: val
      });
    });

    const discRate = Math.floor(Number(appState.discountPercentage) || 0);
    const discountVal = Math.floor((grossTotal * discRate) / 100);
    const net = Math.floor(Math.max(0, grossTotal - discountVal));

    const phone = localStorage.getItem(`phone_${trader}`) || "";
    const now = new Date();
    const saveTime = `${now.toLocaleDateString("ar-EG")} | الساعة ${getFormattedTime(now)}`;

    appState.traderArchive[archiveKey] = {
      traderName: trader,
      period: periodStr,
      listCategoriesValue: listValues,
      totalSales: grossTotal,
      discountPercentage: discRate,
      discountVal: discountVal,
      netAmount: net,
      phone: phone,
      dateCreated: saveTime
    };

    saveAppState().then(() => {
      refreshArchiveTable();
      showToast(`تم ترحيل الفاتورة وحفظها بنجاح في كشف التاجر (${trader})!`, "success");
    });
  });

  // BACKUP EXPORTS / RESET
  document.getElementById("btn-db-export").addEventListener("click", async () => {
    const dump = await LocalDB.getAllData();
    const strObj = JSON.stringify(dump);

    document.getElementById("db-modal-title").innerText = "📤 نسخ كود الذاكرة الاحتياطية";
    document.getElementById("db-modal-desc").innerText = "قم بنسخ هذا الرمز البرمجي بالكامل والاحتفاظ به لاستعادة الحسابات لاحقاً عند استخدام هاتف آخر:";
    document.getElementById("db-modal-textarea").value = strObj;
    document.getElementById("db-modal-action-btn").innerText = "نسخ النص الاحتياطي التلقائي";
    document.getElementById("db-modal-action-btn").onclick = () => {
      navigator.clipboard.writeText(strObj).then(() => {
        showToast("تم نسخ الكود الاحتياطي لجميع الموزعين بذاكرة هاتفك تلقائياً!", "success");
      });
    };

    document.getElementById("modal-db-text").classList.add("active");
  });

  document.getElementById("btn-db-import").addEventListener("click", () => {
    document.getElementById("db-modal-title").innerText = "📥 استرداد الذاكرة من نص محفوظ";
    document.getElementById("db-modal-desc").innerText = "ألصق كود النسخة الاحتياطية كاملاً في المربع السفلي لتوليف قاعدة بيانات الموزعين:";
    document.getElementById("db-modal-textarea").value = "";
    document.getElementById("db-modal-action-btn").innerText = "بدء عملية البناء والترميم والتسطيب";
    document.getElementById("db-modal-action-btn").onclick = async () => {
      const code = document.getElementById("db-modal-textarea").value.trim();
      if (!code) {
        showToast("يرجى إدخال رمز صحيح غير فارغ للمتابعة!", "error");
        return;
      }
      try {
        const obj = JSON.parse(code);
        if (obj) {
          await LocalDB.clear();
          for (const key in obj) {
            await LocalDB.setItem(key, obj[key]);
          }
          showToast("تم استعادة قاعدة بيانات الموزعين والفئات بالكامل بنجاح!", "success");
          setTimeout(() => { window.location.reload(); }, 1200);
        }
      } catch (e) {
        showToast("فشلت عملية التحليل والترميم. تأكد من سلامة نص الكارت المسترد!", "error");
      }
    };

    document.getElementById("modal-db-text").classList.add("active");
  });

  document.getElementById("db-modal-close-btn").addEventListener("click", () => {
    document.getElementById("modal-db-text").classList.remove("active");
  });

  document.getElementById("btn-db-clear").addEventListener("click", async () => {
    if (confirm("🚨 تحذير شديد الأهمية!\nهل تود فعلاً تصفير كافة مبيعات وسجلات حسابات الموزعين وتفريغ قاعدة البيانات بالكامل؟ لا يمكن التراجع عن هذا الإجراء.")) {
      if (confirm("هل تعي تماماً أنه سيتم تدمير كافة الملفات وعليها الأرشيف؟ انقر موافق للمسح النهائي.")) {
        await LocalDB.clear();
        showToast("تم تصفير الأرشيف والأجهزة والذواكر نهائياً. جاري إعادة الإقلاع...", "success");
        setTimeout(() => { window.location.reload(); }, 1200);
      }
    }
  });

  // WHATSAPP SHARE VIA EXCEL OR POST PREVIEW MAPPING
  document.getElementById("btn-whatsapp-share").addEventListener("click", async () => {
    const trader = appState.traderName;
    if (!trader) {
      showToast("اختر تاجر أولاً لإتمَام المشاركة واتساب!", "error");
      return;
    }

    showToast("جاري تجهيز الصورة البريدية للرفع والتسمية...", "info");
    
    const target = document.getElementById("invoice-bill-voucher");
    html2canvas(target, { useCORS: true, logging: false }).then(async canvas => {
      const base64 = canvas.toDataURL("image/png");
      const cleanBase64 = base64.replace(/^data:image\/png;base64,/, "");

      try {
        // Send base64 capture to server API to generate OpenGraph share card
        const response = await fetch("/api/save-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64,
            title: trader,
            date: `${appState.selectedDayNum}/${appState.selectedMonthNum}/${appState.selectedYearNum}`
          })
        });

        const data = await response.json();
        if (data && data.success && data.url) {
          const textMsg = `🧾 *تصفية حساب كروت الواي فاي*\n👤 للتاجر: *${trader}*\n📅 دورة الجرد: *${appState.selectedDayNum} / ${appState.selectedMonthNum}*\n🔎 لمعاينة وتحميل الفاتورة بجودة كاملة اضغط الرابط:\n${data.url}`;
          const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg)}`;
          
          window.open(whatsappUrl, "_blank");
          showToast("تم تحويلك للواتساب لإطلاق كشف الموزع بنجاح!", "success");
        } else {
          fallbackWhatsappNoBackend(trader);
        }
      } catch (err) {
        console.warn("Express endpoint error, applying direct text backup share:", err);
        fallbackWhatsappNoBackend(trader);
      }
    }).catch(err => {
      showToast("فشل تصوير كارت الصورة. تم تفعيل المشاركة كرسالة نصية فقط.", "error");
      fallbackWhatsappNoBackend(trader);
    });
  });

  function fallbackWhatsappNoBackend(trader) {
    const periodStr = `${appState.selectedDayNum} / ${appState.selectedMonthNum} / ${appState.selectedYearNum}`;
    let textMsg = `🧾 *كشف تصفية كروت الواي فاي*\n👤 للتاجر: *${trader}*\n📅 الدورة: *${periodStr}*\n----------------\n`;
    
    appState.categories.forEach(cat => {
      const startInv = appState.inventory[trader] && appState.inventory[trader][cat.label] !== undefined ? appState.inventory[trader][cat.label] : 0;
      const midAdds = appState.midMonth[trader] && appState.midMonth[trader][cat.label] ? appState.midMonth[trader][cat.label].reduce((sum, item) => sum + (item.count || 0), 0) : 0;
      const totalRec = startInv + midAdds;
      const rem = appState.remaining[trader] && appState.remaining[trader][cat.label] !== undefined ? appState.remaining[trader][cat.label] : 0;
      let sold = totalRec - rem;
      if (sold < 0) sold = 0;
      const val = Math.floor(sold * cat.value);
      if (sold > 0) {
        textMsg += `🎫 *${cat.label}*: مستلم [${totalRec}] - متبقي [${rem}] = مباع *${sold}* كارت بمبلغ *${val} ج.م*\n`;
      }
    });

    // Totals
    const target = document.getElementById("invoice-bill-voucher");
    const grossT = document.getElementById("invoice-voucher-sales-gross").innerText;
    const discVal = document.getElementById("invoice-voucher-discount-val").innerText;
    const netT = document.getElementById("invoice-voucher-net-total").innerText;

    textMsg += `----------------\n💵 إجمالي الحساب: *${grossT}*\n🌹 الخصم: *${discVal}*\n💰 الصافي المطلوب: *${netT}*\n\nتطوير وتصميم م/ ابراهيم جابر`;
    
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg)}`;
    window.open(whatsappUrl, "_blank");
  }

  // SCREENSHOT IMAGE GENERATOR DOWNLOAD
  document.getElementById("btn-screenshot-voucher").addEventListener("click", () => {
    const trader = appState.traderName;
    if (!trader) {
      showToast("الرجاء اختيار تاجر أولاً لتوليد كارت الفاتورة!", "error");
      return;
    }

    showToast("جاري تصوير كرت الفاتورة بنظام الأوفلاين...", "info");
    const target = document.getElementById("invoice-bill-voucher");

    html2canvas(target, { useCORS: true, logging: false }).then(canvas => {
      try {
        const base64 = canvas.toDataURL("image/png");
        
        // Let's download locally by appending a real tag element to bypass Android iframe blocks
        const link = document.createElement("a");
        link.download = `فاتورة_جرد_${trader}.png`;
        link.href = base64;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("تم التقاط وتحميل الفاتورة بنجاح في استوديو الصور لجهازك!", "success");
      } catch (e) {
        // direct buffer viewing fallback
        showToast("فشل الحفظ المباشر، جاري فتح الصورة في نافذة مستقلة للحفظ اليدوي.", "info");
        const base64 = canvas.toDataURL("image/png");
        const win = window.open();
        if (win) {
          win.document.write(`<img src="${base64}" style="max-width: 100%; border-radius:12px; margin: 20px auto; display:block;" alt="فاتورة الحساب">`);
        } else {
          alert("الرجاء السماح للنوافذ المنبثقة لرؤية الصورة.");
        }
      }
    }).catch(err => {
      showToast("فشل تصوير كارت الصورة. جاري معالجة المتصفحات.", "error");
    });
  });

  // Archive searches
  document.getElementById("archive-filter-trader").addEventListener("change", refreshArchiveTable);
  document.getElementById("archive-filter-period").addEventListener("input", refreshArchiveTable);

  // APK EXITS INTEGRATION
  const handleExitApp = () => {
    if (confirm("هل تريد الخروج من البرنامج فعلاً؟")) {
      try {
        const nav = window.navigator;
        if (nav && nav.app && typeof nav.app.exitApp === 'function') {
          nav.app.exitApp();
        } else if (window.device && typeof window.device.exitApp === 'function') {
          window.device.exitApp();
        } else {
          window.close();
          alert("📋 للخروج تماماً من التطبيق، الرجاء سحبه من قائمة البرامج النشطة في جهازك.");
        }
      } catch (err) {
        window.close();
      }
    }
  };
  document.getElementById("sidebar-exit-software-btn").addEventListener("click", handleExitApp);

  // Dynamic Exports Builders
  document.getElementById("btn-export-full-employee").addEventListener("click", () => {
    showToast("جاري تصنيع نسخة الموظف الأوفلاين بالكامل...", "info");
    compileSingleOfflineHTMLDocument(false);
  });

  document.getElementById("btn-export-standalone-trader").addEventListener("click", () => {
    showToast("جاري تصنيع نسخة التاجر المستقلة أوفلاين...", "info");
    compileSingleOfflineHTMLDocument(true);
  });
}

function refreshTradersListUI() {
  const container = document.getElementById("traders-setup-list");
  container.innerHTML = "";

  if (appState.savedTradersList.length === 0) {
    container.innerHTML = '<p style="font-size: 11px; text-align: center; color: var(--text-muted); font-weight: 800; padding:12px;">لا يوجد تجار مسجلين حالياً.</p>';
    return;
  }

  appState.savedTradersList.forEach((name, idx) => {
    const row = document.createElement("div");
    row.style.background = "#ffffff";
    row.style.border = "1.5px solid var(--border-color)";
    row.style.borderRadius = "12px";
    row.style.padding = "10px 14px";
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";

    const phone = localStorage.getItem(`phone_${name}`) || "غير مسجل";

    row.innerHTML = `
      <div style="display: flex; flex-direction: column;">
        <span style="font-weight: 950; font-size:13px; color: #1e1b4b;">👤 ${name}</span>
        <span style="font-size: 10px; color: var(--text-muted); font-weight: 850; margin-top:2px;">📱 هاتف التاجر: ${phone}</span>
      </div>
      <div style="display: flex; gap: 6px;">
        <button class="btn btn-primary" onclick="setActiveTraderFromSetup('${name}')" style="padding: 6px 12px; font-size: 10px;">📊 اختيار للعمل</button>
        <button class="btn btn-danger" onclick="deleteTraderByIndex(${idx})" style="padding: 6px 10px; font-size: 10px; background-color: var(--danger);">🗑️ حذف</button>
      </div>
    `;
    container.appendChild(row);
  });
}

// Global scope triggers for inline HTMLs
window.setActiveTraderFromSetup = function(name) {
  appState.traderName = name;
  saveAppState().then(() => {
    populateTradersDropdowns();
    navigateToScreen(2); // Inventory
    showToast(`تم تنشيط التاجر (${name}) الموزع في قاعدة البيانات الحالية!`, "success");
  });
};

window.deleteTraderByIndex = function(index) {
  const name = appState.savedTradersList[index];
  if (confirm(`🚨 تحذير!\nهل تود حذف الموزع (${name}) تماماً؟ سيؤدي ذلك لمسح كافة جداول المخزون والمباع والمستحقات المترتبة عليه.`)) {
    // Purge records
    appState.savedTradersList.splice(index, 1);
    delete appState.inventory[name];
    delete appState.remaining[name];
    delete appState.midMonth[name];
    localStorage.removeItem(`phone_${name}`);

    if (appState.traderName === name) {
      appState.traderName = appState.savedTradersList[0] || "";
    }

    saveAppState().then(() => {
      populateTradersDropdowns();
      refreshTradersListUI();
      refreshInventoryTable();
      refreshRemainingTable();
      calculateVoucherInvoice();
      showToast("تم إزالة ملفات وجداول الموزع نهائياً.", "success");
    });
  }
};

// Initial setup traders loader
function refreshTradersListUIFirst() {
  refreshTradersListUI();
}
// Run on startup sync
setTimeout(() => { refreshTradersListUIFirst(); }, 300);

// 10. OFFLINE STANDALONE HTML SINGLE-FILE COMPILERS
async function compileSingleOfflineHTMLDocument(isStandaloneTrader = false) {
  try {
    // Fetch static file contents using standard fetch api
    const indexContent = document.documentElement.outerHTML;
    
    // Read local/remote stylesheets and config values
    const styleRes = await fetch("style.css");
    const styleText = await styleRes.text();

    const configRes = await fetch("config.js");
    const configText = await configRes.text();

    const appRes = await fetch("app.js");
    let appText = await appRes.text();

    // Modify app.js if isolated trader mode requested so that it runs in strict mode immediately
    if (isStandaloneTrader) {
      const activeTraderEncoded = encodeURIComponent(appState.traderName || "تاجر مستقل");
      appText = `// STRICT STANDALONE TRADER OVERRIDE\nconst forcedTraderModeNameValue = "${activeTraderEncoded}";\n` + 
                appText.replace(
                  'const params = new URLSearchParams(window.location.search);',
                  `const params = new URLSearchParams("mode=trader&trader=" + forcedTraderModeNameValue);`
                );
    }

    // Assemble unified single-file HTML document
    let compiled = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#1e1b4b">
  <title>برنامج حساب كروت الواي فاي - نسخة أوفلاين مستقلة</title>
  
  <!-- Embedded Offline Style Sheet -->
  <style>
    ${styleText}
  </style>
</head>
<body>
`;

    // Extract inner HTML of the app structure to avoid nesting body elements
    const appBodyWrapper = document.body.innerHTML;
    
    // We remove the external script elements to avoid duplicate loading
    let cleanBody = appBodyWrapper
      .replace(/<script src="https:\/\/cdnjs.cloudflare.com\/ajax\/libs\/html2canvas\/1.4.1\/html2canvas.min.js"><\/script>/, "")
      .replace(/<script src="config.js"><\/script>/, "")
      .replace(/<script src="app.js"><\/script>/, "");

    compiled += cleanBody;
    
    // Embed scripts directly inside compiled output
    compiled += `
  <!-- Embed html2canvas offline libraries -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  
  <!-- Embed config parameters -->
  <script>
    ${configText}
  </script>

  <!-- Embed active app parameters and engines -->
  <script>
    ${appText}
  </script>
</body>
</html>`;

    // Create virtual download file link
    const fileBlob = new Blob([compiled], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(fileBlob);
    
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = isStandaloneTrader ? `تطبيق_مستقل_${appState.traderName || "التاجر"}_أوفلاين.html` : "منظومة_حسابات_الكروت_الموظفين_الكاملة.html";
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    showToast("بنجاح! تم ضغط وصهر كافة الأكواد وجمعها بملف HTML وتنزيلها للتشغيل الفوري أوفلاين كـ APK!", "success");
  } catch (err) {
    console.error("Single-file compilation failed:", err);
    showToast("فشلت عملية البناء الذاتي للأكواد الأوفلاين.", "error");
  }
}

// 11. CUSTOM TOAST NOTIFICATIONS DRAWER MANAGER
function showToast(message, type = "info") {
  const container = document.getElementById("global-toast-deck");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = "🔔";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "⚠️";

  toast.innerHTML = `<span>${icon}</span><span style="font-weight:900;">${message}</span>`;
  container.appendChild(toast);

  // Auto remove after 2.8 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => { toast.remove(); }, 350);
  }, 280);
}
