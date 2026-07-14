const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZAT5hKXj6zHC0zAjTy3TxrBcMytiTkw89MxFB4h9suMTJEbil_k3V2kzZudGIhysr/exec";
const LOCAL_BACKUP_KEY = "gastos-yessi-andy-backup-v5";
const PLACES_KEY = "gastos-yessi-lugares-v3";
const CONCEPTS_KEY = "gastos-yessi-conceptos-v3";

const $ = (selector) => document.querySelector(selector);

const form = $("#gastoForm");
const registroId = $("#registroId");
const fecha = $("#fecha");
const lugar = $("#lugar");
const concepto = $("#concepto");
const unidad = $("#unidad");
const cantidad = $("#cantidad");
const importe = $("#importe");
const mensaje = $("#mensaje");

const abrirLugar = $("#abrirLugar");
const abrirConcepto = $("#abrirConcepto");
const lugarTexto = $("#lugarTexto");
const conceptoTexto = $("#conceptoTexto");

const selectorModal = $("#selectorModal");
const cerrarModal = $("#cerrarModal");
const modalBusqueda = $("#modalBusqueda");
const modalFavoritos = $("#modalFavoritos");
const modalLista = $("#modalLista");
const modalTitulo = $("#modalTitulo");
const modalEyebrow = $("#modalEyebrow");
const crearOpcion = $("#crearOpcion");

const listaRegistros = $("#listaRegistros");
const tarjetaTemplate = $("#tarjetaTemplate");
const vacio = $("#vacio");
const guardarBtn = $("#guardarBtn");
const cancelarBtn = $("#cancelarBtn");
const exportarBtn = $("#exportarBtn");
const sincronizarBtn = $("#sincronizarBtn");
const estadoSync = $("#estadoSync");
const filtroMes = $("#filtroMes");
const busqueda = $("#busqueda");
const totalYessi = $("#totalYessi");
const totalAndy = $("#totalAndy");
const totalCompartido = $("#totalCompartido");
const cantidadRegistros = $("#cantidadRegistros");

let persona = "Yessi";
let tipo = "Compartido";
let registros = cargarJSON(LOCAL_BACKUP_KEY, []);
let selectorActual = null;
let jsonpSecuencia = 0;

inicializar();

async function inicializar() {
  const hoy = new Date();
  fecha.value = fechaISO(hoy);
  filtroMes.value = fechaISO(hoy).slice(0, 7);

  configurarSegmentado("#personaSelector", (value) => persona = value);
  configurarSegmentado("#tipoSelector", (value) => tipo = value);

  abrirLugar.addEventListener("click", () => abrirSelector("lugar"));
  abrirConcepto.addEventListener("click", () => abrirSelector("concepto"));
  cerrarModal.addEventListener("click", cerrarSelector);
  document.querySelectorAll("[data-cerrar-modal]").forEach((el) => {
    el.addEventListener("click", cerrarSelector);
  });
  modalBusqueda.addEventListener("input", renderizarSelector);
  crearOpcion.addEventListener("click", crearDesdeBusqueda);

  form.addEventListener("submit", guardarRegistro);
  cancelarBtn.addEventListener("click", cancelarEdicion);
  exportarBtn.addEventListener("click", exportarCSV);
  sincronizarBtn.addEventListener("click", sincronizarDesdeSheets);
  filtroMes.addEventListener("input", renderizar);
  busqueda.addEventListener("input", renderizar);

  reconstruirAprendizaje();
  renderizar();
  await sincronizarDesdeSheets();
}

function configurarSegmentado(selector, callback) {
  document.querySelectorAll(`${selector} button`).forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(`${selector} button`).forEach((item) => {
        item.classList.remove("active");
      });
      button.classList.add("active");
      callback(button.dataset.value);
    });
  });
}

function cargarJSON(clave, fallback) {
  try {
    return JSON.parse(localStorage.getItem(clave)) ?? fallback;
  } catch {
    return fallback;
  }
}

function guardarJSON(clave, valor) {
  localStorage.setItem(clave, JSON.stringify(valor));
}

async function sincronizarDesdeSheets() {
  sincronizarBtn.disabled = true;
  cambiarEstadoSync("Actualizando desde Google Sheets…");

  try {
    const respuesta = await cargarJSONP();
    if (!respuesta || !respuesta.ok || !Array.isArray(respuesta.registros)) {
      throw new Error(respuesta?.error || "Respuesta inválida de la planilla.");
    }

    registros = respuesta.registros.map(normalizarRegistro);
    guardarJSON(LOCAL_BACKUP_KEY, registros);
    reconstruirAprendizaje();
    renderizar();

    cambiarEstadoSync(
      `Sincronizado: ${registros.length} movimientos`,
      "ok"
    );
  } catch (error) {
    console.error(error);
    cambiarEstadoSync(
      "No se pudo leer Sheets. Se muestra la última copia guardada.",
      "error"
    );
  } finally {
    sincronizarBtn.disabled = false;
  }
}

