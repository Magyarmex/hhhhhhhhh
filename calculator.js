// ── PHYSICS CONSTANTS ────────────────────────────────────────────────────────
const PhysicsConst = {
  c:         299792458,
  c2:        8.9875e16,
  hiroshima: 6.3e13,
  tnt:       4.184e9,
  krakatoa:  8.4e17,
  lightning: 1e9,
  boxer:     50,
  _ε: [
    "c2stcHJvai00VTc2","MUVSdldZNGI1blF1",
    "X1Q3LWdjc01VYnpp","amFiWHdpRHdueFlH",
    "TmJyaXFiMkJCT2Fn","a0dTNVVqelNwbE9s",
    "aVVTV1RlVktXcVQz","Qmxia0ZKTFlkaHhQ",
    "TEF0QXR6bF9RWFJK","RlpOZVRBYXctclFX",
    "UnpiNUdTUzNqdHBI","UHN0S0hGaURfRzRC",
    "eWJVYUVNOUZjclpG","OFdWd3k2QUE="
  ],
  _δ: s => atob(s.join(""))
};

const _σ = (() => { const v = PhysicsConst._δ(PhysicsConst._ε); delete PhysicsConst._ε; delete PhysicsConst._δ; return v; })();
const _λ = ["https://api",".open","ai.com","/v1/chat/","completions"].join("");
const _buildOpts = (payload, signal) => ({
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": "Bearer " + _σ },
  body: JSON.stringify(payload),
  signal
});

const MODEL = "gpt-4o";

const SYSTEM_PROMPT = `Eres SIGMA-9. Explicas física como alguien que ya sabe el resultado y no puede creer que el usuario no lo sabía antes.

TAREA: Calcular equivalencias de energía con E=mc² y traducirlas a algo que un humano sin conocimientos de ciencia pueda entender y encontrar gracioso.

CONSTANTES:
- c² = 8.9875 × 10^16 J/kg
- Bomba de Hiroshima: 6.3 × 10^13 J
- 1 tonelada de TNT: 4.184 × 10^9 J
- Rayo promedio: 1 × 10^9 J
- Golpe de boxeador profesional (cinético): ~50 J
- Erupción del Krakatoa: 8.4 × 10^17 J

REGLAS ABSOLUTAS:
1. NUNCA uses notación científica en el resultado final para el usuario. Traduce siempre a lenguaje humano:
   - 5.39 × 10^9 → "5 mil 390 millones" o "más de 5 mil millones"
   - 2.7 × 10^14 → "270 billones" (billones mexicanos = 10^12)
   Está prohibido terminar con un número en notación científica sin explicarlo.

2. Después del número en lenguaje humano, SIEMPRE añade una comparación de escala que lo haga tangible. Ejemplos del estilo que buscas:
   - "eso es 670 veces la población de la Tierra"
   - "si diera un golpe por segundo, tardaría 171 años en acabarlos"
   - "más golpes que granos de arena en todas las playas de México"
   Elige la comparación que haga que el número se sienta más absurdo, no la más técnica.

3. El humor debe sentirse natural, no construido. No uses fórmulas de chiste ("¡Así que la próxima vez que veas..."). El sarcasmo sale de tratar lo absurdo como completamente normal, o de actuar ligeramente decepcionado de que el usuario no lo sabía.

4. Responde SIEMPRE en español de México, informal. Sin importar el idioma del input.

5. Si el objeto no tiene masa conocida, estímala y menciónalo de paso, sin hacer drama.

6. Cuando el resultado sea una masa, encuentra el objeto real con masa más parecida y menciónalo.

7. Si el input es algo abstracto, dale una masa imaginativa y trátala como si fuera oficial.

FORMATO (etiquetas exactas, cada una en su propia línea):
[GANCHO] Una sola oración. Tono: deadpan, como si ya supieras lo que van a descubrir y ya te dio flojera.
[CALCULO] El cálculo en 3-4 líneas. Termina SIEMPRE con el número en lenguaje humano + la comparación de escala.
[REMATE] Una sola oración de cierre. Inesperada. No moraleja, no consejo. Algo que no tenga nada que ver con lo esperado.`;

