// Prints das telas para conferência visual na Action (node scripts/ci/screens.mjs http://IP:3000 pasta)
import puppeteer from "puppeteer-core";
const [B, out] = process.argv.slice(2);
const login = await fetch(B + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@teste.local", password: "SenhaAdmin123" }) });
const token = (login.headers.get("set-cookie") || "").match(/gs_session=([^;]+)/)?.[1];
if (!token) throw new Error("sem sessão");
const call = (path, method, body) => fetch(B + path, { method, headers: { "content-type": "application/json", cookie: `gs_session=${token}` }, body: JSON.stringify(body) }).then((r) => r.json());
const demo = [
  ["Shenzhen Brinquedos Co.", "+86 138 1234 5678", "PROSPECT", "Mandar mensagem no WhatsApp", "2026-11-05"],
  ["Distribuidora Paulista", "(11) 98888-7777", "CONTACTED", "Cobrar resposta", new Date().toISOString().slice(0, 10)],
  ["Atacado Brás", "(11) 97777-6666", "CATALOG", "Separar 5 produtos do catálogo", "2026-12-01"],
  ["Yiwu Home Goods", "+86 139 0000 2222", "PRICING", "Rodar na calculadora", ""],
  ["Importadora Sul", "(51) 99999-1234", "NEGOTIATING", "Pedir amostra com frete pago", "2026-11-25"],
];
for (const [name, phone, stage, nextStep, followUpAt] of demo)
  await call("/api/suppliers", "POST", { name, phone, stage, nextStep, followUpAt, email: "", link: name.includes("Co.") ? "1688.com/loja" : "", notes: "Pedido mínimo 50 un., pagamento 30 dias." });

for (let i = 1; i <= 9; i++) await call("/api/suppliers", "POST", { name: `Fornecedor Aprovado ${i}`, phone: `(11) 9${String(8000 + i)}-${String(1000 + i)}`, email: "", link: i % 2 ? "loja.exemplo.com.br" : "", notes: "" });

const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setCookie({ name: "gs_session", value: token, url: B });
const shot = async (path, file, w, h) => {
  await page.setViewport({ width: w, height: h });
  await page.goto(B + path, { waitUntil: "networkidle0" });
  await page.screenshot({ path: `${out}/${file}`, fullPage: true });
};
await shot("/supplier-funnel", "funil-fornecedores-pc.png", 1440, 900);
await shot("/supplier-funnel", "funil-fornecedores-notebook.png", 1280, 720);
await page.evaluate(() => { localStorage.setItem("theme", "dark"); document.documentElement.classList.add("dark"); });
await page.setViewport({ width: 2560, height: 1080 });
await page.goto(B + "/supplier-funnel", { waitUntil: "networkidle0" });
await page.evaluate(() => document.documentElement.classList.add("dark"));
await page.screenshot({ path: `${out}/funil-fornecedores-2560-escuro.png` });
await page.evaluate(() => { localStorage.setItem("theme", "light"); document.documentElement.classList.remove("dark"); });
await shot("/supplier-funnel", "funil-fornecedores-celular.png", 390, 844);
await shot("/calculator", "calculadora-pc.png", 1440, 900);
await shot("/suppliers", "fornecedores-pc.png", 1440, 900);
// formulário de novo fornecedor no funil
await page.setViewport({ width: 1440, height: 900 });
await page.goto(B + "/supplier-funnel", { waitUntil: "networkidle0" });
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Fornecedor")?.click());
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: `${out}/funil-novo-fornecedor.png` });
await browser.close();
console.log("prints ok");
