import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { OrderStatus } from '@prisma/client';

/**
 * Récupère les commandes reçues par le vendeur connecté
 */
export const getSellerOrders = async (req: any, res: Response) => {
  try {
    const sellerId = req.user.id;

    const orders = await prisma.order.findMany({
      where: { sellerId },
      include: {
        consumer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            neighborhood: true,
            landmark: true,
          }
        },
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({ orders });
  } catch (error: any) {
    console.error('Erreur GetSellerOrders:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des commandes.', error: error.message });
  }
};

/**
 * Met à jour le statut d'une commande
 */
export const updateOrderStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const sellerId = req.user.id;

    if (!Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({ message: 'Statut de commande invalide.' });
    }

    // Vérifier que la commande appartient au vendeur
    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return res.status(404).json({ message: 'Commande introuvable.' });
    }

    if (order.sellerId !== sellerId) {
      return res.status(403).json({ message: 'Action non autorisée sur cette commande.' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: status as OrderStatus },
      include: {
        consumer: true,
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({ 
      message: 'Statut de la commande mis à jour.', 
      order: updatedOrder 
    });
  } catch (error: any) {
    console.error('Erreur UpdateOrderStatus:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut.', error: error.message });
  }
};

/**
 * Récupère les détails d'une commande spécifique
 */
export const getOrderDetails = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        consumer: true,
        seller: {
          select: {
            id: true,
            shopName: true,
            phone: true,
            address: true
          }
        },
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Commande introuvable.' });
    }

    // Vérifier que l'utilisateur est soit le client, soit le vendeur
    if (order.consumerId !== userId && order.sellerId !== userId) {
      return res.status(403).json({ message: 'Accès non autorisé.' });
    }

    res.status(200).json({ order });
  } catch (error: any) {
    console.error('Erreur GetOrderDetails:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des détails.', error: error.message });
  }
};
