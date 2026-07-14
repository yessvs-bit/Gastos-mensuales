const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZAT5hKXj6zHC0zAjTy3TxrBcMytiTkw89MxFB4h9suMTJEbil_k3V2kzZudGIhysr/exec";
const FILTER_KEY = "gastos-reportes-rango-v3";

const $ = (selector) => document.querySelector(selector);

const sincronizarBtn = $("#sincronizarBtn");
const estadoSync = $("#estadoSync");
const filtroDesde = $("#filtroDesde");
const filtroHasta = $("#filtroHasta");
const verTodoBtn = $("#verTodoBtn");

const resumenHogar = $("#resumenHogar");
const resumenPersonal = $("#resumenPersonal");

const hogarIngresos = $("#hogarIngresos");
const hogarYessiCompartido = $("#hogarYessiCompartido");
const hogarAndyCompartido = $("#hogarAndyCompartido");
const hogarYessiSolo = $("#hogarYessiSolo");
const hogarAndySolo = $("#hogarAndySolo");
const hogarAhorroARS = $("#hogarAhorroARS");
const hogarAhorroUSD = $("#hogarAhorroUSD");

const personalIngresos = $("#personalIngresos");
const personalCompartido = $("#personalCompartido");
const personalSolo = $("#personalSolo");
const personalAhorroARS = $("#personalAhorroARS");
const personalAhorroUSD = $("#personalAhorroUSD");

const balancePeriodo = $("#balancePeriodo");
const tasaAhorro = $("#tasaAhorro");
const promedioDiario = $("#promedioDiario");
const cantidadMovimientos = $("#cantidadMovimientos");

const graficoDistribucion = $("#graficoDistribucion");
const comparacionPeriodo = $("#comparacionPeriodo");
const topLugares = $("#topLugares");
const topVacio = $("#topVacio");

let registros = [];
let alcance = "Hogar";
let jsonpSecuencia = 0;

inicializar();

async function inicializar() {
  cargarRango();

  configurarSegmentado("#alcanceSelector", (value) => {
    alcance = value;
    renderizar();
  });

  filtroDesde.addEventListener("change", guardarRangoYRenderizar);
  filtroHasta.addEventListener("change", guardarRangoYRenderizar);
  verTodoBtn.addEventListener("click", limpiarRango);
  sincronizarBtn.addEventListener("click", sincronizar);

  await sincronizar();
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

function cargarRango() {
  try {
    const rango = JSON.parse(localStorage.getItem(FILTER_KEY)) || {};
    filtroDesde.value = rango.desde || "";
    filtroHasta.value = rango.hasta || "";
  } catch {}
}

function guardarRangoYRenderizar() {
  if (
    filtroDesde.value &&
    filtroHasta.value &&
    filtroDesde.value > filtroHasta.value
  ) {
    return;
  }

  localStorage.setItem(
    FILTER_KEY,
    JSON.stringify({
      desde: filtroDesde.value,
      hasta: filtroHasta.value
    })
  );

  renderizar();
}

function limpiarRango() {
  filtroDesde.value = "";
  filtroHasta.value = "";
  localStorage.removeItem(FILTER_KEY);
  renderizar();
}

async function sincronizar() {
  sincronizarBtn.disabled = true;
  cambiarEstado("Actualizando desde Google Sheets…");

  try {
    const respuesta = await cargarJSONP();

    if (!respuesta?.ok || !Array.isArray(respuesta.registros)) {
      throw new Error(respuesta?.error || "Respuesta inválida.");
    }

    registros = respuesta.registros.map(normalizarRegistro);
    renderizar();
    cambiarEstado(`Sincronizado: ${registros.length} movimientos`, "ok");
  } catch (error) {
    console.error(error);
    cambiarEstado("No se pudo leer Google Sheets.", "error");
  } finally {
    sincronizarBtn.disabled = false;
  }
}

function cargarJSONP() {
  return new Promise((resolve, reject) => {
    const callbackName = `reportesV3_${Date.now()}_${jsonpSecuencia++}`;
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      limpiar();
      reject(new Error("Tiempo de espera agotado."));
    }, 15000);

    function limpiar() {
      clearTimeout(timeout);
      script.remove();
      try { delete window[callbackName]; } catch {}
    }

    window[callbackName] = (datos) => {
      limpiar();
      resolve(datos);
    };

    script.onerror = () => {
      limpiar();
      reject(new Error("No se pudo conectar."));
    };

    script.src =
      `${APPS_SCRIPT_URL}?callback=${encodeURIComponent(callbackName)}&t=${Date.now()}`;

    document.body.appendChild(script);
  });
}

