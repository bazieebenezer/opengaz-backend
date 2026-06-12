import { Router } from 'express';
import { 
  signup, 
  login, 
  getMe, 
  verifyOtp, 
  resendOtp, 
  googleLogin, 
  googleCallback, 
  initGoogleAuth, 
  forgotPassword, 
  verifyResetOtp, 
  resetPassword, 
  updateShopStatus, 
  updateProfileImage 
} from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// Endpoint pour l'inscription : POST /api/auth/signup
router.post('/signup', signup);

// Endpoint pour vérifier l'OTP : POST /api/auth/verify-otp
router.post('/verify-otp', verifyOtp);

// Endpoint pour renvoyer l'OTP : POST /api/auth/resend-code
router.post('/resend-code', resendOtp);

// Endpoint pour mot de passe oublié : POST /api/auth/forgot-password
router.post('/forgot-password', forgotPassword);

// Endpoint pour vérifier l'OTP de reset : POST /api/auth/verify-reset-otp
router.post('/verify-reset-otp', verifyResetOtp);

// Endpoint pour réinitialiser le mot de passe : POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

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

// Endpoint pour mettre à jour le statut de la boutique : PATCH /api/auth/shop-status
router.patch('/shop-status', protect, updateShopStatus);

// Endpoint pour mettre à jour la photo de profil : PATCH /api/auth/profile-image
router.patch('/profile-image', protect, updateProfileImage);

export default router;
