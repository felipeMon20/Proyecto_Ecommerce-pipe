import { useEffect, useRef } from 'react'

// Repite la función cada cierto tiempo mientras la pestaña está visible y al volver a ella
function useRefrescoPeriodico(funcion, intervaloMs = 20000) {
  const ultima = useRef(funcion)

  useEffect(() => {
    ultima.current = funcion
  })

  useEffect(() => {
    const correr = () => {
      if (document.visibilityState === 'visible') ultima.current()
    }
    const temporizador = setInterval(correr, intervaloMs)
    document.addEventListener('visibilitychange', correr)
    window.addEventListener('focus', correr)
    return () => {
      clearInterval(temporizador)
      document.removeEventListener('visibilitychange', correr)
      window.removeEventListener('focus', correr)
    }
  }, [intervaloMs])
}

export default useRefrescoPeriodico
