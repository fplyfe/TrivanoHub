/** Helper de fetch para componentes cliente. Lança Error com a mensagem da API. */
export async function api<T = unknown>(url: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Erro inesperado");
  return data as T;
}

export type Opt = { id: string; name: string; color?: string };
