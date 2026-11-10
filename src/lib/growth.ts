// Regras do plano de crescimento (Ads, teste de produto, filtro do produto ideal). Funções puras.

export type Tone = "good" | "warning" | "danger" | "muted";
export type Advice = { tone: Tone; title: string; detail: string };

/** Limite de perda: gasto em Ads sem nenhuma venda antes de pausar e revisar. */
export const ADS_LOSS_LIMIT = 150;

export type AdWeek = { spend: number; adSales: number; adOrders: number; impressions?: number | null; clicks?: number | null };

export const acosOf = (w: { spend: number; adSales: number }) => (w.adSales > 0 ? (w.spend / w.adSales) * 100 : null);

/**
 * O que fazer com o Ads de um produto, pela tabela do plano.
 * weeks: semanas em ordem cronológica (a última é a mais recente).
 * breakEven: ACOS de empate em % (margem antes do Ads).
 */
export function adsAdvice(weeks: AdWeek[], breakEven: number | null): Advice {
  if (weeks.length === 0) return { tone: "muted", title: "Sem dados", detail: "Lance o gasto da semana copiado do painel do Mercado Ads." };
  const last = weeks.at(-1)!;
  const totalSpend = weeks.reduce((a, w) => a + w.spend, 0);
  const totalOrders = weeks.reduce((a, w) => a + w.adOrders, 0);

  if (totalOrders === 0 && totalSpend >= ADS_LOSS_LIMIT) {
    return {
      tone: "danger",
      title: "Pausar e revisar o anúncio",
      detail: `R$ ${totalSpend.toFixed(0)} gastos sem nenhuma venda: o problema é o anúncio, não a verba. Revise foto, título, preço e frete.`,
    };
  }

  // Diagnóstico pelo funil do painel (quando há impressões e cliques)
  if (last.adOrders === 0 && last.impressions != null && last.clicks != null) {
    const ctr = last.impressions > 0 ? (last.clicks / last.impressions) * 100 : 0;
    if (last.impressions < 500)
      return { tone: "warning", title: "Poucas impressões", detail: "Revise título e categoria (o cliente busca outras palavras) e suba um pouco o orçamento." };
    if (ctr < 0.5)
      return { tone: "warning", title: "Poucos cliques", detail: `CTR de ${ctr.toFixed(2)}%: troque a foto principal e compare o preço final com os concorrentes.` };
    if (last.clicks >= 50)
      return { tone: "warning", title: "Cliques sem venda", detail: "O anúncio não convence: melhore fotos, descrição, frete, prazo e parcelamento." };
  }

  const acos = acosOf(last);
  if (acos == null) {
    return { tone: "muted", title: "Aguardar", detail: `Sem venda por Ads nesta semana. Limite de perda: pausar ao chegar a R$ ${ADS_LOSS_LIMIT} sem vendas.` };
  }
  if (breakEven != null && acos > breakEven) {
    return { tone: "danger", title: "Pausar e revisar", detail: `ACOS de ${acos.toFixed(1)}% passou do empate (${breakEven.toFixed(1)}%): cada venda por Ads dá prejuízo.` };
  }
  const prev = weeks.at(-2);
  const prevAcos = prev ? acosOf(prev) : null;
  if (acos > 20 && prevAcos != null && prevAcos > 20) {
    return { tone: "warning", title: "Baixar lance ou orçamento", detail: `ACOS acima de 20% por 2 semanas (${prevAcos.toFixed(1)}% e ${acos.toFixed(1)}%).` };
  }
  if (acos > 20) return { tone: "warning", title: "Atenção", detail: `ACOS de ${acos.toFixed(1)}%. Se continuar acima de 20% na próxima semana, baixe o lance.` };
  if (acos >= 10) return { tone: "muted", title: "Manter e melhorar", detail: `ACOS de ${acos.toFixed(1)}%: mantenha o orçamento e melhore foto, título e preço.` };
  return { tone: "good", title: "Aumentar orçamento 20% a 30%", detail: `ACOS de ${acos.toFixed(1)}% e vendendo: vale escalar.` };
}

/** Filtro do produto ideal (seção "Escolha de produto" do plano). */
export function idealProductChecks(p: { price: number; cost: number; weightG: number | null; needsCert: boolean; margin: number | null }) {
  return [
    { label: "Preço entre R$ 80 e R$ 200", ok: p.price >= 80 && p.price <= 200, known: p.price > 0 },
    { label: "Até 1 kg", ok: p.weightG != null && p.weightG <= 1000, known: p.weightG != null },
    { label: "Custo até 40% do preço", ok: p.price > 0 && p.cost / p.price <= 0.4, known: p.price > 0 && p.cost > 0 },
    { label: "Sem certificação nem marca de terceiros", ok: !p.needsCert, known: true },
    { label: "Margem líquida de 15% ou mais", ok: p.margin != null && p.margin >= 15, known: p.margin != null },
  ];
}

export type TestStats = {
  days: number; // dias desde o início do teste
  orders30: number; // vendas nos últimos 30 dias
  ordersTest: number; // vendas desde o início do teste
  margin: number | null; // margem real das vendas do teste (%)
  adSpend: number; // gasto em Ads no teste
  adOrders: number;
};

/** Avaliação do produto em teste, pelos critérios do plano. */
export function testAdvice(s: TestStats): Advice & { suggest?: "APPROVED" | "PAUSED" } {
  const perDay = s.days > 0 ? s.ordersTest / s.days : 0;
  if (s.adOrders === 0 && s.adSpend >= ADS_LOSS_LIMIT) {
    return { tone: "danger", title: "Pausar o Ads e revisar", detail: `R$ ${s.adSpend.toFixed(0)} em Ads sem nenhuma venda.` };
  }
  if (s.days < 7 || s.ordersTest < 3) {
    return {
      tone: "muted",
      title: "Em teste",
      detail: `Dia ${s.days} do teste, ${s.ordersTest} venda(s). Espere 7 a 14 dias e 100 a 200 visitas antes de concluir.`,
    };
  }
  if (perDay >= 1 && s.margin != null && s.margin >= 15) {
    return {
      tone: "good",
      title: "Aprovar",
      detail: `${perDay.toFixed(1)} venda(s)/dia com margem de ${s.margin.toFixed(1)}%. Reponha 2 a 3 vezes a quantidade inicial.`,
      suggest: "APPROVED",
    };
  }
  if (s.days >= 30 && s.orders30 < 10) {
    return {
      tone: "danger",
      title: "Produto parado",
      detail: `${s.orders30} vendas em 30 dias. Tente kit, promoção ou liquidação, ou troque o produto.`,
      suggest: "PAUSED",
    };
  }
  if (s.margin != null && s.margin < 15) {
    return { tone: "warning", title: "Margem baixa", detail: `Margem de ${s.margin.toFixed(1)}%: suba o preço, negocie o custo ou troque o produto.` };
  }
  return { tone: "warning", title: "Vendendo pouco", detail: `${perDay.toFixed(2)} venda(s)/dia. Mude uma coisa por vez: foto, depois título, depois preço.` };
}

/** Segunda-feira (AAAA-MM-DD) da semana de uma data AAAA-MM-DD. */
export function mondayOf(date: string) {
  const d = new Date(date + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
