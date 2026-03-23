# Telegram Bot Production Upgrade Strategy

## Executive Summary

This document outlines a comprehensive upgrade strategy for transitioning from the current Node.js/Telegraf/SQLite architecture to a production-ready, scalable Python-based system. The new architecture emphasizes horizontal scalability, security, observability, and high availability while maintaining backward compatibility.

## Current Architecture Analysis

### Existing Stack
| Component | Technology |
|-----------|------------|
| Bot Framework | Telegraf 4.x (Node.js) |
| Database | SQLite (better-sqlite3) |
| Web Server | Express 4.x |
| Frontend | React 18 + Vite 5 |
| Deployment | Render (Web Service) |
| Session Storage | In-memory (repository pattern) |

### Current Features
- Lead management system with multi-step workflow
- Product catalog with inline keyboards
- Admin dashboard (Telegram commands + Mini App)
- User blocking/unblocking
- Admin-client conversation bridge
- Statistics and CSV export
- Webhook verification for Mini App

### Current Limitations
- Single-process architecture limits scalability
- SQLite unsuitable for concurrent writes
- No rate limiting or abuse prevention
- No encryption for sensitive data
- Limited error tracking and observability
- No horizontal scaling capabilities
- Single language support (Russian)

---

## Target Architecture

### Technology Stack
| Component | Technology | Purpose |
|-----------|------------|---------|
| Bot Framework | python-telegram-bot 21.x | Async Telegram Bot API |
| Web Framework | FastAPI 0.115+ | High-performance async web |
| Database | PostgreSQL 16 | Persistent data storage |
| Cache/State | Redis 7 | Session state, rate limiting |
| Task Queue | Celery + Redis | Background job processing |
| Security | HMAC-SHA256, AES-256-GCM | Signature validation, encryption |
| i18n | Babel, python-i18n | Multi-language support |
| Payments | Stripe API, Telegram Payments | Payment processing |
| Monitoring | Sentry, Prometheus, Grafana | Error tracking, metrics |
| Container | Docker 25+ | Application containerization |
| Orchestration | Kubernetes 1.29+ | Container orchestration |
| Ingress | Traefik/Nginx | Load balancing, SSL termination |

### High-Level Architecture

```mermaid
flowchart TB
    subgraph External["External Services"]
        TG[Telegram API]
        Stripe[Stripe API]
        Sentry[Sentry.io]
    end

    subgraph K8s["Kubernetes Cluster"]
        subgraph IngressLayer["Ingress Layer"]
            TR[Traefik Ingress Controller]
        end

        subgraph BotLayer["Bot Services"]
            Bot1[Bot Instance 1]
            Bot2[Bot Instance 2]
            BotN[Bot Instance N]
        end

        subgraph APILayer["API Services"]
            API1[FastAPI Instance 1]
            API2[FastAPI Instance 2]
        end

        subgraph WorkerLayer["Background Workers"]
            Celery1[Celery Worker 1]
            Celery2[Celery Worker 2]
        end

        subgraph DataLayer["Data Layer"]
            PG[(PostgreSQL Primary)]
            PG_R[(PostgreSQL Replica)]
            Redis[(Redis Cluster)]
        end

        subgraph Monitoring["Observability"]
            Prom[Prometheus]
            Graf[Grafana]
        end
    end

    TG -->|Webhook| TR
    TR -->|Route| Bot1
    TR -->|Route| Bot2
    TR -->|Route| API1

    Bot1 -->|Read/Write| Redis
    Bot2 -->|Read/Write| Redis
    API1 -->|Query| PG_R
    API1 -->|Cache| Redis

    Celery1 -->|Process Jobs| PG
    Celery1 -->|Tasks| Redis

    Bot1 -.->|Errors| Sentry
    API1 -.->|Errors| Sentry

    Prom -->|Scrape| Bot1
    Prom -->|Scrape| API1
    Graf -->|Visualize| Prom
```

---

## Component Design

### 1. Bot Service Layer (python-telegram-bot)

