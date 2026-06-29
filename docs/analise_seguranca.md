# Análise de Segurança: Fábrica de Salgados Costa

## Sumário Executivo

Esta análise de segurança focou na identificação de vulnerabilidades comuns em aplicações web na "Fábrica de Salgados Costa". Foram encontrados problemas significativos relacionados à exposição de credenciais, falhas de autenticação e autorização, e validação inadequada no frontend. Recomenda-se priorizar a correção das vulnerabilidades críticas para mitigar riscos de segurança.

## Problemas de Segurança Encontrados

### 1. Crítico

-   **Chaves de API Expostas:**
    -   **Descrição:** Os arquivos `api google iaStudio.txt` e `api openrouter ai.txt` estão presentes na raiz do projeto. Isso significa que chaves de API para serviços como Google IA Studio e OpenRouter AI estão publicamente acessíveis. Qualquer pessoa com acesso ao frontend da aplicação pode visualizar e abusar dessas chaves, resultando em custos indevidos, acesso não autorizado a serviços, ou interrupção de funcionalidades. Adicionalmente, a chave da API Geoapify (`AIzaSyDBhCBFT00bO5nBTSDyHabZwcQ71HAEr4o`) está diretamente embutida no `js/cart.js` e a chave do Firebase (`AIzaSyDBhCBFT00bO5nBTSDyHabZwcQ71HAEr4o`) em `index.html` e `js/cart.js`, o que também é uma grave exposição.
    -   **Localização:** `api google iaStudio.txt`, `api openrouter ai.txt`, `js/cart.js` (linha 3, linha 709), `index.html` (linha 265).
    -   **Impacto:** Acesso não autorizado a serviços externos, fraude de custos, interrupção de serviço, comprometimento de dados, vazamento de informações sensíveis.
    -   **Recomendação:** Todas as chaves de API devem ser armazenadas em variáveis de ambiente no lado do servidor e acessadas apenas pelo backend. O frontend deve interagir com o backend para acessar serviços externos de forma segura, sem expor as chaves diretamente. Para o Firebase, as chaves de configuração do SDK do *cliente* são geralmente seguras para o frontend, mas chaves de serviços backend devem ser mantidas em segredo. No entanto, o bcrypt.js é seguro para o frontend.

-   **Exposição de Credenciais Firebase (apiKey):**
    -   **Descrição:** A `apiKey` do Firebase está diretamente embutida nos arquivos `index.html` e `js/cart.js`. Embora a `apiKey` para o SDK cliente do Firebase seja projetada para ser pública, a menção de `api google iaStudio.txt` e `api openrouter ai.txt` levanta a preocupação de que outras chaves mais sensíveis possam ser tratadas de forma similar, ou que esta `apiKey` específica possa ter permissões excessivas, se não for uma chave de cliente padrão.
    -   **Localização:** `index.html` (linha 265), `js/cart.js` (linha 3).
    -   **Impacto:** Se essa `apiKey` tiver permissões além das necessárias para o frontend (e.g., acesso a outros serviços Google Cloud, ou permissões de escrita irrestritas no Firebase Rules), pode levar a abuso.
    -   **Recomendação:** Verificar as regras de segurança do Firebase para garantir que as permissões de leitura/escrita sejam estritamente controladas no Firestore e Realtime Database, e que apenas operações permitidas pelo frontend sejam possíveis. A chave em si é de cliente e inerentemente pública, mas o risco vem de permissões mal configuradas no lado do servidor.

-   **Problemas de Autenticação - Senhas Expostas no Firebase (Potencial):**
    -   **Descrição:** O sistema utiliza `dcodeIO.bcrypt.compare` e `dcodeIO.bcrypt.hash` no frontend (`js/menu.js`). Isso implica que as senhas são enviadas ao cliente para serem hashadas antes de serem armazenadas ou comparadas. Embora o hashing bcrypt no cliente seja melhor que texto puro, ele *não* resolve o problema de enviar a senha em texto puro ou facilmente reversível para o cliente para hashing/comparação. O ideal é que o hashing da senha e a comparação ocorram exclusivamente no backend, onde o servidor recebe a senha em texto puro (via HTTPS) e realiza o hashing e a comparação de forma segura, sem expor o hash original ou a lógica de hashing ao cliente.
    -   **Localização:** `js/menu.js` (linhas 378, 421).
    -   **Impacto:** Se um invasor interceptar o tráfego ou manipular o código JavaScript no cliente, ele pode obter a senha em texto puro ou o hash antes da comparação, ou até mesmo contornar o processo de autenticação. Além disso, se os hashes forem criados e armazenados no cliente, a segurança da própria função de hashing pode ser comprometida.
    -   **Recomendação:** A lógica de autenticação e hashing de senhas deve ser migrada para um backend seguro (Node.js/Express) com comunicação via HTTPS. O backend deve receber a senha em texto puro, fazer o hash usando uma biblioteca segura (e.g., `bcrypt` no Node.js) e comparar o hash com o armazenado no Firebase, sem expor o hash original ao cliente. As regras do Firebase Firestore devem ser configuradas para permitir apenas a criação de novos usuários com hashes válidos e proibir a leitura direta dos hashes.