function normalizarRegistro(registro) {
  return {
    fecha: String(registro.fecha || "").slice(0, 10),
    lugar: String(registro.lugar || ""),
    categoria: String(registro.categoria || ""),
    importe: Number(registro.importe || 0),
    movimiento: String(registro.movimiento || ""),
    moneda: String(registro.moneda || "ARS")
  };
}

function renderizar() {
  const actualesBase = filtrarRango(registros, filtroDesde.value, filtroHasta.value);
  const actuales = filtrarPorAlcance(actualesBase);

  const periodoAnterior = calcularPeriodoAnterior();
  const anterioresBase = periodoAnterior
    ? filtrarRango(registros, periodoAnterior.desde, periodoAnterior.hasta)
    : [];
  const anteriores = filtrarPorAlcance(anterioresBase);

  const actual = calcularMetricas(actuales);
  const anterior = calcularMetricas(anteriores);

  renderizarResumen(actual);
  renderizarIndicadores(actual, actuales);
  renderizarDistribucion(actual);
  renderizarComparacion(actual, anterior, !!periodoAnterior);
  renderizarTopLugares(actuales);
}

function filtrarPorAlcance(lista) {
  if (alcance === "Hogar") return lista;
  return lista.filter((registro) =>
    registro.categoria.startsWith(`${alcance} `)
  );
}

function filtrarRango(lista, desde, hasta) {
  return lista.filter((registro) =>
    (!desde || registro.fecha >= desde) &&
    (!hasta || registro.fecha <= hasta)
  );
}

function calcularMetricas(lista) {
  const m = {
    ingresos: 0,
    yessiCompartido: 0,
    andyCompartido: 0,
    yessiSolo: 0,
    andySolo: 0,
    ahorroARS: 0,
    ahorroUSD: 0
  };

  lista.forEach((registro) => {
    const monto = Number(registro.importe || 0);

    switch (registro.categoria) {
      case "Yessi Ingreso":
      case "Andy Ingreso":
        m.ingresos += monto;
        break;
      case "Yessi Compartido":
        m.yessiCompartido += monto;
        break;
      case "Andy Compartido":
        m.andyCompartido += monto;
        break;
      case "Yessi Solo":
        m.yessiSolo += monto;
        break;
      case "Andy Solo":
        m.andySolo += monto;
        break;
    }

    if (registro.categoria.endsWith(" Ahorro")) {
      const signo = registro.movimiento === "Retiro" ? -1 : 1;

      if ((registro.moneda || "ARS") === "USD") {
        m.ahorroUSD += signo * monto;
      } else {
        m.ahorroARS += signo * monto;
      }
    }
  });

  return m;
}

