"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, KeyRound, Loader2, PlugZap, RefreshCw, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { api } from "@/lib/client";
import { SOURCE_LABEL, type Source } from "@/lib/marketing-shared";
import { addDays, today } from "@/lib/dates";
import { brl, fmtDate } from "@/lib/utils";

type Meta = {
  configured: boolean;
  accounts: string[];
  version: string;
  autoSync: boolean;
  tokenMask: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

type Msg = { ok: boolean; text: string } | null;

function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const run = async (id: string, fn: () => Promise<string>) => {
    setBusy(id);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Erro" });
    } finally {
      setBusy(null);
    }
  };
  return { busy, msg, run };
}

function MetaCard({ meta, isAdmin }: { meta: Meta; isAdmin: boolean }) {
  const router = useRouter();
  const { busy, msg, run } = useAction();
  const [days, setDays] = useState("7");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-[#0866FF] text-sm font-bold text-white">f</span>
            Meta Ads (Facebook e Instagram)
          </span>
          {meta.configured ? (
            meta.lastError ? <Badge tone="danger">Com erro</Badge> : <Badge tone="success">Conectado</Badge>
          ) : (
            <Badge>Não configurado</Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Puxa o gasto, impressões, cliques e compras de cada campanha, por dia, pela Marketing API. Atualiza sozinho a cada hora quando alguém abre o Dashboard
          de Ads.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        {meta.configured && (
          <div className="grid gap-1 rounded-lg bg-secondary/50 p-3 text-sm">
            <p>
              Contas: <b>{meta.accounts.join(", ")}</b> · API {meta.version}
            </p>
            <p>Token: {meta.tokenMask}</p>
            <p className="text-muted-foreground">Última sincronização: {meta.lastSyncAt ? new Date(meta.lastSyncAt).toLocaleString("pt-BR") : "nunca"}</p>
            {meta.lastError && <p className="text-destructive">Erro: {meta.lastError}</p>}
          </div>
        )}

        {isAdmin ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run("save", async () => {
                const r = await api<{ accounts: string[] }>("/api/integrations/meta", "PUT", {
                  token: fd.get("token"),
                  accounts: fd.get("accounts"),
                  version: fd.get("version"),
                  autoSync: fd.get("autoSync") === "on",
                });
                router.refresh();
                return `Configuração salva (${r.accounts.join(", ")}). Agora teste a conexão.`;
              });
            }}
          >
            <Field label={meta.tokenMask ? "Novo token de acesso (deixe vazio para manter o atual)" : "Token de acesso"}>
              <Input name="token" type="password" autoComplete="off" placeholder="EAAB…" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="ID da conta de anúncios" className="sm:col-span-2">
                <Input name="accounts" defaultValue={meta.accounts.join(", ")} placeholder="act_1234567890 (separe várias por vírgula)" required />
              </Field>
              <Field label="Versão da API">
                <Input name="version" defaultValue={meta.version} required />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="autoSync" defaultChecked={meta.autoSync} /> Sincronizar sozinho (a cada hora, ao abrir o Dashboard de Ads)
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!!busy}>
                {busy === "save" && <Loader2 className="animate-spin" />} Salvar
              </Button>
              {meta.configured && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!!busy}
                    onClick={() =>
                      run("test", async () => {
                        const r = await api<{ user: string; accounts: { id: string; name: string; currency: string; active: boolean }[] }>(
                          "/api/integrations/meta/test",
                          "POST",
                        );
                        return `Conectado como ${r.user}. ${r.accounts.map((a) => `${a.name} (${a.id}, ${a.currency}${a.active ? "" : ", inativa"})`).join("; ")}`;
                      })
                    }
                  >
                    {busy === "test" ? <Loader2 className="animate-spin" /> : <PlugZap />} Testar conexão
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!!busy}
                    onClick={() =>
                      window.confirm("Remover a integração com o Meta? Os gastos já importados continuam.") &&
                      run("del", async () => {
                        await api("/api/integrations/meta", "DELETE");
                        router.refresh();
                        return "Integração removida.";
                      })
                    }
                  >
                    <Trash2 /> Remover
                  </Button>
                </>
              )}
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Só o administrador altera a configuração.</p>
        )}

        {meta.configured && (
          <div className="flex flex-wrap items-end gap-2 border-t pt-4">
            <Field label="Sincronizar agora">
              <Select value={days} onChange={(e) => setDays(e.target.value)} className="w-44">
                <option value="1">Hoje</option>
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
              </Select>
            </Field>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                run("sync", async () => {
                  const r = await api<{ rows: number; spend: number }>("/api/integrations/meta/sync", "POST", {
                    since: addDays(today(), -(Number(days) - 1)),
                    until: today(),
                  });
                  router.refresh();
                  return `${r.rows} linha(s) importadas · ${brl(r.spend)} em gastos.`;
                })
              }
            >
              {busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sincronizar
            </Button>
          </div>
        )}

        {msg && (
          <p className={`flex items-start gap-2 text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>
            {msg.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
            {msg.text}
          </p>
        )}

        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Como conseguir o token e o ID da conta</summary>
          <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-muted-foreground">
            <li>
              No <b>Gerenciador de Negócios</b> do Meta, vá em Configurações do negócio → <b>Usuários do sistema</b> e crie um usuário do sistema (função
              Funcionário).
            </li>
            <li>Em <b>Ativos</b>, dê a ele acesso à sua conta de anúncios (permissão de ver desempenho basta).</li>
            <li>
              Clique em <b>Gerar novo token</b>, escolha o seu app (crie um app do tipo Empresa em developers.facebook.com se ainda não tiver) e marque a
              permissão <b>ads_read</b>. Escolha validade &quot;Nunca&quot;.
            </li>
            <li>
              O <b>ID da conta</b> aparece no Gerenciador de Anúncios, no seletor de contas (números depois de &quot;act=&quot; na barra de endereço).
            </li>
            <li>Cole aqui, salve e clique em Testar conexão.</li>
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}

function IngestCard({ active, prefix, endpoint, isAdmin }: { active: boolean; prefix: string | null; endpoint: string; isAdmin: boolean }) {
  const router = useRouter();
  const { busy, msg, run } = useAction();
  const [key, setKey] = useState<string | null>(null);
  const example = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${key ?? "SUA_CHAVE"}" \\
  -H "Content-Type: application/json" \\
  -d '[{"date":"${today()}","source":"GOOGLE","campaignId":"123","campaignName":"Shopping - Organizadores","spend":45.90,"clicks":120,"impressions":8000,"purchases":3,"purchaseValue":329.70,"sku":"ORG-01"}]'`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <KeyRound className="size-5" /> API de entrada de gastos
          </span>
          {active ? <Badge tone="success">Ativa · {prefix}…</Badge> : <Badge>Sem chave</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Para alimentar com outras fontes (Google Ads, TikTok, Mercado Ads) usando n8n, Make, Zapier ou um script. Reenviar o mesmo dia e campanha atualiza os
          valores.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={active ? "outline" : "default"}
              disabled={!!busy}
              onClick={() =>
                (!active || window.confirm("Gerar uma chave nova? A chave atual para de funcionar.")) &&
                run("key", async () => {
                  const r = await api<{ key: string }>("/api/integrations/ingest-key", "POST");
                  setKey(r.key);
                  router.refresh();
                  return "Chave gerada. Copie agora: ela não aparece de novo.";
                })
              }
            >
              <KeyRound /> {active ? "Gerar nova chave" : "Gerar chave"}
            </Button>
            {active && (
              <Button
                variant="ghost"
                disabled={!!busy}
                onClick={() =>
                  window.confirm("Desativar a API de entrada?") &&
                  run("revoke", async () => {
                    await api("/api/integrations/ingest-key", "DELETE");
                    setKey(null);
                    router.refresh();
                    return "API desativada.";
                  })
                }
              >
                <Trash2 /> Desativar
              </Button>
            )}
          </div>
        )}
        {key && (
          <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-2">
            <code className="min-w-0 flex-1 truncate text-xs">{key}</code>
            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(key)}>
              <Copy /> Copiar
            </Button>
          </div>
        )}
        {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}
        <div className="grid gap-1 text-sm">
          <p className="font-medium">Endereço</p>
          <code className="break-all rounded bg-secondary px-2 py-1 text-xs">POST {endpoint}</code>
        </div>
        <div className="grid gap-1 text-sm">
          <p className="font-medium">Exemplo</p>
          <pre className="overflow-x-auto rounded-lg bg-[#16211F] p-3 text-xs leading-relaxed text-[#DCE7E3]">{example}</pre>
          <p className="text-xs text-muted-foreground">
            Campos: date (AAAA-MM-DD), source (META, MERCADO_ADS, GOOGLE, TIKTOK, OTHER), campaignId, campaignName, spend e, opcionais, impressions, clicks,
            purchases, purchaseValue e sku (liga a campanha ao produto).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationsView({
  isAdmin,
  meta,
  ingest,
  endpoint,
  totals,
}: {
  isAdmin: boolean;
  meta: Meta;
  ingest: { active: boolean; prefix: string | null };
  endpoint: string;
  totals: { source: Source; spend: number; rows: number; last: string | null }[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <MetaCard meta={meta} isAdmin={isAdmin} />
      <div className="grid content-start gap-4">
        <IngestCard {...ingest} endpoint={endpoint} isAdmin={isAdmin} />
        <Card>
          <CardHeader>
            <CardTitle>Dados recebidos</CardTitle>
          </CardHeader>
          <CardContent>
            {totals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum gasto importado ainda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1.5">Fonte</th>
                    <th className="py-1.5 text-right">Linhas</th>
                    <th className="py-1.5 text-right">Gasto total</th>
                    <th className="py-1.5 text-right">Último dia</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {totals.map((t) => (
                    <tr key={t.source}>
                      <td className="py-1.5">{SOURCE_LABEL[t.source]}</td>
                      <td className="py-1.5 text-right">{t.rows}</td>
                      <td className="py-1.5 text-right">{brl(t.spend)}</td>
                      <td className="py-1.5 text-right">{t.last ? fmtDate(t.last) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Sem integração? Use &quot;Lançar gasto&quot; no Dashboard de Ads, ou o lançamento semanal em Ads por produto.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
