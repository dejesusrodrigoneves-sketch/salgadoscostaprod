#!/usr/bin/env node
// backend/scripts/cleanupSimData.js — remove dados de simulação E1-E12
// Uso: node scripts/cleanupSimData.js           → dry-run (só lista)
//      node scripts/cleanupSimData.js --apply   → apaga

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

// Inventário da simulação (spec v2)
const SIM_PEDIDO_IDS = ['1-063', '1-064', '1-065', '1-066', '1-067'];
const SIM_PUBLIC_IDS = ['SIM-3-muevrpe1', 'SIM-4-muevrqoz', 'SIM-888001-muevrs4b'];
const SIM_EMPRESA_IDS = [3, 4, 888001];
const SIM_SETTLEMENT_IDS = [1, 2, 3];

async function main() {
  const pedidos = await prisma.pedido.findMany({
    where: {
      OR: [
        { id: { in: SIM_PEDIDO_IDS } },
        { publicId: { in: SIM_PUBLIC_IDS } },
        { empresaId: { in: SIM_EMPRESA_IDS } },
        { clienteNome: { startsWith: 'E2E' } },
      ],
    },
    select: { id: true, empresaId: true, publicId: true },
  });
  const pedidoIds = pedidos.map((p) => p.id);
  const settlements = await prisma.weeklySettlement.findMany({
    where: { id: { in: SIM_SETTLEMENT_IDS } },
    select: { id: true, empresaId: true, status: true },
  });
  const empresas = await prisma.empresa.findMany({
    where: { id: { in: SIM_EMPRESA_IDS } },
    select: { id: true, nome: true, asaasOnboarded: true },
  });

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Pedidos sim: ${pedidoIds.length}`, pedidoIds);
  console.log(`Settlements sim: ${settlements.length}`, settlements.map((s) => s.id));
  console.log(`Empresas sim: ${empresas.length}`, empresas.map((e) => `${e.id}:${e.nome}(onboarded=${e.asaasOnboarded})`));

  if (!APPLY) {
    console.log('Nada alterado. Rode com --apply para apagar.');
    return;
  }

  if (pedidoIds.length) {
    await prisma.itensPedido.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
    await prisma.pagamento.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
    await prisma.pedido.deleteMany({ where: { id: { in: pedidoIds } } });
    console.log(`Removidos ${pedidoIds.length} pedidos (+itens,+pagamentos).`);
  }
  if (settlements.length) {
    await prisma.weeklySettlement.deleteMany({ where: { id: { in: SIM_SETTLEMENT_IDS } } });
    console.log(`Removidos ${settlements.length} settlements.`);
  }
  if (empresas.length) {
    await prisma.empresa.updateMany({
      where: { id: { in: SIM_EMPRESA_IDS } },
      data: { asaasOnboarded: false, asaasSubcontaId: null, deletedAt: new Date() },
    });
    console.log(`Empresas sim marcadas como removidas/onboarding resetado.`);
  }
  console.log('Cleanup concluído.');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
