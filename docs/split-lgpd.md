# PROMPT — Auditoria Completa de LGPD, Segurança, Privacidade e Conformidade do Projeto

Você atuará como uma equipe composta pelos seguintes especialistas simultaneamente:

* Arquiteto de Software Sênior
* Engenheiro de Segurança da Informação
* Especialista em LGPD (Lei nº 13.709/2018)
* Especialista em Privacidade by Design e Privacy by Default
* Engenheiro DevSecOps
* Especialista em Banco de Dados
* Auditor de Segurança de Aplicações Web (OWASP)
* Engenheiro Backend
* Engenheiro Frontend
* Especialista em APIs
* Especialista em Cloud
* Especialista em Infraestrutura
* Especialista em Criptografia
* Especialista em Gestão de Logs
* Especialista em Governança de Dados
* Especialista em Compliance
* Especialista em Firebase, Supabase, Prisma, Railway, Vercel e demais tecnologias identificadas.

---

# OBJETIVO

Realizar uma auditoria **profunda, completa e exaustiva** de todo o projeto, verificando todos os aspectos relacionados à:

* Lei Geral de Proteção de Dados (LGPD)
* Segurança da Informação
* Privacidade
* Governança de Dados
* Conformidade
* Boas práticas de desenvolvimento
* Arquitetura
* Proteção contra ataques
* Tratamento de dados pessoais

A análise deve ser feita considerando que este sistema será utilizado comercialmente e deverá minimizar riscos técnicos, jurídicos e operacionais.

Não faça suposições.

Baseie todas as conclusões no código efetivamente existente.

Sempre que alguma informação não puder ser determinada apenas pela análise do projeto, informe claramente que será necessária validação manual.

---

# MODO DE EXECUÇÃO

Antes de sugerir qualquer alteração:

1. Leia TODOS os arquivos do projeto.
2. Entenda toda arquitetura.
3. Entenda todas as integrações.
4. Mapeie todos os fluxos de dados.
5. Descubra todas as dependências.
6. Descubra todos os ambientes.
7. Descubra todas as APIs.
8. Descubra todas as variáveis de ambiente utilizadas.
9. Descubra todas as regras de autenticação.
10. Descubra todas as regras de autorização.
11. Descubra todas as regras de armazenamento.

Somente depois disso inicie a auditoria.

---

# ESCOPO DA ANÁLISE

Analise absolutamente tudo.

Incluindo:

* Front-end
* Back-end
* Banco de dados
* Firebase
* Firestore
* Storage
* Authentication
* Prisma
* Railway
* Vercel
* Docker
* Docker Compose
* Kubernetes (caso exista)
* Terraform
* GitHub
* GitHub Actions
* CI/CD
* APIs REST
* APIs WebSocket
* Webhooks
* Arquivos .env
* Configurações
* Middleware
* Controllers
* Models
* Repositories
* Services
* Routes
* Migrations
* Seeds
* Helpers
* Utils
* Uploads
* Cookies
* Session
* LocalStorage
* SessionStorage
* Cache
* CDN
* Logs
* Monitoramento
* Auditoria
* Backup
* Recuperação
* Política de retenção
* Política de exclusão
* Integrações externas
* Stripe
* WhatsApp
* Evolution API
* OpenAI
* Gemini
* Claude
* Serviços de terceiros
* Bibliotecas instaladas
* Dependências NPM
* Dependências do sistema
* Scripts de automação
* Configurações do servidor
* Firewall
* CORS
* CSP
* Headers HTTP
* HTTPS
* Certificados

Nada deve ser ignorado.

---

# ETAPA 1 — INVENTÁRIO COMPLETO DE DADOS

Identifique TODOS os dados tratados pelo sistema.

Para cada dado encontrado informe:

* Nome do dado
* Tipo
* Origem
* Onde é coletado
* Tela
* Endpoint
* Banco
* Tabela
* Campo
* Fluxo
* Quem envia
* Quem recebe
* Quem consulta
* Quem altera
* Quem exclui
* Finalidade
* Necessidade
* Base legal
* Tempo de retenção
* Método de exclusão
* Local de armazenamento
* País onde é armazenado (quando possível)
* Nível de sensibilidade
* Criticidade
* Risco
* Observações

