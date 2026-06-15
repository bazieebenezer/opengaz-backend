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
 * Récupère les commandes passées par le consommateur connecté
 */
export const getConsumerOrders = async (req: any, res: Response) => {
  try {
    const consumerId = req.user.id;

    const orders = await prisma.order.findMany({
      where: { consumerId },
      include: {
        seller: {
          select: {
            id: true,
            shopName: true,
            phone: true,
            address: true,
            shopImage: true,
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
    console.error('Erreur GetConsumerOrders:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de vos commandes.', error: error.message });
  }
};

/**
 * Crée une nouvelle commande
 */
export const createOrder = async (req: any, res: Response) => {
  try {
    const consumerId = req.user.id;
    const { sellerId, items } = req.body; // items: [{ productId, quantity }]
    
    console.log("DEBUG - CreateOrder body:", JSON.stringify(req.body));

    if (!sellerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Données de commande invalides.' });
    }

    // Récupérer les produits pour vérifier les prix et le stock
    const productIds = items.map((item: any) => item.productId);
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        sellerId: sellerId // Sécurité : s'assurer que les produits appartiennent bien au vendeur
      },
      include: {
        category: true
      }
    });

    if (dbProducts.length !== items.length) {
      return res.status(400).json({ message: 'Certains produits sont introuvables ou n\'appartiennent pas à ce vendeur.' });
    }

    let totalAmount = 0;
    const orderItemsData = items.map((item: any) => {
      const product = dbProducts.find(p => p.id === item.productId);
      if (!product) throw new Error('Produit non trouvé');
      
      const price = product.category.price;
      totalAmount += price * item.quantity;
      
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: price
      };
    });

    // Transaction pour créer la commande et les items
    const order = await prisma.$transaction(async (tx) => {
      // 1. Créer la commande
      const newOrder = await tx.order.create({
        data: {
          consumerId,
          sellerId,
          totalAmount,
          items: {
            create: orderItemsData
          }
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true
                }
              }
            }
          },
          seller: {
            select: {
              shopName: true
            }
          }
        }
      });

      // 2. Mettre à jour les stocks
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
      }

      return newOrder;
    });

    res.status(201).json({ 
      message: 'Commande créée avec succès.', 
      order 
    });
  } catch (error: any) {
    console.error('Erreur CreateOrder:', error);
    res.status(500).json({ message: 'Erreur lors de la création de la commande.', error: error.message });
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
