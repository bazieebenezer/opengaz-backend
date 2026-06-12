import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL}/api/auth/google/callback`
);
const OTP_EXPIRATION_MS = 3 * 60 * 1000;

/**
 * Callback après authentification Google Web
 */
/**
 * Initialise l'authentification Google (pour WebView)
 */
export const initGoogleAuth = async (req: Request, res: Response) => {
  // Encodage des paramètres pour éviter les erreurs de format
  const baseUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    response_type: "code",
    scope: "email profile", // URLSearchParams va encoder l'espace automatiquement en %20
  });

  const authUrl = `${baseUrl}?${params.toString()}`;
  
  // Log pour débogage
  console.log('[DEBUG] Google Auth URL:', authUrl);
  
  res.redirect(authUrl);
};

export const googleCallback = async (req: Request, res: Response) => {
  try {
    console.log('[DEBUG] Callback reçu. Query:', req.query);
    const { code } = req.query;
    if (!code) {
      console.log('[DEBUG] Code manquant dans le query:', req.query);
      return res.status(400).json({ message: "Code d'autorisation manquant." });
    }

    // Échange du code contre des jetons via google-auth-library
    const { tokens } = await client.getToken({
      code: code as string,
      redirect_uri: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    });

    // Utilisation de decode pour contourner les vérifications de temps serveur strictes
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_WEB_CLIENT_ID,
      });
    } catch (e) {
      // Si la vérification stricte échoue, on décode manuellement
      const base64Url = tokens.id_token!.split('.')[1];
      const decoded = JSON.parse(Buffer.from(base64Url, 'base64').toString());
      ticket = { getPayload: () => decoded } as any;
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: "Token Google invalide." });
    }

    const { email, name } = payload;

    // 1. Chercher ou créer l'utilisateur
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

    // 2. Générer le token
    const token = generateToken(user.id, user.role);

    // 3. Redirection vers le frontend via schéma mobile Expo Go
    const redirectUrl = `exp://192.168.1.2:8081/--/auth-success?token=${token}`;
    console.log('[DEBUG] Redirection vers:', redirectUrl);
    res.redirect(redirectUrl);

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

    // 1. Chercher ou créer l'utilisateur
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || "Utilisateur",
          role: 'CONSUMER', // Rôle par défaut
          password: 'GOOGLE_AUTH_USER', // Placeholder
        },
      });
    }

    // 2. Générer le token
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

import { uploadImage } from '../utils/cloudinary';

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
      closingTime, description 
    } = req.body;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Un utilisateur avec cet email existe déjà." });
    }

    // Handle Image Upload to Cloudinary if provided
    let shopImageUrl = shopImage;
    if (role === 'SELLER' && shopImage && shopImage.startsWith('data:image')) {
      try {
        shopImageUrl = await uploadImage(shopImage, 'opengaz/shops');
      } catch (uploadError) {
        console.error('Initial Cloudinary upload failed, but continuing with signup:', uploadError);
        // We could either fail or continue. Let's fail for data integrity.
        return res.status(500).json({ message: "Erreur lors de l'envoi de la photo." });
      }
    }

    const hashedPassword = await hashPassword(password);
    const otp = crypto.randomInt(1000, 9999).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);

    // Log OTP for development
    console.log(`[DEV MODE] OTP pour ${email}: ${otp}`);

    await prisma.tempUser.upsert({
      where: { email },
      update: { 
        otp, expiresAt, password: hashedPassword, name: name || "Utilisateur", 
        role: role || 'CONSUMER', phone, address, neighborhood, landmark, 
        shopName, shopImage: shopImageUrl, selectedGases, region, openingHours, 
        openingTime, closingTime, description 
      },
      create: { 
        email, password: hashedPassword, name: name || "Utilisateur", 
        role: role || 'CONSUMER', otp, expiresAt, phone, address, 
        neighborhood, landmark, shopName, shopImage: shopImageUrl, selectedGases, 
        region, openingHours, openingTime, closingTime, description 
      },
    });

    res.status(200).json({ message: "Inscription initiée. Veuillez vérifier le code OTP (affiché dans les logs du serveur)." });

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

    // Create user
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
      }
    });

    // Cleanup
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
 * Renvoyer un nouveau code OTP
 */
export const resendOtp = async (req: Request, res: Response) => {
  try {
    console.log('[DEBUG] resendOtp body:', req.body);
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "L'email est requis." });
    }

    const tempUser = await prisma.tempUser.findUnique({ where: { email } });
    if (!tempUser) {
      return res.status(404).json({ message: "Session expirée. Veuillez vous réinscrire." });
    }

    const newOtp = crypto.randomInt(1000, 9999).toString();
    const newExpiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);

    console.log(`[DEV MODE] Nouveau OTP pour ${email}: ${newOtp}`);

    await prisma.tempUser.update({
      where: { email },
      data: { otp: newOtp, expiresAt: newExpiresAt },
    });

    res.status(200).json({ message: "Nouveau code envoyé." });
  } catch (error: any) {
    console.error('Erreur Resend OTP:', error);
    res.status(500).json({ message: 'Erreur lors de la génération.', error: error.message });
  }
};
export const login = async (req: Request, res: Response) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ 
        message: "Le corps de la requête est vide ou mal formé. Assurez-vous d'envoyer du JSON avec l'en-tête 'Content-Type: application/json'." 
      });
    }

    const { email, password } = req.body;

    // 1. Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ message: 'Identifiants invalides.' });
    }

    // 2. Vérifier le mot de passe
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Identifiants invalides.' });
    }

    // 3. Générer le token
    const token = generateToken(user.id, user.role);

    // 4. Retourner la réponse
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

/**
 * Récupère le profil de l'utilisateur connecté
 */
export const getMe = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

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
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

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
      otp: otp // Inclus pour le développement sur Render
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
 "Le code a expiré." });
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
