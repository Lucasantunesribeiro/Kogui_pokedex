# PROMPT PARA AUDITORIA COMPLETA E OTIMIZAÇÃO DO PROJETO KOGUI POKEDEX

## 🎯 OBJETIVO PRINCIPAL
Realizar uma **auditoria completa arquivo por arquivo** do projeto Kogui Pokedex, **minimizando drasticamente** a quantidade de código, arquivos e dependências, mantendo **100% da funcionalidade** e seguindo rigorosamente as melhores práticas do `agents.md`.

## 📋 INSTRUÇÕES DE EXECUÇÃO

### FASE 1: ANÁLISE INICIAL
1. **Mapear TODOS os arquivos** do projeto (backend + frontend)
2. **Identificar arquivos desnecessários** ou redundantes
3. **Listar dependências** e verificar quais são realmente necessárias
4. **Criar branch**: `feat/complete-audit-optimization`

### FASE 2: AUDITORIA ARQUIVO POR ARQUIVO

#### Para CADA arquivo, analisar:
- [ ] **É necessário?** (pode ser removido/consolidado?)
- [ ] **Código duplicado?** (consolidar em utilitários)
- [ ] **Dependências excessivas?** (remover bibliotecas desnecessárias)
- [ ] **Seguindo boas práticas?** (conforme agents.md)
- [ ] **Pode ser simplificado?** (menos linhas, mais eficiência)

#### Critérios de REMOÇÃO:
- Arquivos de configuração duplicados
- Componentes Angular com < 50 linhas (consolidar)
- Serviços com funcionalidade única (mesclar)
- Testes desnecessários ou redundantes
- Assets não utilizados
- Dependências não referenciadas

### FASE 3: OTIMIZAÇÃO ESTRUTURAL

#### Backend (Django/DRF):
- **Consolidar views** em ViewSets únicos quando possível
- **Unificar serializers** com herança
- **Simplificar models** removendo campos desnecessários
- **Reduzir migrations** para o mínimo essencial
- **Manter apenas** endpoints essenciais do agents.md

#### Frontend (Angular):
- **Consolidar componentes** pequenos em templates inline
- **Unificar serviços** com funcionalidades relacionadas
- **Simplificar guards** e interceptors
- **Remover pipes** customizados desnecessários
- **Otimizar imports** e tree-shaking

### FASE 4: DEPENDÊNCIAS MÍNIMAS

#### Backend - Manter APENAS:
```python
# requirements.txt - VERSÃO MÍNIMA
Django>=4.2
djangorestframework>=3.14
djangorestframework-simplejwt>=5.3
drf-spectacular>=0.26
django-filter>=23.0
requests>=2.31
python-decouple>=3.8
```

#### Frontend - Manter APENAS:
```json
// package.json - VERSÃO MÍNIMA
{
  "dependencies": {
    "@angular/core": "^17.0.0",
    "@angular/common": "^17.0.0",
    "@angular/forms": "^17.0.0",
    "@angular/router": "^17.0.0",
    "@angular/common/http": "^17.0.0"
  }
}
```

## 🔍 CHECKLIST DE AUDITORIA POR ARQUIVO

### Backend Files Analysis:
```
backend/
├── manage.py                    [✓ Manter - essencial]
├── requirements.txt             [🔍 Otimizar - remover deps desnecessárias]
├── Dockerfile                   [🔍 Otimizar - multi-stage mínimo]
├── kogui_pokedex/
│   ├── settings.py              [🔍 Simplificar - remover configs desnecessárias]
│   ├── urls.py                  [🔍 Consolidar - apenas rotas essenciais]
│   ├── wsgi.py                  [✓ Manter - essencial]
│   └── asgi.py                  [❓ Avaliar - necessário?]
├── api/
│   ├── models.py                [🔍 Simplificar - apenas campos essenciais]
│   ├── views.py                 [🔍 Consolidar - ViewSets únicos]
│   ├── serializers.py           [🔍 Unificar - herança]
│   ├── urls.py                  [🔍 Simplificar - rotas mínimas]
│   └── pokeapi_service.py       [🔍 Otimizar - cache simples]
└── accounts/
    ├── models.py                [❓ Avaliar - usar User padrão Django?]
    ├── views.py                 [🔍 Simplificar - apenas JWT]
    ├── serializers.py           [🔍 Consolidar com api/]
    └── urls.py                  [🔍 Mesclar com api/urls.py]
```

