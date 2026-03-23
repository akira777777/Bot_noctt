# Улучшения БД и соединений бэкенда

## Сводка изменений

Выполнен рефакторинг системы базы данных и HTTP-соединений для повышения надёжности, наблюдаемости и отказоустойчивости.

## 1. DatabaseConnectionManager (`src/db/connection.js`)

### Новые возможности:
- **Retry логика** - автоматические повторные попытки при временных ошибках БД (SQLite_BUSY, SQLITE_LOCKED, etc.)
- **Health checks** - периодическая проверка состояния соединения каждые 30 секунд
- **Graceful shutdown** - корректное завершение с ожиданием завершения транзакций
- **Busy timeout** - настройка таймаута ожидания при блокировках
- **Pending transactions tracking** - отслеживание активных транзакций

### API:
```javascript
const manager = new DatabaseConnectionManager(dbPath, {
  maxRetries: 3,
  retryDelayMs: 100,
  healthCheckIntervalMs: 30000,
  busyTimeout: 5000,
});

await manager.connect();

// Выполнение с retry
await manager.execute((db) => {
  return db.prepare("SELECT * FROM users").all();
}, "getUsers");

// Транзакция с retry
await manager.transaction(() => {
  // transaction body
}, "myTransaction");

// Health check
const health = manager.getHealth();
// { isHealthy, lastError, pendingTransactions, isShuttingDown }

// Graceful shutdown
await manager.shutdown(30000);
```

## 2. Enhanced Web Server (`src/web/enhanced-server.js`)

### Новые возможности:
- **Rate limiting** - ограничение 100 запросов/минуту с клиента
- **Request timeouts** - таймаут 30 секунд на запрос
- **Graceful shutdown** - корректное завершение HTTP-сервера
- **Улучшенные security headers** - X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy
- **Health check с БД** - `/healthz` проверяет состояние базы данных

### Rate Limit Headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1710660000
```

### Graceful Shutdown Flow:
1. Получение сигнала SIGTERM/SIGINT
2. Остановка приёма новых HTTP-соединений
3. Ожидание завершения активных запросов (30 сек таймаут)
4. Остановка бота
5. Graceful shutdown БД
6. Остановка rate limiter
7. Завершение процесса

## 3. Обновлённые репозитории (`src/repositories/index.js`)

### Улучшения:
- Поддержка `DatabaseConnectionManager` (execute/transaction методы)
- Обратная совместимость с сырым `better-sqlite3` соединением
- Health check endpoint в репозиториях

## 4. Обновлённый `index.js`

### Улучшения:
- Использование `DatabaseConnectionManager` для управления БД
- Graceful shutdown через `GracefulShutdown` класс
- Улучшенная обработка ошибок
- Cleanup ресурсов при shutdown

## Health Check Endpoint

```bash
GET /healthz
```

### Ответ (healthy):
```json
{
  "ok": true,
  "service": "bot_noct_web",
  "status": "healthy",
  "database": {
    "isHealthy": true,
    "pendingTransactions": 0,
    "isShuttingDown": false
  }
}
```

### Ответ (unhealthy):
```json
{
  "ok": false,
  "service": "bot_noct_web",
  "status": "unhealthy",
  "database": {
    "isHealthy": false,
    "lastError": "...",
    "pendingTransactions": 2
  }
}
```

## Конфигурация

### Переменные окружения:
```env
# БД (без изменений)
DB_PATH=./data/bot.sqlite

# Таймауты (необязательные)
REQUEST_TIMEOUT_MS=30000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
SHUTDOWN_TIMEOUT_MS=30000
```

## Тестирование

Все существующие тесты проходят:
```bash
npm test
# ✔ 13 tests passed
```

## Мониторинг

### Логи при shutdown:
```
[INFO] Received SIGTERM, starting graceful shutdown...
[INFO] HTTP server closed, no longer accepting connections
[DEBUG] Waiting for 2 connections to close...
[INFO] Database shutdown complete
[INFO] Graceful shutdown completed in 150ms
```

### Логи при retry:
```
[DEBUG] Connecting to database at ./data/bot.sqlite (attempt 1)
[INFO] Database connected successfully
[ERROR] Database operation 'getUsers' failed, retrying...
[DEBUG] Waiting for 3 pending transactions...
```

## Обратная совместимость

Все изменения обратно совместимы:
- Старый код использующий `createDatabase()` продолжает работать
- Репозитории поддерживают оба режима (Manager и raw db)
- API endpoints не изменились

## Рекомендации по production

1. **Health checks**: Настройте мониторинг на `/healthz`
2. **Rate limiting**: При необходимости настройте белый список для внутренних IP
3. **Timeouts**: При медленных запросах увеличьте `REQUEST_TIMEOUT_MS`
4. **Graceful shutdown**: Убедитесь, что orchestrator (Docker/K8s) даёт достаточно времени на shutdown
