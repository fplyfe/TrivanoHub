// Teste de fumaça rodado dentro do container do app na Action (node - < scripts/ci/smoke.mjs).
const B = "http://127.0.0.1:3000";
const fail = (m) => { console.error("FALHOU:", m); process.exit(1); };
const login = await fetch(B + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@teste.local", password: "SenhaAdmin123" }) });
if (!login.ok) fail("login " + login.status);
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
const call = async (path, method, body) => {
  const r = await fetch(B + path, { method, headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const expect = (r, status, label) => { console.log(label, r.status, JSON.stringify(r.json).slice(0, 160)); if (r.status !== status) fail(`${label}: esperado ${status}`); };

let r = await call("/api/suppliers", "POST", { name: "Fornecedor Teste", phone: "123", email: "ana@gmail.con", link: "javascript:alert(1)" });
expect(r, 400, "inválido");
for (const t of ["Telefone", "gmail.com", "http"]) if (!String(r.json.error).includes(t)) fail("mensagem sem " + t);
r = await call("/api/suppliers", "POST", { name: " Fornecedor  Teste ", phone: "11987654321", email: "Vendas@Teste.com.br", link: "loja.teste.com.br/catalogo", notes: "" });
expect(r, 200, "válido");
if (r.json.phone !== "(11) 98765-4321" || r.json.email !== "vendas@teste.com.br" || r.json.name !== "Fornecedor Teste" || r.json.link !== "https://loja.teste.com.br/catalogo") fail("normalização");
const id = r.json.id;
expect(await call("/api/suppliers", "POST", { name: "fornecedor teste", phone: "11987654321" }), 409, "nome duplicado");
expect(await call("/api/suppliers", "POST", { name: "Outro", phone: "11987654321", email: "vendas@teste.com.br" }), 409, "e-mail duplicado");
expect(await call("/api/suppliers", "POST", { name: "Sem Telefone" }), 400, "telefone obrigatório");
expect(await call(`/api/suppliers/${id}`, "PUT", { name: "Fornecedor Teste", phone: "+86 138 1234 5678", email: "vendas@teste.com.br", link: "", active: true }), 200, "editar mesmo registro");
console.log("Fornecedores OK");


// ---- Tarifas do Mercado Livre (2026): faixas só no Flex, custo de envio no Full/Coleta ----
const { createRequire } = await import("node:module");
const { PrismaClient } = createRequire(process.cwd() + "/")("@prisma/client");
const db = new PrismaClient();
const ml = await db.channel.findFirst({ where: { name: "Mercado Livre" } });
console.log("canal ML", JSON.stringify(ml.feeTiers), ml.feeOwnShippingOnly, String(ml.fixedFee));
if (!Array.isArray(ml.feeTiers) || ml.feeTiers.length !== 3 || !ml.feeOwnShippingOnly) fail("canal ML sem as faixas de 2026");

const prod = await call("/api/products", "POST", {
  sku: "TESTE-1", name: "Produto Teste", cost: 10, packaging: 1, shipping: 6.85, shippingOwn: 3, shipMode: "MERCADO_ENVIOS",
  commissionClassic: 11, commissionPremium: "", price: 40, minStock: 0, supplierId: "", weightG: "", researchNotes: "",
});
expect(prod, 200, "produto com envio e comissão própria");
const sale = (shipMode) => call("/api/sales", "POST", { date: "2026-11-10", channelId: ml.id, productId: prod.json.id, listingType: "CLASSICO", shipMode, qty: 1, price: 40, shipping: "", externalId: "", note: "" });
let s1 = await sale("MERCADO_ENVIOS");
expect(s1, 200, "venda Full/Coleta");
if (Number(s1.json.fixedFee) !== 0 || Number(s1.json.shipping) !== 6.85 || Number(s1.json.commission) !== 4.4 || s1.json.shipMode !== "MERCADO_ENVIOS") fail("venda Full/Coleta com valores errados");
let s2 = await sale("PROPRIO");
expect(s2, 200, "venda Flex");
if (Number(s2.json.fixedFee) !== 6.65 || Number(s2.json.shipping) !== 3 || s2.json.shipMode !== "PROPRIO") fail("venda Flex com valores errados");
let s3 = await call("/api/sales", "POST", { date: "2026-11-10", channelId: ml.id, productId: prod.json.id, listingType: "PREMIUM", qty: 1, price: 60, shipping: "" });
expect(s3, 200, "venda sem envio informado (usa o do produto)");
if (s3.json.shipMode !== "MERCADO_ENVIOS" || Number(s3.json.commission) !== 10.2) fail("venda padrão: envio do produto e comissão Premium do canal (17%)");
// ---- Funil de fornecedores ----
const f1 = await call("/api/suppliers", "POST", { name: "Fábrica Funil", phone: "+86 138 0000 1111", link: "1688.com/loja", stage: "PROSPECT", nextStep: "Pedir catálogo", followUpAt: "2026-11-20", notes: "" });
expect(f1, 200, "fornecedor no funil");
if (f1.json.stage !== "PROSPECT" || !String(f1.json.followUpAt).startsWith("2026-11-20") || f1.json.nextStep !== "Pedir catálogo") fail("criação no funil");
const okSup = await db.supplier.findFirst({ where: { name: "Fornecedor Teste" } });
if (okSup.stage !== "APPROVED") fail("fornecedor criado fora do funil deveria entrar aprovado");
const f2 = await call(`/api/suppliers/${f1.json.id}/funnel`, "PATCH", { stage: "CATALOG" });
expect(f2, 200, "mover para catálogo");
if (f2.json.stage !== "CATALOG" || f2.json.stageAt === f1.json.stageAt) fail("etapa/data da etapa");
const f3 = await call(`/api/suppliers/${f1.json.id}/funnel`, "PATCH", { stage: "DISCARDED" });
if (f3.json.active !== false) fail("descartado deveria ficar inativo");
const f4 = await call(`/api/suppliers/${f1.json.id}`, "PUT", { name: "Fábrica Funil", phone: "+8613800001111", email: "", link: "", notes: "caro", nextStep: "", followUpAt: "" });
expect(f4, 200, "editar no funil");
if (f4.json.active !== false || f4.json.stage !== "DISCARDED" || f4.json.nextStep !== null || f4.json.followUpAt !== null) fail("editar no funil não pode reativar nem mudar a etapa");
expect(await call(`/api/suppliers/${f1.json.id}/funnel`, "PATCH", { stage: "NADA" }), 400, "etapa inválida");
const f5 = await call(`/api/suppliers/${f1.json.id}/funnel`, "PATCH", { stage: "NEGOTIATING" });
if (f5.json.active !== true) fail("voltar do descarte deveria reativar");

for (const path of ["/calculator", "/sales", "/products", "/quotes", "/funnel", "/settings", "/suppliers", "/supplier-funnel"]) {
  const r = await fetch(B + path, { headers: { cookie } });
  console.log("página", path, r.status);
  if (r.status !== 200) fail("página " + path);
}
await db.$disconnect();
console.log("Tarifas OK");
