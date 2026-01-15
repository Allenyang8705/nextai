// pages/login/login.js
const request = require('../../utils/request');

const app = getApp();

Page({
  data: {
    isLogin: true, // 登录/注册切换

    // 登录表单
    loginForm: {
      account: '',
      password: '',
    },

    // 注册表单
    registerForm: {
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
    },

    // UI 状态
    showPassword: false,
    rememberMe: false,
    agreeAgreement: false,
    loading: false,
  },

  onLoad() {
    // 检查是否有保存的账号
    const savedAccount = wx.getStorageSync('savedAccount');
    if (savedAccount) {
      this.setData({
        'loginForm.account': savedAccount.account,
        rememberMe: true,
      });
    }
  },

  // 切换登录/注册 Tab
  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      isLogin: type === 'login',
    });
  },

  // 登录表单输入
  onLoginAccountInput(e) {
    this.setData({
      'loginForm.account': e.detail.value,
    });
  },

  onLoginPasswordInput(e) {
    this.setData({
      'loginForm.password': e.detail.value,
    });
  },

  // 注册表单输入
  onRegisterPhoneInput(e) {
    this.setData({
      'registerForm.phone': e.detail.value,
    });
  },

  onRegisterEmailInput(e) {
    this.setData({
      'registerForm.email': e.detail.value,
    });
  },

  onRegisterPasswordInput(e) {
    this.setData({
      'registerForm.password': e.detail.value,
    });
  },

  onRegisterConfirmPasswordInput(e) {
    this.setData({
      'registerForm.confirmPassword': e.detail.value,
    });
  },

  // 切换密码显示
  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword,
    });
  },

  // 切换记住登录
  toggleRemember() {
    this.setData({
      rememberMe: !this.data.rememberMe,
    });
  },

  // 切换协议同意
  toggleAgreement() {
    this.setData({
      agreeAgreement: !this.data.agreeAgreement,
    });
  },

  // 显示用户协议
  showUserAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '这里是用户协议的内容...',
      showCancel: false,
    });
  },

  // 显示隐私政策
  showPrivacyPolicy() {
    wx.showModal({
      title: '隐私政策',
      content: '这里是隐私政策的内容...',
      showCancel: false,
    });
  },

  // 验证手机号
  validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
  },

  // 验证邮箱
  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  // 验证密码
  validatePassword(password) {
    if (password.length < 8) {
      return { valid: false, message: '密码长度至少为8位' };
    }
    if (!/[a-zA-Z]/.test(password)) {
      return { valid: false, message: '密码必须包含字母' };
    }
    if (!/\d/.test(password)) {
      return { valid: false, message: '密码必须包含数字' };
    }
    return { valid: true };
  },

  // 处理登录
  handleLogin() {
    const { account, password } = this.data.loginForm;

    // 验证
    if (!account) {
      wx.showToast({
        title: '请输入手机号或邮箱',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    this.setData({ loading: true });

    request.post('/auth/login', {
      account,
      password,
    }).then((res) => {
      if (res.success && res.data) {
        // 保存登录信息
        app.setLoginInfo(res.data.token, res.data.user);

        // 记住账号
        if (this.data.rememberMe) {
          wx.setStorageSync('savedAccount', { account });
        } else {
          wx.removeStorageSync('savedAccount');
        }

        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        });

        // 延迟跳转
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index',
          });
        }, 1500);
      }
    }).catch((error) => {
      console.error('登录失败:', error);
      // 错误已经在 request.js 中统一处理
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  // 处理注册
  handleRegister() {
    const { phone, email, password, confirmPassword } = this.data.registerForm;

    // 验证手机号
    if (!phone) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    if (!this.validatePhone(phone)) {
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 验证邮箱（选填）
    if (email && !this.validateEmail(email)) {
      wx.showToast({
        title: '邮箱格式不正确',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 验证密码
    const passwordCheck = this.validatePassword(password);
    if (!passwordCheck.valid) {
      wx.showToast({
        title: passwordCheck.message,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 验证确认密码
    if (password !== confirmPassword) {
      wx.showToast({
        title: '两次密码不一致',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    this.setData({ loading: true });

    request.post('/auth/register', {
      phone,
      email: email || undefined,
      password,
      confirmPassword,
    }).then((res) => {
      if (res.success && res.data) {
        // 保存登录信息
        app.setLoginInfo(res.data.token, res.data.user);

        wx.showToast({
          title: '注册成功',
          icon: 'success',
          duration: 1500
        });

        // 延迟跳转
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index',
          });
        }, 1500);
      }
    }).catch((error) => {
      console.error('注册失败:', error);
      // 错误已经在 request.js 中统一处理
    }).finally(() => {
      this.setData({ loading: false });
    });
  },
});
