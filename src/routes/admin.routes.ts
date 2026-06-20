import { Router } from 'express';
import { protect, restrictTo } from '../middlewares/auth.middleware';
import { 
  getPendingUsers, 
  validateUser, 
  getAdminStats,
  getSalesTrend,
  getAllOrders,
  getUserRoleDistribution,
  getValidatedDeliveryPartners
} from '../controllers/admin.controller';

const router = Router();

// Toutes les routes admin nécessitent d'être authentifié ET d'avoir le rôle ADMIN
router.use(protect);
router.use(restrictTo('ADMIN'));

// Récupérer les utilisateurs en attente de validation
router.get('/pending-users', getPendingUsers);

// Récupérer tous les livreurs validés
router.get('/validated-delivery-partners', getValidatedDeliveryPartners);

// Valider ou rejeter un utilisateur (Livreur ou Seller)
router.post('/validate-user/:id', validateUser);

// Récupérer toutes les commandes
router.get('/orders', getAllOrders);

// Statistiques globales
router.get('/stats', getAdminStats);

// Évolution des ventes
router.get('/sales-trend', getSalesTrend);

// Répartition par rôle utilisateur
router.get('/user-role-distribution', getUserRoleDistribution);

export default router;
