// API 配置
const API_BASE = 'http://localhost:3000/api';

// 全局状态
let token = localStorage.getItem('token') || null;
let userInfo = JSON.parse(localStorage.getItem('userInfo') || 'null');
let currentLoginTab = 'phone';
let isRegisterMode = false;
let mediaRecorder = null;
let audioChunks = [];
let recordTimerInterval = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  checkLoginStatus();
  setupRecordButton();
});

// 检查登录状态
function checkLoginStatus() {
  if (token && userInfo) {
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('userPhone').textContent = userInfo.phone || userInfo.email || '已登录';
    showPage('home');
    loadRecordList();
  } else {
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('loginBtn').style.display = 'block';
    showPage('login');
  }
}

// 显示页面
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.getElementById(`page-${page}`).style.display = 'block';

  if (page === 'home' && token) {
    loadRecordList();
  }
  if (page === 'settings' && token) {
    loadFeishuConfig();
  }
}

// API 请求封装
async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token && !options.noAuth) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || '请求失败');
  }

  return data;
}

// 显示 Toast
function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ==================== 登录相关 ====================

function switchLoginTab(tab) {
  currentLoginTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  if (tab === 'phone') {
    document.getElementById('phoneInputs').style.display = 'block';
    document.getElementById('emailInputs').style.display = 'none';
  } else {
    document.getElementById('phoneInputs').style.display = 'none';
    document.getElementById('emailInputs').style.display = 'block';
  }
}

function toggleRegisterMode(e) {
  e.preventDefault();
  isRegisterMode = !isRegisterMode;

  document.getElementById('registerFields').style.display = isRegisterMode ? 'block' : 'none';
  document.getElementById('loginSubmitBtn').textContent = isRegisterMode ? '注册' : '登录';
  document.getElementById('toggleText').textContent = isRegisterMode ? '已有账号？' : '还没有账号？';
  document.getElementById('toggleLink').textContent = isRegisterMode ? '立即登录' : '立即注册';
}

async function handleLogin(e) {
  e.preventDefault();

  const password = document.getElementById('password').value;
  let account;

  if (currentLoginTab === 'phone') {
    account = document.getElementById('phone').value;
  } else {
    account = document.getElementById('email').value;
  }

  if (!account || !password) {
    showToast('请填写完整信息');
    return;
  }

  if (isRegisterMode) {
    const confirmPassword = document.getElementById('confirmPassword').value;
    if (password !== confirmPassword) {
      showToast('两次密码不一致');
      return;
    }
    if (password.length < 6) {
      showToast('密码至少6位');
      return;
    }
  }

  const endpoint = isRegisterMode ? '/auth/register' : '/auth/login';
  const body = isRegisterMode
    ? { password, confirmPassword }
    : { account, password };

  if (isRegisterMode) {
    if (currentLoginTab === 'phone') {
      body.phone = account;
    } else {
      body.email = account;
    }
  }

  try {
    const result = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    token = result.data.token;
    userInfo = result.data.user;

    localStorage.setItem('token', token);
    localStorage.setItem('userInfo', JSON.stringify(userInfo));

    checkLoginStatus();
    showToast(isRegisterMode ? '注册成功' : '登录成功');
  } catch (error) {
    showToast(error.message);
  }
}

function logout() {
  token = null;
  userInfo = null;
  localStorage.removeItem('token');
  localStorage.removeItem('userInfo');
  checkLoginStatus();
  showToast('已退出登录');
}

// ==================== 录音相关 ====================

function setupRecordButton() {
  const btn = document.getElementById('recordBtn');

  // 鼠标事件
  btn.addEventListener('mousedown', startRecording);
  document.addEventListener('mouseup', stopRecording);

  // 触摸事件
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startRecording();
  });
  document.addEventListener('touchend', stopRecording);
}

async function startRecording() {
  if (!token) {
    showToast('请先登录');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };

    mediaRecorder.start();

    document.getElementById('recordBtn').classList.add('recording');
    document.getElementById('recordTimer').style.display = 'block';

    let seconds = 0;
    recordTimerInterval = setInterval(() => {
      seconds++;
      document.getElementById('recordDuration').textContent = seconds;
    }, 1000);

  } catch (error) {
    showToast('无法访问麦克风，请检查权限');
  }
}

async function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

  clearInterval(recordTimerInterval);

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const duration = parseInt(document.getElementById('recordDuration').textContent) || 0;

    document.getElementById('recordBtn').classList.remove('recording');
    document.getElementById('recordTimer').style.display = 'none';
    document.getElementById('recordDuration').textContent = '0';

    if (duration < 1) {
      showToast('录音时间太短');
      return;
    }

    await uploadAudio(audioBlob, duration);
  };

  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(track => track.stop());
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('selectedFileName').textContent = file.name;

  const duration = 5; // 默认时长，实际应从文件读取

  uploadAudio(file, duration);
}

