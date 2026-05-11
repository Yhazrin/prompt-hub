import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getPrompts, getPrompt, getCategories, getSubs, getStats, incrementViewCount, getGalleryImages, addGalleryImage, deleteGalleryImage, markGalleryImageSynced } from '../services/database.js';
import { uploadImageToFeishu, appendImageBlockToDoc } from '../services/feishu.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GALLERY_DIR = process.env.GALLERY_DIR || path.join(process.env.DATA_DIR || './data', '../images/gallery');

// Ensure gallery dir exists
if (!fs.existsSync(GALLERY_DIR)) fs.mkdirSync(GALLERY_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, GALLERY_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

// GET /api/prompts
router.get('/prompts', (req, res) => {
  const { category, sub, search, page, limit, sort, order } = req.query;
  try {
    const result = getPrompts({
      category, sub, search,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      sort: sort || 'updated_at',
      order: order || 'desc',
    });

    // Attach category names
    const cats = getCategories();
    result.prompts = result.prompts.map(p => ({
      ...p,
      category_name: cats.find(c => c.id === p.category_id)?.name || p.category_id,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/prompts/:id
router.get('/prompts/:id', (req, res) => {
  try {
    const prompt = getPrompt(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Not found' });
    incrementViewCount(req.params.id);
    res.json(prompt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/categories
router.get('/categories', (req, res) => {
  try {
    res.json(getCategories());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subs/:category
router.get('/subs/:category', (req, res) => {
  try {
    res.json(getSubs(req.params.category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats
router.get('/stats', (req, res) => {
  try {
    res.json(getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search
router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const cats = getCategories();
    const result = getPrompts({ search: q, limit: 20, sort: 'updated_at' });
    result.prompts = result.prompts.map(p => ({
      ...p,
      category_name: cats.find(c => c.id === p.category_id)?.name || p.category_id,
    }));
    res.json(result.prompts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/prompts/:id/gallery
router.get('/prompts/:id/gallery', (req, res) => {
  try {
    const prompt = getPrompt(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
    res.json(getGalleryImages(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/prompts/:id/gallery  — upload image
router.post('/prompts/:id/gallery', upload.single('image'), async (req, res) => {
  try {
    const prompt = getPrompt(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    const imageEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filename: req.file.filename,
      url: `/images/gallery/${req.file.filename}`,
      original_name: req.file.originalname,
      size: req.file.size,
      uploaded_at: Date.now(),
      synced: false,
      feishu_block_id: null,
      feishu_token: null,
    };

    addGalleryImage(req.params.id, imageEntry);
    res.json({ success: true, image: imageEntry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/prompts/:id/gallery/:imageId
router.delete('/prompts/:id/gallery/:imageId', (req, res) => {
  try {
    const images = getGalleryImages(req.params.id);
    const img = images.find(i => i.id === req.params.imageId);
    if (!img) return res.status(404).json({ error: 'Image not found' });

    // Remove file from disk
    const filePath = path.join(GALLERY_DIR, img.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    deleteGalleryImage(req.params.id, req.params.imageId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/prompts/:id/gallery/:imageId/sync  — sync to Feishu
router.post('/prompts/:id/gallery/:imageId/sync', async (req, res) => {
  try {
    const prompt = getPrompt(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
    if (!prompt.wiki_obj_token) return res.status(400).json({ error: 'No Feishu document linked to this prompt' });

    const images = getGalleryImages(req.params.id);
    const img = images.find(i => i.id === req.params.imageId);
    if (!img) return res.status(404).json({ error: 'Image not found' });
    if (img.synced) return res.status(400).json({ error: 'Image already synced to Feishu' });

    const localPath = path.join(GALLERY_DIR, img.filename);
    if (!fs.existsSync(localPath)) return res.status(404).json({ error: 'Image file not found on disk' });

    // Upload to Feishu
    const feishuToken = await uploadImageToFeishu(localPath);

    // Append image block to document
    const blockId = await appendImageBlockToDoc(prompt.wiki_obj_token, feishuToken, 600, 400);

    // Mark as synced
    markGalleryImageSynced(req.params.id, req.params.imageId, blockId, feishuToken);

    res.json({ success: true, feishu_token: feishuToken, feishu_block_id: blockId });
  } catch (err) {
    res.status(500).json({ error: err.message, detail: err.stack });
  }
});

export default router;
