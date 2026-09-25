# NAILBOOK — Deploy em Produção

## Arquitetura de Deploy

```
GitHub
  │
  ├── Cloudflare Pages (Frontend)
  │     ├── index.html
  │     ├── servicos.html
  │     ├── marcacao.html
  │     ├── privacidade.html
  │     ├── termos.html
  │     ├── 404.html
  │     ├── css/, js/, assets/
  │     │
  │     └── → https://www.meudominio.pt
  │
  └── Render (Backend)
        ├── Web Service → https://api.meudominio.pt
        ├── PostgreSQL Database
        └── Cron Job (Notifications)
```

## Pré-requisitos

### Contas
- [ ] GitHub account
- [ ] Cloudflare account
- [ ] Render account
- [ ] Domínio próprio (ex: meudominio.pt)

### Variáveis de Ambiente
Todas as variáveis necessárias estão listadas em `.env.example`.

## Passo 1: GitHub

```bash
# Inicializar repositório (se ainda não feito)
cd backend
git init
git add .
git commit -m "feat: complete NailBook platform v1.0"

# Adicionar remote
git remote add origin https://github.com/username/nailbook.git

# Push para main
git push -u origin main
```

### .gitignore verificação

```bash
# Verificar que .env não está no repositório
git status
# .env deve aparecer como untracked ou ignorado

# Verificar que não existem secrets
git log --all --oneline --grep="password\|secret\|API_KEY"
```

## Passo 2: Render Backend

### Criar Web Service

1. Ir para [Render Dashboard](https://dashboard.render.com)
2. Criar novo **Web Service**
3. Conectar ao repositório GitHub
4. Configurar:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Starter ou Standard
   - **Region**: Europa (Frankfurt ou Londres)
   - **Branch**: `main`

### Environment Variables (Render)

```
DATABASE_URL=postgresql://user:password@host:5432/nailbook
JWT_SECRET=sua-string-secreta-muito-longa-e-aleatoria-minimo-32-caracteres
JWT_REFRESH_SECRET=outra-string-secreta-muito-longa-e-aleatoria-minimo-32-caracteres
CORS_ORIGIN=https://www.meudominio.pt,https://meudominio.pt
APP_URL=https://www.meudominio.pt
API_URL=https://api.meudominio.pt
TIMEZONE=Europe/Lisbon
NODE_ENV=production
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=NailBook <contacto@exemplo.com>
EMAIL_REPLY_TO=contacto@exemplo.com
NOTIFICATION_MAX_ATTEMPTS=3
NOTIFICATION_RETRY_DELAY_MS=60000
REMINDER_24H_ENABLED=true
REMINDER_2H_ENABLED=true
ADMIN_NOTIFICATION_EMAIL=admin@exemplo.com
ICS_ENABLED=true
CALENDAR_LOCATION=Rua Exemplo, Lisboa
```

### Criar PostgreSQL Database

1. Criar novo **PostgreSQL** no Render
2. Selecionar mesma região
3. Obter `DATABASE_URL`
4. Adicionar ao Web Service como variável de ambiente

### Executar Migrations

```bash
# Via Render Shell ou localmente
cd backend && npm run migrate
```

### Seed (opcional, apenas configurações)

```bash
# NÃO seedar dados fictícios em produção
# Apenas configurações mínimas
npm run seed
```

## Passo 3: Render Cron Job

1. Criar novo **Cron Job** no Render
2. Conectar ao mesmo repositório
3. Configurar:
   - **Cron Expression**: `*/1 * * * *` (a cada minuto)
   - **Build Command**: `npm install`
   - **Start Command**: `node jobs/notificationJob.js`
   - **Instance Type**: Starter

### Scripts no package.json

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "migrate": "node database/migrate.js",
    "seed": "node database/seed.js",
    "test": "node --experimental-vm-modules node_modules/.bin/jest --forceExit",
    "notification:job": "node jobs/notificationJob.js"
  }
}
```

## Passo 4: Cloudflare Pages

### Criar Project

1. Ir para [Cloudflare Pages](https://pages.cloudflare.com)
2. Criar novo project
3. Conectar ao repositório GitHub
4. Configurar:
   - **Framework**: None (estático)
   - **Build Command**: (vazio)
   - **Build Output Directory**: `frontend`
   - **Branch**: `main`

### Environment Variables (Cloudflare Pages)

```
API_URL=https://api.meudominio.pt
```

### Domínio Personalizado

1. Configurar `www.meudominio.pt` no Cloudflare
2. Apontar para Cloudflare Pages
3. SSL automático (Cloudflare cuida)

## Passo 5: DNS

### Configurar DNS no Cloudflare

```
A record: @ → render.com IP (ou usar Cloudflare DNS)
CNAME: www → frontend.cloudflare.net
CNAME: api → backend.onrender.com
```

Ou, se usando Render DNS:
```
CNAME: www.meudominio.pt → frontend.cloudflarepages.dev
CNAME: api.meudominio.pt → backend.onrender.com
```

## Passo 6: HTTPS

- Cloudflare Pages: SSL automático
- Render: SSL automático via Let's Encrypt
- Sem configuração manual necessária

## Passo 7: Verificação Final

```bash
# 1. Health Check
curl https://api.meudominio.pt/health
# Resposta esperada: {"status": "ok", ...}

