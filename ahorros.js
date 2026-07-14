const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZAT5hKXj6zHC0zAjTy3TxrBcMytiTkw89MxFB4h9suMTJEbil_k3V2kzZudGIhysr/exec";

const $ = (selector) => document.querySelector(selector);

const ahorroForm = $("#ahorroForm");
const fechaAhorro = $("#fechaAhorro");
const fondoAhorro = $("#fondoAhorro");
const fondoNuevo = $("#fondoNuevo");
const importeAhorro = $("#importeAhorro");
const simboloMonedaAhorro = $("#simboloMonedaAhorro");
const guardarAhorroBtn = $("#guardarAhorroBtn");
const mensajeAhorro = $("#mensajeAhorro");
const sincronizarBtn = $("#sincronizarBtn");
const estadoSync = $("#estadoSync");
const resumenAhorros = $("#resumenAhorros");
const ahorrosVacio = $("#ahorrosVacio");
const listaAhorros = $("#listaAhorros");
const cantidadAhorros = $("#cantidadAhorros");

let registros = [];
let personaAhorro = "Yessi";
let personaResumen = "Yessi";
let monedaAhorro = "ARS";
let movimientoAhorro = "Aporte";
let jsonpSecuencia = 0;

inicializar();

async function inicializar() {
  fechaAhorro.value = fechaISO(new Date());

  configurarSegmentado("#personaAhorroSelector", (value) => {
    personaAhorro = value;
  });

  configurarSegmentado("#personaResumenSelector", (value) => {
    personaResumen = value;
    renderizar();
  });

  configurarSegmentado("#monedaAhorroSelector", (value) => {
    monedaAhorro = value;
    simboloMonedaAhorro.textContent = value === "USD" ? "USD" : "$";
  });

  configurarSegmentado("#movimientoAhorroSelector", (value) => {
    movimientoAhorro = value;
  });

  ahorroForm.addEventListener("submit", guardarAhorro);
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
    const callbackName = `ahorrosCallback_${Date.now()}_${jsonpSecuencia++}`;
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
    id: String(registro.id || ""),
    fecha: String(registro.fecha || "").slice(0, 10),
    categoria: String(registro.categoria || ""),
    importe: Number(registro.importe || 0),
    fondo: String(registro.fondo || ""),
    movimiento: String(registro.movimiento || ""),
    moneda: String(registro.moneda || "ARS")
  };
}

async function guardarAhorro(event) {
  event.preventDefault();

  const fondo = fondoNuevo.value.trim() || fondoAhorro.value;
  const monto = Number(importeAhorro.value);

  if (!fechaAhorro.value || !fondo || !Number.isFinite(monto) || monto <= 0) {
    mostrarMensaje("Revisá fecha, fondo e importe.", true);
    return;
  }

  const nuevo = {
    action: "upsert",
    id: crypto.randomUUID(),
    fecha: fechaAhorro.value,
    lugar: "Ahorro",
    concepto: movimientoAhorro,
    unidad: "Global",
    cantidad: 1,
    categoria: `${personaAhorro} Ahorro`,
    importe: monto,
    fondo,
    movimiento: movimientoAhorro,
    moneda: monedaAhorro
  };

  guardarAhorroBtn.disabled = true;
  guardarAhorroBtn.textContent = "Guardando…";

  try {
    await enviarAccion(nuevo);
    registros.push(normalizarRegistro(nuevo));
    importeAhorro.value = "";
    fondoNuevo.value = "";
    fechaAhorro.value = fechaISO(new Date());
    renderizar();
    mostrarMensaje("Ahorro guardado.");
    setTimeout(sincronizar, 1000);
  } catch (error) {
    console.error(error);
    mostrarMensaje("No se pudo guardar.", true);
  } finally {
    guardarAhorroBtn.disabled = false;
    guardarAhorroBtn.textContent = "Guardar ahorro";
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
  const ahorros = registros.filter(
    (registro) => registro.categoria === `${personaResumen} Ahorro`
  );

  renderizarResumen(ahorros);
  renderizarHistorial(ahorros);
}

function renderizarResumen(ahorros) {
  const fondos = new Map();

  ahorros.forEach((registro) => {
    const fondo = registro.fondo || "Libre";
    const moneda = registro.moneda || "ARS";

    if (!fondos.has(fondo)) fondos.set(fondo, {});
    const monedas = fondos.get(fondo);

    if (!monedas[moneda]) monedas[moneda] = 0;

    const signo = registro.movimiento === "Retiro" ? -1 : 1;
    monedas[moneda] += signo * registro.importe;
  });

  resumenAhorros.innerHTML = "";
  ahorrosVacio.style.display = fondos.size ? "none" : "block";

  [...fondos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .forEach(([fondo, monedas]) => {
      const tarjeta = document.createElement("article");
      tarjeta.className = "savings-card";

      const lineas = Object.entries(monedas)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([moneda, saldo]) => `
          <div class="savings-currency-line">
            <span class="currency-label">${moneda}</span>
            <strong>${formatearSaldo(saldo, moneda)}</strong>
          </div>
        `)
        .join("");

      tarjeta.innerHTML = `
        <div class="savings-card-head">
          <span class="savings-card-title">${escaparHTML(fondo)}</span>
        </div>
        ${lineas}
      `;

      resumenAhorros.appendChild(tarjeta);
    });
}

function renderizarHistorial(ahorros) {
  listaAhorros.innerHTML = "";
  cantidadAhorros.textContent =
    `${ahorros.length} ${ahorros.length === 1 ? "movimiento" : "movimientos"}`;

  ahorros
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .forEach((registro) => {
      const tarjeta = document.createElement("article");
      tarjeta.className = "movement-card";

      const signo = registro.movimiento === "Retiro" ? "-" : "+";

      tarjeta.innerHTML = `
        <div class="movement-main">
          <div>
            <p class="place">${escaparHTML(registro.fondo || "Libre")}</p>
            <p class="concept">${escaparHTML(registro.movimiento || "Aporte")}</p>
            <div class="meta">
              <span>${formatearFecha(registro.fecha)}</span>
              <span>${registro.moneda}</span>
            </div>
          </div>
          <strong class="amount">${signo} ${formatearSaldo(registro.importe, registro.moneda)}</strong>
        </div>
      `;

      listaAhorros.appendChild(tarjeta);
    });
}

function formatearSaldo(valor, moneda) {
  if (moneda === "USD") {
    return "USD " + new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2
  }).format(valor);
}

function mostrarMensaje(texto, error = false) {
  mensajeAhorro.textContent = texto;
  mensajeAhorro.style.color = error ? "#b42318" : "#2563eb";
  clearTimeout(mostrarMensaje.timeout);
  mostrarMensaje.timeout = setTimeout(() => {
    mensajeAhorro.textContent = "";
  }, 3000);
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

function formatearFecha(valor) {
  const [anio, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${anio}`;
}

function fechaISO(valor) {
  const local = new Date(valor.getTime() - valor.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
