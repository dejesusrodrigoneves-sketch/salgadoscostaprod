# Análise de Projeto: Fábrica de Salgados Costa

## Arquitetura Atual

O projeto adota uma arquitetura predominantemente frontend-driven com o uso de HTML, CSS (Sass) e JavaScript puro para a interface do usuário. A persistência de dados e a autenticação de usuários são realizadas através do Firebase (Firestore e Realtime Database, implicitamente para alguns contadores). Existe um componente de backend em Node.js focado em funcionalidades de rastreamento em tempo real via WebSockets.

-   **Frontend:** Páginas HTML estáticas interativas, estilizadas com CSS e SCSS, e com lógica implementada em JavaScript. As páginas (`index.html`, `admin.html`, `balcao.html`, `caixa.html`, `dashboard.html`, `entregador.html`, `login.html`, `painelLoja.html`, `rastreio.html`, `relatorios.html`, `view/cart.html`) sugerem interfaces dedicadas a diferentes papéis e funcionalidades dentro do sistema (cardápio, administração, balcão, caixa, entregas, rastreamento, relatórios).
-   **Backend (Node.js/Express/ws):** Um microsserviço (aparentemente localizado em `rastreamento-delivery/costasalgados/`) que utiliza Express para roteamento básico e `ws` para gerenciar conexões WebSocket. Seu propósito principal é o rastreamento em tempo real de entregadores, recebendo atualizações de localização e retransmitindo-as aos clientes interessados.
-   **Backend (Firebase):** Utilizado para armazenamento e recuperação de dados como produtos, usuários, cupons, horários de funcionamento e pedidos. Firebase Firestore é o principal banco de dados NoSQL.

## Fluxo do Sistema

### Frontend (Cliente Final - `index.html`, `view/cart.html`)
1.  **Carregamento:** Ao acessar `index.html`, o cliente carrega a lista de produtos (do Firebase), horários de funcionamento (do Firebase) e inicializa o carrinho (do `localStorage`).
2.  **Exibição do Cardápio:** Produtos são exibidos dinamicamente, categorizados por tipo (Salgadinhos, Massas, Bebidas, etc.).
3.  **Adição ao Carrinho:** O cliente adiciona produtos ao carrinho. Alguns produtos (como os de "festa" ou "congelados") podem requerer a seleção de sabores ou quantidades específicas através de modais interativos.
4.  **Cálculo do Carrinho:** O sistema calcula o valor total dos itens, adiciona taxa de entrega (se for delivery e o bairro tiver taxa), e aplica descontos de cupons. Também calcula taxas de cartão, se aplicável.
5.  **Autenticação/Cadastro:** Usuários podem fazer login ou se cadastrar usando telefone/senha. As credenciais são armazenadas no Firebase Firestore com hash de senha (bcrypt). Dados de endereço são auto-preenchidos via BrasilAPI/ViaCEP. Usuários logados têm seus dados (nome, telefone, endereço) automaticamente preenchidos no formulário de pedido.
6.  **Geração do Pedido:** Ao finalizar, o cliente escolhe o tipo de entrega (retirada/delivery) e forma de pagamento. O sistema valida os campos, gera um número de pedido sequencial (usando um contador no Firebase), e salva os detalhes do pedido no Firestore. Se delivery, busca coordenadas geográficas via Geoapify. O pedido é então enviado via WhatsApp para o lojista, e o estoque do Firebase é atualizado, pausando produtos se ficarem sem estoque.

### Backend (Rastreamento de Entregadores - `rastreamento-delivery/costasalgados/server.js`)
1.  **Conexão WebSocket:** Entregadores (via `entregador.html` e scripts JS) e clientes/painéis de rastreamento (via `rastreio.html` e `painelLoja.html`) estabelecem conexões WebSocket com o servidor.
2.  **Registro do Entregador:** Entregadores enviam seu `entregadorId` ao se conectar. O servidor armazena essas conexões ativas.
3.  **Atualização de Localização:** Entregadores enviam periodicamente mensagens com `entregadorId`, `latitude` e `longitude`.
4.  **Broadcast:** O servidor retransmite (broadcast) essas atualizações de localização para *todos* os clientes WebSocket conectados, permitindo o rastreamento em tempo real em todas as interfaces relevantes.
5.  **Desconexão:** Gerencia a remoção de WebSockets inativos.

## Dependências