#### Architecture Pattern
```mermaid
flowchart LR
    subgraph Handlers["Handler Layer"]
        CMD[Command Handlers]
        MSG[Message Handlers]
        CB[Callback Handlers]
        CONV[Conversation Handlers]
    end

    subgraph Services["Service Layer"]
        LeadSvc[LeadService]
        CatalogSvc[CatalogService]
        PaymentSvc[PaymentService]
        UserSvc[UserService]
        AdminSvc[AdminService]
    end

    subgraph Repositories["Repository Layer"]
        LeadRepo[LeadRepository]
        UserRepo[UserRepository]
        ProductRepo[ProductRepository]
        PaymentRepo[PaymentRepository]
    end

    subgraph Infrastructure["Infrastructure"]
        PG[(PostgreSQL)]
        Redis[(Redis)]
        Cache[Cache Layer]
    end

    CMD --> Services
    MSG --> Services
    CB --> Services
    CONV --> Services

    Services --> Repositories
    Repositories --> PG
    Repositories --> Cache
    Cache --> Redis
```

#### Key Components

**Webhook Handler**
```python
# src/bot/webhook.py
from fastapi import FastAPI, Request, HTTPException
from telegram import Update
import hmac
import hashlib

app = FastAPI()

async def verify_telegram_signature(
    token: str, 
    request_body: bytes, 
    signature: str
) -> bool:
    secret = hmac.new(
        token.encode(), 
        msg=request_body, 
        digestmod=hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(secret, signature)

@app.post(f"/webhook/{BOT_TOKEN}")
async def webhook(request: Request):
    signature = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    body = await request.body()
    
    if not verify_telegram_signature(WEBHOOK_SECRET, body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    update = Update.de_json(json.loads(body), bot)
    await application.process_update(update)
    return {"ok": True}
```

**Conversation State Machine**
```python
# src/bot/conversations/lead_conversation.py
from telegram.ext import ConversationHandler, CommandHandler, MessageHandler

LEAD_STATES = {
    "SELECT_PRODUCT": 1,
    "ENTER_QUANTITY": 2,
    "ENTER_COMMENT": 3,
    "SELECT_CONTACT": 4,
    "CONFIRM": 5
}

lead_conversation = ConversationHandler(
    entry_points=[CommandHandler("start", start_lead)],
    states={
        LEAD_STATES["SELECT_PRODUCT"]: [
            CallbackQueryHandler(select_product, pattern=r"^product:\d+$")
        ],
        LEAD_STATES["ENTER_QUANTITY"]: [
            MessageHandler(filters.TEXT & ~filters.COMMAND, save_quantity)
        ],
        # ... additional states
    },
    fallbacks=[CommandHandler("cancel", cancel_lead)]
)
```

### 2. Database Layer (PostgreSQL)

#### Schema Design

```mermaid
erDiagram
    users ||--o{ leads : creates
    users ||--o{ conversations : participates
    users ||--o{ payments : makes
    products ||--o{ leads : referenced
    leads ||--o{ lead_status_history : tracks
    leads ||--o{ payments : associated

    users {
        bigint id PK
        bigint telegram_id UK
        varchar username
        varchar first_name
        varchar last_name
        varchar language_code
        boolean is_blocked
        boolean is_admin
        timestamp created_at
        timestamp updated_at
    }

    products {
        serial id PK
        varchar code UK
        varchar title
        text description
        varchar price_text
        boolean is_active
        int sort_order
        timestamp created_at
    }

    leads {
        serial id PK
        bigint user_id FK
        int product_id FK
        int quantity
        text comment
        varchar contact_method
        varchar contact_value
        varchar status
        bigint admin_id FK
        timestamp created_at
        timestamp updated_at
    }

    lead_status_history {
        serial id PK
        int lead_id FK
        varchar old_status
        varchar new_status
        bigint changed_by
        text reason
        timestamp created_at
    }

    conversations {
        serial id PK
        bigint client_id FK
        bigint admin_id FK
        text message_text
        varchar sender_role
        boolean is_read
        timestamp created_at
    }

    payments {
        serial id PK
        int lead_id FK
        bigint user_id FK
        varchar provider
        varchar provider_payment_id
        decimal amount
        varchar currency
        varchar status
        jsonb metadata
        timestamp created_at
    }
```

#### Indexing Strategy

