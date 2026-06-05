import React from 'react';
import { Category } from '../types';
import { BadgeCent, CheckSquare, Image, Percent, ShieldAlert, Share2, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { LocalDB } from '../utils/db';

const localStorage = LocalDB; // Drop-in IndexedDB proxy


interface Screen4Props {
  traderName: string;
  currentMonth: string;
  categories: Category[];
  inventory: Record<string, number>;
  remaining: Record<string, number>;
  discountPercentage: number;
  selectedDayName?: string;
  selectedTimeStr?: string;
  onApplyDiscount: (rate: number) => void;
  onSaveAndFinish: () => void;
  onPrev: () => void;
  isTraderVersion: boolean;
  onOpenPreview: (areaId: string, type: 'png' | 'pdf', fileName: string) => void;
}

export default function Screen4({
  traderName,
  currentMonth,
  categories,
  inventory,
  remaining,
  discountPercentage,
  selectedDayName,
  selectedTimeStr,
  onApplyDiscount,
  onSaveAndFinish,
  onPrev,
  isTraderVersion,
  onOpenPreview,
}: Screen4Props) {
  const [localDiscount, setLocalDiscount] = React.useState<string>(discountPercentage.toString());
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [isProcessingReceipt, setIsProcessingReceipt] = React.useState<boolean>(false);
  const [isSharingAccount, setIsSharingAccount] = React.useState<boolean>(false);
  const [isSharingReceipt, setIsSharingReceipt] = React.useState<boolean>(false);

  const [receivedCards, setReceivedCards] = React.useState<Record<string, number>>(() => {
    try {
      const specificStored = localStorage.getItem(`receipt_${traderName}_${currentMonth}`);
      if (specificStored) {
        return JSON.parse(specificStored);
      }
      const stored = localStorage.getItem(`receipt_${traderName}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  // Synchronize dynamic changes of month or trader
  React.useEffect(() => {
    try {
      const specificStored = localStorage.getItem(`receipt_${traderName}_${currentMonth}`);
      if (specificStored) {
        setReceivedCards(JSON.parse(specificStored));
      } else {
        const stored = localStorage.getItem(`receipt_${traderName}`);
        if (stored) {
          setReceivedCards(JSON.parse(stored));
        } else {
          const fallback: Record<string, number> = {};
          categories.forEach(cat => {
            fallback[cat.label] = inventory[cat.label] || 0;
          });
          setReceivedCards(fallback);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [traderName, currentMonth, inventory, categories]);

  const traderPhone = traderName ? (localStorage.getItem(`phone_${traderName}`) || '') : '';

  const handleSaveReceiptLocally = () => {
    try {
      localStorage.setItem(`receipt_${traderName}_${currentMonth}`, JSON.stringify(receivedCards));
      localStorage.setItem(`receipt_${traderName}`, JSON.stringify(receivedCards));

      // Append date inside saved dates list for this trader
      let savedDates: string[] = [];
      const storedDates = localStorage.getItem(`receipt_dates_${traderName}`);
      if (storedDates) {
        try {
          savedDates = JSON.parse(storedDates);
        } catch (e) {
          console.error(e);
        }
      }
      if (!savedDates.includes(currentMonth)) {
        savedDates.push(currentMonth);
        localStorage.setItem(`receipt_dates_${traderName}`, JSON.stringify(savedDates));
      }

      alert('💾 تم حفظ بيانات كشف استلام الكروت الحالي للتاجر بنجاح لمراجعتها وتصديرها دون التأثير على المخزون الرئيسي!');
    } catch (e) {
      alert('حدث خطأ أثناء الحفظ: ' + String(e));
    }
  };

  // Keep local discount in sync when prop changes
  React.useEffect(() => {
    setLocalDiscount(discountPercentage.toString());
  }, [discountPercentage]);

  const handleApplyDiscount = () => {
    const parsed = parseFloat(localDiscount);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      alert('الرجاء إدخال نسبة خصم صحيحة بين 0 و 100%');
      return;
    }
    onApplyDiscount(parsed);
  };

  const handleDownloadPNGOf = async (captureId: 'invoice-capture-area' | 'receipt-capture-area') => {
    const element = document.getElementById(captureId);
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب الجزء الخاص بالتقرير للتصدير.');
      return;
    }

    if (captureId === 'invoice-capture-area') {
      setIsProcessing(true);
    } else {
      setIsProcessingReceipt(true);
    }

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
        console.warn('toPng failed, falling back to html2canvas:', toPngErr);
        const canvas = await html2canvas(element, {
          scale: 2.2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        dataUrl = canvas.toDataURL('image/png');
      }
      
      const fileName = captureId === 'invoice-capture-area'
        ? `تقرير_حساب_${traderName || 'العميل'}_${currentMonth}`
        : `تقرير_المخزون_الجديد_${traderName || 'العميل'}_${currentMonth}`;

      // Save report image on server first to get an ID for standard GET request. 
      // GET download prevents Android Webview from blocking form-submission POST raw downloads!
      const saveRes = await fetch('/api/save-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: dataUrl,
          title: fileName,
          date: currentMonth,
          mime: 'image/png'
        })
      });

      const resData = await saveRes.json();
      if (resData && resData.success) {
        // Direct browser navigation to GET endpoint triggers the native download manager in all webviews / systems!
        window.location.href = `/api/download-report/${resData.id}`;
      } else {
        // Client-side fallback download
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${fileName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e: any) {
      console.error('Export PNG failure:', e);
      alert('تعذر تحميل الصورة: ' + (e?.message || String(e)));
    } finally {
      if (captureId === 'invoice-capture-area') {
        setIsProcessing(false);
      } else {
        setIsProcessingReceipt(false);
      }
    }
  };

  const handleDirectShareOf = async (captureId: 'invoice-capture-area' | 'receipt-capture-area') => {
    const element = document.getElementById(captureId);
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب الجزء الخاص بالتقرير للمشاركة.');
      return;
    }

    if (captureId === 'invoice-capture-area') {
      setIsSharingAccount(true);
    } else {
      setIsSharingReceipt(true);
    }

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
        console.warn('toPng failed during share, falling back to html2canvas:', toPngErr);
        const canvas = await html2canvas(element, {
          scale: 2.2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        dataUrl = canvas.toDataURL('image/png');
      }

      let shareUrl = '';
      try {
        const response = await fetch('/api/save-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: dataUrl,
            title: traderName || 'العميل',
            date: currentMonth,
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
        file = new File([imgBlob], `تقرير_${traderName || 'العميل'}.png`, { type: 'image/png' });
      } catch (fileErr) {
        console.warn('Could not create sharing File object:', fileErr);
      }

      const textMessage = captureId === 'invoice-capture-area'
        ? `🧾 كشف حساب الفاتورة لـ ${traderName || 'العميل'} (${currentMonth}) \n🔗 الرابط المباشر للمعاينة والتحميل: ${shareUrl || window.location.href}`
        : `📦 تقرير المخزون الجديد لـ ${traderName || 'العميل'} (${currentMonth}) \n🔗 الرابط المباشر للمعاينة والتحميل: ${shareUrl || window.location.href}`;

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

      const cleanPhoneForWhatsapp = (phoneStr: string): string => {
        if (!phoneStr) return '';
        let cleaned = phoneStr.replace(/\D/g, '');
        if (cleaned.startsWith('01') && cleaned.length === 11) {
          cleaned = '2' + cleaned;
        } else if (cleaned.startsWith('1') && cleaned.length === 10) {
          cleaned = '20' + cleaned;
        }
        return cleaned;
      };

      const traderPhone = traderName ? (localStorage.getItem(`phone_${traderName}`) || '') : '';
      const cleanedPhone = cleanPhoneForWhatsapp(traderPhone);
      const whatsappUrl = cleanedPhone 
        ? `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(textMessage)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(textMessage)}`;
      window.open(whatsappUrl, '_top') || (window.location.href = whatsappUrl);

      if (clipboardSuccessful) {
        alert("📋 تم نسخ صورة كارت التقرير ورابط المعاينة إلى حافظة جهازك بنجاح! \n\n💡 تم توجيهك إلى واتساب. يمكنك تقديم طلب لصق (Paste) لتظهر الفاتورة فوراً كصورة حقيقية ونظيفة!");
      } else {
        alert("🔗 تم توليد رابط التقرير وتوجيهك لواتساب! يمكنك مشاركة هذا الرابط مع العميل لمشاهدة التقرير فوراً.");
      }
    } catch (e: any) {
      console.warn('Failed sharing flow:', e);
      alert('حدث خطأ أثناء محاولة المشاركة: ' + (e?.message || String(e)));
    } finally {
      if (captureId === 'invoice-capture-area') {
        setIsSharingAccount(false);
      } else {
        setIsSharingReceipt(false);
      }
    }
  };

  // Calculates financial tally on-the-spot safely
  let totalSales = 0;
  let tableRows: { label: string; inv: number; rem: number; sold: number; value: number }[] = [];
  let discountVal = 0;
  let netAmount = 0;

  try {
    tableRows = categories.map((cat) => {
      const inv = Number(inventory[cat.label]) || 0;
      const rem = Number(remaining[cat.label]) || 0;
      const sold = Math.max(0, inv - rem); // Ensure no negative sales count
      const value = sold * (Number(cat.value) || 0);
      totalSales += value;
      return {
        label: cat.label,
        inv,
        rem,
        sold,
        value,
      };
    });

    discountVal = Math.floor((totalSales * (Number(discountPercentage) || 0)) / 100);
    netAmount = Math.floor(Math.max(0, totalSales - discountVal));
  } catch (err) {
    console.error("VIP_WIFI: Error in financial calculations:", err);
    totalSales = 0;
    discountVal = 0;
    netAmount = 0;
    tableRows = categories.map((cat) => ({
      label: cat.label,
      inv: Number(inventory[cat.label]) || 0,
      rem: Number(remaining[cat.label]) || 0,
      sold: 0,
      value: 0,
    }));
  }

  return (
    <div className="space-y-4 animate-fade-in text-right">
      
      {/* 🧾 SECTION 1 (Formerly 2): REPORT OF CUSTOMER ACCOUNT (كشف حساب العميل) */}
      <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-200 space-y-3">
        <div className="text-xs font-black text-indigo-950 flex items-center gap-1">
          <span>📄 1. كشف حساب العميل وعمليات البيع</span>
        </div>

        <div 
          id="invoice-capture-area" 
          className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-xs relative overflow-hidden text-right"
        >
          {/* Visual corner badge */}
          <div className="absolute top-0 left-0 w-12 h-12 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none" />

          <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200">
            <div>
              <h2 className="text-xs font-black text-slate-900 leading-none">برنامج حسابات الكروت</h2>
              <p className="text-[8px] font-bold text-slate-400 mt-0.5">منظومة المبيعات الدورية</p>
            </div>
            <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/40">
              حساب كروت الواي فاي
            </span>
          </div>

          <div className="text-center py-3 bg-slate-50/60 rounded-xl my-2 border border-slate-100 px-3">
            <p className="text-xs font-black text-slate-500 mb-1">حساب العميل / المحل / التاجر/ الماركت</p>
            <p className="font-extrabold text-indigo-950 text-base leading-normal py-1 px-3 pb-2 border-b border-dashed border-slate-200 inline-block min-w-[120px] max-w-full break-words">{traderName || 'جميع التجار'}</p>
            {traderName && (
              (() => {
                const phone = localStorage.getItem(`phone_${traderName}`);
                if (phone) {
                  return (
                    <p className="text-xs font-bold text-slate-500 mt-1 flex items-center justify-center gap-1">
                      <span>📞 هاتف:</span>
                      <span className="font-mono text-indigo-950 text-xs bg-white/80 px-2 py-0.5 rounded border border-slate-200/50">{phone}</span>
                    </p>
                  );
                }
                return null;
              })()
            )}
            <div className="mt-2.5 flex flex-wrap gap-1.5 items-center justify-center">
              {selectedDayName && (
                <span className="text-[11px] text-indigo-950 font-black bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100/50">
                  اليوم: {selectedDayName}
                </span>
              )}
              <span className="text-[11px] text-indigo-950 font-black bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100/50">
                التاريخ: {currentMonth}
              </span>
              {selectedTimeStr && (
                <span className="text-[11px] text-indigo-950 font-black bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100/50">
                  الساعة: {selectedTimeStr && selectedTimeStr.includes('|') ? selectedTimeStr.split('|')[1].trim() : selectedTimeStr}
                </span>
              )}
            </div>
          </div>

          {/* Invoice Table */}
          <div className="overflow-hidden w-full">
            <table className="w-full text-center text-[11px] sm:text-xs border-collapse table-fixed" dir="rtl">
              <thead>
                <tr className="bg-slate-50 text-slate-705 font-bold">
                  <th className="py-2.5 px-0.5 border border-slate-200 text-center w-[24%]">
                    <span className="block max-w-full text-[8.5px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight">الفئة</span>
                  </th>
                  <th className="py-2.5 px-0.5 border border-slate-200 text-center w-[18%]">
                    <span className="block max-w-full text-[8.5px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight">المخزون</span>
                  </th>
                  <th className="py-2.5 px-0.5 border border-slate-200 text-slate-600 text-center w-[18%]">
                    <span className="block max-w-full text-[8.5px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight">المتبقي</span>
                  </th>
                  <th className="py-2.5 px-0.5 border border-slate-200 text-indigo-950 font-black text-center w-[16%]">
                    <span className="block max-w-full text-[8.5px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight font-black">المباع</span>
                  </th>
                  <th className="py-2.5 px-0.5 border border-slate-200 text-center w-[24%]">
                    <span className="block max-w-full text-[8.5px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight">القيمة</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.label} className="hover:bg-slate-50/50 transition font-bold text-slate-700">
                    <td className="p-2 border border-slate-200 text-right pr-3 font-black text-slate-905 text-[11px] min-[320px]:text-xs">{row.label}</td>
                    <td className="p-2 border border-slate-200 text-slate-700 text-[11px] min-[320px]:text-xs text-center">{row.inv}</td>
                    <td className="p-2 border border-slate-200 text-slate-700 text-[11px] min-[320px]:text-xs text-center">{row.rem}</td>
                    <td className="p-2 border border-slate-200 text-indigo-950 font-black text-[12px] min-[320px]:text-[13px] text-center">{row.sold}</td>
                    <td className="p-2 border border-slate-200 text-center text-slate-950 font-extrabold text-[11px] min-[320px]:text-xs">{Math.floor(row.value)} ج</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Sums details block */}
          <div className="mt-3.5 space-y-2.5 text-[13px] bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            <div className="flex justify-between font-bold text-slate-700">
              <span>إجمالي المبيعات قبل الخصم:</span>
              <span className="text-slate-950 font-black text-[14px]">{Math.floor(totalSales)} ج.م</span>
            </div>
            <div className="flex justify-between text-rose-700 font-bold">
              <span className="flex items-center gap-0.5">
                <span>قيمة نسبة الخصم للتاجر ({discountPercentage}%):</span>
              </span>
              <span className="font-black text-[14px]">-{Math.floor(discountVal)} ج.م</span>
            </div>
            <div className="bg-indigo-950 text-white p-3.5 rounded-xl flex justify-between font-black text-[13.5px] mt-1 shadow-xs">
              <span>الصافي المستحق من التاجر:</span>
              <span className="text-amber-300 font-black text-[16.5px]">{Math.floor(netAmount)} ج.م</span>
            </div>
          </div>
        </div>

        {/* SECTION 1 Action Controls */}
        <div className="space-y-2">
          {/* Admin Discount Percentage Control */}
          {!isTraderVersion && (
            <div id="discount-admin-panel" className="bg-white p-2 rounded-xl border border-slate-200 shadow-3xs">
              <div className="flex items-center justify-between w-full bg-slate-50/60 p-2 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1">
                  <label className="font-bold text-[11px] text-slate-700 whitespace-nowrap ml-1.5">نسبة الخصم للتاجر (%):</label>
                  <input
                    type="number"
                    value={localDiscount}
                    onChange={(e) => setLocalDiscount(e.target.value)}
                    className="w-14 p-1 border border-slate-300 rounded-lg text-center font-black bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 text-xs"
                    min="0"
                    max="100"
                  />
                </div>
                <button
                  onClick={handleApplyDiscount}
                  className="bg-slate-900 text-white text-[11px] font-bold py-1 px-2.5 rounded-lg hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
                >
                  <Percent className="w-3 h-3" />
                  <span>تطبيق الخصم</span>
                </button>
              </div>
            </div>
          )}

          {/* Account PDF/Image downloads and sharing */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleDownloadPNGOf('invoice-capture-area')}
              disabled={isProcessing}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Download className="w-4 h-4 text-emerald-600" />
              )}
              <span>{isProcessing ? 'جاري التحضير...' : 'حفظ كشف الحساب كصورة'}</span>
            </button>

            <button
              onClick={() => handleDirectShareOf('invoice-capture-area')}
              disabled={isSharingAccount}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {isSharingAccount ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Share2 className="w-4 h-4 text-white" />
              )}
              <span>{isSharingAccount ? 'جاري المشاركة...' : 'مشاركة الحساب واتساب 📲'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 📦 SECTION 2 (Formerly 1): RECEIPT REPORT FOR BORROWED/RECEIVED CARDS (بيان استلاف/استلام كروت) */}
      <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-200 space-y-3">
        <div className="text-xs font-black text-indigo-950 flex items-center justify-between">
          <span>📦 2. تقرير المخزون الجديد</span>
        </div>

        <div 
          id="receipt-capture-area" 
          className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-xs relative overflow-hidden text-right"
        >
          {/* Visual corner badge */}
          <div className="absolute top-0 left-0 w-12 h-12 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />

          <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200">
            <div>
              <h2 className="text-xs font-black text-slate-900 leading-none">برنامج حسابات الكروت</h2>
              <p className="text-[8px] font-bold text-slate-400 mt-0.5">منظومة المبيعات الدورية</p>
            </div>
            <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/40">
              المخزون الجديد
            </span>
          </div>

          <div className="text-center py-3 bg-slate-50/60 rounded-xl my-2 border border-slate-100 px-3">
            <p className="text-xs font-black text-slate-500 mb-1">المخزون الجديد للعميل / المحل / الماركت</p>
            <p className="font-extrabold text-indigo-950 text-base leading-normal py-1 px-3 pb-2 border-b border-dashed border-slate-200 inline-block min-w-[120px] max-w-full break-words">{traderName || 'جميع التجار'}</p>
            {traderName && (
              (() => {
                const phone = localStorage.getItem(`phone_${traderName}`);
                if (phone) {
                  return (
                    <p className="text-xs font-bold text-slate-500 mt-1 flex items-center justify-center gap-1">
                      <span>📞 هاتف:</span>
                      <span className="font-mono text-indigo-950 text-xs bg-white/80 px-2 py-0.5 rounded border border-slate-200/50">{phone}</span>
                    </p>
                  );
                }
                return null;
              })()
            )}
            <div className="mt-2.5 flex flex-wrap gap-1.5 items-center justify-center">
              {selectedDayName && (
                <span className="text-[11px] text-indigo-950 font-black bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100/50">
                  اليوم: {selectedDayName}
                </span>
              )}
              <span className="text-[11px] text-indigo-950 font-black bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100/50">
                التاريخ: {currentMonth}
              </span>
              {selectedTimeStr && (
                <span className="text-[11px] text-indigo-950 font-black bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100/50">
                  الساعة: {selectedTimeStr && selectedTimeStr.includes('|') ? selectedTimeStr.split('|')[1].trim() : selectedTimeStr}
                </span>
              )}
            </div>
          </div>

          {/* Receipt Table with Input cells */}
          <div className="overflow-hidden w-full">
            <table className="w-full text-center text-[12px] sm:text-xs border-collapse table-fixed" dir="rtl">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold">
                  <th className="py-2.5 px-1 border border-slate-200 text-center w-[45%]">
                    <span className="block max-w-full text-[8.5px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight">الفئة</span>
                  </th>
                  <th className="py-2.5 px-0.5 border border-slate-200 text-center w-[55%]">
                    <span className="block max-w-full text-[8.5px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight">الكروت المستلمة</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.label} className="hover:bg-slate-50/50 transition font-bold text-slate-700">
                    <td className="p-2 border border-slate-200 text-right pr-3 font-black text-slate-950 text-[12px] min-[320px]:text-xs">{cat.label}</td>
                    <td className="p-2 border border-slate-200 text-center">
                      <input
                        type="number"
                        value={receivedCards[cat.label] ?? 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          const nextReceived = { ...receivedCards, [cat.label]: val };
                          setReceivedCards(nextReceived);
                          try {
                            localStorage.setItem(`receipt_${traderName}_${currentMonth}`, JSON.stringify(nextReceived));
                            localStorage.setItem(`receipt_${traderName}`, JSON.stringify(nextReceived));
                            
                            // Register in the saved dates index
                            let savedDates: string[] = [];
                            const storedDates = localStorage.getItem(`receipt_dates_${traderName}`);
                            if (storedDates) {
                               try {
                                 savedDates = JSON.parse(storedDates);
                               } catch (err) {
                                 console.error(err);
                               }
                            }
                            if (!savedDates.includes(currentMonth)) {
                              savedDates.push(currentMonth);
                              localStorage.setItem(`receipt_dates_${traderName}`, JSON.stringify(savedDates));
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-center font-black text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[15.5px]"
                        dir="ltr"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recipient signature custom card & centered horizontally */}
          <div className="mt-8 flex justify-center">
            <div className="border border-dashed border-emerald-300 bg-emerald-50/20 px-6 py-4 rounded-xl text-[11px] font-black text-slate-800 w-full text-center shadow-3xs space-y-3">
              <div className="text-[10px] text-emerald-600">✍️ توقيع المستلم</div>
              <div className="border-b border-dashed border-slate-400 h-6 w-full mx-auto" />
            </div>
          </div>
        </div>

        {/* SECTION 2 Action Controls */}
        <div className="space-y-2">
          {/* Dynamic manual save receipts values in local storage */}
          <button
            type="button"
            onClick={handleSaveReceiptLocally}
            className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-950 text-white font-black text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-98 shadow-xs cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>حفظ تقرير المخزون الجديد للتاجر بذاكرة اليوم 💾</span>
          </button>

          {/* Receipt download and share buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleDownloadPNGOf('receipt-capture-area')}
              disabled={isProcessingReceipt}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {isProcessingReceipt ? (
                <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Download className="w-4 h-4 text-emerald-600" />
              )}
              <span>{isProcessingReceipt ? 'جاري التحضير...' : 'حفظ المخزون كصورة'}</span>
            </button>

            <button
              onClick={() => handleDirectShareOf('receipt-capture-area')}
              disabled={isSharingReceipt}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {isSharingReceipt ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Share2 className="w-4 h-4 text-white" />
              )}
              <span>{isSharingReceipt ? 'جاري المشاركة...' : 'مشاركة المخزون واتس 📲'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden input element that programmatically retrieves and presents the trader's phone */}
      <input type="hidden" id="active-trader-phone-fetcher" value={traderPhone} />

      {traderPhone && (
        <div className="bg-emerald-50/50 border border-emerald-150 p-2.5 rounded-xl text-emerald-950 text-xs font-bold flex items-center justify-between animate-pulse" dir="rtl">
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-extrabold">📲</span>
            <span>رقم العميل المكتشف:</span>
            <span className="font-mono text-emerald-850 bg-white border border-emerald-100/40 px-2.5 py-0.5 rounded text-[11px] select-all">{traderPhone}</span>
          </span>
          <span className="text-[10px] text-emerald-600 bg-emerald-150 border border-emerald-200 px-2 py-0.5 rounded-full font-black">
            جاهز للإرسال مباشر ⚡
          </span>
        </div>
      )}

      {/* 4. Footer screens switcher */}
      <div className="flex justify-between items-center pt-3 mt-2 border-t border-slate-200/60 w-full py-2">
        <button
          onClick={onPrev}
          className="w-[28%] border border-slate-300 bg-white text-slate-700 font-extrabold py-2 px-2 rounded-xl text-xs hover:bg-slate-50 transition cursor-pointer text-center"
        >
          السابق
        </button>
        <button
          onClick={onSaveAndFinish}
          className="w-[70%] bg-green-600 border border-green-700 text-white font-black py-2 rounded-xl shadow-xs hover:bg-green-700 transition text-xs flex items-center justify-center gap-1 cursor-pointer"
        >
          <CheckSquare className="w-4 h-4" />
          <span>حفظ والانتقال للتقارير ✓</span>
        </button>
      </div>
    </div>
  );
}

