import { Router } from 'express';
import { getPrompts, getPrompt, getCategories, getSubs, getStats, incrementViewCount } from '../services/database.js';

const router = Router();

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

export default router;
