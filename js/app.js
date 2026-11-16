/* ============================================================
   app.js · Interfaz: conecta la pantalla con la lógica
   (CP 005, 020-023, 025, 029, 030)
   ============================================================ */
(() => {
  const $ = (id) => document.getElementById(id);
  let seleccionadoId = null;   // visitante seleccionado en la tabla
  let filtroActivo = '';       // texto de la última búsqueda exitosa

  const MAPA_CONTROLES = {
    nombre:         { input: 'f-nombre',         err: 'err-nombre' },
    documento:      { input: 'f-documento',      err: 'err-documento' },
    motivo:         { input: 'f-motivo',         err: 'err-motivo' },
    motivoOtro:     { input: 'f-motivo-otro',    err: 'err-motivo-otro' },
    personaVisitar: { input: 'f-personaVisitar', err: 'err-personaVisitar' },
    torre:          { input: 'f-torre',          err: 'err-torre' },
    piso:           { input: 'f-piso',           err: 'err-piso' },
    apartamento:    { input: 'f-apartamento',    err: 'err-apartamento' }
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Mensajes ---------- */
  function mostrar(el, texto, tipo) {
    el.textContent = texto;
    el.className = 'mensaje ' + (tipo || 'info');
    el.hidden = false;
  }
  const msg = (texto, tipo) => mostrar($('mensaje'), texto, tipo);
  const ocultarConfirmacion = () => { $('confirmacion').hidden = true; };

  /* ---------- Errores visuales por casilla ---------- */
  function setErrorCampo(clave, mensaje) {
    const cfg = MAPA_CONTROLES[clave];
    if (!cfg) return;
    const inputEl = $(cfg.input);
    const errEl = $(cfg.err);
    if (mensaje) {
      inputEl.classList.add('campo-error');
      errEl.textContent = mensaje;
      errEl.hidden = false;
    } else {
      inputEl.classList.remove('campo-error');
      errEl.textContent = '';
      errEl.hidden = true;
    }
  }

  function limpiarErroresCampos() {
    Object.keys(MAPA_CONTROLES).forEach(k => setErrorCampo(k, ''));
  }

  function aplicarErroresCampos(errores) {
    limpiarErroresCampos();
    if (!errores) return;
    const claves = Object.keys(errores);
    claves.forEach(k => setErrorCampo(k, errores[k]));
    if (claves.length && MAPA_CONTROLES[claves[0]]) {
      $(MAPA_CONTROLES[claves[0]].input).focus();
    }
  }

  /* ---------- Base de datos ---------- */
  const estadoBD = DB.iniciar();
  function actualizarChipBD() {
    $('estado-bd-texto').textContent = 'Base de datos · ' + DB.totalVisitantes() + ' registro(s)';
  }

  /* ---------- Vistas ---------- */
  function mostrarLogin(mensajeInicial, tipo) {
    $('vista-panel').hidden = true;
    $('vista-login').hidden = false;
    document.body.classList.remove('en-panel');
    $('login-usuario').value = '';
    $('login-clave').value = '';
    if (mensajeInicial) mostrar($('login-mensaje'), mensajeInicial, tipo);
    else $('login-mensaje').hidden = true;
    $('login-usuario').focus();
  }

  function mostrarPanel() {
    if (!Auth.estaAutenticado()) { mostrarLogin(); return; } // CP 028
    const u = Auth.usuarioActual();
    $('vista-login').hidden = true;
    $('vista-panel').hidden = false;
    $('nombre-usuario').textContent = u.usuario;
    $('rol-usuario').textContent = u.rol;
    $('avatar-usuario').textContent = u.usuario.charAt(0).toUpperCase();
    const f = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('fecha-hoy').textContent = f.charAt(0).toUpperCase() + f.slice(1);
    document.body.classList.add('en-panel');
    $('mensaje').hidden = true;
    limpiarFormulario();
    $('f-buscar').value = '';
    filtroActivo = '';
    refrescar();
    $('f-nombre').focus();
  }

  /* ---------- Controles condicionales (Motivo y Torre/Piso/Apartamento) ---------- */
  function actualizarVisibilidadMotivoOtro(enfocar = false) {
    const esOtro = $('f-motivo').value === 'Otro motivo';
    $('campo-motivo-otro').hidden = !esOtro;
    if (!esOtro) {
      $('f-motivo-otro').value = '';
      setErrorCampo('motivoOtro', '');
    } else if (enfocar) {
      $('f-motivo-otro').focus();
    }
  }

  function poblarApartamentosPorPiso(pisoStr) {
    const selApt = $('f-apartamento');
    const piso = Number(pisoStr);
    selApt.innerHTML = '';

    if (!piso || piso < 1 || piso > 8) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Seleccione primero el piso...';
      selApt.appendChild(opt);
      selApt.disabled = true;
      return;
    }

    const optDefault = document.createElement('option');
    optDefault.value = '';
    optDefault.textContent = 'Seleccione apartamento...';
    selApt.appendChild(optDefault);

    // 6 apartamentos por piso: Apt 101..106, Apt 201..206, ..., Apt 801..806
    for (let i = 1; i <= 6; i++) {
      const numeroApt = `${piso}0${i}`;
      const etiqueta = `Apt ${numeroApt}`;
      const opt = document.createElement('option');
      opt.value = etiqueta;
      opt.textContent = etiqueta;
      selApt.appendChild(opt);
    }
    selApt.disabled = false;
  }

  function actualizarVisibilidadUbicacion(enfocar = false) {
    const torre = $('f-torre').value;
    const esTorreResidencial = Visitantes.TORRES_RESIDENCIALES.includes(torre);

    $('panel-ubicacion-torre').hidden = !esTorreResidencial;

    if (!esTorreResidencial) {
      $('f-piso').value = '';
      poblarApartamentosPorPiso('');
      setErrorCampo('piso', '');
      setErrorCampo('apartamento', '');
    } else if (enfocar) {
      $('f-piso').focus();
    }
  }

  function limpiarOpcionesLegado() {
    Array.from($('f-motivo').querySelectorAll('option[data-legado="1"]')).forEach(opt => opt.remove());
    Array.from($('f-torre').querySelectorAll('option[data-legado="1"]')).forEach(opt => opt.remove());
  }

  /* ---------- Formulario ---------- */
  function leerFormulario() {
    return {
      nombre: $('f-nombre').value,
      documento: $('f-documento').value,
      motivo: $('f-motivo').value,
      motivoOtro: $('f-motivo-otro').value,
      personaVisitar: $('f-personaVisitar').value,
      torre: $('f-torre').value,
      piso: $('f-piso').value,
      apartamento: $('f-apartamento').value
    };
  }

  function limpiarFormulario() {
    limpiarOpcionesLegado();
    $('f-nombre').value = '';
    $('f-documento').value = '';
    $('f-motivo').value = '';
    $('f-motivo-otro').value = '';
    $('campo-motivo-otro').hidden = true;
    $('f-personaVisitar').value = '';
    $('f-torre').value = '';
    $('f-piso').value = '';
    poblarApartamentosPorPiso('');
    $('panel-ubicacion-torre').hidden = true;
    limpiarErroresCampos();
    seleccionadoId = null;
    $('modo-edicion').hidden = true;
    $('titulo-form').textContent = 'Datos del visitante';
    marcarFila();
  }

  function cargarEnFormulario(v) {
    limpiarOpcionesLegado();
    limpiarErroresCampos();
    $('f-nombre').value = v.nombre || '';
    $('f-documento').value = v.documento || '';
    $('f-personaVisitar').value = v.personaVisitar || '';

    // 1. Cargar motivo
    const motivoGuardado = (v.motivo || '').trim();
    if (Visitantes.MOTIVOS_ESTANDAR.includes(motivoGuardado)) {
      $('f-motivo').value = motivoGuardado;
      $('f-motivo-otro').value = '';
      $('campo-motivo-otro').hidden = true;
    } else if (motivoGuardado) {
      $('f-motivo').value = 'Otro motivo';
      $('f-motivo-otro').value = motivoGuardado.replace(/^Otro:\s*/i, '');
      $('campo-motivo-otro').hidden = false;
    } else {
      $('f-motivo').value = '';
      $('f-motivo-otro').value = '';
      $('campo-motivo-otro').hidden = true;
    }

    // 2. Cargar ubicación (Torre / Piso / Apartamento o Torre administrativa)
    const destinoGuardado = (v.destino || '').trim();
    const matchTorre = destinoGuardado.match(/^(Torre [1-4])\s*-\s*Piso ([1-8])\s*-\s*(Apt [1-8]0[1-6])$/i);

    if (matchTorre) {
      const torreNorm = 'Torre ' + matchTorre[1].slice(-1);
      const pisoNorm = matchTorre[2];
      const aptNorm = 'Apt ' + matchTorre[3].slice(-3);

      $('f-torre').value = torreNorm;
      $('panel-ubicacion-torre').hidden = false;
      $('f-piso').value = pisoNorm;
      poblarApartamentosPorPiso(pisoNorm);
      $('f-apartamento').value = aptNorm;
    } else if (/^Torre administrativa/i.test(destinoGuardado)) {
      $('f-torre').value = 'Torre administrativa';
      $('panel-ubicacion-torre').hidden = true;
      $('f-piso').value = '';
      poblarApartamentosPorPiso('');
    } else if (destinoGuardado) {
      // Registro previo en texto libre
      const opt = document.createElement('option');
      opt.value = destinoGuardado;
      opt.textContent = destinoGuardado;
      opt.dataset.legado = '1';
      $('f-torre').appendChild(opt);
      $('f-torre').value = destinoGuardado;
      $('panel-ubicacion-torre').hidden = true;
    } else {
      $('f-torre').value = '';
      $('panel-ubicacion-torre').hidden = true;
    }

    const accionSugerida = v.salida
      ? 'Estado actual: Salió. Presione "Registrar ingreso" para marcar una nueva entrada o "Actualizar" para editar sus datos.'
      : 'Estado actual: En sitio. Modifique los datos y presione "Actualizar", o presione "Registrar salida".';
    $('modo-edicion').textContent = 'Visitante seleccionado: ' + v.nombre + '. ' + accionSugerida;
    $('modo-edicion').hidden = false;
    $('titulo-form').textContent = 'Editar visitante';
  }

  /* ---------- Tabla ---------- */
  const iniciales = (n) => n.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0)).join('').toUpperCase();

  function actualizarResumen() {
    const todos = Visitantes.listar();
    const hoy = new Date().toDateString();
    $('stat-total').textContent = todos.length;
    $('stat-dentro').textContent = todos.filter(v => !v.salida).length;
    $('stat-salieron').textContent = todos.filter(v => v.salida).length;
    $('stat-hoy').textContent = todos.filter(v => new Date(v.ingreso).toDateString() === hoy).length;
  }

  function filaHTML(v) {
    const dentro = !v.salida;
    return `<tr data-id="${v.id}">
      <td><div class="celda-nombre"><span class="ini">${esc(iniciales(v.nombre))}</span>${esc(v.nombre)}</div></td>
      <td>${esc(v.documento)}</td>
      <td>${esc(v.motivo || v.empresa || '—')}</td>
      <td>${esc(v.personaVisitar)}</td>
      <td>${esc(v.destino)}</td>
      <td>${Visitantes.formatearFecha(v.ingreso)}</td>
      <td>${Visitantes.formatearFecha(v.salida)}</td>
      <td><span class="estado ${dentro ? 'dentro' : 'salio'}">${dentro ? 'En sitio' : 'Salió'}</span></td>
    </tr>`;
  }

  function dibujarTabla(lista, vacio) {
    $('tbody').innerHTML = lista.length
      ? lista.map(filaHTML).join('')
      : `<tr><td colspan="8" class="vacio">${esc(vacio || 'No hay visitantes registrados.')}</td></tr>`;
    marcarFila();
    actualizarChipBD();
    actualizarResumen();
    $('contador').textContent = lista.length + ' de ' + DB.totalVisitantes() + ' registros';
  }

  function marcarFila() {
    document.querySelectorAll('#tbody tr[data-id]').forEach(tr => {
      tr.classList.toggle('seleccionada', Number(tr.dataset.id) === seleccionadoId);
    });
  }

  /** Vuelve a pintar la lista respetando la búsqueda activa */
  function refrescar() {
    if (filtroActivo) {
      const r = Visitantes.buscar(filtroActivo);
      dibujarTabla(r.resultados || [], r.message);
    } else {
      dibujarTabla(Visitantes.listar());
    }
  }

  /* ---------- Acciones ---------- */
  function onRegistrar() {
    ocultarConfirmacion();
    const r = Visitantes.registrar(leerFormulario());
    if (!r.ok) {
      aplicarErroresCampos(r.errores);
      msg(r.message, 'error');
      return;
    }

    const v = r.visitante;
    msg(r.message, 'ok');
    $('confirmacion').innerHTML = `<strong>Registro guardado</strong>
      <dl>
        <dt>Nombre</dt><dd>${esc(v.nombre)}</dd>
        <dt>Documento</dt><dd>${esc(v.documento)}</dd>
        <dt>Motivo</dt><dd>${esc(v.motivo)}</dd>
        <dt>Visita a</dt><dd>${esc(v.personaVisitar)}</dd>
        <dt>Piso/Oficina</dt><dd>${esc(v.destino)}</dd>
        <dt>Ingreso</dt><dd>${Visitantes.formatearFecha(v.ingreso)}</dd>
      </dl>`;
    $('confirmacion').hidden = false;

    limpiarFormulario();           // CP 024
    $('f-buscar').value = '';
    filtroActivo = '';
    refrescar();
    $('f-nombre').focus();
  }

  function onBuscar() {
    ocultarConfirmacion();
    const texto = $('f-buscar').value;
    const r = Visitantes.buscar(texto);
    if (!r.ok) { msg(r.message, 'aviso'); return; }
    filtroActivo = texto;
    dibujarTabla(r.resultados, r.message);
    msg(r.message, r.resultados.length ? 'ok' : 'aviso');
  }

  function onVerTodos() {
    ocultarConfirmacion();
    $('f-buscar').value = '';
    filtroActivo = '';
    refrescar();
    $('mensaje').hidden = true;
  }

  function onActualizar() {
    ocultarConfirmacion();
    const r = Visitantes.actualizar(seleccionadoId, leerFormulario());
    if (!r.ok) {
      aplicarErroresCampos(r.errores);
      msg(r.message, 'error');
      return;
    }
    msg(r.message + ' (' + r.visitante.nombre + ')', 'ok');
    limpiarFormulario();
    refrescar();
  }

  function onIngreso() {
    ocultarConfirmacion();
    const r = Visitantes.registrarIngreso(seleccionadoId, leerFormulario());
    if (!r.ok) {
      aplicarErroresCampos(r.errores);
      msg(r.message, 'error');
      return;
    }

    const v = r.visitante;
    msg(v.nombre + ' · ' + r.message, 'ok');
    $('confirmacion').innerHTML = `<strong>Nuevo ingreso registrado</strong>
      <dl>
        <dt>Nombre</dt><dd>${esc(v.nombre)}</dd>
        <dt>Documento</dt><dd>${esc(v.documento)}</dd>
        <dt>Motivo</dt><dd>${esc(v.motivo)}</dd>
        <dt>Visita a</dt><dd>${esc(v.personaVisitar)}</dd>
        <dt>Piso/Oficina</dt><dd>${esc(v.destino)}</dd>
        <dt>Nuevo ingreso</dt><dd>${Visitantes.formatearFecha(v.ingreso)}</dd>
      </dl>`;
    $('confirmacion').hidden = false;

    limpiarFormulario();
    refrescar();
  }

  function onSalida() {
    ocultarConfirmacion();
    const r = Visitantes.registrarSalida(seleccionadoId);
    if (!r.ok) { msg(r.message, 'error'); return; }
    msg(r.visitante.nombre + ' · ' + r.message, 'ok');
    limpiarFormulario();
    refrescar();
  }

  function onLimpiar() {
    limpiarFormulario();
    ocultarConfirmacion();
    $('mensaje').hidden = true;
    $('f-nombre').focus();
  }

  function onSeleccionar(e) {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const v = Visitantes.obtener(Number(tr.dataset.id));
    if (!v) return;
    seleccionadoId = v.id;
    cargarEnFormulario(v);
    marcarFila();
    ocultarConfirmacion();
    $('mensaje').hidden = true;
  }

  /* ---------- Sesión ---------- */
  function onLogin(e) {
    e.preventDefault();
    const r = Auth.iniciarSesion($('login-usuario').value, $('login-clave').value);
    if (!r.ok) { mostrar($('login-mensaje'), r.message, 'error'); return; }
    mostrarPanel();
  }

  function onCerrar() {
    Auth.cerrarSesion();
    mostrarLogin('Aplicación cerrada correctamente. Sus datos quedaron guardados.', 'ok');
  }

  /* ---------- Eventos ---------- */
  $('form-login').addEventListener('submit', onLogin);
  $('btn-registrar').addEventListener('click', onRegistrar);
  $('btn-buscar').addEventListener('click', onBuscar);
  $('btn-ver-todos').addEventListener('click', onVerTodos);
  $('btn-actualizar').addEventListener('click', onActualizar);
  $('btn-ingreso').addEventListener('click', onIngreso);
  $('btn-salida').addEventListener('click', onSalida);
  $('btn-limpiar').addEventListener('click', onLimpiar);
  $('btn-cerrar').addEventListener('click', onCerrar);
  $('tbody').addEventListener('click', onSeleccionar);
  $('f-buscar').addEventListener('keydown', (e) => { if (e.key === 'Enter') onBuscar(); });

  // Mostrar u ocultar campo de texto cuando se elige "Otro motivo"
  $('f-motivo').addEventListener('change', () => {
    setErrorCampo('motivo', '');
    actualizarVisibilidadMotivoOtro(true);
  });

  // Desplegar selector de piso/apartamento u oficina administrativa según la torre elegida
  $('f-torre').addEventListener('change', () => {
    setErrorCampo('torre', '');
    actualizarVisibilidadUbicacion(true);
  });

  // Generar los 6 apartamentos correspondientes al piso seleccionado (Apt 101-106 ... Apt 801-806)
  $('f-piso').addEventListener('change', () => {
    setErrorCampo('piso', '');
    setErrorCampo('apartamento', '');
    poblarApartamentosPorPiso($('f-piso').value);
    if ($('f-piso').value) {
      $('f-apartamento').focus();
    }
  });

  $('f-apartamento').addEventListener('change', () => {
    if ($('f-apartamento').value) {
      setErrorCampo('apartamento', '');
    }
  });

  // Permite escribir letras en Documento, pero resalta en rojo en tiempo real e indica que solo se permiten números
  $('f-documento').addEventListener('input', (e) => {
    const val = e.target.value;
    if (/\D/.test(val)) {
      setErrorCampo('documento', 'Solo se pueden ingresar números.');
      msg('Solo se pueden ingresar números en el campo Documento.', 'error');
    } else {
      setErrorCampo('documento', '');
      if ($('mensaje').textContent === 'Solo se pueden ingresar números en el campo Documento.') {
        $('mensaje').hidden = true;
      }
    }
  });

  // Limpiar el resaltado rojo de las demás casillas al empezar a llenarlas
  ['nombre', 'motivoOtro', 'personaVisitar'].forEach((clave) => {
    const el = $(MAPA_CONTROLES[clave].input);
    el.addEventListener('input', () => {
      if (el.value.trim()) {
        setErrorCampo(clave, '');
      }
    });
  });

  // Siempre se arranca en el inicio de sesión (CP 028)
  mostrarLogin();
})();
