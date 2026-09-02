# Fiscal Control V2 — Otimização controlada de performance

Base congelada: `44af446ec938bdcc56c81a42c122173caed8044c`
Branch: `performance-optimization-2026-09-02`

## Objetivo
Reduzir tempo de resposta sem alterar interface, regras fiscais, permissões ou dados.

## Diagnóstico técnico

### 1. D1 — índices
As consultas de `history` e `deadlines` possuem filtros/ordenações que se beneficiam de índices auxiliares. A migração correspondente está em `database/performance-optimization-2026-09-02.sql`.

### 2. Apurações — DDL em requisições
`ensureAp()` executa `CREATE TABLE IF NOT EXISTS`, tentativa de `ALTER TABLE` e `INSERT OR IGNORE` durante o fluxo de requisições. Isso gera trabalho desnecessário e é um dos principais candidatos a latência.

### 3. Apurações — verificação de integridade do asset
`verifyApLock()` lê o `apuracoes-enhancement.js` e calcula SHA-1 para cada requisição protegida. É custo adicional de CPU/I/O que deve ser reduzido sem remover a proteção.

### 4. Frontend — recarga completa após alteração
A tela de Apurações atualiza um status e depois solicita novamente `/api/state?view=apuracoes`, reconstruindo todo o estado. Em carteiras maiores isso aumenta a latência percebida.

### 5. Frontend — consultas repetidas
Navegações e algumas operações refazem chamadas que poderiam ser reaproveitadas por uma curta janela de cache em memória, desde que o cache seja invalidado após alterações.

## Ordem segura de implementação
1. Aplicar índices D1.
2. Transformar a preparação de schema de Apurações em operação idempotente por isolate, mantendo fallback para ambientes sem migração.
3. Reduzir verificações repetitivas do asset sem remover a validação de integridade.
4. Evitar recarga integral da tela quando uma atualização local é suficiente.
5. Adicionar cache curto somente para leituras e invalidar após mutações.
6. Medir novamente antes de publicar.

## Regra de segurança
Nenhuma alteração deve ser feita diretamente em `main` até a comparação de comportamento e desempenho. A branch de otimização deve permanecer separada da versão congelada.