function cargarJSONP() {
  return new Promise((resolve, reject) => {
    const callbackName = `gastosCallback_${Date.now()}_${jsonpSecuencia++}`;
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      limpiar();
      reject(new Error("La planilla tardó demasiado en responder."));
    }, 15000);

    function limpiar() {
      clearTimeout(timeout);
      script.remove();
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
    }

    window[callbackName] = (datos) => {
      limpiar();
      resolve(datos);
    };

    script.onerror = () => {
      limpiar();
      reject(new Error("No se pudo conectar con Google Sheets."));
    };

    const params = new URLSearchParams({
      callback: callbackName,
      t: String(Date.now())
    });

    script.src = `${APPS_SCRIPT_URL}?${params.toString()}`;
    document.body.appendChild(script);
  });
}

function normalizarRegistro(registro) {
  return {
    id: String(registro.id || crypto.randomUUID()),
    fecha: String(registro.fecha || "").slice(0, 10),
    lugar: String(registro.lugar || ""),
    concepto: String(registro.concepto || ""),
    unidad: String(registro.unidad || "Global"),
    cantidad: Number(registro.cantidad || 0),
    categoria: String(registro.categoria || ""),
    importe: Number(registro.importe || 0)
  };
}

function reconstruirAprendizaje() {
  const lugares = [];
  const conceptosPorLugar = {};

  registros.forEach((registro) => {
    acumularUso(lugares, registro.lugar);

    if (!conceptosPorLugar[registro.lugar]) {
      conceptosPorLugar[registro.lugar] = [];
    }
    acumularUso(conceptosPorLugar[registro.lugar], registro.concepto);
  });

  guardarJSON(PLACES_KEY, lugares);
  guardarJSON(CONCEPTS_KEY, conceptosPorLugar);
}

function acumularUso(lista, nombre) {
  const limpio = String(nombre || "").trim();
  if (!limpio) return;

  const existente = lista.find(
    (item) => item.nombre.toLowerCase() === limpio.toLowerCase()
  );

  if (existente) {
    existente.usos += 1;
  } else {
    lista.push({ nombre: limpio, usos: 1 });
  }
}

function abrirSelector(tipoSelector) {
  selectorActual = tipoSelector;
  modalBusqueda.value = "";

  if (tipoSelector === "lugar") {
    modalEyebrow.textContent = "Comercio o lugar";
    modalTitulo.textContent = "Elegir lugar";
    modalBusqueda.placeholder = "Buscar lugar...";
  } else {
    modalEyebrow.textContent = lugar.value || "Concepto";
    modalTitulo.textContent = "Elegir concepto";
    modalBusqueda.placeholder = "Buscar concepto...";
  }

  selectorModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  renderizarSelector();
  setTimeout(() => modalBusqueda.focus(), 100);
}

function cerrarSelector() {
  selectorModal.classList.add("hidden");
  document.body.style.overflow = "";
}

function obtenerOpcionesActuales() {
  if (selectorActual === "lugar") {
    return cargarJSON(PLACES_KEY, []);
  }

  const mapa = cargarJSON(CONCEPTS_KEY, {});
  return mapa[lugar.value] || [];
}

function renderizarSelector() {
  const terminoOriginal = modalBusqueda.value.trim();
  const termino = terminoOriginal.toLowerCase();

  const opciones = obtenerOpcionesActuales()
    .slice()
    .sort((a, b) =>
      (b.usos || 0) - (a.usos || 0) ||
      a.nombre.localeCompare(b.nombre, "es")
    );

  const filtradas = opciones.filter((item) =>
    item.nombre.toLowerCase().includes(termino)
  );

  modalFavoritos.innerHTML = "";
  if (!termino) {
    opciones.slice(0, 4).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-option";
      button.textContent = item.nombre;
      button.addEventListener("click", () => seleccionarOpcion(item.nombre));
      modalFavoritos.appendChild(button);
    });
  }

  modalLista.innerHTML = "";
  filtradas.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-item";
    button.innerHTML =
      `<span>${escaparHTML(item.nombre)}</span>` +
      `<span class="option-count">${item.usos || 0} usos</span>`;
    button.addEventListener("click", () => seleccionarOpcion(item.nombre));
    modalLista.appendChild(button);
  });

  const nombreExacto = opciones.some(
    (item) => item.nombre.toLowerCase() === termino
  );

  if (terminoOriginal && !nombreExacto) {
    crearOpcion.classList.remove("hidden");
    crearOpcion.textContent = `+ Crear "${terminoOriginal}"`;
  } else {
    crearOpcion.classList.add("hidden");
  }
}

