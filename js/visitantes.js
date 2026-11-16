/* ============================================================
   visitantes.js · Lógica de negocio (SIRUS-002 a SIRUS-005)
   Registrar, buscar, actualizar, registrar ingreso y salida.
   ============================================================ */
const Visitantes = (() => {

  const CAMPOS = [
    { key: 'nombre',         label: 'Nombre completo' },
    { key: 'documento',      label: 'Documento' },
    { key: 'motivo',         label: 'Motivo de la visita' },
    { key: 'personaVisitar', label: 'Persona a visitar' },
    { key: 'destino',        label: 'Piso u oficina' }
  ];

  const MOTIVOS_ESTANDAR = [
    'Visita personal',
    'Entrega de domicilio',
    'Servicio técnico',
    'Visita inmobiliaria'
  ];

  const TORRES_RESIDENCIALES = ['Torre 1', 'Torre 2', 'Torre 3', 'Torre 4'];

  // Letras (con tildes, ñ, ü), espacios, punto, apóstrofe y guion
  const RE_NOMBRE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;
  // Documento estrictamente numérico (3 a 15 dígitos)
  const RE_DOCUMENTO = /^\d{3,15}$/;

  const SIN_SESION = { ok: false, message: 'Debe iniciar sesión para usar esta función.', errores: {} };

  const normalizar = (s) =>
    String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

  function limpiar(datos) {
    const motivoSel = String(datos.motivo ?? '').trim();
    const motivoOtro = String(datos.motivoOtro ?? '').trim();
    let motivoFinal = motivoSel;

    if (motivoSel === 'Otro motivo') {
      motivoFinal = motivoOtro ? 'Otro: ' + motivoOtro : '';
    }

    const torre = String(datos.torre ?? '').trim();
    const piso = String(datos.piso ?? '').trim();
    const apartamento = String(datos.apartamento ?? '').trim();
    let destinoFinal = '';

    if (TORRES_RESIDENCIALES.includes(torre)) {
      if (piso && apartamento) {
        destinoFinal = `${torre} - Piso ${piso} - ${apartamento}`;
      }
    } else if (torre === 'Torre administrativa') {
      destinoFinal = 'Torre administrativa';
    } else if (torre) {
      // Compatibilidad con registros antiguos en texto libre
      destinoFinal = torre;
    }

    return {
      nombre: String(datos.nombre ?? '').trim(),
      documento: String(datos.documento ?? '').trim(),
      motivo: motivoFinal,
      motivoSel,
      motivoOtro,
      personaVisitar: String(datos.personaVisitar ?? '').trim(),
      torre,
      piso,
      apartamento,
      destino: destinoFinal
    };
  }

  function validar(d, excluirId = null) {
    const errores = {};
    const faltan = [];

    // 1. Nombre completo
    if (!d.nombre) {
      faltan.push('Nombre completo');
      errores.nombre = 'Ingrese el nombre completo.';
    } else if (!RE_NOMBRE.test(d.nombre)) {
      errores.nombre = 'Solo se permiten letras, espacios, tildes, punto, apóstrofe o guion.';
    }

    // 2. Documento (permite escribir letras en UI, pero valida solo números al registrar)
    if (!d.documento) {
      faltan.push('Documento');
      errores.documento = 'Ingrese el número de documento.';
    } else if (/\D/.test(d.documento)) {
      errores.documento = 'Solo se pueden ingresar números.';
    } else if (!RE_DOCUMENTO.test(d.documento)) {
      errores.documento = 'El documento debe tener entre 3 y 15 dígitos.';
    }

    // 3. Motivo de la visita (y campo condicional "Otro motivo")
    if (d.motivoSel === 'Otro motivo') {
      if (!d.motivoOtro) {
        faltan.push('Especifique el motivo');
        errores.motivoOtro = 'Escriba el motivo de la visita.';
      }
    } else if (!d.motivo) {
      faltan.push('Motivo de la visita');
      errores.motivo = 'Seleccione un motivo de la visita.';
    }

    // 4. Persona a visitar
    if (!d.personaVisitar) {
      faltan.push('Persona a visitar');
      errores.personaVisitar = 'Ingrese la persona a visitar.';
    }

    // 5. Piso u oficina (Torre, Piso y Apartamento)
    if (!d.torre) {
      faltan.push('Piso u oficina (Torre)');
      errores.torre = 'Seleccione una torre o Torre administrativa.';
    } else if (TORRES_RESIDENCIALES.includes(d.torre)) {
      if (!d.piso) {
        faltan.push('Piso');
        errores.piso = 'Seleccione el piso.';
      }
      if (!d.apartamento) {
        faltan.push('Apartamento');
        errores.apartamento = 'Seleccione el apartamento.';
      }
    }

    if (Object.keys(errores).length > 0) {
      const partesMsg = [];
      if (faltan.length) {
        partesMsg.push('Complete los campos obligatorios: ' + faltan.join(', ') + '.');
      }
      if (errores.documento === 'Solo se pueden ingresar números.') {
        partesMsg.push('En Documento solo se pueden ingresar números.');
      } else if (!faltan.length) {
        partesMsg.push('Revise los campos resaltados en rojo antes de continuar.');
      }
      return { ok: false, message: partesMsg.join(' '), errores };
    }

    const dup = DB.buscarPorDocumento(d.documento, excluirId);
    if (dup) {
      const extra = dup.salida
        ? ' Este visitante ya registró salida; selecciónelo en la tabla y presione "Registrar ingreso".'
        : '';
      errores.documento = 'Este documento ya se encuentra registrado.';
      return {
        ok: false,
        message: 'El visitante ya existe: el documento ' + d.documento + ' ya está registrado a nombre de ' + dup.nombre + '.' + extra,
        errores
      };
    }

    return { ok: true, errores: {} };
  }

  function extraerDatosPersistentes(d) {
    return {
      nombre: d.nombre,
      documento: d.documento,
      motivo: d.motivo,
      personaVisitar: d.personaVisitar,
      destino: d.destino
    };
  }

  /** SIRUS-002 · CP 006-009, 020, 024, 026, 027 */
  function registrar(datos) {
    if (!Auth.estaAutenticado()) return SIN_SESION;
    const d = limpiar(datos);
    const v = validar(d);
    if (!v.ok) return v;
    const visitante = DB.agregarVisitante({
      ...extraerDatosPersistentes(d),
      ingreso: new Date().toISOString(),
      salida: null
    });
    return { ok: true, visitante, message: 'Visitante registrado correctamente.' };
  }

  /** SIRUS-003 · CP 010-012, 021 */
  function buscar(texto) {
    if (!Auth.estaAutenticado()) return SIN_SESION;
    const q = normalizar(texto);
    if (!q) {
      return { ok: false, message: 'Ingrese un nombre o documento para realizar la consulta.' };
    }
    const resultados = DB.listarVisitantes().filter(v =>
      normalizar(v.nombre).includes(q) ||
      normalizar(v.documento).includes(q) ||
      normalizar(v.motivo).includes(q) ||
      normalizar(v.destino).includes(q)
    );
    if (!resultados.length) {
      return { ok: true, resultados, message: 'No se encontraron visitantes con los datos ingresados.' };
    }
    return { ok: true, resultados, message: resultados.length + ' visitante(s) encontrado(s).' };
  }

  /** SIRUS-004 · CP 013, 014, 022 */
  function actualizar(id, datos) {
    if (!Auth.estaAutenticado()) return SIN_SESION;
    if (id === null || !DB.obtenerVisitante(id)) {
      return { ok: false, message: 'Debe seleccionar o buscar un visitante antes de actualizar.', errores: {} };
    }
    const d = limpiar(datos);
    const v = validar(d, id);
    if (!v.ok) return v;
    const visitante = DB.actualizarVisitante(id, extraerDatosPersistentes(d));
    return { ok: true, visitante, message: 'Datos actualizados correctamente.' };
  }

  /** Reingreso de visitante que ya registró salida */
  function registrarIngreso(id, datosFormulario = null) {
    if (!Auth.estaAutenticado()) return SIN_SESION;
    if (id === null) {
      return { ok: false, message: 'Seleccione un visitante de la lista para registrar su ingreso.', errores: {} };
    }
    const actual = DB.obtenerVisitante(id);
    if (!actual) return { ok: false, message: 'El visitante seleccionado ya no existe.', errores: {} };
    if (!actual.salida) {
      return { ok: false, message: actual.nombre + ' ya se encuentra en sitio (ingresó el ' + formatearFecha(actual.ingreso) + ').', errores: {} };
    }

    let cambios = {
      ingreso: new Date().toISOString(),
      salida: null
    };

    if (datosFormulario) {
      const d = limpiar(datosFormulario);
      const val = validar(d, id);
      if (!val.ok) return val;
      cambios = { ...extraerDatosPersistentes(d), ...cambios };
    }

    const visitante = DB.actualizarVisitante(id, cambios);
    return { ok: true, visitante, message: 'Ingreso registrado: ' + formatearFecha(visitante.ingreso) + '.' };
  }

  /** SIRUS-005 · CP 015, 016, 023, 027 */
  function registrarSalida(id) {
    if (!Auth.estaAutenticado()) return SIN_SESION;
    if (id === null) {
      return { ok: false, message: 'Seleccione un visitante de la lista para registrar la salida.' };
    }
    const v = DB.obtenerVisitante(id);
    if (!v) return { ok: false, message: 'El visitante seleccionado ya no existe.' };
    if (v.salida) {
      return { ok: false, message: v.nombre + ' ya registró su salida el ' + formatearFecha(v.salida) + '.' };
    }
    const visitante = DB.actualizarVisitante(id, { salida: new Date().toISOString() });
    return { ok: true, visitante, message: 'Salida registrada: ' + formatearFecha(visitante.salida) + '.' };
  }

  function listar() {
    return Auth.estaAutenticado() ? DB.listarVisitantes() : [];
  }

  /** dd/mm/aaaa hh:mm (sin segundos) */
  function formatearFecha(iso) {
    if (!iso) return '—';
    const f = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(f.getDate())}/${p(f.getMonth() + 1)}/${f.getFullYear()} ${p(f.getHours())}:${p(f.getMinutes())}`;
  }

  return {
    CAMPOS,
    MOTIVOS_ESTANDAR,
    TORRES_RESIDENCIALES,
    registrar,
    buscar,
    actualizar,
    registrarIngreso,
    registrarSalida,
    listar,
    obtener: DB.obtenerVisitante,
    formatearFecha
  };
})();
