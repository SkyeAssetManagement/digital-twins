/**
 * Image Analysis API
 * Standardized endpoint for analyzing marketing images
 */

import { imageService } from '../src/services/image.service.js';
import { asyncHandler } from '../src/utils/error-handler.js';
import { validate, validationPatterns } from '../src/middleware/validation.middleware.js';

// Apply validation middleware
const validateRequest = validate(validationPatterns.analyzeImage);

export default asyncHandler(async function handler(req, res) {
  if (req.method !== 'POST') {
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

  const { imageData } = req.validated || req.body;

  // Use service layer
    const result = await imageService.analyzeImage(imageData);
    return res.status(200).json(result);

});