### Frontend
-   **Firebase SDK:** `firebase-app.js`, `firebase-firestore.js` (versão 8.10.1) - Para interação com o Firebase Firestore (produtos, usuários, pedidos, horários, cupons).
-   **bcrypt.js:** `cdnjs.cloudflare.com/ajax/libs/bcryptjs/2.4.3/bcrypt.min.js` - Para hash e comparação de senhas no cliente.
-   **Toastify-JS:** `cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css`, `cdn.jsdelivr.net/npm/toastify-js` - Para notificações toast na interface.
-   **Iconify:** `code.iconify.design/2/2.2.1/iconify.min.js` - Para ícones escaláveis.
-   **Google Fonts:** Montserrat (via `fonts.googleapis.com` e `fonts.gstatic.com`) - Fonte da interface.
-   **APIs Externas (via JavaScript):**
    -   `BrasilAPI` (`brasilapi.com.br/api/cep/v2/{CEP}`): Para auto-preenchimento de endereço baseado no CEP (usado em `js/menu.js` para cadastro).
    -   `ViaCEP` (`viacep.com.br/ws/{CEP}/json/`): Para auto-preenchimento de endereço baseado no CEP (usado em `js/cart.js` para formulário de pedido).
    -   `Geoapify` (`api.geoapify.com/v1/geocode/search`): Para obter coordenadas geográficas (latitude/longitude) a partir de um endereço (usado em `js/cart.js`).

### Backend (`rastreamento-delivery/costasalgados/package.json`)
-   `express`: `^4.19.0` - Framework web para Node.js.
-   `ws`: `^8.17.0` - Implementação de servidor e cliente WebSocket para Node.js.

## Arquivos Principais

-   **HTML (Páginas da Aplicação):**
    -   `index.html`: Página inicial com cardápio, promoções, horários e formulário de login/cadastro.
    -   `view/cart.html`: Página do carrinho de compras com resumo do pedido e formulário de finalização.
    -   `login.html`: Página de login dedicada (embora `index.html` também tenha um mini-login).
    -   `admin.html`, `balcao.html`, `caixa.html`, `dashboard.html`, `entregador.html`, `painelLoja.html`, `rastreio.html`, `relatorios.html`: Interfaces para diferentes perfis de usuário/funcionalidades do sistema.
-   **JavaScript (Frontend):**
    -   `js/menu.js`: Lógica para exibir produtos do cardápio, filtrar por categoria, auto-preenchimento de CEP no cadastro, status da loja e login/cadastro (duplicando alguma lógica de `login.js`).
    -   `js/cart.js`: Lógica principal do carrinho de compras, cálculo de valores, aplicação de cupons, gestão de modais de sabores/quantidade, e geração/envio de pedidos para Firebase e WhatsApp.
    -   `js/login.js`: Lógica de login dedicada, com comunicação com um endpoint `/login` (que não está no backend rastreamento, sugerindo outro backend ou erro de concepção).
    -   `js/products.js`: Definição estática de produtos (`window.products`). *OBS: Este arquivo parece estar em desuso, pois o `menu.js` e `cart.js` buscam produtos do Firebase Firestore.*
    -   `js/shoppingCart.js`: *Este arquivo apresenta grande redundância com `js/cart.js` e `js/menu.js`, especialmente em lógica de carrinho, cupons, e geração de pedidos. Parece ser uma versão alternativa ou antiga do carrinho, que ainda usa a lista estática de produtos e não interage com Firebase para pedidos.*.
    -   `js/navbar.js`: Lógica para a navegação mobile.
    -   `js/caixa.js`, `js/painel.js`: Lógicas específicas para as interfaces do caixa e painel, respectivamente.
-   **CSS (Estilização):**
    -   `css/style.scss` / `css/style.css`: Estilos globais da aplicação.
    -   `css/cart.scss` / `css/cart.css`: Estilos específicos do carrinho.
    -   `css/login.css`: Estilos para a página de login.
    -   `css/painelstyle.css`: Estilos para painéis.
-   **Backend (Node.js):**
    -   `rastreamento-delivery/costasalgados/server.js`: Servidor WebSocket para rastreamento de entregadores.
    -   `rastreamento-delivery/costasalgados/package.json`: Configuração de dependências do servidor Node.js.

## Possíveis Problemas Estruturais

