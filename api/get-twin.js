/**
 * Get Digital Twin API
 * Standardized endpoint for retrieving digital twin personas
 */

import { responseService } from '../src/services/response.service.js';
import { asyncHandler } from '../src/utils/error-handler.js';
import { validate, validationPatterns } from '../src/middleware/validation.middleware.js';

// Apply validation middleware
const validateRequest = validate(validationPatterns.getTwin);

export default asyncHandler(async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  // Run validation
  await new Promise((resolve, reject) => {
    validateRequest(req, res, (err) => err ? reject(err) : resolve());
  });

  const { datasetId, segment, variant } = req.validated || req.params || {};

  // Use service layer
  const twin = await responseService.getTwin(datasetId, segment, parseInt(variant) || 0);
  return res.status(200).json(twin);
});