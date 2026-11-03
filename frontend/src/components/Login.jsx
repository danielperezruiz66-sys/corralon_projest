import { useState } from 'react'
import { useAuth } from '../auth/contexto'

export default function Login() {
  const { login } = useAuth()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await login(usuario.trim(), password)
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <div className="login-marca">
        <span className="login-logo">FC</span>
        <div>
          <strong>Corralón Fer-Cons</strong>
          <small>Gestión de materiales de construcción</small>
        </div>
      </div>

      <form className="login-tarjeta" onSubmit={enviar}>
        <h1>Ingresar</h1>
        <p className="login-ayuda">
          Podés usar tu usuario o tu legajo.
        </p>

        <label className="campo">
          <span>Usuario o legajo</span>
          <input
            type="text"
            value={usuario}
            onChange={(evento) => setUsuario(evento.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>

        <label className="campo">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(evento) => setPassword(evento.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="mensaje-error">{error}</p>}

        <button className="boton-primario" type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <p className="login-pie">Corralón Fer-Cons · Sistema interno</p>
    </div>
  )
}
