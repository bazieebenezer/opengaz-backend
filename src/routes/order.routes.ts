import { Router } from 'express';
import { 
  getSellerOrders, 
  updateOrderStatus, 
  getOrderDetails,
  createOrder,
  getConsumerOrders,
  clearConsumerHistory,
  clearSellerHistory,
  getAvailableOrders,
  assignOrderToDelivery,
  getDeliveryOrders
} from '../controllers/order.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// Toutes les routes de commandes nécessitent d'être connecté
router.use(protect);

/**
 * @route   POST /api/orders
 * @desc    Créer une nouvelle commande
 * @access  Private (Consumer)
 */
router.post('/', createOrder);

/**
 * @route   GET /api/orders/consumer
 * @desc    Récupérer les commandes du consommateur connecté
 * @access  Private (Consumer)
 */
router.get('/consumer', getConsumerOrders);

/**
 * @route   DELETE /api/orders/consumer/history
 * @desc    Supprimer l'historique des commandes du consommateur
 * @access  Private (Consumer)
 */
router.delete('/consumer/history', clearConsumerHistory);

/**
 * @route   GET /api/orders/seller
 * @desc    Récupérer les commandes du vendeur connecté
 * @access  Private (Seller)
 */
router.get('/seller', getSellerOrders);

/**
 * @route   DELETE /api/orders/seller/history
 * @desc    Supprimer l'historique des réservations du vendeur
 * @access  Private (Seller)
 */
router.delete('/seller/history', clearSellerHistory);

/**
 * @route   GET /api/orders/delivery/available
 * @desc    Récupérer les commandes disponibles pour livraison
 * @access  Private (Delivery)
 */
router.get('/delivery/available', getAvailableOrders);

/**
 * @route   GET /api/orders/delivery/my-orders
 * @desc    Récupérer les commandes du livreur connecté
 * @access  Private (Delivery)
 */
router.get('/delivery/my-orders', getDeliveryOrders);

/**
 * @route   POST /api/orders/:id/assign
 * @desc    Assigner une commande au livreur connecté
 * @access  Private (Delivery)
 */
router.post('/:id/assign', assignOrderToDelivery);

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
