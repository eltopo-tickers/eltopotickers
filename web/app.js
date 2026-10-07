// ELTOPO - Frontend JS

// URL base del API (produccion: cambia a tu URL de Render)
const API_BASE_URL = window.location.hostname === "localhost"
    ? ""
    : "https://eltopotickers.onrender.com";

// ELTOPO - Frontend JS

// -- Tema claro/oscuro --
const themeToggle = document.getElementById("themeToggle");
const root = document.documentElement;

const savedTheme = localStorage.getItem("eltopo-theme");
if (savedTheme) {
    root.setAttribute("data-theme", savedTheme);
    themeToggle.textContent = savedTheme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19";
} else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = prefersDark ? "dark" : "light";
    root.setAttribute("data-theme", initial);
    themeToggle.textContent = initial === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19";
}

themeToggle.addEventListener("click", () => {
    const current = root.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("eltopo-theme", next);
    themeToggle.textContent = next === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19";
});

// -- Modo activo --
let modoActual = "auto";
const modeBtns = document.querySelectorAll(".mode-btn");

modeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        modeBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        modoActual = btn.dataset.mode;
        const ticker = document.getElementById("tickerInput").value.trim();
        if (ticker) analizar(ticker);
    });
});

// -- Buscador con autocompletado e historial --
const btnEscarbar = document.getElementById("btnEscarbar");
const tickerInput = document.getElementById("tickerInput");

// Dropdown
const dropdown = document.createElement("div");
dropdown.className = "autocomplete-dropdown";
dropdown.style.display = "none";
document.querySelector(".search-wrap").appendChild(dropdown);

// Historial
const HISTORIAL_KEY = "eltopo-historial";
let historial = JSON.parse(localStorage.getItem(HISTORIAL_KEY) || "[]");

function guardarHistorial(ticker) {
    historial = historial.filter(t => t !== ticker);
    historial.unshift(ticker);
    if (historial.length > 8) historial = historial.slice(0, 8);
    localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial));
}

function mostrarHistorial() {
    if (historial.length === 0) {
        dropdown.style.display = "none";
        return;
    }
    let html = '<div class="autocomplete-titulo">Busquedas recientes</div>';
    for (const t of historial) {
        html += '<div class="autocomplete-item" data-ticker="' + t + '"><span class="ac-symbol">' + t + '</span></div>';
    }
    dropdown.innerHTML = html;
    dropdown.style.display = "block";
    bindSugerencias();
}

function bindSugerencias() {
    dropdown.querySelectorAll(".autocomplete-item").forEach(item => {
        item.addEventListener("click", () => {
            const ticker = item.dataset.ticker;
            tickerInput.value = ticker;
            dropdown.style.display = "none";
            guardarHistorial(ticker);
            analizar(ticker);
        });
    });
}

// Autocompletado al escribir
let timeoutBuscar = null;
tickerInput.addEventListener("input", () => {
    const q = tickerInput.value.trim();
    if (timeoutBuscar) clearTimeout(timeoutBuscar);

    if (q.length < 1) {
        mostrarHistorial();
        return;
    }

    timeoutBuscar = setTimeout(async () => {
        try {
            const res = await fetch(API_BASE_URL + "/api/buscar?q=" + encodeURIComponent(q));
            const data = await res.json();
            const resultados = data.resultados || [];

            if (resultados.length === 0) {
                dropdown.style.display = "none";
                return;
            }

            let html = "";
            for (const r of resultados) {
                html += '<div class="autocomplete-item" data-ticker="' + r.symbol + '"><span class="ac-symbol">' + r.symbol + '</span><span class="ac-nombre">' + r.nombre + '</span></div>';
            }
            dropdown.innerHTML = html;
            dropdown.style.display = "block";
            bindSugerencias();
        } catch (e) {
            dropdown.style.display = "none";
        }
    }, 200);
});

// Ocultar al hacer click fuera
document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) {
        dropdown.style.display = "none";
    }
});

// Mostrar historial al enfocar
tickerInput.addEventListener("focus", () => {
    if (tickerInput.value.trim().length === 0) {
        mostrarHistorial();
    }
});

