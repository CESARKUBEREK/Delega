// Tareas periódicas (pg_cron → pg_net): se responde enseguida (202) y el
// trabajo sigue en segundo plano con EdgeRuntime.waitUntil, como recomienda
// Supabase. Así no depende del tiempo de espera de la llamada de pg_net.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

export async function runInBackground(name: string, work: () => Promise<unknown>): Promise<Response> {
  const task = work()
    .then((result) => console.log(name, JSON.stringify(result)))
    .catch((e) => console.error(name, e instanceof Error ? e.name : "error"))
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(task)
    return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 202, headers: { "Content-Type": "application/json" } })
  }
  // Fuera de Supabase (pruebas): se espera al trabajo.
  await task
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } })
}
