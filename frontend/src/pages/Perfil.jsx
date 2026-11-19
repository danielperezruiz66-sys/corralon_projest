import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  IconDeviceFloppy,
  IconHash,
  IconId,
  IconKey,
  IconLoader2,
  IconLock,
  IconMail,
  IconPhone,
  IconShieldCheck,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import Encabezado from '../components/Encabezado.jsx';
import MensajeError from '../components/common/MensajeError.jsx';
import { pedir } from '../api/client';
import { useAuth } from '../context/auth-context';
import { iniciales } from '../utils/formato';
import {
  validarEmail,
  validarNombre,
  validarTelefono,
} from '../utils/validaciones';
import '../styles/DatosCuenta.css';

const CAMPOS_EDITABLES = [
  { id: 'nombre', etiqueta: 'Nombre', Icono: IconUser },
  { id: 'apellido', etiqueta: 'Apellido', Icono: IconUser },
  { id: 'email', etiqueta: 'Email', Icono: IconMail },
  { id: 'telefono', etiqueta: 'Teléfono', Icono: IconPhone },
];

const CAMPOS_SOLO_LECTURA = [
  { id: 'dni', etiqueta: 'DNI', Icono: IconId },
  { id: 'legajo', etiqueta: 'Legajo', Icono: IconHash },
  { id: 'rol', etiqueta: 'Rol principal', Icono: IconShieldCheck },
  { id: 'roles', etiqueta: 'Roles activos', Icono: IconShieldCheck, ancho: true },
];

const VALIDACIONES = {
  nombre: (valor) => validarNombre(valor, 'El nombre'),
  apellido: (valor) => validarNombre(valor, 'El apellido'),
  email: validarEmail,
  telefono: validarTelefono,
};

