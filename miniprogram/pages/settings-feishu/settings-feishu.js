// pages/settings-feishu/settings-feishu.js
const request = require('../../utils/request');

Page({
  data: {
    // 配置状态
    isConfigured: false,
    isEnabled: false,
    isConnected: false,
    lastSyncAt: '',

    // 表单数据
    documentUrl: '',
    appId: '',
    appSecret: '',

    // 同步选项
    syncOptions: {
      time: true,
      duration: true,
      text: true,
      audio: true,
    },

    // 测试状态
    testing: false,
    saving: false,
    testResult: '',
    testSuccess: false,

    // 弹窗状态
    showDocumentHelpModal: false,
    showAppHelpModal: false,

    // 原始配置（用于判断是否修改）
    originalConfig: null,
  },

  onLoad() {
    this.loadConfig();
  },

  // 加载配置
  loadConfig() {
    wx.showLoading({ title: '加载中...', mask: true });

    request.get('/feishu/config').then((res) => {
      if (res.success && res.data) {
        const configured = res.data.configured;
        const config = res.data.config;

        if (configured && config) {
          // 从 documentUrl 中提取 documentId
          const documentId = config.documentId || '';

          this.setData({
            isConfigured: true,
            isEnabled: config.isEnabled,
            documentUrl: documentId,
            appId: config.appId || '',
            appSecret: '', // 不显示原密码
            lastSyncAt: config.lastSyncAt ? this.formatTime(config.lastSyncAt) : '',
            isConnected: config.isEnabled,
            originalConfig: config,
          });
        }
      }
    }).catch((error) => {
      console.error('加载配置失败:', error);
    }).finally(() => {
      wx.hideLoading();
    });
  },

  // 格式化时间
  formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60 * 1000) {
      return '刚刚';
    } else if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))}分钟前`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
    } else {
      return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;
    }
  },

  // 开关切换
  onEnabledChange(e) {
    const enabled = e.detail.value;

    if (!this.data.isConfigured) {
      wx.showToast({ title: '请先保存飞书配置', icon: 'none' });
      this.setData({ isEnabled: false });
      return;
    }

    this.setData({ isEnabled: enabled });

    // 保存配置
    this.saveConfigInternal({ isEnabled: enabled });
  },

  // 输入框输入
  onDocumentUrlInput(e) {
    this.setData({ documentUrl: e.detail.value });
  },

  onAppIdInput(e) {
    this.setData({ appId: e.detail.value });
  },

  onAppSecretInput(e) {
    this.setData({ appSecret: e.detail.value });
  },

  // 同步选项切换
  onSyncOptionsChange(e) {
    const values = e.detail.value;
    this.setData({
      syncOptions: {
        time: values.indexOf('time') >= 0,
        duration: values.indexOf('duration') >= 0,
        text: values.indexOf('text') >= 0,
        audio: values.indexOf('audio') >= 0,
      },
    });
  },

  // 从文档链接中提取 documentId
  extractDocumentId(url) {
    if (!url) return '';

    // 匹配各种飞书文档链接格式
    const patterns = [
      /\/docx\/([a-zA-Z0-9]+)/,
      /docx\/([a-zA-Z0-9]+)/,
      /documentId=([a-zA-Z0-9]+)/,
    ];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // 如果直接输入的是 documentId，直接返回
    if (/^[a-zA-Z0-9_-]+$/.test(url)) {
      return url;
    }

    return '';
  },

  // 测试连接
  testConnection() {
    const documentUrl = this.data.documentUrl;
    const appId = this.data.appId;
    const appSecret = this.data.appSecret;

    // 验证输入
    if (!documentUrl) {
      wx.showToast({ title: '请输入文档链接', icon: 'none' });
      return;
    }

    if (!appId) {
      wx.showToast({ title: '请输入 App ID', icon: 'none' });
      return;
    }

    if (!appSecret) {
      wx.showToast({ title: '请输入 App Secret', icon: 'none' });
      return;
    }

    const documentId = this.extractDocumentId(documentUrl);
    if (!documentId) {
      wx.showToast({ title: '文档链接格式不正确', icon: 'none' });
      return;
    }

    this.setData({
      testing: true,
      testResult: '',
      testSuccess: false,
    });

    // 临时保存配置用于测试
    request.post('/feishu/config', {
      documentId,
      appId,
      appSecret,
      isEnabled: false,
    }).then(() => {
      // 测试连接
      return request.post('/feishu/test');
    }).then((testRes) => {
      if (testRes.success) {
        this.setData({
          testResult: testRes.message || '连接成功',
          testSuccess: true,
          isConnected: true,
        });
      } else {
        this.setData({
          testResult: testRes.message || '连接失败',
          testSuccess: false,
          isConnected: false,
        });
      }
    }).catch((error) => {
      this.setData({
        testResult: error.message || '连接失败，请检查配置',
        testSuccess: false,
        isConnected: false,
      });
    }).finally(() => {
      this.setData({ testing: false });
    });
  },

  // 保存配置
  saveConfig() {
    if (!this.data.testSuccess) {
      wx.showToast({ title: '请先测试连接', icon: 'none' });
      return;
    }

    this.saveConfigInternal({
      isEnabled: this.data.isEnabled,
    });

    wx.showToast({ title: '保存成功', icon: 'success' });

    setTimeout(() => {
      this.goBack();
    }, 1000);
  },

  // 内部保存方法
  saveConfigInternal(options) {
    const documentUrl = this.data.documentUrl;
    const appId = this.data.appId;
    const appSecret = this.data.appSecret;
    const syncOptions = this.data.syncOptions;
    const originalConfig = this.data.originalConfig;

    const documentId = this.extractDocumentId(documentUrl);

    this.setData({ saving: true });

    const isEnabled = options.isEnabled !== undefined ? options.isEnabled : this.data.isEnabled;
    const finalAppSecret = appSecret || (originalConfig && originalConfig.appSecret) || '';

    request.post('/feishu/config', {
      documentId,
      appId,
      appSecret: finalAppSecret,
      isEnabled: isEnabled,
      syncOptions,
    }).then(() => {
      this.setData({
        isConfigured: true,
      });
    }).catch((error) => {
      console.error('保存配置失败:', error);
    }).finally(() => {
      this.setData({ saving: false });
    });
  },

  // 显示文档链接帮助
  showDocumentHelp() {
    this.setData({ showDocumentHelpModal: true });
  },

  hideDocumentHelp() {
    this.setData({ showDocumentHelpModal: false });
  },

  // 显示应用凭证帮助
  showAppHelp() {
    this.setData({ showAppHelpModal: true });
  },

  hideAppHelp() {
    this.setData({ showAppHelpModal: false });
  },

  // 打开飞书开放平台
  openFeishuPlatform() {
    wx.showModal({
      title: '提示',
      content: '请在电脑浏览器中访问：open.feishu.cn',
      showCancel: false,
    });
  },

  // 阻止冒泡
  stopPropagation() {
    // 阻止事件冒泡
  },

  // 返回
  goBack() {
    wx.navigateBack();
  },
});
