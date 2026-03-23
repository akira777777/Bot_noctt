# Bot_noct - Telegram Lead Management Bot

Enhanced Telegram бот для управления лидами и клиентами с расширенным функционалом.

## 🚀 Возможности

### Основные функции

- **Управление лидами** - создание, редактирование, статусы
- **Каталог товаров** - просмотр и заказ товаров через бота
- **Админ-панель** - веб-интерфейс для управления
- **Telegram WebApp** - интерактивные формы

### Производительность и оптимизации

- **Redis кэширование** - быстрый отклик и низкая нагрузка на БД
- **Bull очереди** - асинхронная обработка сообщений и задач
- **Compression** - автоматическое сжатие HTTP ответов
- **Rate limiting** - защита от спама и DDoS

### Мониторинг и надёжность

- **Health checks** - `/healthz`, `/readyz`, `/livez`, `/health`
- **Graceful shutdown** - корректное завершение работы
- **Структурированное логирование** - Pino + Winston
- **Мониторинг памяти** - автоматические алерты

### Безопасность

- **Helmet.js** - security headers
- **API Key аутентификация** - для admin endpoints
- **CORS настройка** - контроль доступа
- **Rate limiting** - ограничение запросов

## 📋 Требования

- Node.js 18+
- Redis 6+ (для кэширования и очередей)
- Docker & Docker Compose (опционально)

## 🛠 Установка

### Быстрый старт

```bash
# Клонирование репозитория
git clone <repo-url>
cd Bot_noct

# Установка зависимостей
npm install

# Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env с вашими данными

# Запуск с Docker
docker compose up -d

# Или запуск вручную
npm start
```

### Docker Compose

```bash
# Запуск всех сервисов
docker compose up -d

# Просмотр логов
docker compose logs -f

# Остановка
docker compose down
```

## ⚙️ Конфигурация

### Переменные окружения

```env
# Telegram
BOT_TOKEN=your_bot_token
ADMIN_ID=your_telegram_id

# База данных
DB_PATH=./data/bot.sqlite

# Redis (кэш и очереди)
REDIS_HOST=localhost
REDIS_PORT=6379

# Опционально
NODE_ENV=production
LOG_LEVEL=info
```

Подробнее: [DEPLOYMENT.md](DEPLOYMENT.md)

## 📡 API Endpoints

### Публичные

| Endpoint           | Метод | Описание        |
| ------------------ | ----- | --------------- |
| `/api/leads`       | POST  | Создать лид     |
| `/api/leads/:id`   | GET   | Получить лид    |
| `/api/catalog`     | GET   | Каталог товаров |
| `/api/catalog/:id` | GET   | Товар           |

### Admin (требуется API Key)

| Endpoint                   | Метод | Описание     |
| -------------------------- | ----- | ------------ |
| `/api/admin/leads`         | GET   | Все лиды     |
| `/api/admin/leads/:id`     | PUT   | Обновить лид |
| `/api/admin/conversations` | GET   | Диалоги      |
| `/api/admin/broadcast`     | POST  | Рассылка     |
| `/api/admin/users`         | GET   | Пользователи |

### Health Checks

| Endpoint   | Описание         |
| ---------- | ---------------- |
| `/healthz` | Liveness probe   |
| `/readyz`  | Readiness probe  |
| `/livez`   | Liveness check   |
| `/health`  | Детальный статус |

## 🏗 Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                      Telegram API                         │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                     Telegraf Bot                         │
├─────────────────────────────────────────────────────────┤
│  Handlers │ Repositories │ Services │ Cache │ Queue     │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   Express Web Server                     │
├─────────────────────────────────────────────────────────┤
│ Routes │ Middleware │ Compression │ Rate Limiting        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  Data Layer                              │
├─────────────────────────────────────────────────────────┤
│  SQLite │ Redis (Cache) │ Redis (Bull Queue)           │
└─────────────────────────────────────────────────────────┘
```

## 📁 Структура проекта

```
Bot_noct/
├── src/
│   ├── bot.js              # Telegram bot initialization
│   ├── config/
│   │   └── env.js          # Environment configuration
│   ├── db/
│   │   ├── sqlite.js       # Database connection
│   │   └── migrations/     # Database migrations
│   ├── handlers/
│   │   ├── admin.js        # Admin command handlers
│   │   └── client.js       # Client handlers
│   ├── repositories/       # Data access layer
│   ├── services/
│   │   ├── cache-service.js    # Redis cache
│   │   ├── queue-service.js    # Bull queues
│   │   ├── lead-service.js     # Lead business logic
│   │   └── conversation-service.js
│   ├── ui/
│   │   ├── keyboards.js    # Inline keyboards
│   │   └── messages.js     # Message templates
│   ├── utils/
│   │   ├── logger-enhanced.js  # Structured logging
│   │   ├── graceful-shutdown.js
│   │   └── rate-limiter.js
│   └── web/
│       ├── server.js       # Express app
│       ├── middleware/     # Express middleware
│       └── routes/         # API routes
├── web/                    # Next.js admin panel
│   └── app/admin/         # Admin dashboard
├── docker-compose.yml
├── Dockerfile
└── DEPLOYMENT.md          # Deployment guide
```

## 🔧 Разработка

```bash
# Режим разработки с hot reload
npm run dev

# Тесты
npm test

# Линтинг
npm run lint

# Форматирование
npm run format
```

## 📊 Мониторинг

### Health Checks

```bash
# Базовый check
curl http://localhost:3000/healthz

# Readiness (проверяет все компоненты)
curl http://localhost:3000/readyz

# Детальный статус
curl http://localhost:3000/health
```

### Метрики

```bash
# Статистика очередей (admin)
curl -H "X-API-Key: your-key" http://localhost:3000/api/admin/queues

# Статистика кэша
curl -H "X-API-Key: your-key" http://localhost:3000/api/admin/cache

# Использование памяти (dev)
curl http://localhost:3000/debug/memory
```

## 🐳 Docker

### Образы

```bash
# Сборка
docker build -t bot-noct .

# Запуск
docker run -d \
  -e BOT_TOKEN=your_token \
  -e REDIS_HOST=redis \
  --link redis \
  bot-noct
```

### Docker Compose

```bash
# Запуск с Redis
docker compose up -d bot redis

# Масштабирование
docker compose up -d --scale bot=3
```

## 🔒 Безопасность

- [ ] Используйте сильный `API_SECRET`
- [ ] Настройте `CORS_ORIGIN` для продакшена
- [ ] Включите `LOG_FORMAT=json` в продакшене
- [ ] Настройте firewall для Redis порта
- [ ] Используйте TLS для webhook URL

## 📈 Масштабирование

### Горизонтальное масштабирование

```bash
# Запуск нескольких инстансов
docker compose up -d --scale bot=5
```

### Очереди

- Сообщения обрабатываются асинхронно
- Автоматический retry при ошибках
- Rate limiting предотвращает перегрузку

## 🐛 Troubleshooting

### Бот не запускается

```bash
# Проверьте токен
curl https://api.telegram.org/bot${BOT_TOKEN}/getMe

# Проверьте логи
docker compose logs bot
```

### Ошибки подключения к Redis

```bash
# Проверьте Redis
redis-cli ping

# Docker
docker compose logs redis
```

## 📝 Лицензия

MIT

## 🤝 Contributing

См. [CONTRIBUTING.md](CONTRIBUTING.md)
