# 📚 Fluency Portal - Guia Completo de Configuração

**Repositório**: `victorgomes-vgs/fluency-portal`  
**Criado em**: 18 de Fevereiro de 2026  
**Última atualização**: 23 de Agosto de 2026

---

## 📋 Índice

1. [Informações Básicas do Repositório](#informações-básicas-do-repositório)
2. [Configuração GitHub](#configuração-github)
3. [Configuração Firebase](#configuração-firebase)
4. [Regras de Firestore](#regras-de-firestore)
5. [Estrutura de Diretórios](#estrutura-de-diretórios)
6. [Configuração PWA](#configuração-pwa)
7. [Instruções de Reconstrução (Overhaul)](#instruções-de-reconstrução)
8. [Checklist para Replicar](#checklist-para-replicar)

---

## 🔍 Informações Básicas do Repositório

### Detalhes Gerais
- **Nome**: fluency-portal
- **Proprietário**: victorgomes-vgs
- **Visibilidade**: PUBLIC
- **Linguagem Principal**: HTML
- **Licença**: Nenhuma (None)
- **Tamanho**: ~304 MB
- **Branch Padrão**: main
- **Fork**: Não
- **Ativo**: Sim

### Estatísticas
- **Issues Abertas**: 1
- **Stars**: 0
- **Forks**: 0
- **Watchers**: 0
- **Network**: 0

### Permissões do Proprietário
- ✅ Admin
- ✅ Maintain
- ✅ Pull
- ✅ Push
- ✅ Triage

---

## 🔧 Configuração GitHub

### Regras de Merge & Commit

| Recurso | Status | Configuração |
|---------|--------|--------------|
| Merge Commit | ✅ HABILITADO | Título: MERGE_MESSAGE |
| Squash Merge | ✅ HABILITADO | Título: COMMIT_OR_PR_TITLE |
| Rebase Merge | ✅ HABILITADO | - |
| Auto Merge | ❌ DESABILITADO | - |
| Atualizar branch automaticamente | ❌ DESABILITADO | - |
| Deletar branch após merge | ❌ DESABILITADO | - |
| Assinatura de commit obrigatória | ❌ NÃO | - |

### Recursos Habilitados

**Ativados:**
- ✅ Issues
- ✅ Pull Requests
- ✅ Projects
- ✅ Wiki
- ✅ GitHub Pages (ATIVO)

**Desativados:**
- ❌ Discussions
- ❌ Downloads

### Política de Criação de PRs
- PRs podem ser criados de todos os branches para todos os branches

### Últimas Atividades
- **Último push**: 2026-08-23 às 02:04:02 UTC
- **Última atualização**: 15 horas atrás

---

## 🚀 Configuração Firebase

### Projeto Firebase
```
Projeto Padrão: fluency-studio-portal
```

### firebase.json

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "firestore.rules",
      "**/.*",
      "**/node_modules/**"
    ],
    "cleanUrls": true,
    "trailingSlash": false,
    "rewrites": [
      {
        "source": "**",
        "destination": "/portal.html"
      }
    ]
  }
}
```

**Explicação:**
- **Firestore**: Usa arquivo `firestore.rules` para segurança
- **Hosting**: Publica tudo no diretório raiz (.)
- **Clean URLs**: Remove extensões .html
- **Sem trailing slash**: URLs sem / no final
- **Rewrite**: Todas as rotas apontam para `/portal.html` (SPA)

### .firebaserc

```json
{
  "projects": {
    "default": "fluency-studio-portal"
  }
}
```

---

## 🔐 Regras de Firestore

**Arquivo**: `firestore.rules`  
**Versão**: 2

### Identificação de Admin
```
UID Admin: 58fjgMCI2aV7NQpXo3TcReUjHRF3
```

### Funções de Segurança Definidas

#### 1. `signedIn()`
Verifica se o usuário está autenticado
```
return request.auth != null;
```

#### 2. `isAdmin()`
Verifica se o usuário é administrador
```
return signedIn() && request.auth.uid == "58fjgMCI2aV7NQpXo3TcReUjHRF3";
```

#### 3. `userMap()`
Obtém dados do usuário autenticado
```
return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
```

#### 4. `ownsStudent(studentId)`
Verifica se é o aluno ou mentor do aluno
```
return signedIn() && (
  request.auth.uid == studentId ||
  userMap().studentId == studentId
);
```

### Estrutura de Coleções

#### `/config/aparencia`
- **Leitura**: Pública (true)
- **Escrita**: Admin only
- **Uso**: Configurações de tema e aparência

#### `/config/{document=**}`
- **Leitura**: Admin only
- **Escrita**: Admin only
- **Uso**: Todas as configurações do sistema

#### `/courses/{courseId}`
- **Leitura**: Usuários autenticados
- **Escrita**: Admin only
- **Uso**: Cursos disponíveis

#### `/studio/{document=**}`
- **Leitura**: Usuários autenticados
- **Escrita**: Admin only
- **Uso**: Conteúdo do estúdio

#### `/bookedSlots/{slotId}`
- **Leitura**: Usuários autenticados
- **Criar**: Aluno cria para si mesmo (slot livre)
- **Atualizar/Deletar**: Admin ou proprietário do aluno
- **Uso**: Slots de reposição de aulas

#### `/students/__system_courses`
- **Leitura**: Usuários autenticados
- **Escrita**: Admin only
- **Uso**: Cursos do sistema

#### `/students/{studentId}` (Coleção Principal de Alunos)

**Permissões de Leitura:**
- Admin: total
- Aluno: próprio documento
- Qualquer autenticado com email igual ao cadastro

**Permissões de Escrita:**
- Criar/Deletar: Admin only
- Atualizar: Admin ou proprietário do aluno

**Subcoleções:**

##### `exercises`
- Leitura: Admin ou aluno
- Criar/Atualizar: Admin ou aluno
- Deletar: Admin only

##### `reportCards`
- Leitura: Admin ou aluno
- Escrita: Admin only

##### `diario`
- Leitura: Admin ou aluno
- Criar/Atualizar: Admin ou aluno
- Deletar: Admin only

##### `calendarEvents`
- Leitura/Criar/Atualizar: Admin ou aluno
- Deletar: Admin ou aluno

##### `notifications`
- Leitura/Atualizar: Admin ou aluno
- Criar: Admin ou aluno
- Deletar: Admin only

##### `{document=**}` (fallback)
- Leitura: Admin ou aluno
- Escrita: Admin only

#### `/users/{userId}`
- **Leitura**: Admin ou proprietário (próprio documento)
- **Escrita**: Admin only
- **Uso**: Perfil de usuário

#### `/invoices/{document=**}`
- **Leitura**: Admin only
- **Escrita**: Admin only
- **Uso**: Faturas de alunos

#### `/transactions/{document=**}`
- **Leitura**: Admin only
- **Escrita**: Admin only
- **Uso**: Transações financeiras

#### `/{document=**}` (Fallback)
- **Leitura**: Negada
- **Escrita**: Negada
- **Uso**: Segurança - qualquer outra coleção é bloqueada

---

## 📁 Estrutura de Diretórios

### Raiz do Repositório

```
fluency-portal/
├── 📄 Arquivos de Configuração
│   ├── firebase.json                    # Config Firebase Hosting
│   ├── firestore.rules                  # Regras de segurança Firestore
│   ├── .firebaserc                      # Projeto Firebase
│   ├── site.webmanifest                 # PWA Manifest
│   ├── CNAME                            # Domínio customizado
│   ├── .nojekyll                        # Desabilita Jekyll (vazio)
│   │
│
├── 📄 SEO & Meta
│   ├── robots.txt                       # Instruções para bots
│   ├── sitemap.xml                      # Mapa do site
│   ├── fluency2026indexnow.txt          # IndexNow
│   │
│
├── 🏠 Páginas Principais
│   ├── index.html                       # Portal principal (830 KB)
│   ├── portal.html                      # Cópia do portal (830 KB)
│   ├── portalm.html                     # Versão mobile (660 KB)
│   │
│
├── 📚 Páginas de Conteúdo
│   ├── fluency-foundation.html           # Fluency Foundation (48 KB)
│   ├── fluency-foundation-corporate.html # FF Corporate (20 KB)
│   ├── bs-l1-digital.html                # BS L1 Digital (437 KB)
│   ├── corporate-speech.html             # Corporate Speech (26 KB)
│   ├── flash-talk.html                   # Flash Talk (23 KB)
│   ├── flash-talk-corporate.html         # Flash Talk Corporate (21 KB)
│   ├── lesson26.html                     # Lesson 26 (13 KB)
│   ├── lesson_past_tense.html            # Past Tense (1.4 MB)
│   ├── licao-76.html                     # Lição 76 (629 KB)
│   ├── one-verb-a-day-tostumble.html    # One Verb - To Stumble (82 KB)
│   ├── one-verb-topick.html              # One Verb - To Pick (37 KB)
│   ├── oneverbaday-toaddress.html        # One Verb - To Address (30 KB)
│   ├── personalizado-kaio-lesson31.html # Personalizado Kaio (20 KB)
│   ├── form-self.html                    # Formulário Self (56 KB)
│   ├── form-self-alunosfora.html         # Formulário Self Alunos Fora (56 KB)
│   └── setup-alunos.html                 # Setup Alunos (9.5 KB)
│   │
│
├── 📂 Diretórios de Conteúdo
│   ├── assets/                           # Imagens e recursos
│   │   └── logo_portal_jul.png
│   │
│   ├── adm/                              # Painel administrativo
│   ├── business/                         # Conteúdo business/corporate
│   ├── corporate-speech/                 # Conteúdo aula corporate speech
│   ├── empower-tarefas/                  # Tarefas programa Empower
│   ├── flips/                            # Flashcards/Flips
│   ├── materiais/                        # Materiais didáticos
│   ├── modulo1/                          # Módulo 1
│   └── tarefas/                          # Tarefas gerais
│   │
│
├── 💾 Arquivos de Dados & Scripts
│   ├── admin-relatorios.fragment.js      # Relatórios admin (24 KB)
│   ├── agenda-reposicoes.fragment.js     # Agenda reposições (31 KB)
│   ├── reflexive-m1-content.js           # Conteúdo reflexivo M1 (9.4 KB)
│   ├── novos_alunos_acessos.json         # Acessos novos alunos (716 B)
│   ├── pocket-ff-course-payload.json     # Payload curso FF (120 KB)
│   │
│
├── 📖 Documentação Markdown
│   ├── Overhaul-Instructions.md          # Instruções de modernização
│   ├── instrucoes-fluence-foundation.md # Instruções FF
│   ├── script-ivi-fluency-studio.md      # Script IVI Fluency Studio
│   ├── alunos_horarios_cursos.md         # Horários e cursos de alunos
│   │
│
├── 📄 PDFs Educacionais
│   ├── Fluency Foundation corporative módulo 2 guia do professor e extra resources.pdf (13.7 MB)
│   ├── coporative modulo 2 tarefa parte 1.pdf (16 MB)
│   ├── coporative módulo 2 tarefa parte 2.pdf (8.9 MB)
│   ├── fluency foundation modulo 2 practice tarefa part b.pdf (8.9 MB)
│   └── fluency foundation modulo 2 practice tarefav parte a.pdf (7 MB)
│   │
│
├── 🔊 Áudio
│   └── Lesson 26 listening.wav           # Áudio lição 26 (5.6 MB)
│   │
│
├── 🖼️ Imagens de Demonstração
│   ├── desktop.png                       # Screenshot desktop (52 KB)
│   ├── mobile.png                        # Screenshot mobile (45 KB)
│   ├── logoentrada.png                   # Logo entrada (426 KB)
│   ├── test-shot-0-welcome.png           # Test screenshot welcome (745 KB)
│   ├── test-shot-1-dados.png             # Test screenshot dados (557 KB)
│   ├── test-shot-2-programa.png          # Test screenshot programa (662 KB)
│   ├── test-shot-3-perfil.png            # Test screenshot perfil (468 KB)
│   ├── test-shot-4-erro.png              # Test screenshot erro (515 KB)
│   ├── test-shot-4-sucesso.png           # Test screenshot sucesso (729 KB)
│   └── test-shot-ui-check.png            # Test screenshot UI check (854 KB)
│   │
│
├── 🧪 Testes Automatizados (Python)
│   ├── test-browser-form-self.py         # Teste browser (5.8 KB)
│   ├── test-e2e-form-self.py             # Teste E2E (4 KB)
│   └── test-form-self-auth.py            # Teste autenticação (4.4 KB)
│   │
│
└── 📦 Outros
    └── gerador-de-diálogos-em-áudio-para-inglês.zip # Gerador de diálogos (110 KB)
```

### Resumo de Tamanho Total
- **Total**: ~304 MB
- PDFs: ~54 MB
- HTMLs: ~3.2 MB
- Imagens: ~7 MB
- Áudio: ~5.6 MB
- Resto: ~234 MB (dados, assets, etc)

---

## 🌐 Configuração PWA (Progressive Web App)

### site.webmanifest

```json
{
  "name": "Fluency Studio — Curso de Inglês Online",
  "short_name": "Fluency Studio",
  "description": "Curso de inglês personalizado com Victor Gomes. Método PEH 5.0, aula demonstrativa gratuita.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#050a15",
  "theme_color": "#050a15",
  "lang": "pt-BR",
  "dir": "ltr",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "assets/logo_portal_jul.png",
      "sizes": "905x895",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "assets/logo_portal_jul.png",
      "sizes": "905x895",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "categories": ["education", "business"],
  "related_applications": [],
  "prefer_related_applications": false
}
```

### Configurações PWA

| Campo | Valor |
|-------|-------|
| Nome Completo | Fluency Studio — Curso de Inglês Online |
| Nome Curto | Fluency Studio |
| Descrição | Curso de inglês personalizado com Victor Gomes. Método PEH 5.0 |
| URL de Início | / |
| Escopo | / |
| Display | standalone (app completo, sem URL bar) |
| Cor de Fundo | #050a15 (preto muito escuro) |
| Cor de Tema | #050a15 (preto muito escuro) |
| Idioma | pt-BR (Português Brasileiro) |
| Direção | ltr (esquerda para direita) |
| Orientação | portrait-primary (retrato) |
| Ícone | assets/logo_portal_jul.png (905x895px) |
| Categorias | education, business |

---

## 📝 Instruções de Reconstrução (Overhaul)

### Visão Geral

O arquivo `Overhaul-Instructions.md` contém um plano detalhado para modernizar a plataforma em duas fases:

#### FASE 1: The Visual Overhaul (Modernização Visual)
#### FASE 2: Finance Architecture Overhaul (Modernização Financeira)

### FASE 1: Visual Overhaul (High-End Premium Aesthetic)

**Objetivo**: Fazer a plataforma parecer sofisticada, limpa e profissional.

#### 1. Global Design System Implementation

**Palette de Cores Obrigatória:**

**Backgrounds:**
```css
Main App Background: #F8F9FA (Soft off-white)
Cards/Containers Background: #FFFFFF (Pure white)
Admin Sidebar Background: #1E293B (Deep slate/navy)
```

**Typography (Contraste Obrigatório):**
```css
Primary Text: #1E1E1E (Near black) /* MUST be used for all main body text */
Secondary Text: #475569 (Dark gray) /* For labels, subtitles, secondary info */
Sidebar Text: #FFFFFF or #CBD5E1 /* MUST be used for text on dark sidebar */
```

**PROIBIDO:**
- ❌ Light gray (#cccccc ou mais claro) em fundo branco
- ❌ Dark blue em fundo preto

**Accent Colors:**
```css
Primary Buttons/Links: #0F172A (Deep Navy) ou #4F46E5 (Rich Indigo)
```

**Tipografia:**
- Font Family: Inter, Helvetica Neue, ou Segoe UI
- Base Font Size: 16px

#### 2. Layout and Spacing Rules

**Card-based UI:**
```css
background: #FFFFFF
border-radius: 8px
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1)
padding: 24px (mínimo)
```

**Whitespace:**
- Aumentar espaço em branco
- Padding mínimo de 24px dentro de cards
- Espaçamento consistente

#### 3. Fixing Student vs Admin Views

- Separar claramente navegação Student vs Admin
- Remover inline styles que causam problemas de contraste
- Usar classes CSS globais definidas no design system

### FASE 2: Finance Architecture Overhaul

**Objetivo**: Corrigir o sistema financeiro completamente.

#### Problema Atual
Sistema financeiro incorreto. Fatura (Invoice) e Transação (Transaction) misturadas.

#### Solução

**Estrutura de Dados Firestore:**

**Collection: `invoices`**
```javascript
{
  studentId: string,           // ID do aluno
  amount: number,              // Valor da fatura
  description: string,         // Ex: "Fall Tuition"
  status: string,              // "unpaid" | "partially_paid" | "paid" | "overdue"
  dueDate: timestamp,          // Data de vencimento
  createdAt: timestamp         // Data de criação
}
```

**Collection: `transactions`**
```javascript
{
  studentId: string,           // ID do aluno
  invoiceId: string,           // Referência à fatura
  amount: number,              // Valor da transação
  type: string,                // "payment" | "refund" | "scholarship"
  method: string,              // "credit_card" | "cash" | "bank_transfer"
  date: timestamp              // Data da transação
}
```

#### Admin Finance Dashboard UI

**KPI Metric Cards (Top Row):**
1. **Total Revenue (Last 30 Days)**
   - Sum de transactions onde type == 'payment'

2. **Outstanding Balances**
   - Sum de invoices onde status != 'paid'

3. **Overdue Amount**
   - Sum de invoices onde status == 'overdue'

4. **Cash Flow Chart**
   - Gráfico de linha/barra: Revenue vs Expenses (últimos 6 meses)

5. **Recent Transactions Table**
   - Últimas 10 transações
   - Colunas: Date, Student Name, Amount, Status

#### Status Badges (CSS)

```css
/* PAID */
.badge-paid {
  color: #15803D;                    /* Green text */
  background-color: #F0FDF4;         /* Light green background */
}

/* PENDING/UNPAID */
.badge-pending {
  color: #B45309;                    /* Amber text */
  background-color: #FFFBEB;         /* Light amber background */
}

/* OVERDUE */
.badge-overdue {
  color: #B91C1C;                    /* Red text */
  background-color: #FEF2F2;         /* Light red background */
}
```

### Passos de Execução Recomendados

1. **Scan da estrutura** do repositório para entender framework
2. **Localizar** main styling files e finance components
3. **Criar branch** `feature/platform-overhaul`
4. **Executar Phase 1 (Visuals)**
   - Commit: `feat(ui): implement high-end design system and fix contrast issues`
5. **Executar Phase 2 (Finance)**
   - Commit: `feat(finance): rebuild admin dashboard and restructure finance data architecture`
6. **Output** resumo de mudanças e setup manual necessário

---

## ✅ Checklist para Replicar o Repositório

### Preparação Inicial
- [ ] Criar novo repositório no GitHub com nome `fluency-portal`
- [ ] Definir como público
- [ ] Branch padrão: `main`

### Copiar Configurações
- [ ] Habilitar Issues
- [ ] Habilitar Pull Requests
- [ ] Habilitar Projects
- [ ] Habilitar Wiki
- [ ] Ativar GitHub Pages
- [ ] Permitir Merge Commit (MERGE_MESSAGE)
- [ ] Permitir Squash Merge (COMMIT_OR_PR_TITLE)
- [ ] Permitir Rebase Merge
- [ ] Desabilitar Auto Merge
- [ ] Desabilitar atualizar branch automaticamente
- [ ] Desabilitar deletar branch após merge

### Copiar Arquivos de Configuração
- [ ] `.firebaserc`
- [ ] `firebase.json`
- [ ] `firestore.rules`
- [ ] `site.webmanifest`
- [ ] `CNAME` (com seu domínio)
- [ ] `.nojekyll`
- [ ] `robots.txt`
- [ ] `sitemap.xml`

### Copiar Estrutura de Diretórios
- [ ] `assets/`
- [ ] `adm/`
- [ ] `business/`
- [ ] `corporate-speech/`
- [ ] `empower-tarefas/`
- [ ] `flips/`
- [ ] `materiais/`
- [ ] `modulo1/`
- [ ] `tarefas/`

### Copiar Todos os Arquivos HTML
- [ ] `index.html`
- [ ] `portal.html`
- [ ] `portalm.html`
- [ ] Todos os outros HTMLs das aulas e conteúdo

### Copiar Arquivos de Dados
- [ ] Todos os `.js` files (admin-relatorios, agenda-reposicoes, etc)
- [ ] Todos os `.json` files (novos_alunos_acessos, pocket-ff-course-payload)
- [ ] Todos os `.md` files (documentação e instruções)

### Copiar Recursos Multimídia
- [ ] PDFs educacionais
- [ ] Áudio (Lesson 26 listening.wav)
- [ ] Imagens (desktop.png, mobile.png, logoentrada.png, etc)

### Configuração Firebase
- [ ] Criar novo projeto Firebase (ou usar existente)
- [ ] Atualizar `.firebaserc` com seu projeto
- [ ] Copiar/recriar estrutura de coleções Firestore
- [ ] Importar regras de segurança (`firestore.rules`)
- [ ] Configurar Firestore Database
- [ ] Configurar Firebase Hosting

### Configuração Firestore Database

**Criar Coleções:**
- [ ] `/config/aparencia`
- [ ] `/config/` (outras configs)
- [ ] `/courses/`
- [ ] `/studio/`
- [ ] `/bookedSlots/`
- [ ] `/students/` (com subcoleções)
- [ ] `/users/`
- [ ] `/invoices/`
- [ ] `/transactions/`

**Importar Dados:**
- [ ] Dados de cursos
- [ ] Dados de alunos
- [ ] Dados de usuários
- [ ] Configurações do sistema

### Configuração do Domínio
- [ ] Atualizar `CNAME` com seu domínio
- [ ] Configurar DNS (se necessário)
- [ ] Validar domínio no Firebase Hosting

### Testes
- [ ] Executar testes Python (`test-browser-form-self.py`, etc)
- [ ] Testar formulário de autoavaliação
- [ ] Testar autenticação
- [ ] Validar contraste de cores (WCAG 4.5:1)
- [ ] Testar versão mobile
- [ ] Testar PWA (instalação, offline)

### GitHub Pages & Deploy
- [ ] Ativar GitHub Pages no repositório
- [ ] Configurar branch de deploy
- [ ] Deploy na plataforma Firebase Hosting
- [ ] Validar SSL/HTTPS

### Documentação
- [ ] Copiar `Overhaul-Instructions.md`
- [ ] Copiar `instrucoes-fluence-foundation.md`
- [ ] Criar `README.md` com instruções de setup
- [ ] Documentar variáveis de ambiente necessárias

### Implementação de Melhorias (Conforme Overhaul)
- [ ] Implementar design system da FASE 1
- [ ] Corrigir contraste de cores
- [ ] Modernizar componentes UI
- [ ] Reestruturar finanças (FASE 2)
- [ ] Criar dashboard de admin
- [ ] Implementar status badges

---

## 📞 Notas Importantes

### Admin UID
Se você está configurando um novo ambiente, você precisa atualizar o `firestore.rules` com seu próprio UID admin:

**Arquivo**: `firestore.rules` (linha 10)
```javascript
function isAdmin() {
  return signedIn() && request.auth.uid == "SEU_UID_AQUI";
}
```

### Firebase Project
Projeto atual: `fluency-studio-portal`

Se você estiver criando um novo ambiente, crie um novo projeto Firebase e atualize `.firebaserc`.

### Domain (CNAME)
Verifique o arquivo `CNAME` para qual domínio está configurado e atualize conforme necessário.

### Dados Sensíveis
- ⚠️ Não compartilhe chaves de API Firebase
- ⚠️ Não commite credenciais
- ⚠️ Use variáveis de ambiente para dados sensíveis

---

## 🚀 Como Começar

1. Clone este guia como referência
2. Siga o checklist acima passo a passo
3. Adapte conforme suas necessidades
4. Execute os testes fornecidos
5. Implemente o plano de Overhaul se desejado

---

**Última Atualização**: 23 de Agosto de 2026  
**Criado por**: GitHub Copilot  
**Para**: victorgomes-vgs/fluency-portal
