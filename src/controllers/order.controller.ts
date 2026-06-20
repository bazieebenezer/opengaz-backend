import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { OrderStatus } from '@prisma/client';
import { calculateDistance } from '../utils/geo';

/**
 * Récupère les commandes reçues par le vendeur connecté
 */
export const getSellerOrders = async (req: any, res: Response) => {
  try {
    const sellerId = req.user.id;

    const orders = await prisma.order.findMany({
      where: { 
        sellerId,
        sellerHidden: false
      },
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
        },
        review: true
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
 * Masque l'historique des réservations pour le vendeur
 */
export const clearSellerHistory = async (req: any, res: Response) => {
  try {
    const sellerId = req.user.id;

    await prisma.order.updateMany({
      where: { sellerId },
      data: { sellerHidden: true }
    });

    res.status(200).json({ message: 'Historique des réservations supprimé.' });
  } catch (error: any) {
    console.error('Erreur ClearSellerHistory:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'historique.', error: error.message });
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
      where: { id },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ message: 'Commande introuvable.' });
    }

    if (order.sellerId !== sellerId) {
      return res.status(403).json({ message: 'Action non autorisée sur cette commande.' });
    }

    // Validation des transitions de statut
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Impossible de modifier une commande terminée ou annulée.' });
    }

    const statusOrder = ['PENDING', 'PENDING_DELIVERY', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED'];
    const currentIndex = statusOrder.indexOf(order.status);
    const newIndex = statusOrder.indexOf(status);

    if (status !== 'CANCELLED' && newIndex <= currentIndex) {
      return res.status(400).json({ message: 'Le nouveau statut doit être une progression logique.' });
    }

    // Transaction pour mettre à jour le statut et éventuellement restaurer le stock
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
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

      // Si la commande est annulée, on restaure le stock
      if (status === 'CANCELLED') {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          });
        }
      }

      return updated;
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
      where: { 
        consumerId,
        consumerHidden: false
      },
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
        deliverer: {
          select: {
            id: true,
            name: true,
            phone: true
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
        },
        review: true
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
 * Masque l'historique des commandes pour le consommateur
 */
export const clearConsumerHistory = async (req: any, res: Response) => {
  try {
    const consumerId = req.user.id;

    await prisma.order.updateMany({
      where: { consumerId },
      data: { consumerHidden: true }
    });

    res.status(200).json({ message: 'Historique des commandes supprimé.' });
  } catch (error: any) {
    console.error('Erreur ClearConsumerHistory:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'historique.', error: error.message });
  }
};

/**
 * Crée une nouvelle commande
 */
export const createOrder = async (req: any, res: Response) => {
  try {
    const consumerId = req.user.id;
    const { sellerId, items } = req.body; // items: [{ productId, quantity }]

    console.log('[DEBUG] createOrder payload:', { sellerId, itemsCount: items?.length, consumerId });

    if (!sellerId || !items || !Array.isArray(items) || items.length === 0) {
      console.log('[DEBUG] Invalid payload check failed');
      return res.status(400).json({ message: 'Données de commande invalides.' });
    }

    // Récupérer le vendeur pour vérifier s'il est ouvert
    const seller = await prisma.user.findUnique({
      where: { id: sellerId }
    });

    if (!seller) {
      console.log('[DEBUG] Seller not found:', sellerId);
      return res.status(400).json({ message: 'Vendeur introuvable.' });
    }

    if (!seller.isShopOpen) {
      console.log('[DEBUG] Seller shop is closed:', seller.shopName);
      return res.status(400).json({ message: 'Le vendeur est actuellement fermé.' });
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

    console.log(`[DEBUG] Found ${dbProducts.length} products in DB for ${items.length} items requested`);

    if (dbProducts.length !== items.length) {
      console.log('[DEBUG] Products mismatch or wrong seller');
      return res.status(400).json({ message: 'Certains produits sont introuvables ou n\'appartiennent pas à ce vendeur.' });
    }

    let totalAmount = 0;
    const orderItemsData = items.map((item: any) => {
      const product = dbProducts.find(p => p.id === item.productId);
      if (!product) throw new Error('Produit non trouvé');
      
      // Vérifier si le stock est suffisant
      if (product.stock < item.quantity) {
        throw new Error(`Stock insuffisant pour le produit: ${product.category.name}`);
      }
      
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
          status: 'PENDING_DELIVERY',
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
        deliverer: {
          select: {
            id: true,
            name: true,
            phone: true
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
        },
        review: true
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Commande introuvable.' });
    }

    // Vérifier que l'utilisateur est soit le client, soit le vendeur, soit le livreur
    if (order.consumerId !== userId && order.sellerId !== userId && order.delivererId !== userId) {
      return res.status(403).json({ message: 'Accès non autorisé.' });
    }

    res.status(200).json({ order });
  } catch (error: any) {
    console.error('Erreur GetOrderDetails:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des détails.', error: error.message });
  }
};

/**
 * Récupère toutes les commandes disponibles pour livraison (pour tous les livreurs)
 */
export const getAvailableOrders = async (req: any, res: Response) => {
  try {
    // Fetch all pending orders without proximity filtering
    const orders = await prisma.order.findMany({
      where: { 
        status: 'PENDING_DELIVERY',
        delivererId: null
      },
      include: {
        consumer: { select: { name: true, address: true } },
        seller: { 
          select: { 
            shopName: true, 
            address: true, 
            latitude: true, 
            longitude: true 
          } 
        },
        items: { include: { product: { include: { category: true } } } }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.status(200).json({ orders });
  } catch (error: any) {
    console.error('Erreur GetAvailableOrders:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des commandes disponibles.', error: error.message });
  }
};


/**
 * Assigne une commande au livreur connecté (Mécanisme First-to-Accept)
 */
export const assignOrderToDelivery = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const deliveryId = req.user.id;

    // Atomic update: only update if delivererId is currently null
    const result = await prisma.order.updateMany({
      where: { 
        id,
        delivererId: null, // Critical check for concurrency
        status: 'PENDING_DELIVERY'
      },
      data: { 
        delivererId: deliveryId, 
        status: 'SHIPPED' 
      }
    });

    if (result.count === 0) {
      return res.status(400).json({ message: 'Commande déjà prise par un autre livreur ou indisponible.' });
    }

    const updatedOrder = await prisma.order.findUnique({ where: { id } });

    res.status(200).json({ message: 'Commande assignée avec succès.', order: updatedOrder });
  } catch (error: any) {
    console.error('Erreur AssignOrderToDelivery:', error);
    res.status(500).json({ message: 'Erreur lors de l\'assignation.', error: error.message });
  }
};

/**
 * Récupère les commandes assignées au livreur connecté
 */
export const getDeliveryOrders = async (req: any, res: Response) => {
  try {
    const deliveryId = req.user.id;

    const orders = await prisma.order.findMany({
      where: { 
        delivererId: deliveryId
      },
      include: {
        consumer: { select: { name: true, phone: true, address: true } },
        seller: { select: { shopName: true, address: true } },
        items: { include: { product: { include: { category: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ orders });
  } catch (error: any) {
    console.error('Erreur GetDeliveryOrders:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de vos commandes.', error: error.message });
  }
};
