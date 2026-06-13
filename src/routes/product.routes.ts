import { Router } from 'express';
import { getAllProducts, getMyProducts, updateProductStock } from '../controllers/product.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// Toutes les routes de produits nécessitent d'être connecté
// Sauf celle pour récupérer tous les produits (public)
router.get('/', getAllProducts);

router.use(protect);

/**
 * @route   GET /api/products/me
 * @desc    Récupérer les produits du vendeur connecté
 * @access  Private (Seller)
 */
router.get('/me', getMyProducts);

/**
 * @route   PATCH /api/products/:id/stock
 * @desc    Mettre à jour le stock d'un produit spécifique
 * @access  Private (Seller)
 */
router.patch('/:id/stock', updateProductStock);

export default router;