Classifique como:

* Dado pessoal
* Dado pessoal sensível
* Dado anonimizado
* Dado pseudonimizado
* Dado técnico
* Dado operacional

---

# ETAPA 2 — MAPEAMENTO DOS FLUXOS

Mapeie todo o ciclo de vida dos dados.

Desde:

Coleta

↓

Validação

↓

Processamento

↓

Persistência

↓

Consulta

↓

Atualização

↓

Compartilhamento

↓

Backup

↓

Arquivamento

↓

Exclusão

Monte diagramas textuais mostrando todos os fluxos.

---

# ETAPA 3 — VERIFICAÇÃO DA LGPD

Verifique todos os princípios da LGPD.

Finalidade

Adequação

Necessidade

Livre acesso

Qualidade

Transparência

Segurança

Prevenção

Não discriminação

Responsabilização

Prestação de contas

Para cada princípio:

* Explique se está sendo cumprido.
* Justifique.
* Mostre evidências.
* Informe os arquivos envolvidos.
* Informe os riscos.

---

# ETAPA 4 — BASE LEGAL

Para cada tratamento de dados determine:

* Base legal utilizada.
* Se a base legal está correta.
* Se há excesso de tratamento.
* Se o consentimento é realmente necessário.
* Se outra base legal seria mais adequada.

---

# ETAPA 5 — CONSENTIMENTO

Verifique:

* Registro do consentimento
* Data
* Hora
* IP
* User Agent
* Versão do termo
* Histórico
* Revogação
* Renovação
* Alterações

Caso não exista:

Crie um plano completo de implementação.

---

# ETAPA 6 — DIREITOS DO TITULAR

Verifique implementação dos direitos previstos na LGPD.

* Acesso
* Correção
* Exclusão
* Anonimização
* Bloqueio
* Portabilidade
* Revogação
* Oposição
* Informação sobre compartilhamento
* Revisão de decisões automatizadas

Explique como implementar os ausentes.

---

# ETAPA 7 — LOGS

Analise TODOS os logs.

Verifique:

* Dados pessoais registrados
* Dados sensíveis registrados
* IP
* User Agent
* Cookies
* Tokens
* JWT
* Authorization Header
* CPF
* Endereço
* Email
* Telefone
* CEP
* Senhas
* Hashes
* Cartões
* PIX
* Chaves
* Tokens de API

Verifique:

* Criptografia
* Retenção
* Integridade
* Imutabilidade
* Auditoria
* Controle de acesso

Indique qualquer violação.

---

# ETAPA 8 — BANCO DE DADOS

Analise todas as tabelas.

Para cada coluna:

* Tipo
* Finalidade
* Necessidade
* Base legal
* Índice
* Criptografia
* Retenção
* Exclusão
* Backup
* Compartilhamento

---

# ETAPA 9 — SEGURANÇA

Realize auditoria baseada no OWASP Top 10 mais recente e em boas práticas reconhecidas.

Verifique, entre outros:

* Broken Access Control
* Criptografia
* Injection (SQL, NoSQL, Command)
* SSRF
* XSS
* CSRF
* XXE
* SSTI
* IDOR
* Path Traversal
* Upload inseguro
* Clickjacking
* CORS
* CSP
* Headers HTTP
* Sessões
* Cookies
* JWT
* Refresh Tokens
* MFA
* Password Policy
* Rate Limit
* Brute Force
* DoS
* DDoS (mitigações aplicáveis)
* Logging
* Monitoramento
* Auditoria
* Exposição de informações
* Stack Trace
* Secrets
* Variáveis de ambiente
* Dependências vulneráveis
* Supply Chain
* RCE
* Deserialização insegura

Para cada vulnerabilidade:

Explique:

* Gravidade
* Impacto
* Probabilidade
* Como explorar
* Como corrigir
* Arquivos afetados
* Prioridade

---

# ETAPA 10 — PRIVACY BY DESIGN

Verifique se o sistema segue os princípios de Privacy by Design.

Caso não siga:

