const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZAT5hKXj6zHC0zAjTy3TxrBcMytiTkw89MxFB4h9suMTJEbil_k3V2kzZudGIhysr/exec";
const FILTER_KEY = "gastos-reportes-rango-v1";

const $ = (selector) => document.querySelector(selector);

const sincronizarBtn = $("#sincronizarBtn");
const estadoSync = $("#estadoSync");
const filtroDesde = $("#filtroDesde");
const filtroHasta = $("#filtroHasta");
const verTodoBtn = $("#verTodoBtn");

const totalIngresos = $("#totalIngresos");
const totalYessiCompartido = $("#totalYessiCompartido");
const totalAndyCompartido = $("#totalAndyCompartido");
const totalSolo1 = $("#totalSolo1");
const totalSolo2 = $("#totalSolo2");
const labelSolo1 = $("#labelSolo1");
const labelSolo2 = $("#labelSolo2");
const solo2Card = $("#solo2Card");
const totalAhorroARS = $("#totalAhorroARS");
const totalAhorroUSD = $("#totalAhorroUSD");
const balancePeriodo = $("#balancePeriodo");
const tasaAhorro = $("#tasaAhorro");
const promedioDiario = $("#promedioDiario");
const cantidadMovimientos = $("#cantidadMovimientos");

const graficoDistribucion = $("#graficoDistribucion");
const comparacionPeriodo = $("#comparacionPeriodo");
const topLugares = $("#topLugares");
const topVacio = $("#topVacio");

let registros = [];
let jsonpSecuencia = 0;
let alcance = "Hogar";

inicializar();

async function inicializar() {
  cargarRango();

  filtroDesde.addEventListener("change", guardarRangoYRenderizar);
  filtroHasta.addEventListener("change", guardarRangoYRenderizar);
  verTodoBtn.addEventListener("click", limpiarRango);
  sincronizarBtn.addEventListener("click", sincronizar);

  configurarSegmentado("#alcanceSelector", (value) => {
    alcance = value;
    renderizar();
  });

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
    const callbackName = `reportesCallback_${Date.now()}_${jsonpSecuencia++}`;
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

  const metricasActuales = calcularMetricas(actuales);
  const metricasAnteriores = calcularMetricas(anteriores);

  totalIngresos.textContent = moneda(metricasActuales.ingresos);
  totalYessiCompartido.textContent = moneda(metricasActuales.yessiCompartido);
  totalAndyCompartido.textContent = moneda(metricasActuales.andyCompartido);

  if (alcance === "Hogar") {
    document.querySelectorAll("[data-hogar]").forEach((el) => {
      el.classList.remove("hidden-by-scope");
    });

    labelSolo1.textContent = "Yessi solo";
    totalSolo1.textContent = moneda(metricasActuales.yessiSolo);
    labelSolo2.textContent = "Andy solo";
    totalSolo2.textContent = moneda(metricasActuales.andySolo);
    solo2Card.classList.remove("hidden-by-scope");
  } else {
    document.querySelectorAll("[data-hogar]").forEach((el) => {
      el.classList.add("hidden-by-scope");
    });

    labelSolo1.textContent = `${alcance} solo`;
    totalSolo1.textContent = moneda(
      alcance === "Yessi"
        ? metricasActuales.yessiSolo
        : metricasActuales.andySolo
    );
    solo2Card.classList.add("hidden-by-scope");
  }

  totalAhorroARS.textContent = moneda(metricasActuales.ahorroARS);
  totalAhorroUSD.textContent = formatearUSD(metricasActuales.ahorroUSD);

  const gastoTotal =
    metricasActuales.yessiCompartido +
    metricasActuales.andyCompartido +
    metricasActuales.yessiSolo +
    metricasActuales.andySolo;

  const balance =
    metricasActuales.ingresos -
    gastoTotal -
    metricasActuales.ahorroARS;

  balancePeriodo.textContent = moneda(balance);

  const tasa = metricasActuales.ingresos > 0
    ? (metricasActuales.ahorroARS / metricasActuales.ingresos) * 100
    : 0;

  tasaAhorro.textContent = `${tasa.toFixed(1)}%`;

  const dias = calcularDiasSeleccionados();
  promedioDiario.textContent = moneda(dias > 0 ? gastoTotal / dias : 0);
  cantidadMovimientos.textContent = actuales.length;

  renderizarDistribucion(metricasActuales);
  renderizarComparacion(metricasActuales, metricasAnteriores, !!periodoAnterior);
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
  const metricas = {
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

    if (
      registro.categoria === "Yessi Ingreso" ||
      registro.categoria === "Andy Ingreso"
    ) {
      metricas.ingresos += monto;
    }

    if (registro.categoria === "Yessi Compartido") {
      metricas.yessiCompartido += monto;
    }

    if (registro.categoria === "Andy Compartido") {
      metricas.andyCompartido += monto;
    }

    if (registro.categoria === "Yessi Solo") {
      metricas.yessiSolo += monto;
    }

    if (registro.categoria === "Andy Solo") {
      metricas.andySolo += monto;
    }

    if (registro.categoria.endsWith(" Ahorro")) {
      const signo = registro.movimiento === "Retiro" ? -1 : 1;

      if ((registro.moneda || "ARS") === "USD") {
        metricas.ahorroUSD += signo * monto;
      } else {
        metricas.ahorroARS += signo * monto;
      }
    }
  });

  return metricas;
}

