import { Router } from 'express';
import { createReview, getSellerReviews } from '../controllers/review.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @route   POST /api/reviews
 * @desc    Soumettre un avis
 * @access  Private (Consumer)
 */
router.post('/', protect, createReview);

/**
 * @route   GET /api/reviews/seller/:sellerId
 * @desc    Récupérer les avis d'un vendeur
 * @access  Public
 */
router.get('/seller/:sellerId', getSellerReviews);

export default router;
