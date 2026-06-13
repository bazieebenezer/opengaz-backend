import { Router } from 'express';
import { getAllSellers } from '../controllers/seller.controller';

const router = Router();

/**
 * @route   GET /api/sellers
 * @desc    Récupérer tous les vendeurs ouverts
 * @access  Public
 */
router.get('/', getAllSellers);

export default router;
