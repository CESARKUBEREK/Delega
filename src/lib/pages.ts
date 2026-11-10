// Páginas vivas (fase 10): la parte pura, compartida con las Edge Functions.
// La app la usa para pintar el Markdown sin HTML, comparar versiones y guardar.
export {
  type Block,
  byteLength,
  type DiffLine,
  diffLines,
  diffStats,
  type Inline,
  MAX_PAGE_BYTES,
  MAX_TITLE_CHARS,
  pageSections,
  pageSlug,
  parseInline,
  parseMarkdown,
  replaceSection,
  safeHref,
} from "../../supabase/functions/_shared/pages/core"