function Perfil() {
  const { user, codigos } = useAuth();
  const [datos, setDatos] = useState(null);
  const [valoresPersonales, setValoresPersonales] = useState({});
  const [datosGuardados, setDatosGuardados] = useState({});
  const [errores, setErrores] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [cargo, setCargo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [modalPassword, setModalPassword] = useState(false);
  const [clavesPassword, setClavesPassword] = useState({
    password_admin: '',
    password: '',
    password2: '',
  });
  const [erroresPassword, setErroresPassword] = useState({});
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  const esAdministrador = Boolean(user?.is_superuser) || codigos.includes('AD');
  const nombreRol = datos?.roles?.[0] ?? user?.rol ?? '';
  const nombreCompleto = datos?.empleado
    ? `${datos.empleado.nombre} ${datos.empleado.apellido}`.trim()
    : datos?.username ?? '';
  const activo = datos?.empleado
    ? datos.empleado.estado === 'AC'
    : Boolean(datos?.is_active);
  const camposEditables = datos?.empleado
    ? CAMPOS_EDITABLES
    : CAMPOS_EDITABLES.filter(({ id }) => id === 'email');
  const hayCambios = camposEditables.some(
    ({ id }) => (valoresPersonales[id] ?? '') !== (datosGuardados[id] ?? ''),
  );

  const aplicarPerfil = useCallback((perfil) => {
    setDatos(perfil);
    const valores = {
      nombre: perfil.empleado?.nombre ?? '',
      apellido: perfil.empleado?.apellido ?? '',
      email: perfil.email ?? '',
      telefono: perfil.empleado?.telefono ?? '',
    };
    setValoresPersonales(valores);
    setDatosGuardados(valores);
    setErrores({});
  }, []);

  const cargar = useCallback(
    async ({ inicial = false } = {}) => {
      if (!inicial) {
        setCargando(true);
      }
      try {
        const perfil = await pedir('/perfil/');
        setError('');
        aplicarPerfil(perfil);
        setCargo(true);
      } catch (err) {
        setError(err?.message || 'No se pudo cargar el perfil.');
      } finally {
        setCargando(false);
      }
    },
    [aplicarPerfil],
  );

  useEffect(() => {
    Promise.resolve().then(() => {
      cargar({ inicial: true });
    });
  }, [cargar]);

  const setValorPersonal = (id, valor) => {
    setValoresPersonales((actuales) => ({ ...actuales, [id]: valor }));
    setErrores((actuales) => ({
      ...actuales,
      [id]: VALIDACIONES[id]?.(valor) ?? '',
    }));
  };

  const valorPara = (id) => {
    if (id === 'nombre') return datos?.empleado?.nombre ?? '';
    if (id === 'apellido') return datos?.empleado?.apellido ?? '';
    if (id === 'email') return datos?.email ?? '';
    if (id === 'telefono') return datos?.empleado?.telefono ?? '';
    if (id === 'dni') return datos?.empleado?.dni ?? '—';
    if (id === 'legajo') return datos?.empleado?.legajo ?? '—';
    if (id === 'rol') return esAdministrador ? 'Administrador' : nombreRol || 'Sin rol';
    if (id === 'roles') return datos?.roles?.join(', ') || 'Sin roles';
    return '';
  };

  const renderCampo = ({ id, etiqueta, Icono, ancho }, editable) => {
    const mensaje = errores[id] ?? '';
    return (
      <div
        className={`campo-perfil-item ${ancho ? 'campo-perfil-ancho' : ''}`}
        key={id}
      >
        <span className="icono-campo-perfil">
          <Icono size={20} stroke={1.8} />
        </span>
        <div className="info-campo-perfil">
          <span>{etiqueta}</span>
          {editable && esAdministrador ? (
            <>
              <input
                className={`input-perfil-editable ${mensaje ? 'input-error' : ''}`}
                value={valoresPersonales[id] ?? ''}
                onChange={(evento) => setValorPersonal(id, evento.target.value)}
                disabled={guardando}
                autoComplete="off"
              />
              <MensajeError>{mensaje}</MensajeError>
            </>
          ) : (
            <p className="campo-perfil-valor">{valorPara(id) || '—'}</p>
          )}
        </div>
      </div>
    );
  };

  const guardarPersonales = async (evento) => {
    evento.preventDefault();
    if (!esAdministrador || !datos || !hayCambios) {
      return;
    }

    const nuevosErrores = {};
    camposEditables.forEach(({ id }) => {
      const mensaje = VALIDACIONES[id]?.(valoresPersonales[id] ?? '') ?? '';
      if (mensaje) {
        nuevosErrores[id] = mensaje;
      }
    });
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Revisá los campos',
        text: 'Corregí los datos marcados antes de guardar.',
      });
      return;
    }

    setGuardando(true);
    try {
      const cuerpo = { email: (valoresPersonales.email ?? '').trim() };
      if (datos.empleado) {
        cuerpo.empleado = {
          nombre: (valoresPersonales.nombre ?? '').trim(),
          apellido: (valoresPersonales.apellido ?? '').trim(),
          dni: datos.empleado.dni,
          telefono: (valoresPersonales.telefono ?? '').trim() || null,
        };
      }
      await pedir(`/usuarios/${datos.id}/`, {
        method: 'PATCH',
        body: cuerpo,
      });
      await cargar();
      Swal.fire({
        icon: 'success',
        title: 'Perfil actualizado',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      if (err?.campos) {
        setErrores((actuales) => ({ ...actuales, ...err.campos }));
      }
      Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar',
        text: err?.message || 'Intentá nuevamente.',
      });
    } finally {
      setGuardando(false);
    }
  };

  const abrirModalPassword = () => {
    setClavesPassword({ password_admin: '', password: '', password2: '' });
    setErroresPassword({});
    setModalPassword(true);
  };

  const cerrarModalPassword = () => {
    setModalPassword(false);
    setErroresPassword({});
  };

  const setClavePassword = (id, valor) => {
    setClavesPassword((actuales) => ({ ...actuales, [id]: valor }));
    setErroresPassword((actuales) => ({ ...actuales, [id]: '' }));
  };

  const cambiarPassword = async (evento) => {
    evento.preventDefault();
    if (!datos?.empleado) {
      return;
    }
    const nuevosErrores = {};
    if (!clavesPassword.password_admin) {
      nuevosErrores.password_admin = 'Ingresá tu contraseña actual.';
    }
    if (clavesPassword.password.length < 8) {
      nuevosErrores.password = 'La contraseña debe tener al menos 8 caracteres.';
    }
    if (clavesPassword.password !== clavesPassword.password2) {
      nuevosErrores.password2 = 'Las contraseñas no coinciden.';
    }
    setErroresPassword(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) {
      return;
    }

    setGuardandoPassword(true);
    try {
      await pedir(`/empleados/${datos.empleado.id}/cambiar-password/`, {
        method: 'POST',
        body: {
          password_admin: clavesPassword.password_admin,
          password: clavesPassword.password,
          password2: clavesPassword.password2,
        },
      });
      cerrarModalPassword();
      Swal.fire({
        icon: 'success',
        title: 'Contraseña actualizada',
        text: 'Se cerraron tus sesiones activas.',
      });
    } catch (err) {
      const detalles = err?.campos ?? {};
      setErroresPassword({
        ...detalles,
        password_admin: detalles.password_admin ?? detalles.password_actual ?? '',
      });
    } finally {
      setGuardandoPassword(false);
    }
  };

  if (cargando && !cargo) {
    return (
      <main className="contenido-modulo">
        <Encabezado titulo="Perfil" subtitulo="Datos de tu cuenta" />
        <div className="perfil-cargando">
          <IconLoader2 className="icono-girando" size={28} />
          <span>Cargando perfil…</span>
        </div>
      </main>
    );
  }

  if (error && !cargo) {
    return (
      <main className="contenido-modulo">
        <Encabezado titulo="Perfil" subtitulo="Datos de tu cuenta" />
        <div className="perfil-error">
          <span>{error}</span>
          <button type="button" className="boton-secundario-perfil" onClick={cargar}>
            Reintentar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="contenido-modulo">
      <Encabezado titulo="Perfil" subtitulo="Datos de tu cuenta" />
      <section className="seccion-perfil-principal">
        <div className="tarjeta-perfil-cabecera">
          <div className="avatar-perfil-contenedor">
            {nombreCompleto ? (
              <span className="avatar-perfil-iniciales">
                {iniciales(nombreCompleto)}
              </span>
            ) : (
              <IconUser size={38} stroke={1.8} />
            )}
          </div>
          <div className="info-perfil-cabecera">
            <h2 className="nombre-perfil">{nombreCompleto || datos?.username}</h2>
            <div className="rol-perfil-badge">
              <IconShieldCheck size={16} stroke={1.9} />
              {esAdministrador ? 'Administrador' : nombreRol || 'Sin rol'}
            </div>
          </div>
          <div className="estado-perfil-contenedor">
            <span className="label-estado">Estado</span>
            <div className={`badge-estado-perfil ${activo ? '' : 'inactivo'}`}>
              <span className="punto-estado" />
              {activo ? 'Activo' : 'Inactivo'}
            </div>
          </div>
        </div>

        <form className="formulario-perfil" onSubmit={guardarPersonales}>
          <div className="grid-datos-perfil">
            {camposEditables.map((campo) => renderCampo(campo, true))}
            {CAMPOS_SOLO_LECTURA.map((campo) => renderCampo(campo, false))}
          </div>

          <div className="contenedor-boton-guardar-perfil">
            {esAdministrador ? (
              <>
                <button
                  type="submit"
                  className="boton-guardar-perfil"
                  disabled={!hayCambios || guardando}
                >
                  <IconDeviceFloppy size={18} stroke={1.9} />
                  {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
                {datos?.empleado && (
                  <button
                    type="button"
                    className="boton-cambiar-pass"
                    onClick={abrirModalPassword}
                  >
                    <IconKey size={18} stroke={1.9} />
                    Cambiar contraseña
                  </button>
                )}
                {!hayCambios && !guardando && (
                  <span className="panel-actualizando">Sin cambios pendientes</span>
                )}
              </>
            ) : (
              <span className="aviso-lectura-perfil">
                Solo un administrador puede modificar estos datos.
              </span>
            )}
            {guardando && (
              <span className="panel-actualizando">
                <IconLoader2 className="icono-girando" size={15} />
                Guardando…
              </span>
            )}
          </div>
        </form>
      </section>

      {modalPassword && (
        <div className="modal-datos-fondo">
          <div className="modal-datos" role="dialog" aria-modal="true">
            <div className="modal-datos-cabecera">
              <h2>
                <IconKey size={20} stroke={1.9} />
                Cambiar contraseña
              </h2>
              <button
                type="button"
                className="modal-datos-cerrar"
                onClick={cerrarModalPassword}
                aria-label="Cerrar"
              >
                <IconX size={18} stroke={2} />
              </button>
            </div>
            <form onSubmit={cambiarPassword}>
              <div className="modal-datos-grid">
                <div className="campo-modal-datos">
                  <span>Contraseña actual</span>
                  <input
                    type="password"
                    value={clavesPassword.password_admin}
                    onChange={(evento) =>
                      setClavePassword('password_admin', evento.target.value)
                    }
                    autoComplete="current-password"
                  />
                  <MensajeError>{erroresPassword.password_admin}</MensajeError>
                </div>
                <div className="campo-modal-datos">
                  <span>Nueva contraseña</span>
                  <input
                    type="password"
                    value={clavesPassword.password}
                    onChange={(evento) =>
                      setClavePassword('password', evento.target.value)
                    }
                    autoComplete="new-password"
                  />
                  <MensajeError>{erroresPassword.password}</MensajeError>
                </div>
                <div className="campo-modal-datos">
                  <span>Repetir contraseña</span>
                  <input
                    type="password"
                    value={clavesPassword.password2}
                    onChange={(evento) =>
                      setClavePassword('password2', evento.target.value)
                    }
                    autoComplete="new-password"
                  />
                  <MensajeError>{erroresPassword.password2}</MensajeError>
                </div>
              </div>
              <p className="nota-perfil">
                Se cerrarán tus sesiones activas después del cambio.
              </p>
              <div className="modal-datos-acciones">
                <button
                  type="button"
                  className="boton-secundario-perfil"
                  onClick={cerrarModalPassword}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="boton-guardar-perfil"
                  disabled={guardandoPassword}
                >
                  <IconLock size={17} stroke={1.9} />
                  {guardandoPassword ? 'Guardando…' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default Perfil;