### 2. Alto

-   **Problemas de Autorização (Ausência Aparente no Frontend):**
    -   **Descrição:** O projeto possui múltiplas páginas (`admin.html`, `balcao.html`, `caixa.html`, `entregador.html`, `dashboard.html`, `painelLoja.html`, `relatorios.html`) que sugerem diferentes níveis de acesso e papéis de usuário. No entanto, a análise do código JavaScript (`js/menu.js`, `js/cart.js`) não revela mecanismos explícitos de controle de acesso baseados em papéis (`role-based access control - RBAC`) ou verificação de permissões no frontend. A autenticação Firebase verifica apenas a identidade do usuário, mas não o que ele *pode* fazer.
    -   **Localização:** Disperso no frontend.
    -   **Impacto:** Usuários mal-intencionados podem tentar acessar páginas ou funcionalidades restritas simplesmente digitando a URL ou manipulando o JavaScript do cliente. Isso pode levar a visualização ou manipulação não autorizada de dados administrativos, de pedidos ou de entregadores.
    -   **Recomendação:** Implementar um sistema de autorização robusto. Para o frontend, esconder elementos de UI e redirecionar usuários sem permissão. No entanto, a *verificação crítica* de autorização deve sempre ser feita no backend (se houver API para operações administrativas) e através de Regras de Segurança do Firebase. Cada requisição a recursos sensíveis do Firebase deve ser validada por regras que verificam o `auth.uid` do usuário e seu papel/permissões associadas.

-   **Falhas de Validação (Frontend) - Incompletude:
    -   **Descrição:** Embora existam validações básicas no frontend (`js/cart.js` e `js/menu.js`) para campos obrigatórios (nome, whatsapp, endereço), elas são facilmente contornáveis pelo cliente. Não há validação robusta para formatos de entrada (telefone, CEP), valores numéricos (troco), ou para a integridade dos dados enviados para o Firebase. Por exemplo, a escolha de sabores em pacotes pode ser manipulada no frontend para enviar quantidades inválidas ou ignorar restrições.
    -   **Localização:** `js/cart.js` (linhas 753-768), `js/menu.js` (linhas 360-363, 415-418).
    -   **Impacto:** Dados inválidos podem ser persistidos no Firebase, levando a erros na lógica de negócios, cálculos incorretos, ou até mesmo negação de serviço se os dados corrompidos forem usados em outras partes do sistema. Pode haver manipulação de pedidos (quantidades, preços).
    -   **Recomendação:** Implementar validação de entrada robusta no frontend (para melhor UX) e *especialmente* no backend (via Firebase Security Rules e/ou funções do Cloud Functions se a lógica de negócios for mais complexa). Validações devem incluir tipo de dado, formato, intervalos de valores e sanitarização de entradas para prevenir ataques como XSS (mesmo que HTML seja gerado no frontend, dados armazenados podem ser injetados).

-   **Problemas de Autenticação - JWT no localStorage (`js/login.js`):**
    -   **Descrição:** O `js/login.js` armazena um `authToken` no `localStorage` após um login bem-sucedido. Embora comum, armazenar JWTs no `localStorage` é vulnerável a ataques de Cross-Site Scripting (XSS). Se um ataque XSS for bem-sucedido, o invasor pode roubar o token e usá-lo para autenticar-se como o usuário comprometido.
    -   **Localização:** `js/login.js` (linha 34).
    -   **Impacto:** Roubo de sessão, acesso não autorizado à conta do usuário.
    -   **Recomendação:** Considerar o uso de `HttpOnly cookies` para armazenar tokens de autenticação, o que os torna inacessíveis ao JavaScript do cliente e, portanto, imunes a ataques XSS. Se for manter no `localStorage`, implementar políticas rigorosas de Content Security Policy (CSP) para mitigar XSS.

### 3. Médio

