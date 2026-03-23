# Implementation Roadmap - Telegram Bot Upgrade

## Project Structure

```
telegram-bot-v2/
├── src/
│   ├── __init__.py
│   ├── main.py                      # FastAPI application entry point
│   ├── config.py                    # Configuration management
│   ├── bot/
│   │   ├── __init__.py
│   │   ├── application.py           # Bot application setup
│   │   ├── webhook.py               # Webhook handlers
│   │   ├── handlers/
│   │   │   ├── __init__.py
│   │   │   ├── commands.py          # Command handlers
│   │   │   ├── callbacks.py         # Callback query handlers
│   │   │   ├── messages.py          # Message handlers
│   │   │   └── conversations/
│   │   │       ├── __init__.py
│   │   │       ├── lead.py          # Lead creation conversation
│   │   │       └── support.py       # Support conversation
│   │   └── middleware/
│   │       ├── __init__.py
│   │       ├── rate_limit.py        # Rate limiting middleware
│   │       ├── i18n.py              # Localization middleware
│   │       └── security.py          # Security checks
│   ├── services/
│   │   ├── __init__.py
│   │   ├── lead_service.py
│   │   ├── user_service.py
│   │   ├── catalog_service.py
│   │   ├── conversation_service.py
│   │   ├── admin_service.py
│   │   └── payment_service.py
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── user_repository.py
│   │   ├── lead_repository.py
│   │   ├── product_repository.py
│   │   └── payment_repository.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── lead.py
│   │   ├── product.py
│   │   ├── conversation.py
│   │   └── payment.py
│   ├── infrastructure/
│   │   ├── __init__.py
│   │   ├── database.py              # PostgreSQL connection
│   │   ├── cache.py                 # Redis connection
│   │   ├── celery.py                # Celery configuration
│   │   ├── rate_limiter.py
│   │   ├── encryption.py
│   │   ├── sentry.py
│   │   └── metrics.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── health.py
│   │   │   ├── webapp.py
│   │   │   └── admin.py
│   │   └── middleware/
│   │       ├── __init__.py
│   │       ├── cors.py
│   │       └── auth.py
│   ├── i18n/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── middleware.py
│   │   └── locales/
│   │       ├── ru.json
│   │       ├── en.json
│   │       └── es.json
│   └── utils/
│       ├── __init__.py
│       ├── validators.py
│       ├── formatters.py
│       └── telegram.py
├── migrations/
│   ├── versions/
│   └── alembic.ini
├── tests/
│   ├── unit/
│   ├── integration/
│   └── conftest.py
├── k8s/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── hpa.yaml
│   ├── pdb.yaml
│   └── ingress.yaml
├── scripts/
│   ├── migrate_data.py
│   └── backup.py
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── docs/
│   └── architecture.md
├── requirements.txt
├── requirements-dev.txt
├── pyproject.toml
├── Makefile
└── README.md
```

## Phase 1: Infrastructure Setup (Week 1-2)

### Week 1: Core Infrastructure

#### Day 1-2: PostgreSQL Setup
```bash
# Create PostgreSQL cluster with primary-replica
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install postgres bitnami/postgresql-ha \
  --set global.postgresql.auth.database=bot \
  --set global.postgresql.auth.username=bot_user \
  --set persistence.size=20Gi \
  --set postgresql.replicaCount=2

# Verify cluster
kubectl get pods -l app.kubernetes.io/name=postgresql-ha
```

#### Day 3-4: Redis Setup
```bash
# Deploy Redis Cluster
helm install redis bitnami/redis-cluster \
  --set cluster.nodes=6 \
  --set cluster.replicas=1 \
  --set persistence.size=10Gi

# Create config for rate limiting
kubectl create configmap redis-config \
  --from-literal=maxmemory-policy=allkeys-lru
```

#### Day 5: Kubernetes Cluster Configuration
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: telegram-bot
  labels:
    name: telegram-bot
    istio-injection: enabled
