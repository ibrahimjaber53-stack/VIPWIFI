import React, { useState } from 'react';
import { Category } from '../types';
import { getContrastColor } from '../utils/helpers';
import { Plus, Trash2, Calendar, Users, Settings2, Sparkles, ChevronLeft } from 'lucide-react';
import { LocalDB } from '../utils/db';

const localStorage = LocalDB; // Drop-in IndexedDB proxy


interface Screen1Props {
  traderName: string;
  savedTradersList: string[];
  selectedDayNum: string;
  selectedMonthNum: string;
  selectedYearNum: string;
  selectedDayName?: string;
  selectedTimeStr?: string;
  onAutoSyncDeviceClock?: () => void;
  categories: Category[];
  onTraderChange: (name: string) => void;
  onAddTrader: (name: string) => void;
  onDayChange: (d: string) => void;
  onMonthChange: (m: string) => void;
  onYearChange: (y: string) => void;
  onUpdateCategories: (cats: Category[]) => void;
  onNext: () => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function Screen1({
  traderName,
  savedTradersList,
  selectedDayNum,
  selectedMonthNum,
  selectedYearNum,
  selectedDayName,
  selectedTimeStr,
  onAutoSyncDeviceClock,
  categories,
  onTraderChange,
  onAddTrader,
  onDayChange,
  onMonthChange,
  onYearChange,
  onUpdateCategories,
  onNext,
  onShowToast,
}: Screen1Props) {
  const [newTraderInput, setNewTraderInput] = useState('');
  const [newTraderPhone, setNewTraderPhone] = useState('');

  const handleAddNewTrader = () => {
    const trimmed = newTraderInput.trim();
    const phoneTrimmed = newTraderPhone.trim();
    if (!trimmed) {
      onShowToast('الرجاء كتابة اسم التاجر أولاً لإضافته لحافظة البيانات.', 'error');
      return;
    }
    if (savedTradersList.includes(trimmed)) {
      onShowToast('اسم التاجر متواجد بالفعل مسبقاً في القائمة.', 'info');
      onTraderChange(trimmed);
      setNewTraderInput('');
      setNewTraderPhone('');
      return;
    }
    if (phoneTrimmed) {
      localStorage.setItem(`phone_${trimmed}`, phoneTrimmed);
    } else {
      localStorage.removeItem(`phone_${trimmed}`);
    }
    onAddTrader(trimmed);
    setNewTraderInput('');
    setNewTraderPhone('');
    onShowToast(`تم إضافة التاجر الحسابي الجديد: ${trimmed} بنجاح.`, 'success');
  };

  const handleAddNewCategory = () => {
    const label = prompt('أدخل اسم الفئة الجديدة (مثال: 400 جنيه):');
    if (!label) return;
    const valueStr = prompt('أدخل القيمة الحسابية الصافية لهذه الفئة بالجنيه:');
    if (!valueStr) return;
    const valueVal = parseFloat(valueStr);
    if (isNaN(valueVal) || valueVal <= 0) {
      onShowToast('الرجاء إدخال قيمة مالية صحيحة للفئة الجديدة.', 'error');
      return;
    }

    const updated = [
      ...categories,
      { label, color: '#ffffff', value: valueVal },
    ];
    onUpdateCategories(updated);
    onShowToast(`تم إضافة فئة كروت معتمدة جديدة: ${label}`, 'success');
  };

  const handleDeleteCategory = (index: number) => {
    if (categories.length <= 1) {
      onShowToast('يجب أن تحتوي المنظومة على فئة كروت واحدة على الأقل.', 'error');
      return;
    }
    const catToDelete = categories[index];
    if (confirm(`هل أنت متأكد من رغبتك في حذف فئة الكروت (${catToDelete.label})؟`)) {
      const updated = categories.filter((_, i) => i !== index);
      onUpdateCategories(updated);
      onShowToast(`تم إزالة فئة الكروت: ${catToDelete.label}`, 'info');
    }
  };

  const handleCategoryValueChange = (index: number, val: string) => {
    const num = parseFloat(val) || 0;
    const updated = [...categories];
    updated[index].value = num;
    onUpdateCategories(updated);
  };

  const handleCategoryColorChange = (index: number, color: string) => {
    const updated = [...categories];
    updated[index].color = color;
    onUpdateCategories(updated);
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 12 }, (_, i) => 2024 + i);

