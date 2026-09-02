# BACKUP OFICIAL — Fiscal Control V2

## Ponto protegido
- Commit oficial de backup: `50064ee2a6a5653c938015966fe2c63cec54b8b8`
- Data: 2026-09-02
- Motivo: versão aprovada antes da otimização de desempenho.

## Regra operacional
Este ponto deve ser tratado como a versão oficial de recuperação. Novas melhorias não devem substituir este estado. Em caso de regressão, o rollback deve retornar ao commit acima.

## Escopo protegido
- Gestão aprovada até este ponto.
- Cadastro e vínculo de coordenador/gerente.
- Carteiras com preservação dos filtros após salvar.
- Apurações permanece protegida e não deve ser alterada durante otimizações.

## Observação
Este arquivo é um registro do ponto oficial. A recuperação deve usar o commit SHA acima, não uma versão posterior.
