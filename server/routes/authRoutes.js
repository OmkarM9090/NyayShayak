import express from 'express';
const router = express.Router();
// Controller se functions import karein (Extension .js lagana zaruri hai ESM mein)
import { signup, login, updateLanguagePreference } from '../controllers/authController.js';

// POST /api/auth/signup
router.post('/signup', signup);

// POST /api/auth/login
router.post('/login', login);

// PUT /api/auth/language
router.put('/language', updateLanguagePreference);

export default router;