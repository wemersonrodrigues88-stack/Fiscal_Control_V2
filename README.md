# Fiscal Control V2

Reconstrução limpa do Fiscal Control — Gestão Fiscal Mensal.

## Princípios
- novo projeto independente;
- sem patches e sem código legado;
- Cloudflare Worker + D1;
- autenticação e autorização no backend;
- dados centralizados online;
- frontend apenas como interface;
- arquitetura modular e testável.

## Estrutura
- `public/` — interface web
- `src/` — módulos de domínio e serviços
- `database/` — schema e seed
- `worker.js` — entrada do Worker
- `wrangler.toml` — configuração Cloudflare

Secrets e credenciais não ficam no código público.
