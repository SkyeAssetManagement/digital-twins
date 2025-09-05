import { SemanticResponseEngine } from './src/digital_twins/semantic_response_engine.js';
import { createUnifiedVectorStore } from './src/vector_db/unified_vector_store.js';

// Test marketing content samples
const testContent = {
  highSustainability: `
    Introducing our revolutionary eco-friendly surf gear made from 100% recycled ocean plastic. 
    Every purchase helps clean our oceans and supports marine conservation projects. 
    Carbon-neutral shipping and plastic-free packaging. We're B-Corp certified and give back 
    1% of sales to environmental causes. Join the sustainable surf movement!
  `,
  
  mixedMessage: `
    Premium performance boardshorts with some recycled materials. High-quality construction 
    meets style. Now on sale - 30% off! Limited edition designs inspired by pro surfers. 
    Built to last with our advanced fabric technology.
  `,
  
  pureLifestyle: `
    Epic waves, sunset sessions, and good times with the crew! Check out our latest 
    beachwear collection. Party at the beach, live the dream lifestyle. Hot summer vibes, 
    cold beers, and perfect barrels. The ultimate surf experience starts here!
  `,
  
  valueProposition: `
    MEGA SALE! Up to 70% off all surf gear! Unbeatable prices on quality boardshorts, 
    wetsuits, and accessories. Budget-friendly options that don't compromise on durability. 
    Get professional-grade equipment at fraction of the cost. Limited time offer!
  `,
  
  premiumBrand: `
    Exclusive limited-edition collaboration with world champion surfers. Luxury materials, 
    cutting-edge design, and unparalleled performance. For the discerning surfer who 
    demands excellence. Premium pricing reflects superior quality and heritage craftsmanship.
  `,
  
  noSustainability: `
    High-performance surf gear built for extreme conditions. Maximum durability and comfort. 
    Professional-grade materials. Tested by pros in the world's most challenging waves. 
    Focus on performance, nothing else matters.
  `
};

// Test segments
const testSegments = ['Leader', 'Leaning', 'Learner', 'Laggard'];

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

async function testSemanticEngine() {
  console.log(`${colors.bright}${colors.cyan}=================================`);
  console.log(`SEMANTIC RESPONSE ENGINE TEST SUITE`);
  console.log(`=================================${colors.reset}\n`);
  
  // Initialize vector store
  const vectorStore = await createUnifiedVectorStore('test-semantic', { embeddingProvider: 'local-minilm' });
  
  // Test each segment with each content type
  for (const segment of testSegments) {
    console.log(`${colors.bright}${colors.blue}Testing Segment: ${segment}${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(40)}${colors.reset}\n`);
    
    // Create test twin
    const twin = {
      id: `test-${segment.toLowerCase()}`,
      segment: segment,
      persona: { name: `${segment} Test Persona` },
      valueSystem: {},
      characteristics: []
    };
    
    // Create semantic engine
    const engine = new SemanticResponseEngine(twin, vectorStore);
    await engine.initialize();
    
    // Test each content type
    for (const [contentType, content] of Object.entries(testContent)) {
      console.log(`${colors.yellow}Content Type: ${contentType}${colors.reset}`);
      console.log(`Content: ${content.substring(0, 100).trim()}...`);
      
      try {
        const startTime = Date.now();
        const response = await engine.generateSemanticResponse(content);
        const responseTime = Date.now() - startTime;
        
        console.log(`${colors.green}Response (${responseTime}ms):${colors.reset} ${response.text}`);
        console.log(`Sentiment: ${response.sentiment} | Purchase Intent: ${response.purchaseIntent}`);
        
        // Display top themes
        if (response.themes) {
          const topThemes = Object.entries(response.themes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([theme, score]) => `${theme}:${score.toFixed(2)}`)
            .join(', ');
          console.log(`Top Themes: ${topThemes}`);
        }
        
        console.log();
      } catch (error) {
        console.log(`${colors.red}Error: ${error.message}${colors.reset}\n`);
      }
    }
    
    console.log();
  }
  
  // Performance test
  console.log(`${colors.bright}${colors.cyan}PERFORMANCE TEST${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(40)}${colors.reset}\n`);
  
  const perfTwin = {
    id: 'perf-test',
    segment: 'Leader',
    persona: { name: 'Performance Test' },
    valueSystem: {},
    characteristics: []
  };
  
  const perfEngine = new SemanticResponseEngine(perfTwin, vectorStore);
  await perfEngine.initialize();
  
  const iterations = 10;
  const times = [];
  
  console.log(`Running ${iterations} iterations...`);
  for (let i = 0; i < iterations; i++) {
    const content = testContent.mixedMessage;
    const start = Date.now();
    await perfEngine.generateSemanticResponse(content);
    const time = Date.now() - start;
    times.push(time);
    process.stdout.write('.');
  }
  console.log();
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  console.log(`\nPerformance Results:`);
  console.log(`Average: ${avgTime.toFixed(2)}ms`);
  console.log(`Min: ${minTime}ms`);
  console.log(`Max: ${maxTime}ms`);
  console.log(`Cache benefit: ${((maxTime - minTime) / maxTime * 100).toFixed(1)}% improvement`);
  
  // Test response uniqueness
  console.log(`\n${colors.bright}${colors.cyan}RESPONSE UNIQUENESS TEST${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(40)}${colors.reset}\n`);
  
  const uniquenessContent = testContent.mixedMessage;
  const responses = new Set();
  
  console.log(`Generating 5 responses for same content...`);
  for (let i = 0; i < 5; i++) {
    const response = await perfEngine.generateSemanticResponse(uniquenessContent);
    responses.add(response.text);
    console.log(`${i + 1}. ${response.text.substring(0, 60)}...`);
  }
  
  const uniquenessRate = (responses.size / 5 * 100).toFixed(0);
  console.log(`\nUniqueness rate: ${uniquenessRate}% (${responses.size}/5 unique responses)`);
  
  // Close vector store
  await vectorStore.close();
  
  console.log(`\n${colors.bright}${colors.green}Test suite completed!${colors.reset}`);
}

// Run tests
testSemanticEngine().catch(console.error);