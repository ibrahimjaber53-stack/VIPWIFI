import { Category, AppData } from '../types';
import { LocalDB } from './db';

const localStorage = LocalDB; // Drop-in IndexedDB proxy


export function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#0f172a';
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#0f172a';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 140) ? '#0f172a' : '#ffffff';
}

export function generateIndependentTraderHTML(traderName: string, selectedPeriod: string, currentMonthNum: string, currentYearNum: string, activeAppData: AppData, isEmployeeVersion: boolean = false): string {
  // Package appData for the trader version
  const tData = {
    isTraderVersion: isEmployeeVersion ? false : true,
    traderName: traderName,
    savedTradersList: isEmployeeVersion ? activeAppData.savedTradersList : [traderName],
    currentMonth: selectedPeriod,
    selectedMonthNum: currentMonthNum,
    selectedYearNum: currentYearNum,
    discountPercentage: activeAppData.discountPercentage,
    categories: JSON.parse(JSON.stringify(activeAppData.categories)),
    inventory: isEmployeeVersion ? (activeAppData.inventory || {}) : {},
    remaining: isEmployeeVersion ? (activeAppData.remaining || {}) : {},
    savedTradersLog: isEmployeeVersion ? (activeAppData.savedTradersLog || []) : [],
    traderArchive: isEmployeeVersion ? (activeAppData.traderArchive || {}) : {},
    globalHistoryLogs: isEmployeeVersion ? (activeAppData.globalHistoryLogs || {}) : {}
  };

  const centralKey = `${traderName}_${selectedPeriod}`;
  
  if (!isEmployeeVersion) {
    // Extract specific merchant's entries
    if (activeAppData.globalHistoryLogs && activeAppData.globalHistoryLogs[centralKey]) {
      (tData.globalHistoryLogs as any)[centralKey] = activeAppData.globalHistoryLogs[centralKey];
      tData.inventory = activeAppData.globalHistoryLogs[centralKey].inventory || {};
      tData.remaining = activeAppData.globalHistoryLogs[centralKey].remaining || {};
      tData.discountPercentage = activeAppData.globalHistoryLogs[centralKey].discountPercentage !== undefined 
        ? activeAppData.globalHistoryLogs[centralKey].discountPercentage 
        : activeAppData.discountPercentage;
    }
    
    if (activeAppData.traderArchive && activeAppData.traderArchive[centralKey]) {
      (tData.traderArchive as any)[centralKey] = activeAppData.traderArchive[centralKey];
      tData.savedTradersLog.push({
        name: traderName,
        finalAmount: activeAppData.traderArchive[centralKey].netAmount,
        period: selectedPeriod
      });
    }

    // Back up other cycles for this trader
    if (activeAppData.traderArchive) {
      for (const key in activeAppData.traderArchive) {
        if (key.startsWith(traderName + "_")) {
          (tData.traderArchive as any)[key] = activeAppData.traderArchive[key];
        }
      }
    }
    if (activeAppData.globalHistoryLogs) {
      for (const key in activeAppData.globalHistoryLogs) {
        if (key.startsWith(traderName + "_")) {
          (tData.globalHistoryLogs as any)[key] = activeAppData.globalHistoryLogs[key];
        }
      }
    }
  }

  // Return a beautiful self-contained offline-first HTML tool
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>حسابات الواي فاي - ${traderName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;700;900&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <style>
        body { 
            font-family: 'Cairo', system-ui, -apple-system, sans-serif; 
            background-color: #f8fafc; 
            direction: rtl;
            color: #1e293b;
            margin: 0;
            padding: 0;
            line-height: 1.5;
        }
        .auto-fit-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        input[type="number"] { text-align: center; font-weight: 700; -moz-appearance: textfield; }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

        /* Solid Native CSS layout frameworks when Tailwind is absent/blocked */
        .max-w-md { max-width: 480px !important; width: 92% !important; margin-left: auto !important; margin-right: auto !important; }
        .mx-auto { margin-right: auto !important; margin-left: auto !important; }
        .flex { display: flex !important; }
        .grid { display: grid !important; }
        .justify-between { justify-content: space-between !important; }
        .items-center { align-items: center !important; }
        .text-center { text-align: center !important; }
        .text-right { text-align: right !important; }
        .hidden { display: none !important; }
        .block { display: block !important; }
        .w-full { width: 100% !important; }
        .h-full { height: 100% !important; }
        .rounded-xl { border-radius: 12px !important; }
        .rounded-lg { border-radius: 8px !important; }
        .border { border: 1px solid #cbd5e1 !important; }
        .border-slate-200 { border-color: #e2e8f0 !important; }
        .bg-white { background-color: #ffffff !important; }
        .bg-slate-50 { background-color: #f8fafc !important; }
        .bg-indigo-900 { background-color: #312e81 !important; }
        .bg-indigo-950 { background-color: #1e1b4b !important; }
        .text-white { color: #ffffff !important; }
        .font-bold { font-weight: 700 !important; }
        .font-black { font-weight: 900 !important; }
        .text-xs { font-size: 11px !important; }
        .text-sm { font-size: 13px !important; }
        .text-lg { font-size: 18px !important; }
        .text-xl { font-size: 20px !important; }
        .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        .grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
        .gap-2 { gap: 8px !important; }
        .gap-3 { gap: 12px !important; }
        .px-3 { padding-left: 12px !important; padding-right: 12px !important; }
        .py-1.5 { padding-top: 6px !important; padding-bottom: 6px !important; }
        .py-2.5 { padding-top: 10px !important; padding-bottom: 10px !important; }
        .p-1 { padding: 4px !important; }
        .p-1.5 { padding: 6px !important; }
        .p-2.5 { padding: 10px !important; }
        .p-3 { padding: 12px !important; }
        .p-4 { padding: 16px !important; }
        .p-5 { padding: 20px !important; }
        .mt-3 { margin-top: 12px !important; }
        .pt-4 { padding-top: 16px !important; }
        .space-y-3 > * + * { margin-top: 12px !important; }
        .space-y-4 > * + * { margin-top: 16px !important; }
        .space-y-5 > * + * { margin-top: 20px !important; }

        /* Beautiful button & interactive fallbacks */
        button, .btn {
            font-family: 'Cairo', system-ui, sans-serif;
            font-weight: 700;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            user-select: none;
        }
        button:active {
            transform: scale(0.98);
        }
        select, input {
            font-family: 'Cairo', system-ui, sans-serif;
            border-radius: 10px;
            border: 1px solid #cbd5e1;
            padding: 8px 12px;
            font-size: 12px;
            color: #1e293b;
            background: #ffffff;
        }
        
        /* Persistent Visual Structures (Cards & Boxes) */
        #invoice-capture-area, #grand-capture-area, #filter-capture-area {
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 16px !important;
            padding: 16px !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03) !important;
            box-sizing: border-box !important;
            margin-bottom: 16px !important;
        }

        /* Direct, clean table formatting rule to bypass empty style states */
        table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 12px !important;
            margin-bottom: 12px !important;
            background: #ffffff !important;
            border-radius: 12px !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
        }
        th {
            background-color: #f1f5f9 !important;
            color: #334155 !important;
            font-weight: 800 !important;
            padding: 10px 8px !important;
            border: 1px solid #cbd5e1 !important;
            font-size: 11px !important;
        }
        td {
            padding: 10px 8px !important;
            border: 1px solid #e2e8f0 !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            color: #1e293b !important;
        }

        /* Responsive Top Bar */
        #top-stepper-bar {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-around !important;
            align-items: center !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 14px !important;
            background: #f8fafc !important;
            padding: 6px !important;
        }
        #top-stepper-bar button {
            background: none !important;
            border: none !important;
            padding: 4px !important;
            flex: 1 !important;
        }

        /* Highly refined screen printing controls */
        @media print {
            body { 
                background: white !important; 
                padding: 0 !important; 
                margin: 0 !important; 
            }
            #top-stepper-bar, .bg-white.border-b, .no-print, nav, button, #sidebar-drawer, #sidebar-overlay {
                display: none !important;
            }
            .screen-view {
                display: none !important;
            }
            /* Force current screen active areas to expand beautifully to full page height & width */
            #screen-4, #screen-5, #screen-6 {
                display: block !important;
            }
            #invoice-capture-area, #grand-capture-area, #filter-capture-area {
                display: block !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
            }
        }
    </style>
</head>
<body class="text-slate-800 antialiased overflow-x-hidden">

    <div id="sidebar-overlay" onclick="toggleSidebar()" class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-45 hidden transition-opacity duration-300 opacity-0"></div>

    <div id="sidebar-drawer" class="fixed top-0 right-0 h-full w-72 bg-white/85 backdrop-blur-md border-l border-slate-200/50 z-50 shadow-2xl transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col justify-between p-5">
        <div class="space-y-6">
            <div class="flex items-center justify-between pb-3 border-b border-slate-200/60">
                <div class="flex flex-col">
                    <span class="text-xs font-black text-slate-900 tracking-wide">برنامج حسابات الكروت</span>
                    <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50/70 px-1.5 py-0.5 rounded mt-1 w-max">نسخة المحل</span>
                </div>
                <button onclick="toggleSidebar()" class="text-slate-400 hover:text-slate-600 text-2xl font-bold p-1 cursor-pointer transition">×</button>
            </div>
            
            <nav class="flex flex-col space-y-2">
                <button onclick="goToScreen(2); toggleSidebar();" class="text-right font-bold text-xs p-3 rounded-xl transition flex items-center text-slate-700 hover:bg-slate-100/70 cursor-pointer">📊 مخزون الكروت المستلمة</button>
                <button onclick="goToScreen(3); toggleSidebar();" class="text-right font-bold text-xs p-3 rounded-xl transition flex items-center text-slate-700 hover:bg-slate-100/70 cursor-pointer">📉 جرد الكروت المتبقية</button>
                <button onclick="goToScreen(4); toggleSidebar();" class="text-right font-bold text-xs p-3 rounded-xl transition flex items-center text-slate-700 hover:bg-slate-100/70 cursor-pointer">💰 صافي كشف المستحق الحالي</button>
                <button onclick="goToScreen(5); toggleSidebar();" class="text-right font-bold text-xs p-3 rounded-xl transition flex items-center text-slate-700 hover:bg-slate-100/70 cursor-pointer">📂 أرشيف التقارير الشهرية</button>
                <button onclick="goToScreen(6); toggleSidebar();" class="text-right font-bold text-xs p-3 rounded-xl transition flex items-center text-slate-700 hover:bg-slate-100/70 cursor-pointer">🔍 استدعاء الفرز المتقدم</button>
            </nav>
        </div>

        <div class="space-y-4 border-t border-slate-200/60 pt-4">
            <div class="text-center text-slate-500 text-xs">
                <p class="font-medium">إعداد وتصميم</p>
                <p class="font-black text-slate-900 text-sm mt-0.5">م/ ابراهيم جابر</p>
            </div>
        </div>
    </div>

    <div class="bg-white border-b border-slate-200 px-3 pt-3 pb-2 sticky top-0 z-40 shadow-sm">
        <div class="max-w-md mx-auto flex justify-between items-center mb-3">
            <div class="flex items-center space-x-2 space-x-reverse">
                <button onclick="toggleSidebar()" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition cursor-pointer" title="القائمة الجانبية">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
                <h1 class="text-xs font-black text-slate-900 tracking-wide">برنامج حساب كروت الواي فاي</h1>
            </div>
            <div id="top-trader-area">
                <p class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">التاجر: <span id="top-trader-name-badge">${traderName}</span></p>
            </div>
        </div>
        
        <div id="top-stepper-bar" class="max-w-md mx-auto grid grid-cols-5 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-center items-center justify-center">
            <button id="step-2" onclick="goToScreen(2)" class="flex flex-col items-center justify-center w-full py-1 text-center font-bold">
                <span id="step-circle-2" class="w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full border border-slate-300">1</span>
                <span id="step-text-2" class="text-[9px] text-slate-500 mt-0.5">المخزون</span>
            </button>
            <button id="step-3" onclick="goToScreen(3)" class="flex flex-col items-center justify-center w-full py-1 text-center font-bold">
                <span id="step-circle-3" class="w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full border border-slate-300">2</span>
                <span id="step-text-3" class="text-[9px] text-slate-500 mt-0.5">المتبقي</span>
            </button>
            <button id="step-4" onclick="goToScreen(4)" class="flex flex-col items-center justify-center w-full py-1 text-center font-bold">
                <span id="step-circle-4" class="w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full border border-slate-300">3</span>
                <span id="step-text-4" class="text-[9px] text-slate-500 mt-0.5">المستحق</span>
            </button>
            <button id="step-5" onclick="goToScreen(5)" class="flex flex-col items-center justify-center w-full py-1 text-center font-bold">
                <span id="step-circle-5" class="w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full border border-slate-300">4</span>
                <span id="step-text-5" class="text-[9px] text-slate-500 mt-0.5">التقارير</span>
            </button>
            <button id="step-6" onclick="goToScreen(6)" class="flex flex-col items-center justify-center w-full py-1 text-center font-bold">
                <span id="step-circle-6" class="w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full border border-slate-300">5</span>
                <span id="step-text-6" class="text-[9px] text-slate-500 mt-0.5">الفرز</span>
            </button>
        </div>
    </div>
 
    <div class="max-w-md mx-auto p-4 min-h-[calc(100vh-100px)] flex flex-col justify-between space-y-6">
        
        <!-- Screen 2 -->
        <div id="screen-2" class="screen-view block space-y-5">
            <div class="bg-indigo-900 text-white p-3 rounded-xl flex justify-between items-center shadow-sm">
                <h3 class="font-bold text-sm auto-fit-text">التاجر: <span class="display-trader-name-dyn">${traderName}</span></h3>
                <p id="display-month-s2" class="text-[11px] text-indigo-200 font-bold">${selectedPeriod}</p>
            </div>
            <div>
                <h2 class="text-lg font-black text-slate-900">المخزون المستلم</h2>
                <p class="text-xs text-slate-500 mt-0.5">أدخل عدد الكروت التي استلمتها من المركز في هذه الفترة</p>
            </div>
            <div class="flex justify-between items-center px-4 py-1.5 bg-slate-100 rounded-lg text-[11px] font-bold text-slate-600 shadow-2xs">
                <span>الفئة المعتمدة</span>
                <span class="pl-8">المخزون</span>
            </div>
            <div id="inventory-list" class="space-y-3"></div>
            <div class="pt-4">
                <button onclick="goToScreen(3)" class="w-full bg-slate-900 text-white font-bold p-4 rounded-xl shadow-md text-sm transition hover:bg-slate-800">التالي (جرد المتبقي) ←</button>
            </div>
        </div>
 
        <!-- Screen 3 -->
        <div id="screen-3" class="screen-view hidden space-y-5">
            <div class="bg-indigo-900 text-white p-3 rounded-xl flex justify-between items-center shadow-sm">
                <h3 class="font-bold text-sm auto-fit-text">التاجر: <span class="display-trader-name-dyn">${traderName}</span></h3>
                <p id="display-month-s3" class="text-[11px] text-indigo-200 font-bold">${selectedPeriod}</p>
            </div>
            <div>
                <h2 class="text-lg font-black text-slate-900">جرد الكروت المتبقية</h2>
                <p class="text-xs text-slate-500 mt-0.5">ادخل عدد الكروت المتبقية معك في نهاية هذه الدورة</p>
            </div>
            <div class="grid grid-cols-3 gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-[11px] font-bold text-slate-600 shadow-2xs text-center">
                <span class="text-right">الفئة</span>
                <span>المخزن</span>
                <span class="text-left pl-4">المتبقي</span>
            </div>
            <div id="remaining-list" class="space-y-3"></div>
            <div class="flex justify-between items-center pt-4 w-full">
                <button onclick="goToScreen(2)" class="w-[30%] border border-slate-300 bg-white text-slate-700 font-bold p-3.5 rounded-xl text-sm transition hover:bg-slate-50">السابق</button>
                <button onclick="calculateAndGoToS4()" class="w-[66%] bg-slate-900 text-white font-bold p-3.5 rounded-xl shadow-md text-sm transition hover:bg-slate-800">حساب المستحق ←</button>
            </div>
        </div>
 
        <!-- Screen 4 -->
        <div id="screen-4" class="screen-view hidden space-y-5">
            <div id="invoice-capture-area" class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div class="flex justify-between items-center pb-2 border-b border-dashed border-slate-300">
                    <h2 class="text-sm font-black text-slate-900">برنامج حسابات الكروت</h2>
                    <p class="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">نسخة المحل</p>
                </div>
                <div class="text-center py-3 bg-slate-50/60 rounded-xl my-2 border border-slate-100 px-3">
                    <p class="text-[9px] text-slate-400 font-bold block mb-0.5">العميل والمستلم</p>
                    <p id="invoice-trader-name" class="font-black text-indigo-950 text-base leading-normal py-1 px-3 border-b border-dashed border-slate-200/80 inline-block min-w-[120px] max-w-full" style="font-size: 15px !important; font-weight: 900 !important; color: #1e1b4b !important;">${traderName}</p>
                    <p id="display-month-s4" class="text-[11px] text-indigo-700 font-extrabold mt-1.5 bg-indigo-50 px-2.5 py-0.5 rounded-full inline-block">${selectedPeriod}</p>
                </div>

                <div class="overflow-x-auto mt-3">
                    <table class="w-full text-center text-xs border-collapse">
                        <thead>
                            <tr class="bg-slate-100 text-slate-700 font-bold">
                                <th class="p-1.5 border border-slate-200">الفئة</th>
                                <th class="p-1.5 border border-slate-200">مخزون</th>
                                <th class="p-1.5 border border-slate-200">متبقي</th>
                                <th class="p-1.5 border border-slate-200">مباع</th>
                                <th class="p-1.5 border border-slate-200">قيمة</th>
                            </tr>
                        </thead>
                        <tbody id="invoice-table-body"></tbody>
                    </table>
                </div>

                <div class="mt-3 space-y-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div class="flex justify-between font-bold text-slate-700">
                        <span>إجمالي المبيعات:</span>
                        <span id="txt-total-sales">0.00 ج</span>
                    </div>
                    <div class="flex justify-between text-red-600 font-bold">
                        <span>قيمة الخصم المعتمد (<span id="txt-discount-rate">${tData.discountPercentage}</span>%):</span>
                        <span id="txt-discount-val">0.00 ج</span>
                    </div>
                    <div class="bg-indigo-950 text-white p-2.5 rounded-lg flex justify-between font-black text-sm mt-1">
                        <span>الصافي المستحق:</span>
                        <span id="txt-net-amount">0.00 جنيه</span>
                    </div>
                </div>
                <p id="txt-timestamp" class="text-[9px] text-center text-slate-400 mt-1.5">تاريخ التقرير: --</p>
            </div>

            <div class="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <p class="text-[10px] text-amber-900 border-r-2 border-amber-500 pr-1.5 font-bold mb-1.5">⚡ ميزات التصدير والطباعة:</p>
                <div class="grid grid-cols-3 gap-2">
                    <button onclick="openPreviewModal('invoice-capture-area', 'png', 'كارت_الحساب')" class="border border-slate-300 py-2.5 rounded-xl font-black bg-white text-[10px] text-indigo-950 text-center shadow-2xs btn flex items-center justify-center gap-0.5">🖼️ كارت صورة</button>
                    <button onclick="window.print()" class="bg-indigo-950 text-white py-2.5 rounded-xl font-black text-[10px] text-center shadow-xs btn flex items-center justify-center gap-0.5">🖨️ طباعة / PDF</button>
                    <button onclick="triggerDirectShare('invoice-capture-area', 'كارت_الحساب')" class="bg-emerald-600 text-white py-2.5 rounded-xl font-black text-[10px] text-center shadow-xs btn flex items-center justify-center gap-0.5">📲 مشاركة واتس</button>
                </div>
            </div>

            <div class="flex justify-between items-center pt-4 w-full">
                <button onclick="goToScreen(3)" class="w-[30%] border border-slate-300 bg-white text-slate-700 font-bold p-3.5 rounded-xl text-sm transition hover:bg-slate-50">السابق</button>
                <button onclick="saveInvoiceToLogAndGoToS5()" class="w-[66%] bg-green-600 text-white font-black p-3.5 rounded-xl shadow-md text-sm hover:bg-green-700">حفظ وعرض الأرشيف ✓</button>
            </div>
        </div>

        <!-- Screen 5 -->
        <div id="screen-5" class="screen-view hidden space-y-4">
            <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2 text-xs">
                <label class="block font-bold text-slate-700">🔍 استعراض كشف حساب فترة سابقة محددة:</label>
                <div class="flex space-x-3 space-x-reverse">
                    <select id="select-archive-month-s5" class="w-2/3 p-2.5 border border-slate-300 rounded-xl bg-white font-bold focus:outline-none"></select>
                    <button onclick="loadSpecificMonthReportS5()" class="w-1/3 bg-slate-900 text-white font-black rounded-xl text-xs px-2 hover:bg-slate-800">عرض الكشف</button>
                </div>
            </div>

            <div id="grand-capture-area" class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div class="flex justify-between items-center pb-2 border-b-2 border-slate-900 mb-3">
                    <h2 class="text-sm font-black text-slate-900">أرشيف تقاريري الحالية</h2>
                    <p class="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">المركز</p>
                </div>
                <div class="text-center">
                    <h3 id="display-month-s5" class="text-xs font-black text-slate-700">سجل البيانات الحالية</h3>
                </div>

                <div id="trader-full-invoice-wrapper-s5" class="mt-3 pt-2 border-t border-dashed border-slate-200">
                    <table class="w-full text-center text-[10px] border-collapse">
                        <thead>
                            <tr class="bg-slate-100 text-slate-700 font-bold">
                                <th class="p-1 border border-slate-200">الفئة</th>
                                <th class="p-1 border border-slate-200">مخزون</th>
                                <th class="p-1 border border-slate-200">متبقي</th>
                                <th class="p-1 border border-slate-200">مباع</th>
                                <th class="p-1 border border-slate-200">صافي</th>
                            </tr>
                        </thead>
                        <tbody id="trader-table-body-s5"></tbody>
                    </table>
                </div>

                <div class="overflow-x-auto mt-3">
                    <table class="w-full text-right text-xs border-collapse">
                        <thead>
                            <tr class="bg-slate-800 text-white font-bold">
                                <th class="p-2 border text-right rounded-r-lg">البيان المالي للحساب</th>
                                <th class="p-2 border text-center rounded-l-lg w-28">المبلغ المستحق</th>
                            </tr>
                        </thead>
                        <tbody id="grand-table-body"></tbody>
                    </table>
                </div>

                <div class="bg-slate-950 text-amber-400 p-3 rounded-xl flex justify-between items-center font-black text-sm mt-3 shadow-md">
                    <span>إجمالي مستحقات الشهور بالكامل:</span>
                    <span id="txt-grand-total">0.00 جنيه</span>
                </div>
            </div>

            <div class="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <p class="text-[10px] text-amber-900 border-r-2 border-amber-500 pr-1.5 font-bold mb-1.5">⚡ ميزات التصدير والطباعة:</p>
                <div class="grid grid-cols-3 gap-2">
                    <button onclick="openPreviewModal('grand-capture-area', 'png', 'كشف_الأرشيف')" class="border border-slate-300 py-2.5 rounded-xl font-black bg-white text-[10px] text-indigo-950 text-center shadow-2xs btn flex items-center justify-center gap-0.5">🖼️ كارت الأرشيف</button>
                    <button onclick="window.print()" class="bg-indigo-950 text-white py-2.5 rounded-xl font-black text-[10px] text-center shadow-xs btn flex items-center justify-center gap-0.5">🖨️ طباعة الكشف</button>
                    <button onclick="triggerDirectShare('grand-capture-area', 'كشف_الأرشيف')" class="bg-emerald-600 text-white py-2.5 rounded-xl font-black text-[10px] text-center shadow-xs btn flex items-center justify-center gap-0.5">📲 مشاركة واتس</button>
                </div>
            </div>

            <div class="space-y-3 pt-2">
                <button onclick="startNewMonthForTrader()" class="w-full bg-indigo-650 text-white font-black p-3 rounded-xl text-xs hover:bg-indigo-700 transition shadow-md">+ بدء دورة جرد جديدة</button>
                <button onclick="clearMyBackupAndReset()" class="w-full bg-red-50 text-red-600 border border-red-250 font-bold p-2.5 rounded-xl text-xs hover:bg-red-100 transition shadow-xs">🗑️ مسح وتفريغ سجل أرشيف الشهور بالكامل</button>
            </div>
        </div>

        <!-- Screen 6 -->
        <div id="screen-6" class="screen-view hidden space-y-4">
            <div>
                <h2 class="text-xl font-black text-slate-900">قسم الفرز واستدعاء البيانات</h2>
                <p class="text-xs text-slate-500 mt-0.5">استدعِ تفاصيل أي كشف حساب شهري بمجرد اختيار التاريخ:</p>
            </div>

            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 text-xs">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block font-bold text-slate-600 mb-1">السنة الحسابية:</label>
                        <select id="filter-year" class="w-full p-2 border border-slate-300 rounded-xl bg-white font-bold focus:outline-none"></select>
                    </div>
                    <div>
                        <label class="block font-bold text-slate-600 mb-1">الشهر الدورة:</label>
                        <select id="filter-month" class="w-full p-2 border border-slate-300 rounded-xl bg-white font-bold focus:outline-none"></select>
                    </div>
                </div>
                <button onclick="executeFilterSearch()" class="w-full bg-slate-900 text-white font-bold p-3 rounded-xl shadow-md text-xs transition hover:bg-slate-800">🔍 استرداد كشف الحساب وتفكيك البيانات</button>
            </div>

            <div id="filter-result-card" class="hidden space-y-3">
                <div id="filter-capture-area" class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div class="flex justify-between items-center pb-2 border-b border-dashed border-slate-300">
                        <h2 class="text-xs font-black text-slate-900">تقرير مستدعى بالفرز</h2>
                        <span class="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">أرشيف المحل</span>
                    </div>
                    <div class="text-center py-3 bg-slate-50/60 rounded-xl my-2 border border-slate-100 px-3">
                        <p class="text-[9px] text-slate-400 font-bold block mb-0.5">البيانات الفردية للتاجر</p>
                        <p id="filter-trader-name" class="font-black text-indigo-950 text-base leading-normal py-1 px-3 border-b border-dashed border-slate-200/80 inline-block min-w-[120px] max-w-full" style="font-size: 15px !important; font-weight: 900 !important; color: #1e1b4b !important;">${traderName}</p>
                        <p id="display-filter-date" class="text-[11px] text-indigo-700 font-extrabold mt-1.5 bg-indigo-50 px-2.5 py-0.5 rounded-full inline-block">--</p>
                    </div>

                    <div class="overflow-x-auto mt-3">
                        <table class="w-full text-center text-xs border-collapse">
                            <thead>
                                <tr class="bg-slate-100 text-slate-700 font-bold">
                                    <th class="p-1.5 border border-slate-200">الفئة</th>
                                    <th class="p-1.5 border border-slate-200">مخزون</th>
                                    <th class="p-1.5 border border-slate-200">متبقي</th>
                                    <th class="p-1.5 border border-slate-200">مباع</th>
                                    <th class="p-1.5 border border-slate-200">قيمة</th>
                                </tr>
                            </thead>
                            <tbody id="filter-table-body"></tbody>
                        </table>
                    </div>

                    <div class="mt-3 space-y-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div class="flex justify-between font-bold text-slate-700">
                            <span>إجمالي المبيعات المسترجعة:</span>
                            <span id="txt-filter-total-sales">0.00 ج</span>
                        </div>
                        <div class="flex justify-between text-red-600 font-bold">
                            <span>قيمة الخصم المعتمد المالي (<span id="txt-filter-discount-rate">0</span>%):</span>
                            <span id="txt-filter-discount-val">0.00 ج</span>
                        </div>
                        <div class="bg-indigo-900 text-white p-2.5 rounded-lg flex justify-between font-black text-sm mt-1">
                            <span>الصافي المستحق:</span>
                            <span id="txt-filter-net-amount">0.00 جنيه</span>
                        </div>
                    </div>
                </div>

                <div class="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <p class="text-[10px] text-amber-900 border-r-2 border-amber-500 pr-1.5 font-bold mb-1.5">⚡ ميزات التصدير والطباعة لـ مستند الفرز الحسابي:</p>
                    <div class="grid grid-cols-3 gap-2">
                        <button onclick="openPreviewModal('filter-capture-area', 'png', 'كشف_مفروز')" class="border border-slate-300 py-2.5 rounded-xl font-black bg-white text-[10px] text-indigo-950 text-center shadow-2xs btn flex items-center justify-center gap-0.5">🖼️ كارت الفرز</button>
                        <button onclick="window.print()" class="bg-indigo-950 text-white py-2.5 rounded-xl font-black text-[10px] text-center shadow-xs btn flex items-center justify-center gap-0.5">🖨️ طباعة الفرز</button>
                        <button onclick="triggerDirectShare('filter-capture-area', 'كشف_مفروز')" class="bg-emerald-600 text-white py-2.5 rounded-xl font-black text-[10px] text-center shadow-xs btn flex items-center justify-center gap-0.5">📲 مشاركة واتس</button>
                    </div>
                </div>
            </div>
        </div>

    </div>

    <!-- Live Preview Modal -->
    <div id="preview-modal" class="fixed inset-0 bg-black/60 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col justify-between shadow-2xl border border-slate-200 overflow-hidden text-right">
            <div class="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 class="font-black text-sm text-slate-900">👁️ معاينة حية قبل التصدير والتحميل</h3>
                <button onclick="closePreviewModal()" class="text-slate-400 hover:text-slate-600 font-bold text-xl px-2">×</button>
            </div>
            <div class="p-4 overflow-y-auto bg-slate-100 flex justify-center items-center flex-1 min-h-[220px]">
                <div id="preview-modal-body" class="w-full bg-white rounded-xl shadow-inner border border-slate-300 p-2 overflow-x-auto"></div>
            </div>
            <div class="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center w-full">
                <button onclick="closePreviewModal()" class="w-[30%] border border-slate-300 bg-white text-slate-700 font-bold py-3 rounded-xl text-xs cursor-pointer">إلغاء</button>
                <button id="modal-confirm-download-btn" class="w-[66%] bg-slate-1000 bg-indigo-950 text-white font-black py-3 rounded-xl text-xs shadow-md cursor-pointer">تأكيد التحميل الآن ✓</button>
            </div>
        </div>
    </div>

    <script>
        let appData = ${JSON.stringify(tData)};

        function toggleSidebar() {
            const drawer = document.getElementById('sidebar-drawer');
            const overlay = document.getElementById('sidebar-overlay');
            if (drawer.classList.contains('translate-x-full')) {
                drawer.classList.remove('translate-x-full');
                overlay.classList.remove('hidden');
                setTimeout(() => overlay.classList.add('opacity-100'), 10);
            } else {
                drawer.classList.add('translate-x-full');
                overlay.classList.remove('opacity-100');
                setTimeout(() => overlay.classList.add('hidden'), 300);
            }
        }

        function getContrastColor(hexColor) {
            if(!hexColor) return '#0f172a';
            const hex = hexColor.replace('#', '');
            if(hex.length !== 6) return '#0f172a';
            const r = parseInt(hex.substr(0,2), 16);
            const g = parseInt(hex.substr(2,2), 16);
            const b = parseInt(hex.substr(4,2), 16);
            const yiq = ((r*299)+(g*587)+(b*114))/1000;
            return (yiq >= 140) ? '#0f172a' : '#ffffff';
        }

        window.onload = function() {
            // Load from localStorage for trader app
            const localSaved = localStorage.getItem('trader_wifi_data_app');
            if(localSaved) {
                const parsed = JSON.parse(localSaved);
                if(parsed.categories) appData = parsed;
            }
            
            buildDropdowns();
            renderStepperTabs();
            setupTraderSelection();
            goToScreen(2);
            renderInventoryList();
        };

        function setupTraderSelection() {
            if (appData.isTraderVersion === false) {
                const area = document.getElementById('top-trader-area');
                if (area && appData.savedTradersList && appData.savedTradersList.length > 0) {
                    var selectHtml = '<select id="active-trader-select" onchange="changeActiveTrader(this.value)" class="p-1 px-1.5 border border-indigo-200 text-indigo-950 bg-indigo-50 font-black rounded-lg text-[10px] focus:outline-none cursor-pointer">';
                    appData.savedTradersList.forEach(function(t) {
                        if (t !== 'اختر تاجر من القائمة') {
                            var selectedAttr = (t === appData.traderName) ? 'selected' : '';
                            selectHtml += '<option value="' + t + '" ' + selectedAttr + '>التاجر: ' + t + '</option>';
                        }
                    });
                    selectHtml += '</select>';
                    area.innerHTML = selectHtml;
                }
            }
        }

        function changeActiveTrader(name) {
            appData.traderName = name;
            
            const badge = document.getElementById('top-trader-name-badge');
            if (badge) {
                badge.innerText = name;
            }
            
            document.querySelectorAll('.display-trader-name-dyn').forEach(el => {
                el.innerText = name;
            });
            const invLabel = document.getElementById('invoice-trader-name');
            if (invLabel) {
                invLabel.innerText = name;
            }
            const filLabel = document.getElementById('filter-trader-name');
            if (filLabel) {
                filLabel.innerText = name;
            }

            const centralKey = name + "_" + appData.currentMonth;
            if (appData.globalHistoryLogs && appData.globalHistoryLogs[centralKey]) {
                appData.inventory = appData.globalHistoryLogs[centralKey].inventory || {};
                appData.remaining = appData.globalHistoryLogs[centralKey].remaining || {};
                if (appData.globalHistoryLogs[centralKey].discountPercentage !== undefined) {
                    appData.discountPercentage = appData.globalHistoryLogs[centralKey].discountPercentage;
                }
            } else {
                appData.inventory = {};
                appData.remaining = {};
            }
            
            localStorage.setItem('trader_wifi_data_app', JSON.stringify(appData));
            
            renderInventoryList();
            
            const scr3 = document.getElementById('screen-3');
            if (scr3 && !scr3.classList.contains('hidden')) {
                renderRemainingList();
            }
            
            const scr4 = document.getElementById('screen-4');
            if (scr4 && !scr4.classList.contains('hidden')) {
                calculateReceipt();
            }
        }

        function buildDropdowns() {
            const fYear = document.getElementById('filter-year');
            const fMonth = document.getElementById('filter-month');
            if(!fYear || !fMonth) return;
            
            fYear.innerHTML = '<option value="">السنة</option>';
            for(let y=2026; y<=2035; y++) {
                fYear.innerHTML += \`<option value="\${y}">سنـة \${y}</option>\`;
            }
            fMonth.innerHTML = '<option value="">الشهر</option>';
            for(let i=1; i<=12; i++) {
                fMonth.innerHTML += \`<option value="\${i}">شهـر \${i}</option>\`;
            }

            // Sync values
            fYear.value = appData.selectedYearNum;
            fMonth.value = appData.selectedMonthNum;
        }

        function renderStepperTabs() {
            for(let i=2; i<=6; i++) {
                const circle = document.getElementById('step-circle-' + i);
                const text = document.getElementById('step-text-' + i);
                if(!circle || !text) continue;
                circle.className = "w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full border border-slate-300";
                text.className = "text-[9px] text-slate-500 mt-0.5";
            }
        }

        // Touch swipe gesture navigation
        let touchstartX = 0;
        let touchendX = 0;
        const activeScreensInOrder = [2, 3, 4, 5, 6];
        let currentActiveNum = 2;

        function handleGesture() {
            const minSwipeDistance = 50;
            const diff = touchstartX - touchendX;
            let currentIdx = activeScreensInOrder.indexOf(currentActiveNum);
            
            if (Math.abs(diff) > minSwipeDistance) {
                if (diff > 0) {
                    // Swiped left -> Previous page (Reversed swipe)
                    if (currentIdx > 0) {
                        goToScreen(activeScreensInOrder[currentIdx - 1]);
                    }
                } else {
                    // Swiped right -> Next page (Reversed swipe)
                    if (currentIdx < activeScreensInOrder.length - 1) {
                        const nextNum = activeScreensInOrder[currentIdx + 1];
                        if (currentActiveNum === 3 && nextNum === 4) {
                            calculateAndGoToS4();
                        } else {
                            goToScreen(nextNum);
                        }
                    }
                }
            }
        }

        document.addEventListener('touchstart', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                touchstartX = 0;
                return;
            }
            touchstartX = e.changedTouches[0].screenX;
        }, { passive: true });

        document.addEventListener('touchend', e => {
            if (touchstartX === 0) return;
            touchendX = e.changedTouches[0].screenX;
            handleGesture();
        }, { passive: true });

        function goToScreen(num) {
            currentActiveNum = num;
            document.querySelectorAll('.screen-view').forEach(s => s.classList.add('hidden'));
            const container = document.getElementById('screen-' + num);
            if(container) container.classList.remove('hidden');

            for(let i=2; i<=6; i++) {
                const circle = document.getElementById('step-circle-' + i);
                const text = document.getElementById('step-text-' + i);
                if(!circle || !text) continue;
                if(i === num) {
                    circle.className = "w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full border border-indigo-950 bg-indigo-950 text-white shadow-sm scale-110 transform";
                    text.className = "text-[9px] font-black text-indigo-950 mt-0.5";
                } else {
                    circle.className = "w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full border border-slate-200 bg-white text-slate-400";
                    text.className = "text-[9px] font-bold text-slate-400 mt-0.5";
                }
            }

            if(num === 2) renderInventoryList();
            if(num === 3) renderRemainingList();
            if(num === 4) rebuildInvoiceTableAndCalculations();
            if(num === 5) renderArchiveS5();
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function renderInventoryList() {
            const container = document.getElementById('inventory-list');
            if(!container) return;
            container.innerHTML = '';
            
            appData.categories.forEach(cat => {
                let val = appData.inventory[cat.label] !== undefined ? appData.inventory[cat.label] : '';
                const contrast = getContrastColor(cat.color);
                container.innerHTML += \`
                    <div style="background-color: \${cat.color}; color: \${contrast};" class="flex justify-between items-center p-3 rounded-xl border border-slate-300 shadow-sm">
                        <span class="font-black text-sm w-1/2 text-right">\${cat.label}</span>
                        <div class="w-28 bg-white border border-slate-400 rounded-lg">
                            <input type="number" placeholder="0" value="\${val}" oninput="updateInventory('\${cat.label}', this.value)" class="w-full p-2 text-sm text-slate-900 focus:outline-none">
                        </div>
                    </div>
                \`;
            });
        }

        function updateInventory(label, val) {
            if(val === '') delete appData.inventory[label];
            else appData.inventory[label] = parseInt(val) || 0;
            saveLocal();
        }

        function renderRemainingList() {
            const container = document.getElementById('remaining-list');
            if(!container) return;
            container.innerHTML = '';
            
            appData.categories.forEach(cat => {
                let inv = appData.inventory[cat.label] || 0;
                let rem = appData.remaining[cat.label] !== undefined ? appData.remaining[cat.label] : '';
                const contrast = getContrastColor(cat.color);
                container.innerHTML += \`
                    <div style="background-color: \${cat.color}; color: \${contrast};" class="grid grid-cols-3 gap-2 p-2.5 rounded-xl border border-slate-300 shadow-sm items-center text-center">
                        <span class="font-black text-xs text-right">\${cat.label}</span>
                        <span class="text-xs font-black bg-white/50 px-2 py-1 rounded text-slate-900 w-16 mx-auto border border-black/10">\${inv}</span>
                        <div class="w-24 bg-white border border-slate-400 rounded-lg ml-0 mr-auto">
                            <input type="number" placeholder="0" value="\${rem}" oninput="updateRemaining('\${cat.label}', this.value)" class="w-full p-2 text-xs text-slate-900 focus:outline-none">
                        </div>
                    </div>
                \`;
            });
        }

        function updateRemaining(label, val) {
            if(val === '') delete appData.remaining[label];
            else appData.remaining[label] = parseInt(val) || 0;
            saveLocal();
        }

        function calculateAndGoToS4() {
            for(let i=0; i<appData.categories.length; i++) {
                let label = appData.categories[i].label;
                let inv = appData.inventory[label] || 0;
                let rem = appData.remaining[label] || 0;
                if(rem > inv) {
                    alert('المتبقي لا يمكن أن يكون أكبر من المخزون!');
                    return;
                }
            }
            goToScreen(4);
        }

        function rebuildInvoiceTableAndCalculations() {
            const tbody = document.getElementById('invoice-table-body');
            if(!tbody) return;
            tbody.innerHTML = '';
            
            let total = 0;
            appData.categories.forEach(cat => {
                let inv = appData.inventory[cat.label] || 0;
                let rem = appData.remaining[cat.label] || 0;
                let sold = inv - rem;
                let val = sold * cat.value;
                total += val;
                tbody.innerHTML += \`
                    <tr class="font-bold text-slate-800">
                        <td class="p-1.5 border border-slate-200 text-right font-black">\${cat.label}</td>
                        <td class="p-1.5 border border-slate-200">\${inv}</td>
                        <td class="p-1.5 border border-slate-200">\${rem}</td>
                        <td class="p-1.5 border border-slate-200 text-indigo-700 font-extrabold">\${sold}</td>
                        <td class="p-1.5 border border-slate-200">\${val.toFixed(2)} ج</td>
                    </tr>
                \`;
            });

            let discVal = (total * appData.discountPercentage) / 100;
            let net = total - discVal;

            document.getElementById('txt-total-sales').innerText = total.toFixed(2) + " ج";
            document.getElementById('txt-discount-val').innerText = discVal.toFixed(2) + " ج";
            document.getElementById('txt-net-amount').innerText = net.toFixed(2) + " جنيه";
            document.getElementById('txt-timestamp').innerText = "تاريخ التصفية: " + new Date().toLocaleString('ar-EG');
        }

        function saveInvoiceToLogAndGoToS5() {
            let total = 0;
            appData.categories.forEach(cat => {
                total += ((appData.inventory[cat.label] || 0) - (appData.remaining[cat.label] || 0)) * cat.value;
            });
            let discVal = (total * appData.discountPercentage) / 100;
            let net = total - discVal;

            const archiveKey = appData.traderName + "_" + appData.currentMonth;
            if(!appData.traderArchive) appData.traderArchive = {};
            appData.traderArchive[archiveKey] = {
                traderName: appData.traderName,
                period: appData.currentMonth,
                totalSales: total,
                discountRate: appData.discountPercentage,
                discountVal: discVal,
                netAmount: net,
                timestamp: new Date().toLocaleString('ar-EG'),
                categoriesSnapshot: JSON.parse(JSON.stringify(appData.categories)),
                inventorySnapshot: {...appData.inventory},
                remainingSnapshot: {...appData.remaining}
            };

            let idx = appData.savedTradersLog.findIndex(item => item.period === appData.currentMonth);
            if(idx !== -1) {
                appData.savedTradersLog[idx].finalAmount = net;
            } else {
                appData.savedTradersLog.push({
                    name: appData.traderName,
                    finalAmount: net,
                    period: appData.currentMonth
                });
            }

            // Sync historical data
            const centralKey = appData.traderName + "_" + appData.currentMonth;
            if(!appData.globalHistoryLogs) appData.globalHistoryLogs = {};
            appData.globalHistoryLogs[centralKey] = {
                inventory: {...appData.inventory},
                remaining: {...appData.remaining},
                discountPercentage: appData.discountPercentage,
                categories: [...appData.categories]
            };

            saveLocal();
            goToScreen(5);
            alert("✓ تم حفظ وإرسال الفاتورة إلى الأرشيف الشهري بنجاح.");
        }

        function renderArchiveS5() {
            // Dropdown build
            const select = document.getElementById('select-archive-month-s5');
            if(!select) return;
            select.innerHTML = '<option value="">اختر فترة</option>';
            for(let key in appData.traderArchive) {
                if(key.startsWith(appData.traderName + "_")) {
                    let p = key.replace(appData.traderName + "_", "");
                    select.innerHTML += \`<option value="\${p}">\${p}</option>\`;
                }
            }

            document.getElementById('display-month-s5').innerText = "مسودة الجرد الجارية للتاجر";
            
            // Render active snapshot
            const tbody = document.getElementById('trader-table-body-s5');
            if(tbody) {
                tbody.innerHTML = '';
                appData.categories.forEach(c => {
                    let iv = appData.inventory[c.label] || 0;
                    let rm = appData.remaining[c.label] || 0;
                    let sold = iv - rm;
                    let val = sold * c.value;
                    tbody.innerHTML += \`
                        <tr class="font-bold text-slate-700">
                            <td class="p-1 border text-right font-black">\${c.label}</td>
                            <td class="p-1 border">\${iv}</td>
                            <td class="p-1 border">\${rm}</td>
                            <td class="p-1 border text-indigo-700">\${sold}</td>
                            <td class="p-1 border">\${val.toFixed(2)}</td>
                        </tr>
                    \`;
                });
            }

            let total = 0;
            appData.categories.forEach(cat => {
                total += ((appData.inventory[cat.label] || 0) - (appData.remaining[cat.label] || 0)) * cat.value;
            });
            let discVal = (total * appData.discountPercentage) / 100;
            let net = total - discVal;

            const gBody = document.getElementById('grand-table-body');
            if(gBody) {
                gBody.innerHTML = \`
                    <tr class="font-bold text-slate-800 bg-slate-50">
                        <td class="p-2 border text-right font-black">إجمالي مبيعاتك الحالية</td>
                        <td class="p-2 border text-center text-indigo-700">\${total.toFixed(2)} ج</td>
                    </tr>
                    <tr class="font-bold text-xs text-red-600">
                        <td class="p-2 border text-right">قيمة الخصم الممنوح لك (\${appData.discountPercentage}%)</td>
                        <td class="p-2 border text-center">-\${discVal.toFixed(2)} ج</td>
                    </tr>
                \`;
            }

            // Sum totals
            let grandSum = 0;
            appData.savedTradersLog.forEach(i => grandSum += i.finalAmount);
            document.getElementById('txt-grand-total').innerText = grandSum.toFixed(2) + " جنيه";
        }

        function loadSpecificMonthReportS5() {
            const val = document.getElementById('select-archive-month-s5').value;
            if(!val) { alert('من فضلك حدد فترة!'); return; }

            const key = appData.traderName + "_" + val;
            const data = appData.traderArchive[key];
            if(!data) return;

            document.getElementById('display-month-s5').innerText = "كشف حساب مؤرشف لفترة: " + val;
            const tbody = document.getElementById('trader-table-body-s5');
            if(tbody) {
                tbody.innerHTML = '';
                let cats = data.categoriesSnapshot || appData.categories;
                let invs = data.inventorySnapshot || {};
                let rems = data.remainingSnapshot || {};
                cats.forEach(c => {
                    let iv = invs[c.label] || 0;
                    let rm = rems[c.label] || 0;
                    let sl = iv - rm;
                    let val = sl * c.value;
                    tbody.innerHTML += \`
                        <tr class="font-bold text-slate-700">
                            <td class="p-1 border text-right font-black">\${c.label}</td>
                            <td class="p-1 border">\${iv}</td>
                            <td class="p-1 border">\${rm}</td>
                            <td class="p-1 border text-indigo-700">\${sl}</td>
                            <td class="p-1 border">\${val.toFixed(2)}</td>
                        </tr>
                    \`;
                });
            }

            const gBody = document.getElementById('grand-table-body');
            if(gBody) {
                gBody.innerHTML = \`
                    <tr class="font-bold text-slate-800 bg-slate-50">
                        <td class="p-2 border text-right font-black">إجمالي مبيعات الفترة الصافي</td>
                        <td class="p-2 border text-center text-indigo-700">\${data.totalSales.toFixed(2)} ج</td>
                    </tr>
                    <tr class="font-bold text-xs text-red-600">
                        <td class="p-2 border text-right">خصم مالي معتمد (\${data.discountRate}%)</td>
                        <td class="p-2 border text-center">-\\ \${data.discountVal.toFixed(2)} ج</td>
                    </tr>
                \`;
            }
            document.getElementById('txt-grand-total').innerText = data.netAmount.toFixed(2) + " جنيه";
        }

        function executeFilterSearch() {
            const y = document.getElementById('filter-year').value;
            const m = document.getElementById('filter-month').value;
            if(!y || !m) { alert('من فضلك أكمل المعطيات!'); return; }

            const searchPeriod = \`شهر \${m} - \${y}\`;
            const key = appData.traderName + "_" + searchPeriod;
            const data = appData.traderArchive[key];

            if(!data) {
                alert('لا تتوفر سجلات لهذه الفترة!');
                document.getElementById('filter-result-card').classList.add('hidden');
                return;
            }

            document.getElementById('display-filter-date').innerText = data.period;
            const tbody = document.getElementById('filter-table-body');
            if(tbody) {
                tbody.innerHTML = '';
                let cats = data.categoriesSnapshot || appData.categories;
                let invs = data.inventorySnapshot || {};
                let rems = data.remainingSnapshot || {};
                cats.forEach(c => {
                    let iv = invs[c.label] || 0;
                    let rm = rems[c.label] || 0;
                    let sl = iv - rm;
                    let rowValue = sl * c.value;
                    tbody.innerHTML += \`
                        <tr class="font-bold text-slate-800">
                            <td class="p-1.5 border border-slate-200 text-right font-black">\${c.label}</td>
                            <td class="p-1.5 border border-slate-200">\${iv}</td>
                            <td class="p-1.5 border border-slate-200">\${rm}</td>
                            <td class="p-1.5 border border-slate-200 text-indigo-700 font-black">\${sl}</td>
                            <td class="p-1.5 border border-slate-200">\${rowValue.toFixed(2)} ج</td>
                        </tr>
                    \`;
                });
            }

            document.getElementById('txt-filter-total-sales').innerText = data.totalSales.toFixed(2) + " ج";
            document.getElementById('txt-filter-discount-rate').innerText = data.discountRate;
            document.getElementById('txt-filter-discount-val').innerText = data.discountVal.toFixed(2) + " ج";
            document.getElementById('txt-filter-net-amount').innerText = data.netAmount.toFixed(2) + " جنيه";

            document.getElementById('filter-result-card').classList.remove('hidden');
        }

        function startNewMonthForTrader() {
            let m = prompt("رقم الشهر الجديد (1-12):", appData.selectedMonthNum);
            if(!m) return;
            let y = prompt("السنة الجديدة:", appData.selectedYearNum);
            if(!y) return;

            appData.selectedMonthNum = m;
            appData.selectedYearNum = y;
            appData.currentMonth = \`شهر \${m} - \${y}\`;
            appData.inventory = {};
            appData.remaining = {};
            
            saveLocal();
            goToScreen(2);
            alert('تم فتح دورة جرد جديدة للفترة: ' + appData.currentMonth);
        }

        function clearMyBackupAndReset() {
            if(confirm('هل أنت متأكد من مسح كافة سجلات الأرشيف والبيانات المحلية؟')) {
                localStorage.removeItem('trader_wifi_data_app');
                appData.inventory = {};
                appData.remaining = {};
                appData.traderArchive = {};
                appData.savedTradersLog = [];
                appData.globalHistoryLogs = {};
                saveLocal();
                goToScreen(2);
                alert('تم التصفير بنجاح.');
            }
        }

        function saveLocal() {
            localStorage.setItem('trader_wifi_data_app', JSON.stringify(appData));
        }

        // Preview & Download
        let curId = '';
        let curType = '';
        let curFile = '';

        // Helper to translate oklch to rgb for html2canvas compatibility
        function translateOklchToRgb(val) {
            if (typeof val !== 'string' || !val.includes('oklch')) return val;
            try {
                return val.replace(/oklch\(([^)]+)\)/g, function(match, content) {
                    try {
                        var parts = content.trim().split('/');
                        var colorPart = parts[0].trim();
                        var alphaPart = parts[1] ? parts[1].trim() : null;

                        var coords = colorPart.split(/\s+/).map(function(v) {
                            if (v.endsWith('%')) {
                                return parseFloat(v) / 100;
                            }
                            return parseFloat(v);
                        });

                        if (coords.length < 3 || coords.some(isNaN)) {
                            return 'rgb(0,0,0)';
                        }

                        var L = coords[0];
                        var C = coords[1];
                        var H = coords[2];
                        var alpha = 1;

                        if (alphaPart) {
                            if (alphaPart.endsWith('%')) {
                                alpha = parseFloat(alphaPart) / 100;
                            } else {
                                alpha = parseFloat(alphaPart);
                            }
                        }

                        var hRad = (H * Math.PI) / 180;
                        var a = C * Math.cos(hRad);
                        var b = C * Math.sin(hRad);

                        var l_ = L + 0.3963377774 * a + 0.2158017574 * b;
                        var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
                        var s_ = L - 0.0894841775 * a - 1.2914855480 * b;

                        var l_pow = l_ * l_ * l_;
                        var m_pow = m_ * m_ * m_;
                        var s_pow = s_ * s_ * s_;

                        var r_l = +4.0767416621 * l_pow - 3.3077115913 * m_pow + 0.2309699292 * s_pow;
                        var g_l = -1.2684380046 * l_pow + 2.6097574011 * m_pow - 0.3413193965 * s_pow;
                        var b_l = -0.0041960863 * l_pow - 0.7034186147 * m_pow + 1.7076147010 * s_pow;

                        var gamma = function(v) {
                            if (v <= 0.0031308) {
                                return 12.92 * v;
                            } else {
                                return 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
                            }
                        };

                        var r = Math.max(0, Math.min(255, Math.round(gamma(r_l) * 255)));
                        var g = Math.max(0, Math.min(255, Math.round(gamma(g_l) * 255)));
                        var b = Math.max(0, Math.min(255, Math.round(gamma(b_l) * 255)));

                        if (alpha === 1 || isNaN(alpha)) {
                            return 'rgb(' + r + ', ' + g + ', ' + b + ')';
                        } else {
                            return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
                        }
                    } catch (e) {
                        return 'rgb(0,0,0)';
                    }
                });
            } catch (outerErr) {
                return val;
            }
        }

        function patchClonedDocumentStyles(clonedDoc) {
            try {
                var originalGetComputedStyle = clonedDoc.defaultView ? clonedDoc.defaultView.getComputedStyle : null;
                if (clonedDoc.defaultView && originalGetComputedStyle) {
                    clonedDoc.defaultView.getComputedStyle = function (elt, pseudoElt) {
                        var style = originalGetComputedStyle.call(this, elt, pseudoElt);
                        return new Proxy(style, {
                            get: function(target, prop, receiver) {
                                if (prop === 'getPropertyValue') {
                                    return function(property) {
                                        var innerVal = target.getPropertyValue(property);
                                        if (typeof innerVal === 'string' && innerVal.includes('oklch')) {
                                            return translateOklchToRgb(innerVal);
                                        }
                                        return innerVal;
                                    };
                                }
                                
                                var val = Reflect.get(target, prop, receiver);
                                if (typeof val === 'string' && val.includes('oklch')) {
                                    return translateOklchToRgb(val);
                                }
                                if (typeof val === 'function') {
                                    return val.bind(target);
                                }
                                return val;
                            }
                        });
                    };
                }
            } catch (err) {
                console.error('Error patching styles:', err);
            }
        }

        function openPreviewModal(id, type, name) {
            curId = id;
            curType = type;
            curFile = name;

            const element = document.getElementById(id);
            const container = document.getElementById('preview-modal-body');
            if(!element || !container) return;

            // Clone the whole element to retain outer boundaries, background, and padding correctly
            container.innerHTML = '<div class="text-center p-6 text-xs font-bold text-slate-500 flex flex-col items-center justify-center gap-2"><span class="w-5 h-5 inline-block border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span><span>جاري توليد كارت المعاينة المصورة بدقة عالية...</span></div>';
            
            // Show modal immediately
            document.getElementById('preview-modal').classList.remove('hidden');

            // Generate PNG preview to support long-press-to-save natively in all browsers
            setTimeout(() => {
                html2canvas(element, { 
                    scale: 2.2, 
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    onclone: function(clonedDoc) {
                        patchClonedDocumentStyles(clonedDoc);
                    }
                }).then(canvas => {
                    const dataUrl = canvas.toDataURL('image/png');
                    container.innerHTML = \`
                        <div class="space-y-3 pb-1 text-center font-bold">
                            <img src="\${dataUrl}" class="max-h-[300px] object-contain mx-auto border-2 border-indigo-100 rounded-xl shadow-md hover:scale-[1.01] transition-transform duration-200 pointer-events-auto" style="display: block; max-width: 100%;" alt="فاتورة الجرد الحالية" />
                            <div class="bg-emerald-50 text-emerald-800 text-center text-[9.5px] font-black p-2 rounded-xl border border-emerald-100/60 leading-normal">
                                💡 للموبايل والتابلت والكمبيوتر: يمكنك الضغط مطولاً على هذه الصورة أو (كليك يمين) ثم اختيار "حفظ الصورة باسم" لتنزيلها أو مشاركتها مباشرة على واتسـاب!
                            </div>
                        </div>
                    \`;
                }).catch(err => {
                    console.error('Auto preview generation failed:', err);
                    // Fallback to highly-styled HTML preview inside the modal
                    container.innerHTML = '<div class="text-right font-black text-xs select-text text-slate-900 leading-relaxed overflow-x-auto w-full p-2 bg-white" style="direction: rtl;">' + element.innerHTML + '</div>';
                });
            }, 150);

            document.getElementById('modal-confirm-download-btn').setAttribute('onclick', 'startDownload()');
        }

        function closePreviewModal() {
            document.getElementById('preview-modal').classList.add('hidden');
        }

        function generateInvoiceTextSummary(areaId) {
            let trader = appData.traderName || 'التاجر المعتمد';
            let period = appData.currentMonth || '';
            let text = "🧾 *كشف حساب كروت الواي فاي* 🧾\n";
            text += "----------------------------------------\n";
            text += "👤 *التاجر:* " + trader + "\n";
            text += "📅 *الفترة:* " + period + "\n";
            text += "----------------------------------------\n\n";

            let targetCategories = appData.categories;
            let targetInventory = appData.inventory;
            let targetRemaining = appData.remaining;
            let discRate = appData.discountPercentage;
            let data = null;

            if (areaId === 'filter-capture-area') {
                const dateEl = document.getElementById('display-filter-date');
                const filterPeriod = dateEl ? dateEl.innerText.trim() : '';
                const archiveKey = appData.traderName + "_" + filterPeriod;
                data = appData.traderArchive[archiveKey];
                
                text = "🧾 *تقرير الفرز المستدعى - حساب كروت الواي فاي* 🧾\n";
                text += "----------------------------------------\n";
                text += "👤 *التاجر:* " + trader + "\n";
                text += "📅 *الفترة:* " + filterPeriod + "\n";
                text += "----------------------------------------\n\n";

                if (data) {
                    targetCategories = data.categoriesSnapshot || appData.categories;
                    targetInventory = data.inventorySnapshot || {};
                    targetRemaining = data.remainingSnapshot || {};
                    discRate = data.discountRate !== undefined ? data.discountRate : appData.discountPercentage;
                }
            } else if (areaId === 'grand-capture-area') {
                const selectedVal = document.getElementById('select-archive-month-s5').value;
                let archiveKey = appData.traderName + "_" + selectedVal;
                data = appData.traderArchive[archiveKey];
                
                text = "🧾 *كشف حساب مؤرشف - حساب كروت الواي فاي* 🧾\n";
                text += "----------------------------------------\n";
                text += "👤 *التاجر:* " + trader + "\n";
                text += "📅 *الفترة:* " + (selectedVal ? "أرشيف " + selectedVal : "المسودة الجارية") + "\n";
                text += "----------------------------------------\n\n";

                if (selectedVal && data) {
                    targetCategories = data.categoriesSnapshot || appData.categories;
                    targetInventory = data.inventorySnapshot || {};
                    targetRemaining = data.remainingSnapshot || {};
                    discRate = data.discountRate !== undefined ? data.discountRate : appData.discountPercentage;
                }
            }

            text += "📊 *تفاصيل جرد الفئات:* \n";
            
            let totalVal = 0;
            targetCategories.forEach(cat => {
                let label = cat.label;
                let inv = targetInventory[label] || 0;
                let rem = targetRemaining[label] || 0;
                let sold = inv - rem;
                let val = sold * cat.value;
                totalVal += val;
                
                text += "🔹 *" + label + "*:\n";
                text += "   [مخزون: " + inv + " | متبقي: " + rem + " | مباع: " + sold + "] -> *" + val.toFixed(2) + " ج*\n";
            });

            let discVal = (totalVal * discRate) / 100;
            let net = totalVal - discVal;

            text += "\n----------------------------------------\n";
            text += "💵 *إجمالي المبيعات:* " + totalVal.toFixed(2) + " ج\n";
            text += "🎁 *الخصم المالي الممنوح (" + discRate + "%):* -" + discVal.toFixed(2) + " ج\n";
            text += "👑 *الصافي المستحق:* *" + net.toFixed(2) + " جنيه*\n";
            
            if (areaId === 'grand-capture-area') {
                let grandSum = 0;
                const selectVal = document.getElementById('select-archive-month-s5').value;
                if (selectVal && data) {
                    grandSum = data.netAmount;
                    text += "💎 *المستحق الكلي لفترة " + selectVal + ":* *" + grandSum.toFixed(2) + " جنيه*\n";
                } else {
                    appData.savedTradersLog.forEach(i => grandSum += i.finalAmount);
                    text += "💎 *المستحق الكلي لكافة الشهور:* *" + grandSum.toFixed(2) + " جنيه*\n";
                }
            }

            text += "----------------------------------------\n";
            text += "💡 تاريخ وتوقيت التصفية: " + new Date().toLocaleString('ar-EG') + "\n";
            text += "_تم التوليد بنجاح عبر برنامج حساب كروت الواي فاي._\n";
            text += "_إعداد وتصميم م/ ابراهيم جابر_";
            return text;
        }

        async function triggerDirectShare(areaId, fileName) {
            const element = document.getElementById(areaId);
            if (!element) {
                alert('حدث خطأ: لا يمكن العثور على منطقة الجرد المحددة.');
                return;
            }

            // Capture text summary
            const textSummary = generateInvoiceTextSummary(areaId);

            // Copy to clipboard safely
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(textSummary);
                } else {
                    const textarea = document.createElement('textarea');
                    textarea.value = textSummary;
                    textarea.style.position = 'fixed';
                    textarea.style.left = '-9999px';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                }
            } catch (clipErr) {
                console.warn('Clipboard backup copy failed:', clipErr);
            }

            try {
                // Generate canvas
                const canvas = await html2canvas(element, { 
                    scale: 2.2, 
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    onclone: function(clonedDoc) {
                        patchClonedDocumentStyles(clonedDoc);
                    }
                });

                const dataUrl = canvas.toDataURL('image/png');

                // Upload image dynamically to host
                let shareUrl = '';
                try {
                    const res = await fetch('/api/save-report', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            image: dataUrl,
                            title: fileName.replace('كارت_حساب_', '').replace('كشف_الأرشيف_بـ_', '').replace(/_/g, ' '),
                            date: new Date().toLocaleDateString('ar-EG'),
                            mime: 'image/png'
                        })
                    });
                    const resData = await res.json();
                    if (resData && resData.success) {
                        shareUrl = resData.url;
                    }
                } catch (uploadErr) {
                    console.warn('Upload image failed:', uploadErr);
                }

                // Format message
                let finalMsg = textSummary;
                if (shareUrl) {
                    finalMsg += "\n\n🖼️ *لمشاهدة وتحميل كارت الصورة الفاتورة بدقة ممتازة وبكبسة واحدة:*\n" + shareUrl;
                }

                alert(
                    "📊 تم رفع كارت الفاتورة وتوليد رابط المعاينة الذكي لـ واتساب بنجاح!\n\n" +
                    "📋 تم نسخ تفاصيل الحساب كاملة أوتوماتيكياً في حافظة جهازك أيضاً كمساندة.\n" +
                    "💡 جاري توجيهك الآن للواتساب؛ اضغط \"موافق\" وثق بميزة \"لصق/Paste\" لإرسال الفاتورة مع الصورة المعتمدة فوراً!"
                );

                const waUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(finalMsg);
                window.open(waUrl, '_top') || (window.location.href = waUrl);
            } catch (err) {
                console.warn('Sharing failed, falling back to summary message:', err);
                const waUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(textSummary);
                window.open(waUrl, '_top') || (window.location.href = waUrl);
            }
        }

        function startDownload() {
            closePreviewModal();
            const element = document.getElementById(curId);
            if(!element) return;

            if(curType === 'png') {
                html2canvas(element, { 
                    scale: 3, 
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    onclone: function(clonedDoc) {
                        patchClonedDocumentStyles(clonedDoc);
                    }
                }).then(canvas => {
                    const dataUrl = canvas.toDataURL('image/png');
                    
                    // POST download form
                    const form = document.createElement('form');
                    form.method = 'POST';
                    form.action = '/api/download-direct';
                    form.target = '_self';
                    
                    const input1 = document.createElement('input');
                    input1.type = 'hidden';
                    input1.name = 'base64Data';
                    input1.value = dataUrl;
                    form.appendChild(input1);

                    const input2 = document.createElement('input');
                    input2.type = 'hidden';
                    input2.name = 'fileName';
                    input2.value = curFile + '.png';
                    form.appendChild(input2);

                    const input3 = document.createElement('input');
                    input3.type = 'hidden';
                    input3.name = 'mimeType';
                    input3.value = 'image/png';
                    form.appendChild(input3);

                    document.body.appendChild(form);
                    form.submit();
                    document.body.removeChild(form);
                });
            } else {
                // Generating PDF on the pure client inside this standalone window is fine, 
                // but utilizing HTML to PDF generator bypass can be easily streamed!
                // Let's create a server direct download for PDF.
                const opt = {
                    margin: 8,
                    filename: curFile + '.pdf',
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { 
                        scale: 3, 
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        onclone: function(clonedDoc) {
                            patchClonedDocumentStyles(clonedDoc);
                        }
                    },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };
                
                // Let's run html2pdf fallback. Since this runs inside an completely independent tab (_blank), 
                // client-side downloads are NOT blocked because the tab is at the top level outside of the iframe sandbox! 
                // Thus, direct saving works 100% fine up here!
                html2pdf().set(opt).from(element).save();
            }
        }
    </script>
</body>
</html>`;
}