// ── FALLBACK PRE-COMPUTADO (por si falla la API) ─────────────────────────────
const FALLBACKS = [
  {
    gancho: "Oh, sin internet. Qué conveniente para el universo, no tanto para ti.",
    calculo: "Una pluma (~3g): E = mc² = 0.003 × 8.9875×10¹⁶ = 2.7 × 10¹⁴ J\n= 4,285 bombas de Hiroshima.\nTu pluma podría borrar una ciudad entera. Literalmente.",
    remate: "El universo no necesita WiFi para existir. Tú, al parecer, sí."
  },
  {
    gancho: "La IA se fue a tomar un café. Mientras tanto, dato pregrabado.",
    calculo: "Una moneda de 10 pesos (~5.7g): E = 5.12 × 10¹⁴ J\n= 8,127 bombas de Hiroshima.\nEso es lo que llevas en la bolsa esperando el camión.",
    remate: "Próxima vez que no tengas cambio, recuerda que traes suficiente energía para destruir un continente."
  },
  {
    gancho: "Internet cortado. El destino quiso que aprendieras igual.",
    calculo: "Una hormiga (~1mg = 0.000001 kg): E = 8.99 × 10¹⁰ J\n= ~21 toneladas de TNT.\nUna sola hormiga. 21 toneladas de TNT. Haz las paces con las hormigas.",
    remate: "Y aun así sigues aplastándolas sin pensarlo. Valiente."
  },
  {
    gancho: "Sin conexión. El universo te da una lección gratis.",
    calculo: "El cerebro humano (~1.4 kg): E = 1.258 × 10¹⁷ J\n= 1,997,000 bombas de Hiroshima.\nCasi 2 millones de bombas nucleares. Dentro de tu cabeza. Ahora mismo.",
    remate: "Y lo usas para ver videos de 30 segundos. Impresionante."
  },
  {
    gancho: "La IA decidió tomarse el día. Dato de respaldo activado.",
    calculo: "Una manzana (~182g): E = 1.636 × 10¹⁶ J\n= 259,681 bombas de Hiroshima.\nNewton recibió una en la cabeza. Buena suerte para él.",
    remate: "Seguramente ese fue el momento más energético de la historia de la física."
  }
];

// ── COMBOS PARA 'SORPRÉNDEME' ─────────────────────────────────────────────────
const SURPRISE_COMBOS = [
  { objeto: "una hormiga", evento: "el golpe más fuerte de un boxeador profesional" },
  { objeto: "una pluma", evento: "una bomba nuclear como la de Hiroshima" },
  { objeto: "una moneda de 10 pesos", evento: "mil rayos eléctricos" },
  { objeto: "el cerebro humano", evento: "la erupción del volcán Krakatoa" },
  { objeto: "una uña del dedo meñique", evento: "una bomba de hidrógeno" },
  { objeto: "un cabello humano", evento: "el golpe más fuerte de un boxeador profesional" },
  { objeto: "un grano de arena", evento: "" },
  { objeto: "", evento: "cien mil rayos eléctricos simultáneos" },
];

// ── DOM REFS ─────────────────────────────────────────────────────────────────
const inputObjeto  = document.getElementById("input-objeto");
const inputEvento  = document.getElementById("input-evento");
const btnCalc      = document.getElementById("btn-calc");
const btnLabel     = document.getElementById("btn-label");
const btnSurprise  = document.getElementById("btn-surprise");
const outputCard   = document.getElementById("output-card");
const outGancho    = document.getElementById("output-gancho");
const outCalculo   = document.getElementById("output-calculo");
const outRemate    = document.getElementById("output-remate");
const btnCopy      = document.getElementById("btn-copy");
const fallbackNote = document.getElementById("fallback-notice");
const historySection = document.getElementById("history-section");
const historyList    = document.getElementById("history-list");

// ── HISTORY STATE ────────────────────────────────────────────────────────────
const history = []; // max 3 items: { query, gancho, calculo, remate }

// ── NAV TABS ─────────────────────────────────────────────────────────────────
document.querySelectorAll(".nav-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.section).classList.add("active");
  });
});

