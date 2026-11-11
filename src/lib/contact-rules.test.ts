import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCompanyName, normalizeEmail, normalizePersonName, normalizePhone } from "./contact-rules";
import { supplierSchema } from "./validators";

const ok = (r: { ok: boolean; value?: string }) => (r.ok ? r.value : null);

test("telefone: formatos aceitos e normalizados", () => {
  assert.equal(ok(normalizePhone("11987654321")), "(11) 98765-4321");
  assert.equal(ok(normalizePhone("+55 (11) 98765-4321")), "(11) 98765-4321");
  assert.equal(ok(normalizePhone("011 98765-4321")), "(11) 98765-4321");
  assert.equal(ok(normalizePhone("(21) 3456-7890")), "(21) 3456-7890");
  assert.equal(ok(normalizePhone("0800 123 4567")), "0800 123 4567");
  assert.equal(ok(normalizePhone("4004-1234")), "4004-1234");
  assert.equal(ok(normalizePhone("+86 138 1234 5678")), "+8613812345678");
});

test("telefone: rejeita errados", () => {
  for (const t of ["123", "(20) 98765-4321", "(11) 88765-4321", "(11) 9876-54321x0", "11999999999", "(11) 7456-7890", "abc", "+1 23"])
    assert.equal(normalizePhone(t).ok, false, t);
});

test("e-mail", () => {
  assert.equal(ok(normalizeEmail("  Vendas@Fornecedor.COM.br ")), "vendas@fornecedor.com.br");
  for (const e of ["vendas", "a@b", "a b@c.com", "a@@c.com", "a..b@c.com", ".a@c.com", "x@gmail.con", "x@gmial.com", "a@c.c"])
    assert.equal(normalizeEmail(e).ok, false, e);
  assert.match((normalizeEmail("ana@gmail.con") as { error: string }).error, /ana@gmail\.com/);
});

test("nomes", () => {
  assert.equal(ok(normalizePersonName("  João   d'Ávila-Souza ")), "João d'Ávila-Souza");
  assert.equal(normalizePersonName("João 2").ok, false);
  assert.equal(normalizePersonName("x").ok, false);
  assert.equal(ok(normalizeCompanyName("Shenzhen ABC Co., Ltd.")), "Shenzhen ABC Co., Ltd.");
  assert.equal(ok(normalizeCompanyName("3M do Brasil")), "3M do Brasil");
  assert.equal(normalizeCompanyName("12345").ok, false);
  assert.equal(normalizeCompanyName("!!!").ok, false);
});

test("schema do fornecedor", () => {
  const r = supplierSchema.parse({ name: " Fornecedor X ", contact: "", phone: "11987654321", email: "", leadDays: "15", notes: "  " });
  assert.deepEqual(r, { name: "Fornecedor X", contact: null, phone: "(11) 98765-4321", email: null, leadDays: 15, notes: null, active: true });
  const bad = supplierSchema.safeParse({ name: "X Ltda", phone: "123", email: "a@b", leadDays: "-1" });
  assert.equal(bad.success, false);
  assert.equal(bad.error!.issues.length, 3);
});
