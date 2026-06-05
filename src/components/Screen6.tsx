import React, { useRef, useState } from 'react';
import { Category, AppData } from '../types';
import { ChevronLeft, Database, Upload, Download } from 'lucide-react';
import { LocalDB } from '../utils/db';

const localStorage = LocalDB; // Drop-in IndexedDB proxy

interface Screen6Props {
  appData: AppData;
  categories: Category[];
  isTraderVersion: boolean;
  onNavigateToScreen: (screenNum: number) => void;
  onOpenPreview: (areaId: string, type: 'png' | 'pdf', fileName: string) => void;
  onClearMonthlyDataOnly: () => void;
  onClearTradersListOnly: () => void;
  onClearTraderArchiveOnly: () => void;
  onFactoryReset: () => void;
  onOpenInstallGuide: () => void;
}

export default function Screen6({
  appData,
  categories,
  isTraderVersion,
  onNavigateToScreen,
  onOpenPreview,
  onClearMonthlyDataOnly,
  onClearTradersListOnly,
  onClearTraderArchiveOnly,
  onFactoryReset,
  onOpenInstallGuide,
}: Screen6Props) {
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingServer, setIsExportingServer] = useState(false);

  const handleServerDownloadJSON = async () => {
    setIsExportingServer(true);
    try {
      const dataStr = LocalDB.getBackupString();
      
      const saveRes = await fetch('/api/save-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload: dataStr
        })
      });

      const resData = await saveRes.json();
      if (resData && resData.success) {
        window.location.href = `/api/download-backup/${resData.id}`;
      } else {
        throw new Error(resData.error || 'فشل توليد رابط التحميل من الخادم');
      }
    } catch (e: any) {
      console.error(e);
      handleLocalExportJSON();
    } finally {
      setIsExportingServer(false);
    }
  };

  const handleLocalExportJSON = () => {
    try {
      const dataStr = LocalDB.getBackupString();
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataUri);
      downloadAnchor.setAttribute('download', 'نسخة_احتياطية_كاملة_للبرنامج.json');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert('خطأ أثناء التحميل المحلي: ' + err.message);
    }
  };

  const handleLocalImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = event.target?.result as string;
        performDataRestore(rawText);
      } catch (err) {
        alert('حدث خطأ أثناء قراءة الملف، يرجى التثبت من صحته.');
      }
    };
    reader.readAsText(file);
  };

  const performDataRestore = (backupTextData: string) => {
    try {
      const success = LocalDB.restoreFromBackup(backupTextData);
      if (success) {
        alert('تم فك وتطبيق ملف النسخة الاحتياطية بنجاح! سيتم إعادة تحميل الصفحة الآن لتطبيق البيانات.');
        window.location.reload();
      } else {
        alert('فشل استيراد النسخة الاحتياطية. يرجى التثبت من سلامة الملف وخلوه من المشاكل.');
      }
    } catch (e: any) {
      alert('عذراً، ملف النسخة الاحتياطية تالف أو خطأ: ' + e.message);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in text-right">
      <div>
        <h2 className="text-xl font-black text-slate-905 flex items-center gap-1.5 justify-end flex-row-reverse">
          <span>لوحة التحكم وإدارة قاعدة البيانات</span>
          <Database className="w-5 h-5 text-indigo-600" />
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          خيارات التهيئة الأساسية والتحكم بقاعدة التخزين وبيانات وحسابات التجار بالكامل
        </p>
      </div>

      {/* Export & DB Cleanups */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4.5 text-xs text-right">
        
        {/* Row 1: Backup Export and Import (Enhanced) */}
        {!isTraderVersion && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
            <p className="text-[11px] font-black text-slate-800 flex items-center justify-end gap-1 flex-row-reverse border-r-2 border-slate-900 pr-1.5 font-sans">
              <span>أدوات النسخ الاحتياطي ونقل البيانات (ملفات تأمين الحسابات):</span>
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                onClick={handleServerDownloadJSON}
                disabled={isExportingServer}
                className="p-3 bg-indigo-950 text-white rounded-lg font-black hover:bg-slate-900 disabled:opacity-50 transition text-[10px] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs w-full"
              >
                <Download className="w-4 h-4 text-indigo-300" />
                <span>{isExportingServer ? 'يتم التجهيز والتحميل...' : '📥 تحميل ملف النسخة الاحتياطية للبرنامج (.json)'}</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-white border border-slate-350 text-slate-800 rounded-lg font-bold hover:bg-slate-50 transition text-[10px] flex items-center justify-center gap-2 cursor-pointer shadow-3xs w-full"
              >
                <Upload className="w-4 h-4 text-indigo-700" />
                <span>📥 استيراد واسترجاع من ملف نسخة احتياطية (.json)</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLocalImportJSON}
                accept=".json"
                className="hidden"
              />
            </div>

            <p className="text-[9px] text-slate-450 leading-normal">
              يتيح هذا القسم تصدير وحفظ واستيراد كافة إعدادات وتصنيفات وتقارير وأرشيف البرنامج بالكامل ليكون آمناً 100٪ ضد المسح أو نقل البيانات لـ هاتف آخر أو متصفح آخر بسهولة تامة عبر صيغة ملفات JSON المشفرة والآمنة.
            </p>
          </div>
        )}

        {/* Clearances and hard wipes section */}
        <div className="space-y-2.5 pt-1 text-right">
          <p className="text-[10.5px] text-slate-455 font-black text-right border-b border-slate-100 pb-1.5 mb-2">أدوات التحكم وقاعدة بيانات المتصفح الحالية:</p>
          
          {!isTraderVersion && (
            <>
              <button
                onClick={onClearMonthlyDataOnly}
                className="w-full bg-amber-50 text-amber-700 border border-amber-200 font-bold p-3 rounded-xl text-[10.5px] hover:bg-amber-100 transition shadow-xs cursor-pointer text-right flex items-center justify-start gap-1.5"
                dir="rtl"
              >
                <span>🔄</span>
                <span>تصفير البيانات الشهرية فقط والمخازن النشطة بالكامل (مع حفظ باك أب تلقائي)</span>
              </button>
              
              <button
                onClick={onClearTradersListOnly}
                className="w-full bg-red-50 text-red-650 border border-red-200 font-black p-3 rounded-xl text-[10.5px] hover:bg-red-100 transition shadow-xs cursor-pointer text-right flex items-center justify-start gap-1.5"
                dir="rtl"
              >
                <span>⚠️</span>
                <span>حذف وتفريغ قائمة أسماء التجار المسجلين من الذاكرة (مع حفظ باك أب تلقائي)</span>
              </button>
            </>
          )}

           <button
            onClick={onOpenInstallGuide}
            className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200/55 font-black p-3 rounded-xl text-[10.5px] hover:bg-slate-100/70 transition shadow-3xs cursor-pointer text-right flex items-center justify-start gap-1.5"
            dir="rtl"
          >
            <span>📱</span>
            <span>تثبيت برنامج الكروت ورفع ملف المفاتيح (PWA Keystore & Android Guide)</span>
          </button>

          <button
            onClick={onClearTraderArchiveOnly}
            className="w-full bg-rose-50 text-rose-700 border border-rose-250 font-black p-3 rounded-xl text-[10.5px] hover:bg-rose-100 transition shadow-xs cursor-pointer text-right flex items-center justify-start gap-1.5"
            dir="rtl"
          >
            <span>🗑️</span>
            <span>مسح وإفراغ سجل أرشيف كشوف الفترات والسنوات بالكامل (مع حفظ باك أب تلقائي)</span>
          </button>

          {/* Factory Reset row */}
          {!isTraderVersion && (
            <button
              onClick={onFactoryReset}
              className="w-full bg-red-600 text-white font-black p-3 rounded-xl text-[10.5px] hover:bg-red-700 transition shadow-xs cursor-pointer text-right flex items-center justify-start gap-1.5 justify-center leading-none mt-2"
              dir="rtl"
            >
              <span>⚙️</span>
              <span>إعادة ضبط المصنع بالكامل (تهيئة وصفر شامل مع خيار الباك أب)</span>
            </button>
          )}
        </div>
      </div>

      {/* Screen switcher */}
      <div className="pt-4 border-t border-slate-100 flex gap-3 w-full">
        <button
          onClick={() => onNavigateToScreen(5)}
          className="w-full border border-slate-300 bg-white text-slate-800 font-black p-4 rounded-xl text-xs hover:bg-slate-50 transition flex items-center justify-center gap-1 cursor-pointer shadow-3xs"
        >
          <ChevronLeft className="w-4 h-4 text-slate-500 mr-1" />
          <span>الذهاب لشاشة الأرشيف والإحصائيات والبحث المتقدم ←</span>
        </button>
      </div>
    </div>
  );
}