```

### Week 2: CI/CD and Monitoring

#### GitHub Actions Workflow
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: bot_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          pip install -r requirements-dev.txt
      
      - name: Run tests
        run: |
          pytest --cov=src --cov-report=xml
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/bot_test
          REDIS_URL: redis://localhost:6379/0
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.29.0'
      
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/bot-api \
            api=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            -n telegram-bot
          kubectl rollout status deployment/bot-api -n telegram-bot
```

## Phase 2: Core Development (Week 3-6)

### Week 3: Project Foundation

#### Day 1: Project Setup
```toml
# pyproject.toml
[project]
name = "telegram-bot-v2"
version = "1.0.0"
description = "Production-ready Telegram Bot"
requires-python = ">=3.12"
dependencies = [
    "python-telegram-bot[webhooks]>=21.0",
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.25.0",
    "asyncpg>=0.29.0",
    "redis>=5.0.0",
    "celery>=5.3.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "alembic>=1.13.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "cryptography>=41.0.0",
    "stripe>=7.0.0",
    "sentry-sdk[fastapi]>=1.40.0",
    "prometheus-client>=0.19.0",
    "python-i18n>=0.3.9",
    "httpx>=0.26.0",
    "tenacity>=8.2.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=4.1.0",
    "black>=24.0.0",
    "ruff>=0.2.0",
    "mypy>=1.8.0",
    "factory-boy>=3.3.0",
    "faker>=22.0.0",
    "testcontainers>=3.7.0",
]
```

#### Day 2-3: Configuration Management
```python
# src/config.py
from pydantic_settings import BaseSettings
from pydantic import Field, RedisDsn, PostgresDsn
from functools import lru_cache


class Settings(BaseSettings):
    # Bot Configuration
    BOT_TOKEN: str = Field(..., description="Telegram Bot API token")
    WEBHOOK_URL: str = Field(..., description="Webhook URL")
    WEBHOOK_SECRET: str = Field(..., description="Secret for webhook validation")
    ADMIN_IDS: list[int] = Field(default_factory=list)
    
    # Database
    DATABASE_URL: PostgresDsn = Field(...)
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # Redis
    REDIS_URL: RedisDsn = Field(...)
    REDIS_DB: int = 0
    
    # Security
    ENCRYPTION_KEY: str = Field(..., description="Key for data encryption")
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 30
    RATE_LIMIT_WINDOW: int = 60  # seconds
    
    # Payments
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None
    
    # Monitoring
    SENTRY_DSN: str | None = None
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    
    # Feature Flags
    PAYMENT_ENABLED: bool = False
    I18N_ENABLED: bool = True
    RATE_LIMITING_ENABLED: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

#### Day 4-5: Database Models
```python
# src/models/user.py
from datetime import datetime
from sqlalchemy import BigInteger, Boolean, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models.base import Base


class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(32))
    first_name: Mapped[str | None] = mapped_column(String(64))
    last_name: Mapped[str | None] = mapped_column(String(64))
    language_code: Mapped[str] = mapped_column(String(10), default="ru")
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    # Relationships
    leads: Mapped[list["Lead"]] = relationship(back_populates="user")
    payments: Mapped[list["Payment"]] = relationship(back_populates="user")
```

```python
# src/models/lead.py
from datetime import datetime
from enum import Enum
from sqlalchemy import ForeignKey, Integer, String, Text, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models.base import Base


