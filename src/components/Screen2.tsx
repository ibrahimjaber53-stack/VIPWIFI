import React from 'react';
import { Category } from '../types';
import { getContrastColor } from '../utils/helpers';
import { ArrowRight, ChevronLeft, ShieldCheck, Filter, FolderInput, PlusCircle, Image, Share2, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { LocalDB } from '../utils/db';

const localStorage = LocalDB; // Drop-in IndexedDB proxy

interface Screen2Props {
  traderName: string;
  currentMonth: string;
  categories: Category[];
  inventory: Record<string, number>;
  midMonth?: Record<string, number>;
  onInventoryChange: (label: string, val: string) => void;
  onMidMonthChange?: (label: string, val: string | number) => void;
  onPrev: () => void;
  onNext: () => void;
  isTraderVersion: boolean;
  savedTradersList: string[];
  onTraderChange: (name: string) => void;
  onDateChange: (day: string, month: string, year: string) => void;
  onLoadInventory: (newInv: Record<string, number>, targetTraderName?: string, targetDatePeriod?: string) => void;
  globalHistoryLogs: Record<string, any>;
}

export default function Screen2({
  traderName,
  currentMonth,
  categories,
  inventory,
  midMonth = {},
  onInventoryChange,
  onMidMonthChange,
  onPrev,
  onNext,
  isTraderVersion,
  savedTradersList,
  onTraderChange,
  onDateChange,
  onLoadInventory,
  globalHistoryLogs,
}: Screen2Props) {
  const [filterTrader, setFilterTrader] = React.useState<string>(traderName || '');
  const [filterDate, setFilterDate] = React.useState<string>('');
  const [savedDates, setSavedDates] = React.useState<string[]>([]);
  const [previewCards, setPreviewCards] = React.useState<Record<string, number> | null>(null);
  const [isCardsVisible, setIsCardsVisible] = React.useState<boolean>(false);

  // Mid-month card additions state
  const [selectedCatLabel, setSelectedCatLabel] = React.useState<string>('');
  const [midMonthInput, setMidMonthInput] = React.useState<string>('');

  // Secure inline verification and confirmation states
  const [showConfirmCopy, setShowConfirmCopy] = React.useState<boolean>(false);
  const [localSuccessMsg, setLocalSuccessMsg] = React.useState<string>('');
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [isSharing, setIsSharing] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (localSuccessMsg) {
      const timer = setTimeout(() => {
        setLocalSuccessMsg('');
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [localSuccessMsg]);

  const prevTraderRef = React.useRef<string>(traderName || '');

  React.useEffect(() => {
    if (traderName) {
      setFilterTrader(traderName);
    }
  }, [traderName]);

  React.useEffect(() => {
    if (filterTrader) {
      try {
        const stored = localStorage.getItem(`receipt_dates_${filterTrader}`);
        let parsed: string[] = [];
        if (stored) {
          parsed = JSON.parse(stored) as string[];
        }
        
        if (filterTrader === traderName && !parsed.includes(currentMonth)) {
          parsed = [currentMonth, ...parsed];
        }

        const historyKeys = Object.keys(globalHistoryLogs || {});
        historyKeys.forEach(hKey => {
          if (hKey.startsWith(`${filterTrader}_`)) {
            const period = hKey.slice(filterTrader.length + 1);
            if (period && !parsed.includes(period)) {
              parsed.push(period);
            }
          }
        });

        parsed = Array.from(new Set(parsed)).filter(Boolean);
        setSavedDates(parsed);

        const traderChanged = filterTrader !== prevTraderRef.current;
        prevTraderRef.current = filterTrader;

        if (parsed.length > 0) {
          if (traderChanged || !filterDate || !parsed.includes(filterDate)) {
            if (parsed.includes(currentMonth)) {
              setFilterDate(currentMonth);
            } else {
              setFilterDate(parsed[0]);
            }
          }
        } else {
          setFilterDate('');
        }
      } catch (e) {
        console.error(e);
        setSavedDates([]);
        setFilterDate('');
      }
    } else {
      prevTraderRef.current = '';
      setSavedDates([]);
      setFilterDate('');
    }
  }, [filterTrader, traderName, currentMonth, globalHistoryLogs]);

  React.useEffect(() => {
    if (filterTrader && filterDate) {
      try {
        const key = `receipt_${filterTrader}_${filterDate}`;
        const stored = localStorage.getItem(key);
        let parsed: Record<string, number> = {};
        
        if (stored) {
          parsed = JSON.parse(stored);
        } else {
          const hKey = `${filterTrader}_${filterDate}`;
          if (globalHistoryLogs && globalHistoryLogs[hKey] && globalHistoryLogs[hKey].inventory) {
            parsed = globalHistoryLogs[hKey].inventory;
          } else {
            const fallbackKey = `receipt_${filterTrader}`;
            const storedFallback = localStorage.getItem(fallbackKey);
            if (storedFallback) {
              parsed = JSON.parse(storedFallback);
            } else {
              const fallback: Record<string, number> = {};
              categories.forEach(cat => {
                fallback[cat.label] = (filterTrader === traderName && filterDate === currentMonth) ? (inventory[cat.label] || 0) : 0;
              });
              parsed = fallback;
            }
          }
        }

        const completeCards: Record<string, number> = {};
        categories.forEach(cat => {
          completeCards[cat.label] = parsed[cat.label] !== undefined ? parsed[cat.label] : 0;
        });
        setPreviewCards(completeCards);
      } catch (e) {
        console.error(e);
        const fallback: Record<string, number> = {};
        categories.forEach(cat => {
          fallback[cat.label] = 0;
        });
        setPreviewCards(fallback);
      }
    } else {
      setPreviewCards(null);
    }
  }, [filterTrader, filterDate, traderName, currentMonth, globalHistoryLogs, categories, inventory]);

  const handleDownloadPNG = async () => {
    const element = document.getElementById('screen2-table-capture-area');
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب الجزء الخاص بالجدول للتصدير.');
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
        console.warn('toPng failed, falling back to html2canvas:', toPngErr);
        const canvas = await html2canvas(element, {
          scale: 2.2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        dataUrl = canvas.toDataURL('image/png');
      }

      const fileName = `مخزون_الكروت_المستلمة_${traderName || 'العميل'}_${currentMonth}`;
      
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
        window.location.href = `/api/download-report/${resData.id}`;
      } else {
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
      setIsProcessing(false);
    }
  };

  const handleShareToWhatsApp = async () => {
    const element = document.getElementById('screen2-table-capture-area');
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب الجدول للتصدير والمشاركة.');
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
            title: `مخزون_كروت_${traderName || 'العميل'}`,
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
        file = new File([imgBlob], `مخزون_${traderName || 'العميل'}.png`, { type: 'image/png' });
      } catch (fileErr) {
        console.warn('Could not create sharing File object:', fileErr);
      }

      const textMessage = `📦 جدول مخزون الكروت المستلمة لـ ${traderName || 'العميل'} (${currentMonth}) \n🔗 صورة المعاينة الفورية والتحميل: ${shareUrl || window.location.href}`;

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
    } catch (e: any) {
      console.error('Share failure:', e);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in text-right">
      {/* Header Summary */}
      <div className="bg-indigo-950 text-white p-3.5 rounded-2xl flex justify-between items-center shadow-md">
        <div className="max-w-[65%]">
          <p className="text-[10px] text-indigo-200 font-bold">اسم التاجر</p>
          <h3 className="font-extrabold text-sm auto-fit-text">{traderName || 'لم يتم تحديده بعد'}</h3>
        </div>
        <div className="text-center shrink-0">
          <p className="text-[10px] text-indigo-200 font-bold">التاريخ</p>
          <p className="text-xs font-black text-amber-300">{currentMonth}</p>
        </div>
      </div>

      {/* 📦 1st BLOCK (TOP): UNIFIED INVENTORY TABLE */}
      <div id="screen2-table-capture-area" className="bg-white p-3 rounded-2xl border border-slate-200 shadow-3xs space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5 justify-end flex-row-reverse">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>المخزون الذي استلمه التاجر</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            عاين كميات الكروت المستلمة وجردها، يمكنك إدخال الكميات المستلمة بالجدول بالإضافة لإجمالي كميات كروت منتصف الشهر المجمعة.
          </p>
        </div>

        {/* Unified Table showing all 3 metrics */}
        <div className="overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-3xs w-full">
          <div className="overflow-hidden">
            <table className="w-full border-collapse text-right table-fixed" dir="rtl">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold">
                  <th className="py-2.5 px-1 font-extrabold text-right w-[42%]">
                    <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight font-black">فئات الكروت المعتمدة</span>
                  </th>
                  <th className="py-2.5 px-0.5 font-extrabold text-center w-[22%]">
                    <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight font-black">المستلمة</span>
                  </th>
                  {!isTraderVersion && (
                    <>
                      <th className="py-2.5 px-0.5 font-extrabold text-center w-[18%]">
                        <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight font-black">اضافة</span>
                      </th>
                      <th className="py-2.5 px-0.5 font-extrabold text-center bg-indigo-50/30 w-[18%]">
                        <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[10px] min-[360px]:text-[11px] sm:text-[12px] tracking-tight font-black">إجمالي</span>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10.5px] sm:text-xs font-bold text-slate-800">
                {categories.map((cat) => {
                  const receivedCount = inventory[cat.label] !== undefined ? inventory[cat.label] : '';
                  const midMonthCount = midMonth && midMonth[cat.label] !== undefined ? midMonth[cat.label] : 0;
                  const totalSum = (Number(receivedCount) || 0) + midMonthCount;
                  const contrastColor = getContrastColor(cat.color);
                  
                  return (
                    <tr key={cat.label} style={{ backgroundColor: cat.color }} className="hover:opacity-95 transition">
                      {/* الفئات المعتمدة */}
                      <td className="py-2 px-1.5">
                        <div className="flex items-center gap-1.5 justify-start">
                          <span 
                            className="w-2 h-2 rounded-full border border-black/10 shrink-0" 
                            style={{ backgroundColor: '#ffffff' }}
                          />
                          <div className="truncate">
                            <span style={{ color: contrastColor }} className="font-extrabold text-[10.5px] min-[320px]:text-[11px] sm:text-xs block truncate">{cat.label}</span>
                            <span style={{ color: contrastColor }} className="text-[8.5px] sm:text-[9.5px] opacity-90 font-bold block truncate">قيمة: {cat.value} ج</span>
                          </div>
                        </div>
                      </td>
                      
                      {/* الكروت المستلمة */}
                      <td className="py-2 px-0.5 text-center">
                        <div className="bg-white border border-slate-200 rounded-lg shadow-inner-sm overflow-hidden flex items-center mx-auto max-w-[55px] min-[360px]:max-w-[65px] sm:max-w-[80px]">
                          <input
                            type="number"
                            placeholder="0"
                            value={receivedCount}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => onInventoryChange(cat.label, e.target.value)}
                            onKeyDown={(e) => {
                              if (['-', '+', '.', 'e'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            className="w-full py-1 text-center text-[11px] min-[320px]:text-xs sm:text-sm font-black text-slate-900 focus:outline-none bg-transparent"
                            min="0"
                            pattern="[0-9]*"
                            inputMode="numeric"
                          />
                        </div>
                      </td>
                      
                      {/* كميات منتصف الشهر */}
                      {!isTraderVersion && (
                        <td className="py-2 px-0.5 text-center font-extrabold text-[10.5px] min-[320px]:text-xs sm:text-sm">
                          {midMonthCount > 0 ? (
                            <span className="bg-white/80 text-emerald-950 border border-black/10 px-1.5 py-0.5 rounded-md inline-block font-black shadow-3xs max-w-full truncate">
                              {midMonthCount}
                            </span>
                          ) : (
                            <span style={{ color: contrastColor }} className="font-normal">-</span>
                          )}
                        </td>
                      )}
                      
                      {/* إجمالي الكمية */}
                      {!isTraderVersion && (
                        <td className="py-2 px-1 text-center">
                          <span style={{ color: contrastColor }} className="font-extrabold text-[10.5px] min-[320px]:text-[11px] sm:text-xs block truncate">
                            {totalSum} كارت
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 📦 2nd BLOCK: DOWNLOAD IMAGE & SHARE WHATSAPP BUTTONS */}
      <div className="grid grid-cols-2 gap-2 w-full">
        <button
          onClick={handleDownloadPNG}
          disabled={isProcessing}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm h-11 cursor-pointer disabled:opacity-60"
        >
          {isProcessing ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{isProcessing ? 'جاري التحميل...' : 'تحميل الجدول كصورة'}</span>
        </button>

        <button
          onClick={handleShareToWhatsApp}
          disabled={isSharing}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm h-11 cursor-pointer disabled:opacity-60"
        >
          {isSharing ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          <span>{isSharing ? 'جاري المشاركة...' : 'مشاركة واتساب ⚡'}</span>
        </button>
      </div>

      {/* 📦 3rd BLOCK: RECALL / FILE IMPORT AREA (استدعاء الكروت) */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3 shadow-3xs" dir="rtl">
        <div className="flex items-center gap-1.5 text-indigo-950 font-black text-xs border-b border-slate-200 pb-2 flex-row-reverse justify-end">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>استدعاء الكروت المتاحة تلقائياً</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {!isTraderVersion ? (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500">اسم التاجر:</label>
              <select
                value={filterTrader}
                onChange={(e) => {
                  setFilterTrader(e.target.value);
                  setShowConfirmCopy(false);
                }}
                className="w-full text-xs font-black text-slate-800 bg-white border border-slate-200 py-2 px-2.5 rounded-xl cursor-pointer focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              >
                <option value="">-- اختر تاجر --</option>
                {savedTradersList.filter(t => t !== 'اختر تاجر من القائمة').map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div className={isTraderVersion ? "col-span-2 space-y-1" : "space-y-1"}>
            <label className="block text-[10px] font-bold text-slate-500">تاريخ وفترة الاستلام المتاحة:</label>
            <select
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setShowConfirmCopy(false);
              }}
              disabled={savedDates.length === 0}
              className="w-full text-xs font-black text-slate-800 bg-white border border-slate-200 py-2 px-2.5 rounded-xl cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              {savedDates.length === 0 ? (
                <option value="">لا توجد تواريخ مسجلة</option>
              ) : (
                savedDates.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Show data preview if found */}
        {previewCards && (
          <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-2">
            <div 
              onClick={() => setIsCardsVisible(!isCardsVisible)} 
              className="flex justify-between items-center text-[10.5px] font-bold text-slate-600 cursor-pointer select-none hover:text-indigo-600 transition"
            >
              <div className="flex items-center gap-1">
                <span>📝 ملخص الكروت المستلمة المتاحة</span>
                <span className="text-[9px] text-slate-400 font-normal">
                  {isCardsVisible ? '(إخفاء 🔼)' : '(عرض 🔽)'}
                </span>
              </div>
              <span className="text-indigo-600 font-black">{filterDate}</span>
            </div>
            {isCardsVisible && (
              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-bold text-center animate-fade-in">
                {categories.map(cat => {
                  const qty = previewCards[cat.label] || 0;
                  return (
                    <div key={cat.label} className="bg-slate-50/70 border border-slate-200 p-1.5 rounded-lg">
                      <div className="text-slate-500 text-[9px]">{cat.label}</div>
                      <div className="text-indigo-950 font-black text-[11px] mt-0.5">{qty} كارت</div>
                    </div>
                  );
                })}
              </div>
            )}

            {showConfirmCopy ? (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-2 animate-fade-in text-right">
                <p className="text-[11px] font-black text-amber-900 leading-normal">
                  ⚠️ هل أنت متأكد من تعبئة وتوريد مخزون هذا التاجر بقيم كشف استلام يوم {filterDate} لـ التاجر "{filterTrader}"؟ سيتم استبدال القيم الحالية بالجدول بالقيم الجديدة.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onLoadInventory(previewCards || {});
                      setShowConfirmCopy(false);
                      setLocalSuccessMsg('⚡ تم بنجاح استدعاء وتوريد قيم تقرير الاستلام وتعبئة جدول مخزن كروت التاجر بنجاح!');
                    }}
                    className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] py-2 px-1 rounded-lg cursor-pointer transition shadow-3xs"
                  >
                    نعم، استورد القيم ✅
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmCopy(false)}
                    className="w-1/2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-[10px] py-2 px-1 rounded-lg cursor-pointer transition"
                  >
                    تراجع وإلغاء ❌
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowConfirmCopy(true);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition duration-155 cursor-pointer shadow-3xs"
              >
                <FolderInput className="w-3.5 h-3.5" />
                <span>استدعاء القيم وملء الجدول 📥</span>
              </button>
            )}

            {localSuccessMsg && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[10px] font-bold text-center animate-fade-in mt-1">
                {localSuccessMsg}
              </div>
            )}
          </div>
        )}

        {filterTrader && savedDates.length === 0 && (
          <div className="text-center p-2.5 bg-amber-50/50 border border-amber-200/40 rounded-xl text-amber-900 text-[10px] font-bold">
            ⚠️ لم يتم حفظ أو العثور على أي كشوفات استلام سابقة محفوظة لهذا التاجر بالمسار المحدد.
          </div>
        )}
      </div>

      {/* 📦 4th BLOCK: MID-MONTH ADDITION */}
      {!isTraderVersion && (
        <div className="bg-emerald-50/60 border border-emerald-200/80 p-4 rounded-2xl space-y-3.5 shadow-3xs text-right" dir="rtl">
          <div className="flex items-center gap-2 text-emerald-950 font-black text-xs border-b border-emerald-200 pb-2.5 flex-row-reverse justify-end">
            <PlusCircle className="w-4.5 h-4.5 text-emerald-600" />
            <span className="text-sm font-black">إضافة كروت منتصف الشهر</span>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="block text-[10.5px] font-black text-slate-500">اختر الفئة المستهدفة:</label>
              <select
                value={selectedCatLabel}
                onChange={(e) => {
                  const label = e.target.value;
                  setSelectedCatLabel(label);
                  if (label) {
                    const existing = midMonth && midMonth[label] !== undefined ? midMonth[label].toString() : '';
                    setMidMonthInput(existing);
                  } else {
                    setMidMonthInput('');
                  }
                }}
                className="w-full text-xs font-black text-slate-800 bg-white border border-slate-200 py-2.5 px-3 rounded-xl cursor-pointer focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              >
                <option value="">-- اختر فئة كرت شحن --</option>
                {categories.map((cat) => (
                  <option key={cat.label} value={cat.label}>
                    {cat.label} (قيمة الكرت الحسابية: {cat.value} ج.م)
                  </option>
                ))}
              </select>
            </div>

            {selectedCatLabel && (
              <div className="grid grid-cols-3 gap-2.5 items-end animate-fade-in pt-1">
                <div className="col-span-2 space-y-1">
                  <label className="block text-[10.5px] font-black text-slate-500">عدد الكروت المسجلة بمنتصف الشهر:</label>
                  <input
                    type="number"
                    placeholder="مثال: 50"
                    value={midMonthInput}
                    onChange={(e) => setMidMonthInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (['-', '+', '.', 'e'].includes(e.key)) {
                        e.preventDefault();
                        return;
                      }
                      if (e.key === 'Enter') {
                        if (selectedCatLabel) {
                          const countVal = parseInt(midMonthInput) || 0;
                          if (onMidMonthChange) {
                            onMidMonthChange(selectedCatLabel, countVal);
                          }
                          setLocalSuccessMsg(`⚡ تم تثبيت القيمة (${countVal} كارت) لـ [${selectedCatLabel}] بنجاح!`);
                          setSelectedCatLabel('');
                          setMidMonthInput('');
                        }
                      }
                    }}
                    className="w-full text-xs font-black text-slate-800 bg-white border border-slate-200 py-2.5 px-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    min="0"
                    pattern="[0-9]*"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCatLabel) {
                        const countVal = parseInt(midMonthInput) || 0;
                        if (onMidMonthChange) {
                          onMidMonthChange(selectedCatLabel, countVal);
                        }
                        setLocalSuccessMsg(`⚡ تم تثبيت القيمة (${countVal} كارت) لـ [${selectedCatLabel}] بنجاح!`);
                        setSelectedCatLabel('');
                        setMidMonthInput('');
                      }
                    }}
                    className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs py-2.5 rounded-xl cursor-pointer transition shadow-3xs h-[38px] flex items-center justify-center gap-1"
                  >
                    <span>تطبيق</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-slate-200 w-full pb-4">
        {!isTraderVersion && (
          <button
            onClick={onPrev}
            className="w-[30%] border border-slate-300 bg-white text-slate-700 font-black p-4 rounded-xl text-xs hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1"
          >
            <ArrowRight className="w-4 h-4" />
            <span>السابق</span>
          </button>
        )}
        <button
          onClick={onNext}
          className={`bg-indigo-950 hover:bg-indigo-900 text-white font-black p-4 rounded-xl shadow-md transition text-xs flex items-center justify-center gap-1 cursor-pointer ${
            isTraderVersion ? 'w-full' : 'w-[68%]'
          }`}
        >
          <span>التالي جرد الكروت المتبقية</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
