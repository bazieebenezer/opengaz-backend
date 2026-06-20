import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { hashPassword } from '../utils/auth';
import crypto from 'crypto';

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
      // Pour les livreurs, générer un mot de passe temporaire s'il n'en a pas
      const user = await prisma.user.findUnique({ where: { id } });
      let tempPassword: string | null = null;
      let updateData: any = { isValidated: true };

      if (user && user.role === 'DELIVERY') {
        tempPassword = crypto.randomBytes(4).toString('hex');
        updateData.password = await hashPassword(tempPassword);
        updateData.temporaryPassword = tempPassword;
      }

      await prisma.user.update({
        where: { id },
        data: updateData
      });

      return res.status(200).json({ 
        message: `Utilisateur ${user?.name} validé avec succès.`,
        temporaryPassword: tempPassword 
      });
    } 
    
    if (action === 'REJECT') {
      await prisma.user.delete({ where: { id } });
      return res.status(200).json({ message: "Utilisateur rejeté et supprimé." });
    }

    res.status(400).json({ message: "Action non valide. Utilisez 'APPROVE' ou 'REJECT'." });
  } catch (error: any) {
    res.status(500).json({ message: 'Erreur lors de la validation.', error: error.message });
  }
};

/**
 * Récupérer toutes les commandes pour l'admin
 */
export const getAllOrders = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        consumer: { select: { name: true, email: true } },
        seller: { select: { shopName: true } },
        items: {
          include: { product: { include: { category: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(orders);
  } catch (error: any) {
    res.status(500).json({ message: 'Erreur lors de la récupération des commandes.', error: error.message });
  }
};

/**
 * Récupérer les statistiques globales pour le dashboard
 */
export const getAdminStats = async (req: AuthRequest, res: Response) => {
  try {
    const totalOrders = await prisma.order.count();
    const totalUsers = await prisma.user.count();
    const pendingValidations = await prisma.user.count({ 
      where: { 
        isValidated: false,
        role: { in: ['DELIVERY', 'SELLER'] }
      } 
    });
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

/**
 * Récupérer l'évolution des ventes sur les 7 derniers jours
 */
export const getSalesTrend = async (req: AuthRequest, res: Response) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
    });

    // Agrégation par jour
    const trend: Record<string, number> = {};
    orders.forEach(order => {
      const date = order.createdAt.toLocaleDateString('fr-FR', { weekday: 'short' });
      trend[date] = (trend[date] || 0) + (order.totalAmount || 0);
    });

    const result = Object.entries(trend).map(([name, value]) => ({ name, value }));

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Erreur lors de la récupération de la tendance des ventes.', error: error.message });
  }
};

/**
 * Récupérer tous les livreurs validés
 */
export const getValidatedDeliveryPartners = async (req: AuthRequest, res: Response) => {
  try {
    const deliveryPartners = await prisma.user.findMany({
      where: {
        isValidated: true,
        role: 'DELIVERY'
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        temporaryPassword: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json(deliveryPartners);
  } catch (error: any) {
    res.status(500).json({ message: 'Erreur lors de la récupération des livreurs validés.', error: error.message });
  }
};

/**
 * Récupérer la répartition des utilisateurs par rôle
 */
export const getUserRoleDistribution = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.groupBy({
      by: ['role'],
      _count: {
        id: true
      }
    });

    const result = users.map(item => ({
      name: item.role,
      value: item._count.id
    }));

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Erreur lors de la récupération de la répartition par rôle.', error: error.message });
  }
};

