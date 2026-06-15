import { Request, Response } from 'express';
import prisma from '../config/prisma';

/**
 * Récupère tous les vendeurs (vendeurs ouverts)
 */
export const getAllSellers = async (req: Request, res: Response) => {
  try {
    const sellers = await prisma.user.findMany({
      where: {
        role: 'SELLER'
      },
      select: {
        id: true,
        shopName: true,
        name: true,
        shopImage: true,
        description: true,
        phone: true,
        openingHours: true,
        isShopOpen: true,
        selectedGases: true,
        latitude: true,
        longitude: true,
        reviews: {
          select: {
            rating: true
          }
        }
      }
    });

    // Calculer la moyenne des notes pour chaque vendeur
    const sellersWithRating = sellers.map(seller => {
      const reviewCount = seller.reviews.length;
      const avgRating = reviewCount > 0 
        ? seller.reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviewCount 
        : 0;
      
      const { reviews, ...sellerData } = seller;
      return {
        ...sellerData,
        rating: parseFloat(avgRating.toFixed(1)),
        reviewCount
      };
    });

    res.status(200).json({ sellers: sellersWithRating });
  } catch (error: any) {
    console.error('Erreur GetAllSellers:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des vendeurs.', error: error.message });
  }
};
