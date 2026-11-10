import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Segredos de integrações (tokens) ficam no banco criptografados com AES-256-GCM.
// A chave é derivada do AUTH_SECRET: sem ele, um dump do banco não revela os tokens.
const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET ausente ou curto demais");
  return createHash("sha256").update("trivanohub:integrations:" + s).digest();
};

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decryptSecret(box: string): string {
  const [v, iv, tag, data] = box.split(".");
  if (v !== "v1") throw new Error("Formato de segredo desconhecido");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

/** Mostra só o começo e o fim de um token. */
export const maskSecret = (s: string) => (s.length <= 10 ? "••••" : `${s.slice(0, 4)}••••${s.slice(-4)}`);

/** Chaves de API aleatórias (alta entropia): guardamos só o hash SHA-256. */
export const newApiKey = () => "tvh_" + randomBytes(24).toString("base64url");
export const hashApiKey = (k: string) => createHash("sha256").update(k).digest("hex");
export function sameHash(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}