-   **SQL Injection (Não Aplicável Diretamente, mas Conceito Relacionado):**
    -   **Descrição:** O projeto não utiliza um banco de dados relacional (SQL), mas sim Firebase Firestore (NoSQL). Portanto, SQL Injection não é uma vulnerabilidade direta. No entanto, o conceito de "NoSQL Injection" ou manipulação de queries pode surgir se a construção das queries do Firebase for baseada em inputs não sanitizados e com permissões excessivas. Atualmente, as interações parecem ser via SDK, que geralmente abstrai essa preocupação, mas as regras de segurança do Firebase são cruciais.
    -   **Localização:** Não aplicável diretamente.
    -   **Impacto:** Manipulação ou acesso não autorizado a dados no Firebase Firestore.
    -   **Recomendação:** Garantir que as Firebase Security Rules sejam rigorosamente definidas para cada coleção, limitando o acesso e as operações com base nas permissões do usuário autenticado e na estrutura dos dados, evitando que queries manipuladas possam acessar ou modificar dados indevidamente.

-   **XSS (Cross-Site Scripting) - Potencial em Renderização Dinâmica:**
    -   **Descrição:** O frontend constrói dinamicamente grandes blocos de HTML usando `innerHTML` e interpolação de strings (template literals), especialmente em `js/menu.js` (linhas 99-114, 178-191) e `js/cart.js` (linhas 189-216, 372-384, 498-526). Se os dados carregados do Firebase (como nomes ou descrições de produtos, nomes de usuários) contiverem conteúdo malicioso (e.g., `<script>alert('XSS');</script>`), esse script será executado no navegador do cliente.
    -   **Localização:** `js/menu.js` (linhas 99-114, 178-191), `js/cart.js` (linhas 189-216, 372-384, 498-526).
    -   **Impacto:** Roubo de sessão, defacement da página, redirecionamento malicioso, execução de código arbitrário no navegador do usuário.
    -   **Recomendação:** Ao inserir dados dinâmicos em HTML, sempre sanitizar a entrada ou usar métodos de manipulação de DOM que escapem automaticamente o conteúdo (e.g., `textContent` para texto simples, ou bibliotecas de sanitização para HTML confiável). Implementar uma Content Security Policy (CSP) robusta no cabeçalho HTTP para restringir as fontes de scripts, estilos e outros recursos, mitigando XSS.

### 4. Baixo

-   **Falhas de Firebase (Regras de Segurança não Verificadas):**
    -   **Descrição:** Embora o Firebase seja usado para persistência de dados, não foram analisadas as `Firebase Security Rules`. A segurança da aplicação Firebase depende *criticamente* dessas regras. Se as regras forem muito permissivas (e.g., `allow read, write: if true;`), qualquer usuário pode ler ou escrever em qualquer parte do banco de dados.
    -   **Localização:** Regras de Segurança do Firebase (não visíveis no projeto).
    -   **Impacto:** Leitura/escrita não autorizada de dados, manipulação de preços, pedidos, informações de usuários, etc.
    -   **Recomendação:** Auditoria e reforço das Firebase Security Rules para garantir que apenas usuários autenticados e autorizados possam realizar operações específicas em coleções e documentos específicos. Por exemplo, um usuário só pode ler seus próprios pedidos, e apenas administradores podem modificar produtos ou cupons.

## Correções Prioritárias (Críticas e Altas)

### 1. Eliminação de Chaves de API Expostas (Crítico)

-   **Ação:** Remover `api google iaStudio.txt` e `api openrouter ai.txt` do projeto. Integrar serviços de IA e Geoapify através de um backend. Para a `apiKey` do Firebase, embora seja pública, garantir que as regras de segurança no Firebase sejam estritas para evitar abuso.
-   **Alterações:**
    -   Remover arquivos `api google iaStudio.txt` e `api openrouter ai.txt`.
    -   Em `js/cart.js` (linha 709) e `index.html` (linha 265), a `apiKey` do Firebase SDK cliente não precisa ser removida, mas as `Firebase Security Rules` devem ser configuradas para proteção.
    -   Em `js/cart.js` (linha 709), a chave da API Geoapify deve ser removida e o acesso a essa API deve ser proxied por um backend seguro.

### 2. Migração da Lógica de Autenticação/Hashing de Senha para o Backend (Crítico)

