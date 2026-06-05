import React, { useState, useEffect } from 'react';
import { Category, AppData, ArchiveEntry } from '../types';
import { 
  Building2, Image, FileText, Trash2, RotateCcw, UserMinus, 
  ChevronLeft, Search, PlusCircle, Archive,
  Download, Share2, CalendarRange, Printer, Smartphone
} from 'lucide-react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { generateIndependentTraderHTML } from '../utils/helpers';
import { LocalDB } from '../utils/db';

const localStorage = LocalDB; // Drop-in IndexedDB proxy


interface Screen5Props {
  appData: AppData;
  categories: Category[];
  isTraderVersion: boolean;
  onPrev: () => void;
  onNavigateToScreen: (screenNum: number) => void;
  onResetForAnotherTrader: () => void;
  onOpenPreview: (areaId: string, type: 'png' | 'pdf', fileName: string) => void;
  onUpdateMonthForTrader: () => void;
}

const renderSimpleDate = (day: string | number, month: string | number, year: string | number, textColor: string = 'text-indigo-600') => {
  const d = String(day).padStart(2, '0');
  const m = String(month).padStart(2, '0');
  const y = String(year);
  return (
    <span className={`inline-flex flex-row-reverse items-center gap-0.5 font-sans font-black ${textColor} underline decoration-indigo-400 decoration-1 mx-1`} dir="ltr">
      <span>{d}</span>
      <span className="opacity-70 font-normal">/</span>
      <span>{m}</span>
      <span className="opacity-70 font-normal">/</span>
      <span>{y}</span>
    </span>
  );
};

const renderCompactDateString = (day: string | number, month: string | number, year: string | number) => {
  const d = String(day).padStart(2, '0');
  const m = String(month).padStart(2, '0');
  const y = String(year);
  return `${d}/${m}/${y}`;
};

const getOrCreateArchiveEntry = (traderName: string, period: string, appData: AppData, categories: Category[]): ArchiveEntry | null => {
  const archiveKey = `${traderName}_${period}`;
  if (appData.traderArchive[archiveKey]) {
    return appData.traderArchive[archiveKey];
  }
  
  // Try to construct from globalHistoryLogs
  const history = appData.globalHistoryLogs[archiveKey];
  const inventory = history?.inventory || {};
  const remaining = history?.remaining || {};
  const discountRate = history?.discountPercentage ?? appData.discountPercentage;
  const cats = history?.categories ?? categories;
  
  let totalSales = 0;
  cats.forEach(cat => {
    const inv = inventory[cat.label] || 0;
    const rem = remaining[cat.label] || 0;
    totalSales += Math.max(0, inv - rem) * cat.value;
  });
  const discountVal = (totalSales * discountRate) / 100;
  const netAmount = totalSales - discountVal;
  
  return {
    traderName,
    period,
    totalSales,
    discountRate,
    discountVal,
    netAmount,
    timestamp: new Date().toLocaleString('ar-EG'),
    categoriesSnapshot: cats,
    inventorySnapshot: inventory,
    remainingSnapshot: remaining
  };
};

