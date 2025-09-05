# Setup and Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Running the Application](#running-the-application)
6. [Testing](#testing)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- **Node.js:** v22.0.0 or higher
- **PostgreSQL:** v15.0 or higher (with pgvector extension)
- **Git:** Latest version
- **npm:** v10.0.0 or higher

### Optional Software
- **Redis:** v7.0 or higher (for caching)
- **Docker:** For containerized deployment
- **PM2:** For process management in production

## Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/digital-twins.git
cd digital-twins
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=digital_twins
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SSL=false

# API Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Redis Configuration (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Embedding Configuration
EMBEDDING_PROVIDER=openai-small
EMBEDDING_DIMENSION=1536

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Rate Limiting
RATE_LIMIT_ENABLED=false
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Database Setup

#### Install PostgreSQL with pgvector

**macOS:**
```bash
brew install postgresql@15
brew install pgvector
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-15 postgresql-15-pgvector
```

**Windows:**
Download PostgreSQL from https://www.postgresql.org/download/windows/
Install pgvector extension separately

#### Create Database
```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE digital_twins;

-- Connect to database
\c digital_twins;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tables (run migration)
\q
```

Run migrations:
```bash
npm run migrate
```

### 5. Initialize Dataset
```bash
npm run init-dataset
```

This will:
- Load survey data
- Process Excel/CSV files
- Generate initial embeddings
- Create persona vectors

## Environment Configuration

### Development Configuration
```javascript
// config/development.json
{
  "server": {
    "port": 3000,
    "cors": {
      "origin": "*"
    }
  },
  "database": {
    "pool": {
      "min": 2,
      "max": 10
    }
  },
  "cache": {
    "ttl": 3600
  }
}
```

### Production Configuration
```javascript
// config/production.json
{
  "server": {
    "port": 8080,
    "cors": {
      "origin": "https://your-domain.com"
    }
  },
  "database": {
    "pool": {
      "min": 10,
      "max": 50
    },
    "ssl": {
      "rejectUnauthorized": false
    }
  },
  "cache": {
    "ttl": 86400
  }
}
```

## Running the Application

### Development Mode
```bash
npm run dev
```
Server starts at http://localhost:3000

### Production Mode
```bash
npm run build
npm start
```

### Using PM2 (Production)
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'digital-twins',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

## Testing

### Run All Tests
```bash
npm test
```

### Run Unit Tests
```bash
npm run test:unit
```

### Run Integration Tests
```bash
npm run test:integration
```

### Generate Coverage Report
```bash
npm run test:coverage
```

### Run Specific Test
```bash
node test/unit/test-logger.js
```

## Production Deployment

### 1. Server Requirements
- **CPU:** 2+ cores
- **RAM:** 4GB minimum, 8GB recommended
- **Storage:** 20GB SSD
- **OS:** Ubuntu 20.04 LTS or newer

### 2. Using Docker

**Dockerfile:**
```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
    depends_on:
      - postgres
      - redis
    
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: digital_twins
      POSTGRES_USER: dbuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Build and run:
```bash
docker-compose up -d
```

### 3. Cloud Deployment

#### AWS Deployment
1. **EC2 Setup:**
   - Launch t3.medium instance
   - Configure security groups (ports 80, 443, 22)
   - Install Node.js and dependencies

2. **RDS PostgreSQL:**
   - Create PostgreSQL 15 instance
   - Enable pgvector extension
   - Configure connection pooling

3. **ElastiCache Redis:**
   - Create Redis cluster
   - Configure security groups

#### Heroku Deployment
```bash
# Install Heroku CLI
# Create app
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Add Redis
heroku addons:create heroku-redis:hobby-dev

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set OPENAI_API_KEY=your-key
heroku config:set ANTHROPIC_API_KEY=your-key

# Deploy
git push heroku main
```

#### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
```

### 4. NGINX Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. SSL/TLS Setup
```bash
# Using Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Monitoring

### Health Check Endpoint
```bash
curl http://localhost:3000/health
```

### Logging
Logs are stored in:
- Development: Console output
- Production: `/logs/` directory

### Monitoring Tools
- **PM2:** Built-in monitoring
- **New Relic:** Application performance
- **Datadog:** Infrastructure monitoring
- **Sentry:** Error tracking

## Backup and Recovery

### Database Backup
```bash
# Backup
pg_dump -U username -h localhost digital_twins > backup.sql

# Restore
psql -U username -h localhost digital_twins < backup.sql
```

### Automated Backups
```bash
# Add to crontab
0 2 * * * pg_dump -U username digital_twins | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
```

## Performance Tuning

### PostgreSQL Optimization
```sql
-- Increase shared buffers
ALTER SYSTEM SET shared_buffers = '256MB';

-- Optimize for SSD
ALTER SYSTEM SET random_page_cost = 1.1;

-- Increase work memory
ALTER SYSTEM SET work_mem = '4MB';

-- Reload configuration
SELECT pg_reload_conf();
```

### Node.js Optimization
```javascript
// Use cluster mode
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Start server
}
```

## Security Checklist

- [ ] Environment variables secured
- [ ] API keys rotated regularly
- [ ] SSL/TLS enabled
- [ ] Rate limiting configured
- [ ] Input validation implemented
- [ ] SQL injection prevention
- [ ] XSS protection enabled
- [ ] CORS properly configured
- [ ] Dependencies updated
- [ ] Security headers set

## Common Issues and Solutions

### Issue: Database connection failed
**Solution:**
1. Check PostgreSQL is running
2. Verify connection credentials
3. Check firewall/security groups
4. Ensure pgvector extension is installed

### Issue: High memory usage
**Solution:**
1. Increase Node.js heap size: `node --max-old-space-size=4096`
2. Implement connection pooling
3. Clear caches periodically
4. Use streaming for large datasets

### Issue: Slow response times
**Solution:**
1. Enable Redis caching
2. Optimize database queries
3. Use database indexes
4. Implement request queuing

## Support

For additional help:
- Documentation: `/docs`
- Issues: GitHub Issues
- Email: support@your-domain.com