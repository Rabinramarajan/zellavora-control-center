import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { StorageService } from '../storage/storage.service';
import { AppSettingsService } from '../app-settings/app-settings.service';

@Injectable({
  providedIn: 'root'
})
export class AesService {

  local: any = '_Admin_Web';
  constructor(public storage: StorageService, public appSetting: AppSettingsService) { }

  async encrypt(text: any) {
    return new Promise(async (resolve, reject) => {
      if (this.appSetting.environment.encrypt === false) {
        resolve(text);
        return;
      }

     await this.storage.get('encryptkey').then((val: any) => {
        if (val) {
          let Key = CryptoJS.enc.Utf8.parse(val[0]);
          let IV = CryptoJS.enc.Utf8.parse(val[1]);
          let encryptedText = CryptoJS.AES.encrypt(text, Key, {
            iv: IV,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          });
          resolve(encryptedText.toString());
          // return;
        } else {
          resolve(text);
          // return;
        }
      });
    });
  }


  async localencrypt(text: any) {
    return new Promise((resolve, reject) => {
      let en = CryptoJS.AES.encrypt(text.toString(), this.local).toString();
      resolve(en);
      return;
    });
  }

  async localdecrypt(text: any) {
    return new Promise((resolve, reject) => {
      let en = CryptoJS.AES.decrypt(text, this.local).toString(CryptoJS.enc.Utf8);
      resolve(en);
      return;
    });
  }
}