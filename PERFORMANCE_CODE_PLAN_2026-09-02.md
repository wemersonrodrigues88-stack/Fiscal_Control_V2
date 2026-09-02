# Fiscal Control V2 — plano de otimização de código

Base congelada: `44af446ec938bdcc56c81a42c122173caed8044c`.

## Gargalos confirmados

1. `ensureAp()` executa DDL e INSERT de preparação em requisições de Apurações.
2. `verifyApLock()` consulta D1 e baixa/lê o asset para recalcular o SHA em cada requisição.
3. `public/app.js` faz uma nova leitura integral de `/api/state?view=apuracoes` após alteração de status.
4. Assets estáticos já possuem cache imutável de longo prazo; não é prioridade alterar essa camada.

## Estratégia segura

- Não alterar regras de autorização.
- Não alterar estados ou transições de Apurações.
- Não alterar interface.
- Não aplicar cache de autenticação entre usuários/requisições.
- Não remover a proteção de integridade; apenas evitar trabalho repetido quando for seguro.
- Alterações de `worker-entry.js` somente com conteúdo integral validado.

## Critério de publicação

A otimização somente deve chegar à produção após validação do diff contra o commit congelado e teste das rotas de autenticação, Dashboard, Apurações, Carteiras, Prazos, Histórico, Equipe e Gestão.
