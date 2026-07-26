import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private useLocalStorage = this.isLocalStorageAvailable();

  setItem(key: string, value: string): void {
    try {
      if (this.useLocalStorage) {
        localStorage.setItem(key, value);
      } else {
        sessionStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('Storage error:', error);
    }
  }

  getItem(key: string): string | null {
    try {
      if (this.useLocalStorage) {
        return localStorage.getItem(key);
      }
      return sessionStorage.getItem(key);
    } catch (error) {
      console.error('Storage error:', error);
      return null;
    }
  }

  removeItem(key: string): void {
    try {
      if (this.useLocalStorage) {
        localStorage.removeItem(key);
      } else {
        sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Storage error:', error);
    }
  }

  clear(): void {
    try {
      if (this.useLocalStorage) {
        localStorage.clear();
      } else {
        sessionStorage.clear();
      }
    } catch (error) {
      console.error('Storage error:', error);
    }
  }

  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}
