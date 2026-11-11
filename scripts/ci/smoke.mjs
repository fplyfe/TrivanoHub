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

let r = await call("/api/suppliers", "POST", { name: "Fornecedor Teste", contact: "Ana 2", phone: "123", email: "ana@gmail.con", leadDays: "-3" });
expect(r, 400, "inválido");
for (const t of ["Contato", "Telefone", "gmail.com", "Prazo"]) if (!String(r.json.error).includes(t)) fail("mensagem sem " + t);
r = await call("/api/suppliers", "POST", { name: " Fornecedor  Teste ", contact: "Ana Souza", phone: "11987654321", email: "Vendas@Teste.com.br", leadDays: "10", notes: "" });
expect(r, 200, "válido");
if (r.json.phone !== "(11) 98765-4321" || r.json.email !== "vendas@teste.com.br" || r.json.name !== "Fornecedor Teste") fail("normalização");
const id = r.json.id;
expect(await call("/api/suppliers", "POST", { name: "fornecedor teste" }), 409, "nome duplicado");
expect(await call("/api/suppliers", "POST", { name: "Outro", email: "vendas@teste.com.br" }), 409, "e-mail duplicado");
expect(await call(`/api/suppliers/${id}`, "PUT", { name: "Fornecedor Teste", phone: "+86 138 1234 5678", email: "vendas@teste.com.br", active: true }), 200, "editar mesmo registro");
console.log("Fornecedores OK");
