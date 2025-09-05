/**
 * Dataset Configuration API
 * Standardized endpoint for retrieving dataset configuration
 */

import { datasetService } from '../src/services/dataset.service.js';
import { asyncHandler } from '../src/utils/error-handler.js';
import { validate, validationPatterns } from '../src/middleware/validation.middleware.js';

// Apply validation middleware
const validateRequest = validate(validationPatterns.datasetOperation);

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

  const { datasetId } = req.validated || req.params || {};

  // Use service layer
  const config = await datasetService.getConfig(datasetId);
  return res.status(200).json(datasetService.formatResponse(config));
});