function renderizarResumen(m) {
  const esHogar = alcance === "Hogar";

  resumenHogar.classList.toggle("hidden-by-scope", !esHogar);
  resumenPersonal.classList.toggle("hidden-by-scope", esHogar);

  if (esHogar) {
    hogarIngresos.textContent = moneda(m.ingresos);
    hogarYessiCompartido.textContent = moneda(m.yessiCompartido);
    hogarAndyCompartido.textContent = moneda(m.andyCompartido);
    hogarYessiSolo.textContent = moneda(m.yessiSolo);
    hogarAndySolo.textContent = moneda(m.andySolo);
    hogarAhorroARS.textContent = moneda(m.ahorroARS);
    hogarAhorroUSD.textContent = usd(m.ahorroUSD);
  } else {
    const compartido = alcance === "Yessi"
      ? m.yessiCompartido
      : m.andyCompartido;

    const solo = alcance === "Yessi"
      ? m.yessiSolo
      : m.andySolo;

    personalIngresos.textContent = moneda(m.ingresos);
    personalCompartido.textContent = moneda(compartido);
    personalSolo.textContent = moneda(solo);
    personalAhorroARS.textContent = moneda(m.ahorroARS);
    personalAhorroUSD.textContent = usd(m.ahorroUSD);
  }
}

function renderizarIndicadores(m, lista) {
  const gastos =
    m.yessiCompartido +
    m.andyCompartido +
    m.yessiSolo +
    m.andySolo;

  const balance = m.ingresos - gastos - m.ahorroARS;

  balancePeriodo.textContent = moneda(balance);

  const tasa = m.ingresos > 0
    ? (m.ahorroARS / m.ingresos) * 100
    : 0;

  tasaAhorro.textContent = `${tasa.toFixed(1)}%`;

  const dias = calcularDiasSeleccionados(lista);
  promedioDiario.textContent = moneda(dias > 0 ? gastos / dias : 0);
  cantidadMovimientos.textContent = lista.length;
}

function renderizarDistribucion(m) {
  const items = alcance === "Hogar"
    ? [
        ["Yessi compartido", m.yessiCompartido],
        ["Andy compartido", m.andyCompartido],
        ["Yessi solo", m.yessiSolo],
        ["Andy solo", m.andySolo],
        ["Ahorro ARS", m.ahorroARS]
      ]
    : [
        ["Compartido", alcance === "Yessi" ? m.yessiCompartido : m.andyCompartido],
        ["Solo", alcance === "Yessi" ? m.yessiSolo : m.andySolo],
        ["Ahorro ARS", m.ahorroARS]
      ];

  const maximo = Math.max(...items.map(([, valor]) => Math.max(valor, 0)), 1);

  graficoDistribucion.innerHTML = "";

  items.forEach(([nombre, valor]) => {
    const item = document.createElement("div");
    item.className = "bar-item";
    item.innerHTML = `
      <div class="bar-item-head">
        <span class="bar-label">${nombre}</span>
        <span class="bar-value">${moneda(valor)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.max(0, valor) / maximo * 100}%"></div>
      </div>
    `;
    graficoDistribucion.appendChild(item);
  });
}

function renderizarComparacion(actual, anterior, habilitada) {
  comparacionPeriodo.innerHTML = "";

  if (!habilitada) {
    comparacionPeriodo.innerHTML =
      '<div class="empty">Elegí Desde y Hasta para comparar con el período anterior.</div>';
    return;
  }

  const items = alcance === "Hogar"
    ? [
        ["Ingresos", actual.ingresos, anterior.ingresos, false],
        ["Yessi compartido", actual.yessiCompartido, anterior.yessiCompartido, true],
        ["Andy compartido", actual.andyCompartido, anterior.andyCompartido, true],
        ["Yessi solo", actual.yessiSolo, anterior.yessiSolo, true],
        ["Andy solo", actual.andySolo, anterior.andySolo, true],
        ["Ahorro ARS", actual.ahorroARS, anterior.ahorroARS, false]
      ]
    : [
        ["Ingresos", actual.ingresos, anterior.ingresos, false],
        ["Compartido",
          alcance === "Yessi" ? actual.yessiCompartido : actual.andyCompartido,
          alcance === "Yessi" ? anterior.yessiCompartido : anterior.andyCompartido,
          true
        ],
        ["Solo",
          alcance === "Yessi" ? actual.yessiSolo : actual.andySolo,
          alcance === "Yessi" ? anterior.yessiSolo : anterior.andySolo,
          true
        ],
        ["Ahorro ARS", actual.ahorroARS, anterior.ahorroARS, false]
      ];

  items.forEach(([nombre, actualValor, anteriorValor, menorEsMejor]) => {
    let cambio = 0;

    if (anteriorValor !== 0) {
      cambio = ((actualValor - anteriorValor) / Math.abs(anteriorValor)) * 100;
    } else if (actualValor !== 0) {
      cambio = 100;
    }

    const favorable = menorEsMejor ? cambio < 0 : cambio > 0;
    const desfavorable = menorEsMejor ? cambio > 0 : cambio < 0;
    const clase = favorable
      ? "comparison-down"
      : desfavorable
        ? "comparison-up"
        : "comparison-neutral";

    const card = document.createElement("article");
    card.className = "comparison-card";
    card.innerHTML = `
      <div class="comparison-card-head">
        <span>${nombre}</span>
        <strong>${moneda(actualValor)}</strong>
      </div>
      <div class="comparison-change ${clase}">
        ${cambio > 0 ? "+" : ""}${cambio.toFixed(1)}% frente al período anterior
      </div>
    `;
    comparacionPeriodo.appendChild(card);
  });
}

