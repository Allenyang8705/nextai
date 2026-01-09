// app.ts
App({
  globalData: {
    userInfo: null,
    token: null,
    apiBase: 'http://192.168.1.2:3000/api', // 请修改为你电脑的局域网 IP
  },

  onLaunch() {
    console.log('App Launch');
    console.log('API Base:', this.globalData.apiBase);

    // 检查登录状态
    this.checkLoginStatus();

    // 检查更新
    this.checkUpdate();
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');

    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      console.log('用户已登录');
    } else {
      console.log('用户未登录');
    }
  },

  // 检查小程序更新
  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();

      updateManager.onCheckForUpdate((res) => {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(() => {
            wx.showModal({
              title: '更新提示',
              content: '新版本已准备好，是否重启应用？',
              success: (res) => {
                if (res.confirm) {
                  updateManager.applyUpdate();
                }
              },
            });
          });

          updateManager.onUpdateFailed(() => {
            wx.showModal({
              title: '更新失败',
              content: '新版本下载失败，请检查网络',
              showCancel: false,
            });
          });
        }
      });
    }
  },

  // 设置登录信息
  setLoginInfo(token, userInfo) {
    this.globalData.token = token;
    this.globalData.userInfo = userInfo;

    // 持久化存储
    wx.setStorageSync('token', token);
    wx.setStorageSync('userInfo', userInfo);
  },

  // 清除登录信息
  clearLoginInfo() {
    this.globalData.token = null;
    this.globalData.userInfo = null;

    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
  },
});
