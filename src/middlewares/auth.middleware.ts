import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';

// Extension de l'interface Request d'Express pour inclure l'utilisateur
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

/**
 * Middleware pour protéger les routes nécessitant une authentification
 */
export const protect = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  // 1. Vérifier si le token est présent dans les headers (Authorization: Bearer <token>)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Accès non autorisé. Token manquant.' });
  }

  // 2. Vérifier la validité du token
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ message: 'Accès non autorisé. Token invalide ou expiré.' });
  }

  // 3. Injecter les données de l'utilisateur dans la requête
  req.user = {
    id: decoded.id,
    role: decoded.role
  };

  next();
};

/**
 * Middleware pour restreindre l'accès à certains rôles
 * @param roles Liste des rôles autorisés (ex: ['SELLER'])
 */
export const restrictTo = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: "Vous n'avez pas la permission d'effectuer cette action." 
      });
    }
    next();
  };
};
