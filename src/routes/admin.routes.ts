import { Router } from 'express';
import { protect, restrictTo } from '../middlewares/auth.middleware';
import { 
  getPendingUsers, 
  validateUser, 
  getAdminStats,
  getSalesTrend,
  getAllOrders,
  getGeographicDistribution
} from '../controllers/admin.controller';

const router = Router();

// Toutes les routes admin nécessitent d'être authentifié ET d'avoir le rôle ADMIN
router.use(protect);
router.use(restrictTo('ADMIN'));

// Récupérer les utilisateurs en attente de validation
router.get('/pending-users', getPendingUsers);

// Valider ou rejeter un utilisateur (Livreur ou Seller)
router.post('/validate-user/:id', validateUser);

// Récupérer toutes les commandes
router.get('/orders', getAllOrders);

// Statistiques globales
router.get('/stats', getAdminStats);

// Évolution des ventes
router.get('/sales-trend', getSalesTrend);

// Répartition géographique
router.get('/geo-distribution', getGeographicDistribution);

export default router;
