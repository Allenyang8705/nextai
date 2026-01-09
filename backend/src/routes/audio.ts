import { Router } from 'express';
import * as audioController from '../controllers/audio.js';
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';

// 配置 multer 用于内存存储
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // 允许的音频格式
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/aac',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 MP3、WAV、M4A、AAC 格式的音频文件'));
    }
  },
});

const router = Router();

// 所有路由都需要认证
router.use(authenticate);

// 上传语音
router.post('/upload', upload.single('audio'), async (req, res, next) => {
  try {
    await audioController.uploadAudio(req, res);
  } catch (error) {
    next(error);
  }
});

// 获取语音列表
router.get('/list', async (req, res, next) => {
  try {
    await audioController.getAudioList(req, res);
  } catch (error) {
    next(error);
  }
});

// 获取单条语音详情
router.get('/:id', async (req, res, next) => {
  try {
    await audioController.getAudioById(req, res);
  } catch (error) {
    next(error);
  }
});

// 删除语音
router.delete('/:id', async (req, res, next) => {
  try {
    await audioController.deleteAudio(req, res);
  } catch (error) {
    next(error);
  }
});

// 重新转写
router.post('/:id/retry-transcription', async (req, res, next) => {
  try {
    await audioController.retryTranscription(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
