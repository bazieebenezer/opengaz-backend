import { Router } from 'express';
import { signup, login, getMe, verifyOtp, resendOtp, googleLogin, googleCallback, initGoogleAuth } from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();
console.log('Registering Auth Routes...');

// Endpoint pour l'inscription : POST /api/auth/signup
router.post('/signup', signup);

// Endpoint pour vérifier l'OTP : POST /api/auth/verify-otp
router.post('/verify-otp', verifyOtp);

// Endpoint pour renvoyer l'OTP : POST /api/auth/resend-code
router.post('/resend-code', resendOtp);

// Endpoint pour la connexion : POST /api/auth/login
router.post('/login', login);

// Endpoint pour initier la connexion Google : GET /api/auth/google
router.get('/google', initGoogleAuth);

// Endpoint pour la connexion avec Google (via idToken) : POST /api/auth/google
router.post('/google', googleLogin);

// Endpoint pour le callback Google OAuth2 : GET /api/auth/google/callback
router.get('/google/callback', googleCallback);

// Endpoint pour récupérer le profil actuel : GET /api/auth/me
router.get('/me', protect, getMe);

export default router;
