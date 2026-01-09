// pages/index/index.js
const request = require('../../utils/request');
const util = require('../../utils/util');

const app = getApp();

Page({
  data: {
    list: [],
    loading: false,
    loadingMore: false,
    hasMore: true,
    refreshing: false,

    // 播放相关
    playingId: null,
    innerAudioContext: null,

    // 录音相关
    recording: false,
    canceling: false,
    recordDuration: 0,
    recordTimer: null,
    recorderManager: null,

    // 操作菜单
    showActionSheet: false,
    selectedId: null,

    // 分页
    page: 1,
    pageSize: 20,

    // 定时刷新
    refreshTimer: null,
  },

  onLoad() {
    // 初始化录音管理器
    const recorderManager = wx.getRecorderManager();
    this.setData({ recorderManager });

    // 监听录音停止事件
    recorderManager.onStop((res) => {
      console.log('onStop 触发:', res);
      this.handleRecordStop(res);
    });

    // 监听录音错误
    recorderManager.onError((res) => {
      console.error('录音错误:', res);
      wx.showToast({ title: '录音失败: ' + res.errMsg, icon: 'none' });
    });

    // 初始化音频播放器
    const innerAudioContext = wx.createInnerAudioContext();
    this.setData({ innerAudioContext });

    // 监听播放结束
    innerAudioContext.onEnded(() => {
      this.setData({ playingId: null });
    });

    // 监听播放错误
    innerAudioContext.onError((res) => {
      console.error('Audio play error:', res.errMsg);
      wx.showToast({ title: '播放失败', icon: 'none' });
      this.setData({ playingId: null });
    });

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

    // 加载列表
    this.loadList();

    // 启动定时刷新（每5秒刷新一次识别中的记录）
    this.startAutoRefresh();
  },

  onShow() {
    // 页面显示时刷新列表
    if (app.globalData.token) {
      this.loadList(true);
    }
  },

  onUnload() {
    // 清理定时器
    if (this.data.recordTimer) {
      clearInterval(this.data.recordTimer);
    }
    if (this.data.refreshTimer) {
      clearInterval(this.data.refreshTimer);
    }

    // 停止播放
    if (this.data.innerAudioContext) {
      this.data.innerAudioContext.stop();
      this.data.innerAudioContext.destroy();
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ refreshing: true });
    this.loadList(true).finally(() => {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  // 启动自动刷新
  startAutoRefresh() {
    // 清除旧定时器
    if (this.data.refreshTimer) {
      clearInterval(this.data.refreshTimer);
    }

    // 每5秒检查一次是否有识别中的记录
    const timer = setInterval(() => {
      const hasProcessing = this.data.list.some(
        (item) => item.asrStatus === 'pending' || item.asrStatus === 'processing'
      );

      if (hasProcessing) {
        // 只刷新第一页
        this.loadList(true);
      }
    }, 5000);

    this.setData({ refreshTimer: timer });
  },

  // 加载列表
  loadList(refresh) {
    if (refresh) {
      this.setData({
        page: 1,
        hasMore: true,
        list: [],
      });
    }

    if (this.data.loading) return Promise.resolve();
    if (!this.data.hasMore && !refresh) return Promise.resolve();

    this.setData({ loading: true });

    return request.get('/audio/list', {
      page: this.data.page,
      pageSize: this.data.pageSize,
    }).then((res) => {
      if (res.success && res.data) {
        const newList = res.data.list.map((item) => ({
          ...item,
          timeStr: util.formatRelativeTime(item.createdAt),
          durationStr: util.formatDuration(item.duration),
        }));

        this.setData({
          list: refresh ? newList : this.data.list.concat(newList),
          hasMore: res.data.pagination.page < res.data.pagination.totalPages,
        });
      }
    }).catch((error) => {
      console.error('加载列表失败:', error);
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) {
      this.setData({
        page: this.data.page + 1,
        loadingMore: true,
      });
      this.loadList().finally(() => {
        this.setData({ loadingMore: false });
      });
    }
  },

  // 开始录音
  startRecord() {
    // 检查权限
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.record']) {
          wx.authorize({
            scope: 'scope.record',
            success: () => {
              this.doStartRecord();
            },
            fail: () => {
              wx.showModal({
                title: '需要麦克风权限',
                content: '请在设置中开启麦克风权限',
                confirmText: '去设置',
                success: (res) => {
                  if (res.confirm) {
                    wx.openSetting();
                  }
                },
              });
            },
          });
        } else {
          this.doStartRecord();
        }
      },
    });
  },

  doStartRecord() {
    const recorderManager = this.data.recorderManager;

    console.log('开始录音...');
    recorderManager.start({
      duration: 60000, // 最长60秒
      format: 'mp3',
    });

    this.setData({
      recording: true,
      canceling: false,
      recordDuration: 0,
    });

    // 开始计时
    const timer = setInterval(() => {
      this.setData({
        recordDuration: this.data.recordDuration + 1,
      });
    }, 1000);

    this.setData({ recordTimer: timer });
  },

  // 停止录音
  stopRecord() {
    if (this.data.canceling) {
      this.cancelRecord();
      return;
    }

    const recorderManager = this.data.recorderManager;

    if (this.data.recordDuration < 1) {
      recorderManager.stop();
      wx.showToast({ title: '说话时间太短', icon: 'none' });
      this.resetRecordState();
      return;
    }

    recorderManager.stop();
  },

  // 录音移动（判断是否取消）
  onRecordMove(e) {
    const touch = e.touches[0];
    const clientY = touch.clientY;

    // 如果手指滑到屏幕上方 1/3，取消录音
    const cancelThreshold = wx.getSystemInfoSync().windowHeight / 3;

    if (clientY < cancelThreshold) {
      this.setData({ canceling: true });
    } else {
      this.setData({ canceling: false });
    }
  },

  // 取消录音
  cancelRecord() {
    const recorderManager = this.data.recorderManager;
    recorderManager.stop();

    this.resetRecordState();
    wx.showToast({ title: '已取消录音', icon: 'none' });
  },

  // 处理录音停止
  handleRecordStop(res) {
    console.log('录音停止:', res);
    this.resetRecordState();

    if (this.data.canceling) {
      console.log('录音已取消');
      return;
    }

    if (res.duration < 1000) {
      console.log('录音时间太短:', res.duration);
      wx.showToast({ title: '说话时间太短', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '上传中...', mask: true });

    // 使用录音管理器返回的实际时长（毫秒转为秒）
    const duration = Math.floor(res.duration / 1000);
    console.log('上传录音，时长:', duration, '秒');

    const hideLoading = () => {
      wx.hideLoading();
    };

    wx.uploadFile({
      url: `${app.globalData.apiBase}/audio/upload`,
      filePath: res.tempFilePath,
      name: 'audio',
      header: {
        Authorization: `Bearer ${app.globalData.token}`,
      },
      formData: {
        duration: String(duration),
      },
      success: (uploadRes) => {
        console.log('上传响应:', uploadRes);
        hideLoading();
        try {
          const data = JSON.parse(uploadRes.data);
          if (data.success) {
            // 刷新列表
            this.setData({ page: 1 });
            this.loadList(true);
            wx.showToast({ title: '录音成功', icon: 'success' });
          } else {
            wx.showToast({ title: data.message || '上传失败', icon: 'none' });
          }
        } catch (e) {
          console.error('解析响应失败:', e);
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('上传失败:', err);
        hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' });
      },
    });
  },

  // 重置录音状态
  resetRecordState() {
    if (this.data.recordTimer) {
      clearInterval(this.data.recordTimer);
      this.setData({ recordTimer: null });
    }

    this.setData({
      recording: false,
      canceling: false,
      recordDuration: 0,
    });
  },

  // 播放录音
  playRecord(e) {
    const { id, url } = e.currentTarget.dataset;

    // 如果正在播放，暂停
    if (this.data.playingId === id) {
      this.data.innerAudioContext.pause();
      this.setData({ playingId: null });
      return;
    }

    // 停止当前播放
    if (this.data.playingId) {
      this.data.innerAudioContext.stop();
    }

    // 播放新的
    this.setData({ playingId: id });
    this.data.innerAudioContext.src = url;
    this.data.innerAudioContext.play();
  },

  // 显示更多操作
  showMore(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({
      selectedId: id,
      showActionSheet: true,
    });
  },

  hideActionSheet() {
    this.setData({
      showActionSheet: false,
      selectedId: null,
    });
  },

  stopPropagation() {
    // 阻止事件冒泡
  },

  // 重新转写
  retryTranscription() {
    const id = this.data.selectedId;
    if (!id) return;

    this.hideActionSheet();

    wx.showLoading({ title: '提交中...', mask: true });

    request.post(`/audio/${id}/retry-transcription`)
      .then((res) => {
        if (res.success) {
          wx.showToast({ title: '开始重新转写', icon: 'success' });
        }
      })
      .catch((error) => {
        console.error('重新转写失败:', error);
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  // 同步到飞书
  syncToFeishu() {
    const id = this.data.selectedId;
    if (!id) return;

    this.hideActionSheet();

    wx.showLoading({ title: '同步中...', mask: true });

    request.post(`/feishu/sync/${id}`)
      .then((res) => {
        if (res.success) {
          wx.showToast({ title: '同步成功', icon: 'success' });
        }
      })
      .catch((error) => {
        console.error('同步失败:', error);
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  // 删除记录
  deleteRecord() {
    const id = this.data.selectedId;
    if (!id) return;

    this.hideActionSheet();

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条语音记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...', mask: true });

          request.delete(`/audio/${id}`)
            .then(() => {
              // 从列表中移除
              const newList = this.data.list.filter((item) => item.id !== id);
              this.setData({ list: newList });
              wx.showToast({ title: '删除成功', icon: 'success' });
            })
            .catch((error) => {
              console.error('删除失败:', error);
            })
            .finally(() => {
              wx.hideLoading();
            });
        }
      },
    });
  },

  // 跳转到设置页
  goToSettings() {
    console.log('点击设置按钮');
    wx.navigateTo({
      url: '/pages/settings/settings',
      success: () => {
        console.log('跳转设置页成功');
      },
      fail: (err) => {
        console.error('跳转设置页失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      },
    });
  },
});
