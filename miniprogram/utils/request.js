// utils/request.js
// 网络请求封装

const app = getApp();

// 请求拦截器
function request(options) {
  return new Promise((resolve, reject) => {
    const {
      url,
      method = 'GET',
      data,
      header = {},
      showLoading = false,
      loadingText = '加载中...',
      auth = true,
    } = options;

    // 显示 loading
    if (showLoading) {
      wx.showLoading({
        title: loadingText,
        mask: true,
      });
    }

    // 构建请求头
    const requestHeader = {
      'Content-Type': 'application/json',
      ...header,
    };

    // 添加认证 token
    if (auth && app.globalData.token) {
      requestHeader.Authorization = `Bearer ${app.globalData.token}`;
    }

    // 构建完整 URL
    const fullUrl = url.startsWith('http') ? url : `${app.globalData.apiBase}${url}`;

    // 发起请求
    wx.request({
      url: fullUrl,
      method,
      data,
      header: requestHeader,
      timeout: 10000, // 10秒超时
      success: (res) => {
        const response = res.data;

        if (response.success) {
          resolve(response);
        } else {
          // 业务错误
          wx.showToast({
            title: response.message || '请求失败',
            icon: 'none',
            duration: 2000,
          });
          reject(new Error(response.message || '请求失败'));
        }
      },
      fail: (err) => {
        console.error('请求失败:', err);
        console.error('请求URL:', fullUrl);
        console.error('请求方法:', method);
        console.error('请求数据:', data);

        // 网络错误处理
        let errorMsg = '网络请求失败';
        if (err.errMsg && err.errMsg.includes('timeout')) {
          errorMsg = '请求超时，请检查网络';
        } else if (err.errMsg && err.errMsg.includes('fail to connect')) {
          errorMsg = '无法连接服务器';
        } else if (err.errMsg && err.errMsg.includes('fail')) {
          errorMsg = '网络连接失败';
        }

        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 2000,
        });

        reject(new Error(errorMsg));
      },
      complete: () => {
        // 隐藏 loading
        if (showLoading) {
          wx.hideLoading();
        }
      },
    });
  });
}

// 导出常用请求方法
module.exports = {
  get(url, data, options) {
    return request({ url, method: 'GET', data, ...options });
  },

  post(url, data, options) {
    return request({ url, method: 'POST', data, ...options });
  },

  put(url, data, options) {
    return request({ url, method: 'PUT', data, ...options });
  },

  delete(url, data, options) {
    return request({ url, method: 'DELETE', data, ...options });
  },

  // 上传文件
  uploadFile(url, filePath, name) {
    return new Promise((resolve, reject) => {
      const token = app.globalData.token;
      const fileName = name || 'file';

      wx.uploadFile({
        url: url.startsWith('http') ? url : `${app.globalData.apiBase}${url}`,
        filePath,
        name: fileName,
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.success) {
              resolve(data);
            } else {
              wx.showToast({
                title: data.message || '上传失败',
                icon: 'none',
              });
              reject(new Error(data.message || '上传失败'));
            }
          } catch (e) {
            reject(new Error('解析响应失败'));
          }
        },
        fail: (err) => {
          wx.showToast({
            title: '上传失败',
            icon: 'none',
          });
          reject(err);
        },
      });
    });
  },
};
