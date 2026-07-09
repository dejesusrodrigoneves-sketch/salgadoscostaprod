# Designer Guide

> Guia de Design do Sistema
>
> Objetivo: evoluir apenas a camada visual do sistema, preservando totalmente a arquitetura, componentes, APIs, regras de negócio e fluxo operacional.

---

# Princípios

O sistema já está operacional.

Portanto:

- NÃO alterar regras de negócio
- NÃO alterar APIs
- NÃO alterar Stores
- NÃO alterar Services
- NÃO alterar Hooks
- NÃO alterar Controllers
- NÃO alterar Fluxos
- NÃO alterar Navegação

Toda melhoria deverá ser exclusivamente visual.

---

# Conceito Visual

O layout deve transmitir:

- simplicidade
- rapidez
- organização
- leitura fácil
- foco no produto

O usuário deve conseguir localizar qualquer informação em menos de 3 segundos.

---

# Estilo

Inspirado em aplicativos modernos de delivery.

Características:

- muito espaço em branco
- poucos elementos decorativos
- imagens grandes
- cards limpos
- hierarquia clara
- tipografia leve
- cores usadas apenas para destacar ações

---

# Hierarquia das Informações

Sempre seguir esta ordem.

## 1 Header

Imagem de capa

↓

Logo

↓

Nome da loja

↓

Status

↓

Informações rápidas

Nunca inverter essa ordem.

---

## 2 Informações rápidas

Utilizar pequenos ícones.

Exemplo:

🚴 Entrega

⏱ Tempo

📞 Contato

Nunca usar textos longos.

(que as informacoes que serao exibidas no item 2 possam ser modificadas no dashboard)

---

## 3 Categorias

Devem ficar logo abaixo do cabeçalho.

Formato:

Horizontal

Scroll horizontal

Botões simples

Sem sombras.

Categoria ativa:

- texto escuro
- indicador inferior
- fundo branco

Categorias inativas:

- cinza

---

## 4 Busca

Sempre abaixo das categorias.

Campo simples.

Borda inferior ou outline leve.

Ícone de lupa.

Placeholder discreto.

---

## 5 Lista de Produtos

Cada produto deve possuir:

Imagem

↓

Nome

↓

Descrição curta

↓

Preço

↓

botao para  adicionar item ao cart.html

---

# Cards

Cards devem ser extremamente limpos.

Estrutura:

--------------------------------

Imagem

Nome

Descrição

Preço

+ (para adicionar ao carrinho)

- (quando existir 1 item no carrinho, usar como decremento, e no 0 remove do carrinho)

--------------------------------

Sem excesso de bordas.

Sombras suaves.

Border radius pequeno.

Padding confortável.

---

# Imagens

Prioridade máxima.

Sempre:

- boa proporção
- cantos levemente arredondados
- preencher o espaço
- sem distorção

Aspect Ratio recomendado

4:3

ou

1:1

---

# Tipografia

Utilizar apenas três níveis.

## Título

18~22

Peso

600

---

## Subtítulo

14~16

Peso

500

---

## Texto

12~14

Peso

400

---

Nunca utilizar muitos tamanhos diferentes.

---

# Paleta

Cor principal:

Verde

Exemplo:

#1FA58D

ou equivalente do projeto.

Ações:

Verde

Informações:

Cinza

Texto:

#222

Texto secundário:

#666

Background:

#FFFFFF

Separadores:

#ECECEC

---

# Espaçamentos

Base:

4

Escala:

4
8
12
16
20
24
32

Nunca utilizar valores aleatórios.

---

# Bordas

Radius:

Cards:

8

Inputs:

8

Botões:

8

Imagem:

6

---

# Sombras

Muito leves.

Evitar:

shadow pesada

blur exagerado

efeitos 3D

---

# Ícones

Outline.

Mesmo tamanho.

18~22px

Nunca misturar estilos.

---

# Botões

Botão principal:

cor sólida

texto branco

altura:

48

Radius:

8

---

Botões secundários:

branco

borda cinza

texto escuro

---

# Barra Inferior

Sempre fixa.

Branca.

Com sombra superior muito leve.

Ícones centralizados.

Texto pequeno.

Item ativo:

verde

Itens inativos:

cinza

---

# Barra de Pedido

Quando existir pedido ativo:

fixa no rodapé.

Altura aproximada:

56

Cor principal.

Texto branco.

Preço destacado.

Nunca esconder.

---

# Lista de Produtos

Espaçamento vertical confortável.

Entre cards:

8~12

Padding interno:

12~16

Imagem à direita ou esquerda conforme componente atual.

Nunca alterar a lógica do componente.

---

# Estados

Todos componentes devem possuir:

Loading

Empty

Erro

Sucesso

Sem alterar lógica.

Apenas visual.

---

# Responsividade

O layout deve funcionar em:

320px

360px

390px

412px

Tablet

Sem criar componentes específicos.

Priorizar Flex.

---

# statusBar

devera ser mantida

# Animações

Curtas.

150~250ms

Fade

Scale leve

Slide discreto

Nunca utilizar animações chamativas.

---

# Componentização

Sempre reutilizar componentes existentes.

Caso necessário:

criar apenas componentes visuais.

Jamais duplicar regras de negócio.

---

# Não Fazer

Não alterar APIs.

Não alterar Models.

Não alterar Stores.

Não alterar Controllers.

Não alterar Banco.

Não alterar Fluxos.

Não alterar Navegação.

Não alterar Providers.

Não alterar autenticação.

Não alterar chamadas HTTP.

Não alterar lógica de carrinho.

Não alterar regras de pagamento.

Não alterar regras de pedidos.

Toda alteração deve ser exclusivamente estética.

---

# Objetivo Final

O sistema deve transmitir:

✔ moderno

✔ leve

✔ rápido

✔ organizado

✔ fácil de navegar

✔ foco total no produto

Sem impactar nenhuma funcionalidade já existente.

Toda melhoria deve ser visual, incremental e compatível com a arquitetura atual.