// Boton Escarbar
btnEscarbar.addEventListener("click", () => {
    const ticker = tickerInput.value.trim().toUpperCase();
    if (ticker) {
        guardarHistorial(ticker);
        dropdown.style.display = "none";
        analizar(ticker);
    }
});

// Enter
tickerInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        const ticker = tickerInput.value.trim().toUpperCase();
        if (ticker) {
            guardarHistorial(ticker);
            dropdown.style.display = "none";
            analizar(ticker);
        }
    }
});

// -- Analizar --
async function analizar(ticker) {
    const loading = document.getElementById("loading");
    const resultado = document.getElementById("resultado");
    loading.style.display = "block";
    resultado.innerHTML = "";

    try {
        const res = await fetch(API_BASE_URL + "/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticker: ticker, modo: modoActual })
        });
        if (!res.ok) throw new Error("Error " + res.status);
        const data = await res.json();
        renderizar(data);
    } catch (error) {
        resultado.innerHTML = '<div class="card"><p>Error: ' + error.message + '</p></div>';
    } finally {
        loading.style.display = "none";
    }
}

// -- Helpers --
const CLASE_COLOR = {
    "verde_fuerte": "color-verde-fuerte",
    "verde": "color-verde",
    "amarillo": "color-amarillo",
    "gris": "color-gris",
    "naranja": "color-naranja",
    "rojo": "color-rojo"
};

const CLASE_DOT = {
    "verde_fuerte": "dot-verde-fuerte",
    "verde": "dot-verde",
    "amarillo": "dot-amarillo",
    "gris": "dot-gris",
    "naranja": "dot-naranja",
    "rojo": "dot-rojo"
};

function fmtPct(v) {
    if (v === null || v === undefined) return "-";
    return (v * 100).toFixed(2) + "%";
}

function fmtNum(v, dec) {
    if (v === null || v === undefined) return "-";
    if (typeof v !== "number") return String(v);
    return v.toFixed(dec || 2);
}

function fmtBig(v) {
    if (v === null || v === undefined) return "-";
    if (v >= 1e12) return (v / 1e12).toFixed(2) + "T";
    if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
    return v.toString();
}

