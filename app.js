const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZAT5hKXj6zHC0zAjTy3TxrBcMytiTkw89MxFB4h9suMTJEbil_k3V2kzZudGIhysr/exec";
const STORAGE_KEY = "gastos-yessi-andy-v4";
const PLACES_KEY = "gastos-yessi-lugares-v2";
const CONCEPTS_KEY = "gastos-yessi-conceptos-v2";

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
const filtroMes = $("#filtroMes");
const busqueda = $("#busqueda");
const totalYessi = $("#totalYessi");
const totalAndy = $("#totalAndy");
const totalCompartido = $("#totalCompartido");
const cantidadRegistros = $("#cantidadRegistros");

let persona = "Yessi";
let tipo = "Compartido";
let registros = cargarJSON(STORAGE_KEY, []);
let selectorActual = null;

inicializar();

function inicializar() {
  const hoy = new Date();
  fecha.value = fechaISO(hoy);
  filtroMes.value = fechaISO(hoy).slice(0, 7);

  configurarSegmentado("#personaSelector", value => persona = value);
  configurarSegmentado("#tipoSelector", value => tipo = value);

  abrirLugar.addEventListener("click", () => abrirSelector("lugar"));
  abrirConcepto.addEventListener("click", () => abrirSelector("concepto"));
  cerrarModal.addEventListener("click", cerrarSelector);
  document.querySelectorAll("[data-cerrar-modal]").forEach(el => el.addEventListener("click", cerrarSelector));
  modalBusqueda.addEventListener("input", renderizarSelector);
  crearOpcion.addEventListener("click", crearDesdeBusqueda);

  form.addEventListener("submit", guardarRegistro);
  cancelarBtn.addEventListener("click", cancelarEdicion);
  exportarBtn.addEventListener("click", exportarCSV);
  filtroMes.addEventListener("input", renderizar);
  busqueda.addEventListener("input", renderizar);

  renderizar();
}

function configurarSegmentado(selector, callback) {
  document.querySelectorAll(`${selector} button`).forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(`${selector} button`).forEach(item => item.classList.remove("active"));
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
  const termino = modalBusqueda.value.trim().toLowerCase();
  const opciones = obtenerOpcionesActuales()
    .slice()
    .sort((a, b) => (b.usos || 0) - (a.usos || 0) || a.nombre.localeCompare(b.nombre, "es"));

  const filtradas = opciones.filter(item => item.nombre.toLowerCase().includes(termino));
  const favoritas = opciones.slice(0, 4);

  modalFavoritos.innerHTML = "";
  if (!termino) {
    favoritas.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-option";
      button.textContent = item.nombre;
      button.addEventListener("click", () => seleccionarOpcion(item.nombre));
      modalFavoritos.appendChild(button);
    });
  }

  modalLista.innerHTML = "";
  filtradas.forEach(item => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-item";
    button.innerHTML = `<span>${escaparHTML(item.nombre)}</span><span class="option-count">${item.usos || 0} usos</span>`;
    button.addEventListener("click", () => seleccionarOpcion(item.nombre));
    modalLista.appendChild(button);
  });

  const nombreExacto = opciones.some(item => item.nombre.toLowerCase() === termino);
  if (termino && !nombreExacto) {
    crearOpcion.classList.remove("hidden");
    crearOpcion.textContent = `+ Crear "${modalBusqueda.value.trim()}"`;
  } else {
    crearOpcion.classList.add("hidden");
  }
}

function crearDesdeBusqueda() {
  const nombre = modalBusqueda.value.trim();
  if (!nombre) return;
  agregarOIncrementar(selectorActual, nombre, false);
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

function agregarOIncrementar(tipoDato, nombre, incrementar = true) {
  if (tipoDato === "lugar") {
    const lugares = cargarJSON(PLACES_KEY, []);
    actualizarLista(lugares, nombre, incrementar);
    guardarJSON(PLACES_KEY, lugares);
    return;
  }

  const mapa = cargarJSON(CONCEPTS_KEY, {});
  const claveLugar = lugar.value;
  if (!mapa[claveLugar]) mapa[claveLugar] = [];
  actualizarLista(mapa[claveLugar], nombre, incrementar);
  guardarJSON(CONCEPTS_KEY, mapa);
}

function actualizarLista(lista, nombre, incrementar) {
  const existente = lista.find(item => item.nombre.toLowerCase() === nombre.toLowerCase());
  if (existente) {
    if (incrementar) existente.usos = (existente.usos || 0) + 1;
  } else {
    lista.push({ nombre, usos: incrementar ? 1 : 0 });
  }
}

async function guardarRegistro(event) {
  event.preventDefault();

  const nuevo = {
    id: registroId.value || crypto.randomUUID(),
    fecha: fecha.value,
    lugar: lugar.value.trim(),
    concepto: concepto.value.trim(),
    unidad: unidad.value,
    cantidad: Number(cantidad.value),
    categoria: `${persona} ${tipo}`,
    importe: Number(importe.value),
    enviadoEn: new Date().toISOString()
  };

  if (!nuevo.fecha || !nuevo.lugar || !nuevo.concepto) {
    mostrarMensaje("Elegí lugar y concepto.", true);
    return;
  }

  if (!Number.isFinite(nuevo.cantidad) || nuevo.cantidad < 0 ||
      !Number.isFinite(nuevo.importe) || nuevo.importe < 0) {
    mostrarMensaje("Revisá cantidad e importe.", true);
    return;
  }

  guardarBtn.disabled = true;
  guardarBtn.textContent = "Guardando…";

  try {
    await enviarAGoogleSheets(nuevo);

    const indice = registros.findIndex(item => item.id === nuevo.id);
    if (indice >= 0) registros[indice] = nuevo;
    else registros.push(nuevo);

    agregarOIncrementar("lugar", nuevo.lugar, true);
    agregarOIncrementar("concepto", nuevo.concepto, true);

    guardarJSON(STORAGE_KEY, registros);
    limpiarFormulario();
    renderizar();
    mostrarMensaje(indice >= 0 ? "Actualizado." : "Guardado.");
  } catch (error) {
    console.error(error);
    mostrarMensaje(error.message || "No se pudo guardar.", true);
  } finally {
    guardarBtn.disabled = false;
    guardarBtn.textContent = "Guardar";
  }
}

async function enviarAGoogleSheets(registro) {
  const cuerpo = new URLSearchParams();
  cuerpo.set("payload", JSON.stringify(registro));

  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: cuerpo.toString()
  });
}

