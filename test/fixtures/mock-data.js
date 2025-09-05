/**
 * Mock Data for Testing
 * Provides consistent test data across all tests
 */

export const mockSurveyData = {
  questions: [
    { text: 'How important is sustainability?', column: 5, type: 'scale' },
    { text: 'Price sensitivity', column: 6, type: 'scale' },
    { text: 'Brand loyalty', column: 7, type: 'scale' }
  ],
  responses: [
    {
      respondentId: 'TEST001',
      segment: 'Leader',
      responses: {
        'How important is sustainability?': 7,
        'Price sensitivity': 2,
        'Brand loyalty': 6
      }
    },
    {
      respondentId: 'TEST002',
      segment: 'Laggard',
      responses: {
        'How important is sustainability?': 2,
        'Price sensitivity': 7,
        'Brand loyalty': 3
      }
    }
  ]
};

export const mockPersonaData = {
  segment: 'Leader',
  valueSystem: {
    sustainability: 0.95,
    priceConsciousness: 0.2,
    quality: 0.85,
    brandLoyalty: 0.8,
    innovation: 0.9,
    socialResponsibility: 0.95
  },
  characteristics: {
    primaryMotivation: 'Environmental and social responsibility',
    purchasingBehavior: 'Willing to pay premium for sustainable products',
    brandLoyalty: 'High loyalty to values-aligned brands'
  },
  demographics: {
    age: '25-55',
    income: 'Above average',
    education: 'Higher education'
  }
};

export const mockAdContent = {
  id: 'test-ad-001',
  title: 'Sustainable Fashion Collection',
  body: 'Discover our eco-friendly clothing line made from recycled materials.',
  targetSegment: 'Leader',
  imageUrl: 'https://example.com/ad-image.jpg'
};

export const mockApiRequest = {
  body: {
    adContent: mockAdContent.body,
    personaId: 'leader-001',
    segment: 'Leader',
    datasetId: 'surf-clothing'
  },
  headers: {
    'content-type': 'application/json'
  }
};

export const mockApiResponse = {
  json: function(data) {
    this.data = data;
    return this;
  },
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  send: function(data) {
    this.sentData = data;
    return this;
  }
};

export const mockDatabaseConfig = {
  host: 'localhost',
  port: 5432,
  database: 'test_digital_twins',
  user: 'test_user',
  password: 'test_password'
};

export const mockEmbedding = new Array(384).fill(0).map(() => Math.random() - 0.5);

export const mockClaudeResponse = {
  content: [{
    text: "As someone deeply committed to sustainability, I'm impressed by your eco-friendly approach. This aligns perfectly with my values."
  }],
  usage: {
    input_tokens: 100,
    output_tokens: 50
  }
};

export const mockPDFContent = {
  text: 'LOHAS Consumer Segments Analysis. Leaders represent 12.4% of the market...',
  numpages: 10,
  info: {
    Title: 'LOHAS Report',
    Author: 'Research Team'
  },
  metadata: {}
};

export const mockPipelineData = {
  input: { value: 5 },
  stages: [
    { name: 'increment', fn: (data) => data.value + 1 },
    { name: 'double', fn: (data) => ({ value: data * 2 }) },
    { name: 'subtract', fn: (data) => data.value - 3 }
  ],
  expectedOutput: { value: 9 }
};

export const mockFileContent = {
  csv: `Respondent ID,LOHAS Segment,Sustainability,Price Sensitivity
TEST001,Leader,7,2
TEST002,Laggard,2,7
TEST003,Leaning,5,4`,
  
  json: {
    config: {
      datasetId: 'test-dataset',
      responseColumns: {
        identifierColumn: 0,
        questionRowIndex: 0,
        subQuestionRowIndex: 1,
        startColumn: 2
      }
    }
  },
  
  excel: {
    headers: ['ID', 'Segment', 'Q1', 'Q2', 'Q3'],
    data: [
      ['001', 'Leader', 7, 2, 6],
      ['002', 'Laggard', 2, 7, 3]
    ]
  }
};

export function createMockRequest(overrides = {}) {
  return {
    ...mockApiRequest,
    ...overrides
  };
}

export function createMockResponse() {
  const res = {
    statusCode: 200,
    data: null,
    sentData: null,
    headers: {},
    
    json: function(data) {
      this.data = data;
      return this;
    },
    
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    
    send: function(data) {
      this.sentData = data || this.data;
      return this;
    },
    
    setHeader: function(key, value) {
      this.headers[key] = value;
      return this;
    }
  };
  
  return res;
}

export function createMockNext() {
  let error = null;
  const next = (err) => {
    error = err;
  };
  next.error = () => error;
  return next;
}

export default {
  mockSurveyData,
  mockPersonaData,
  mockAdContent,
  mockApiRequest,
  mockApiResponse,
  mockDatabaseConfig,
  mockEmbedding,
  mockClaudeResponse,
  mockPDFContent,
  mockPipelineData,
  mockFileContent,
  createMockRequest,
  createMockResponse,
  createMockNext
};