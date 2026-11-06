import test from "node:test"
import assert from "node:assert/strict"
import { combineWebsitePages, isSameOriginWebsiteUrl, parseWebsiteHtml, selectRelevantWebsiteLinks } from "../src/lib/business-discovery/website-parser.ts"

test("extrae contenido visible y omite navegación, pie y scripts", () => {
  const result = parseWebsiteHtml('<html lang="es"><head><title>Estudio Norte</title><meta name="description" content="Diseño y arquitectura"></head><body><header>Cabecera global</header><nav>Inicio Contacto</nav><main><h1>Proyectos</h1><p>Atendemos empresas y particulares.</p></main><footer>Política de privacidad</footer><script>no incluir</script></body></html>', "https://example.com")
  assert.equal(result.title, "Estudio Norte")
  assert.equal(result.description, "Diseño y arquitectura")
  assert.deepEqual(result.headings, ["Proyectos"])
  assert.match(result.text, /Atendemos empresas y particulares/)
  assert.doesNotMatch(result.text, /Cabecera global|Inicio Contacto|Política de privacidad|no incluir/)
  assert.equal(result.contentQuality, "usable")
})

test("detecta páginas que parecen shells JavaScript sin fingir que se han renderizado", () => {
  const result = parseWebsiteHtml('<html><head><title>Aplicación</title></head><body><div id="__next"></div><script src="/_next/app.js"></script></body></html>', "https://example.com")
  assert.equal(result.contentQuality, "javascript_shell")
  assert.equal(result.text, "")
})

test("clasifica páginas con solo metadatos como extracción parcial", () => {
  const result = parseWebsiteHtml('<html><head><title>Empresa</title><meta name="description" content="Consultoría para empresas"></head><body><div id="root"></div></body></html>', "https://example.com")
  assert.equal(result.contentQuality, "metadata_only")
})

test("limita encabezados, texto y enlaces", () => {
  const headings = Array.from({ length: 20 }, (_, i) => `<h2>Sección ${i}</h2>`).join("")
  const result = parseWebsiteHtml(`<body><main>${headings}${"texto ".repeat(3000)}</main></body>`, "https://example.com")
  assert.equal(result.headings.length, 12)
  assert.ok(result.text.length <= 12_000)
  assert.ok(result.links.length <= 150)
})

test("selecciona páginas comerciales y corporativas del mismo origen", () => {
  const selected = selectRelevantWebsiteLinks(["/blog/noticia", "/servicios", "/contacto", "https://otro.example/servicios", "mailto:hola@example.org", "/nosotros", "/proyectos"], "https://negocio.example/")
  assert.deepEqual(selected, ["https://negocio.example/servicios", "https://negocio.example/proyectos"])
  assert.ok(selected.every((url) => isSameOriginWebsiteUrl("https://negocio.example/", url)))
  assert.equal(isSameOriginWebsiteUrl("https://negocio.example/", "https://otro.example/contacto"), false)
})

test("el snapshot elimina duplicados y limita a tres páginas", () => {
  const pages = Array.from({ length: 5 }, (_, index) => ({ url: `https://negocio.example/pagina-${index}`, title: `Página ${index}`, description: null, headings: [], text: "Contenido" }))
  const snapshot = combineWebsitePages([pages[0], pages[1], pages[1], pages[2], pages[3]])
  assert.equal(snapshot.pages.length, 3)
  assert.equal(snapshot.url, pages[0].url)
  assert.deepEqual(snapshot.pages.map((page) => page.url), [pages[0].url, pages[1].url, pages[2].url])
})

test("extrae contenido de una estructura WordPress típica sin confundir widgets y footer", () => {
  const html = `<!doctype html><html lang="fr"><head><title>Cabinet Durand</title><meta name="description" content="Conseil en stratégie pour PME"></head><body><header class="site-header"><nav>Accueil Services Contact</nav></header><main id="main" class="site-main"><article class="page type-page"><h1>Conseil en stratégie</h1><div class="entry-content"><p>Nous accompagnons les entreprises industrielles dans leur développement commercial.</p><h2>Nos services</h2><p>Études de marché, stratégie export et accompagnement opérationnel.</p></div></article></main><aside class="widget-area">Articles récents</aside><footer class="site-footer">Mentions légales et cookies</footer></body></html>`;
  const result = parseWebsiteHtml(html, "https://cabinet.example/");
  assert.equal(result.language, "fr");
  assert.match(result.title, /Cabinet Durand/);
  assert.match(result.text, /entreprises industrielles/);
  assert.match(result.text, /stratégie export/);
  assert.doesNotMatch(result.text, /Accueil Services Contact|Articles récents|Mentions légales/);
  assert.equal(result.contentQuality, "usable");
})


test("recupera contenido de negocio embebido en la hidratación de Next.js", () => {
  const payload = JSON.stringify({
    props: { pageProps: {
      title: "Taller Rutas",
      description: "Taller especializado en mantenimiento y reparación de motocicletas.",
      services: [{ name: "Mantenimiento integral", description: "Revisión, diagnóstico y reparación para motos de carretera." }],
      navigation: ["Inicio", "Contacto"],
    } },
  })
  const html = '<html lang="es"><head><title>Taller Rutas</title></head><body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">' + payload + '</script><script src="/_next/static/app.js"></script></body></html>'
  const result = parseWebsiteHtml(html, "https://taller.example/")
  assert.equal(result.contentQuality, "usable")
  assert.equal(result.contentSource, "embedded_data")
  assert.match(result.text, /mantenimiento y reparación de motocicletas/)
  assert.match(result.text, /diagnóstico y reparación/)
  assert.doesNotMatch(result.text, /navigation|Inicio|Contacto/)
})

test("extrae descripciones estructuradas JSON-LD sin incluir el código JavaScript", () => {
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Moto Pyrénées",
    description: "Alquiler de motos y organización de rutas guiadas por los Pirineos.",
    makesOffer: [{ "@type": "Offer", name: "Tour de montaña", description: "Excursiones guiadas para motoristas por carreteras de montaña." }],
  })
  const html = '<html><head><script type="application/ld+json">' + jsonLd + '</script></head><body><div id="root"></div><script>window.secret = "texto que no debe extraerse";</script></body></html>'
  const result = parseWebsiteHtml(html, "https://moto.example/")
  assert.equal(result.contentQuality, "usable")
  assert.equal(result.contentSource, "embedded_data")
  assert.match(result.text, /rutas guiadas por los Pirineos/)
  assert.match(result.text, /carreteras de montaña/)
  assert.doesNotMatch(result.text, /texto que no debe extraerse/)
})

test("ignora scripts ejecutables que no sean datos estructurados o de hidratación", () => {
  const html = '<html><head><title>Aplicación</title></head><body><div id="app"></div><script>const content = "Texto de ejemplo que no representa contenido visible del negocio";</script></body></html>'
  const result = parseWebsiteHtml(html, "https://app.example/")
  assert.equal(result.contentQuality, "javascript_shell")
  assert.equal(result.contentSource, "metadata")
  assert.doesNotMatch(result.text, /Texto de ejemplo/)
})
