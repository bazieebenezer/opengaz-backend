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
        isShopOpen: true
      }
    });

    res.status(200).json({ sellers });
  } catch (error: any) {
    console.error('Erreur GetAllSellers:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des vendeurs.', error: error.message });
  }
};