// -- Renderizar --
function renderizar(data) {
    const resultado = document.getElementById("resultado");
    resultado.innerHTML = "";

    const rec = data.recomendacion_final;
    const ganador = rec && rec.mejor_estrategia ? rec.mejor_estrategia : null;

    // Ticker + fecha
    const header = document.createElement("div");
    header.className = "card card-header-ticker";
    header.innerHTML = '<h2>' + data.ticker + '</h2><p class="fecha">' + data.fecha + ' ' + data.hora + '</p>';
    resultado.appendChild(header);

    // Recomendacion final
    if (rec && rec.mejor_estrategia) {
        const cardRec = document.createElement("div");
        cardRec.className = "card recomendacion color-" + rec.color;
        cardRec.innerHTML = '<h2>RECOMENDACION FINAL</h2><div class="estrategia">' + rec.mejor_estrategia.replace("_", " ").toUpperCase() + '</div><div class="confianza">Score: ' + rec.score + ' | Confianza: ' + rec.confianza + '%</div><div class="card-etiqueta etiqueta-' + rec.color + '">' + rec.mensaje + '</div>';
        resultado.appendChild(cardRec);
    }

    // Semaforo
    const estilosOrden = ["swing", "day_trading", "scalping"];
    const semaforo = document.createElement("div");
    semaforo.className = "card";
    let htmlSemaforo = '<h2>SEMAFORO OPERATIVO</h2><div class="semaforo-lista">';

    for (const nombre of estilosOrden) {
        const estilo = data.estilos[nombre];
        if (!estilo) continue;
        const nombreBonito = nombre.replace("_", " ").toUpperCase();

        if (!estilo.valido) {
            htmlSemaforo += '<div class="semaforo-item semaforo-error"><span class="semaforo-nombre"><span class="dot dot-gris"></span>' + nombreBonito + '</span><span class="semaforo-score">--</span><span class="semaforo-etiqueta">No valido</span></div>';
        } else {
            const dotClase = CLASE_DOT[estilo.color] || "dot-gris";
            const esGanador = (nombre === ganador);
            htmlSemaforo += '<div class="semaforo-item' + (esGanador ? ' semaforo-ganador' : '') + '"><span class="semaforo-nombre"><span class="dot ' + dotClase + '"></span>' + nombreBonito + (esGanador ? ' <span class="star">' + String.fromCharCode(9733) + '</span>' : '') + '</span><span class="semaforo-score">' + estilo.score + '</span><span class="semaforo-etiqueta etiqueta-' + estilo.color + '">' + estilo.etiqueta + '</span></div>';
        }
    }
    htmlSemaforo += '</div>';
    semaforo.innerHTML = htmlSemaforo;
    resultado.appendChild(semaforo);

    // Cards de estilos
    for (const nombre of estilosOrden) {
        const estilo = data.estilos[nombre];
        if (!estilo) continue;
        const esGanador = (nombre === ganador);
        const card = document.createElement("div");
        card.className = "card card-estilo";
        if (estilo.valido) card.classList.add(CLASE_COLOR[estilo.color] || "color-gris");
        if (esGanador) card.classList.add("card-ganador");

        if (!estilo.valido) {
            card.innerHTML = '<h2>' + nombre.replace("_", " ").toUpperCase() + '</h2><p class="fecha">' + (estilo.error || "No valido") + '</p>';
        } else {
            const op = estilo.operativa || {};
            card.innerHTML = '<h2>' + nombre.replace("_", " ").toUpperCase() + (esGanador ? ' <span class="star">' + String.fromCharCode(9733) + '</span>' : '') + '</h2><div class="card-score"><span class="numero-grande">' + estilo.score + '</span><span class="numero-pequeno">/ 10</span><span class="card-etiqueta etiqueta-' + estilo.color + '">' + estilo.etiqueta + '</span></div><div class="card-operativa"><div class="op-item"><span class="label">Entrada:</span><span class="valor-grande">' + op.entrada + '</span></div><div class="op-item"><span class="label">Objetivo:</span><span class="valor-grande">' + op.objetivo + '</span></div><div class="op-item"><span class="label">Stop:</span><span class="valor-grande">' + op.stop + '</span></div><div class="op-item"><span class="label">R:R:</span><span class="valor-grande">1:' + op.rr + '</span></div><div class="op-item"><span class="label">Horizonte:</span><span class="valor">' + op.horizonte + '</span></div><div class="op-item"><span class="label">Riesgo:</span><span class="valor">' + op.riesgo_pct + '%</span></div></div>';
        }
        resultado.appendChild(card);
    }

    // TECNICO DETALLE
    const estiloGanador = ganador ? data.estilos[ganador] : null;
    if (estiloGanador && estiloGanador.valido && estiloGanador.indicadores) {
        const ind = estiloGanador.indicadores;
        const cardT = document.createElement("div");
        cardT.className = "card card-info color-gris";
        let htmlTec = '<h2>TECNICO DETALLE (' + ganador.replace("_", " ").toUpperCase() + ')</h2><div class="info-grid">';

        const campos = [
            ["Precio", ind.precio],
            ["MM200", ind.mm200],
            ["MM50", ind.mm50],
            ["RSI", ind.rsi],
            ["MACD", ind.macd],
            ["ATR", ind.atr],
            ["ADX", ind.adx],
            ["Estocastico K", ind.stoch_k],
            ["VWAP", ind.vwap],
            ["Vol Relativo", ind.vol_relativo],
            ["Fuerza Rel SPY", ind.fuerza_relativa],
            ["POC", ind.poc]
        ];
        for (const [label, valor] of campos) {
            if (valor !== null && valor !== undefined) {
                htmlTec += '<div class="op-item"><span class="label">' + label + ':</span><span class="valor">' + valor.toFixed(2) + '</span></div>';
            }
        }
        htmlTec += '</div>';

        if (ind.pivotes) {
            const p = ind.pivotes;
            htmlTec += '<div class="pivotes-wrap"><h3 style="font-size:12px; color: var(--text-muted); margin: 12px 0 6px;">PIVOTES DIARIOS</h3><div class="info-grid">';
            htmlTec += '<div class="op-item"><span class="label">R2:</span><span class="valor">' + (p.r2 || "-") + '</span></div>';
            htmlTec += '<div class="op-item"><span class="label">R1:</span><span class="valor">' + (p.r1 || "-") + '</span></div>';
            htmlTec += '<div class="op-item"><span class="label">Pivot:</span><span class="valor">' + (p.pivot || "-") + '</span></div>';
            htmlTec += '<div class="op-item"><span class="label">S1:</span><span class="valor">' + (p.s1 || "-") + '</span></div>';
            htmlTec += '<div class="op-item"><span class="label">S2:</span><span class="valor">' + (p.s2 || "-") + '</span></div>';
            htmlTec += '</div></div>';
        }
        cardT.innerHTML = htmlTec;
        resultado.appendChild(cardT);
    }

    // FUNDAMENTAL
    if (data.fundamental && data.fundamental.nombre) {
        const f = data.fundamental;
        const cardF = document.createElement("div");
        cardF.className = "card card-info color-azul";
        cardF.innerHTML = '<h2>FUNDAMENTAL</h2><div class="info-grid">' +
            '<div class="op-item"><span class="label">Empresa:</span><span class="valor">' + (f.nombre || "-") + '</span></div>' +
            '<div class="op-item"><span class="label">Sector:</span><span class="valor">' + (f.sector || "-") + '</span></div>' +
            '<div class="op-item"><span class="label">Ingresos YoY:</span><span class="valor">' + fmtPct(f.ingresos_yoy) + '</span></div>' +
            '<div class="op-item"><span class="label">Beneficios YoY:</span><span class="valor">' + fmtPct(f.beneficios_yoy) + '</span></div>' +
            '<div class="op-item"><span class="label">Margen neto:</span><span class="valor">' + fmtPct(f.margen_neto) + '</span></div>' +
            '<div class="op-item"><span class="label">PER:</span><span class="valor">' + fmtNum(f.per) + '</span></div>' +
            '<div class="op-item"><span class="label">P/S:</span><span class="valor">' + fmtNum(f.ps) + '</span></div>' +
            '<div class="op-item"><span class="label">P/B:</span><span class="valor">' + fmtNum(f.pb) + '</span></div>' +
            '<div class="op-item"><span class="label">ROE:</span><span class="valor">' + fmtPct(f.roe) + '</span></div>' +
            '<div class="op-item"><span class="label">Deuda/Equity:</span><span class="valor">' + fmtNum(f.deuda_equity) + '</span></div>' +
            '<div class="op-item"><span class="label">Dividendo:</span><span class="valor">' + (f.dividend_yield ? f.dividend_yield.toFixed(2) + "%" : "-") + '</span></div>' +
            '<div class="op-item"><span class="label">Market Cap:</span><span class="valor">' + fmtBig(f.market_cap) + '</span></div>' +
            '</div>';
        resultado.appendChild(cardF);
    }

    // SENTIMIENTO
    const s = data.sentimiento || {};
    const cardS = document.createElement("div");
    cardS.className = "card card-info color-violeta";
    let htmlSent = '<h2>SENTIMIENTO</h2><div class="info-grid">';
    if (s.recomendacion_analistas) {
        const r = s.recomendacion_analistas;
        const positivos = (r.strong_buy || 0) + (r.buy || 0);
        const negativos = (r.sell || 0) + (r.strong_sell || 0);
        const total = positivos + (r.hold || 0) + negativos;
        htmlSent += '<div class="op-item"><span class="label">Analistas:</span><span class="valor">' + positivos + ' Buy / ' + (r.hold || 0) + ' Hold / ' + negativos + ' Sell</span></div>';
        htmlSent += '<div class="op-item"><span class="label">Total analistas:</span><span class="valor">' + total + '</span></div>';
        htmlSent += '<div class="op-item"><span class="label">Periodo:</span><span class="valor">' + (r.periodo || "-") + '</span></div>';
    }
    if (s.insider_compras !== null || s.insider_ventas !== null) {
        htmlSent += '<div class="op-item"><span class="label">Insider 90d:</span><span class="valor">' + (s.insider_compras || 0) + ' compras / ' + (s.insider_ventas || 0) + ' ventas</span></div>';
    }
    if (!s.recomendacion_analistas && s.insider_compras === null) {
        htmlSent += '<div class="op-item"><span class="label">Estado:</span><span class="valor">' + (s.nota || "Sin datos") + '</span></div>';
    }
    htmlSent += '</div>';
    cardS.innerHTML = htmlSent;
    resultado.appendChild(cardS);

    // CATALIZADORES
    const c = data.catalizadores || {};
    const cardC = document.createElement("div");
    cardC.className = "card card-info color-rosa";
    let htmlCat = '<h2>CATALIZADORES</h2><div class="info-grid">';
    if (c.proximos_earnings) {
        htmlCat += '<div class="op-item"><span class="label">Proximos earnings:</span><span class="valor">' + c.proximos_earnings + '</span></div>';
        if (c.dias_hasta_earnings !== null && c.dias_hasta_earnings !== undefined) {
            htmlCat += '<div class="op-item"><span class="label">Dias hasta:</span><span class="valor">' + c.dias_hasta_earnings + '</span></div>';
        }
    } else {
        htmlCat += '<div class="op-item"><span class="label">Proximos earnings:</span><span class="valor">Sin fecha</span></div>';
    }
    if (c.historial_earnings && c.historial_earnings.length > 0) {
        const historial = c.historial_earnings;
        const beats = historial.filter(h => (h.sorpresa_pct || 0) > 0).length;
        const misses = historial.length - beats;
        htmlCat += '<div class="op-item"><span class="label">Historial:</span><span class="valor">' + beats + ' beats / ' + misses + ' miss</span></div>';
        const ultimo = historial[0];
        if (ultimo) {
            const sorp = ultimo.sorpresa_pct || 0;
            const emoji = sorp > 0 ? "OK" : "MISS";
            htmlCat += '<div class="op-item"><span class="label">Ultimo resultado:</span><span class="valor">' + sorp.toFixed(2) + '% (' + emoji + ')</span></div>';
        }
    }
    if (!c.proximos_earnings && (!c.historial_earnings || c.historial_earnings.length === 0)) {
        htmlCat += '<div class="op-item"><span class="label">Estado:</span><span class="valor">' + (c.nota || "Sin datos") + '</span></div>';
    }
    htmlCat += '</div>';
    cardC.innerHTML = htmlCat;
    resultado.appendChild(cardC);

    // Grafico
    if (estiloGanador && estiloGanador.valido) {
        const precios = estiloGanador.indicadores ? estiloGanador.indicadores.precios_historicos : null;
        if (precios && precios.length > 0) {
            dibujarGrafico(precios, data.ticker);
        }
    }
}

// -- Grafico --
function dibujarGrafico(precios, ticker) {
    const viejo = document.getElementById("chartContainer");
    if (viejo) viejo.remove();
    if (!precios || precios.length === 0) return;

    const card = document.createElement("div");
    card.className = "card card-info color-azul";
    card.id = "chartContainer";
    card.innerHTML = '<h2>GRAFICO DE PRECIO (ultimos ' + precios.length + ' dias)</h2><canvas id="precioChart" height="120"></canvas>';

    const resultado = document.getElementById("resultado");
    const header = resultado.querySelector(".card-header-ticker");
    if (header && header.nextSibling) {
        resultado.insertBefore(card, header.nextSibling);
    } else {
        resultado.appendChild(card);
    }

    const ctx = document.getElementById("precioChart").getContext("2d");
    new Chart(ctx, {
        type: "line",
        data: {
            labels: precios.map((_, i) => i + 1),
            datasets: [{
                label: ticker,
                data: precios,
                borderColor: "#2563EB",
                backgroundColor: "rgba(37, 99, 235, 0.1)",
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { ticks: { color: "#6B7280" }, grid: { color: "rgba(0,0,0,0.05)" } }
            }
        }
    });
}
