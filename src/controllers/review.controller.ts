import { Request, Response } from 'express';
import prisma from '../config/prisma';

/**
 * Soumettre un avis pour une commande
 */
export const createReview = async (req: any, res: Response) => {
  try {
    const consumerId = req.user.id;
    const { orderId, rating, comment } = req.body;

    console.log('[DEBUG] CreateReview - Body:', { orderId, rating, comment, consumerId });

    if (!orderId) {
      return res.status(400).json({ message: 'L\'ID de la commande est requis.' });
    }

    if (rating === undefined || rating === null) {
      return res.status(400).json({ message: 'La note est requise.' });
    }

    const ratingNum = Number(rating);
    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      return res.status(400).json({ message: 'La note doit être comprise entre 0 et 5.' });
    }

    // Vérifier si la commande existe et appartient au consommateur
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { review: true }
    });

    if (!order) {
      console.log('[DEBUG] CreateReview - Commande non trouvée:', orderId);
      return res.status(404).json({ message: 'Commande introuvable.' });
    }

    console.log('[DEBUG] CreateReview - Order details:', {
      orderId: order.id,
      consumerId: order.consumerId,
      status: order.status,
      hasReview: !!order.review
    });

    if (order.consumerId !== consumerId) {
      console.log('[DEBUG] CreateReview - Propriétaire incorrect. Commande client:', order.consumerId, 'Token client:', consumerId);
      return res.status(403).json({ message: 'Vous ne pouvez noter que vos propres commandes.' });
    }

    if (order.review) {
      console.log('[DEBUG] CreateReview - Avis déjà existant pour cette commande.');
      return res.status(400).json({ message: 'Cette commande a déjà été notée.' });
    }

    if (ratingNum === 0) {
      // Cas où l'utilisateur passe la notation : on marque juste la commande comme terminée
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' }
      });
      return res.status(200).json({ message: 'Commande terminée.', order: updatedOrder });
    }

    // Créer l'avis et mettre à jour le statut de la commande dans une transaction
    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          orderId,
          rating: ratingNum,
          comment,
          sellerId: order.sellerId,
          consumerId: consumerId
        }
      });

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' }
      });

      return newReview;
    });

    res.status(201).json({ message: 'Merci pour votre avis !', review });
  } catch (error: any) {
    console.error('Erreur CreateReview:', error);
    // Gérer l'erreur de contrainte unique de Prisma au cas où
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Cette commande a déjà été notée.' });
    }
    res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'avis.', error: error.message });
  }
};

/**
 * Récupérer les avis d'un vendeur
 */
export const getSellerReviews = async (req: Request, res: Response) => {
  try {
    const sellerId = req.params.sellerId as string;

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
