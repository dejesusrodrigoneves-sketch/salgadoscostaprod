const { Router } = require('express');
const multer = require('multer');
const path = require('path');

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
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (allowed.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error('Formato inválido. Use jpg, png, gif, webp ou svg.'));
  },
});

const router = Router();

router.post('/', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

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
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

module.exports = router;