function renderizar() {
  const visibles = obtenerVisibles();
  listaRegistros.innerHTML = "";
  vacio.style.display = visibles.length ? "none" : "block";

  visibles.forEach(registro => {
    const tarjeta = tarjetaTemplate.content.cloneNode(true);
    tarjeta.querySelector('[data-campo="fecha"]').textContent = formatearFecha(registro.fecha);
    tarjeta.querySelector('[data-campo="lugar"]').textContent = registro.lugar;
    tarjeta.querySelector('[data-campo="concepto"]').textContent = registro.concepto;
    tarjeta.querySelector('[data-campo="unidad"]').textContent = registro.unidad;
    tarjeta.querySelector('[data-campo="cantidad"]').textContent = `Cant.: ${formatearCantidad(registro.cantidad)}`;
    tarjeta.querySelector('[data-campo="categoria"]').textContent = registro.categoria;
    tarjeta.querySelector('[data-campo="importe"]').textContent = formatearMoneda(registro.importe);
    tarjeta.querySelector(".editar").addEventListener("click", () => editarRegistro(registro.id));
    tarjeta.querySelector(".eliminar").addEventListener("click", () => eliminarRegistro(registro.id));
    listaRegistros.appendChild(tarjeta);
  });

  const yessi = sumar(visibles, "Yessi Compartido");
  const andy = sumar(visibles, "Andy Compartido");
  totalYessi.textContent = formatearMoneda(yessi);
  totalAndy.textContent = formatearMoneda(andy);
  totalCompartido.textContent = formatearMoneda(yessi + andy);
  cantidadRegistros.textContent = `${visibles.length} ${visibles.length === 1 ? "registro" : "registros"}`;
}

function obtenerVisibles() {
  const mes = filtroMes.value;
  const termino = busqueda.value.trim().toLowerCase();

  return registros
    .filter(r => !mes || r.fecha.startsWith(mes))
    .filter(r => !termino || `${r.lugar} ${r.concepto} ${r.categoria}`.toLowerCase().includes(termino))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function sumar(lista, categoriaBuscada) {
  return lista.filter(r => r.categoria === categoriaBuscada).reduce((total, r) => total + r.importe, 0);
}

function editarRegistro(id) {
  const r = registros.find(item => item.id === id);
  if (!r) return;

  [persona, tipo] = r.categoria.split(" ");
  activarBoton("#personaSelector", persona);
  activarBoton("#tipoSelector", tipo);

  registroId.value = r.id;
  fecha.value = r.fecha;
  lugar.value = r.lugar;
  concepto.value = r.concepto;
  lugarTexto.textContent = r.lugar;
  conceptoTexto.textContent = r.concepto;
  abrirConcepto.disabled = false;
  unidad.value = r.unidad;
  cantidad.value = r.cantidad;
  importe.value = r.importe;

  guardarBtn.textContent = "Actualizar";
  cancelarBtn.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth" });
}

function activarBoton(selector, valor) {
  document.querySelectorAll(`${selector} button`).forEach(button => {
    button.classList.toggle("active", button.dataset.value === valor);
  });
}

function eliminarRegistro(id) {
  const r = registros.find(item => item.id === id);
  if (!r) return;
  if (!confirm(`¿Eliminar "${r.concepto}" por ${formatearMoneda(r.importe)}?`)) return;

  registros = registros.filter(item => item.id !== id);
  guardarJSON(STORAGE_KEY, registros);
  renderizar();
  mostrarMensaje("Eliminado del celular. Revisá Sheets.");
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
  if (!registros.length) return mostrarMensaje("No hay registros para exportar.", true);

  const encabezados = ["Fecha","Lugar","Concepto","Unidad","Cantidad","Categoría","Importe"];
  const filas = registros
    .slice()
    .sort((a,b) => a.fecha.localeCompare(b.fecha))
    .map(r => [r.fecha,r.lugar,r.concepto,r.unidad,r.cantidad,r.categoria,r.importe.toFixed(2).replace(".", ",")]);

  const csv = [encabezados,...filas]
    .map(fila => fila.map(v => `"${String(v).replaceAll('"','""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `gastos-${fechaISO(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function mostrarMensaje(texto, error = false) {
  mensaje.textContent = texto;
  mensaje.style.color = error ? "#b42318" : "#2563eb";
  clearTimeout(mostrarMensaje.timeout);
  mostrarMensaje.timeout = setTimeout(() => mensaje.textContent = "", 2800);
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
  const [a, m, d] = valor.split("-");
  return `${d}/${m}/${a}`;
}

function formatearCantidad(valor) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(valor);
}

function fechaISO(valor) {
  const local = new Date(valor.getTime() - valor.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
