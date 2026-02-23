import express from 'express';
import { login, logout, checkAuth } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/check', requireAuth, checkAuth);

export default router;
