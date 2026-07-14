const STORAGE_KEY = "gastos-yessi-andy-v2";

const $ = (s) => document.querySelector(s);
const form = $("#gastoForm");
const registroId = $("#registroId");
const fecha = $("#fecha");
const lugar = $("#lugar");
const concepto = $("#concepto");
const unidad = $("#unidad");
const cantidad = $("#cantidad");
const importe = $("#importe");
const mensaje = $("#mensaje");
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
let registros = cargarRegistros();

inicializar();

function inicializar() {
  const hoy = new Date();
  fecha.value = fechaISO(hoy);
  filtroMes.value = fechaISO(hoy).slice(0, 7);

  configurarSegmentado("#personaSelector", value => persona = value);
  configurarSegmentado("#tipoSelector", value => tipo = value);

  form.addEventListener("submit", guardarRegistro);
  cancelarBtn.addEventListener("click", cancelarEdicion);
  exportarBtn.addEventListener("click", exportarCSV);
  filtroMes.addEventListener("input", renderizar);
  busqueda.addEventListener("input", renderizar);

  renderizar();
}

function configurarSegmentado(selector, callback) {
  document.querySelectorAll(`${selector} button`).forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(`${selector} button`).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      callback(btn.dataset.value);
    });
  });
}

function cargarRegistros() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []; }
  catch { return []; }
}

function persistir() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
}

function guardarRegistro(event) {
  event.preventDefault();

  const nuevo = {
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
    mostrarMensaje("Completá los campos obligatorios.", true);
    return;
  }

  const indice = registros.findIndex(item => item.id === nuevo.id);
  if (indice >= 0) registros[indice] = nuevo;
  else registros.push(nuevo);

  persistir();
  limpiarFormulario();
  renderizar();
  mostrarMensaje(indice >= 0 ? "Registro actualizado." : "Registro guardado.");
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
    .sort((a,b) => b.fecha.localeCompare(a.fecha));
}

function sumar(lista, categoria) {
  return lista.filter(r => r.categoria === categoria).reduce((t,r) => t + r.importe, 0);
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
  unidad.value = r.unidad;
  cantidad.value = r.cantidad;
  importe.value = r.importe;

  guardarBtn.textContent = "Actualizar";
  cancelarBtn.classList.remove("hidden");
  form.scrollIntoView({behavior:"smooth"});
}

function activarBoton(selector, valor) {
  document.querySelectorAll(`${selector} button`).forEach(btn => {
    btn.classList.toggle("active", btn.dataset.value === valor);
  });
}

function eliminarRegistro(id) {
  const r = registros.find(item => item.id === id);
  if (!r) return;
  if (!confirm(`¿Eliminar "${r.concepto}" por ${formatearMoneda(r.importe)}?`)) return;
  registros = registros.filter(item => item.id !== id);
  persistir();
  renderizar();
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
  guardarBtn.textContent = "Guardar";
  cancelarBtn.classList.add("hidden");
}

function exportarCSV() {
  if (!registros.length) return mostrarMensaje("No hay registros para exportar.", true);

  const encabezados = ["Fecha","Lugar","Concepto","Unidad","Cantidad","Categoría","Importe"];
  const filas = registros
    .slice()
    .sort((a,b) => a.fecha.localeCompare(b.fecha))
    .map(r => [r.fecha,r.lugar,r.concepto,r.unidad,r.cantidad,r.categoria,r.importe.toFixed(2).replace(".",",")]);

  const csv = [encabezados,...filas].map(f => f.map(v => `"${String(v).replaceAll('"','""')}"`).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `gastos-${fechaISO(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function mostrarMensaje(texto, error=false) {
  mensaje.textContent = texto;
  mensaje.style.color = error ? "#b42318" : "#2563eb";
  clearTimeout(mostrarMensaje.timeout);
  mostrarMensaje.timeout = setTimeout(() => mensaje.textContent = "", 2500);
}

function formatearMoneda(v) {
  return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(v);
}
function formatearFecha(v) {
  const [a,m,d] = v.split("-");
  return `${d}/${m}/${a}`;
}
function formatearCantidad(v) {
  return new Intl.NumberFormat("es-AR",{maximumFractionDigits:2}).format(v);
}
function fechaISO(v) {
  const local = new Date(v.getTime() - v.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
}
