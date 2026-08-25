const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');

let supabase;
function getSupabase() {
  if (!supabase) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.(jpg|jpeg|png|gif|webp|svg|mp3|wav|ogg)$/i;
    const allowedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExt.test(ext)) {
      return cb(new Error('Formato inválido. Use jpg, png, gif, webp, svg, mp3, wav ou ogg.'));
    }
    cb(null, true);
  },
});

const router = Router();

router.post('/', authenticate, upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  // Magic bytes validation
  const buf = req.file.buffer;
  if (buf && buf.length >= 4) {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isJpeg = ext === '.jpg' || ext === '.jpeg';
    const isPng = ext === '.png';
    const isGif = ext === '.gif';
    const isWebp = ext === '.webp';
    const isSvg = ext === '.svg';

    const isAudio = ext === '.mp3' || ext === '.wav' || ext === '.ogg';

    let valid = false;
    if (isSvg) {
      const head = buf.toString('utf8', 0, Math.min(buf.length, 256));
      valid = head.includes('<svg') || head.includes('<?xml');
      // Strip dangerous elements from SVG to prevent XSS
      if (valid) {
        const full = buf.toString('utf8');
        const sanitized = full
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/data:text\/html/gi, '');
        req.file.buffer = Buffer.from(sanitized, 'utf8');
      }
    } else if (isJpeg) {
      valid = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    } else if (isPng) {
      valid = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    } else if (isGif) {
      valid = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
    } else if (isWebp) {
      valid = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
    } else if (isAudio) {
      // MP3: starts with ID3 (0x49 0x44 0x33) or frame sync (0xFF 0xFB/0xF3/0xF2)
      // WAV: starts with RIFF (0x52 0x49 0x46 0x46)
      // OGG: starts with OggS (0x4F 0x67 0x67 0x53)
      valid = (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
              (buf[0] === 0xFF && (buf[1] === 0xFB || buf[1] === 0xF3 || buf[1] === 0xF2)) ||
              (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) ||
              (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53);
    }

    if (!valid) {
      return res.status(400).json({ error: 'Arquivo corrompido ou tipo não corresponde. Envie um arquivo válido.' });
    }
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = Date.now() + '_' + Math.random().toString(36).slice(2, 6) + ext;
    const filePath = filename;

    const mimeMap = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
    };
    const contentType = mimeMap[ext] || req.file.mimetype || 'image/jpeg';

    const { error } = await getSupabase().storage
      .from('produtos')
      .upload(filePath, req.file.buffer, {
        contentType,
        upsert: false,
      });

    if (error) throw error;

    const publicUrl = process.env.SUPABASE_URL + '/storage/v1/object/public/produtos/' + filename;
    res.json({ filename, url: publicUrl });
  } catch (err) {
    next(err);
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo muito grande. Máximo 5MB (imagens) ou 500KB (áudio).' : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

module.exports = router;