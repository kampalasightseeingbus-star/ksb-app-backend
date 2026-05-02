import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: number; role: string };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): any => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: number;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const authorizeAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): any => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

export const authorizeDriver = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): any => {
  if (req.user?.role !== 'driver' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Driver access required' });
  }
  next();
};
