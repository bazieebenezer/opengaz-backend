import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { uploadImage } from '../utils/cloudinary';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL}/api/auth/google/callback`
);
const OTP_EXPIRATION_MS = 3 * 60 * 1000;

/**
 * Initialise l'authentification Google (pour WebView)
 */
export const initGoogleAuth = async (req: Request, res: Response) => {
  const { mobile_redirect } = req.query;
  const baseUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    response_type: "code",
    scope: "email profile",
    state: (mobile_redirect as string) || "",
  });

  const authUrl = `${baseUrl}?${params.toString()}`;
  console.log('[DEBUG] Google Auth URL:', authUrl);
  res.redirect(authUrl);
};

export const googleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).json({ message: "Code d'autorisation manquant." });
    }

    const { tokens } = await client.getToken({
      code: code as string,
      redirect_uri: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    });

    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_WEB_CLIENT_ID,
      });
    } catch (e) {
      const base64Url = tokens.id_token!.split('.')[1];
      const decoded = JSON.parse(Buffer.from(base64Url, 'base64').toString());
      ticket = { getPayload: () => decoded } as any;
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: "Token Google invalide." });
    }

    const { email, name } = payload;
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || "Utilisateur",
          role: 'CONSUMER',
          password: 'GOOGLE_AUTH_USER',
        },
      });
    }

    const token = generateToken(user.id, user.role);
    
    // Redirection vers le mobile via l'URL transmise dans state
    let mobileRedirect = (state as string) || "opengaz://auth-success";
    
    // Gérer l'ajout du token selon si l'URL a déjà des paramètres ou non
    const separator = mobileRedirect.includes('?') ? '&' : '?';
    const finalUrl = `${mobileRedirect}${separator}token=${token}`;
    
    console.log('[DEBUG] Redirection finale vers mobile:', finalUrl);
    res.redirect(finalUrl);

  } catch (error: any) {
    console.error('Erreur Google Callback:', error);
    res.status(500).redirect(`${process.env.FRONTEND_URL}/auth/error`);
  }
};

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: "Token Google invalide." });
    }

    const { email, name } = payload;
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || "Utilisateur",
          role: 'CONSUMER',
          password: 'GOOGLE_AUTH_USER',
        },
      });
    }

    const token = generateToken(user.id, user.role);
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({
      message: 'Connexion réussie via Google.',
      user: userWithoutPassword,
      token
    });

  } catch (error: any) {
    console.error('Erreur Google Login:', error);
    res.status(500).json({ message: 'Erreur lors de la connexion Google.', error: error.message });
  }
};

/**
 * Inscription d'un nouvel utilisateur (Consumer ou Seller) - Step 1: TempUser
 */
export const signup = async (req: Request, res: Response) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "Le corps de la requête est vide." });
    }

    const { 
      email, password, role, name, phone, address, 
      neighborhood, landmark, shopName, shopImage, 
      selectedGases, region, openingHours, openingTime, 
      closingTime, description, latitude, longitude 
    } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Un utilisateur avec cet email existe déjà." });
    }

    let shopImageUrl = shopImage;
    if (role === 'SELLER' && shopImage && shopImage.startsWith('data:image')) {
      try {
        shopImageUrl = await uploadImage(shopImage, 'opengaz/shops');
      } catch (uploadError) {
        return res.status(500).json({ message: "Erreur lors de l'envoi de la photo." });
      }
    }

    const hashedPassword = await hashPassword(password);
    const otp = crypto.randomInt(1000, 9999).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);

    console.log(`[DEV MODE] OTP pour ${email}: ${otp}`);

    await prisma.tempUser.upsert({
      where: { email },
      update: { 
        otp, expiresAt, password: hashedPassword, name: name || "Utilisateur", 
        role: role || 'CONSUMER', phone, address, neighborhood, landmark, 
        shopName, shopImage: shopImageUrl, selectedGases, region, openingHours, 
        openingTime, closingTime, description,
        latitude: latitude !== undefined ? parseFloat(latitude) : undefined,
        longitude: longitude !== undefined ? parseFloat(longitude) : undefined
      },
      create: { 
        email, password: hashedPassword, name: name || "Utilisateur", 
        role: role || 'CONSUMER', otp, expiresAt, phone, address, 
        neighborhood, landmark, shopName, shopImage: shopImageUrl, selectedGases, 
        region, openingHours, openingTime, closingTime, description,
        latitude: latitude !== undefined ? parseFloat(latitude) : undefined,
        longitude: longitude !== undefined ? parseFloat(longitude) : undefined
      },
    });

    res.status(200).json({ 
      message: "Inscription initiée. Veuillez vérifier le code OTP.",
      otp: otp // Inclus pour le développement
    });

  } catch (error: any) {
    console.error('Erreur Signup:', error);
    res.status(500).json({ message: 'Erreur lors de l\'inscription.', error: error.message });
  }
};

/**
 * Vérification OTP et création finale de l'utilisateur
 */
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const tempUser = await prisma.tempUser.findUnique({ where: { email } });

    if (!tempUser) {
      return res.status(404).json({ message: "Session introuvable. Veuillez recommencer." });
    }

    if (new Date() > tempUser.expiresAt) {
      await prisma.tempUser.delete({ where: { email } });
      return res.status(400).json({ message: "Le code OTP a expiré. Veuillez en redemander un." });
    }

    if (tempUser.otp !== otp) {
      return res.status(400).json({ message: "Code OTP incorrect." });
    }

    const user = await prisma.user.create({
      data: {
        email: tempUser.email,
        password: tempUser.password,
        name: tempUser.name,
        role: tempUser.role as any,
        phone: tempUser.phone,
        address: tempUser.address,
        neighborhood: tempUser.neighborhood,
        landmark: tempUser.landmark,
        shopName: tempUser.shopName,
        shopImage: tempUser.shopImage,
        selectedGases: tempUser.selectedGases,
        region: tempUser.region,
        openingHours: tempUser.openingHours,
        openingTime: tempUser.openingTime,
        closingTime: tempUser.closingTime,
        description: tempUser.description,
        latitude: tempUser.latitude,
        longitude: tempUser.longitude,
      }
    });

    // Automatiquement créer les produits pour les vendeurs
    if (user.role === 'SELLER' && tempUser.selectedGases && tempUser.selectedGases.length > 0) {
      const productsData = tempUser.selectedGases.map(gasId => ({
        sellerId: user.id,
        categoryId: gasId,
        stock: 0 // Stock initial à zéro
      }));

      await prisma.product.createMany({
        data: productsData,
        skipDuplicates: true // Au cas où
      });
    }

    await prisma.tempUser.delete({ where: { email } });
    const token = generateToken(user.id, user.role);
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({
      message: 'Utilisateur créé avec succès.',
      user: userWithoutPassword,
      token
    });

  } catch (error: any) {
    console.error('Erreur OTP:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification.', error: error.message });
  }
};

/**
 * Renvoyer un nouveau code OTP (Signup ou Reset Password)
 */
export const resendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "L'email est requis." });
    }

    const newOtp = crypto.randomInt(1000, 9999).toString();
    const newExpiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);

    // 1. Chercher d'abord dans TempUser (Inscription)
    const tempUser = await prisma.tempUser.findUnique({ where: { email } });
    if (tempUser) {
      await prisma.tempUser.update({
        where: { email },
        data: { otp: newOtp, expiresAt: newExpiresAt },
      });
      console.log(`[DEV MODE] Nouveau OTP (Signup) pour ${email}: ${newOtp}`);
      return res.status(200).json({ message: "Nouveau code envoyé.", otp: newOtp });
    }

    // 2. Sinon chercher dans User (Réinitialisation)
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.user.update({
        where: { email },
        data: { 
          resetPasswordOtp: newOtp, 
          resetPasswordExpires: new Date(Date.now() + 10 * 60 * 1000) 
        },
      });
      console.log(`[DEV MODE] Nouveau OTP (Reset) pour ${email}: ${newOtp}`);
      return res.status(200).json({ message: "Nouveau code envoyé.", otp: newOtp });
    }

    return res.status(404).json({ message: "Aucune session active trouvée pour cet email." });
  } catch (error: any) {
    console.error('Erreur Resend OTP:', error);
    res.status(500).json({ message: 'Erreur lors de la génération.', error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "Le corps de la requête est vide." });
    }

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: 'Identifiants invalides.' });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Identifiants invalides.' });
    }

    const token = generateToken(user.id, user.role);
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({
      message: 'Connexion réussie.',
      user: userWithoutPassword,
      token
    });

  } catch (error: any) {
    console.error('Erreur Login:', error);
    res.status(500).json({ message: 'Erreur lors de la connexion.', error: error.message });
  }
};

export const getMe = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ user: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ message: 'Erreur serveur.', error: error.message });
  }
};

/**
 * Mot de passe oublié : génère un OTP
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "Aucun utilisateur trouvé avec cet email." });
    }

    const otp = crypto.randomInt(1000, 9999).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    console.log(`[DEV MODE] Reset OTP pour ${email}: ${otp}`);

    await prisma.user.update({
      where: { email },
      data: {
        resetPasswordOtp: otp,
        resetPasswordExpires: expires
      }
    });

    res.status(200).json({ 
      message: "Un code de réinitialisation a été envoyé.",
      otp: otp // Inclus pour le développement
    });
  } catch (error: any) {
    res.status(500).json({ message: "Erreur serveur.", error: error.message });
  }
};

/**
 * Vérifier l'OTP de réinitialisation
 */
export const verifyResetOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.resetPasswordOtp !== otp) {
      return res.status(400).json({ message: "Code incorrect." });
    }

    if (user.resetPasswordExpires && new Date() > user.resetPasswordExpires) {
      return res.status(400).json({ message: "Le code a expiré." });
    }

    res.status(200).json({ message: "Code valide." });
  } catch (error: any) {
    res.status(500).json({ message: "Erreur serveur.", error: error.message });
  }
};

/**
 * Réinitialiser le mot de passe
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.resetPasswordOtp !== otp) {
      return res.status(400).json({ message: "Action non autorisée ou code invalide." });
    }

    if (user.resetPasswordExpires && new Date() > user.resetPasswordExpires) {
      return res.status(400).json({ message: "Le code a expiré." });
    }

    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        resetPasswordOtp: null,
        resetPasswordExpires: null
      }
    });

    res.status(200).json({ message: "Mot de passe réinitialisé avec succès." });
  } catch (error: any) {
    res.status(500).json({ message: "Erreur serveur.", error: error.message });
  }
};

/**
 * Mettre à jour le statut d'ouverture de la boutique
 */
export const updateShopStatus = async (req: any, res: Response) => {
  try {
    const { isOpen } = req.body;
    const userId = req.user.id;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isShopOpen: isOpen },
    });

    res.status(200).json({ 
      message: `Boutique ${isOpen ? 'ouverte' : 'fermée'} avec succès.`,
      isOpen: user.isShopOpen 
    });
  } catch (error: any) {
    res.status(500).json({ message: "Erreur lors de la mise à jour du statut.", error: error.message });
  }
};

/**
 * Mettre à jour la photo de profil/boutique
 */
export const updateProfileImage = async (req: any, res: Response) => {
  try {
    const { image } = req.body;
    const userId = req.user.id;

    if (!image) {
      return res.status(400).json({ message: "L'image est requise." });
    }

    let imageUrl = image;
    if (image.startsWith('data:image')) {
      try {
        imageUrl = await uploadImage(image, 'opengaz/profiles');
      } catch (uploadError) {
        return res.status(500).json({ message: "Erreur lors de l'envoi de l'image." });
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { shopImage: imageUrl },
    });

    res.status(200).json({ 
      message: "Photo mise à jour avec succès.",
      shopImage: user.shopImage 
    });
  } catch (error: any) {
    res.status(500).json({ message: "Erreur lors de la mise à jour de la photo.", error: error.message });
  }
};

/**
 * Mettre à jour les informations du profil
 */
export const updateProfile = async (req: any, res: Response) => {
  try {
    const { name, phone, address, latitude, longitude } = req.body;
    const userId = req.user.id;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name !== undefined ? name : undefined,
        phone: phone !== undefined ? phone : undefined,
        address: address !== undefined ? address : undefined,
        latitude: latitude !== undefined ? latitude : undefined,
        longitude: longitude !== undefined ? longitude : undefined,
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ 
      message: "Profil mis à jour avec succès.",
      user: userWithoutPassword 
    });
  } catch (error: any) {
    res.status(500).json({ message: "Erreur lors de la mise à jour du profil.", error: error.message });
  }
};