function renderizarTopLugares(lista) {
  const totales = new Map();

  lista.forEach((registro) => {
    if (
      registro.categoria.endsWith(" Ingreso") ||
      registro.categoria.endsWith(" Ahorro")
    ) return;

    const lugar = registro.lugar || "Sin lugar";
    totales.set(lugar, (totales.get(lugar) || 0) + registro.importe);
  });

  const ranking = [...totales.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  topLugares.innerHTML = "";
  topVacio.style.display = ranking.length ? "none" : "block";

  ranking.forEach(([lugar, total], indice) => {
    const item = document.createElement("div");
    item.className = "rank-item";
    item.innerHTML = `
      <span class="rank-label">${indice + 1}. ${escaparHTML(lugar)}</span>
      <span class="rank-value">${moneda(total)}</span>
    `;
    topLugares.appendChild(item);
  });
}

function calcularPeriodoAnterior() {
  if (!filtroDesde.value || !filtroHasta.value) return null;

  const desde = new Date(filtroDesde.value + "T00:00:00");
  const hasta = new Date(filtroHasta.value + "T00:00:00");
  const dias = Math.round((hasta - desde) / 86400000) + 1;

  const anteriorHasta = new Date(desde);
  anteriorHasta.setDate(anteriorHasta.getDate() - 1);

  const anteriorDesde = new Date(anteriorHasta);
  anteriorDesde.setDate(anteriorDesde.getDate() - dias + 1);

  return {
    desde: fechaISO(anteriorDesde),
    hasta: fechaISO(anteriorHasta)
  };
}

function calcularDiasSeleccionados(lista) {
  if (filtroDesde.value && filtroHasta.value) {
    const desde = new Date(filtroDesde.value + "T00:00:00");
    const hasta = new Date(filtroHasta.value + "T00:00:00");

    return Math.max(
      1,
      Math.round((hasta - desde) / 86400000) + 1
    );
  }

  const fechas = lista
    .map((registro) => registro.fecha)
    .filter(Boolean)
    .sort();

  if (!fechas.length) return 1;

  const desde = new Date(fechas[0] + "T00:00:00");
  const hasta = new Date(fechas[fechas.length - 1] + "T00:00:00");

  return Math.max(
    1,
    Math.round((hasta - desde) / 86400000) + 1
  );
}

function moneda(valor) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2
  }).format(valor || 0);
}

function usd(valor) {
  return "USD " + new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor || 0);
}

function cambiarEstado(texto, clase = "") {
  estadoSync.textContent = texto;
  estadoSync.className = `sync-status ${clase}`.trim();
}

function escaparHTML(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fechaISO(valor) {
  const local = new Date(valor.getTime() - valor.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