Mostre exatamente como adequar.

---

# ETAPA 11 — PRIVACY BY DEFAULT

Verifique se:

* O sistema coleta apenas o necessário.
* O padrão é o mais seguro.
* O compartilhamento é mínimo.

---

# ETAPA 12 — RETENÇÃO

Crie uma política completa de retenção para:

* Logs
* Usuários
* Pedidos
* Tokens
* Sessões
* Backups
* Auditorias
* Arquivos
* Uploads
* Notificações
* Histórico
* Eventos

Explique a justificativa técnica e jurídica para cada prazo, destacando quando a legislação não define um período específico e quando a retenção deve ser baseada na finalidade, obrigações legais ou necessidade operacional.

---

# ETAPA 13 — DOCUMENTAÇÃO

Verifique existência de:

* Política de Privacidade
* Política de Cookies
* Termos de Uso
* Política de Segurança
* Política de Retenção
* Plano de Resposta a Incidentes
* Registro das Operações de Tratamento (ROPA)
* Inventário de Dados
* Plano de Backup
* Plano de Continuidade de Negócios
* Procedimentos para atendimento aos direitos do titular

Caso inexistentes:

Explique como criar.

---

# ETAPA 14 — PLANO DE AÇÃO

Ao terminar:

Monte um plano completo contendo:

* Problema
* Descrição
* Arquivos afetados
* Gravidade
* Impacto
* Risco
* Esforço
* Tempo estimado
* Dependências
* Ordem correta de implementação
* Benefícios esperados
* Critérios de validação

Classifique:

🔴 Crítico

🟠 Alto

🟡 Médio

🟢 Baixo

---

# ETAPA 15 — CHECKLIST FINAL

Ao final gere um checklist completo contendo:

* Todos os itens conformes.
* Todos os itens não conformes.
* Todos os riscos encontrados.
* Todos os arquivos envolvidos.
* Todos os pontos pendentes.

---

# SAÍDA OBRIGATÓRIA

A resposta deve conter, no mínimo:

1. Resumo Executivo.
2. Inventário de Dados.
3. Fluxograma de Dados.
4. Auditoria LGPD.
5. Auditoria de Segurança.
6. Auditoria de Infraestrutura.
7. Auditoria de APIs.
8. Auditoria do Banco de Dados.
9. Auditoria de Logs.
10. Auditoria de Autenticação e Autorização.
11. Auditoria de Cookies e Armazenamento Local.
12. Auditoria de Dependências.
13. Auditoria de Configurações.
14. Auditoria de Criptografia.
15. Auditoria de Backup e Recuperação.
16. Auditoria de Documentação.
17. Plano de Correção priorizado.
18. Roadmap de Implementação.
19. Checklist Final.
20. Pontuação de conformidade (0–100), explicitando que é uma **estimativa técnica baseada na análise do código**, e não uma certificação jurídica.

# REGRAS OBRIGATÓRIAS

* Analise 100% do projeto antes de propor alterações.
* Não pule arquivos, mesmo que pareçam irrelevantes.
* Sempre cite as evidências (arquivos, trechos, funções ou fluxos) que fundamentam cada conclusão.
* Nunca invente informações. Se algo não puder ser confirmado pelo código, indique que requer validação manual.
* Diferencie claramente requisitos legais, boas práticas de mercado e recomendações arquiteturais.
* Priorize soluções que minimizem a coleta de dados, reduzam riscos e preservem a funcionalidade do sistema.
* Não altere código automaticamente. Apenas apresente o diagnóstico e um plano detalhado de implementação. Aguarde minha aprovação antes de sugerir ou gerar mudanças no código.
* Considere as orientações da **ANPD**, a **Lei nº 13.709/2018 (LGPD)** e boas práticas internacionais de segurança e privacidade (como OWASP, ISO/IEC 27001 e ISO/IEC 27701), deixando claro quando uma recomendação decorre de uma boa prática e não de uma obrigação legal expressa.
* A auditoria é **técnica** e **não substitui parecer jurídico profissional**. O objetivo é apoiar a adequação do sistema e reduzir riscos de não conformidade.
