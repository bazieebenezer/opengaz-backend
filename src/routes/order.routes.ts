import { Router } from 'express';
import { getSellerOrders, updateOrderStatus, getOrderDetails } from '../controllers/order.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// Toutes les routes de commandes nécessitent d'être connecté
router.use(protect);

/**
 * @route   GET /api/orders/seller
 * @desc    Récupérer les commandes du vendeur connecté
 * @access  Private (Seller)
 */
router.get('/seller', getSellerOrders);

/**
 * @route   GET /api/orders/:id
 * @desc    Récupérer les détails d'une commande spécifique
 * @access  Private (Consumer/Seller)
 */
router.get('/:id', getOrderDetails);

/**
 * @route   PATCH /api/orders/:id/status
 * @desc    Mettre à jour le statut d'une commande
 * @access  Private (Seller)
 */
router.patch('/:id/status', updateOrderStatus);

export default router;
