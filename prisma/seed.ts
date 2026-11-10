import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Grupos: SALES, OTHER_INCOME, FIXED, VARIABLE, PURCHASE, TAX, OWNER
const CATEGORIES = [
  ["Vendas", "INCOME", "SALES"],
  ["Outras receitas", "INCOME", "OTHER_INCOME"],
  ["Rendimentos", "INCOME", "OTHER_INCOME"],
  ["Compra de mercadoria", "EXPENSE", "PURCHASE"],
  ["Imposto (DAS)", "EXPENSE", "TAX"],
  ["Retirada dos sócios", "EXPENSE", "OWNER"],
  ["Aluguel", "EXPENSE", "FIXED"],
  ["Contador", "EXPENSE", "FIXED"],
  ["Sistemas e internet", "EXPENSE", "FIXED"],
  ["Salários", "EXPENSE", "FIXED"],
  ["Mercado Ads / Amazon Ads", "EXPENSE", "VARIABLE"],
  ["Embalagens e insumos", "EXPENSE", "VARIABLE"],
  ["Tarifas bancárias", "EXPENSE", "VARIABLE"],
  ["Outras despesas", "EXPENSE", "FIXED"],
] as const;

// Plano de escala (editável no app)
const STEPS: [string, string, string][] = [
  ["Mercado Livre", "Conta saudável: reputação verde", "Poucas reclamações, cancelamentos e atrasos no envio. Responder perguntas em minutos."],
  ["Mercado Livre", "Anúncios que convertem", "Título com as palavras buscadas, fotos com fundo branco, ficha técnica completa, peso e medidas corretos."],
  ["Mercado Livre", "Preço e margem por produto", "Comparar Clássico × Premium. Montar kits acima de R$ 79 para diluir a tarifa por unidade."],
  ["Mercado Livre", "Entrar no Full", "Entrega mais rápida, selo Full e mais exposição nas buscas."],
  ["Mercado Livre", "Primeiras avaliações", "Pedir avaliação no pós-venda e acompanhar as notas dos produtos."],
  ["Mercado Livre", "Mercado Ads com ACOS controlado", "Anunciar só produtos com margem e acompanhar o ACOS (gasto ÷ venda dos anúncios)."],
  ["Mercado Livre", "Marca e loja oficial", "Cadastrar a marca e abrir a loja oficial."],
  ["Mercado Livre", "Chegar a MercadoLíder", "Volume e reputação para subir de nível."],
  ["Mercado Livre", "Ampliar o mix pela curva ABC", "Novos produtos a partir dos campeões de lucro; nunca deixar o Full zerar."],
  ["Amazon", "Conta saudável", "Taxa de defeito de pedido abaixo de 1%, cancelamento abaixo de 2,5%, envio atrasado abaixo de 4%."],
  ["Amazon", "Anúncios completos", "Título, bullets, descrição, fotos de qualidade, categoria e atributos corretos."],
  ["Amazon", "Ganhar a Buy Box", "Preço competitivo sem sair da margem mínima, estoque sempre disponível."],
  ["Amazon", "Usar o FBA (selo Prime)", "Enviar estoque para o centro de distribuição da Amazon."],
  ["Amazon", "Primeiras avaliações", "Usar os programas oficiais de avaliação da Amazon."],
  ["Amazon", "Sponsored Products", "Controlar ACOS e TACOS (gasto ÷ venda total)."],
  ["Amazon", "Registro de marca", "Registrar a marca no INPI e no Brand Registry; criar conteúdo A+."],
  ["Amazon", "Planejar reposição", "Planejar envios ao centro de distribuição pelo giro de vendas."],
];

// Fases do plano "Mercado Livre: R$ 500 mil" com o portão de cada uma
const PHASES = [
  {
    name: "Fase 0 · Preparação",
    startMonth: "2026-11",
    endMonth: "2026-11",
    goalType: "NONE" as const,
    goalValue: 0,
    manualGate: null,
    steps: [
      "Ler o contrato CLT e o código de conduta da empresa",
      "Definir o capital inicial e separar uma reserva pessoal à parte",
      "Criar conta no Mercado Livre e no Mercado Pago, completar cadastro e verificação",
      "Pesquisar 10 produtos candidatos e escolher 2 para testar (Funil de produtos)",
      "Conferir a precificação na Calculadora",
    ],
  },
  {
    name: "Fase 1 · Validação",
    startMonth: "2026-12",
    endMonth: "2027-01",
    goalType: "TOTAL_ORDERS" as const,
    goalValue: 50,
    manualGate: "Reputação verde no Mercado Livre",
    steps: [
      "Abrir a ME no Simples Nacional com um contador",
      "Comprar estoque pequeno: 20 a 50 unidades por produto",
      "Publicar anúncios com fotos boas, título com palavras-chave e ficha técnica completa",
      "Enviar no mesmo dia ou no seguinte; responder perguntas em até 1 hora",
      "Ativar Mercado Ads com R$ 10 a R$ 20/dia por anúncio",
    ],
  },
  {
    name: "Fase 2 · Tração",
    startMonth: "2027-02",
    endMonth: "2027-04",
    goalType: "MONTHLY_REVENUE" as const,
    goalValue: 30000,
    manualGate: null,
    steps: [
      "Manter só os produtos com margem real acima de 15%; trocar os outros",
      "Ampliar para 5 a 10 anúncios, com variações (cor, tamanho, kits)",
      "Negociar direto com distribuidor ou fábrica para baixar o custo",
      "Entrar no Full com os 2 ou 3 campeões de venda",
    ],
  },
  {
    name: "Fase 3 · Escala",
    startMonth: "2027-05",
    endMonth: "2027-09",
    goalType: "MONTHLY_REVENUE" as const,
    goalValue: 50000,
    manualGate: null,
    steps: [
      "Chegar a 20 a 40 anúncios ativos, todos com margem conhecida",
      "Contratar ajuda para embalagem e atendimento",
      "Buscar o selo MercadoLíder e manter a reputação verde",
      "Comprar o estoque de Black Friday e Natal até setembro",
    ],
  },
  {
    name: "Fase 4 · Pico",
    startMonth: "2027-10",
    endMonth: "2027-12",
    goalType: "MONTHLY_REVENUE" as const,
    goalValue: 70000,
    manualGate: null,
    steps: [
      "Participar das campanhas oficiais (Black Friday, Cyber Monday, Natal)",
      "Dobrar o orçamento de Ads nas semanas de pico e cortar logo depois",
      "Garantir estoque no Full antes do prazo de envio das campanhas",
    ],
  },
];