function crearDesdeBusqueda() {
  const nombre = modalBusqueda.value.trim();
  if (!nombre) return;
  seleccionarOpcion(nombre);
}

function seleccionarOpcion(nombre) {
  if (selectorActual === "lugar") {
    lugar.value = nombre;
    lugarTexto.textContent = nombre;
    concepto.value = "";
    conceptoTexto.textContent = "Elegir concepto";
    abrirConcepto.disabled = false;
  } else {
    concepto.value = nombre;
    conceptoTexto.textContent = nombre;
  }

  cerrarSelector();
}

async function guardarRegistro(event) {
  event.preventDefault();

  const nuevo = {
    action: "upsert",
    id: registroId.value || crypto.randomUUID(),
    fecha: fecha.value,
    lugar: lugar.value.trim(),
    concepto: concepto.value.trim(),
    unidad: unidad.value,
    cantidad: Number(cantidad.value),
    categoria: `${persona} ${tipo}`,
    importe: Number(importe.value)
  };

  if (!nuevo.fecha || !nuevo.lugar || !nuevo.concepto) {
    mostrarMensaje("Elegí lugar y concepto.", true);
    return;
  }

  if (
    !Number.isFinite(nuevo.cantidad) ||
    nuevo.cantidad < 0 ||
    !Number.isFinite(nuevo.importe) ||
    nuevo.importe < 0
  ) {
    mostrarMensaje("Revisá cantidad e importe.", true);
    return;
  }

  guardarBtn.disabled = true;
  guardarBtn.textContent = "Guardando…";

  try {
    await enviarAccion(nuevo);

    const indice = registros.findIndex((item) => item.id === nuevo.id);
    const limpio = normalizarRegistro(nuevo);

    if (indice >= 0) {
      registros[indice] = limpio;
    } else {
      registros.push(limpio);
    }

    guardarJSON(LOCAL_BACKUP_KEY, registros);
    reconstruirAprendizaje();
    limpiarFormulario();
    renderizar();
    mostrarMensaje(indice >= 0 ? "Movimiento actualizado." : "Movimiento guardado.");

    setTimeout(sincronizarDesdeSheets, 1200);
  } catch (error) {
    console.error(error);
    mostrarMensaje(error.message || "No se pudo guardar.", true);
  } finally {
    guardarBtn.disabled = false;
    guardarBtn.textContent = "Guardar";
  }
}

async function enviarAccion(datos) {
  const cuerpo = new URLSearchParams();
  cuerpo.set("payload", JSON.stringify(datos));

  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: cuerpo.toString()
  });
}

function renderizar() {
  const visibles = obtenerVisibles();
  listaRegistros.innerHTML = "";
  vacio.style.display = visibles.length ? "none" : "block";

  visibles.forEach((registro) => {
    const tarjeta = tarjetaTemplate.content.cloneNode(true);

    tarjeta.querySelector('[data-campo="fecha"]').textContent =
      formatearFecha(registro.fecha);
    tarjeta.querySelector('[data-campo="lugar"]').textContent = registro.lugar;
    tarjeta.querySelector('[data-campo="concepto"]').textContent =
      registro.concepto;
    tarjeta.querySelector('[data-campo="unidad"]').textContent =
      registro.unidad;
    tarjeta.querySelector('[data-campo="cantidad"]').textContent =
      `Cant.: ${formatearCantidad(registro.cantidad)}`;
    tarjeta.querySelector('[data-campo="categoria"]').textContent =
      registro.categoria;
    tarjeta.querySelector('[data-campo="importe"]').textContent =
      formatearMoneda(registro.importe);

    tarjeta.querySelector(".editar").addEventListener(
      "click",
      () => editarRegistro(registro.id)
    );
    tarjeta.querySelector(".eliminar").addEventListener(
      "click",
      () => eliminarRegistro(registro.id)
    );

    listaRegistros.appendChild(tarjeta);
  });

  const yessi = sumar(visibles, "Yessi Compartido");
  const andy = sumar(visibles, "Andy Compartido");

  totalYessi.textContent = formatearMoneda(yessi);
  totalAndy.textContent = formatearMoneda(andy);
  totalCompartido.textContent = formatearMoneda(yessi + andy);
  cantidadRegistros.textContent =
    `${visibles.length} ${visibles.length === 1 ? "registro" : "registros"}`;
}

