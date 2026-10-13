import { useEffect, useRef, useState } from 'react'

const URL_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let promesaScript = null

function cargarScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!promesaScript) {
    promesaScript = new Promise((resolver, rechazar) => {
      const script = document.createElement('script')
      script.src = URL_SCRIPT
      script.async = true
      script.onload = () => resolver(window.turnstile)
      script.onerror = () => {
        promesaScript = null
        rechazar(new Error('No se pudo cargar la verificación'))
      }
      document.head.appendChild(script)
    })
  }
  return promesaScript
}

// Casilla de verificación de Cloudflare Turnstile; "reinicio" cambia para pedir una nueva
function Captcha({ siteKey, onToken, reinicio }) {
  const caja = useRef(null)
  const idWidget = useRef(null)
  const alToken = useRef(onToken)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    alToken.current = onToken
  })

  useEffect(() => {
    let vigente = true
    cargarScript()
      .then((turnstile) => {
        if (!vigente || !caja.current) return
        idWidget.current = turnstile.render(caja.current, {
          sitekey: siteKey,
          callback: (token) => alToken.current(token),
          'expired-callback': () => alToken.current(''),
          'error-callback': () => alToken.current(''),
        })
      })
      .catch(() => {
        if (vigente) setFallo(true)
      })
    return () => {
      vigente = false
      if (idWidget.current !== null && window.turnstile) window.turnstile.remove(idWidget.current)
      idWidget.current = null
    }
  }, [siteKey])

  useEffect(() => {
    if (reinicio && idWidget.current !== null && window.turnstile) window.turnstile.reset(idWidget.current)
  }, [reinicio])

  return (
    <div className="captcha">
      <div ref={caja} />
      {fallo && <p className="captcha-fallo">No se pudo cargar la verificación de seguridad. Revisa tu conexión y recarga la página.</p>}
    </div>
  )
}

export default Captcha