// Cronograma de faturamento: soma R$ 500 mil de dez/2026 a dez/2027 (lucro alvo de 15%)
const SCHEDULE: [string, number][] = [
  ["2026-12", 5000], ["2027-01", 10000], ["2027-02", 18000], ["2027-03", 24000], ["2027-04", 30000],
  ["2027-05", 36000], ["2027-06", 40000], ["2027-07", 44000], ["2027-08", 48000], ["2027-09", 50000],
  ["2027-10", 55000], ["2027-11", 70000], ["2027-12", 70000],
];

async function main() {
  // Usuários: criados apenas se não existirem (nunca sobrescreve senha existente)
  for (const i of [1, 2, 3]) {
    const email = process.env[`USER${i}_EMAIL`]?.toLowerCase();
    const password = process.env[`USER${i}_PASSWORD`];
    const name = process.env[`USER${i}_NAME`] ?? `Usuário ${i}`;
    if (!email || !password) continue;
    if (await db.user.findUnique({ where: { email } })) continue;
    await db.user.create({ data: { name, email, role: i === 1 ? "ADMIN" : "MEMBER", passwordHash: await bcrypt.hash(password, 12) } });
    console.log(`Usuário criado: ${email}`);
  }

  await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  if ((await db.account.count()) === 0) {
    await db.account.createMany({
      data: [
        { name: "Banco", type: "BANK" },
        { name: "Mercado Pago", type: "MARKETPLACE" },
        { name: "Amazon", type: "MARKETPLACE" },
        { name: "Caixa", type: "CASH" },
      ],
    });
  }

  if ((await db.channel.count()) === 0) {
    const mp = await db.account.findUnique({ where: { name: "Mercado Pago" } });
    const amz = await db.account.findUnique({ where: { name: "Amazon" } });
    const bank = await db.account.findUnique({ where: { name: "Banco" } });
    // Valores de referência: confira a comissão da sua categoria nas centrais de vendedor.
    await db.channel.createMany({
      data: [
        { name: "Mercado Livre", commissionClassic: 12, commissionPremium: 17, fixedFee: 6.5, fixedFeeThreshold: 79, releaseDays: 7, accountId: mp?.id },
        { name: "Amazon", commissionClassic: 12, commissionPremium: 12, fixedFee: 4.5, fixedFeeThreshold: 79, releaseDays: 14, accountId: amz?.id },
        { name: "Loja própria", commissionClassic: 4.99, commissionPremium: 4.99, fixedFee: 0, fixedFeeThreshold: 0, releaseDays: 30, accountId: bank?.id },
      ],
    });
  }

  for (const [name, type, group] of CATEGORIES) {
    await db.category.upsert({ where: { name_type: { name, type } }, update: {}, create: { name, type, group } });
  }

  if ((await db.growthStep.count()) === 0) {
    await db.growthStep.createMany({
      data: STEPS.map(([channel, title, description], i) => ({ channel, title, description, position: i })),
    });
  }
  if ((await db.planPhase.count()) === 0) {
    for (const [i, ph] of PHASES.entries()) {
      const { steps, ...data } = ph;
      const created = await db.planPhase.create({ data: { ...data, position: i } });
      await db.growthStep.createMany({
        data: steps.map((title, j) => ({ channel: ph.name, title, position: j, phaseId: created.id })),
      });
    }
  }

  for (const [month, revenue] of SCHEDULE) {
    const exists = await db.monthlyGoal.findUnique({ where: { month } });
    if (!exists) await db.monthlyGoal.create({ data: { month, revenue, profit: Math.round(revenue * 0.15) } });
  }

  console.log("Seed concluído");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