function obtenerVisibles() {
  const mes = filtroMes.value;
  const termino = busqueda.value.trim().toLowerCase();

  return registros
    .filter((registro) => !mes || registro.fecha.startsWith(mes))
    .filter((registro) =>
      !termino ||
      `${registro.lugar} ${registro.concepto} ${registro.categoria}`
        .toLowerCase()
        .includes(termino)
    )
    .sort((a, b) =>
      b.fecha.localeCompare(a.fecha) ||
      b.id.localeCompare(a.id)
    );
}

function sumar(lista, categoriaBuscada) {
  return lista
    .filter((registro) => registro.categoria === categoriaBuscada)
    .reduce((total, registro) => total + registro.importe, 0);
}

function editarRegistro(id) {
  const registro = registros.find((item) => item.id === id);
  if (!registro) return;

  const partes = registro.categoria.split(" ");
  persona = partes.shift() || "Yessi";
  tipo = partes.join(" ") || "Compartido";

  activarBoton("#personaSelector", persona);
  activarBoton("#tipoSelector", tipo);

  registroId.value = registro.id;
  fecha.value = registro.fecha;
  lugar.value = registro.lugar;
  concepto.value = registro.concepto;
  lugarTexto.textContent = registro.lugar;
  conceptoTexto.textContent = registro.concepto;
  abrirConcepto.disabled = false;
  unidad.value = registro.unidad;
  cantidad.value = registro.cantidad;
  importe.value = registro.importe;

  guardarBtn.textContent = "Actualizar";
  cancelarBtn.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth" });
}

function activarBoton(selector, valor) {
  document.querySelectorAll(`${selector} button`).forEach((button) => {
    button.classList.toggle("active", button.dataset.value === valor);
  });
}

async function eliminarRegistro(id) {
  const registro = registros.find((item) => item.id === id);
  if (!registro) return;

  if (
    !confirm(
      `¿Eliminar "${registro.concepto}" por ${formatearMoneda(registro.importe)}?`
    )
  ) {
    return;
  }

  try {
    cambiarEstadoSync("Eliminando movimiento…");
    await enviarAccion({ action: "delete", id });

    registros = registros.filter((item) => item.id !== id);
    guardarJSON(LOCAL_BACKUP_KEY, registros);
    reconstruirAprendizaje();
    renderizar();
    mostrarMensaje("Movimiento eliminado.");

    setTimeout(sincronizarDesdeSheets, 1200);
  } catch (error) {
    console.error(error);
    mostrarMensaje("No se pudo eliminar.", true);
    cambiarEstadoSync("Error al eliminar.", "error");
  }
}

function cancelarEdicion() {
  limpiarFormulario();
}

function limpiarFormulario() {
  form.reset();
  registroId.value = "";
  fecha.value = fechaISO(new Date());
  unidad.value = "Global";
  cantidad.value = "1";

  persona = "Yessi";
  tipo = "Compartido";
  activarBoton("#personaSelector", persona);
  activarBoton("#tipoSelector", tipo);

  lugar.value = "";
  concepto.value = "";
  lugarTexto.textContent = "Elegir lugar";
  conceptoTexto.textContent = "Elegí primero un lugar";
  abrirConcepto.disabled = true;

  guardarBtn.textContent = "Guardar";
  cancelarBtn.classList.add("hidden");
}

function exportarCSV() {
  if (!registros.length) {
    mostrarMensaje("No hay registros para exportar.", true);
    return;
  }

  const encabezados = [
    "Fecha",
    "Lugar",
    "Concepto",
    "Unidad",
    "Cantidad",
    "Categoría",
    "Importe"
  ];

  const filas = registros
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((registro) => [
      registro.fecha,
      registro.lugar,
      registro.concepto,
      registro.unidad,
      registro.cantidad,
      registro.categoria,
      registro.importe.toFixed(2).replace(".", ",")
    ]);

  const csv = [encabezados, ...filas]
    .map((fila) =>
      fila
        .map((valor) => `"${String(valor).replaceAll('"', '""')}"`)
        .join(";")
    )
    .join("\n");

  const blob = new Blob(
    ["\ufeff" + csv],
    { type: "text/csv;charset=utf-8" }
  );

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `gastos-${fechaISO(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function cambiarEstadoSync(texto, clase = "") {
  estadoSync.textContent = texto;
  estadoSync.className = `sync-status ${clase}`.trim();
}

function mostrarMensaje(texto, error = false) {
  mensaje.textContent = texto;
  mensaje.style.color = error ? "#b42318" : "#2563eb";

  clearTimeout(mostrarMensaje.timeout);
  mostrarMensaje.timeout = setTimeout(() => {
    mensaje.textContent = "";
  }, 3000);
}

function escaparHTML(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(valor);
}

function formatearFecha(valor) {
  const [anio, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearCantidad(valor) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2
  }).format(valor);
}

function fechaISO(valor) {
  const local = new Date(
    valor.getTime() - valor.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 10);
}
