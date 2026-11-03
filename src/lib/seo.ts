import type { Metadata } from "next"

type PublicPageMetadataOptions = {
  title: string
  description: string
  path: string
  absoluteTitle?: string
}

export function publicPageMetadata({ title, description, path, absoluteTitle }: PublicPageMetadataOptions): Metadata {
  const fullTitle = absoluteTitle ?? `${title} · MarchaSolo`
  const image = { url: "/opengraph-image", width: 1200, height: 630, alt: fullTitle }

  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "es_ES",
      siteName: "MarchaSolo",
      title: fullTitle,
      description,
      url: path,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image.url],
    },
  }
}
