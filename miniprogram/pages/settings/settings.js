// pages/settings/settings.js
const request = require('../../utils/request');

const app = getApp();

Page({
  data: {
    userInfo: {
      phone: '',
      email: '',
      avatarUrl: '',
    },
    feishuConfigured: false,
    feishuEnabled: false,
    lastSyncAt: '',

    // 语音设置选项
    qualityOptions: [
      { label: '标准（16kHz，省流量）', value: 'standard' },
      { label: '高清（48kHz）', value: 'hd' },
    ],
    qualityIndex: 0,

    playModeOptions: [
      { label: '自动（距离感应）', value: 'auto' },
      { label: '始终扬声器', value: 'speaker' },
      { label: '始终听筒', value: 'earpiece' },
    ],
    playModeIndex: 0,

    // 存储信息
    cacheSize: '0 MB',
    storageUsed: '计算中...',

    // 修改密码弹窗
    showPasswordModal: false,
    passwordForm: {
      old: '',
      new: '',
      confirm: '',
    },
    passwordSubmitting: false,

    // 头像上传
    uploadingAvatar: false,
  },

  onLoad() {
    // 检查登录状态
    if (!app.globalData.token) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: '/pages/login/login',
          });
        },
      });
      return;
    }

    // 加载用户信息
    this.loadUserInfo();

    // 加载设置
    this.loadSettings();

    // 计算缓存大小
    this.calculateCacheSize();
  },

  onShow() {
    // 页面显示时刷新设置
    if (app.globalData.token) {
      this.loadSettings();
    }
  },

  // 加载用户信息
  loadUserInfo() {
    console.log('开始加载用户信息');
    console.log('Token:', app.globalData.token ? '存在' : '不存在');
    console.log('API Base:', app.globalData.apiBase);

    request.get('/auth/me').then((res) => {
      console.log('获取用户信息成功:', res);
      if (res.success && res.data) {
        this.setData({
          userInfo: res.data.user,
        });
        // 更新全局用户信息
        app.globalData.userInfo = res.data.user;
        wx.setStorageSync('userInfo', res.data.user);
      }
    }).catch((error) => {
      console.error('加载用户信息失败:', error);
      wx.showToast({
        title: error.message || '获取用户信息失败',
        icon: 'none',
        duration: 2000
      });
    });
  },

  // 选择头像
  chooseAvatar() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        that.uploadAvatar(tempFilePath);
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
      },
    });
  },

  // 上传头像
  uploadAvatar(filePath) {
    const that = this;

    if (this.data.uploadingAvatar) {
      return;
    }

    console.log('开始上传头像:', filePath);

    this.setData({ uploadingAvatar: true });
    wx.showLoading({ title: '上传中...', mask: true });

    const hideLoading = () => {
      wx.hideLoading();
      that.setData({ uploadingAvatar: false });
    };

    wx.uploadFile({
      url: `${app.globalData.apiBase}/auth/avatar`,
      filePath: filePath,
      name: 'avatar',
      header: {
        Authorization: `Bearer ${app.globalData.token}`,
      },
      success: (uploadRes) => {
        console.log('上传响应状态码:', uploadRes.statusCode);
        console.log('上传响应数据:', uploadRes.data);
        hideLoading();

        if (uploadRes.statusCode !== 200) {
          wx.showToast({ title: `服务器错误: ${uploadRes.statusCode}`, icon: 'none' });
          return;
        }

        try {
          const data = JSON.parse(uploadRes.data);
          if (data.success) {
            // 更新用户信息
            that.setData({
              'userInfo.avatarUrl': data.data.avatarUrl,
            });

            // 更新全局用户信息
            app.globalData.userInfo.avatarUrl = data.data.avatarUrl;
            wx.setStorageSync('userInfo', app.globalData.userInfo);

            wx.showToast({ title: '头像上传成功', icon: 'success' });
          } else {
            wx.showToast({ title: data.message || '上传失败', icon: 'none' });
          }
        } catch (e) {
          console.error('解析响应失败:', e, uploadRes.data);
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('上传失败:', err);
        hideLoading();
        wx.showToast({ title: err.errMsg || '上传失败', icon: 'none' });
      },
    });
  },

  // 加载设置
  loadSettings() {
    // 加载飞书配置
    request.get('/feishu/config').then((res) => {
      if (res.success && res.data) {
        this.setData({
          feishuConfigured: res.data.configured,
          feishuEnabled: res.data.config && res.data.config.isEnabled || false,
          lastSyncAt: res.data.config && res.data.config.lastSyncAt ? this.formatTime(res.data.config.lastSyncAt) : '',
        });
      }
    }).catch((error) => {
      console.error('加载飞书配置失败:', error);
    });

    // 加载语音设置
    const quality = wx.getStorageSync('audioQuality') || 'standard';
    const qualityIndex = this.data.qualityOptions.findIndex((item) => item.value === quality);
    this.setData({ qualityIndex: qualityIndex >= 0 ? qualityIndex : 0 });

    const playMode = wx.getStorageSync('playMode') || 'auto';
    const playModeIndex = this.data.playModeOptions.findIndex((item) => item.value === playMode);
    this.setData({ playModeIndex: playModeIndex >= 0 ? playModeIndex : 0 });
  },

  // 计算缓存大小
  calculateCacheSize() {
    try {
      const res = wx.getStorageInfoSync();
      const size = res.currentSize;
      this.setData({
        cacheSize: size < 1024 ? `${size} KB` : `${(size / 1024).toFixed(1)} MB`,
      });
    } catch (error) {
      console.error('计算缓存失败:', error);
    }
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

  // 修改密码
  changePassword() {
    this.setData({
      showPasswordModal: true,
      passwordForm: { old: '', new: '', confirm: '' },
    });
  },

  hidePasswordModal() {
    this.setData({ showPasswordModal: false });
  },

  stopPropagation() {
    // 阻止事件冒泡
  },

  onOldPasswordInput(e) {
    this.setData({ 'passwordForm.old': e.detail.value });
  },

  onNewPasswordInput(e) {
    this.setData({ 'passwordForm.new': e.detail.value });
  },

  onConfirmPasswordInput(e) {
    this.setData({ 'passwordForm.confirm': e.detail.value });
  },

  submitPassword() {
    const { old, new: newPassword, confirm } = this.data.passwordForm;

    if (!old) {
      wx.showToast({ title: '请输入原密码', icon: 'none' });
      return;
    }

    if (!newPassword) {
      wx.showToast({ title: '请输入新密码', icon: 'none' });
      return;
    }

    // 验证密码格式
    if (newPassword.length < 8) {
      wx.showToast({ title: '密码长度至少为8位', icon: 'none' });
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      wx.showToast({ title: '密码必须包含字母和数字', icon: 'none' });
      return;
    }

    if (newPassword !== confirm) {
      wx.showToast({ title: '两次密码不一致', icon: 'none' });
      return;
    }

    this.setData({ passwordSubmitting: true });

    request.post('/auth/change-password', {
      oldPassword: old,
      newPassword: newPassword,
    }).then((res) => {
      if (res.success) {
        wx.showToast({ title: '密码修改成功，请重新登录', icon: 'success' });

        setTimeout(() => {
          // 退出登录
          this.handleLogout();
        }, 1500);
      }
    }).catch((error) => {
      console.error('修改密码失败:', error);
    }).finally(() => {
      this.setData({ passwordSubmitting: false });
    });
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录信息
          app.clearLoginInfo();

          wx.showToast({ title: '已退出登录', icon: 'success' });

          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/login/login',
            });
          }, 1000);
        }
      },
    });
  },

  // 飞书设置
  goToFeishuSettings() {
    wx.navigateTo({
      url: '/pages/settings-feishu/settings-feishu',
    });
  },

  // 语音质量切换
  onQualityChange(e) {
    const index = parseInt(e.detail.value);
    const quality = this.data.qualityOptions[index].value;

    wx.setStorageSync('audioQuality', quality);
    this.setData({ qualityIndex: index });

    wx.showToast({ title: '已保存', icon: 'success' });
  },

  // 播放模式切换
  onPlayModeChange(e) {
    const index = parseInt(e.detail.value);
    const playMode = this.data.playModeOptions[index].value;

    wx.setStorageSync('playMode', playMode);
    this.setData({ playModeIndex: index });

    wx.showToast({ title: '已保存', icon: 'success' });
  },

  // 清理缓存
  clearCache() {
    wx.showModal({
      title: '清理缓存',
      content: '确定要清理本地缓存吗？',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.clearStorageSync();
            // 重新保存必要的设置
            wx.setStorageSync('token', app.globalData.token);
            wx.setStorageSync('userInfo', app.globalData.userInfo);

            this.calculateCacheSize();

            wx.showToast({ title: '缓存已清理', icon: 'success' });
          } catch (error) {
            console.error('清理缓存失败:', error);
          }
        }
      },
    });
  },

  // 使用帮助
  showHelp() {
    wx.showModal({
      title: '使用帮助',
      content: '1. 长按页面下方按钮开始录音\n2. 松手自动上传并识别\n3. 点击播放语音\n4. 点击右上角设置图标进入设置\n5. 在设置中配置飞书同步',
      showCancel: false,
    });
  },

  // 隐私政策
  showPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '我们重视您的隐私...\n（这里应该显示完整的隐私政策内容）',
      showCancel: false,
    });
  },
});
