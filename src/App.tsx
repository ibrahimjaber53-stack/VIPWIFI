import React, { useState, useEffect } from 'react';
import { Category, AppData, ArchiveEntry, TraderLog, PeriodHistoryLogs } from './types';
import { motion, AnimatePresence } from 'motion/react';
import Toast from './components/Toast';
import Sidebar from './components/Sidebar';
import Stepper from './components/Stepper';
import Screen1 from './components/Screen1';
import Screen2 from './components/Screen2';
import Screen3 from './components/Screen3';
import Screen4 from './components/Screen4';
import Screen5 from './components/Screen5';
import Screen6 from './components/Screen6';
import { LivePreviewModal, PwaInstallGuideModal } from './components/Modals';
import { Menu, Wifi, Info } from 'lucide-react';
import { LocalDB } from './utils/db';

const localStorage = LocalDB; // Drop-in IndexedDB proxy


const initialCategories: Category[] = [
  { label: '20 جنيه', color: '#f8fafc', value: 20 },   
  { label: '50 جنيه', color: '#f1f5f9', value: 50 },   
  { label: '100 جنيه', color: '#cbd5e1', value: 100 }, 
  { label: '200 جنيه', color: '#col-200', value: 200 }, // Fallback standard shades
  { label: '300 جنيه', color: '#ffb8b8', value: 300 }, 
  { label: '500 جنيه', color: '#85e6a2', value: 500 }, 
  { label: '1000 جنيه', color: '#ffdd59', value: 1000 } 
];

// Seed fallback colors
initialCategories[3].color = '#c7ecee';

const getArabicDayName = (date: Date): string => {
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return dayNames[date.getDay()];
};

