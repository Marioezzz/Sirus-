/* ============================================================
   auth.js · Autenticación (SIRUS-001 · CP 001-004, CP 028)
   La sesión vive solo en memoria: al recargar o cerrar la
   aplicación siempre se vuelve a pedir inicio de sesión.
   ============================================================ */
const Auth = (() => {
  let sesion = null;

  function iniciarSesion(usuario, clave) {
    usuario = (usuario || '').trim();
    clave = clave || '';

    // Escenario 4: campos vacíos
    if (!usuario || !clave) {
      return { ok: false, message: 'Por favor complete los campos obligatorios: usuario y contraseña.' };
    }
    // Escenario 2: usuario inexistente
    const u = DB.buscarUsuario(usuario);
    if (!u) {
      return { ok: false, message: 'Credenciales no válidas: el usuario no existe.' };
    }
    // Escenario 3: clave incorrecta
    if (u.clave !== clave) {
      return { ok: false, message: 'Contraseña incorrecta. Las credenciales no son válidas.' };
    }
    // Escenario 1: correcto
    sesion = { usuario: u.usuario, rol: u.rol };
    return { ok: true, usuario: sesion };
  }

  return {
    iniciarSesion,
    cerrarSesion: () => { sesion = null; },
    estaAutenticado: () => sesion !== null,
    usuarioActual: () => sesion
  };
})();
