// MarchaSolo · Asistente de voz para tu web.
// Uso: <script src="https://…/widget-voz.js" data-id="msw_…" defer></script>
// Añade un botón abajo a la derecha que abre la conversación de voz en un panel.
(function () {
  var script = document.currentScript
  if (!script) return
  var id = script.getAttribute("data-id") || ""
  if (!/^msw_[A-Za-z0-9_-]{20,60}$/.test(id)) return
  var origin = new URL(script.src).origin
  var title = script.getAttribute("data-title") || "Habla con nosotros"

  var button = document.createElement("button")
  button.type = "button"
  button.textContent = "🎙 " + title
  button.setAttribute("aria-label", title)
  button.style.cssText =
    "position:fixed;right:20px;bottom:20px;z-index:2147483000;padding:14px 20px;border:0;border-radius:999px;" +
    "background:#0b1f3b;color:#fff;font:600 15px/1 system-ui,sans-serif;box-shadow:0 8px 24px rgba(11,31,59,.3);cursor:pointer"

  var panel = null
  function close() {
    if (panel) panel.remove()
    panel = null
    button.style.display = ""
  }
  button.addEventListener("click", function () {
    if (panel) return close()
    panel = document.createElement("div")
    panel.style.cssText =
      "position:fixed;right:20px;bottom:20px;z-index:2147483001;width:min(360px,calc(100vw - 40px));height:min(520px,calc(100vh - 40px));" +
      "border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 16px 48px rgba(11,31,59,.35)"
    var x = document.createElement("button")
    x.type = "button"
    x.textContent = "✕"
    x.setAttribute("aria-label", "Cerrar")
    x.style.cssText = "position:absolute;top:8px;right:8px;z-index:1;width:36px;height:36px;border:0;border-radius:50%;background:#f3f6fa;cursor:pointer;font-size:16px"
    x.addEventListener("click", close)
    var frame = document.createElement("iframe")
    frame.src = origin + "/hablar/" + encodeURIComponent(id)
    frame.title = title
    frame.allow = "microphone; autoplay"
    frame.style.cssText = "width:100%;height:100%;border:0"
    panel.appendChild(x)
    panel.appendChild(frame)
    document.body.appendChild(panel)
    button.style.display = "none"
  })
  document.body.appendChild(button)
})()
