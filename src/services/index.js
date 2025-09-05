/**
 * Services Index
 * Exports all service instances
 */

export { BaseService } from './base.service.js';
export { datasetService } from './dataset.service.js';
export { responseService } from './response.service.js';
export { imageService } from './image.service.js';

// Re-export as default object for convenience
import { datasetService } from './dataset.service.js';
import { responseService } from './response.service.js';
import { imageService } from './image.service.js';

export default {
  dataset: datasetService,
  response: responseService,
  image: imageService
};