  return (
    <div className="space-y-5 animate-fade-in text-right">
      <div>
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-indigo-600" />
          <span>إعداد البيانات الأساسية</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">اختر التاجر و التاريخ</p>
      </div>

      <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-200/85 shadow-sm">
        {/* Trader Selection */}
        <div>
          <label className="block text-xs font-bold mb-1.5 text-slate-700 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>اختر التاجر النشط من القائمة:</span>
            <span className="text-red-500">*</span>
          </label>
          <select
            value={traderName || 'اختر تاجر من القائمة'}
            onChange={(e) => onTraderChange(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/30 focus:border-indigo-600 transition"
          >
            {savedTradersList.map((trader) => (
              <option key={trader} value={trader}>
                {trader}
              </option>
            ))}
          </select>
          {traderName && (
            (() => {
              const phone = localStorage.getItem(`phone_${traderName}`);
              if (phone) {
                return (
                  <p className="text-[11px] text-slate-500 font-bold mt-1.5 flex items-center gap-1">
                    <span>📞 تليفون التاجر الحالي:</span>
                    <span className="font-mono text-indigo-750 bg-indigo-50/70 border border-indigo-100/40 px-2 py-0.5 rounded text-xs select-all">{phone}</span>
                  </p>
                );
              }
              return null;
            })()
          )}
        </div>

        {/* Add New Trader */}
        <div className="pt-2.5 border-t border-slate-100 space-y-2">
          <label className="block text-xs font-black text-slate-700">
            اكتب اسم تاجر جديد:
          </label>
          <div className="space-y-2.5">
            <div>
              <span className="block text-[10px] text-slate-400 font-bold mb-1">اسم التاجر/العميل: <span className="text-red-500">*</span></span>
              <input
                type="text"
                value={newTraderInput}
                onChange={(e) => setNewTraderInput(e.target.value)}
                placeholder="مثال: ماركت الهدى / محل النور"
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/30 focus:border-indigo-600 transition"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNewTrader()}
              />
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 font-bold mb-1">تليفون أو هاتف التاجر (اختياري):</span>
              <input
                type="tel"
                inputMode="tel"
                value={newTraderPhone}
                onChange={(e) => setNewTraderPhone(e.target.value)}
                placeholder="مثال: 01012345678"
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/30 focus:border-indigo-600 transition text-left"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNewTrader()}
                dir="ltr"
              />
            </div>
            <button
              onClick={handleAddNewTrader}
              type="button"
              className="w-full mt-1.5 bg-slate-900 text-white text-xs font-black p-2.5 rounded-xl hover:bg-slate-800 transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-450" />
              <span>إضافة التاجر والبيانات للحافظة</span>
            </button>
          </div>
        </div>

        {/* Day, Month & Year Sync & Select */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          {/* Dynamic Auto-Time Visualizer */}
          <div className="bg-indigo-50/70 border border-indigo-100 p-3.5 rounded-2xl text-indigo-950 flex flex-col gap-2.5 relative overflow-hidden" dir="rtl">
            <div className="flex justify-between items-center bg-indigo-50/20">
              <span className="text-[10px] font-black text-indigo-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse shrink-0" />
                <span>تم ضبط وقت وتاريخ الفاتورة تلقائياً</span>
              </span>
              {onAutoSyncDeviceClock && (
                <button
                  onClick={onAutoSyncDeviceClock}
                  type="button"
                  className="text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white font-black px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  title="تحديث ومزامنة البيانات مع ساعة جهازك الآن"
                >
                  <span>مزامنة الآن 🔄</span>
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
              <div className="bg-white p-2 rounded-xl border border-indigo-100 shadow-3xs">
                <span className="block text-[8px] text-slate-400 font-bold mb-1">اليوم:</span>
                <span className="font-extrabold text-indigo-950 text-[11px]">{selectedDayName || 'اليوم'}</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-indigo-100 shadow-3xs">
                <span className="block text-[8px] text-slate-400 font-bold mb-1">التاريخ:</span>
                <span className="font-extrabold text-indigo-950 text-[11px] tracking-tight">{selectedDayNum} / {selectedMonthNum} / {selectedYearNum}</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-indigo-100 shadow-3xs">
                <span className="block text-[8px] text-slate-400 font-bold mb-1">ساعة التسجيل:</span>
                <span className="font-extrabold text-indigo-950 text-[11px]">{selectedTimeStr && selectedTimeStr.includes('|') ? selectedTimeStr.split('|')[1].trim() : (selectedTimeStr || '--:--')}</span>
              </div>
            </div>
          </div>

          {/* Details override toggle */}
          <div className="pt-1.5">
            <details className="group">
              <summary className="text-[11px] text-slate-500 hover:text-indigo-600 font-bold cursor-pointer flex items-center justify-between select-none focus:outline-none py-1 px-1 rounded-lg hover:bg-slate-50">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 group-open:text-indigo-600 transition shrink-0" />
                  <span>تعديل يوم/تاريخ الفاتورة يدوياً؟</span>
                </span>
                <span className="text-[9px] bg-slate-100 group-open:bg-indigo-50 text-slate-500 group-open:text-indigo-700 transition px-2 py-0.5 rounded-full font-bold">
                  تعديل يدوي ⚙️
                </span>
              </summary>
              
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50 animate-fade-in" dir="rtl">
                <div>
                  <label className="block text-[10px] font-bold mb-1 text-slate-600">اليوم:</label>
                  <select
                    value={selectedDayNum}
                    onChange={(e) => onDayChange(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white text-xs font-bold focus:outline-none focus:border-slate-800 transition"
                  >
                    {days.map((d) => (
                      <option key={d} value={d.toString()}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1 text-slate-600">الشهر:</label>
                  <select
                    value={selectedMonthNum}
                    onChange={(e) => onMonthChange(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white text-xs font-bold focus:outline-none focus:border-slate-800 transition"
                  >
                    {months.map((m) => (
                      <option key={m} value={m.toString()}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1 text-slate-600">السنة:</label>
                  <select
                    value={selectedYearNum}
                    onChange={(e) => onYearChange(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white text-xs font-bold focus:outline-none focus:border-slate-800 transition"
                  >
                    {years.map((y) => (
                      <option key={y} value={y.toString()}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Categories setup */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>فئات الكروت الأساسية</span>
        </label>
        
        <div className="space-y-2.5">
          {categories.map((cat, index) => {
            const contrastColor = getContrastColor(cat.color);
            return (
              <div
                key={index}
                style={{ backgroundColor: cat.color, color: contrastColor }}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/85 hover:border-slate-300 transition duration-200 shadow-2xs"
              >
                <span 
                  style={{ color: contrastColor }}
                  className="w-[30%] font-black text-xs truncate" 
                  title={cat.label}
                >
                  {cat.label}
                </span>

                <div className="w-[45%] flex items-center bg-white/70 border border-black/10 rounded-lg overflow-hidden px-2 py-1">
                  <span className="text-[10px] opacity-75 font-bold ml-1.5 shrink-0" style={{ color: '#0f172a' }}>القيمة:</span>
                  <input
                    type="number"
                    value={cat.value}
                    onChange={(e) => handleCategoryValueChange(index, e.target.value)}
                    style={{ color: '#0f172a' }}
                    className="w-full bg-transparent font-black text-xs text-center focus:outline-none"
                  />
                  <span className="text-[9px] opacity-75 font-bold mr-1 shrink-0" style={{ color: '#0f172a' }}>ج</span>
                </div>

                <div className="w-[25%] flex items-center justify-end gap-2">
                  <input
                    type="color"
                    value={cat.color}
                    onChange={(e) => handleCategoryColorChange(index, e.target.value)}
                    className="w-7 h-7 rounded-md border border-black/20 cursor-pointer p-0 bg-transparent block overflow-hidden shadow-3xs hover:scale-105 transition"
                  />
                  <button
                    onClick={() => handleDeleteCategory(index)}
                    style={{ color: contrastColor, backgroundColor: 'rgba(0,0,0,0.08)' }}
                    className="hover:bg-black/15 p-1 rounded-lg transition"
                    title="حذف هذه الفئة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleAddNewCategory}
          className="w-full bg-slate-50 text-slate-700 border border-dashed border-slate-300 text-xs font-bold p-2.5 rounded-xl hover:bg-slate-100 hover:border-slate-400 transition cursor-pointer flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة فئة كروت جديدة للمركز</span>
        </button>
      </div>

      {/* Footer next screen */}
      <div className="pt-4 border-t border-slate-100">
        <button
          onClick={onNext}
          className="w-full bg-indigo-950 hover:bg-indigo-900 text-white font-black p-4 rounded-xl shadow-md transition text-xs flex items-center justify-center gap-1 cursor-pointer"
        >
          <span>الانتقال للمخزون واستلام الكروت</span>
          <ChevronLeft className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
  );
}
