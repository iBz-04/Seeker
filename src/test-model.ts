// test-model.ts
// This script checks which language model is configured and prints its identifier.

import { getModel } from './ai/providers';

async function testModel() {
  try {
    const model = getModel();
    // The model object may have a `modelId` property or similar identifier.
    // We'll attempt to log common properties.
    console.log('✅ Model configuration loaded successfully.');
    console.log('Model details:');
    // Print the whole model object for inspection (may contain sensitive info).
    console.log(model);
    // If modelId exists, print it separately.
    if ('modelId' in model) {
      console.log('Model ID:', (model as any).modelId);
    }
  } catch (error) {
    console.error('❌ Error loading model configuration:', error);
  }
}

testModel();
