import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user?.id;
  
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.json({ notifications: result.rows });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};