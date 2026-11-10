import type { ReactNode } from "react"
import { type Block, type Inline, parseMarkdown } from "@/lib/pages"

// Markdown de una página viva, pintado con elementos de React: nunca se
// inserta HTML, así que nada de lo que escriba la IA o la persona se ejecuta.

function inline(nodes: Inline[], key = ""): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}${i}`
    switch (n.t) {
      case "text":
        return n.v
      case "strong":
        return <strong key={k}>{inline(n.v, `${k}.`)}</strong>
      case "em":
        return <em key={k}>{inline(n.v, `${k}.`)}</em>
      case "code":
        return <code key={k} className="rounded bg-rule/40 px-1 py-0.5 text-[0.9em]">{n.v}</code>
      case "link":
        return (
          <a key={k} href={n.href} target="_blank" rel="noopener noreferrer nofollow" className="text-link underline underline-offset-4">
            {inline(n.v, `${k}.`)}
          </a>
        )
    }
  })
}

function block(b: Block, i: number): ReactNode {
  switch (b.t) {
    case "heading":
      if (b.level === 1) return <h2 key={i} className="mt-6 text-2xl font-semibold text-ink first:mt-0">{inline(b.v)}</h2>
      if (b.level === 2) return <h3 key={i} className="mt-6 border-b border-rule pb-1 text-lg font-semibold text-ink first:mt-0">{inline(b.v)}</h3>
      return <h4 key={i} className="mt-4 font-semibold text-ink first:mt-0">{inline(b.v)}</h4>
    case "paragraph":
      return <p key={i} className="mt-3 leading-relaxed text-ink first:mt-0">{inline(b.v)}</p>
    case "list": {
      const items = b.items.map((it, j) => <li key={j}>{inline(it, `${j}.`)}</li>)
      return b.ordered
        ? <ol key={i} className="mt-3 list-decimal space-y-1 pl-6 text-ink first:mt-0">{items}</ol>
        : <ul key={i} className="mt-3 list-disc space-y-1 pl-6 text-ink first:mt-0">{items}</ul>
    }
    case "quote":
      return <blockquote key={i} className="mt-3 border-l-4 border-rule pl-4 text-graphite first:mt-0">{inline(b.v)}</blockquote>
    case "code":
      return <pre key={i} className="mt-3 overflow-x-auto rounded-lg bg-rule/30 p-3 text-sm first:mt-0"><code>{b.v}</code></pre>
    case "rule":
      return <hr key={i} className="my-6 border-rule" />
    case "table":
      return (
        <div key={i} className="mt-3 overflow-x-auto first:mt-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>{b.head.map((c, j) => <th key={j} scope="col" className="border-b border-ink px-2 py-1.5 text-left font-semibold">{inline(c, `${j}.`)}</th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, j) => (
                <tr key={j} className="border-b border-rule">{r.map((c, k) => <td key={k} className="px-2 py-1.5 align-top">{inline(c, `${k}.`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source)
  if (!blocks.length) return <p className={`text-graphite ${className}`.trim()}>Esta página todavía está vacía.</p>
  return <div className={`page-markdown ${className}`.trim()}>{blocks.map(block)}</div>
}
