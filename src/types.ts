export interface Category {
  label: string;
  color: string;
  value: number;
}

export interface ArchiveEntry {
  traderName: string;
  period: string; // e.g. "شهر 6 - 2026"
  totalSales: number;
  discountRate: number;
  discountVal: number;
  netAmount: number;
  timestamp: string;
  categoriesSnapshot: Category[];
  inventorySnapshot: Record<string, number>;
  remainingSnapshot: Record<string, number>;
  midMonthSnapshot?: Record<string, number>;
}

export interface TraderLog {
  name: string;
  finalAmount: number;
  period: string;
}

export interface PeriodHistoryLogs {
  inventory: Record<string, number>;
  remaining: Record<string, number>;
  midMonth?: Record<string, number>;
  discountPercentage?: number;
  categories?: Category[];
}

export interface AppData {
  isTraderVersion: boolean;
  traderName: string;
  savedTradersList: string[];
  currentMonth: string; // e.g. "شهر 6 - 2026"
  selectedMonthNum: string;
  selectedYearNum: string;
  selectedDayNum?: string;
  selectedDayName?: string;
  selectedTimeStr?: string;
  discountPercentage: number;
  categories: Category[];
  inventory: Record<string, number>;
  remaining: Record<string, number>;
  midMonth?: Record<string, number>;
  savedTradersLog: TraderLog[];
  traderArchive: Record<string, ArchiveEntry>;
  globalHistoryLogs: Record<string, PeriodHistoryLogs>;
}

declare global {
  interface Window {
    AppConfig?: {
      API_KEY?: string;
      offlineMode?: boolean;
      appVersion?: string;
      enablePersistentStorage?: boolean;
    };
  }
}