const generateStaticInvoiceHTML = (entry: ArchiveEntry): string => {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة كشف حساب - \${entry.traderName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    body {
      font-family: 'Cairo', sans-serif;
      direction: rtl;
      background-color: #f1f5f9;
      color: #1e293b;
      margin: 0;
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 30px;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      box-sizing: border-box;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #1e1b4b;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header h2 {
      font-size: 14px;
      font-weight: 900;
      margin: 0;
      color: #0f172a;
    }
    .header .badge {
      font-size: 9px;
      font-weight: 700;
      color: #4f46e5;
      background-color: #f5f3ff;
      border: 1px solid #ddd6fe;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .merchant-box {
      text-align: center;
      background-color: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .merchant-title {
      font-size: 10px;
      color: #64748b;
      font-weight: 700;
      margin: 0 0 4px 0;
    }
    .merchant-name {
      font-size: 16px;
      font-weight: 900;
      color: #1e1b4b;
      margin: 0 0 8px 0;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 6px;
      display: inline-block;
      min-width: 150px;
    }
    .merchant-period {
      font-size: 11px;
      font-weight: 800;
      color: #4338ca;
      background-color: #e0e7ff;
      padding: 4px 12px;
      border-radius: 9999px;
      display: inline-block;
      margin: 0;
    }
    h3 {
      font-size: 11px;
      font-weight: 900;
      color: #475569;
      margin-bottom: 8px;
      text-align: right;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 16px;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background-color: #f1f5f9;
      color: #334155;
      font-weight: 800;
      padding: 8px;
      border: 1px solid #cbd5e1;
      font-size: 11px;
      text-align: center;
    }
    td {
      padding: 8px;
      border: 1px solid #e2e8f0;
      font-size: 11px;
      font-weight: 700;
      color: #1e293b;
      text-align: center;
    }
    td.text-right {
      text-align: right;
    }
    td.text-left {
      text-align: left;
    }
    .financials {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
      margin-top: 12px;
    }
    .financial-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 6px;
    }
    .financial-row.discount {
      color: #e11d48;
    }
    .financial-row.grand {
      background-color: #1e1b4b;
      color: #ffffff;
      padding: 10px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 950;
      margin-top: 8px;
      margin-bottom: 0;
    }
    .timestamp {
      font-size: 9px;
      color: #94a3b8;
      text-align: center;
      margin-top: 16px;
    }
    .footer {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 24px;
      font-size: 11px;
      color: #475569;
      text-align: center;
    }
    .no-print-btn {
      margin-top: 16px;
      width: 100%;
      background-color: #1e1b4b;
      color: #ffffff;
      font-family: 'Cairo', sans-serif;
      font-weight: 700;
      border: none;
      padding: 12px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      transition: background-color 0.2s;
    }
    .no-print-btn:hover {
      background-color: #312e81;
    }
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .container {
        border: none;
        box-shadow: none;
        max-width: 100%;
        padding: 0;
      }
      .no-print-btn {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>برنامج حسابات الكروت</h2>
      <span class="badge">الفاتورة الضريبية</span>
    </div>
    
    <div class="merchant-box">
      <p class="merchant-title">العميل والمستلم</p>
      <h1 class="merchant-name">\${entry.traderName}</h1>
      <div>
        <p class="merchant-period">\${entry.period}</p>
      </div>
    </div>
    
    <h3>المبيعات المفصلة بالكروت الفردية:</h3>
    <table>
      <thead>
        <tr>
          <th>الفئة</th>
          <th>المخزون</th>
          <th>المتبقي</th>
          <th>المباع</th>
          <th>القيمة</th>
        </tr>
      </thead>
      <tbody>
        \${entry.categoriesSnapshot.map(cat => {
          const inv = entry.inventorySnapshot[cat.label] ?? 0;
          const rem = entry.remainingSnapshot[cat.label] ?? 0;
          const sold = Math.max(0, inv - rem);
          const val = sold * cat.value;
          return "<tr>" +
            "<td class='text-right'>" + cat.label + "</td>" +
            "<td>" + inv + "</td>" +
            "<td>" + rem + "</td>" +
            "<td style='color: #4338ca;'>" + sold + "</td>" +
            "<td class='text-left'>" + val.toFixed(2) + " ج.م</td>" +
            "</tr>";
        }).join('')}
      </tbody>
    </table>
    
    <div class="financials">
      <div class="financial-row">
        <span>إجمالي المبيعات:</span>
        <span>\${entry.totalSales.toFixed(2)} ج.م</span>
      </div>
      <div class="financial-row discount">
        <span>قيمة الخصم المعتمد (\${entry.discountRate}%):</span>
        <span>-\${entry.discountVal.toFixed(2)} ج.م</span>
      </div>
      <div class="financial-row grand">
        <span>الصافي المستحق للمورد:</span>
        <span>\${entry.netAmount.toFixed(2)} ج.م</span>
      </div>
    </div>
    
    <p class="timestamp">تاريخ ووقت طباعة الكشف: \${entry.timestamp || new Date().toLocaleString('ar-EG')}</p>
    
    <div class="footer">
      <span>تطبيق حساب كروت الواي فاي © 2026</span>
      <span style="font-weight: 900; color: #1e1b4b; margin-top: 4px;">إعداد وتصميم م/ ابراهيم جابر</span>
    </div>
    
    <button onclick="window.print()" class="no-print-btn">🖨️ طباعة الفاتورة أو حفظها كـ PDF</button>
  </div>
</body>
</html>`;
};

export default function Screen5({
  appData,
  categories,
  isTraderVersion,
  onPrev,
  onNavigateToScreen,
  onResetForAnotherTrader,
  onOpenPreview,
  onUpdateMonthForTrader,
}: Screen5Props) {
  const [selectedPeriodOption, setSelectedPeriodOption] = useState<string>('');
  const [targetArchive, setTargetArchive] = useState<ArchiveEntry | null>(null);
  const [isViewingSnapshot, setIsViewingSnapshot] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  // Custom range state variables with defaults as requested in user example (25/6 to 5/7)
  const [fromDay, setFromDay] = useState<string>('25');
  const [fromMonth, setFromMonth] = useState<string>('6');
  const [fromYear, setFromYear] = useState<string>('2026');

  const [toDay, setToDay] = useState<string>('5');
  const [toMonth, setToMonth] = useState<string>('7');
  const [toYear, setToYear] = useState<string>('2026');

  const [isRangeActive, setIsRangeActive] = useState<boolean>(true);

  const [filterYear, setFilterYear] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterTrader, setFilterTrader] = useState<string>('');
  const [queriedArchive, setQueriedArchive] = useState<ArchiveEntry | null>(null);

  // States for row-specific report generation
  const [rowReportRecord, setRowReportRecord] = useState<ArchiveEntry | null>(null);

  // States for Advanced Sorting & Date Range Searching
  const [searchFromDay, setSearchFromDay] = useState<string>('25');
  const [searchFromMonth, setSearchFromMonth] = useState<string>('6');
  const [searchFromYear, setSearchFromYear] = useState<string>('2026');
  const [searchToDay, setSearchToDay] = useState<string>('5');
  const [searchToMonth, setSearchToMonth] = useState<string>('7');
  const [searchToYear, setSearchToYear] = useState<string>('2026');
  const [searchTrader, setSearchTrader] = useState<string>('');
  const [searchResults, setSearchResults] = useState<ArchiveEntry[]>([]);

  // Sync state defaults for advanced filtering
  useEffect(() => {
    setFilterYear(appData.selectedYearNum);
    setFilterMonth(appData.selectedMonthNum);
    if (isTraderVersion) {
      setFilterTrader(appData.traderName);
      setSearchTrader(appData.traderName);
    } else {
      setFilterTrader('');
      setSearchTrader('');
    }
    setQueriedArchive(null);
    setSearchResults([]);
  }, [appData.selectedYearNum, appData.selectedMonthNum, isTraderVersion, appData.traderName]);

  const handleRunAdvancedFilterSearch = () => {
    const targetTrader = isTraderVersion ? appData.traderName : filterTrader;

    if (!filterYear || !filterMonth || !targetTrader) {
      alert('الرجاء تعبئة وتحديد المعايير المتبقية (السنة والحساب والشهر) لتشغيل البحث بشكل صحيح.');
      return;
    }

    const searchPeriodStr = `شهر ${filterMonth} - ${filterYear}`;
    const targetKey = `${targetTrader}_${searchPeriodStr}`;
    const record = appData.traderArchive[targetKey];

    if (!record) {
      alert(`عذراً، لم تتوفر أي سجلات حساب أو أرصدة مؤرشفة للعميل (${targetTrader}) عن فترة (${searchPeriodStr}) في الحافظة.`);
      setQueriedArchive(null);
      return;
    }

    setQueriedArchive(record);
  };

  const handleExecuteAdvancedRangeSearch = () => {
    const targetTrader = isTraderVersion ? appData.traderName : searchTrader;
    if (!targetTrader) {
      alert('الرجاء اختيار التاجر المراد فرز حسابه أولاً.');
      return;
    }

    const start = new Date(parseInt(searchFromYear, 10), parseInt(searchFromMonth, 10) - 1, parseInt(searchFromDay, 10));
    const end = new Date(parseInt(searchToYear, 10), parseInt(searchToMonth, 10) - 1, parseInt(searchToDay, 10), 23, 59, 59);

    if (start > end) {
      alert('تنبيه: تاريخ البدء لا يمكن أن يكون بعد تاريخ الانتهاء.');
      return;
    }

    const results: ArchiveEntry[] = [];
    for (const key in appData.traderArchive) {
      const item = appData.traderArchive[key];
      if (item && item.traderName === targetTrader) {
        const itemDate = parseDateString(item.period);
        if (itemDate && itemDate >= start && itemDate <= end) {
          results.push(item);
        }
      }
    }

    // Sort results by period date descending for beautiful rendering
    results.sort((a, b) => {
      const dA = parseDateString(a.period) || new Date(0);
      const dB = parseDateString(b.period) || new Date(0);
      return dB.getTime() - dA.getTime();
    });

    setSearchResults(results);
    if (results.length === 0) {
      alert('عذراً، لم يتم العثور على أي كشوفات حساب مؤرشفة لهذا التاجر ضمن نطاق التواريخ المحددة.');
    }
  };

  const handleActionRowReport = (trader: { name: string; period: string }, action: 'download' | 'share') => {
    const archiveKey = `${trader.name}_${trader.period}`;
    const record = appData.traderArchive[archiveKey];
    if (!record) {
      alert('تعذر العثور على السجل التفصيلي لهذا التاجر في الأرشيف.');
      return;
    }
    
    setRowReportRecord(record);
    
    setTimeout(() => {
      const elementId = 'row-report-capture-area';
      const fileName = `كشف_حساب_${record.traderName}_${record.period.replace(/\s+/g, '_')}`;
      onOpenPreview(elementId, 'png', fileName);
    }, 300);
  };

  const handleActionSearchResultReport = (record: ArchiveEntry, action: 'download' | 'share') => {
    setRowReportRecord(record);
    setTimeout(() => {
      const elementId = 'row-report-capture-area';
      const fileName = `كشف_حساب_${record.traderName}_${record.period.replace(/\s+/g, '_')}`;
      onOpenPreview(elementId, 'png', fileName);
    }, 300);
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 10 }, (_, i) => 2026 + i);

  // Extract periods from archived data
  const availablePeriods: string[] = [];
  if (isTraderVersion) {
    for (const key in appData.traderArchive) {
      if (key.startsWith(appData.traderName + "_")) {
        const periodStr = key.replace(appData.traderName + "_", "");
        availablePeriods.push(periodStr);
      }
    }
  } else {
    const periodsSet = new Set<string>();
    for (const key in appData.traderArchive) {
      const item = appData.traderArchive[key];
      if (item && item.period) {
        periodsSet.add(item.period);
      }
    }
    availablePeriods.push(...Array.from(periodsSet));
  }

  // Pre-select first option on load
  useEffect(() => {
    if (availablePeriods.length > 0) {
      setSelectedPeriodOption(availablePeriods[0]);
    } else {
      setSelectedPeriodOption('');
      setTargetArchive(null);
      setIsViewingSnapshot(false);
    }
  }, [appData.traderArchive, isTraderVersion, appData.traderName]);

  const handleQueryArchivedPeriod = () => {
    if (!selectedPeriodOption) {
      alert('الرجاء اختيار الفصيلة أو الدورة الزمنية المراد استبيانها.');
      return;
    }

    if (isTraderVersion) {
      const archiveKey = `${appData.traderName}_${selectedPeriodOption}`;
      const data = appData.traderArchive[archiveKey];
      if (data) {
        setTargetArchive(data);
        setIsViewingSnapshot(true);
      } else {
        alert('تعذر استرداد بيانات الفترة الحسابية من الأرشيف.');
      }
    } else {
      // General ledger state, don't focus single record snapshot but display compiled merchants totals
      setIsViewingSnapshot(true);
      setTargetArchive(null);
    }
  };

  const handleResetToCurrentCycle = () => {
    setIsViewingSnapshot(false);
    setTargetArchive(null);
  };

  const handleDownloadPNG = async () => {
    const element = document.getElementById('grand-capture-area');
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب الجزء الخاص بالتقرير للتصدير.');
      return;
    }

    setIsProcessing(true);
    try {
      let dataUrl = '';
      try {
        dataUrl = await toPng(element, {
          pixelRatio: 2.2,
          backgroundColor: '#ffffff',
          cacheBust: true,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
          }
        });
      } catch (toPngErr) {
        console.warn('toPng failed inside Screen5, falling back to html2canvas:', toPngErr);
        const canvas = await html2canvas(element, {
          scale: 2.2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        dataUrl = canvas.toDataURL('image/png');
      }
      
      const fileName = `كشف_الأرشيف_${isTraderVersion ? appData.traderName : 'التجار'}_${isViewingSnapshot ? selectedPeriodOption : appData.currentMonth}`;

      // Submit server download form to bypass sandbox restrictions
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
      input2.value = `${fileName}.png`;
      form.appendChild(input2);

      const input3 = document.createElement('input');
      input3.type = 'hidden';
      input3.name = 'mimeType';
      input3.value = 'image/png';
      form.appendChild(input3);

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch (e: any) {
      console.error('Export PNG failure:', e);
      alert('تعذر تحميل الصورة لسبب متعلق بمتصفحك: ' + (e?.message || String(e)));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDirectShare = async () => {
    const element = document.getElementById('grand-capture-area');
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب الجزء الخاص بالتقرير للمشاركة.');
      return;
    }

    setIsSharing(true);
    try {
      let dataUrl = '';
      try {
        dataUrl = await toPng(element, {
          pixelRatio: 2.2,
          backgroundColor: '#ffffff',
          cacheBust: true,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
          }
        });
      } catch (toPngErr) {
        console.warn('toPng failed inside Screen5 share, falling back to html2canvas:', toPngErr);
        const canvas = await html2canvas(element, {
          scale: 2.2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        dataUrl = canvas.toDataURL('image/png');
      }

      const periodName = isViewingSnapshot ? selectedPeriodOption : appData.currentMonth;
      const traderDisplayName = isTraderVersion ? appData.traderName : 'كافة التجار';

      let shareUrl = '';
      try {
        const response = await fetch('/api/save-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: dataUrl,
            title: traderDisplayName,
            date: periodName,
            mime: 'image/png'
          })
        });

        const resData = await response.json();
        if (resData && resData.success) {
          shareUrl = resData.url;
        }
      } catch (saveErr) {
        console.warn('Could not save report to server:', saveErr);
      }

      let file: File | null = null;
      let imgBlob: Blob | null = null;
      try {
        const blobRes = await fetch(dataUrl);
        imgBlob = await blobRes.blob();
        file = new File([imgBlob], `كشف_${traderDisplayName}_${periodName}.png`, { type: 'image/png' });
      } catch (fileErr) {
        console.warn('Could not create sharing File object:', fileErr);
      }

      const textMessage = `🧾 كشف حساب ${traderDisplayName} لشهر (${periodName}) \n🔗 رابط المعاينة والتحميل: ${shareUrl || window.location.href}`;

      if (navigator.share) {
        try {
          if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              text: textMessage
            });
            return;
          } else {
            await navigator.share({
              text: textMessage,
              url: shareUrl || window.location.href
            });
            return;
          }
        } catch (shareErr) {
          console.warn('Native share failed, following fallback...', shareErr);
        }
      }

      let clipboardSuccessful = false;
      if (imgBlob && navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': imgBlob
            })
          ]);
          clipboardSuccessful = true;
        } catch (clipImgErr) {
          console.warn('Clipboard image write failed:', clipImgErr);
        }
      }

      if (shareUrl) {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(textMessage);
          }
        } catch (clipTextErr) {
          console.warn('Clipboard text write failed:', clipTextErr);
        }
      }

      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMessage)}`;
      window.open(whatsappUrl, '_top') || (window.location.href = whatsappUrl);

      if (clipboardSuccessful) {
        alert("📋 تم نسخ صورة كشف الحساب ورابط المعاينة إلى حافظة جهازك بنجاح! \n\n💡 تم توجيهك إلى واتساب. يمكنك تقديم طلب لصق (Paste) لتظهر الفاتورة فوراً كصورة حقيقية ونظيفة!");
      } else {
        alert("🔗 تم توليد رابط كشف الحساب وتوجيهك لواتساب! يمكنك مشاركة هذا الرابط مع العميل لمشاهدة الفاتورة فوراً.");
      }
    } catch (e: any) {
      console.warn('Failed sharing flow:', e);
      alert('حدث خطأ أثناء محاولة المشاركة: ' + (e?.message || String(e)));
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadAllApps = () => {
    if (tradersBalancesList.length === 0) {
      alert('لا يوجد أي تجار في الدورة الحالية للتحميل.');
      return;
    }
    
    tradersBalancesList.forEach((trader, index) => {
      setTimeout(() => {
        const periodStr = trader.period;
        const match = periodStr.match(/شهر\s*(\d+)\s*-\s*(\d+)/);
        const monthNum = match ? match[1] : appData.selectedMonthNum;
        const yearNum = match ? match[2] : appData.selectedYearNum;
        
        try {
          const generatedHtml = generateIndependentTraderHTML(
            trader.name,
            trader.period,
            monthNum,
            yearNum,
            appData
          );
          
          const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
          const link = document.createElement('a');
          const cleanName = trader.name.replace(/\s+/g, '_');
          const cleanPeriod = trader.period.replace(/\s+/g, '_');
          link.download = `تطبيق_موزع_${cleanName}_${cleanPeriod}.html`;
          link.href = URL.createObjectURL(blob);
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        } catch (err) {
          console.error('Failed to generate trader HTML', err);
        }
      }, index * 250);
    });
  };

  const handleDownloadAllPrintingInvoices = () => {
    if (tradersBalancesList.length === 0) {
      alert('لا يوجد أي تجار في الدورة الحالية للتحميل.');
      return;
    }

    tradersBalancesList.forEach((trader, index) => {
      setTimeout(() => {
        try {
          const entry = getOrCreateArchiveEntry(trader.name, trader.period, appData, categories);
          if (!entry) return;
          
          const generatedHtml = generateStaticInvoiceHTML(entry);
          
          const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
          const link = document.createElement('a');
          const cleanName = trader.name.replace(/\s+/g, '_');
          const cleanPeriod = trader.period.replace(/\s+/g, '_');
          link.download = `فاتورة_${cleanName}_${cleanPeriod}.html`;
          link.href = URL.createObjectURL(blob);
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        } catch (err) {
          console.error('Failed to generate print invoice', err);
        }
      }, index * 250);
    });
  };

  // Helper variables for computations
  let computedGrandSumVal = 0;
  const tradersBalancesList: Array<{ name: string; amount: number; period: string }> = [];

  const parseDateString = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0].trim(), 10);
      const m = parseInt(parts[1].trim(), 10);
      const y = parseInt(parts[2].trim(), 10);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        return new Date(y, m - 1, d);
      }
    }
    const legacy = dateStr.match(/(\d+)\s*-\s*(\d+)/);
    if (legacy) {
      const m = parseInt(legacy[1], 10);
      const y = parseInt(legacy[2], 10);
      return new Date(y, m - 1, 1);
    }
    return null;
  };

  if (isRangeActive) {
    const startRangeDate = new Date(parseInt(fromYear, 10), parseInt(fromMonth, 10) - 1, parseInt(fromDay, 10));
    const endRangeDate = new Date(parseInt(toYear, 10), parseInt(toMonth, 10) - 1, parseInt(toDay, 10), 23, 59, 59);

    if (!isTraderVersion) {
      // Admin: Gather all archived transactions of all traders within range
      const uniqueKeys = new Set<string>();
      for (const key in appData.traderArchive) {
        const item = appData.traderArchive[key];
        if (item) {
          const itemDate = parseDateString(item.period);
          if (itemDate && itemDate >= startRangeDate && itemDate <= endRangeDate) {
            const rowKey = `${item.traderName}_${item.period}`;
            if (!uniqueKeys.has(rowKey)) {
              uniqueKeys.add(rowKey);
              tradersBalancesList.push({
                name: item.traderName,
                amount: item.netAmount,
                period: item.period,
              });
              computedGrandSumVal += item.netAmount;
            }
          }
        }
      }
    } else {
      // Trader: Gather all their own archived transactions within range
      for (const key in appData.traderArchive) {
        const item = appData.traderArchive[key];
        if (item && item.traderName === appData.traderName) {
          const itemDate = parseDateString(item.period);
          if (itemDate && itemDate >= startRangeDate && itemDate <= endRangeDate) {
            tradersBalancesList.push({
              name: item.traderName,
              amount: item.netAmount,
              period: item.period,
            });
            computedGrandSumVal += item.netAmount;
          }
        }
      }
      // If nothing saved yet under archives in range, fallback to current active calculations
      if (tradersBalancesList.length === 0) {
        let totalSales = 0;
        categories.forEach((cat) => {
          const invCount = (appData.inventory[cat.label] || 0) + (appData.midMonth?.[cat.label] || 0);
          const remCount = appData.remaining[cat.label] || 0;
          totalSales += Math.max(0, invCount - remCount) * cat.value;
        });
        const discValue = (totalSales * appData.discountPercentage) / 100;
        computedGrandSumVal = totalSales - discValue;
      }
    }
  } else if (isViewingSnapshot && !isTraderVersion) {
    // Admin queried specific period snapshot -> aggregate merchants totals of that period
    for (const key in appData.traderArchive) {
      const item = appData.traderArchive[key];
      if (item && item.period === selectedPeriodOption) {
        computedGrandSumVal += item.netAmount;
        tradersBalancesList.push({
          name: item.traderName,
          amount: item.netAmount,
          period: item.period,
        });
      }
    }
  } else if (!isViewingSnapshot && !isTraderVersion) {
    // Admin viewing general aggregate snapshot of current session's traders log
    appData.savedTradersLog.forEach((item) => {
      computedGrandSumVal += item.finalAmount;
      tradersBalancesList.push({
        name: item.name,
        amount: item.finalAmount,
        period: item.period,
      });
    });
  } else if (isViewingSnapshot && isTraderVersion && targetArchive) {
    // Trader viewing old snapshot
    computedGrandSumVal = targetArchive.netAmount;
  } else {
    // Trader viewing their active current workspace
    let totalSales = 0;
    categories.forEach((cat) => {
      const invCount = (appData.inventory[cat.label] || 0) + (appData.midMonth?.[cat.label] || 0);
      const remCount = appData.remaining[cat.label] || 0;
      totalSales += Math.max(0, invCount - remCount) * cat.value;
    });
    const discValue = (totalSales * appData.discountPercentage) / 100;
    computedGrandSumVal = totalSales - discValue;
  }

  return (
    <div className="space-y-5 animate-fade-in text-right">
      {/* Custom Inventory Range Selection Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-205 shadow-xs space-y-3.5">
        <div className="text-right border-b border-dashed border-slate-200 pb-2">
          <label className="block font-black text-slate-800 text-xs">
            📅 استدعاء وتصفية البيانات بنطاق جرد مخصص (أشخاص وفترات):
          </label>
          <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
            حدد تاريخ بداية جرد الدورة وتاريخ نهايتها لعرض كافة السجلات بدقة.
          </span>
        </div>

        {/* Start Date & End Date Form Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs leading-none">
          {/* Start Date Segment */}
          <div className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="block font-black text-slate-755 text-right text-[11px] mb-1">من يوم كذا:</span>
            <div className="flex gap-1">
              {/* Day selection */}
              <select
                value={fromDay}
                onChange={(e) => {
                  setFromDay(e.target.value);
                  setIsRangeActive(true);
                  setIsViewingSnapshot(false);
                }}
                className="w-1/3 bg-white border border-slate-300 p-1.5 text-center font-bold text-[11px] rounded-lg focus:outline-none"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {/* Month selection */}
              <select
                value={fromMonth}
                onChange={(e) => {
                  setFromMonth(e.target.value);
                  setIsRangeActive(true);
                  setIsViewingSnapshot(false);
                }}
                className="w-1/3 bg-white border border-slate-300 p-1.5 text-center font-bold text-[11px] rounded-lg focus:outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {/* Year selection */}
              <select
                value={fromYear}
                onChange={(e) => {
                  setFromYear(e.target.value);
                  setIsRangeActive(true);
                  setIsViewingSnapshot(false);
                }}
                className="w-1/3 bg-white border border-slate-300 p-1.5 text-center font-bold text-[11px] rounded-lg focus:outline-none"
              >
                {Array.from({ length: 30 }, (_, i) => 2026 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* End Date Segment */}
          <div className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="block font-black text-slate-755 text-right text-[11px] mb-1">إلى يوم كذا:</span>
            <div className="flex gap-1">
              {/* Day selection */}
              <select
                value={toDay}
                onChange={(e) => {
                  setToDay(e.target.value);
                  setIsRangeActive(true);
                  setIsViewingSnapshot(false);
                }}
                className="w-1/3 bg-white border border-slate-300 p-1.5 text-center font-bold text-[11px] rounded-lg focus:outline-none"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {/* Month selection */}
              <select
                value={toMonth}
                onChange={(e) => {
                  setToMonth(e.target.value);
                  setIsRangeActive(true);
                  setIsViewingSnapshot(false);
                }}
                className="w-1/3 bg-white border border-slate-300 p-1.5 text-center font-bold text-[11px] rounded-lg focus:outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {/* Year selection */}
              <select
                value={toYear}
                onChange={(e) => {
                  setToYear(e.target.value);
                  setIsRangeActive(true);
                  setIsViewingSnapshot(false);
                }}
                className="w-1/3 bg-white border border-slate-300 p-1.5 text-center font-bold text-[11px] rounded-lg focus:outline-none"
              >
                {Array.from({ length: 30 }, (_, i) => 2026 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action button row */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setIsRangeActive(true);
              setIsViewingSnapshot(false);
            }}
            className="w-2/3 bg-slate-900 text-amber-300 font-extrabold rounded-xl text-xs hover:bg-slate-800 transition py-2.5 px-3 text-center cursor-pointer shadow-3xs"
          >
            تصفية واستدعاء البيانات للفترة 🔍
          </button>
          <button
            onClick={() => {
              setIsRangeActive(false);
            }}
            className="w-1/3 bg-slate-100 text-slate-700 font-bold rounded-xl text-[11px] hover:bg-slate-200 transition py-2.5 px-2 text-center cursor-pointer"
          >
            إلغاء التصفية 🔄
          </button>
        </div>
      </div>

      {/* Capture wrapper area card */}
      <div 
        id="grand-capture-area" 
        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative"
      >
        <div className="flex justify-between items-center pb-2.5 border-b-2 border-indigo-950 mb-3.5">
          <h2 className="text-sm font-black text-slate-900">
            {isTraderVersion 
              ? 'أرشيف كشوف حساباتي الشهرية' 
              : isViewingSnapshot 
                ? `حصيلة جرد فترة: ${selectedPeriodOption}` 
                : 'الإحصائيات والإجمالي العام للتجار'
            }
          </h2>
          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            حساب كروت الواي فاي
          </span>
        </div>

        <div className="text-center mb-3">
          <p className="text-sm md:text-base text-slate-900 font-black block mb-1.5">
            {isTraderVersion ? (
              <>
                <span>العميل: {appData.traderName}</span>
                {(() => {
                  const phone = localStorage.getItem(`phone_${appData.traderName}`);
                  return phone ? <span className="block mt-0.5 font-mono text-[9px] text-slate-500">📞 هاتف: {phone}</span> : null;
                })()}
              </>
            ) : (isRangeActive ? 'الاحصائيات المجمعة 📊' : 'بيانات الفواتير')}
          </p>
          {isRangeActive ? (
            <div className="text-[10px] sm:text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 py-2 px-4 rounded-xl inline-block leading-normal" dir="rtl">
              <div className="font-black text-slate-800 text-[11px] sm:text-xs mb-1">📅 نطاق الجرد المستدعى</div>
              <div className="text-[10px] sm:text-[11px] text-slate-600 flex flex-wrap items-center justify-center gap-1 mt-0.5" dir="rtl">
                <span>من</span>
                {renderSimpleDate(fromDay, fromMonth, fromYear)}
                <span>إلى</span>
                {renderSimpleDate(toDay, toMonth, toYear)}
              </div>
            </div>
          ) : (
            <h3 className="text-xs font-black text-slate-700 bg-slate-50 border p-1 px-3 rounded-full inline-block leading-none">
              {isViewingSnapshot 
                ? `الملف المستدعى: ${selectedPeriodOption}` 
                : `حساب : ${appData.currentMonth}`
              }
            </h3>
          )}
        </div>

        {/* Categories Snapshots table: Shown ALWAYS for Trader version, and conditionally for Admin queried data */}
        {(isTraderVersion || (isViewingSnapshot && targetArchive)) && (
          <div className="border-t border-dashed border-slate-200 pt-3.5 mb-3">
            <p className="text-[10px] text-slate-500 font-black mb-1.5 text-right">المبيعات المفصلة بالكروت الفردية:</p>
            <table className="w-full text-center text-[10px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-black">
                  <th className="p-1.5 border border-slate-200">
                    <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9px] min-[360px]:text-[10px] sm:text-[11px] tracking-tight">فئة الكارت</span>
                  </th>
                  <th className="p-1.5 border border-slate-200">
                    <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9px] min-[360px]:text-[10px] sm:text-[11px] tracking-tight">المرسل</span>
                  </th>
                  <th className="p-1.5 border border-slate-200">
                    <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9px] min-[360px]:text-[10px] sm:text-[11px] tracking-tight">المتبقي</span>
                  </th>
                  <th className="p-1.5 border border-slate-200 text-indigo-800 font-black">
                    <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9px] min-[360px]:text-[10px] sm:text-[11px] tracking-tight font-black">المباع</span>
                  </th>
                  <th className="p-1.5 border border-slate-200 text-left">
                    <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9px] min-[360px]:text-[10px] sm:text-[11px] tracking-tight">الصافي المادي</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(isViewingSnapshot && targetArchive ? targetArchive.categoriesSnapshot : categories).map((cat) => {
                  const invVal = isViewingSnapshot && targetArchive 
                    ? (targetArchive.inventorySnapshot[cat.label] || 0)
                    : (appData.inventory[cat.label] || 0);
                  const remVal = isViewingSnapshot && targetArchive
                    ? (targetArchive.remainingSnapshot[cat.label] || 0)
                    : (appData.remaining[cat.label] || 0);
                  const soldVal = invVal - remVal;
                  const rowFin = soldVal * cat.value;

                  return (
                    <tr key={cat.label} className="font-bold text-slate-700">
                      <td className="p-1 border border-slate-200 text-right font-black text-slate-900 truncate max-w-[80px]">{cat.label}</td>
                      <td className="p-1 border border-slate-200">{invVal}</td>
                      <td className="p-1 border border-slate-200">{remVal}</td>
                      <td className="p-1 border border-slate-200 text-indigo-700">{soldVal}</td>
                      <td className="p-1 border border-slate-200 text-left">{rowFin.toFixed(2)} جم</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Ledger accounting listings */}
        <div className="overflow-hidden mt-2 w-full">
          <table className="w-full text-right text-xs border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-800 text-white font-bold">
                <th className={`p-2 border text-right rounded-r-lg ${isTraderVersion ? 'w-[60%]' : 'w-[45%]'}`}>
                  <span className="whitespace-nowrap truncate block max-w-full text-[9px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12.5px] tracking-tight text-right">قائمة التجار / كشوف الحساب</span>
                </th>
                <th className={`p-2 border text-left ${isTraderVersion ? 'rounded-l-lg w-[40%]' : 'w-[30%]'}`}>
                  <span className="whitespace-nowrap truncate block max-w-full text-[9px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12.5px] tracking-tight text-left">الصافي (جم)</span>
                </th>
                {!isTraderVersion && (
                  <th className="p-2 border text-center rounded-l-lg w-[25%]">
                    <span className="whitespace-nowrap truncate block max-w-full text-[9px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12.5px] tracking-tight text-center">إجراء</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {isTraderVersion ? (
                // Single vendor billing items
                <>
                  <tr className="hover:bg-slate-50 font-bold text-slate-800">
                    <td className="p-2 border text-right font-black text-slate-900">
                      <span>إجمالي المبيعات قبل الخصم</span>
                    </td>
                    <td className="p-2 border text-left text-teal-800 font-black">
                      {(isViewingSnapshot && targetArchive
                        ? targetArchive.totalSales
                        : categories.reduce((acc, cat) => acc + ((appData.inventory[cat.label] || 0) + (appData.midMonth?.[cat.label] || 0) - (appData.remaining[cat.label] || 0)) * cat.value, 0)
                      ).toFixed(2)} جم
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50 font-bold text-xs text-rose-600">
                    <td className="p-2 border text-right">
                      <span>الخصم المسموح للتاجر ({isViewingSnapshot && targetArchive ? targetArchive.discountRate : appData.discountPercentage}%)</span>
                    </td>
                    <td className="p-2 border text-left">
                      -{(isViewingSnapshot && targetArchive
                        ? targetArchive.discountVal
                        : (categories.reduce((acc, cat) => acc + ((appData.inventory[cat.label] || 0) + (appData.midMonth?.[cat.label] || 0) - (appData.remaining[cat.label] || 0)) * cat.value, 0) * appData.discountPercentage) / 100
                      ).toFixed(2)} جم
                    </td>
                  </tr>
                </>
              ) : (
                // Administrator compiling group balances
                <>
                  {tradersBalancesList.map((trader) => (
                    <tr key={`${trader.name}_${trader.period}`} className="hover:bg-slate-50 font-bold text-slate-800 transition">
                      <td className="p-2 border text-right font-black text-slate-900">
                        <span>{trader.name}</span>
                        <span className="block text-[8.5px] font-bold text-slate-400 mt-0.5">الدورة: {trader.period}</span>
                      </td>
                      <td className="p-2 border text-left text-indigo-700 font-extrabold">{trader.amount.toFixed(2)} جم</td>
                      <td className="p-2 border text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 no-print">
                          <button
                            onClick={() => handleActionRowReport(trader, 'download')}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 font-bold rounded-lg border border-indigo-200 transition text-[10px] sm:text-xs flex items-center justify-center cursor-pointer"
                            title="تحميل كارت كشف الحساب وعمليات البيع كصورة"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          </button>
                          <button
                            onClick={() => handleActionRowReport(trader, 'share')}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold rounded-lg border border-emerald-200 transition text-[10px] sm:text-xs flex items-center justify-center cursor-pointer"
                            title="مشاركة كارت التقرير عبر الواتساب"
                          >
                            <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tradersBalancesList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-400">
                        لم يتم جرد أو كسر حساب أي تصفية حتى الآن.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Global cumulative tally display summary */}
        <div className="bg-slate-950 text-amber-400 p-3.5 rounded-2xl flex flex-col font-black text-sm mt-3.5 gap-2 shadow-sm text-right">
          <div className="flex justify-between items-center w-full">
            <span className="text-xs">
              {isTraderVersion ? 'إجمالي الصافي للمستحق:' : 'إجمالي الحساب المجمع:'}
            </span>
            <span className="font-mono text-sm tracking-wide">
              {computedGrandSumVal.toFixed(2)} <span className="text-white font-sans text-xs font-normal mr-1">جنيه</span>
            </span>
          </div>
        </div>
      </div>

      {/* Capture trigger buttons */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <button
          onClick={handleDownloadPNG}
          disabled={isProcessing}
          className="w-full text-xs font-black py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <Download className="w-4 h-4 text-emerald-600" />
          )}
          <span>{isProcessing ? 'جاري التحضير...' : 'تحميل كصورة'}</span>
        </button>

        <button
          onClick={handleDirectShare}
          disabled={isSharing}
          className="w-full text-xs font-black py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSharing ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <Share2 className="w-4 h-4 text-white" />
          )}
          <span>{isSharing ? 'جاري المشاركة...' : 'مشاركة واتساب 📲'}</span>
        </button>
      </div>

      {/* Individual Trader Invoices Download Card (contextual for Admin) */}
      {!isTraderVersion && tradersBalancesList.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-3xs space-y-3 mt-1.5 text-right">
          <div className="border-b border-dashed border-slate-200 pb-2.5 text-right">
            <h3 className="font-black text-slate-800 text-xs flex items-center gap-1.5 justify-end flex-row-reverse">
              <span>تحميل فواتير وتقارير تجار الفترة الفرادي</span>
              <FileText className="w-4 h-4 text-emerald-600" />
            </h3>
            <span className="text-[10px] text-slate-450 mt-1 block leading-normal">
              سيتم توليد وتنزيل تقارير فواتير مستقلة للعدد <strong>({tradersBalancesList.length})</strong> من الموزعين الظاهرين في نطاق الجرد الحالي والمجمع أعلاه.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={handleDownloadAllPrintingInvoices}
              className="w-full text-[10px] sm:text-xs font-black py-2.5 px-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 transition shadow-2xs flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer"
              title="تنزيل فواتير طباعة مستقلة لكل تاجر"
            >
              <Printer className="w-4.5 h-4.5 text-emerald-600" />
              <span>تنزيل الفواتير الفردية (.html)</span>
            </button>

            <button
              onClick={handleDownloadAllApps}
              className="w-full text-[10px] sm:text-xs font-black py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer"
              title="تنزيل برنامج محاسبة مستقل خاص بكل موزع"
            >
              <Smartphone className="w-4.5 h-4.5 text-indigo-400" />
              <span>تطبيقات الموزعين (.html)</span>
            </button>
          </div>
        </div>
      )}

      {/* Advanced sorting section (moved from Screen 6) */}
      <div className="border-t border-slate-200 pt-5 space-y-4">
        <div>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5 justify-end flex-row-reverse">
            <span>قسم الفرز والبحث المتقدم للكل</span>
            <CalendarRange className="w-4 h-4 text-indigo-600" />
          </h2>
          <p className="text-[10px] text-slate-450 mt-1">
            {isTraderVersion 
              ? 'استرجع تفاصيل وبيانات كرت أي كشف حساب شهري سابق لك بشكل مبيّن مفصل' 
              : 'قم بفرز وبحث وسحب أي جرد مالي تاريخي لأي تاجر وفترته بدقة متكاملة'
            }
          </p>
        </div>

        {/* Inputs Form card */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-4 text-xs">
          {/* Start Date & End Date Form Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs leading-none">
            {/* Start Date Segment */}
            <div className="space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="block font-black text-slate-755 text-right text-[11px] mb-1">من يوم كذا:</span>
              <div className="flex gap-1">
                {/* Day selection */}
                <select
                  value={searchFromDay}
                  onChange={(e) => setSearchFromDay(e.target.value)}
                  className="w-1/3 bg-white border border-slate-300 p-1.5 text-center font-bold text-[11px] rounded-lg focus:outline-none"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {/* Month selection */}
                <select
                  value={searchFromMonth}
                  onChange={(e) => setSearchFromMonth(e.target.value)}
                  className="w-1/3 bg-white border border-slate-300 p-1.5 text-center font-bold text-[11px] rounded-lg focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {/* Year selection */}
                <select
                  value={searchFromYear}
                  onChange={(e) => setSearchFromYear(e.target.value)}
                  className="w-1/3 bg-white border border-slate-300 p-1.5 text-center font-bold text-[11px] rounded-lg focus:outline-none"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* End Date Segment */}
            <div className="space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="block font-black text-slate-755 text-right text-[11px] mb-1">إلى يوم كذا:</span>
              <div className="flex gap-1">
                {/* Day selection */}
                <select
                  value={searchToDay}
                  onChange={(e) => setSearchToDay(e.target.value)}
                  className="w-1/3 bg-white border border-slate-300 p-1.5 text-center font-bold text-[11px] rounded-lg focus:outline-none"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {/* Month selection */}
                <select
                  value={searchToMonth}
                  onChange={(e) => setSearchToMonth(e.target.value)}
                  className="w-1/3 bg-white border border-slate-300 p-1.5 text-center font-bold text-[11px] rounded-lg focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {/* Year selection */}
                <select
                  value={searchToYear}
                  onChange={(e) => setSearchToYear(e.target.value)}
                  className="w-1/3 bg-white border border-slate-300 p-1.5 text-center font-bold text-[11px] rounded-lg focus:outline-none"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1">
            {/* Trader Selector */}
            {!isTraderVersion ? (
              <div>
                <label className="block font-black text-slate-650 mb-1 text-right">اختر التاجر لتصفية المدة المحددة:</label>
                <select
                  value={searchTrader}
                  onChange={(e) => setSearchTrader(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 text-xs text-right"
                >
                  <option value="">-- اضغط لاختيار اسم التاجر --</option>
                  {appData.savedTradersList.map((t) => {
                    if (t === 'اختر تاجر من القائمة') return null;
                    return (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <div>
                <label className="block font-black text-slate-400 mb-1 text-right">التاجر المحدد:</label>
                <div className="p-2.5 border border-slate-200 bg-slate-50 text-slate-700 font-extrabold rounded-xl text-center">
                  {appData.traderName}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleExecuteAdvancedRangeSearch}
            className="w-full bg-slate-900 text-white font-black p-3 rounded-xl shadow-md text-xs hover:bg-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer leading-none"
          >
            <Search className="w-4 h-4 text-emerald-400" />
            <span>عرض نتائج الفرز كشف الحساب المتكامل</span>
          </button>
        </div>

        {/* New 3-Column search results table */}
        {searchResults.length > 0 && (
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-right">
            <h3 className="font-black text-slate-800 text-xs mb-1">نتائج الفرز كشوف الحساب ضمن المدة المحددة:</h3>
            <div className="overflow-hidden w-full">
              <table className="w-full text-right text-xs border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-700 text-white font-bold text-[11px]">
                    <th className="p-2 border text-right rounded-r-lg w-[45%]">
                      <span className="whitespace-nowrap truncate block max-w-full text-[9px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight text-right">اسم الموزع والتاريخ</span>
                    </th>
                    <th className="p-2 border text-left w-[30%]">
                      <span className="whitespace-nowrap truncate block max-w-full text-[9px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight text-left">الصافي (جم)</span>
                    </th>
                    <th className="p-2 border text-center rounded-l-lg w-[25%]">
                      <span className="whitespace-nowrap truncate block max-w-full text-[9px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight text-center">إجراء</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((record) => (
                    <tr key={`${record.traderName}_${record.period}`} className="hover:bg-slate-50 font-bold text-slate-800 transition text-[11px]">
                      <td className="p-2 border text-right">
                        <span className="font-black text-slate-950 block">{record.traderName}</span>
                        <span className="block text-[9px] text-slate-400 mt-0.5" dir="rtl">تاريخ الكشف: {record.period}</span>
                      </td>
                      <td className="p-2 border text-left text-indigo-700 font-black">{(record.netAmount || 0).toFixed(2)} جم</td>
                      <td className="p-2 border text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleActionSearchResultReport(record, 'download')}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 font-bold rounded-lg border border-indigo-200 transition text-[10px] sm:text-xs flex items-center justify-center cursor-pointer"
                            title="تحميل كارت الحساب كصورة كشف"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          </button>
                          <button
                            onClick={() => handleActionSearchResultReport(record, 'share')}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-955 font-bold rounded-lg border border-emerald-250 transition text-[10px] sm:text-xs flex items-center justify-center cursor-pointer"
                            title="مشاركة الكارت عبر الواتساب"
                          >
                            <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Off-screen Capture Area for individual trader row account statement (Screen 4 style) */}
      {rowReportRecord && (
        <div 
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative text-right"
          id="row-report-capture-area"
          style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '380px' }}
        >
          <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-300">
            <h2 className="text-xs font-black text-slate-900">برنامج حسابات كروت الشبكة</h2>
            <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/40">
              حساب كروت الواي فاي
            </span>
          </div>

          <div className="text-center py-3 bg-slate-50/60 rounded-xl my-2 border border-slate-100 px-3">
            <p className="text-xs font-black text-slate-500 mb-1">كشف حساب العميل وعمليات البيع</p>
            <p className="font-extrabold text-indigo-950 text-base leading-normal py-1 px-3 pb-2 border-b border-dashed border-slate-200 inline-block min-w-[125px] max-w-full break-words">
              {rowReportRecord.traderName}
            </p>
            {(() => {
              const phone = localStorage.getItem(`phone_${rowReportRecord.traderName}`);
              return phone ? (
                <p className="text-[11px] font-bold text-slate-500 mt-1 flex items-center justify-center gap-1">
                  <span>📞 هاتف:</span>
                  <span className="font-mono text-indigo-950 text-xs bg-white px-2 py-0.5 rounded border border-slate-200/50">{phone}</span>
                </p>
              ) : null;
            })()}
            <div className="mt-2.5 flex flex-wrap gap-1.5 items-center justify-center">
              <span className="text-[10px] text-indigo-950 font-black bg-indigo-50 px-2.5 py-0.8 rounded-lg border border-indigo-100/50">
                الفترة الحسابية: {rowReportRecord.period}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden w-full">
            <table className="w-full text-center text-xs border-collapse font-sans table-fixed bg-white">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold">
                  <th className="p-2 border border-slate-200 text-right w-[24%]">
                    <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9.5px] min-[360px]:text-[10.5px] sm:text-[12px] tracking-tight">الفئة</span>
                  </th>
                  <th className="p-2 border border-slate-200 w-[18%]">
                    <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9.5px] min-[360px]:text-[10.5px] sm:text-[12px] tracking-tight">المخزون</span>
                  </th>
                  <th className="p-2 border border-slate-200 w-[18%]">
                    <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9.5px] min-[360px]:text-[10.5px] sm:text-[12px] tracking-tight">المتبقي</span>
                  </th>
                  <th className="p-2 border border-slate-200 text-indigo-950 font-black w-[16%]">
                    <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9.5px] min-[360px]:text-[10.5px] sm:text-[12px] tracking-tight font-black">المباع</span>
                  </th>
                  <th className="p-2 border border-slate-200 text-left w-[24%]">
                    <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9.5px] min-[360px]:text-[10.5px] sm:text-[12px] tracking-tight">قيمة مبيعة</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(rowReportRecord.categoriesSnapshot || categories).map((cat: any) => {
                  const inv = (rowReportRecord.inventorySnapshot?.[cat.label] || 0) + (rowReportRecord.midMonthSnapshot?.[cat.label] || 0);
                  const rem = rowReportRecord.remainingSnapshot?.[cat.label] || 0;
                  const sold = Math.max(0, inv - rem);
                  const val = sold * (cat.value || 0);
                  return (
                    <tr key={cat.label} className="font-bold text-slate-700">
                      <td className="p-2 border border-slate-200 text-right font-black text-slate-950 truncate max-w-[85px]">{cat.label}</td>
                      <td className="p-2 border border-slate-200">{inv}</td>
                      <td className="p-2 border border-slate-200">{rem}</td>
                      <td className="p-2 border border-slate-200 text-indigo-700">{sold}</td>
                      <td className="p-2 border border-slate-200 text-left">{val.toFixed(2)} ج.م</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Calculations */}
          <div className="mt-3 space-y-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex justify-between font-bold text-slate-700">
              <span>إجمالي المبيعات قبل الخصم:</span>
              <span className="text-slate-950 font-black">{rowReportRecord.totalSales.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between text-rose-700 font-bold">
              <span>قيمة نسبة الخصم للتاجر ({rowReportRecord.discountRate}%):</span>
              <span className="font-black">-{rowReportRecord.discountVal.toFixed(2)} ج.م</span>
            </div>
            <div className="bg-indigo-950 text-white p-3 rounded-xl flex justify-between font-black text-[12.5px] mt-1 shadow-xs">
              <span>الصافي المستحق من التاجر:</span>
              <span className="text-amber-300 font-black">{(rowReportRecord.netAmount || 0).toFixed(2)} ج.م</span>
            </div>
          </div>
          <p className="text-[8.5px] text-center text-slate-400 mt-2">تاريخ التصدير: {rowReportRecord.timestamp || new Date().toLocaleString('ar-EG')}</p>
        </div>
      )}

      {/* Actions and wipe controllers block */}
      <div className="space-y-3">
        {/* Reset & Continue another round button */}
        <div className="flex gap-3 w-full items-center">
          <button
            onClick={onPrev}
            className="w-[30%] border border-slate-300 bg-white text-slate-700 font-extrabold p-3 rounded-xl text-xs hover:bg-slate-50 transition cursor-pointer"
          >
            السابق
          </button>
          <button
            onClick={isTraderVersion ? onUpdateMonthForTrader : onResetForAnotherTrader}
            className="w-[68%] bg-slate-950 text-white font-black p-3 rounded-xl shadow-md text-xs transition hover:bg-slate-800 flex items-center justify-center gap-1 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-amber-300" />
            <span>
              {isTraderVersion ? '+ جرد دورة شهرية جديدة للفترة' : 'حفظ والانتقال لشاشة التحكم'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