-   **Ação:** Mover toda a lógica de hashing de senha (`dcodeIO.bcrypt.hash`) e comparação (`dcodeIO.bcrypt.compare`) do frontend (`js/menu.js`) para um backend Node.js (idealmente, um backend dedicado que lide com autenticação). O frontend enviará a senha em texto puro (via HTTPS) para o backend, que fará o hashing e a comparação com o hash armazenado no Firebase. O backend retornará um token de sessão ou um status de sucesso/falha.
-   **Alterações:**
    -   **`js/menu.js`:**
        -   Remover referências a `dcodeIO.bcrypt`.
        -   Modificar as funções de login (`btnLogin`) e cadastro (`btnRegister`) para enviar a senha (e outros dados de usuário) para um endpoint de API no backend (e.g., `/api/auth/login`, `/api/auth/register`).
        -   Aguardar a resposta do backend para determinar o sucesso da operação.
    -   **Firebase Security Rules:** Ajustar as regras para permitir apenas que o backend (via service account) grave novos usuários com senhas hashadas, e para que os usuários só possam ser lidos por si mesmos ou pelo backend.
    -   **Criação de Backend de Autenticação (Novo):** Implementar um novo serviço backend (e.g., em Node.js com Express e a biblioteca `bcrypt`) que:
        -   Receba requisições de login e registro.
        -   Faça o hashing das senhas recebidas.
        -   Interaja com o Firebase Firestore para armazenar/comparar hashes de senha.
        -   Gere tokens de sessão seguros (se necessário) após login bem-sucedido.

### 3. Implementação de Autorização Baseada em Papéis (Alto)

-   **Ação:** Implementar mecanismos de autorização no frontend e, crucialmente, nas `Firebase Security Rules` e no backend (para APIs que exigem permissões específicas). Isso garantirá que apenas usuários com os papéis e permissões corretas possam acessar recursos e funcionalidades específicas.
-   **Alterações:**
    -   **Firebase Security Rules:** Reforçar as regras para que cada documento e coleção tenha permissões baseadas no `auth.uid` e em campos de `role` ou `permissions` armazenados no perfil do usuário no Firestore.
    -   **Frontend:** No JavaScript, verificar o papel/permissões do usuário logado (armazenado, por exemplo, em `localStorage` ou como parte do objeto `userLogged` retornado pelo Firebase) antes de exibir elementos de UI ou permitir certas ações. Redirecionar usuários não autorizados de páginas restritas.
    -   **Backend:** Se houver APIs para ações administrativas, validar o token de autenticação e as permissões do usuário antes de processar a requisição.

### 4. Reforço da Validação de Entrada (Frontend e Backend/Firebase Rules) (Alto)

-   **Ação:** Adicionar validações mais rigorosas em todos os campos de entrada, tanto no frontend para melhorar a UX quanto no backend (via Firebase Security Rules ou Cloud Functions) para garantir a integridade dos dados e prevenir injeção de dados maliciosos.
-   **Alterações:**
    -   **`js/cart.js` e `js/menu.js`:**
        -   Adicionar validações de formato para telefone (regex), CEP (formato e existência), valores numéricos (troco, quantidades), garantindo que os dados correspondam aos tipos esperados.
        -   Sanitizar todas as entradas do usuário antes de construir HTML dinamicamente (para mitigar XSS) ou enviar para o Firebase.
    -   **Firebase Security Rules:** Configurar regras para validar a estrutura e o tipo dos dados que estão sendo gravados, por exemplo: `allow write: if request.resource.data.nome is string && request.resource.data.telefone is string && request.resource.data.qtd is int && request.resource.data.qtd > 0;`.

### 5. Uso de HttpOnly Cookies para Tokens (Alto)

-   **Ação:** Se o `js/login.js` continuar sendo usado com um endpoint de backend, e se ele retornar um token JWT, este token deve ser armazenado em um cookie `HttpOnly` e `Secure` (se HTTPS for usado) em vez de `localStorage`. Isso o protegerá contra roubo por XSS.
-   **Alterações:**
    -   **Backend (`/login` endpoint):** Configurar o endpoint de login para definir o JWT em um cookie `HttpOnly` e `Secure` na resposta.
    -   **Frontend (`js/login.js`):** Remover o armazenamento do token no `localStorage` e confiar que o navegador enviará o cookie automaticamente em requisições subsequentes.

## Próximos Passos

-   Implementar as correções críticas e de alta prioridade conforme detalhado acima.
-   Realizar testes de segurança (penetration testing, varreduras de vulnerabilidade) para validar as correções e identificar novas falhas.
-   Revisar as `Firebase Security Rules` com um especialista para garantir a máxima proteção dos dados.
-   Considerar a refatoração do frontend para uma arquitetura mais modular (ES Modules, framework) para melhorar a manutenibilidade e segurança a longo prazo.


