import { Router, type Router as ExpressRouter } from 'express';

// Application Feature Routes
import authRoutes from '../auth/auth.routes';
import projectRoutes from '../../routes/projects';
import portfolioRoutes from '../../routes/portfolio';
import galleryRoutes from '../../routes/gallery';
import techRoutes from '../../routes/technologies';
import settingsRoutes from '../../routes/settings';
import themeRoutes from '../themes/theme.routes';
import blogRoutes from '../blog/blog.routes';
import notificationRoutes from '../notification/notification.routes';
import dailySheetsRoutes from '../daily-sheets/daily-sheets.routes';
import monthlySheetsRoutes from '../monthly-sheets/monthly-sheets.routes';
import timesheetsRoutes from '../timesheets/timesheets.routes';

const router: ExpressRouter = Router();

// Member and public authentication
router.use('/auth', authRoutes);

// Portfolio & content reader
router.use('/projects', projectRoutes);
router.use('/portfolio', portfolioRoutes);
router.use('/gallery', galleryRoutes);
router.use('/technologies', techRoutes);
router.use('/settings', settingsRoutes);
router.use('/themes', themeRoutes);
router.use('/blog', blogRoutes);

// Member notifications & sheets
router.use('/notifications', notificationRoutes);
router.use('/daily-sheets', dailySheetsRoutes);
router.use('/monthly-sheets', monthlySheetsRoutes);
router.use('/timesheets', timesheetsRoutes);

export default router;
