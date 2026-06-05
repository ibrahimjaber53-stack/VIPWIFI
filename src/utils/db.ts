/**
 * IndexedDB Local Storage Wrapper for VIP WiFi App.
 * This file replaces the limited localStorage (5MB) with IndexedDB
 * offering unlimited, durable phone storage space, completely offline.
 */

const DB_NAME = 'vip_wifi_indexed_db';
const STORE_NAME = 'keyvalue_store';
const DB_VERSION = 1;

class IndexedDBWrapper {
  private cache: Record<string, string> = {};
  public isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor() {
    this.loadPromise = this.init();
  }

  public async init(): Promise<void> {
    if (this.isLoaded) return;
    
    return new Promise((resolve, reject) => {
      // Create or open the DB safely
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn("[IndexedDB] Not supported on this environment. Falling back to memory/local storage.");
        this.isLoaded = true;
        resolve();
        return;
      }

      let request: IDBOpenDBRequest;
      try {
        request = window.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        console.error("IndexedDB open failed, falling back to empty storage", err);
        this.isLoaded = true;
        resolve();
        return;
      }

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const keysReq = store.getAllKeys();
          
          keysReq.onsuccess = () => {
            const keys = keysReq.result;
            const valsReq = store.getAll();
            
            valsReq.onsuccess = () => {
              const vals = valsReq.result;
              this.cache = {};
              keys.forEach((key, idx) => {
                this.cache[key.toString()] = vals[idx] !== undefined ? vals[idx] : '';
              });
              this.isLoaded = true;
              console.log(`[IndexedDB] Loaded ${keys.length} items to memory cache successfully.`);
              resolve();
            };
            
            valsReq.onerror = () => {
              console.warn("[IndexedDB] Failed to load values, starting empty");
              this.isLoaded = true;
              resolve();
            };
          };

          keysReq.onerror = () => {
            console.warn("[IndexedDB] Failed to load keys, starting empty");
            this.isLoaded = true;
            resolve();
          };
        } catch (err) {
          console.warn("[IndexedDB] Transaction error, starting empty", err);
          this.isLoaded = true;
          resolve();
        }
      };

      request.onerror = (event) => {
        console.warn("[IndexedDB] Database open error. Offline fallback active.", event);
        this.isLoaded = true;
        resolve();
      };
    });
  }

  public getReadyPromise(): Promise<void> {
    return this.loadPromise || Promise.resolve();
  }

  public getItem(key: string): string | null {
    return this.cache[key] !== undefined ? this.cache[key] : null;
  }

  public setItem(key: string, value: string): void {
    const stringVal = String(value);
    this.cache[key] = stringVal;
    
    // Async save to IndexedDB database safely
    if (typeof window === 'undefined' || !window.indexedDB) {
      // Memory cache is already updated, offline backup via localstorage if possible
      try {
        localStorage.setItem(key, stringVal);
      } catch (e) {}
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put(stringVal, key);
        } catch (e) {
          console.error("[IndexedDB] Error setting item in transaction:", e);
        }
      };
    } catch (err) {
      console.error("[IndexedDB] Error setting item:", err);
    }
  }

  public removeItem(key: string): void {
    delete this.cache[key];
    
    // Async remove from IndexedDB safely
    if (typeof window === 'undefined' || !window.indexedDB) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.delete(key);
        } catch (e) {
          console.error("[IndexedDB] Error removing item inside transaction:", e);
        }
      };
    } catch (err) {
      console.error("[IndexedDB] Error removing item:", err);
    }
  }

  public clear(): void {
    this.cache = {};
    
    // Async clear IndexedDB safely
    if (typeof window === 'undefined' || !window.indexedDB) {
      try {
        localStorage.clear();
      } catch (e) {}
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.clear();
        } catch (e) {
          console.error("[IndexedDB] Error clearing database inside transaction:", e);
        }
      };
    } catch (err) {
      console.error("[IndexedDB] Error clearing database:", err);
    }
  }

  public key(index: number): string | null {
    const keys = Object.keys(this.cache);
    return keys[index] || null;
  }

  public get length(): number {
    return Object.keys(this.cache).length;
  }

  // Exports all key-values as a compressed stringified JSON backup
  public getBackupString(): string {
    return JSON.stringify(this.cache);
  }

  // Restore cache and database from backup string
  public restoreFromBackup(backupStr: string): boolean {
    try {
      const parsed = JSON.parse(backupStr);
      if (typeof parsed !== 'object' || parsed === null) return false;
      
      this.cache = {};
      if (typeof window === 'undefined' || !window.indexedDB) {
        Object.keys(parsed).forEach(key => {
          this.cache[key] = String(parsed[key]);
        });
        return true;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.clear();
          
          Object.keys(parsed).forEach(key => {
            const val = String(parsed[key]);
            this.cache[key] = val;
            store.put(val, key);
          });
          console.log("[IndexedDB] Succesfully restored database backup.");
        } catch (e) {
          console.error("[IndexedDB] Error executing restore database transaction", e);
        }
      };
      return true;
    } catch (err) {
      console.error("[IndexedDB] Failed to restore from backup string:", err);
      return false;
    }
  }
}

// Global Singleton
export const LocalDB = new IndexedDBWrapper();
// Set on window for global access/debugging
if (typeof window !== 'undefined') {
  (window as any).LocalDB = LocalDB;
}
