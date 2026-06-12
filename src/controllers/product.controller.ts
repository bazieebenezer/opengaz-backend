import { Request, Response } from 'express';
import prisma from '../config/prisma';

/**
 * Récupère les produits du vendeur connecté
 */
export const getMyProducts = async (req: any, res: Response) => {
  try {
    const sellerId = req.user.id;

    const products = await prisma.product.findMany({
      where: { sellerId },
      include: {
        category: true, // Inclut les infos fixes (nom, prix, image)
      },
      orderBy: {
        category: {
          brand: 'asc',
        },
      },
    });

    res.status(200).json({ products });
  } catch (error: any) {
    console.error('Erreur GetMyProducts:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des produits.', error: error.message });
  }
};

/**
 * Met à jour le stock d'un produit
 */
export const updateProductStock = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;
    const sellerId = req.user.id;

    if (stock === undefined || stock < 0) {
      return res.status(400).json({ message: 'Le stock doit être un nombre positif.' });
    }

    // Vérifier que le produit appartient bien au vendeur
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return res.status(404).json({ message: 'Produit introuvable.' });
    }

    if (product.sellerId !== sellerId) {
      return res.status(403).json({ message: 'Action non autorisée sur ce produit.' });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { stock: parseInt(stock) },
      include: {
        category: true,
      },
    });

    res.status(200).json({ 
      message: 'Stock mis à jour avec succès.', 
      product: updatedProduct 
    });
  } catch (error: any) {
    console.error('Erreur UpdateProductStock:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du stock.', error: error.message });
  }
};
