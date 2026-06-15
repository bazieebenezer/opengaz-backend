import { Request, Response } from 'express';
import prisma from '../config/prisma';

/**
 * Soumettre un avis pour une commande
 */
export const createReview = async (req: any, res: Response) => {
  try {
    const consumerId = req.user.id;
    const { orderId, rating, comment } = req.body;

    if (!orderId || !rating) {
      return res.status(400).json({ message: 'L\'ID de la commande et la note sont requis.' });
    }

    // Vérifier si la commande existe et appartient au consommateur
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { review: true }
    });

    if (!order) {
      return res.status(404).json({ message: 'Commande introuvable.' });
    }

    if (order.consumerId !== consumerId) {
      return res.status(403).json({ message: 'Vous ne pouvez noter que vos propres commandes.' });
    }

    if (order.review) {
      return res.status(400).json({ message: 'Cette commande a déjà été notée.' });
    }

    // Créer l'avis
    const review = await prisma.review.create({
      data: {
        orderId,
        rating,
        comment,
        sellerId: order.sellerId,
        consumerId: consumerId
      }
    });

    res.status(201).json({ message: 'Merci pour votre avis !', review });
  } catch (error: any) {
    console.error('Erreur CreateReview:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'avis.', error: error.message });
  }
};

/**
 * Récupérer les avis d'un vendeur
 */
export const getSellerReviews = async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;

    const reviews = await prisma.review.findMany({
      where: { sellerId },
      include: {
        consumer: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({ reviews });
  } catch (error: any) {
    console.error('Erreur GetSellerReviews:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des avis.', error: error.message });
  }
};
