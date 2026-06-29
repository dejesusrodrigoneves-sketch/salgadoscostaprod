-- CreateTable
CREATE TABLE "empresas" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "loja_nome" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "type" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "img" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "congelado" BOOLEAN NOT NULL DEFAULT false,
    "controla_estoque" BOOLEAN NOT NULL DEFAULT false,
    "estoque_atual" INTEGER NOT NULL DEFAULT 0,
    "estoque_minimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "cliente_nome" TEXT NOT NULL,
    "cliente_whatsapp" TEXT,
    "cliente_endereco" TEXT,
    "cliente_numero" TEXT,
    "cliente_bairro" TEXT,
    "cliente_cep" TEXT,
    "cliente_referencia" TEXT,
    "tipo_entrega" TEXT NOT NULL DEFAULT 'delivery',
    "forma_pagamento" TEXT,
    "troco" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "valores_itens" DECIMAL(10,2),
    "taxas_entrega" DECIMAL(10,2),
    "taxas_cartao" DECIMAL(10,2),
    "desconto" DECIMAL(10,2),
    "total" DECIMAL(10,2),
    "entregador_id" TEXT,
    "lat" DECIMAL(10,7),
    "lon" DECIMAL(10,7),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizado_em" TIMESTAMP(3),

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_pedido" (
    "id" SERIAL NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "preco_unitario" DECIMAL(10,2),
    "sabores" TEXT,

    CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregadores" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "whatsapp" TEXT,
    "chave_pix" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entregadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregas_diarias" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "entregador_id" INTEGER NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "valor" DECIMAL(10,2),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entregas_diarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caixa_diario" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor_inicial" DECIMAL(10,2),
    "total_dinheiro" DECIMAL(10,2) DEFAULT 0,
    "total_pix" DECIMAL(10,2) DEFAULT 0,
    "total_debito" DECIMAL(10,2) DEFAULT 0,
    "total_credito" DECIMAL(10,2) DEFAULT 0,
    "total_pedidos" DECIMAL(10,2) DEFAULT 0,
    "quantidade_pedidos" INTEGER DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "aberto_em" TIMESTAMP(3),
    "fechado_em" TIMESTAMP(3),

    CONSTRAINT "caixa_diario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "dia" TEXT NOT NULL,
    "fechado" BOOLEAN NOT NULL DEFAULT false,
    "inicio" TEXT,
    "fim" TEXT,

    CONSTRAINT "horarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "nome" TEXT NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("nome","empresa_id")
);

-- CreateTable
CREATE TABLE "cupons" (
    "codigo" TEXT NOT NULL,
    "desconto" DECIMAL(10,2) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cupons_pkey" PRIMARY KEY ("codigo")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_slug_key" ON "empresas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_empresa_id_username_key" ON "usuarios"("empresa_id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_empresa_id_key" ON "horarios"("empresa_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregadores" ADD CONSTRAINT "entregadores_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_diarias" ADD CONSTRAINT "entregas_diarias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caixa_diario" ADD CONSTRAINT "caixa_diario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counters" ADD CONSTRAINT "counters_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