```sql
-- High-frequency query indexes
CREATE INDEX CONCURRENTLY idx_leads_user_id_status ON leads(user_id, status) 
    WHERE status IN ('new', 'in_progress');

CREATE INDEX CONCURRENTLY idx_leads_created_at ON leads(created_at DESC);

CREATE INDEX CONCURRENTLY idx_conversations_client_admin ON conversations(client_id, admin_id, created_at DESC);

-- Partial index for active products
CREATE INDEX CONCURRENTLY idx_products_active ON products(id) WHERE is_active = true;

-- GIN index for JSON metadata
CREATE INDEX CONCURRENTLY idx_payments_metadata ON payments USING GIN(metadata);

-- Composite index for admin dashboard
CREATE INDEX CONCURRENTLY idx_leads_admin_status ON leads(admin_id, status, created_at DESC);
```

### 3. Redis State Management

#### Key Structure

```
# Session State
bot:session:{user_id} -> Hash {
    flow: str,
    step: str,
    draft: json,
    language: str,
    last_activity: timestamp
}

# Rate Limiting
rate_limit:user:{user_id} -> String (counter with TTL)
rate_limit:ip:{ip_address} -> String (counter with TTL)

# Admin State
admin:active_client:{admin_id} -> String (client_id)

# Cache
product:list -> String (JSON array, TTL: 300s)
product:{product_id} -> String (JSON object, TTL: 600s)
stats:leads:daily:{date} -> String (cached count, TTL: 3600s)

# Distributed Locks
lock:lead:create:{user_id} -> String (UUID with TTL)
lock:payment:process:{payment_id} -> String (UUID with TTL)
```

#### Rate Limiting Implementation

```python
# src/infrastructure/rate_limiter.py
import redis
from datetime import datetime

class RateLimiter:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
    
    async def check_rate_limit(
        self, 
        key: str, 
        max_requests: int, 
        window_seconds: int
    ) -> tuple[bool, int]:
        """
        Returns: (allowed, remaining_requests)
        """
        pipe = self.redis.pipeline()
        now = datetime.utcnow().timestamp()
        window_start = now - window_seconds
        
        # Remove old entries
        pipe.zremrangebyscore(f"rate_limit:{key}", 0, window_start)
        
        # Count current requests
        pipe.zcard(f"rate_limit:{key}")
        
        # Add current request
        pipe.zadd(f"rate_limit:{key}", {str(now): now})
        pipe.expire(f"rate_limit:{key}", window_seconds)
        
        results = pipe.execute()
        current_count = results[1]
        
        if current_count >= max_requests:
            return False, 0
        
        return True, max_requests - current_count - 1
```

### 4. Security Layer

#### HMAC Webhook Validation

```python
# src/security/webhook_validator.py
import hmac
import hashlib
import secrets
from functools import wraps
from fastapi import HTTPException, Request

class WebhookValidator:
    def __init__(self, secret_token: str):
        self.secret_token = secret_token.encode()
    
    def validate_signature(self, body: bytes, signature: str) -> bool:
        expected = hmac.new(
            self.secret_token,
            body,
            hashlib.sha256
        ).hexdigest()
        return secrets.compare_digest(expected, signature)
    
    async def middleware(self, request: Request, call_next):
        if request.url.path.startswith("/webhook"):
            body = await request.body()
            signature = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
            
            if not self.validate_signature(body, signature):
                raise HTTPException(status_code=401, detail="Invalid signature")
        
        return await call_next(request)
```

#### Data Encryption

```python
# src/security/encryption.py
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os

class DataEncryption:
    def __init__(self, master_key: str):
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=os.urandom(16),
            iterations=480000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(master_key.encode()))
        self.fernet = Fernet(key)
    
    def encrypt(self, data: str) -> str:
        return self.fernet.encrypt(data.encode()).decode()
    
    def decrypt(self, token: str) -> str:
        return self.fernet.decrypt(token.encode()).decode()
```

### 5. Internationalization (i18n)

#### Structure

```
src/i18n/
├── __init__.py
├── config.py
├── middleware.py
└── locales/
    ├── ru.json
    ├── en.json
    └── es.json
```

#### Implementation

```python
# src/i18n/config.py
import json
from pathlib import Path
from typing import Dict

class I18n:
    def __init__(self):
        self.translations: Dict[str, Dict] = {}
        self.load_translations()
    
    def load_translations(self):
        locales_dir = Path(__file__).parent / "locales"
        for file in locales_dir.glob("*.json"):
            lang = file.stem
            with open(file, "r", encoding="utf-8") as f:
                self.translations[lang] = json.load(f)
    
    def get_text(self, key: str, lang: str = "ru", **kwargs) -> str:
        translation = self.translations.get(lang, self.translations["ru"])
        keys = key.split(".")
        
        for k in keys:
            translation = translation.get(k, key)
            if not isinstance(translation, dict):
                break
        
        if isinstance(translation, str):
            return translation.format(**kwargs)
        return key

i18n = I18n()
```

