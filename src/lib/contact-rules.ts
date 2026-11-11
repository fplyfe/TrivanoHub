// Regras de contato compartilhadas pelo formulário (navegador) e pela API (servidor).

const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92,
  93, 94, 95, 96, 97, 98, 99,
]);

type Result = { ok: true; value: string } | { ok: false; error: string };

const allSame = (s: string) => /^(\d)\1+$/.test(s);

/**
 * Telefone brasileiro (fixo, celular, 0800, 4004) ou internacional (+código do país).
 * Devolve o número formatado: (11) 98765-4321 · (11) 3456-7890 · 0800 123 4567 · 4004-1234 · +8613812345678
 */
export function normalizePhone(raw: string): Result {
  const txt = raw.trim();
  let d = txt.replace(/\D/g, "");
  if (!d) return { ok: false, error: "Informe o telefone" };

  // Internacional: começa com + e não é do Brasil
  if (txt.startsWith("+") && !d.startsWith("55")) {
    if (d.length < 8 || d.length > 15) return { ok: false, error: "Telefone internacional deve ter de 8 a 15 dígitos com o código do país" };
    return { ok: true, value: `+${d}` };
  }
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2); // +55
  if (/^0[1-9]{2}\d{8,9}$/.test(d) && !/^0[3589]00/.test(d)) d = d.slice(1); // 0 + DDD (ligação interurbana)

  if (/^0[3589]00\d{7}$/.test(d)) return { ok: true, value: `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` };
  if (/^[34]00\d{5}$/.test(d)) return { ok: true, value: `${d.slice(0, 4)}-${d.slice(4)}` };

  if (d.length !== 10 && d.length !== 11) return { ok: false, error: "Telefone deve ter DDD + número, ex.: (11) 98765-4321" };
  const ddd = Number(d.slice(0, 2));
  const num = d.slice(2);
  if (!DDDS.has(ddd)) return { ok: false, error: `DDD ${d.slice(0, 2)} não existe` };
  if (allSame(num)) return { ok: false, error: "Telefone inválido (dígitos repetidos)" };
  if (d.length === 11) {
    if (num[0] !== "9") return { ok: false, error: "Celular deve começar com 9 depois do DDD" };
    return { ok: true, value: `(${d.slice(0, 2)}) ${num.slice(0, 5)}-${num.slice(5)}` };
  }
  if (!/^[2-5]/.test(num)) return { ok: false, error: "Telefone fixo deve começar com 2, 3, 4 ou 5 (celular tem 9 dígitos)" };
  return { ok: true, value: `(${d.slice(0, 2)}) ${num.slice(0, 4)}-${num.slice(4)}` };
}

// Erros de digitação comuns em domínios de e-mail
const TYPOS: Record<string, string> = {
  "gmail.con": "gmail.com", "gmail.co": "gmail.com", "gmail.com.br": "gmail.com", "gmial.com": "gmail.com", "gmai.com": "gmail.com",
  "gamil.com": "gmail.com", "gnail.com": "gmail.com", "gmail.cm": "gmail.com", "gmaill.com": "gmail.com",
  "hotmal.com": "hotmail.com", "hotmail.con": "hotmail.com", "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com", "outlook.con": "outlook.com", "outlok.com": "outlook.com", "yahoo.con": "yahoo.com",
  "yaho.com": "yahoo.com", "yahoo.com.b": "yahoo.com.br", "icloud.con": "icloud.com", "uol.com": "uol.com.br",
  "bol.com": "bol.com.br", "terra.com": "terra.com.br",
};

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}$/;

export function normalizeEmail(raw: string): Result {
  const e = raw.trim().toLowerCase();
  if (!e) return { ok: false, error: "Informe o e-mail" };
  if (e.length > 120) return { ok: false, error: "E-mail muito longo (máx. 120)" };
  if (/\s/.test(e)) return { ok: false, error: "E-mail não pode ter espaços" };
  if (!EMAIL_RE.test(e) || e.includes("..") || e.startsWith(".") || e.split("@")[0].endsWith("."))
    return { ok: false, error: "E-mail inválido, ex.: vendas@fornecedor.com.br" };
  const domain = e.split("@")[1];
  if (TYPOS[domain]) return { ok: false, error: `Domínio parece errado: você quis dizer ${e.split("@")[0]}@${TYPOS[domain]}?` };
  return { ok: true, value: e };
}

/** Nome de pessoa: letras (com acento), espaço, ponto, apóstrofo e hífen. */
export function normalizePersonName(raw: string): Result {
  const n = raw.trim().replace(/\s+/g, " ");
  if (n.length < 2) return { ok: false, error: "Nome do contato muito curto" };
  if (n.length > 80) return { ok: false, error: "Nome do contato muito longo (máx. 80)" };
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(n)) return { ok: false, error: "Nome do contato deve ter só letras (sem números ou símbolos)" };
  return { ok: true, value: n };
}

/** Nome de empresa: precisa ter ao menos uma letra; aceita números e & . , - / ( ). */
export function normalizeCompanyName(raw: string): Result {
  const n = raw.trim().replace(/\s+/g, " ");
  if (n.length < 2) return { ok: false, error: "Informe o nome do fornecedor (mín. 2 caracteres)" };
  if (n.length > 80) return { ok: false, error: "Nome muito longo (máx. 80)" };
  if (!/\p{L}/u.test(n)) return { ok: false, error: "Nome deve ter ao menos uma letra" };
  if (!/^[\p{L}\p{N} &.,'\/()+-]+$/u.test(n)) return { ok: false, error: "Nome com caracteres inválidos" };
  return { ok: true, value: n };
}