function renderizarDistribucion(metricas) {
  let items;

  if (alcance === "Hogar") {
    items = [
      ["Compartidos", metricas.yessiCompartido + metricas.andyCompartido],
      ["Yessi solo", metricas.yessiSolo],
      ["Andy solo", metricas.andySolo],
      ["Ahorro ARS", metricas.ahorroARS]
    ];
  } else {
    const solo = alcance === "Yessi"
      ? metricas.yessiSolo
      : metricas.andySolo;

    const compartido = alcance === "Yessi"
      ? metricas.yessiCompartido
      : metricas.andyCompartido;

    items = [
      ["Compartido", compartido],
      ["Solo", solo],
      ["Ahorro ARS", metricas.ahorroARS]
    ];
  }

  const maximo = Math.max(...items.map(([, valor]) => Math.max(valor, 0)), 1);

  graficoDistribucion.innerHTML = "";

  items.forEach(([nombre, valor]) => {
    const porcentaje = Math.max(0, valor) / maximo * 100;

    const item = document.createElement("div");
    item.className = "bar-item";
    item.innerHTML = `
      <div class="bar-item-head">
        <span class="bar-label">${nombre}</span>
        <span class="bar-value">${moneda(valor)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${porcentaje}%"></div>
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

  let items;

  if (alcance === "Hogar") {
    items = [
      ["Ingresos", actual.ingresos, anterior.ingresos, false],
      ["Yessi compartido", actual.yessiCompartido, anterior.yessiCompartido, true],
      ["Andy compartido", actual.andyCompartido, anterior.andyCompartido, true],
      ["Yessi solo", actual.yessiSolo, anterior.yessiSolo, true],
      ["Andy solo", actual.andySolo, anterior.andySolo, true],
      ["Ahorro ARS", actual.ahorroARS, anterior.ahorroARS, false]
    ];
  } else {
    const actualCompartido = alcance === "Yessi"
      ? actual.yessiCompartido
      : actual.andyCompartido;
    const anteriorCompartido = alcance === "Yessi"
      ? anterior.yessiCompartido
      : anterior.andyCompartido;
    const actualSolo = alcance === "Yessi"
      ? actual.yessiSolo
      : actual.andySolo;
    const anteriorSolo = alcance === "Yessi"
      ? anterior.yessiSolo
      : anterior.andySolo;

    items = [
      ["Ingresos", actual.ingresos, anterior.ingresos, false],
      ["Compartido", actualCompartido, anteriorCompartido, true],
      ["Solo", actualSolo, anteriorSolo, true],
      ["Ahorro ARS", actual.ahorroARS, anterior.ahorroARS, false]
    ];
  }

  items.forEach(([nombre, valorActual, valorAnterior, menorEsMejor]) => {
    let cambio = 0;

    if (valorAnterior !== 0) {
      cambio = ((valorActual - valorAnterior) / Math.abs(valorAnterior)) * 100;
    } else if (valorActual !== 0) {
      cambio = 100;
    }

    const favorable = menorEsMejor ? cambio < 0 : cambio > 0;
    const desfavorable = menorEsMejor ? cambio > 0 : cambio < 0;
    const clase = favorable
      ? "comparison-down"
      : desfavorable
        ? "comparison-up"
        : "comparison-neutral";

    const simbolo = cambio > 0 ? "+" : "";

    const card = document.createElement("article");
    card.className = "comparison-card";
    card.innerHTML = `
      <div class="comparison-card-head">
        <span>${nombre}</span>
        <strong>${moneda(valorActual)}</strong>
      </div>
      <div class="comparison-change ${clase}">
        ${simbolo}${cambio.toFixed(1)}% frente al período anterior
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
    ) {
      return;
    }

    const nombre = registro.lugar || "Sin lugar";
    totales.set(nombre, (totales.get(nombre) || 0) + registro.importe);
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

function calcularDiasSeleccionados() {
  if (!filtroDesde.value || !filtroHasta.value) {
    return 1;
  }

  const desde = new Date(filtroDesde.value + "T00:00:00");
  const hasta = new Date(filtroHasta.value + "T00:00:00");

  return Math.max(
    1,
    Math.round((hasta - desde) / 86400000) + 1
  );
}

function formatearUSD(valor) {
  return "USD " + new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor || 0);
}

function moneda(valor) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
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