### 6. Payment Integration

#### Stripe Integration

```python
# src/services/payment_service.py
import stripe
from typing import Optional
from models import Payment, Lead

class PaymentService:
    def __init__(self, stripe_secret_key: str):
        stripe.api_key = stripe_secret_key
    
    async def create_payment_intent(
        self, 
        lead: Lead, 
        amount: int, 
        currency: str = "usd"
    ) -> Payment:
        intent = stripe.PaymentIntent.create(
            amount=amount * 100,  # Convert to cents
            currency=currency,
            metadata={
                "lead_id": lead.id,
                "user_id": lead.user_id,
                "product_id": lead.product_id
            }
        )
        
        payment = Payment(
            lead_id=lead.id,
            user_id=lead.user_id,
            provider="stripe",
            provider_payment_id=intent.id,
            amount=amount,
            currency=currency,
            status="pending",
            metadata={"client_secret": intent.client_secret}
        )
        
        return await payment.save()
    
    async def confirm_payment(self, payment_intent_id: str) -> Optional[Payment]:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if intent.status == "succeeded":
            payment = await Payment.get_by_provider_id(payment_intent_id)
            if payment:
                payment.status = "completed"
                await payment.save()
            return payment
        return None
```

### 7. Docker Architecture

#### Dockerfile (Multi-stage)

```dockerfile
# Dockerfile
FROM python:3.12-slim as builder

WORKDIR /app
RUN apt-get update && apt-get install -y gcc libpq-dev

COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.12-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages
COPY --from=builder /root/.local /root/.local

# Copy application
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY alembic.ini .

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 8. Kubernetes Deployment

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: telegram-bot
  labels:
    istio-injection: enabled

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: bot-config
  namespace: telegram-bot
data:
  LOG_LEVEL: "INFO"
  WEBHOOK_PATH: "/webhook"
  MAX_CONNECTIONS: "40"
  REDIS_DB: "0"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: bot-secrets
  namespace: telegram-bot
type: Opaque
stringData:
  BOT_TOKEN: "${BOT_TOKEN}"
  WEBHOOK_SECRET: "${WEBHOOK_SECRET}"
  DATABASE_URL: "${DATABASE_URL}"
  REDIS_URL: "${REDIS_URL}"
  STRIPE_SECRET_KEY: "${STRIPE_SECRET_KEY}"
  ENCRYPTION_KEY: "${ENCRYPTION_KEY}"
  SENTRY_DSN: "${SENTRY_DSN}"

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bot-api
  namespace: telegram-bot
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: bot-api
  template:
    metadata:
      labels:
        app: bot-api
    spec:
      containers:
      - name: api
        image: ghcr.io/yourorg/telegram-bot:latest
        ports:
        - containerPort: 8000
          name: http
        envFrom:
        - configMapRef:
            name: bot-config
        - secretRef:
            name: bot-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: ScheduleAnyway
        labelSelector:
          matchLabels:
            app: bot-api
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - bot-api
              topologyKey: kubernetes.io/hostname

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: bot-api
  namespace: telegram-bot
spec:
  selector:
    app: bot-api
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP

---
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: bot-api-hpa
  namespace: telegram-bot
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: bot-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60

---
# k8s/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: bot-api-pdb
  namespace: telegram-bot
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: bot-api
```

### 9. Monitoring & Observability

#### Sentry Integration

```python
# src/infrastructure/sentry.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.redis import RedisIntegration

def init_sentry(dsn: str, environment: str):
    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
            RedisIntegration(),
        ],
        before_send=filter_sensitive_data,
    )

def filter_sensitive_data(event, hint):
    # Filter out sensitive data from error reports
    if "exception" in event:
        # Remove user tokens, passwords, etc.
        pass
    return event
```

#### Prometheus Metrics

