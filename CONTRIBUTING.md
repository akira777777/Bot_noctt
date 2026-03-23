# Contributing to Bot_noct

## Development Workflow

### 1. Setup Development Environment

```bash
# Clone the repository
git clone <repo-url>
cd Bot_noct

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start Redis
docker run -d -p 6379:6379 redis:alpine

# Run development server
npm run dev
```

### 2. Branch Naming

Use the following conventions:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `perf/` - Performance improvements
- `test/` - Adding tests

Example:

```bash
git checkout -b feature/pagination-catalog
git checkout -b fix/session-timeout
```

### 3. Making Changes

1. Create a new branch for your changes
2. Make your changes following the code style
3. Add tests for new functionality
4. Update documentation if needed
5. Commit your changes

### 4. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add pagination to catalog
fix: resolve session timeout issue
docs: update API documentation
refactor: optimize database queries
test: add integration tests for leads
perf: improve cache hit rate
```

### 5. Code Style

- Use ES6+ syntax
- Prefer `const` over `let`
- Use async/await for asynchronous code
- Add JSDoc comments for functions
- Maximum line length: 100 characters

### 6. Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/api.integration.test.js

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### 7. Pull Request Process

1. Update the README.md if needed
2. Update the CHANGELOG.md
3. Ensure all tests pass
4. Request review from maintainers
5. Squash commits before merging

## Project Structure

```
src/
├── bot.js           # Bot initialization
├── config/          # Configuration
├── db/              # Database layer
│   ├── sqlite.js
│   └── migrations/
├── handlers/        # Telegram handlers
├── repositories/    # Data access
├── services/        # Business logic
│   ├── cache-service.js
│   ├── queue-service.js
│   └── ...
├── ui/              # UI components
│   ├── keyboards.js
│   └── messages.js
├── utils/           # Utilities
│   ├── logger-enhanced.js
│   └── graceful-shutdown.js
└── web/             # Express server
    ├── server.js
    ├── middleware/
    └── routes/
```

## Adding New Features

### 1. Database Changes

Create a new migration file:

```bash
# src/db/migrations/008_new_feature.js
module.exports = {
  up: (db) => {
    db.exec(`ALTER TABLE leads ADD COLUMN new_column TEXT`);
  },
  down: (db) => {
    db.exec(`ALTER TABLE leads DROP COLUMN new_column`);
  },
};
```

### 2. New Service

```javascript
// src/services/new-service.js
const log = require("../utils/logger-enhanced");

class NewService {
  constructor(options) {
    this.db = options.db;
    this.cache = options.cache;
  }

  async doSomething() {
    log.info("Doing something", { context: "new-service" });
    // implementation
  }
}

module.exports = { NewService };
```

### 3. New API Route

```javascript
// src/web/routes/new-route.js
const express = require("express");
const { asyncHandler } = require("../middleware/error-handler");

const router = express.Router();

router.get(
  "/resource",
  asyncHandler(async (req, res) => {
    const data = await getData();
    res.json({ success: true, data });
  }),
);

module.exports = { router };
```

## Best Practices

### Error Handling

```javascript
// Use try/catch with async/await
try {
  const result = await service.doSomething();
  res.json({ success: true, data: result });
} catch (error) {
  log.error("Operation failed", error, { context: "my-operation" });
  next(error); // Pass to error handler
}
```

### Logging

```javascript
// Use structured logging
log.info("User action", {
  userId: user.id,
  action: "create_lead",
  leadId: lead.id,
});

// Use child loggers for components
const componentLog = log.child({ component: "catalog" });
componentLog.debug("Processing request", { productId });
```

### Caching

```javascript
// Check cache first
const cached = await cache.get(`key:${id}`);
if (cached) {
  return JSON.parse(cached);
}

// Fetch and cache
const data = await fetchData();
await cache.set(`key:${id}`, JSON.stringify(data), { ttl: 300 });
return data;
```

### Rate Limiting

```javascript
// Use the rate limiter middleware
const limiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: "Too many requests",
});

app.use("/api", limiter, routes);
```

## Debugging

### Enable Debug Mode

```bash
LOG_LEVEL=debug npm run dev
```

### View Queue Status

```bash
curl -H "X-API-Key: your-key" \
  http://localhost:3000/api/admin/queues
```

### Check Health

```bash
curl http://localhost:3000/health
```

## Questions?

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Be descriptive in your issue titles