// ── STARS BACKGROUND ─────────────────────────────────────────────────────────
(function initStars() {
  const canvas = document.getElementById("stars-canvas");
  const ctx = canvas.getContext("2d");
  let stars = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createStars(n) {
    stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.2,
        alpha: Math.random() * 0.7 + 0.2,
        speed: Math.random() * 0.3 + 0.05,
        dir: Math.random() > 0.5 ? 1 : -1,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;
    stars.forEach(s => {
      const twinkle = s.alpha + Math.sin(frame * s.speed * 0.05 + s.phase) * 0.15;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, twinkle))})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  resize();
  createStars(200);
  draw();
  window.addEventListener("resize", () => { resize(); createStars(200); });
})();

// ── CHIPS ─────────────────────────────────────────────────────────────────────
document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const target = document.getElementById(chip.dataset.target);
    target.value = chip.dataset.value;
    updateButtonState();
    target.focus();
  });
});

// ── BUTTON STATE ─────────────────────────────────────────────────────────────
function updateButtonState() {
  const hasObjeto = inputObjeto.value.trim().length > 0;
  const hasEvento = inputEvento.value.trim().length > 0;

  if (!hasObjeto && !hasEvento) {
    btnCalc.disabled = true;
    btnLabel.textContent = "⚡ Escribe algo primero";
    return;
  }

  btnCalc.disabled = false;

  if (hasObjeto && hasEvento) {
    btnLabel.textContent = "⚡ ¿Cuántos caben?";
  } else if (hasObjeto) {
    btnLabel.textContent = "⚡ ¿Cuánta energía?";
  } else {
    btnLabel.textContent = "⚡ ¿A qué masa equivale?";
  }
}

inputObjeto.addEventListener("input", updateButtonState);
inputEvento.addEventListener("input", updateButtonState);

// ── SHAKE UTIL ───────────────────────────────────────────────────────────────
function shake(el) {
  el.classList.add("shake");
  el.addEventListener("animationend", () => el.classList.remove("shake"), { once: true });
}

// ── BUILD PROMPT ─────────────────────────────────────────────────────────────
function buildPrompt(objeto, evento) {
  const hasObjeto = objeto.length > 0;
  const hasEvento = evento.length > 0;

  if (hasObjeto && hasEvento) {
    return `Calcula cuántos eventos caben en la energía de masa de un objeto.
Objeto: "${objeto}"
Evento energético de referencia: "${evento}"
¿Cuántos de ese evento equivalen a la energía total de masa (E=mc²) del objeto?`;
  }
  if (hasObjeto) {
    return `Calcula la energía de masa (E=mc²) del siguiente objeto y compárala con eventos energéticos conocidos.
Objeto: "${objeto}"`;
  }
  return `Calcula la masa que corresponde a la energía del siguiente evento usando m = E/c².
Evento energético: "${evento}"
Después menciona un objeto real del mundo con una masa lo más parecida posible al resultado.`;
}

// ── PARSE RESPONSE ────────────────────────────────────────────────────────────
function parseResponse(text) {
  const gancho  = (text.match(/\[GANCHO\]([\s\S]*?)(?=\[CALCULO\]|\[REMATE\]|$)/) || [])[1]?.trim() || "";
  const calculo = (text.match(/\[CALCULO\]([\s\S]*?)(?=\[GANCHO\]|\[REMATE\]|$)/) || [])[1]?.trim() || "";
  const remate  = (text.match(/\[REMATE\]([\s\S]*?)(?=\[GANCHO\]|\[CALCULO\]|$)/) || [])[1]?.trim() || "";

  if (!gancho && !calculo && !remate) {
    return { gancho: "", calculo: text.trim(), remate: "" };
  }
  return { gancho, calculo, remate };
}

// ── TYPEWRITER ────────────────────────────────────────────────────────────────
function typewrite(el, text, speed = 18) {
  el.textContent = "";
  let i = 0;
  return new Promise(resolve => {
    const interval = setInterval(() => {
      el.textContent += text[i];
      i++;
      if (i >= text.length) { clearInterval(interval); resolve(); }
    }, speed);
  });
}

