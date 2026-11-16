/* ============================================================
   db.js · Capa de datos local
   Simula la base de datos local del plan de pruebas (CP 017-019).
   Se crea sola la primera vez y los datos persisten al cerrar el
   navegador (localStorage).
   ============================================================ */
const DB = (() => {
  const KEY = 'sirus_db_v1';
  let data = null;
  let soloMemoria = false; // true si el navegador bloquea el almacenamiento

  function estructuraInicial() {
    return {
      version: 1,
      creadaEn: new Date().toISOString(),
      siguienteId: 1,
      usuarios: [{ usuario: 'admin_Sirus2026', clave: 'Sir.2026-2', rol: 'Administrador del Sistema' }],
      visitantes: []
    };
  }

  function guardar() {
    if (soloMemoria) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      soloMemoria = true;
      console.error('No se pudo guardar en el almacenamiento local:', e);
    }
  }

  /** Abre la BD; si no existe la crea. Devuelve { creada, soloMemoria }. */
  function iniciar() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        data = JSON.parse(raw);
        // Asegurar actualización de credenciales por defecto si existía el usuario anterior
        if (!Array.isArray(data.usuarios)) data.usuarios = [];
        const idx = data.usuarios.findIndex(u => u.usuario === 'admin' || u.usuario === 'admin_Sirus2026');
        if (idx >= 0) {
          data.usuarios[idx] = { usuario: 'admin_Sirus2026', clave: 'Sir.2026-2', rol: 'Administrador del Sistema' };
        } else {
          data.usuarios.push({ usuario: 'admin_Sirus2026', clave: 'Sir.2026-2', rol: 'Administrador del Sistema' });
        }
        guardar();
        return { creada: false, soloMemoria };
      }
    } catch (e) {
      console.error('BD ilegible, se crea una nueva:', e);
    }
    data = estructuraInicial();
    guardar();
    return { creada: true, soloMemoria };
  }

  function reiniciar() {
    try { localStorage.removeItem(KEY); } catch (e) { /* sin acción */ }
    return iniciar();
  }

  const copia = (o) => (o ? JSON.parse(JSON.stringify(o)) : null);

  return {
    iniciar,
    reiniciar,
    estaEnMemoria: () => soloMemoria,

    buscarUsuario: (usuario) => copia(data.usuarios.find(u => u.usuario === usuario)),

    listarVisitantes: () =>
      copia(data.visitantes).sort((a, b) => b.ingreso.localeCompare(a.ingreso)),
    totalVisitantes: () => data.visitantes.length,
    obtenerVisitante: (id) => copia(data.visitantes.find(v => v.id === id)),

    buscarPorDocumento(documento, excluirId = null) {
      const d = String(documento).trim().toLowerCase();
      return copia(data.visitantes.find(v => v.id !== excluirId && v.documento.toLowerCase() === d));
    },

    agregarVisitante(v) {
      const nuevo = { ...v, id: data.siguienteId++ };
      data.visitantes.push(nuevo);
      guardar();
      return copia(nuevo);
    },

    actualizarVisitante(id, cambios) {
      const v = data.visitantes.find(x => x.id === id);
      if (!v) return null;
      Object.assign(v, cambios);
      guardar();
      return copia(v);
    }
  };
})();