-   **Duplicação e Inconsistência da Lógica de Carrinho e Pedido:** A presença de `js/cart.js` e `js/shoppingCart.js`, ambos com funcionalidades sobrepostas de gerenciamento de carrinho, cálculo de valores, aplicação de cupons e geração de pedidos, é uma fonte significativa de problemas. O `shoppingCart.js` parece ser uma versão antiga/desatualizada que ainda usa dados de produtos estáticos e não interage com o Firebase para pedidos, enquanto `cart.js` é mais completo e interage com o Firebase. Isso pode levar a bugs, dificuldade de manutenção e comportamento inconsistente da aplicação.
-   **Gerenciamento de Produtos:** O arquivo `js/products.js` com uma lista estática de produtos (`window.products`) é redundante, pois os produtos estão sendo carregados dinamicamente do Firebase Firestore via `js/menu.js` e utilizados em `js/cart.js`. A existência do arquivo estático pode causar confusão e possíveis desyncs se não for removido ou integrado corretamente.
-   **Segurança de Credenciais:** A presença de `api google iaStudio.txt` e `api openrouter ai.txt` na raiz do projeto é uma vulnerabilidade grave. Chaves de API e credenciais sensíveis nunca devem ser expostas em arquivos de frontend ou na raiz, pois são acessíveis publicamente. Devem ser gerenciadas no backend via variáveis de ambiente ou serviços de gerenciamento de segredos.
-   **Organização de Arquivos HTML:** Múltiplos arquivos HTML diretamente na raiz e em subpastas (`view/cart.html`) podem se tornar difíceis de gerenciar. Uma pasta `public/` ou `views/` na raiz para agrupar todos os HTMLs seria uma prática mais organizada.
-   **Acoplamento Forte e Ausência de Modularização Frontend:** O JavaScript frontend é escrito em scripts globais, levando a um forte acoplamento entre os diferentes arquivos JS e manipulação direta do DOM. Isso dificulta a reutilização de código, testes e manutenção. Adoção de ES Modules e um bundler (Webpack, Vite) melhoraria a modularidade.
-   **Lógica de Autenticação Duplicada/Inconsistente:** A lógica de login e cadastro existe em `js/menu.js` e em `js/login.js`. Além disso, `js/login.js` tenta se comunicar com um endpoint `/login` via `fetch`, sugerindo a existência de um *outro* backend não documentado ou uma funcionalidade incompleta/abandonada. O login via Firebase em `js/menu.js` é o que parece estar em uso.
-   **Escalabilidade do Backend WebSocket:** A retransmissão de localização para *todos* os clientes via `wss.clients.forEach` pode não escalar bem para um grande número de entregadores e clientes de rastreamento. Implementar estratégias como "salas" (rooms) ou padrões de publicação/assinatura (pub/sub) pode otimizar a distribuição de atualizações apenas para clientes relevantes.
-   **Tratamento de Erros e Validação (Frontend):** Embora existam alertas básicos, a validação de formulários e o tratamento de erros em algumas partes do frontend podem ser aprimorados com feedback mais robusto e user-friendly, evitando que o usuário insira dados inválidos ou submeta pedidos incompletos.

## Módulos Duplicados

-   **Lógica de Carrinho e Pedido:** `js/cart.js` e `js/shoppingCart.js`. Esta é a duplicação mais crítica, com o `shoppingCart.js` parecendo obsoleto e em conflito com a lógica atualizada do `cart.js` que usa Firebase.
-   **Listagem de Produtos:** `js/products.js` (lista estática) vs. carregamento dinâmico do Firebase via `js/menu.js` e `js/cart.js`. O `js/products.js` deveria ser removido.
-   **Configuração do Firebase:** A configuração `firebaseConfig` aparece em `index.html` (diretamente no script) e em `js/cart.js`. Embora comum para apps pequenas, centralizar a inicialização em um único local (e.g., um `firebase-init.js`) é uma boa prática.
-   **Lógica de Login/Cadastro:** Há partes da lógica de login e cadastro tanto em `js/menu.js` quanto em `js/login.js`, e a existência de um endpoint `/login` no `js/login.js` levanta questões sobre múltiplos backends de autenticação.
-   **Estilos CSS/SCSS:** `css/cart.css` e `css/cart.scss`, `css/style.css` e `css/style.scss`. Isso é esperado para arquivos SCSS que são compilados para CSS. O problema ocorreria se os arquivos `.css` fossem editados manualmente ou se a compilação não fosse automatizada.

## Trechos com Alta Complexidade

-   **`js/cart.js` - Funções de Cálculo e Geração de Pedido (`calculaValorItens`, `updateValores`, `generateOrder`):**
    -   A lógica para calcular o valor total, aplicar descontos, taxas de entrega e taxas de cartão (`updateValores`) é intrincada, envolvendo várias condições (tipo de entrega, forma de pagamento, existência de cupons, taxas por bairro). A função `generateOrder` também é complexa devido à formatação de itens com e sem sabores, interação com Firebase (salvar pedido, gerar ID sequencial, atualizar estoque) e integração com APIs externas (Geoapify para coordenadas, WhatsApp para envio).
-   **`js/menu.js` - `showProducts` e Lógica de Modais de Sabores:**
    -   A função `showProducts` lida com filtragem de produtos por tipo e regras especiais (e.g., produto com `id=209` adicionado no início), além de gerenciar classes CSS para ativação de botões. A interação com modais de seleção de sabores para produtos especiais (pacotes) e a atualização da quantidade e preços também adicionam complexidade.
-   **`rastreamento-delivery/costasalgados/server.js` - `wss.on("message")`:**
    -   Apesar de concisa, a lógica de recebimento e processamento de mensagens WebSocket (identificando tipos de mensagem, atualizando dados de entregadores, e retransmitindo para outros clientes) pode se tornar complexa à medida que mais tipos de mensagens ou requisitos de processamento de estado forem adicionados.
-   **`js/login.js` e `js/menu.js` - Lógica de Autenticação/Cadastro:**
    -   As funções de login e cadastro, envolvendo a validação de entrada, hashing de senha (`bcrypt`), interação com Firebase Firestore e `localStorage`, e o auto-preenchimento de CEP, já possuem uma complexidade moderada. A duplicação dessa lógica entre os dois arquivos aumenta a complexidade de manutenção.


