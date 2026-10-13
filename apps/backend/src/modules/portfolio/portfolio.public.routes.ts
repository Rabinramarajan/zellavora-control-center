import { Router, type Response } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { createRateLimiter } from '../../middleware/rate-limit';
import { PortfolioService } from './portfolio.service';

const router = Router();
const service = new PortfolioService();

const USERNAME = /^[A-Za-z0-9._-]{1,60}$/;

// Anonymous reads are cheap to abuse and cheap to cache, so both are bounded.
const readLimiter = createRateLimiter({
  bucket: 'portfolio:public',
  windowMs: 60 * 1000,
  limit: 120,
});

/**
 * @swagger
 * /api/v1/public/portfolios/{username}:
 *   get:
 *     summary: getPublicPortfolio
 *     operationId: getPublicPortfolio
 *     description: >
 *       Anonymous read of a portfolio the owner has made public (`profile.isPublic`).
 *       Responses are cacheable for 60 seconds. Unpublished and unknown usernames both return 404.
 *     tags: [portfolio]
 *     security: []
 *     parameters:
 *       - { in: path, name: username, required: true, schema: { type: string, maxLength: 60 } }
 *     responses:
 *       200:
 *         description: The full public portfolio
 *         headers:
 *           Cache-Control: { schema: { type: string, example: 'public, max-age=60' } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429:
 *         description: Too many requests from this client
 */
router.get(
  '/:username',
  readLimiter,
  asyncHandler(async (req, res: Response) => {
    const username = String(req.params.username ?? '');
    if (!USERNAME.test(username)) {
      res.status(404).json({
        error: { message: 'Portfolio not found', code: 'PORTFOLIO_NOT_FOUND', status: 404 },
      });
      return;
    }
    const data = await service.getPublicPortfolio(username);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ success: true, data });
  })
);

export default router;