### Frontend Files Analysis:
```
frontend/src/app/
├── app.component.*              [🔍 Simplificar - apenas template essencial]
├── app.config.ts                [🔍 Otimizar - providers mínimos]
├── app.routes.ts                [🔍 Simplificar - rotas essenciais]
├── services/
│   ├── auth.service.ts          [🔍 Consolidar - unificar com api.service.ts]
│   ├── api.service.ts           [🔍 Simplificar - apenas HTTP calls]
│   ├── auth.interceptor.ts      [✓ Manter - essencial]
│   └── feedback.service.ts      [❓ Avaliar - necessário?]
├── pages/
│   ├── login/                   [🔍 Simplificar - template mínimo]
│   ├── pokemon/                 [🔍 Otimizar - componente único]
│   ├── favorites/               [🔍 Simplificar - lista básica]
│   ├── team/                    [🔍 Otimizar - slots simples]
│   ├── admin-users/             [❓ Avaliar - necessário para teste?]
│   └── password-reset/          [❓ Avaliar - necessário para teste?]
└── components/
    └── feedback/                [❓ Avaliar - usar toast nativo?]
```

## 🎯 META DE OTIMIZAÇÃO

### Quantidade de Arquivos - ANTES vs DEPOIS:
- **Backend**: 15+ arquivos → **8-10 arquivos máximo**
- **Frontend**: 20+ arquivos → **12-15 arquivos máximo**
- **Total**: 35+ arquivos → **20-25 arquivos máximo**

### Linhas de Código - META:
- **Backend**: Reduzir 40-50% das linhas
- **Frontend**: Reduzir 30-40% das linhas
- **Total**: Projeto 35-45% menor

### Dependências - META:
- **Backend**: Máximo 8-10 packages
- **Frontend**: Máximo 5-7 packages
- **Total**: 13-17 packages máximo

## 🚀 PLANO DE EXECUÇÃO

### 1. ANÁLISE (30 min):
```bash
# Mapear estrutura atual
find . -name "*.py" -o -name "*.ts" -o -name "*.html" -o -name "*.css" | wc -l
find . -name "*.py" -o -name "*.ts" -o -name "*.html" -o -name "*.css" > files_audit.txt

# Analisar dependências
pip list | wc -l
npm list --depth=0 | wc -l
```

### 2. REMOÇÃO (45 min):
- Remover arquivos desnecessários
- Consolidar componentes similares
- Eliminar código duplicado
- Remover dependências não utilizadas

### 3. OTIMIZAÇÃO (60 min):
- Simplificar código restante
- Implementar padrões do agents.md
- Otimizar imports e exports
- Melhorar performance

### 4. VALIDAÇÃO (30 min):
- Testar funcionalidades essenciais
- Verificar se build funciona
- Confirmar que testes passam
- Validar que não quebrou nada

## 📊 CRITÉRIOS DE SUCESSO

### ✅ Funcionalidades OBRIGATÓRIAS (não pode quebrar):
- [ ] Login com JWT persistente
- [ ] Listagem de Pokémon com filtros
- [ ] Sistema de favoritos
- [ ] Equipe de batalha (6 slots)
- [ ] Integração PokéAPI com cache
- [ ] Autenticação e autorização

### ✅ Melhorias OBRIGATÓRIAS:
- [ ] Projeto 35%+ menor em arquivos
- [ ] Código 40%+ menor em linhas
- [ ] Dependências 50%+ reduzidas
- [ ] Build time 30%+ mais rápido
- [ ] Bundle size 25%+ menor

### ✅ Qualidade OBRIGATÓRIA:
- [ ] Zero código duplicado
- [ ] Zero dependências não utilizadas
- [ ] Zero arquivos desnecessários
- [ ] 100% seguindo agents.md
- [ ] Código limpo e legível

## 🎯 COMANDOS DE EXECUÇÃO

```bash
# 1. Backup do estado atual
git checkout -b backup-before-audit
git add . && git commit -m "backup: estado antes da auditoria"

# 2. Criar branch de trabalho
git checkout -b feat/complete-audit-optimization

# 3. Análise inicial
echo "=== ANÁLISE INICIAL ===" > audit_report.md
find . -name "*.py" | wc -l >> audit_report.md
find . -name "*.ts" | wc -l >> audit_report.md
find . -name "*.html" | wc -l >> audit_report.md

# 4. Executar auditoria arquivo por arquivo
# (Seguir checklist acima)

# 5. Validação final
docker compose up -d
docker compose exec api python manage.py test
cd frontend && npm run build && npm test
```

## 📝 RELATÓRIO FINAL OBRIGATÓRIO

Ao final, gerar relatório com:
1. **Arquivos removidos** (lista completa)
2. **Código consolidado** (o que foi unificado)
3. **Dependências removidas** (packages eliminados)
4. **Métricas antes/depois** (arquivos, linhas, deps)
5. **Funcionalidades testadas** (checklist de validação)
6. **Próximos passos** (se houver)

---

## ⚡ EXECUÇÃO IMEDIATA

**INICIE AGORA** com a análise arquivo por arquivo seguindo este prompt. O objetivo é ter o **projeto mais enxuto e eficiente possível** mantendo 100% da funcionalidade do teste técnico da Kogui.

**LEMBRE-SE**: Menos é mais. Cada linha de código deve ter um propósito claro. Cada arquivo deve ser essencial. Cada dependência deve ser justificada.