class LeadStatus(str, Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    CALLED_BACK = "called_back"
    AWAITING_PAYMENT = "awaiting_payment"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"


class Lead(Base):
    __tablename__ = "leads"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    comment: Mapped[str | None] = mapped_column(Text)
    contact_method: Mapped[str | None] = mapped_column(String(50))
    contact_value: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[LeadStatus] = mapped_column(
        SQLEnum(LeadStatus), default=LeadStatus.NEW, index=True
    )
    admin_id: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    # Relationships
    user: Mapped["User"] = relationship(back_populates="leads")
    product: Mapped["Product"] = relationship(back_populates="leads")
    status_history: Mapped[list["LeadStatusHistory"]] = relationship(back_populates="lead")
```

### Week 4: Bot Core Implementation

#### Bot Application Factory
```python
# src/bot/application.py
from telegram import Bot
from telegram.ext import Application, ApplicationBuilder
from src.config import get_settings
from src.bot.handlers import commands, callbacks, messages
from src.bot.middleware import RateLimitMiddleware, I18nMiddleware


async def create_bot_application() -> Application:
    """Create and configure the bot application."""
    settings = get_settings()
    
    # Build application
    builder = (
        ApplicationBuilder()
        .token(settings.BOT_TOKEN)
        .updater(None)  # Use webhooks only
        .concurrent_updates(True)
        .get_updates_read_timeout(30)
    )
    
    application = builder.build()
    
    # Add middleware
    application.add_handler(TypeHandler(Update, RateLimitMiddleware()), group=-1)
    application.add_handler(TypeHandler(Update, I18nMiddleware()), group=-2)
    
    # Register handlers
    application.add_handler(CommandHandler("start", commands.start_command))
    application.add_handler(CommandHandler("help", commands.help_command))
    application.add_handler(CommandHandler("status", commands.status_command))
    application.add_handler(CommandHandler("menu", commands.menu_command))
    
    # Admin commands
    application.add_handler(CommandHandler("clients", commands.clients_command))
    application.add_handler(CommandHandler("dialogs", commands.dialogs_command))
    application.add_handler(CommandHandler("leads", commands.leads_command))
    application.add_handler(CommandHandler("stats", commands.stats_command))
    application.add_handler(CommandHandler("exportleads", commands.export_leads_command))
    application.add_handler(CommandHandler("blockuser", commands.block_user_command))
    application.add_handler(CommandHandler("unblockuser", commands.unblock_user_command))
    
    # Callback handlers
    application.add_handler(CallbackQueryHandler(callbacks.handle_catalog, pattern=r"^catalog:"))
    application.add_handler(CallbackQueryHandler(callbacks.handle_lead, pattern=r"^lead:"))
    application.add_handler(CallbackQueryHandler(callbacks.handle_admin, pattern=r"^admin:"))
    
    # Message handlers
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, messages.handle_text))
    
    # Error handler
    application.add_error_handler(handle_error)
    
    return application