# 2. Serviços
curl https://api.meudominio.pt/api/services
# Resposta esperada: {"success": true, "data": [...]}

# 3. Website
curl https://www.meudominio.pt
# Resposta esperada: HTML do frontend

# 4. SSL
curl -I https://api.meudominio.pt | head -1
# Esperado: HTTP/2 200

# 5. CORS
curl -H "Origin: https://www.meudominio.pt" -I https://api.meudominio.pt/api/services
# Esperado: Access-Control-Allow-Origin: https://www.meudominio.pt
```

## Troubleshooting

### API retorna 502/503
- Verificar logs no Render Dashboard
- Verificar que o database está conectado
- Verificar que as migrations foram executadas

### CORS error no frontend
- Verificar `CORS_ORIGIN` nas variáveis de ambiente
- Verificar que o domínio está correto (com `https://`)
- Verificar que não existe `localhost` em produção

### Cookies não funcionam
- Verificar que `CORS_ORIGIN` corresponde exatamente ao domínio do frontend
- Verificar que os cookies têm `SameSite=Strict` ou `SameSite=None; Secure`
- Para subdomínios diferentes, pode ser necessário `SameSite=None`

### Email não funciona
- Verificar `EMAIL_PROVIDER` e `EMAIL_API_KEY`
- Verificar que o provider está configurado
- Verificar logs no Render Dashboard

### Notificações não são enviadas
- Verificar que o Cron Job está configurado
- Verificar que o Cron Job está running
- Verificar `notification_logs` no database
- Verificar se existem notificações `pending`

### Database connection falha
- Verificar `DATABASE_URL`
- Verificar que o PostgreSQL está provisionado
- Verificar que as migrations foram executadas

## Manutenção

### Atualizar Código
```bash
git add .
git commit -m "feat: description"
git push origin main
```
O deploy será automático no Cloudflare Pages e Render.

### Executar Migration
```bash
cd backend
npm run migrate
```

### Backup do Database
```bash
# Render automatiza backups
# Para restaurar: usar o painel do Render ou pg_restore
```

### Ver Logs
```bash
# Render Dashboard → Logs
# Ou: render logs <service-name>
```

## Segurança Checklist

```
[ ] .env no .gitignore
[ ] Nenhum secret no GitHub
[ ] .env.example com placeholders apenas
[ ] HTTPS em produção
[ ] CORS restrito
[ ] Cookies httpOnly, Secure, SameSite
[ ] Rate limiting ativo
[ ] Headers de segurança (Helmet)
[ ] CSRF protection
[ ] Password hashing (bcrypt)
[ ] SQL injection protection (queries parametrizadas)
[ ] XSS prevention (escapeHtml)
[ ] JWT no cookie httpOnly
[ ] Database backups configurados
[ ] Error handling sem stack traces em produção
[ ] Logs sem dados sensíveis
[ ] Health check funcional
[ ] Cron Job configurado e funcionando
```