async function uploadAudio(blob, duration) {
  const formData = new FormData();
  formData.append('audio', blob);
  formData.append('duration', duration.toString());

  showToast('上传中...', 5000);

  try {
    const response = await fetch(`${API_BASE}/audio/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      showToast('上传成功');
      loadRecordList();
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    showToast('上传失败: ' + error.message);
  }

  document.getElementById('selectedFileName').textContent = '';
  document.getElementById('audioFile').value = '';
}

// ==================== 记录列表 ====================

async function loadRecordList() {
  const listEl = document.getElementById('recordList');
  listEl.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const result = await apiRequest('/audio/list');

    if (result.data.list.length === 0) {
      listEl.innerHTML = '<div class="empty-state">暂无录音记录</div>';
      return;
    }

    listEl.innerHTML = result.data.list.map(item => `
      <div class="record-item">
        <button class="record-play-btn" onclick="playAudio('${item.audioUrl}')">▶</button>
        <div class="record-info">
          <div class="record-text ${item.asrStatus === 'pending' ? 'pending' : ''}">
            ${item.transcription || '语音识别中...'}
          </div>
          <div class="record-meta">
            <span>${formatDuration(item.duration)}</span>
            <span>${formatTime(item.createdAt)}</span>
            <span class="record-status ${item.asrStatus}">${getStatusText(item.asrStatus)}</span>
          </div>
        </div>
        <div class="record-actions">
          ${item.asrStatus === 'failed' ? `<button onclick="retryTranscription(${item.id})">重试</button>` : ''}
          ${item.transcription ? `<button onclick="syncToFeishu(${item.id})">飞书</button>` : ''}
          <button onclick="deleteRecord(${item.id})">删除</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    listEl.innerHTML = `<div class="empty-state">加载失败: ${error.message}</div>`;
  }
}

function formatDuration(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return Math.floor(diff / 86400000) + '天前';
}

function getStatusText(status) {
  const map = {
    pending: '等待中',
    processing: '识别中',
    success: '已完成',
    failed: '失败'
  };
  return map[status] || status;
}

function playAudio(url) {
  const audio = new Audio(url);
  audio.play();
}

async function retryTranscription(id) {
  try {
    await apiRequest(`/audio/${id}/retry-transcription`, { method: 'POST' });
    showToast('开始重新转写');
    loadRecordList();
  } catch (error) {
    showToast(error.message);
  }
}

async function syncToFeishu(id) {
  try {
    await apiRequest(`/feishu/sync/${id}`, { method: 'POST' });
    showToast('同步成功');
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteRecord(id) {
  if (!confirm('确定要删除这条记录吗？')) return;

  try {
    await apiRequest(`/audio/${id}`, { method: 'DELETE' });
    showToast('删除成功');
    loadRecordList();
  } catch (error) {
    showToast(error.message);
  }
}

// ==================== 设置相关 ====================

async function loadFeishuConfig() {
  try {
    const result = await apiRequest('/feishu/config');
    if (result.data.config) {
      document.getElementById('feishuAppId').value = result.data.config.app_id || '';
      document.getElementById('feishuAppSecret').value = result.data.config.app_secret || '';
      document.getElementById('feishuEnabled').checked = result.data.config.is_enabled || false;
    }
  } catch (error) {
    console.error('加载配置失败', error);
  }
}

async function saveFeishuConfig() {
  const docUrl = document.getElementById('feishuDocUrl').value;
  const appId = document.getElementById('feishuAppId').value;
  const appSecret = document.getElementById('feishuAppSecret').value;
  const isEnabled = document.getElementById('feishuEnabled').checked;

  // 从 URL 中提取 document_id
  let documentId = '';
  const match = docUrl.match(/docx\/([a-zA-Z0-9_-]+)/);
  if (match) {
    documentId = match[1];
  }

  try {
    await apiRequest('/feishu/config', {
      method: 'POST',
      body: JSON.stringify({ documentId, appId, appSecret, isEnabled })
    });
    showToast('配置保存成功');
  } catch (error) {
    showToast(error.message);
  }
}

async function testFeishuConnection() {
  try {
    await apiRequest('/feishu/test', { method: 'POST' });
    showToast('连接成功');
  } catch (error) {
    showToast('连接失败: ' + error.message);
  }
}

async function changePassword() {
  const oldPassword = document.getElementById('oldPassword').value;
  const newPassword = document.getElementById('newPassword').value;

  if (!oldPassword || !newPassword) {
    showToast('请填写完整信息');
    return;
  }

  if (newPassword.length < 6) {
    showToast('新密码至少6位');
    return;
  }

  try {
    await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword })
    });
    showToast('密码修改成功，请重新登录');
    logout();
  } catch (error) {
    showToast(error.message);
  }
}
