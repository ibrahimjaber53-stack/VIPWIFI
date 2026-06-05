import React from 'react';
import { LogOut, X, LayoutDashboard, Database, RefreshCw, BarChart3, Receipt, FileText, Smartphone } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentScreen: number;
  isTraderVersion: boolean;
  onNavigate: (screenNum: number) => void;
  traderName: string;
  onOpenInstallGuide: () => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  currentScreen,
  isTraderVersion,
  onNavigate,
  traderName,
  onOpenInstallGuide,
}: SidebarProps) {
  const handleExitApp = () => {
    if (confirm("هل تريد الخروج من البرنامج فعلاً؟")) {
      try {
        const nav = window.navigator as any;
        if (nav && nav.app && typeof nav.app.exitApp === 'function') {
          nav.app.exitApp();
        } else if ((window as any).device && typeof (window as any).device.exitApp === 'function') {
          (window as any).device.exitApp();
        } else {
          window.close();
          // Android System Webview fallback info
          alert("📋 للخروج تماماً، الرجاء استخدام زر الخرُوج أو زر الشاشة الرئيسية للجهاز.");
        }
      } catch (err) {
        window.close();
      }
    }
  };

  const navItems = isTraderVersion
    ? [
        { id: 2, label: '📊 مخزون الكروت', icon: <Database className="w-5 h-5 ml-1.5" /> },
        { id: 3, label: '📉 جرد الكروت المتبقية', icon: <RefreshCw className="w-5 h-5 ml-1.5" /> },
        { id: 4, label: '💰 صافي المستحق من التاجر', icon: <Receipt className="w-5 h-5 ml-1.5" /> },
        { id: 5, label: '📂 إحصائيات', icon: <FileText className="w-5 h-5 ml-1.5" /> },
        { id: 6, label: '⚙️ لوحة التحكم', icon: <BarChart3 className="w-5 h-5 ml-1.5" /> },
      ]
    : [
        { id: 1, label: '⚙️ إدخال بيانات التاجر والفئات', icon: <LayoutDashboard className="w-5 h-5 ml-1.5" /> },
        { id: 2, label: '📊 مخزون الكروت', icon: <Database className="w-5 h-5 ml-1.5" /> },
        { id: 3, label: '📉 جرد الكروت المتبقية', icon: <RefreshCw className="w-5 h-5 ml-1.5" /> },
        { id: 4, label: '💰 صافي المستحق من التاجر', icon: <Receipt className="w-5 h-5 ml-1.5" /> },
        { id: 5, label: '📂 إحصائيات', icon: <FileText className="w-5 h-5 ml-1.5" /> },
        { id: 6, label: '⚙️ لوحة التحكم', icon: <BarChart3 className="w-5 h-5 ml-1.5" /> },
      ];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 transition-opacity duration-300"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-72 z-55 transition-transform duration-300 ease-in-out flex flex-col justify-between p-5 bg-slate-950/0 border-0 shadow-none backdrop-blur-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ direction: 'rtl' }}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-200/20 flex-row">
            <div className="flex flex-col text-right">
              <span className="text-xs font-black text-white/95 tracking-wide">برنامج حسابات الكروت</span>
              <span className="text-[10px] font-bold text-blue-400 bg-blue-950/40 px-1.5 py-0.5 rounded mt-1 w-max">
                {isTraderVersion ? `التاجر: ${traderName || 'العميل'}` : 'حساب كروت الواي فاي'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-450 p-2 transition cursor-pointer mobile-touch-target bg-transparent border-0"
              id="close-sidebar-btn"
              aria-label="إغلاق القائمة"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex flex-col space-y-3.5 text-right w-full items-start">
            {navItems.map((item) => {
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`w-max text-right font-black text-[13.5px] transition flex items-center justify-start gap-2.5 cursor-pointer mobile-touch-target bg-transparent border-0 outline-none p-0 ${
                    isActive
                      ? 'text-blue-500 font-extrabold'
                      : 'text-white hover:text-blue-400'
                  }`}
                  id={`nav-item-${item.id}`}
                >
                  <span className={`transition-colors shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-400'}`}>
                    {item.icon}
                  </span>
                  <span className="leading-none text-right">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-4 border-t border-indigo-200/20 pt-4">
          <div className="text-center text-xs">
            <p className="font-bold text-green-500 text-[11px]">إعداد وتصميم</p>
            <p className="font-black text-white text-sm mt-0.5">م/ ابراهيم جابر</p>
          </div>
          <button
            onClick={handleExitApp}
            className="w-full bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-900/45 font-extrabold p-3 rounded-xl text-xs transition shadow-2xs flex items-center justify-center space-x-2 space-x-reverse cursor-pointer mobile-touch-target"
            id="sidebar-exit-btn"
          >
            <LogOut className="w-4 h-4 ml-1.5 shrink-0" />
            <span>🚪 الخروج من البرنامج</span>
          </button>
        </div>
      </div>
    </>
  );
}
