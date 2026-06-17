import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

/**
 * Récupérer la liste des utilisateurs en attente de validation (Livreurs et Revendeurs)
 */
export const getPendingUsers = async (req: AuthRequest, res: Response) => {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: {
        isValidated: false,
        role: {
          in: ['DELIVERY', 'SELLER']
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        address: true,
        cnibRecto: true,
        cnibVerso: true,
        shopName: true,
        shopImage: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json(pendingUsers);
  } catch (error: any) {
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs.', error: error.message });
  }
};

/**
 * Valider ou rejeter un utilisateur
 */
export const validateUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { action } = req.body; // 'APPROVE' ou 'REJECT'

    if (action === 'APPROVE') {
      const user = await prisma.user.update({
        where: { id },
        data: { isValidated: true }
      });
      return res.status(200).json({ message: `Utilisateur ${user.name} validé avec succès.` });
    } 
    
    if (action === 'REJECT') {
      // Pour un rejet, on pourrait soit supprimer, soit marquer comme rejeté.
      // Ici on supprime pour simplifier le flux de ré-inscription si besoin.
      await prisma.user.delete({ where: { id } });
      return res.status(200).json({ message: "Utilisateur rejeté et supprimé." });
    }

    res.status(400).json({ message: "Action non valide. Utilisez 'APPROVE' ou 'REJECT'." });
  } catch (error: any) {
    res.status(500).json({ message: 'Erreur lors de la validation.', error: error.message });
  }
};

/**
 * Récupérer des statistiques globales pour le dashboard
 */
export const getAdminStats = async (req: AuthRequest, res: Response) => {
  try {
    const totalOrders = await prisma.order.count();
    const totalUsers = await prisma.user.count();
    const pendingValidations = await prisma.user.count({ where: { isValidated: false } });
    const totalRevenue = await prisma.order.aggregate({
      _sum: {
        totalAmount: true
      }
    });

    res.status(200).json({
      totalOrders,
      totalUsers,
      pendingValidations,
      totalRevenue: totalRevenue._sum.totalAmount || 0
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Erreur lors de la récupération des stats.', error: error.message });
  }
};
