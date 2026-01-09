// 微信小程序 API 类型定义

interface App {
  globalData: {
    userInfo: any;
    token: string | null;
    apiBase: string;
  };
  setLoginInfo(token: string, userInfo: any): void;
  clearLoginInfo(): void;
}

interface Wx {
  getStorageSync(key: string): any;
  setStorageSync(key: string, data: any): void;
  removeStorageSync(key: string): void;
  request(options: WxRequestOptions): void;
  uploadFile(options: WxUploadFileOptions): WxUploadTask;
  getRecorderManager(): WxRecorderManager;
  createInnerAudioContext(): WxInnerAudioContext;
  getSetting(options: WxSettingOptions): void;
  authorize(options: WxAuthorizeOptions): void;
  openSetting(options?: WxOpenSettingOptions): void;
  getSystemInfoSync(): WxSystemInfo;
  showToast(options: WxToastOptions): void;
  showLoading(options: WxLoadingOptions): void;
  hideLoading(): void;
  hideToast(): void;
  showModal(options: WxModalOptions): void;
  navigateTo(options: WxNavigateOptions): void;
  redirectTo(options: WxNavigateOptions): void;
  switchTab(options: WxNavigateOptions): void;
  navigateBack(options?: WxNavigateBackOptions): void;
  canIUse(api: string): boolean;
  getUpdateManager(): WxUpdateManager;
  stopPullDownRefresh(): void;
}

interface WxRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: any;
  success?(res: any): void;
  fail?(err: any): void;
  complete?(): void;
}

interface WxUploadFileOptions {
  url: string;
  filePath: string;
  name: string;
  header?: any;
  formData?: any;
  success?(res: any): void;
  fail?(err: any): void;
}

interface WxUploadTask {
  abort(): void;
  onProgressUpdate(callback: (res: any) => void): void;
}

interface WxRecorderManager {
  start(options: WxRecorderStartOptions): void;
  stop(): void;
  pause(): void;
  resume(): void;
  onStop(callback: (res: WxRecorderResult) => void): void;
}

interface WxRecorderStartOptions {
  duration?: number;
  format?: 'mp3' | 'aac';
  sampleRate?: number;
}

interface WxRecorderResult {
  tempFilePath: string;
  duration: number;
  fileSize: number;
}

interface WxInnerAudioContext {
  src: string;
  play(): void;
  pause(): void;
  stop(): void;
  seek(position: number): void;
  destroy(): void;
  onEnded(callback: () => void): void;
  onError(callback: (res: any) => void): void;
}

interface WxSettingOptions {
  success?(res: { authSetting: Record<string, boolean> }): void;
  fail?(err: any): void;
}

interface WxAuthorizeOptions {
  scope: string;
  success?(): void;
  fail?(err: any): void;
}

interface WxOpenSettingOptions {
  success?(res: { authSetting: Record<string, boolean> }): void;
}

interface WxSystemInfo {
  windowWidth: number;
  windowHeight: number;
  pixelRatio: number;
  platform: string;
}

interface WxToastOptions {
  title: string;
  icon?: 'success' | 'error' | 'loading' | 'none';
  duration?: number;
  mask?: boolean;
}

interface WxLoadingOptions {
  title: string;
  mask?: boolean;
}

interface WxModalOptions {
  title?: string;
  content: string;
  showCancel?: boolean;
  cancelText?: string;
  confirmText?: string;
  success?(res: { confirm: boolean; cancel: boolean }): void;
}

interface WxNavigateOptions {
  url: string;
}

interface WxNavigateBackOptions {
  delta?: number;
}

interface WxUpdateManager {
  onCheckForUpdate(callback: (res: { hasUpdate: boolean }) => void): void;
  onUpdateReady(callback: () => void): void;
  onUpdateFailed(callback: () => void): void;
  applyUpdate(): void;
}

declare const wx: Wx;
declare const getApp: () => App;

declare const Page: (options: any) => void;
declare const App: (options: any) => void;
