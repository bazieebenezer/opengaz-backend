import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me';

/**
 * Génère un token JWT pour un utilisateur
 * @param userId ID de l'utilisateur
 * @param role Rôle de l'utilisateur (CONSUMER ou SELLER)
 */
export const generateToken = (userId: string, role: string): string => {
  return jwt.sign({ id: userId, role }, JWT_SECRET, {
    expiresIn: '7d', // Le token expire après 7 jours
  });
};

/**
 * Vérifie et décode un token JWT
 * @param token Le token à vérifier
 */
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Hache un mot de passe en utilisant bcrypt
 * @param password Mot de passe en clair
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Compare un mot de passe en clair avec un mot de passe haché
 * @param password Mot de passe saisi
 * @param hashed Mot de passe stocké en base
 */
export const comparePassword = async (password: string, hashed: string): Promise<boolean> => {
  return bcrypt.compare(password, hashed);
};