const getFormattedTime = (date: Date): string => {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${period}`;
};

const getArabicDayNameForDate = (d: string, m: string, y: string): string => {
  try {
    const parsedDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (isNaN(parsedDate.getTime())) return '';
    const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    return dayNames[parsedDate.getDay()];
  } catch {
    return '';
  }
};

const initialDate = new Date();
const defaultDay = initialDate.getDate().toString();
const defaultMonth = (initialDate.getMonth() + 1).toString();
const defaultYear = initialDate.getFullYear().toString();
const defaultPeriod = `${defaultDay} / ${defaultMonth} / ${defaultYear}`;
const defaultDayName = getArabicDayName(initialDate);
const defaultTimeStr = getFormattedTime(initialDate);

const initialAppData: AppData = {
  isTraderVersion: false,
  traderName: '',
  savedTradersList: ['اختر تاجر من القائمة'],
  currentMonth: defaultPeriod,
  selectedMonthNum: defaultMonth,
  selectedYearNum: defaultYear,
  selectedDayNum: defaultDay,
  selectedDayName: defaultDayName,
  selectedTimeStr: defaultTimeStr,
  discountPercentage: 5,
  categories: initialCategories,
  inventory: {},
  remaining: {},
  savedTradersLog: [],
  traderArchive: {},
  globalHistoryLogs: {},
};

export default function App() {
  const [isDbReady, setIsDbReady] = useState<boolean>(false);
  const [screen, setScreen] = useState<number>(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isIframe, setIsIframe] = useState<boolean>(false);

  useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  // Core App State
  const [isTraderVersion, setIsTraderVersion] = useState<boolean>(false);
  const [traderName, setTraderName] = useState<string>('');
  const [savedTradersList, setSavedTradersList] = useState<string[]>(['اختر تاجر من القائمة']);
  const [selectedDayNum, setSelectedDayNum] = useState<string>(defaultDay);
  const [selectedMonthNum, setSelectedMonthNum] = useState<string>(defaultMonth);
  const [selectedYearNum, setSelectedYearNum] = useState<string>(defaultYear);
  const [selectedDayName, setSelectedDayName] = useState<string>(defaultDayName);
  const [selectedTimeStr, setSelectedTimeStr] = useState<string>(defaultTimeStr);
  const [currentMonth, setCurrentMonth] = useState<string>(defaultPeriod);
  const [discountPercentage, setDiscountPercentage] = useState<number>(5);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [midMonth, setMidMonth] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState<Record<string, number>>({});
  const [savedTradersLog, setSavedTradersLog] = useState<TraderLog[]>([]);
  const [traderArchive, setTraderArchive] = useState<Record<string, ArchiveEntry>>({});
  const [globalHistoryLogs, setGlobalHistoryLogs] = useState<Record<string, PeriodHistoryLogs>>({});

  // Real-time ticking clock for premium feeling (dynamic offline live clock)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const months = [
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
      ];
      const dayName = days[now.getDay()];
      const day = now.getDate();
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();
      
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const period = hours >= 12 ? 'م' : 'ص';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = hours.toString().padStart(2, '0');
      
      const fullTimeStr = `${dayName}، ${day} ${monthName} ${year} | ${hoursStr}:${minutes}:${seconds} ${period}`;
      setSelectedTimeStr(fullTimeStr);
      setSelectedDayName(dayName);
    };

    updateClock(); // Run immediately
    const timer = setInterval(updateClock, 1000); // tick every second
    return () => clearInterval(timer);
  }, []);

  // Modals state
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewAreaId, setPreviewAreaId] = useState<string>('');
  const [previewExportType, setPreviewExportType] = useState<'png' | 'pdf'>('png');
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showPwaGuide, setShowPwaGuide] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Capture PWA installer trigger event
  useEffect(() => {
    const handleBeforePrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforePrompt);
  }, []);

  const handleTriggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install outcome: ${outcome}`);
    } catch (err) {
      console.error('Error during PWA installation:', err);
    }
    setDeferredPrompt(null);
  };

  // Load from IndexedDB on mount
  useEffect(() => {
    LocalDB.init().then(() => {
      // Check for developer test flag in URL
      const params = new URLSearchParams(window.location.search);
      const mockMode = params.get('mode') === 'trader';

      const saved = LocalDB.getItem('vip_wifi_v3_storage');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as AppData;
          const finalTraderVer = mockMode || parsed.isTraderVersion || false;
          
          setIsTraderVersion(finalTraderVer);
          setTraderName(parsed.traderName || '');
          setSavedTradersList(parsed.savedTradersList && parsed.savedTradersList.length > 0 
            ? parsed.savedTradersList 
            : ['اختر تاجر من القائمة']
          );
          
          const loadedDay = parsed.selectedDayNum || defaultDay;
          const loadedMonth = parsed.selectedMonthNum || defaultMonth;
          const loadedYear = parsed.selectedYearNum || defaultYear;
          const loadedDayName = parsed.selectedDayName || getArabicDayNameForDate(loadedDay, loadedMonth, loadedYear) || defaultDayName;
          const loadedTimeStr = parsed.selectedTimeStr || defaultTimeStr;

          setSelectedDayNum(loadedDay);
          setSelectedMonthNum(loadedMonth);
          setSelectedYearNum(loadedYear);
          setSelectedDayName(loadedDayName);
          setSelectedTimeStr(loadedTimeStr);
          setCurrentMonth(parsed.currentMonth || `${loadedDay} / ${loadedMonth} / ${loadedYear}`);
          
          setDiscountPercentage(parsed.discountPercentage !== undefined ? parsed.discountPercentage : 5);
          setCategories(parsed.categories && parsed.categories.length > 0 ? parsed.categories : initialCategories);
          setInventory(parsed.inventory || {});
          setMidMonth(parsed.midMonth || {});
          setRemaining(parsed.remaining || {});
          setSavedTradersLog(parsed.savedTradersLog || []);
          setTraderArchive(parsed.traderArchive || {});
          setGlobalHistoryLogs(parsed.globalHistoryLogs || {});

          if (finalTraderVer) {
            setScreen(2); // Traders skip Screen 1
          } else {
            setScreen(1);
          }
        } catch (e) {
          console.error('Failed to load local storage state:', e);
        }
      } else {
        if (mockMode) {
          setIsTraderVersion(true);
          setTraderName('تاجر تجريبي');
          setSavedTradersList(['تاجر تجريبي']);
          setScreen(2);
        }
      }
      setIsDbReady(true);
    }).catch(err => {
      console.error("Critical IndexedDB init error:", err);
      setIsDbReady(true);
    });
  }, []);

  // Save changes to localStorage on state changes
  const serializeState = (overrideData?: Partial<AppData>): AppData => {
    return {
      isTraderVersion,
      traderName,
      savedTradersList,
      currentMonth,
      selectedDayNum,
      selectedMonthNum,
      selectedYearNum,
      selectedDayName,
      selectedTimeStr,
      discountPercentage,
      categories,
      inventory,
      remaining,
      midMonth,
      savedTradersLog,
      traderArchive,
      globalHistoryLogs,
      ...overrideData,
    };
  };

  const saveState = (updatedData: AppData) => {
    localStorage.setItem('vip_wifi_v3_storage', JSON.stringify(updatedData));
  };

  const handleShowToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  };

  // State Callbacks
  const handleTraderChange = (name: string) => {
    const finalName = name === 'اختر تاجر من القائمة' ? '' : name;
    setTraderName(finalName);

    // Fetch individual discounts if logged
    let lastDiscount = discountPercentage;
    const memoizedD = localStorage.getItem(`discount_${name}`);
    if (memoizedD) {
      const parsedD = parseFloat(memoizedD);
      if (!isNaN(parsedD)) {
        lastDiscount = parsedD;
        setDiscountPercentage(parsedD);
      }
    }

    // Attempt restoring previous inventory cycle entries
    const searchKey = `${finalName}_${currentMonth}`;
    let invState: Record<string, number> = {};
    let remState: Record<string, number> = {};
    let midMonthState: Record<string, number> = {};

    if (globalHistoryLogs && globalHistoryLogs[searchKey]) {
      const log = globalHistoryLogs[searchKey];
      invState = log.inventory || {};
      remState = log.remaining || {};
      midMonthState = log.midMonth || {};
      if (log.discountPercentage !== undefined) {
        lastDiscount = log.discountPercentage;
        setDiscountPercentage(log.discountPercentage);
      }
    }

    setInventory(invState);
    setRemaining(remState);
    setMidMonth(midMonthState);

    const merged = serializeState({
      traderName: finalName,
      discountPercentage: lastDiscount,
      inventory: invState,
      remaining: remState,
      midMonth: midMonthState,
    });
    saveState(merged);
  };

  const handleAddTrader = (name: string) => {
    let currentList = [...savedTradersList];
    if (currentList[0] === 'اختر تاجر من القائمة' && currentList.length === 1) {
      currentList = [];
    }
    currentList.push(name);
    setSavedTradersList(currentList);
    setTraderName(name);
    setInventory({});
    setRemaining({});
    setMidMonth({});

    const merged = serializeState({
      savedTradersList: currentList,
      traderName: name,
      inventory: {},
      remaining: {},
      midMonth: {},
    });
    saveState(merged);
  };

  const handleDateChange = (d: string, m: string, y: string) => {
    setSelectedDayNum(d);
    setSelectedMonthNum(m);
    setSelectedYearNum(y);
    const dayName = getArabicDayNameForDate(d, m, y) || defaultDayName;
    setSelectedDayName(dayName);
    
    const formattedPeriod = `${d} / ${m} / ${y}`;
    setCurrentMonth(formattedPeriod);

    // Effort to restore previous cycle
    const searchKey = `${traderName}_${formattedPeriod}`;
    let invState: Record<string, number> = {};
    let remState: Record<string, number> = {};
    let midMonthState: Record<string, number> = {};
    let lastDiscount = discountPercentage;

    if (globalHistoryLogs && globalHistoryLogs[searchKey]) {
      const log = globalHistoryLogs[searchKey];
      invState = log.inventory || {};
      remState = log.remaining || {};
      midMonthState = log.midMonth || {};
      if (log.discountPercentage !== undefined) {
        lastDiscount = log.discountPercentage;
        setDiscountPercentage(lastDiscount);
      }
    }

    setInventory(invState);
    setRemaining(remState);
    setMidMonth(midMonthState);

    const merged = serializeState({
      selectedDayNum: d,
      selectedMonthNum: m,
      selectedYearNum: y,
      selectedDayName: dayName,
      currentMonth: formattedPeriod,
      inventory: invState,
      remaining: remState,
      midMonth: midMonthState,
      discountPercentage: lastDiscount,
    });
    saveState(merged);
  };

  const handleAutoSyncDeviceClock = () => {
    const now = new Date();
    const d = now.getDate().toString();
    const m = (now.getMonth() + 1).toString();
    const y = now.getFullYear().toString();
    const dayName = getArabicDayName(now);
    const timeStr = getFormattedTime(now);

    setSelectedDayNum(d);
    setSelectedMonthNum(m);
    setSelectedYearNum(y);
    setSelectedDayName(dayName);
    setSelectedTimeStr(timeStr);

    const formattedPeriod = `${d} / ${m} / ${y}`;
    setCurrentMonth(formattedPeriod);

    // Effort to restore previous cycle
    const searchKey = `${traderName}_${formattedPeriod}`;
    let invState: Record<string, number> = {};
    let remState: Record<string, number> = {};
    let midMonthState: Record<string, number> = {};
    let lastDiscount = discountPercentage;

    if (globalHistoryLogs && globalHistoryLogs[searchKey]) {
      const log = globalHistoryLogs[searchKey];
      invState = log.inventory || {};
      remState = log.remaining || {};
      midMonthState = log.midMonth || {};
      if (log.discountPercentage !== undefined) {
        lastDiscount = log.discountPercentage;
        setDiscountPercentage(lastDiscount);
      }
    }

    setInventory(invState);
    setRemaining(remState);
    setMidMonth(midMonthState);

    const merged = serializeState({
      selectedDayNum: d,
      selectedMonthNum: m,
      selectedYearNum: y,
      selectedDayName: dayName,
      selectedTimeStr: timeStr,
      currentMonth: formattedPeriod,
      inventory: invState,
      remaining: remState,
      midMonth: midMonthState,
      discountPercentage: lastDiscount,
    });
    saveState(merged);
    handleShowToast('🚀 تم تحديث ومزامنة الوقت والتاريخ تلقائياً من جهازك بنجاح!', 'success');
  };

  const handleUpdateCategories = (cats: Category[]) => {
    setCategories(cats);
    const merged = serializeState({ categories: cats });
    saveState(merged);
  };

  const handleLoadFullInventory = (newInv: Record<string, number>, targetTraderName?: string, targetDatePeriod?: string) => {
    const finalTrader = targetTraderName || traderName;
    const finalPeriod = targetDatePeriod || currentMonth;

    if (targetTraderName && targetTraderName !== traderName) {
      setTraderName(targetTraderName);
    }
    const dateParts = finalPeriod.split(' / ').map(s => s.trim());
    if (dateParts.length === 3) {
      setSelectedDayNum(dateParts[0]);
      setSelectedMonthNum(dateParts[1]);
      setSelectedYearNum(dateParts[2]);
      const dayName = getArabicDayNameForDate(dateParts[0], dateParts[1], dateParts[2]) || defaultDayName;
      setSelectedDayName(dayName);
    }
    setCurrentMonth(finalPeriod);

    setInventory(newInv);

    let lastDiscount = discountPercentage;
    if (finalTrader) {
      const memoizedD = localStorage.getItem(`discount_${finalTrader}`);
      if (memoizedD) {
        const parsedD = parseFloat(memoizedD);
        if (!isNaN(parsedD)) {
          lastDiscount = parsedD;
          setDiscountPercentage(parsedD);
        }
      }
    }

    const searchKey = `${finalTrader}_${finalPeriod}`;
    const nextHistory = { ...globalHistoryLogs };
    
    // Retrieve correct stored remaining/midMonth state for this specific destination period if present, otherwise set to empty
    const targetRemaining = nextHistory[searchKey]?.remaining || {};
    const targetMidMonth = nextHistory[searchKey]?.midMonth || {};
    setRemaining(targetRemaining);
    setMidMonth(targetMidMonth);

    nextHistory[searchKey] = {
      inventory: newInv,
      remaining: targetRemaining,
      midMonth: targetMidMonth,
      discountPercentage: lastDiscount,
      categories: categories,
    };
    setGlobalHistoryLogs(nextHistory);

    const serializedData: any = {
      traderName: finalTrader,
      currentMonth: finalPeriod,
      inventory: newInv,
      remaining: targetRemaining,
      midMonth: targetMidMonth,
      globalHistoryLogs: nextHistory,
      discountPercentage: lastDiscount,
    };

    if (dateParts.length === 3) {
      serializedData.selectedDayNum = dateParts[0];
      serializedData.selectedMonthNum = dateParts[1];
      serializedData.selectedYearNum = dateParts[2];
      serializedData.selectedDayName = getArabicDayNameForDate(dateParts[0], dateParts[1], dateParts[2]) || defaultDayName;
    }

    const merged = serializeState(serializedData);
    saveState(merged);
  };

  const handleInventoryChange = (label: string, val: string) => {
    const updated = { ...inventory };
    if (val === '') {
      delete updated[label];
    } else {
      updated[label] = Math.max(0, parseInt(val) || 0);
    }
    setInventory(updated);

    const searchKey = `${traderName}_${currentMonth}`;
    const nextHistory = { ...globalHistoryLogs };
    nextHistory[searchKey] = {
      inventory: updated,
      remaining: remaining,
      midMonth: midMonth,
      discountPercentage: discountPercentage,
      categories: categories,
    };
    setGlobalHistoryLogs(nextHistory);

    const merged = serializeState({
      inventory: updated,
      globalHistoryLogs: nextHistory,
    });
    saveState(merged);
  };

  const handleMidMonthChange = (label: string, val: number | string) => {
    const updated = { ...midMonth };
    const numVal = typeof val === 'number' ? val : parseInt(val);
    if (isNaN(numVal) || numVal === 0) {
      delete updated[label];
    } else {
      updated[label] = Math.max(0, numVal);
    }
    setMidMonth(updated);

    const searchKey = `${traderName}_${currentMonth}`;
    const nextHistory = { ...globalHistoryLogs };
    nextHistory[searchKey] = {
      inventory: inventory,
      remaining: remaining,
      midMonth: updated,
      discountPercentage: discountPercentage,
      categories: categories,
    };
    setGlobalHistoryLogs(nextHistory);

    const merged = serializeState({
      midMonth: updated,
      globalHistoryLogs: nextHistory,
    });
    saveState(merged);
  };

  const handleRemainingChange = (label: string, val: string) => {
    const updated = { ...remaining };
    if (val === '') {
      delete updated[label];
    } else {
      updated[label] = Math.max(0, parseInt(val) || 0);
    }
    setRemaining(updated);

    const searchKey = `${traderName}_${currentMonth}`;
    const nextHistory = { ...globalHistoryLogs };
    nextHistory[searchKey] = {
      inventory: inventory,
      remaining: updated,
      midMonth: midMonth,
      discountPercentage: discountPercentage,
      categories: categories,
    };
    setGlobalHistoryLogs(nextHistory);

    const merged = serializeState({
      remaining: updated,
      globalHistoryLogs: nextHistory,
    });
    saveState(merged);
  };

  const handleApplyDiscount = (rate: number) => {
    setDiscountPercentage(rate);
    if (traderName) {
      localStorage.setItem(`discount_${traderName}`, rate.toString());
    }

    const searchKey = `${traderName}_${currentMonth}`;
    const nextHistory = { ...globalHistoryLogs };
    if (nextHistory[searchKey]) {
      nextHistory[searchKey].discountPercentage = rate;
    } else {
      nextHistory[searchKey] = {
        inventory: inventory,
        remaining: remaining,
        midMonth: midMonth,
        discountPercentage: rate,
        categories: categories,
      };
    }
    setGlobalHistoryLogs(nextHistory);

    const merged = serializeState({
      discountPercentage: rate,
      globalHistoryLogs: nextHistory,
    });
    saveState(merged);
    handleShowToast(`تم بنجاح تعديل وتوطين الخصم المعتمد إلى (${rate}%) الكشوفات الحالية.`, 'success');
  };

  const handleSaveAndFinish = () => {
    if (!traderName) return;

    // Compile values sum (received + mid-month)
    let totalSales = 0;
    categories.forEach((cat) => {
      const invCount = (inventory[cat.label] || 0) + (midMonth[cat.label] || 0);
      const rem = remaining[cat.label] || 0;
      totalSales += Math.max(0, invCount - rem) * cat.value;
    });

    const discVal = (totalSales * discountPercentage) / 100;
    const netAmount = totalSales - discVal;

    // Archive Entry packaging
    const archiveKey = `${traderName}_${currentMonth}`;
    const updatedArchive = { ...traderArchive };
    updatedArchive[archiveKey] = {
      traderName,
      period: currentMonth,
      totalSales,
      discountRate: discountPercentage,
      discountVal: discVal,
      netAmount,
      timestamp: new Date().toLocaleString('ar-EG'),
      categoriesSnapshot: JSON.parse(JSON.stringify(categories)),
      inventorySnapshot: { ...inventory },
      remainingSnapshot: { ...remaining },
      midMonthSnapshot: { ...midMonth },
    };
    setTraderArchive(updatedArchive);

    // Synchronize to logs summaries
    const updatedLogs = [...savedTradersLog];
    const existingIdx = updatedLogs.findIndex((item) => item.name === traderName && item.period === currentMonth);
    if (existingIdx !== -1) {
      updatedLogs[existingIdx].finalAmount = netAmount;
    } else {
      updatedLogs.push({
        name: traderName,
        finalAmount: netAmount,
        period: currentMonth,
      });
    }
    setSavedTradersLog(updatedLogs);

    const merged = serializeState({
      traderArchive: updatedArchive,
      savedTradersLog: updatedLogs,
    });
    saveState(merged);

    // Switch view
    setScreen(5);
    handleShowToast('تم توثيق وحفظ وحظر تعديلات الكشف التصفوي في سجلات الأرشيف بنجاح.', 'success');
  };

  // DB Resets & Deletions
  const handleResetForAnotherTrader = () => {
    setTraderName('');
    setInventory({});
    setRemaining({});
    setDiscountPercentage(5);

    const merged = serializeState({
      traderName: '',
      inventory: {},
      remaining: {},
      discountPercentage: 5,
    });
    saveState(merged);
    setScreen(6);
    handleShowToast('تم حفظ الجرد بنجاح، وتوجيهك إلى شاشة التحكم.', 'success');
  };

  const handleUpdateMonthForTrader = () => {
    const inputDay = prompt('أدخل رقم اليوم (1-31):', selectedDayNum);
    if (!inputDay) return;
    const inputMonth = prompt('أدخل رقم الشهر (1-12):', selectedMonthNum);
    if (!inputMonth) return;
    const inputYear = prompt('أدخل السنة الدورية:', selectedYearNum);
    if (!inputYear) return;

    setSelectedDayNum(inputDay);
    setSelectedMonthNum(inputMonth);
    setSelectedYearNum(inputYear);
    const formattedPeriod = `${inputDay} / ${inputMonth} / ${inputYear}`;
    setCurrentMonth(formattedPeriod);
    setInventory({});
    setRemaining({});

    const merged = serializeState({
      selectedDayNum: inputDay,
      selectedMonthNum: inputMonth,
      selectedYearNum: inputYear,
      currentMonth: formattedPeriod,
      inventory: {},
      remaining: {},
    });
    saveState(merged);
    setScreen(2); // Jump back to screen 2
    handleShowToast(`تم إنشاء دورة جرد جديدة للفترة: ${formattedPeriod}`, 'success');
  };

  const triggerAutoLocalBackup = (actionName: string) => {
    const backup: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        backup[key] = localStorage.getItem(key) || '';
      }
    }
    const dataStr = JSON.stringify(backup, null, 2);
    
    // Save locally to rescue key
    try {
      localStorage.setItem(`rescue_backup_before_${actionName}`, dataStr);
    } catch (e) {
      console.warn("Storage quota exceeded during rescue backup.");
    }

    // Prompt download
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataUri);
    downloadAnchor.setAttribute('download', `نسخة_احتياطية_كاملة_للبرنامج_قبل_${actionName}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleClearMonthlyDataOnly = () => {
    if (confirm('هل أنت متأكد من تصفير وإبادة مدخلات الجرد للمخازن والجلسات الشهرية الحالية بالكامل؟ سيتم حفظ نسخة احتياطية من البرنامج تلقائياً قبل البدء.')) {
      triggerAutoLocalBackup('تصفير_البيانات_الشهرية');

      setInventory({});
      setRemaining({});
      setDiscountPercentage(5);
      setSavedTradersLog([]);

      const merged = serializeState({
        inventory: {},
        remaining: {},
        discountPercentage: 5,
        savedTradersLog: [],
      });
      saveState(merged);
      handleShowToast('تم أخذ نسخة احتياطية وتصفير قيم المدخلات واستبقاء الأرشيف والبيانات الأساسية.', 'info');
    }
  };

  const handleClearTradersListOnly = () => {
    if (confirm('تنبيه قطعي: هل تود محو قائمة التجار المسجلين نهائياً من ذاكرة المتصفح؟ سيتم تحميل نسخة احتياطية لكامل البرنامج أولاً لحماية بياناتك.')) {
      triggerAutoLocalBackup('تفريغ_قائمة_التجار');

      setSavedTradersList(['اختر تاجر من القائمة']);
      setTraderName('');
      setInventory({});
      setRemaining({});

      const merged = serializeState({
        savedTradersList: ['اختر تاجر من القائمة'],
        traderName: '',
        inventory: {},
        remaining: {},
      });
      saveState(merged);
      handleShowToast('تم أخذ نسخة احتياطية وتفريغ وحذف حافظة عملاء المركز بالكامل.', 'info');
    }
  };

  const handleClearTraderArchiveOnly = () => {
    if (confirm('تنبيه هام ومصيري: هل تريد حذف وإفراغ سجل أرشيف كشوف الفترات بالكامل؟ سيتم تنزيل نسخة احتياطية لبياناتك تلقائياً.')) {
      triggerAutoLocalBackup('إفراغ_الارشيف_الشهري');

      setTraderArchive({});
      const merged = serializeState({ traderArchive: {} });
      saveState(merged);
      handleShowToast('تم أخذ نسخة احتياطية ومسح أرشيف كشوف الفترات والسنوات بالكامل بنجاح.', 'success');
    }
  };

  const handleFactoryReset = () => {
    const wantBackup = confirm('⚠️ كود تنبيه مصيري: هل ترغب في عمل باك أب (نسخة احتياطية للتحميل) بجميع محتويات وبيانات وسجلات البرنامج السابقة قبل تفعيل خيار إعادة ضبط المصنع ومسح كل شيء؟');
    
    if (wantBackup) {
      triggerAutoLocalBackup('ضبط_المصنع_الكامل');
    }

    const confirmClear = confirm('⚠️ تنبيه أخير: هل أنت موافق على مسح جميع ومختلف بيانات وملفات ونقاط البرنامج المحددة وإعادتها لوضع ضبط المصنع بالكامل الآن؟');
    if (confirmClear) {
      localStorage.clear();
      alert('تمت تهيئة وإعادة تعيين البرنامج لوضع ضبط المصنع بنجاح!');
      window.location.reload();
    }
  };

  const [direction, setDirection] = useState<number>(0);

  const handleNavigateCheck = (screenNum: number) => {
    if (isTraderVersion && screenNum === 1) {
      handleShowToast('عذراً، صلاحياتك كتاجر تحظر الدخول لصفحة التهيئة الأساسية للمركز.', 'error');
      return;
    }
    if (screenNum > 1 && (!traderName || traderName.trim() === '')) {
      // Default to general trader name instead of blocking navigation
      setTraderName('تاجر عام');
      if (!savedTradersList.includes('تاجر عام')) {
        setSavedTradersList(prev => {
          const filtered = prev.filter(t => t !== 'اختر تاجر من القائمة');
          return [...filtered, 'تاجر عام'];
        });
      }
    }
    // Invert direction for RTL: going to larger screen number moves next leftwards (dir: -1), etc.
    setDirection(screenNum > screen ? -1 : 1);
    setScreen(screenNum);
  };

  // Touch Swipe Gesture State & Handlers
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Don't trigger swipe if interacting with form elements, buttons, clickable details, scrollable elements, or dialogs
    if (
      target.closest('input') || 
      target.closest('select') || 
      target.closest('button') || 
      target.closest('textarea') || 
      target.closest('details') ||
      target.closest('.overflow-x-auto') ||
      target.closest('table') ||
      target.closest('[role="dialog"]') ||
      target.closest('.no-swipe')
    ) {
      return;
    }
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    
    const diffX = touchStart.x - endX;
    const diffY = touchStart.y - endY;
    
    setTouchStart(null);

    // If vertical movement is too high, it is a scroll - skip to avoid accidental navigation
    if (Math.abs(diffY) > Math.abs(diffX) || Math.abs(diffY) > 80) return;

    // Minimum swipe distance threshold (60px)
    if (Math.abs(diffX) > 60) {
      const activeSteps = isTraderVersion ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
      const currentIndex = activeSteps.indexOf(screen);

      if (diffX < 0) {
        // Drag right (swipe left-to-right) -> Go Next step
        if (currentIndex !== -1 && currentIndex < activeSteps.length - 1) {
          handleNavigateCheck(activeSteps[currentIndex + 1]);
        }
      } else {
        // Drag left (swipe right-to-left) -> Go Prev step
        if (currentIndex !== -1 && currentIndex > 0) {
          handleNavigateCheck(activeSteps[currentIndex - 1]);
        }
      }
    }
  };

  const handleOpenPreview = (areaId: string, type: 'png' | 'pdf', fileName: string) => {
    setPreviewAreaId(areaId);
    setPreviewExportType(type);
    setPreviewFileName(fileName);
    setShowPreviewModal(true);
  };

  const screenVariants = {
    initial: (dir: number) => ({
      opacity: 0,
      x: dir === -1 ? -60 : 60,
    }),
    animate: {
      opacity: 1,
      x: 0,
      transition: { type: 'spring', stiffness: 350, damping: 30 }
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir === -1 ? 60 : -60,
      transition: { duration: 0.12 }
    })
  };

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6" style={{ direction: 'rtl' }}>
        <div className="relative flex flex-col items-center justify-center max-w-sm w-full text-center space-y-3 animate-pulse">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
            برنامج حسابات الكروت
          </h1>
          <div className="text-indigo-400 text-lg sm:text-xl font-black font-mono tracking-wider uppercase">
            VIPWIFI
          </div>
          <div className="text-slate-400 text-xs sm:text-sm font-bold pt-2">
            إعداد وتصميم
          </div>
          <div className="text-indigo-300 text-base sm:text-lg font-black">
            م/ابراهيم جابر
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16 relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {isIframe && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3 text-right text-xs border-b-2 border-amber-400 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md no-print">
          <div className="flex items-center gap-2.5">
            <span className="text-xl animate-bounce">🔓</span>
            <div className="flex flex-col">
              <span className="font-extrabold text-amber-300 text-sm">أنت تستعرض البرنامج داخل إطار معاينة مقيد</span>
              <span className="text-[10px] text-slate-300 font-medium">لتشغيل مميزات التصدير المباشر كصورة أو PDF ومشاركة الفاتورة للواتساب فوراً دون أي قيود:</span>
            </div>
          </div>
          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="w-full sm:w-auto bg-amber-400 text-indigo-950 hover:bg-amber-300 font-extrabold px-5 py-2.5 rounded-xl transition cursor-pointer text-xs shadow-md shrink-0 flex items-center justify-center gap-1.5"
          >
            <span>تشغيل في صفحة مستقلة كاملة 🚀</span>
          </button>
        </div>
      )}
      <div>
        {/* Navigation Sidebar Drawer */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentScreen={screen}
          isTraderVersion={isTraderVersion}
          onNavigate={handleNavigateCheck}
          traderName={traderName}
          onOpenInstallGuide={() => setShowPwaGuide(true)}
        />

        {/* Global Toolbar Header */}
        <div className="bg-white border-b border-slate-200/85 px-4 pt-4 pb-3 sticky top-0 z-40 shadow-xs">
          <div className="max-w-md mx-auto flex justify-between items-center mb-3">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition cursor-pointer"
                title="القائمة الجانبية"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex flex-col text-right">
                <span className="text-xs font-black text-slate-900 tracking-wide flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>{isTraderVersion ? 'حسابات كشفي - حساب كروت الواي فاي' : 'برنامج حسابات الكروت'}</span>
                </span>
              </div>
            </div>
            
            <div className="text-left">
              <span className="text-[10px] font-black text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 inline-flex items-center gap-1 shadow-3xs select-none">
                <span className="text-green-600 font-black">إعداد</span>
                <span>م/ ابراهيم جابر</span>
              </span>
            </div>
          </div>

          {/* Stepper bar component */}
          <Stepper
            currentScreen={screen}
            isTraderVersion={isTraderVersion}
            onNavigate={handleNavigateCheck}
          />
        </div>

        {/* Main Content Router with overflow safety */}
        <div 
          className="max-w-md mx-auto p-4 min-h-[calc(100vh-110px)] flex flex-col justify-between overflow-x-hidden"
        >
          <div className="w-full">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={screen}
                custom={direction}
                variants={screenVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                {(() => {
                  const computedTotalInventory: Record<string, number> = {};
                  categories.forEach((cat) => {
                    computedTotalInventory[cat.label] = (inventory[cat.label] || 0) + (midMonth[cat.label] || 0);
                  });

                  return (
                    <>
                      {screen === 1 && (
                        <Screen1
                          traderName={traderName}
                          savedTradersList={savedTradersList}
                          selectedDayNum={selectedDayNum}
                          selectedMonthNum={selectedMonthNum}
                          selectedYearNum={selectedYearNum}
                          selectedDayName={selectedDayName}
                          selectedTimeStr={selectedTimeStr}
                          onAutoSyncDeviceClock={handleAutoSyncDeviceClock}
                          categories={categories}
                          onTraderChange={handleTraderChange}
                          onAddTrader={handleAddTrader}
                          onDayChange={(d) => handleDateChange(d, selectedMonthNum, selectedYearNum)}
                          onMonthChange={(m) => handleDateChange(selectedDayNum, m, selectedYearNum)}
                          onYearChange={(y) => handleDateChange(selectedDayNum, selectedMonthNum, y)}
                          onUpdateCategories={handleUpdateCategories}
                          onNext={() => handleNavigateCheck(2)}
                          onShowToast={handleShowToast}
                        />
                      )}

                      {screen === 2 && (
                        <Screen2
                          traderName={traderName}
                          currentMonth={currentMonth}
                          categories={categories}
                          inventory={inventory}
                          midMonth={midMonth}
                          onInventoryChange={handleInventoryChange}
                          onMidMonthChange={handleMidMonthChange}
                          onPrev={() => handleNavigateCheck(1)}
                          onNext={() => handleNavigateCheck(3)}
                          isTraderVersion={isTraderVersion}
                          savedTradersList={savedTradersList}
                          onTraderChange={handleTraderChange}
                          onDateChange={(d, m, y) => handleDateChange(d, m, y)}
                          onLoadInventory={handleLoadFullInventory}
                          globalHistoryLogs={globalHistoryLogs}
                        />
                      )}

                      {screen === 3 && (
                        <Screen3
                          traderName={traderName}
                          currentMonth={currentMonth}
                          categories={categories}
                          inventory={computedTotalInventory}
                          remaining={remaining}
                          onRemainingChange={handleRemainingChange}
                          onPrev={() => handleNavigateCheck(2)}
                          onNext={() => handleNavigateCheck(4)}
                          onShowToast={handleShowToast}
                        />
                      )}

                      {screen === 4 && (
                        <Screen4
                          traderName={traderName}
                          currentMonth={currentMonth}
                          categories={categories}
                          inventory={computedTotalInventory}
                          remaining={remaining}
                          discountPercentage={discountPercentage}
                          selectedDayName={selectedDayName}
                          selectedTimeStr={selectedTimeStr}
                          onApplyDiscount={handleApplyDiscount}
                          onSaveAndFinish={handleSaveAndFinish}
                          onPrev={() => handleNavigateCheck(3)}
                          isTraderVersion={isTraderVersion}
                          onOpenPreview={handleOpenPreview}
                        />
                      )}
                    </>
                  );
                })()}

                {screen === 5 && (
                  <Screen5
                    appData={serializeState()}
                    categories={categories}
                    isTraderVersion={isTraderVersion}
                    onPrev={() => handleNavigateCheck(5)} // Cycles back within Screen 5
                    onNavigateToScreen={handleNavigateCheck}
                    onResetForAnotherTrader={handleResetForAnotherTrader}
                    onOpenPreview={handleOpenPreview}
                    onUpdateMonthForTrader={handleUpdateMonthForTrader}
                  />
                )}

                {screen === 6 && (
                  <Screen6
                    appData={serializeState()}
                    categories={categories}
                    isTraderVersion={isTraderVersion}
                    onNavigateToScreen={handleNavigateCheck}
                    onClearMonthlyDataOnly={handleClearMonthlyDataOnly}
                    onClearTradersListOnly={handleClearTradersListOnly}
                    onClearTraderArchiveOnly={handleClearTraderArchiveOnly}
                    onOpenPreview={handleOpenPreview}
                    onFactoryReset={handleFactoryReset}
                    onOpenInstallGuide={() => setShowPwaGuide(true)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Global Toast Message alerts */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Live Preview Dialog viewport */}
      <LivePreviewModal
        showPreviewModal={showPreviewModal}
        onClosePreviewModal={() => setShowPreviewModal(false)}
        previewAreaId={previewAreaId}
        previewExportType={previewExportType}
        previewFileName={previewFileName}
      />

      {/* PWA Install & Android Keystore Guide Modal */}
      <PwaInstallGuideModal
        showModal={showPwaGuide}
        onClose={() => setShowPwaGuide(false)}
        deferredPrompt={deferredPrompt}
        onTriggerInstall={handleTriggerInstall}
      />
    </div>
  );
}
