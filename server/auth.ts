import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { User } from "@shared/schema";
import { resolveJwtSecret } from "./security";

const JWT_SECRET = resolveJwtSecret();

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export type UserLoader = (id: number) => Promise<User | undefined>;

async function loadUserFromStorage(id: number) {
  const { storage } = await import("./storage");
  return storage.getUser(id);
}

/**
 * Valide le jeton puis recharge l'utilisateur : le rôle et l'existence du compte
 * viennent de la base, jamais du contenu du jeton. Un compte supprimé ou un jeton
 * dont le rôle ne correspond plus à la base est refusé immédiatement.
 */
export function createAuthMiddleware(loadUser: UserLoader) {
  return function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    loadUser(decoded.id)
      .then((user) => {
        if (!user || user.role !== decoded.role) {
          return res.status(401).json({ error: "Session no longer valid" });
        }
        const { password: _password, ...safeUser } = user;
        req.user = safeUser as User;
        next();
      })
      .catch(() => res.status(500).json({ error: "Authentication check failed" }));
  };
}

export const authMiddleware = createAuthMiddleware(loadUserFromStorage);

export function requireMentor(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "MENTOR") {
    return res.status(403).json({ error: "Mentor access required" });
  }
  next();
}

export function requireLearner(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "LEARNER") {
    return res.status(403).json({ error: "Learner access required" });
  }
  next();
}
