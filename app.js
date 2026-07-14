/*
  PEGÁ AQUÍ LA URL /exec DE TU IMPLEMENTACIÓN DE GOOGLE APPS SCRIPT.
  Ejemplo:
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
*/
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZAT5hKXj6zHC0zAjTy3TxrBcMytiTkw89MxFB4h9suMTJEbil_k3V2kzZudGIhysr/exec";
const STORAGE_KEY = "gastos-yessi-andy-v3";
const LUGARES_KEY = "gastos-yessi-lugares-v1";
const CONCEPTOS_KEY = "gastos-yessi-conceptos-v1";

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
const listaRegistros = $("#listaRegistros");
const tarjetaTemplate = $("#tarjetaTemplate");
const vacio = $("#vacio");
const guardarBtn = $("#guardarBtn");
const cancelarBtn = $("#cancelarBtn");
const exportarBtn = $("#exportarBtn");
const filtroMes = $("#filtroMes");
const busqueda = $("#busqueda");
const lugaresGuardados = $("#lugaresGuardados");
const conceptosGuardados = $("#conceptosGuardados");
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

  configurarSegmentado("#personaSelector", (value) => persona = value);
  configurarSegmentado("#tipoSelector", (value) => tipo = value);

  form.addEventListener("submit", guardarRegistro);
  cancelarBtn.addEventListener("click", cancelarEdicion);
  exportarBtn.addEventListener("click", exportarCSV);
  filtroMes.addEventListener("input", renderizar);
  busqueda.addEventListener("input", renderizar);

  actualizarSugerencias();
  renderizar();
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

function cargarRegistros() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function persistir() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
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
    dispositivo: navigator.userAgent,
    enviadoEn: new Date().toISOString()
  };

  if (!nuevo.fecha || !nuevo.lugar || !nuevo.concepto) {
    mostrarMensaje("Completá los campos obligatorios.", true);
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

    const indice = registros.findIndex((item) => item.id === nuevo.id);
    if (indice >= 0) {
      registros[indice] = nuevo;
    } else {
      registros.push(nuevo);
    }

    guardarSugerencia(LUGARES_KEY, nuevo.lugar);
    guardarSugerencia(CONCEPTOS_KEY, nuevo.concepto);
    actualizarSugerencias();
    persistir();
    limpiarFormulario();
    renderizar();
    mostrarMensaje(indice >= 0 ? "Actualizado y enviado." : "Guardado en Google Sheets.");
  } catch (error) {
    console.error(error);
    mostrarMensaje(error.message || "No se pudo guardar.", true);
  } finally {
    guardarBtn.disabled = false;
    if (!registroId.value) guardarBtn.textContent = "Guardar";
  }
}

async function enviarAGoogleSheets(registro) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("PEGAR_URL")) {
    throw new Error("Falta pegar la URL de Apps Script en app.js.");
  }

  const cuerpo = new URLSearchParams();
  cuerpo.set("payload", JSON.stringify(registro));

  /*
    mode: "no-cors" evita el bloqueo del navegador por el redireccionamiento
    de Apps Script. La respuesta no puede leerse, pero el POST sí se envía.
  */
  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: cuerpo.toString()
  });
}


function leerLista(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave)) ?? [];
  } catch {
    return [];
  }
}

function guardarSugerencia(clave, valor) {
  const limpio = String(valor || "").trim();
  if (!limpio) return;

  const lista = leerLista(clave);
  const existe = lista.some((item) => item.toLowerCase() === limpio.toLowerCase());

  if (!existe) {
    lista.push(limpio);
    lista.sort((a, b) => a.localeCompare(b, "es"));
    localStorage.setItem(clave, JSON.stringify(lista));
  }
}

function actualizarSugerencias() {
  cargarDatalist(lugaresGuardados, leerLista(LUGARES_KEY));
  cargarDatalist(conceptosGuardados, leerLista(CONCEPTOS_KEY));
}

function cargarDatalist(elemento, valores) {
  elemento.innerHTML = "";
  valores.forEach((valor) => {
    const option = document.createElement("option");
    option.value = valor;
    elemento.appendChild(option);
  });
}

function renderizar() {
  const visibles = obtenerVisibles();
  listaRegistros.innerHTML = "";
  vacio.style.display = visibles.length ? "none" : "block";

  visibles.forEach((registro) => {
    const tarjeta = tarjetaTemplate.content.cloneNode(true);
    tarjeta.querySelector('[data-campo="fecha"]').textContent = formatearFecha(registro.fecha);
    tarjeta.querySelector('[data-campo="lugar"]').textContent = registro.lugar;
    tarjeta.querySelector('[data-campo="concepto"]').textContent = registro.concepto;
    tarjeta.querySelector('[data-campo="unidad"]').textContent = registro.unidad;
    tarjeta.querySelector('[data-campo="cantidad"]').textContent =
      `Cant.: ${formatearCantidad(registro.cantidad)}`;
    tarjeta.querySelector('[data-campo="categoria"]').textContent = registro.categoria;
    tarjeta.querySelector('[data-campo="importe"]').textContent =
      formatearMoneda(registro.importe);
    tarjeta.querySelector(".editar").addEventListener("click", () => editarRegistro(registro.id));
    tarjeta.querySelector(".eliminar").addEventListener("click", () => eliminarRegistro(registro.id));
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
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function sumar(lista, nombreCategoria) {
  return lista
    .filter((registro) => registro.categoria === nombreCategoria)
    .reduce((total, registro) => total + registro.importe, 0);
}

function editarRegistro(id) {
  const registro = registros.find((item) => item.id === id);
  if (!registro) return;

  [persona, tipo] = registro.categoria.split(" ");
  activarBoton("#personaSelector", persona);
  activarBoton("#tipoSelector", tipo);

  registroId.value = registro.id;
  fecha.value = registro.fecha;
  lugar.value = registro.lugar;
  concepto.value = registro.concepto;
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

function eliminarRegistro(id) {
  const registro = registros.find((item) => item.id === id);
  if (!registro) return;

  if (!confirm(`¿Eliminar "${registro.concepto}" por ${formatearMoneda(registro.importe)}?`)) {
    return;
  }

  /*
    Esto elimina la copia local. No elimina la fila ya enviada a Sheets.
    Para corregir en Sheets, editá o borrá la fila manualmente.
  */
  registros = registros.filter((item) => item.id !== id);
  persistir();
  renderizar();
  mostrarMensaje("Eliminado del celular. Revisá la fila en Sheets.");
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
  if (!registros.length) {
    mostrarMensaje("No hay registros para exportar.", true);
    return;
  }

  const encabezados = [
    "Fecha", "Lugar", "Concepto", "Unidad",
    "Cantidad", "Categoría", "Importe"
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
      fila.map((valor) => `"${String(valor).replaceAll('"', '""')}"`).join(";")
    )
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
  mostrarMensaje.timeout = setTimeout(() => mensaje.textContent = "", 3000);
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
  const local = new Date(valor.getTime() - valor.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