```python
# src/infrastructure/metrics.py
from prometheus_client import Counter, Histogram, Gauge, Info

# Bot metrics
messages_received = Counter(
    "bot_messages_received_total",
    "Total messages received",
    ["handler_type", "chat_type"]
)

commands_processed = Counter(
    "bot_commands_processed_total",
    "Total commands processed",
    ["command"]
)

response_time = Histogram(
    "bot_response_duration_seconds",
    "Response time in seconds",
    ["handler_type"]
)

active_users = Gauge(
    "bot_active_users",
    "Number of active users in last 5 minutes"
)

# Database metrics
db_query_duration = Histogram(
    "db_query_duration_seconds",
    "Database query duration",
    ["operation", "table"]
)

# Business metrics
leads_created = Counter(
    "business_leads_created_total",
    "Total leads created",
    ["source", "product_id"]
)

payments_completed = Counter(
    "business_payments_completed_total",
    "Total completed payments",
    ["provider", "currency"]
)
```

### 10. Admin Dashboard Enhancements

#### Telegram Admin Commands (Enhanced)

```python
# src/bot/handlers/admin_commands.py
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

async def admin_stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Enhanced stats with real-time metrics"""
    stats = await context.bot_data["services"]["admin"].get_detailed_stats()
    
    message = (
        f"📊 <b>Статистика за {stats['period']}</b>\n\n"
        f"👥 Пользователей: {stats['total_users']}\n"
        f"📋 Заявок: {stats['total_leads']}\n"
        f"✅ Конверсия: {stats['conversion_rate']}%\n"
        f"💰 Выручка: ${stats['revenue']}\n\n"
        f"<b>Статусы заявок:</b>\n"
    )
    
    for status, count in stats['by_status'].items():
        message += f"  {status}: {count}\n"
    
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("📈 Графики", callback_data="admin:charts")],
        [InlineKeyboardButton("📤 Экспорт", callback_data="admin:export")],
        [InlineKeyboardButton("🔄 Обновить", callback_data="admin:refresh_stats")]
    ])
    
    await update.message.reply_text(message, reply_markup=keyboard, parse_mode="HTML")

async def admin_broadcast_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Mass messaging with targeting"""
    if not context.args:
        await update.message.reply_text(
            "Использование: /broadcast <target> <message>\n"
            "Targets: all, active, inactive, lead:<id>"
        )
        return
    
    target = context.args[0]
    message = " ".join(context.args[1:])
    
    # Queue broadcast job
    await context.bot_data["celery"].send_task(
        "tasks.broadcast_message",
        args=[target, message],
        countdown=0
    )
    
    await update.message.reply_text(f"✅ Рассылка запущена для: {target}")
```

---

## Migration Strategy

### Phase 1: Infrastructure Setup (Week 1-2)
- [ ] Set up PostgreSQL cluster with primary-replica
- [ ] Deploy Redis cluster
- [ ] Create Kubernetes cluster
- [ ] Set up CI/CD pipeline
- [ ] Configure monitoring (Sentry, Prometheus, Grafana)

### Phase 2: Core Development (Week 3-6)
- [ ] Implement Python bot core with webhook support
- [ ] Migrate database schema to PostgreSQL
- [ ] Implement Redis state management
- [ ] Add security layers (HMAC, encryption)
- [ ] Create Docker containers

### Phase 3: Feature Migration (Week 7-9)
- [ ] Port existing handlers to Python
- [ ] Implement i18n framework
- [ ] Add payment integration
- [ ] Create admin dashboard enhancements
- [ ] Implement rate limiting

### Phase 4: Testing & Migration (Week 10-11)
- [ ] Load testing with simulated traffic
- [ ] Data migration from SQLite to PostgreSQL
- [ ] Blue-green deployment setup
- [ ] Rollback procedure testing

### Phase 5: Production Cutover (Week 12)
- [ ] Gradual traffic migration (10% → 50% → 100%)
- [ ] Monitor metrics and error rates
- [ ] Decommission old infrastructure

### Data Migration Script

