import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';

import { AppSettingsService } from '../app-settings/app-settings.service';

type StorageMode = 'session' | 'local' | 'indexedDB';

const STORE_NAME = '__ZELL__STORE__APP__';

// Built once: a 32-byte AES-256 key and a 16-byte CBC IV.
const KEY = Utf8.parse('ZELL_ENCRYPT@1234'.padEnd(32, '0'));
const IV = Utf8.parse('ZELL_ENCRYPT@1234IV'.slice(0, 16));

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly appSetting = inject(AppSettingsService);
  private readonly win = inject(DOCUMENT).defaultView;

  private readonly mode: StorageMode = 'session';
  private dbPromise?: Promise<IDBDatabase | null>;

  async set(key: string, value: unknown): Promise<boolean> {
    try {
      const k = this.encrypt(key);
      const v = this.encrypt(value);
      const db = await this.getDb();

      if (db) {
        await this.run(db, 'readwrite', (store) => store.put(v, k));
      } else {
        this.webStorage?.setItem(k, v);
      }
      return true;
    } catch (error) {
      console.error('Error setting data:', error);
      return false;
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const k = this.encrypt(key);
      const db = await this.getDb();

      const cipher: string | null | undefined = db
        ? await this.run(db, 'readonly', (store) => store.get(k))
        : this.webStorage?.getItem(k);

      return cipher ? this.decrypt<T>(cipher) : null;
    } catch (error) {
      console.error('Error getting data:', error);
      return null;
    }
  }

  async remove(key: string): Promise<boolean> {
    try {
      const k = this.encrypt(key);
      const db = await this.getDb();

      if (db) {
        await this.run(db, 'readwrite', (store) => store.delete(k));
      } else {
        this.win?.localStorage.removeItem(k);
        this.win?.sessionStorage.removeItem(k);
      }
      return true;
    } catch (error) {
      console.error('Error removing data:', error);
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      const db = await this.getDb();

      if (db) {
        await this.run(db, 'readwrite', (store) => store.clear());
      } else {
        this.win?.localStorage.clear();
        this.win?.sessionStorage.clear();
      }
      return true;
    } catch (error) {
      console.error('Error clearing data:', error);
      return false;
    }
  }

  // ---------- encryption ----------

  private encrypt(value: unknown): string {
    return AES.encrypt(JSON.stringify(value ?? null), KEY, { iv: IV }).toString();
  }

  private decrypt<T>(cipherText: string): T {
    const json = AES.decrypt(cipherText, KEY, { iv: IV }).toString(Utf8);
    return JSON.parse(json) as T;
  }

  // ---------- web storage ----------

  private get webStorage(): Storage | undefined {
    return this.mode === 'local' ? this.win?.localStorage : this.win?.sessionStorage;
  }

  // ---------- IndexedDB (lazy, opened once) ----------

  private getDb(): Promise<IDBDatabase | null> {
    if (this.mode !== 'indexedDB') {
      return Promise.resolve(null);
    }
    return (this.dbPromise ??= this.openDatabase());
  }

  private async openDatabase(): Promise<IDBDatabase | null> {
    const factory = this.win?.indexedDB;
    if (!factory) {
      console.error('IndexedDB not supported in this browser.');
      return null;
    }

    const dbName = this.appSetting.environment.dbName;
    if (!dbName) {
      console.error('dbName is missing in app.settings.json');
      return null;
    }

    try {
      let db = await this.open(factory, dbName);
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const nextVersion = db.version + 1;
        db.close();
        db = await this.open(factory, dbName, nextVersion);
      }
      return db;
    } catch (error) {
      console.error('Error opening or upgrading database:', error);
      return null;
    }
  }

  private open(factory: IDBFactory, name: string, version?: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = factory.open(name, version);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** Runs one request inside a transaction and resolves with its result. */
  private run<T>(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const request = op(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}