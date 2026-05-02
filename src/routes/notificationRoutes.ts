import { Router } from 'express';
import { getNotifications } from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getNotifications);

export default router;