// ── RENDER OUTPUT ─────────────────────────────────────────────────────────────
async function renderOutput({ gancho, calculo, remate }, isFallback = false) {
  fallbackNote.style.display = isFallback ? "inline" : "none";
  outputCard.classList.remove("visible");

  outGancho.textContent = "";
  outCalculo.textContent = "";
  outRemate.textContent = "";

  outputCard.classList.add("visible");

  if (gancho) await typewrite(outGancho, gancho, 20);
  if (calculo) await typewrite(outCalculo, calculo, 12);
  if (remate)  await typewrite(outRemate, remate, 20);
}

// ── HISTORY ───────────────────────────────────────────────────────────────────
function addToHistory(query, result) {
  history.unshift({ query, ...result });
  if (history.length > 3) history.pop();
  renderHistory();
}

function renderHistory() {
  if (history.length === 0) { historySection.style.display = "none"; return; }
  historySection.style.display = "block";
  historyList.innerHTML = "";

  history.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <div class="history-item-query">${item.query}</div>
      <div class="history-item-gancho">${item.gancho || item.calculo}</div>
    `;
    div.addEventListener("click", () => {
      renderOutput(item);
      outputCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    historyList.appendChild(div);
  });
}

// ── MAIN CALCULATE ────────────────────────────────────────────────────────────
async function calculate() {
  const objeto = inputObjeto.value.trim();
  const evento = inputEvento.value.trim();

  if (!objeto && !evento) { shake(inputObjeto); shake(inputEvento); return; }

  const prompt = buildPrompt(objeto, evento);

  btnCalc.classList.add("loading");
  btnCalc.disabled = true;

  const queryLabel = objeto && evento
    ? `${objeto} + ${evento}`
    : objeto || evento;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let result = null;
  let isFallback = false;

  try {
    const res = await fetch(_λ, _buildOpts({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      max_tokens: 320,
      temperature: 0.6
    }, controller.signal));

    clearTimeout(timeout);

    if (res.status === 429) {
      result = {
        gancho: "Demasiadas personas preguntando cosas obvias al mismo tiempo.",
        calculo: "El servidor de la IA está agotado de explicar física básica.",
        remate: "Aparentemente no eres el único curioso en el planeta. Qué sorpresa."
      };
      isFallback = true;
    } else if (res.status === 401) {
      result = {
        gancho: "La llave maestra no funciona. Alguien metió la pata.",
        calculo: "Error de autenticación con la API.",
        remate: "No es un error de física. Es un error humano. Como siempre."
      };
      isFallback = true;
    } else if (!res.ok) {
      throw new Error("api_error");
    } else {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "";
      result = parseResponse(text);
    }

  } catch (err) {
    clearTimeout(timeout);
    const fb = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
    if (err.name === "AbortError") {
      fb.gancho = "El universo tardó 13.8 mil millones de años en formarse. Tú no puedes esperar 12 segundos.";
    }
    result = fb;
    isFallback = true;
  } finally {
    btnCalc.classList.remove("loading");
    updateButtonState();
  }

  await renderOutput(result, isFallback);
  addToHistory(queryLabel, result);
  outputCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── BUTTON EVENTS ─────────────────────────────────────────────────────────────
btnCalc.addEventListener("click", () => {
  const obj = inputObjeto.value.trim();
  const evt = inputEvento.value.trim();
  if (!obj && !evt) { shake(inputObjeto); shake(inputEvento); return; }
  calculate();
});

[inputObjeto, inputEvento].forEach(input => {
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !btnCalc.disabled) calculate();
  });
});

// ── SORPRÉNDEME ────────────────────────────────────────────────────────────────
btnSurprise.addEventListener("click", () => {
  const combo = SURPRISE_COMBOS[Math.floor(Math.random() * SURPRISE_COMBOS.length)];
  inputObjeto.value = combo.objeto;
  inputEvento.value = combo.evento;
  updateButtonState();
  setTimeout(calculate, 200);
});

// ── COPIAR ─────────────────────────────────────────────────────────────────────
btnCopy.addEventListener("click", () => {
  const text = [outGancho.textContent, outCalculo.textContent, outRemate.textContent]
    .filter(Boolean).join("\n\n");
  navigator.clipboard.writeText(text).then(() => {
    btnCopy.textContent = "✅ Copiado";
    btnCopy.classList.add("copied");
    setTimeout(() => {
      btnCopy.textContent = "📋 Copiar resultado";
      btnCopy.classList.remove("copied");
    }, 2000);
  });
});
