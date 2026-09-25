# NAILBOOK — Checklist de Produção

## Segurança

```
[ ] .gitignore configurado corretamente
[ ] .env não está no repositório
[ ] .env.example com placeholders apenas
[ ] Nenhum secret no código ou logs
[ ] HTTPS ativo em produção
[ ] CORS configurado para domínio específico
[ ] Cookies httpOnly, Secure, SameSite
[ ] Rate limiting ativo em todos os endpoints
[ ] Headers de segurança (Helmet) ativos
[ ] CSRF protection funcionando
[ ] Password hashing com bcrypt (custo 12)
[ ] JWT no cookie httpOnly
[ ] SQL injection protection (queries parametrizadas)
[ ] XSS prevention (escapeHtml)
[ ] Error handling sem stack traces em produção
[ ] Logs sem dados sensíveis
[ ] Auth middleware protege todas as rotas admin
[ ] Token de booking seguro e não previsível
[ ] Não existem credenciais hardcoded
```

## Database

```
[ ] PostgreSQL criado no Render
[ ] DATABASE_URL configurada via variável de ambiente
[ ] Migrations executadas com sucesso
[ ] Seed apenas com configurações mínimas (sem dados fictícios)
[ ] Índices criados corretamente
[ ] Constraint EXCLUDE para double booking
[ ] Foreign keys funcionando
[ ] Backup automático configurado no Render
[ ] Procedimento de restore documentado
[ ] schema_migrations table existe
[ ] notification_logs table funcional
[ ] calendar columns adicionadas
```

## Backend

```
[ ] node --check passa em todos os ficheiros JS
[ ] npm install funciona sem erros
[ ] npm start funciona
[ ] GET /health retorna {"status": "ok"}
[ ] GET /health/db retorna status do database
[ ] Todas as rotas funcionam
[ ] Autenticação admin funciona (login, logout, me)
[ ] Sessão expirada redireciona para login
[ ] Rate limiting funciona
[ ] CORS funciona para domínio correto
[ ] CSRF token no cookie e header
[ ] Availability service funciona
[ ] Booking service funciona
[ ] Double booking prevention funciona
[ ] Cancelamento funciona dentro do prazo
[ ] Notificações funcionam
[ ] ICS generator funciona
[ ] Timezone Europe/Lisbon correto
[ ] DST funciona
```

## Frontend

```
[ ] Cloudflare Pages configurado
[ ] Domínio funciona (www.meudominio.pt)
[ ] API_URL aponta para https://api.meudominio.pt
[ ] Sem localhost no código
[ ] Sem secrets no frontend
[ ] Sem dados mockados
[ ] Sem botões falsos
[ ] Sem Lorem ipsum
[ ] Página inicial funciona
[ ] Serviços carregam da API
[ ] Fluxo de marcação funciona
[ ] Calendário funciona
[ ] Disponibilidade vem da API
[ ] Formulário com validação funciona
[ ] Confirmação funciona
[ ] Página de sucesso funciona
[ ] Gestão da marcação funciona
[ ] Cancelamento funciona
[ ] ICS download funciona
[ ] Google Calendar funciona
[ ] SEO implementado (title, meta, OG)
[ ] sitemap.xml funciona
[ ] robots.txt funciona
[ ] favicon funciona
[ ] Página 404 funciona
[ ] Responsivo (mobile-first)
[ ] Acessível (ARIA, labels, foco)
[ ] Navegação funciona em desktop e mobile
```

## Notificações

```
[ ] Email de confirmação funciona
[ ] Email de cancelamento funciona
[ ] Lembrete 24h funciona
[ ] Lembrete 2h funciona
[ ] Admin notification funciona
[ ] Idempotência funciona (sem duplicatas)
[ ] Retry funciona
[ ] Falha do email não cancela marcação
[ ] Cliente sem email pode marcar
[ ] Cron Job configurado no Render
[ ] Cron Job está running
[ ] notification_logs funcional
[ ] SKIP LOCKED funciona para concorrência
```

## Calendário

```
[ ] .ics válido (formato correto)
[ ] Timezone Europe/Lisbon
[ ] DTSTART/DTEND corretos
[ ] UID estável
[ ] Google Calendar URL funciona
[ ] Download de .ics funciona
[ ] Protegido por token
[ ] DST considerado
```

## Testes

```
[ ] node --check passa em todos os ficheiros backend
[ ] npm test passa
[ ] Testes de availability passam
[ ] Testes de concorrência passam
[ ] Testes de timezone passam
[ ] Testes de notificações passam
[ ] Testes de booking passam
[ ] Testes de cancelamento passam
[ ] Smoke test de produção funciona
```

## Deploy

```
[ ] GitHub configurado
[ ] Cloudflare Pages funcionando
[ ] Render Web Service funcionando
[ ] Render PostgreSQL funcionando
[ ] Render Cron Job funcionando
[ ] Domínio funciona
[ ] HTTPS funciona
[ ] DNS configurado corretamente
[ ] Cookies funcionam entre subdomínios
```

## RGPD

```
[ ] Política de privacidade publicada
[ ] Termos de utilização publicados
[ ] Dados minimizados
[ ] Acesso administrativo protegido
[ ] Logs sem dados excessivos
[ ] Mecanismo de retenção/eliminação documentado
[ ] Consentimentos quando aplicáveis
```

## Documentação

```
[ ] README atualizado
[ ] docs/architecture.md criado
[ ] docs/api.md criado
[ ] docs/deployment.md criado
[ ] .env.example atualizado
[ ] Changelog atualizado
```

## Smoke Test Pós-Deploy

```
[ ] GET /health retorna 200
[ ] GET /api/services retorna 200
[ ] GET /api/settings retorna 200
[ ] GET / retorna 200 (frontend)
[ ] GET /servicos retorna 200
[ ] GET /marcacao retorna 200
[ ] Login admin funciona
[ ] Dashboard carrega
[ ] Serviços listam da API
[ ] Disponibilidade funciona
[ ] Booking cria marcação
[ ] Double booking rejeitado
[ ] Cancelamento funciona
[ ] Email de confirmação recebido
[ ] .ics download funciona
[ ] Google Calendar URL funciona
```

## Pós-Deploy

```
[ ] Criar admin inicial com password segura
[ ] Remover dados de teste
[ ] Verificar que não existem dados fictícios
[ ] Verificar backups automáticos
[ ] Configurar monitorização
[ ] Testar recuperação de backup
[ ] Documentar procedimentos de recover
```