```python
# scripts/migrate_sqlite_to_postgres.py
import sqlite3
import asyncpg
import asyncio
from datetime import datetime

async def migrate_data(sqlite_path: str, postgres_dsn: str):
    # Connect to SQLite
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    
    # Connect to PostgreSQL
    pg_conn = await asyncpg.connect(postgres_dsn)
    
    try:
        # Migrate users
        cursor = sqlite_conn.execute("SELECT * FROM users")
        users = cursor.fetchall()
        
        for user in users:
            await pg_conn.execute("""
                INSERT INTO users (telegram_id, username, first_name, 
                    last_name, language_code, is_blocked, is_admin, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (telegram_id) DO NOTHING
            """, user["telegram_id"], user["username"], user["first_name"],
                user["last_name"], user["language_code"], 
                user.get("is_blocked", False), user.get("is_admin", False),
                user["created_at"])
        
        # Migrate leads
        cursor = sqlite_conn.execute("SELECT * FROM leads")
        leads = cursor.fetchall()
        
        for lead in leads:
            await pg_conn.execute("""
                INSERT INTO leads (id, user_id, product_id, quantity, 
                    comment, contact_method, contact_value, status, 
                    admin_id, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (id) DO NOTHING
            """, lead["id"], lead["user_id"], lead["product_id"],
                lead["quantity"], lead["comment"], lead["contact_method"],
                lead["contact_value"], lead["status"], lead["admin_id"],
                lead["created_at"], lead["updated_at"])
        
        await pg_conn.execute("SELECT setval('leads_id_seq', 
            (SELECT MAX(id) FROM leads))")
        
        print(f"Migration completed at {datetime.utcnow()}")
        print(f"Users migrated: {len(users)}")
        print(f"Leads migrated: {len(leads)}")
        
    finally:
        sqlite_conn.close()
        await pg_conn.close()

if __name__ == "__main__":
    asyncio.run(migrate_data(
        "data/bot.sqlite",
        "postgresql://user:pass@localhost/bot"
    ))
```

---

## High Availability & Failover

### Health Check Endpoints

```python
# src/api/health.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

router = APIRouter()

@router.get("/health/live")
async def liveness_probe():
    """Kubernetes liveness probe - lightweight"""
    return {"status": "alive"}

@router.get("/health/ready")
async def readiness_probe(
    db: AsyncSession = Depends(get_db),
    cache: redis.Redis = Depends(get_redis)
):
    """Kubernetes readiness probe - checks dependencies"""
    checks = {}
    
    # Check database
    try:
        await db.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"
        raise HTTPException(status_code=503, detail=checks)
    
    # Check Redis
    try:
        await cache.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {str(e)}"
        raise HTTPException(status_code=503, detail=checks)
    
    # Check Telegram API (optional, don't fail if unavailable)
    try:
        await check_telegram_api()
        checks["telegram"] = "ok"
    except:
        checks["telegram"] = "degraded"
    
    return {"status": "ready", "checks": checks}

@router.get("/health/metrics")
async def metrics_probe():
    """Detailed metrics for monitoring"""
    return {
        "uptime_seconds": get_uptime(),
        "memory_usage_mb": get_memory_usage(),
        "active_connections": get_active_connections(),
        "queue_depth": await get_queue_depth()
    }
```

### Automated Failover

```yaml
# k8s/failover-setup.yaml
# PodDisruptionBudget ensures minimum availability
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: bot-critical-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: bot-api

---
# PriorityClass for critical pods
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: bot-critical
value: 1000000
preemptionPolicy: PreemptLowerPriority
description: "Critical bot service pods"

---
# Anti-affinity to spread across nodes
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchLabels:
          app: bot-api
      topologyKey: kubernetes.io/hostname
```

---

## Cost Estimation

| Component | Monthly Cost (USD) |
|-----------|-------------------|
| Kubernetes Cluster (EKS/GKE) | $75-150 |
| PostgreSQL (managed) | $50-100 |
| Redis (managed) | $30-60 |
| Load Balancer | $20-40 |
| Monitoring (Sentry/CloudWatch) | $30-50 |
| **Total Infrastructure** | **$205-400/month** |

---

## Conclusion

This upgrade strategy transforms the existing Telegram bot from a single-process Node.js application into a production-ready, horizontally scalable Python-based system. Key improvements include:

1. **Scalability**: Kubernetes orchestration with auto-scaling
2. **Reliability**: 99.9% uptime target with health checks and automated failover
3. **Security**: HMAC validation, rate limiting, and encrypted storage
4. **Observability**: Comprehensive monitoring with Sentry, Prometheus, and Grafana
5. **Maintainability**: Clean architecture with separation of concerns
6. **Internationalization**: Multi-language support from day one
7. **Payment Ready**: Stripe and Telegram Payments integration

The phased migration approach ensures zero-downtime cutover while maintaining backward compatibility with existing user sessions.