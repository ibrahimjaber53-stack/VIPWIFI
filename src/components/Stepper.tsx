import React from 'react';

interface StepperProps {
  currentScreen: number;
  isTraderVersion: boolean;
  onNavigate: (screenNum: number) => void;
}

export default function Stepper({ currentScreen, isTraderVersion, onNavigate }: StepperProps) {
  const steps = isTraderVersion
    ? [
        { id: 2, num: 1, name: 'المخزون' },
        { id: 3, num: 2, name: 'المتبقي' },
        { id: 4, num: 3, name: 'المستحق' },
        { id: 5, num: 4, name: 'التقارير' },
        { id: 6, num: 5, name: 'التحكم' },
      ]
    : [
        { id: 1, num: 1, name: 'الإعداد' },
        { id: 2, num: 2, name: 'المخزون' },
        { id: 3, num: 3, name: 'المتبقي' },
        { id: 4, num: 4, name: 'المستحق' },
        { id: 5, num: 5, name: 'التقارير' },
        { id: 6, num: 6, name: 'التحكم' },
      ];

  const gridColsClass = isTraderVersion ? 'grid-cols-5' : 'grid-cols-6';

  return (
    <div dir="rtl" className={`max-w-md mx-auto grid ${gridColsClass} gap-1 bg-slate-50 p-2 rounded-2xl border border-slate-200 shadow-2xs text-center items-center justify-center`}>
      {steps.map((step) => {
        const isActive = currentScreen === step.id;
        return (
          <button
            key={step.id}
            onClick={() => onNavigate(step.id)}
            className="flex flex-col items-center justify-center w-full py-2 px-0.5 text-center group cursor-pointer focus:outline-none"
          >
            <span
              className={`w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full border transition mb-1 shadow-2xs ${
                isActive
                  ? 'border-indigo-950 bg-indigo-950 text-white transform scale-110 font-black'
                  : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400'
              }`}
            >
              {step.num}
            </span>
            <span
              className={`text-[9.5px] font-bold block leading-normal mt-0.5 ${
                isActive ? 'text-indigo-950 font-black' : 'text-slate-500'
              }`}
            >
              {step.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