async def handle_error(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Global error handler."""
    import sentry_sdk
    
    sentry_sdk.capture_exception(context.error)
    
    if update and update.effective_message:
        await update.effective_message.reply_text(
            "Произошла ошибка. Мы уже работаем над её исправлением."
        )
```

#### Webhook Handler
```python
# src/bot/webhook.py
import json
import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException, Depends
from telegram import Update
from src.config import get_settings
from src.bot.application import create_bot_application

router = APIRouter()


def verify_signature(secret: str, body: bytes, signature: str) -> bool:
    """Verify HMAC signature."""
    expected = hmac.new(
        secret.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post(f"/webhook/{get_settings().BOT_TOKEN}")
async def webhook(request: Request):
    """Handle incoming webhook from Telegram."""
    settings = get_settings()
    
    # Get signature from header
    signature = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    body = await request.body()
    
    # Verify signature
    if not verify_signature(settings.WEBHOOK_SECRET, body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    # Parse update
    try:
        data = json.loads(body)
        update = Update.de_json(data, application.bot)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    # Process update
    await application.process_update(update)
    
    return {"ok": True}
```

### Week 5-6: Services and Repositories

#### Repository Pattern
```python
# src/repositories/base.py
from typing import Generic, TypeVar, Type
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    def __init__(self, session: AsyncSession, model: Type[ModelType]):
        self.session = session
        self.model = model
    
    async def get_by_id(self, id: int) -> ModelType | None:
        result = await self.session.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()
    
    async def get_all(self, skip: int = 0, limit: int = 100) -> list[ModelType]:
        result = await self.session.execute(
            select(self.model).offset(skip).limit(limit)
        )
        return result.scalars().all()
    
    async def create(self, **kwargs) -> ModelType:
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        return instance
    
    async def update(self, id: int, **kwargs) -> ModelType | None:
        await self.session.execute(
            update(self.model)
            .where(self.model.id == id)
            .values(**kwargs)
        )
        return await self.get_by_id(id)
    
    async def delete(self, id: int) -> bool:
        result = await self.session.execute(
            delete(self.model).where(self.model.id == id)
        )
        return result.rowcount > 0
```

#### Lead Service
```python
# src/services/lead_service.py
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.lead import Lead, LeadStatus
from src.repositories.lead_repository import LeadRepository
from src.repositories.user_repository import UserRepository
from src.repositories.product_repository import ProductRepository
from src.infrastructure.cache import Cache
from src.infrastructure.encryption import DataEncryption


class LeadService:
    def __init__(
        self,
        db: AsyncSession,
        cache: Cache,
        encryption: DataEncryption
    ):
        self.db = db
        self.cache = cache
        self.encryption = encryption
        self.lead_repo = LeadRepository(db)
        self.user_repo = UserRepository(db)
        self.product_repo = ProductRepository(db)
    
    async def create_lead(
        self,
        user_id: int,
        product_id: int,
        quantity: int,
        comment: Optional[str] = None,
        contact_method: Optional[str] = None,
        contact_value: Optional[str] = None
    ) -> Lead:
        """Create a new lead with duplicate detection."""
        # Check for recent duplicate
        existing = await self.lead_repo.get_recent_by_user_and_product(
            user_id, product_id, minutes=30
        )
        
        if existing:
            raise DuplicateLeadError(f"Recent lead already exists: {existing.id}")
        
        # Encrypt sensitive contact info
        encrypted_contact = None
        if contact_value:
            encrypted_contact = self.encryption.encrypt(contact_value)
        
        lead = await self.lead_repo.create(
            user_id=user_id,
            product_id=product_id,
            quantity=quantity,
            comment=comment,
            contact_method=contact_method,
            contact_value=encrypted_contact,
            status=LeadStatus.NEW
        )
        
        await self.db.commit()
        
        # Invalidate cache
        await self.cache.delete(f"user:{user_id}:leads")
        
        return lead
    
    async def update_status(
        self,
        lead_id: int,
        new_status: LeadStatus,
        admin_id: int,
        reason: Optional[str] = None
    ) -> Lead:
        """Update lead status with audit trail."""
        lead = await self.lead_repo.get_by_id(lead_id)
        if not lead:
            raise LeadNotFoundError(f"Lead {lead_id} not found")
        
        old_status = lead.status
        
        # Update lead
        lead.status = new_status
        lead.admin_id = admin_id
        lead.updated_at = datetime.utcnow()
        
        # Create status history
        await self.lead_repo.create_status_history(
            lead_id=lead_id,
            old_status=old_status,
            new_status=new_status,
            changed_by=admin_id,
            reason=reason
        )
        
        await self.db.commit()
        
        # Notify user of status change
        await self._notify_user_status_change(lead, old_status, new_status)
        
        return lead
    
    async def get_user_leads(self, user_id: int, limit: int = 10) -> list[Lead]:
        """Get user's leads with caching."""
        cache_key = f"user:{user_id}:leads"
        
        # Try cache first
        cached = await self.cache.get(cache_key)
        if cached:
            return [Lead(**data) for data in cached]
        
        # Fetch from database
        leads = await self.lead_repo.get_by_user_id(user_id, limit=limit)
        
        # Cache results
        await self.cache.setex(
            cache_key,
            300,  # 5 minutes
            [lead.to_dict() for lead in leads]
        )
        
        return leads
```

## Phase 3: Feature Migration (Week 7-9)

### Week 7: i18n and Security

#### i18n Implementation
```python
# src/i18n/middleware.py
from telegram import Update
from telegram.ext import ContextTypes
from src.i18n.config import i18n


class I18nMiddleware:
    """Middleware to set user language context."""
    
    async def __call__(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        # Get user's language preference
        user = update.effective_user
        language = user.language_code if user else "ru"
        
        # Validate supported languages
        supported = ["ru", "en", "es"]
        if language not in supported:
            language = "ru"
        
        # Store in context
        context.user_data["language"] = language
        context.user_data["_"] = lambda key, **kwargs: i18n.get_text(key, language, **kwargs)
        
        return True


# Usage in handlers
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _ = context.user_data.get("_", lambda x, **k: x)
    
    await update.message.reply_text(
        _("welcome.message", name=update.effective_user.first_name)
    )
```

#### locales/ru.json
```json
{
  "welcome": {
    "message": "Добро пожаловать, {name}! 👋",
    "description": "Я помогу вам оформить заявку на наши товары."
  },
  "lead": {
    "created": "✅ Заявка #{id} успешно создана!",
    "status_changed": "Статус заявки изменён на: {status}",
    "duplicate": "У вас уже есть активная заявка на этот товар."
  },
  "errors": {
    "rate_limited": "Слишком много запросов. Попробуйте через {seconds} сек.",
    "server_error": "Произошла ошибка. Мы уже работаем над её исправлением."
  }
}
```

### Week 8: Payment Integration

#### Telegram Payments
```python
# src/services/payment_service.py
from telegram import LabeledPrice
from src.models.payment import Payment, PaymentStatus


class PaymentService:
    def __init__(self, db: AsyncSession, stripe_key: str | None = None):
        self.db = db
        if stripe_key:
            stripe.api_key = stripe_key
    
    async def create_telegram_invoice(
        self,
        bot: Bot,
        chat_id: int,
        lead: Lead,
        title: str,
        description: str,
        amount: int,
        currency: str = "RUB"
    ) -> str:
        """Create Telegram payment invoice."""
        prices = [LabeledPrice(label=title, amount=amount * 100)]
        
        # Generate unique payload
        payload = f"lead_{lead.id}_{uuid.uuid4().hex[:8]}"
        
        await bot.send_invoice(
            chat_id=chat_id,
            title=title,
            description=description,
            payload=payload,
            provider_token=settings.TELEGRAM_PAYMENT_PROVIDER_TOKEN,
            currency=currency,
            prices=prices,
            need_name=True,
            need_phone_number=True,
            need_shipping_address=False,
            is_flexible=False
        )
        
        # Create payment record
        payment = Payment(
            lead_id=lead.id,
            user_id=lead.user_id,
            provider="telegram",
            provider_payment_id=payload,
            amount=amount,
            currency=currency,
            status=PaymentStatus.PENDING
        )
        self.db.add(payment)
        await self.db.commit()
        
        return payload
    
    async def handle_successful_payment(
        self,
        user_id: int,
        payment_info: SuccessfulPayment
    ) -> Payment:
        """Handle successful Telegram payment."""
        payment = await self.db.execute(
            select(Payment).where(
                Payment.provider_payment_id == payment_info.invoice_payload
            )
        )
        payment = payment.scalar_one_or_none()
        
        if not payment:
            raise PaymentNotFoundError("Payment not found")
        
        payment.status = PaymentStatus.COMPLETED
        payment.provider_charge_id = payment_info.telegram_payment_charge_id
        payment.completed_at = datetime.utcnow()
        
        await self.db.commit()
        
        # Update lead status
        lead_service = LeadService(self.db)
        await lead_service.update_status(
            payment.lead_id,
            LeadStatus.AWAITING_PAYMENT,
            admin_id=0,  # System
            reason="Payment completed"
        )
        
        return payment
```

### Week 9: Admin Dashboard and Rate Limiting

#### Enhanced Admin Commands
```python
# src/bot/handlers/admin_commands.py
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from src.services.admin_service import AdminService


async def admin_dashboard_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Real-time admin dashboard."""
    admin_service = AdminService(context.bot_data["db"])
    
    # Get real-time stats
    stats = await admin_service.get_dashboard_stats()
    
    message = (
        f"📊 <b>Панель управления</b>\n"
        f"<i>Обновлено: {stats['timestamp']}</i>\n\n"
        f"👥 Пользователей всего: {stats['total_users']}\n"
        f"🟢 Активных сегодня: {stats['active_today']}\n\n"
        f"📋 Заявок:\n"
        f"  • Новых: {stats['leads_new']}\n"
        f"  • В работе: {stats['leads_in_progress']}\n"
        f"  • Ожидают оплаты: {stats['leads_awaiting_payment']}\n"
        f"  • Выполнено: {stats['leads_fulfilled']}\n\n"
        f"💰 Выручка сегодня: ${stats['revenue_today']}\n"
        f"📈 Конверсия: {stats['conversion_rate']}%"
    )
    
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📋 Заявки", callback_data="admin:view_leads"),
            InlineKeyboardButton("👥 Пользователи", callback_data="admin:view_users")
        ],
        [
            InlineKeyboardButton("📊 Графики", callback_data="admin:charts"),
            InlineKeyboardButton("📤 Экспорт", callback_data="admin:export")
        ],
        [
            InlineKeyboardButton("🔍 Поиск", callback_data="admin:search"),
            InlineKeyboardButton("⚙️ Настройки", callback_data="admin:settings")
        ],
        [InlineKeyboardButton("🔄 Обновить", callback_data="admin:refresh")]
    ])
    
    await update.message.reply_text(
        message,
        reply_markup=keyboard,
        parse_mode="HTML"
    )
```

#### Rate Limiting
```python
# src/bot/middleware/rate_limit.py
from telegram import Update
from telegram.ext import ContextTypes
from src.infrastructure.rate_limiter import RateLimiter
from src.i18n.config import i18n


class RateLimitMiddleware:
    """Rate limiting middleware."""
    
    def __init__(self, rate_limiter: RateLimiter):
        self.rate_limiter = rate_limiter
    
    async def __call__(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not update.effective_user:
            return True
        
        user_id = update.effective_user.id
        
        # Check rate limit
        allowed, remaining = await self.rate_limiter.check_rate_limit(
            f"user:{user_id}",
            max_requests=30,
            window_seconds=60
        )
        
        if not allowed:
            language = update.effective_user.language_code or "ru"
            await update.effective_message.reply_text(
                i18n.get_text("errors.rate_limited", language, seconds=60)
            )
            return False
        
        return True
```

## Phase 4: Testing & Migration (Week 10-11)

### Week 10: Testing

#### Test Configuration
```python
# tests/conftest.py
import pytest
import pytest_asyncio
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker


@pytest_asyncio.fixture(scope="session")
async def postgres_container():
    with PostgresContainer("postgres:16-alpine") as postgres:
        yield postgres


@pytest_asyncio.fixture(scope="session")
async def redis_container():
    with RedisContainer("redis:7-alpine") as redis:
        yield redis


@pytest_asyncio.fixture
async def db_session(postgres_container):
    database_url = postgres_container.get_connection_url().replace(
        "postgresql+psycopg2", "postgresql+asyncpg"
    )
    engine = create_async_engine(database_url)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
def redis_client(redis_container):
    import redis.asyncio as redis
    return redis.from_url(redis_container.get_connection_url())
```

#### Integration Tests
```python
# tests/integration/test_lead_workflow.py
import pytest
from telegram import Update, User, Message, Chat
from src.services.lead_service import LeadService
from src.models.lead import LeadStatus


@pytest.mark.asyncio
async def test_complete_lead_workflow(db_session, redis_client):
    """Test complete lead creation workflow."""
    # Arrange
    lead_service = LeadService(db_session, redis_client)
    
    # Act - Create lead
    lead = await lead_service.create_lead(
        user_id=12345,
        product_id=1,
        quantity=2,
        comment="Test comment",
        contact_method="telegram",
        contact_value="@testuser"
    )
    
    # Assert
    assert lead.id is not None
    assert lead.status == LeadStatus.NEW
    assert lead.quantity == 2
    
    # Act - Update status
    updated = await lead_service.update_status(
        lead_id=lead.id,
        new_status=LeadStatus.IN_PROGRESS,
        admin_id=99999
    )
    
    # Assert
    assert updated.status == LeadStatus.IN_PROGRESS
    assert updated.admin_id == 99999
```

### Week 11: Migration

#### Data Migration Script
```python
# scripts/migrate_sqlite_to_postgres.py
"""
Migration script from SQLite to PostgreSQL.
Handles data transformation and validation.
"""
import asyncio
import sqlite3
import asyncpg
from datetime import datetime
from typing import List, Dict
import click


class DataMigrator:
    def __init__(self, sqlite_path: str, postgres_dsn: str):
        self.sqlite_path = sqlite_path
        self.postgres_dsn = postgres_dsn
        self.stats = {
            "users": {"migrated": 0, "errors": 0},
            "products": {"migrated": 0, "errors": 0},
            "leads": {"migrated": 0, "errors": 0},
            "conversations": {"migrated": 0, "errors": 0}
        }
    
    async def migrate(self, batch_size: int = 1000):
        """Run full migration."""
        click.echo(f"Starting migration at {datetime.utcnow()}")
        
        # Connect to databases
        sqlite_conn = sqlite3.connect(self.sqlite_path)
        sqlite_conn.row_factory = sqlite3.Row
        
        pg_conn = await asyncpg.connect(self.postgres_dsn)
        
        try:
            # Migrate in order
            await self._migrate_users(sqlite_conn, pg_conn)
            await self._migrate_products(sqlite_conn, pg_conn)
            await self._migrate_leads(sqlite_conn, pg_conn)
            await self._migrate_conversations(sqlite_conn, pg_conn)
            
            # Update sequences
            await self._update_sequences(pg_conn)
            
        finally:
            sqlite_conn.close()
            await pg_conn.close()
        
        self._print_stats()
    
    async def _migrate_users(self, sqlite_conn, pg_conn):
        """Migrate users table."""
        click.echo("Migrating users...")
        
        cursor = sqlite_conn.execute("SELECT * FROM users")
        users = cursor.fetchall()
        
        for user in users:
            try:
                await pg_conn.execute("""
                    INSERT INTO users (
                        telegram_id, username, first_name, last_name,
                        language_code, is_blocked, is_admin, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (telegram_id) DO NOTHING
                """,
                    user["telegram_id"], user["username"], user["first_name"],
                    user["last_name"], user.get("language_code", "ru"),
                    user.get("is_blocked", False), user.get("is_admin", False),
                    user["created_at"]
                )
                self.stats["users"]["migrated"] += 1
            except Exception as e:
                click.echo(f"Error migrating user {user['telegram_id']}: {e}")
                self.stats["users"]["errors"] += 1
        
        click.echo(f"Users migrated: {self.stats['users']['migrated']}")
    
    async def _migrate_leads(self, sqlite_conn, pg_conn):
        """Migrate leads table."""
        click.echo("Migrating leads...")
        
        cursor = sqlite_conn.execute("SELECT * FROM leads")
        leads = cursor.fetchall()
        
        for lead in leads:
            try:
                # Map old status to new enum
                status_map = {
                    "new": "new",
                    "in_progress": "in_progress",
                    "callback": "called_back",
                    "awaiting_payment": "awaiting_payment",
                    "done": "fulfilled",
                    "cancelled": "cancelled"
                }
                new_status = status_map.get(lead["status"], "new")
                
                await pg_conn.execute("""
                    INSERT INTO leads (
                        id, user_id, product_id, quantity, comment,
                        contact_method, contact_value, status, admin_id,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO NOTHING
                """,
                    lead["id"], lead["user_id"], lead["product_id"],
                    lead["quantity"], lead["comment"], lead["contact_method"],
                    lead["contact_value"], new_status, lead["admin_id"],
                    lead["created_at"], lead["updated_at"]
                )
                self.stats["leads"]["migrated"] += 1
            except Exception as e:
                click.echo(f"Error migrating lead {lead['id']}: {e}")
                self.stats["leads"]["errors"] += 1
        
        click.echo(f"Leads migrated: {self.stats['leads']['migrated']}")
    
    async def _update_sequences(self, pg_conn):
        """Update PostgreSQL sequences."""
        tables = ["users", "products", "leads", "conversations", "payments"]
        
        for table in tables:
            await pg_conn.execute(f"""
                SELECT setval('{table}_id_seq', 
                    COALESCE((SELECT MAX(id) FROM {table}), 1), 
                    true
                )
            """)
        
        click.echo("Sequences updated")
    
    def _print_stats(self):
        """Print migration statistics."""
        click.echo("\n" + "=" * 50)
        click.echo("Migration Summary")
        click.echo("=" * 50)
        
        for table, stats in self.stats.items():
            total = stats["migrated"] + stats["errors"]
            success_rate = (stats["migrated"] / total * 100) if total > 0 else 0
            click.echo(f"{table}:")
            click.echo(f"  Migrated: {stats['migrated']}")
            click.echo(f"  Errors: {stats['errors']}")
            click.echo(f"  Success rate: {success_rate:.1f}%")


@click.command()
@click.option("--sqlite-path", required=True, help="Path to SQLite database")
@click.option("--postgres-dsn", required=True, help="PostgreSQL connection string")
@click.option("--batch-size", default=1000, help="Batch size for inserts")
def main(sqlite_path: str, postgres_dsn: str, batch_size: int):
    """Migrate data from SQLite to PostgreSQL."""
    migrator = DataMigrator(sqlite_path, postgres_dsn)
    asyncio.run(migrator.migrate(batch_size))


if __name__ == "__main__":
    main()
```

## Phase 5: Production Cutover (Week 12)

### Blue-Green Deployment

```yaml
# k8s/blue-green/blue-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bot-api-blue
  labels:
    app: bot-api
    version: blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bot-api
      version: blue
  template:
    metadata:
      labels:
        app: bot-api
        version: blue
    spec:
      containers:
      - name: api
        image: ghcr.io/yourorg/telegram-bot:v2.0.0
        # ... configuration

---
# k8s/blue-green/green-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bot-api-green
  labels:
    app: bot-api
    version: green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bot-api
      version: green
  template:
    metadata:
      labels:
        app: bot-api
        version: green
    spec:
      containers:
      - name: api
        image: ghcr.io/yourorg/telegram-bot:v2.0.1
        # ... configuration

---
# k8s/blue-green/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: bot-api-active
spec:
  selector:
    app: bot-api
    version: blue  # Switch to green for cutover
  ports:
  - port: 80
    targetPort: 8000
```

### Cutover Script
```bash
#!/bin/bash
# scripts/cutover.sh

set -e

ENVIRONMENT=${1:-staging}
PERCENTAGE=${2:-10}

echo "Starting cutover to v2 - Environment: $ENVIRONMENT, Traffic: $PERCENTAGE%"

# Update Istio traffic splitting
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: bot-api
  namespace: telegram-bot
spec:
  hosts:
  - bot-api
  http:
  - match:
    - headers:
        x-canary:
          exact: "true"
    route:
    - destination:
        host: bot-api-green
      weight: 100
  - route:
    - destination:
        host: bot-api-blue
      weight: $((100 - PERCENTAGE))
    - destination:
        host: bot-api-green
      weight: $PERCENTAGE
EOF

echo "Traffic split updated: $((100 - PERCENTAGE))% blue, $PERCENTAGE% green"
echo "Monitor metrics for 5 minutes..."
sleep 300

echo "Checking error rates..."
ERROR_RATE=$(curl -s "http://prometheus/api/v1/query?query=rate(bot_errors_total[5m])" | jq '.data.result[0].value[1]')

if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
    echo "ERROR: High error rate detected ($ERROR_RATE)"
    echo "Rolling back..."
    kubectl patch virtualservice bot-api --type='json' -p='[{"op": "replace", "path": "/spec/http/1/route/0/weight", "value":100}, {"op": "replace", "path": "/spec/http/1/route/1/weight", "value":0}]'
    exit 1
fi

echo "Cutover successful! Error rate: $ERROR_RATE"
```

## Summary

This implementation roadmap provides a 12-week plan to transform the existing Node.js/Telegraf bot into a production-ready Python-based system. Key deliverables include:

1. **Week 1-2**: Infrastructure (PostgreSQL, Redis, K8s)
2. **Week 3-6**: Core application (FastAPI, python-telegram-bot, services)
3. **Week 7-9**: Features (i18n, payments, admin dashboard)
4. **Week 10-11**: Testing and data migration
5. **Week 12**: Production cutover with blue-green deployment

The new architecture achieves:
- Horizontal scalability (3-20 pods auto-scaling)
- 99.9% uptime (with health checks and failover)
- Multi-language support (Russian, English, Spanish)
- Payment processing (Stripe + Telegram Payments)
- Comprehensive security (HMAC, encryption, rate limiting)
- Full observability (Sentry, Prometheus, Grafana)

Estimated infrastructure cost: $200-400/month
Team required: 2-3 engineers
