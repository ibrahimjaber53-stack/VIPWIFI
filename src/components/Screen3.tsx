import React from 'react';
import { Category } from '../types';
import { getContrastColor } from '../utils/helpers';
import { ArrowRight, ChevronLeft, ClipboardSignature, Download, Share2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { LocalDB } from '../utils/db';

const localStorage = LocalDB; // Drop-in IndexedDB proxy

interface Screen3Props {
  traderName: string;
  currentMonth: string;
  categories: Category[];
  inventory: Record<string, number>;
  remaining: Record<string, number>;
  onRemainingChange: (label: string, val: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function Screen3({
  traderName,
  currentMonth,
  categories,
  inventory,
  remaining,
  onRemainingChange,
  onPrev,
  onNext,
  onShowToast,
}: Screen3Props) {
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [isSharing, setIsSharing] = React.useState<boolean>(false);

  const handleNextWithCheck = () => {
    // Audit remaining <= inventory counts to alert on user error
    for (let i = 0; i < categories.length; i++) {
      const label = categories[i].label;
      const invCount = inventory[label] || 0;
      const remCount = remaining[label] || 0;
      if (remCount > invCount) {
        onShowToast(
          `خطأ في الإدخال: المتبقي في فئة (${label}) وهو (${remCount}) أكبر من المخزون المستلم وهو (${invCount})! الرجوع والتثبت من الأرقام.`,
          'error'
        );
        return;
      }
    }
    onNext();
  };

  const handleDownloadPNG = async () => {
    const element = document.getElementById('screen3-table-capture-area');
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

      const fileName = `جرد_الكروت_المتبقية_${traderName || 'العميل'}_${currentMonth}`;
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
    const element = document.getElementById('screen3-table-capture-area');
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب جدول الجرد للمشاركة.');
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
            title: `جرد_متبقي_كروت_${traderName || 'العميل'}`,
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
        file = new File([imgBlob], `جرد_متبقي_${traderName || 'العميل'}.png`, { type: 'image/png' });
      } catch (fileErr) {
        console.warn('Could not create sharing File object:', fileErr);
      }

      const textMessage = `📉 كشف جرد الكروت المتبقية لـ ${traderName || 'العميل'} (${currentMonth}) \n🔗 صورة المعاينة الفورية والتحميل: ${shareUrl || window.location.href}`;

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
      {/* Capture wrapper for image download / sharing */}
      <div id="screen3-table-capture-area" className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-4">
        {/* Header Summary (Inside Capture Area) */}
        <div className="bg-indigo-950 text-white p-3.5 rounded-xl flex justify-between items-center shadow-md">
          <div className="max-w-[65%]">
            <p className="text-[10px] text-indigo-200 font-bold">اسم التاجر</p>
            <h3 className="font-extrabold text-sm auto-fit-text">{traderName || 'لم يتم تحديده بعد'}</h3>
          </div>
          <div className="text-left shrink-0">
            <p className="text-[10px] text-indigo-200 font-bold">التاريخ</p>
            <p className="text-xs font-black text-amber-300">{currentMonth}</p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-1.5 flex-row-reverse justify-end">
            <span>جرد الكروت المتبقية</span>
            <ClipboardSignature className="w-5 h-5 text-indigo-600" />
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            أدخل كميات الكروت المتبقية في ذمة التاجر للبدء في تصفية المستحقات المالية
          </p>
        </div>

        {/* Grid Headers */}
        <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-slate-100/95 rounded-xl text-slate-600 shadow-2xs text-center items-center font-bold">
          <span className="text-right whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9.5px] min-[360px]:text-[10.5px] sm:text-[12px] tracking-tight">فئة الكارت</span>
          <span className="whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9.5px] min-[360px]:text-[10.5px] sm:text-[12px] tracking-tight">المخزون المستلم</span>
          <span className="text-left select-none pointer-events-none whitespace-nowrap truncate block max-w-full text-[8.5px] min-[320px]:text-[9.5px] min-[360px]:text-[10.5px] sm:text-[12px] tracking-tight">الجرد (المتبقي)</span>
        </div>

        {/* Grid Inputs List */}
        <div className="space-y-2.5">
          {categories.map((cat) => {
            const invVal = inventory[cat.label] || 0;
            const remVal = remaining[cat.label] !== undefined ? remaining[cat.label] : '';
            const contrastColor = getContrastColor(cat.color);
            
            // Compute sold amount
            const isRemNum = typeof remVal === 'number';
            const remNum = isRemNum ? (remVal as number) : 0;
            const soldCount = invVal - remNum;
            const hasSold = isRemNum && soldCount >= 0;

            return (
              <div
                key={cat.label}
                style={{ backgroundColor: cat.color, color: contrastColor }}
                className="grid grid-cols-3 gap-2 p-3 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition duration-200 items-center text-center animate-fade-in"
              >
                {/* Category label */}
                <div className="text-right">
                  <span className="font-black text-xs block truncate" title={cat.label}>
                    {cat.label}
                  </span>
                  {hasSold ? (
                    <span className="text-[8.5px] font-bold text-indigo-700 bg-white/60 px-1 py-0.5 rounded inline-block mt-0.5 whitespace-nowrap">
                      مباع: {soldCount}
                    </span>
                  ) : (
                    <span className="text-[8.5px] font-bold opacity-60 mt-0.5 block">
                      قيمة: {cat.value}ج
                    </span>
                  )}
                </div>

                {/* Received count */}
                <div className="mx-auto">
                  <span className="text-xs font-black opacity-90 bg-white/60 px-2.5 py-1.5 rounded-lg border border-black/10 text-slate-900 w-14 inline-block shadow-3xs">
                    {invVal}
                  </span>
                </div>

                {/* Remaining input */}
                <div className="w-24 bg-white border border-slate-300 rounded-xl overflow-hidden shadow-inner-sm mr-auto ml-0">
                  <input
                    type="number"
                    placeholder="0"
                    value={remVal}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => onRemainingChange(cat.label, e.target.value)}
                    onKeyDown={(e) => {
                      if (['-', '+', '.', 'e'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    className="w-full p-2 text-center text-xs font-black text-slate-900 focus:outline-none bg-transparent"
                    min="0"
                    pattern="[0-9]*"
                    inputMode="numeric"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 📦 DOWNLOAD IMAGE & SHARE WHATSAPP BUTTONS FOR SCREEN 3 */}
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
          <span>{isProcessing ? 'جاري التحميل...' : 'تحميل الجرد كصورة'}</span>
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
          <span>{isSharing ? 'جاري المشاركة...' : 'مشاركة جرد واتساب ⚡'}</span>
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-slate-200 w-full pb-4">
        <button
          onClick={onPrev}
          className="w-[30%] border border-slate-300 bg-white text-slate-700 font-black p-4 rounded-xl text-xs hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1"
        >
          <ArrowRight className="w-4 h-4" />
          <span>السابق</span>
        </button>
        <button
          onClick={handleNextWithCheck}
          className="w-[68%] bg-indigo-950 hover:bg-indigo-900 text-white font-black p-4 rounded-xl shadow-md transition text-xs flex items-center justify-center gap-1 cursor-pointer"
        >
          <span>حساب التصفية وصافي المستحق</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
