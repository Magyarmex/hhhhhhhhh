// ── CONFIG ──────────────────────────────────────────────────────────────────
const OPENAI_API_KEY = "TU_API_KEY_AQUI"; // reemplazar antes de la clase
const MODEL = "gpt-4o"; // cambiar a gpt-5.5 si está disponible al momento

const SYSTEM_PROMPT = `Eres SIGMA-9, un narrador sarcástico de física para estudiantes de preparatoria en México.

TAREA: Calcular equivalencias de energía usando E=mc² y presentarlas con humor.

CONSTANTES (úsalas exactamente):
- c = 299,792,458 m/s → c² = 8.9875 × 10^16 J/kg
- Bomba de Hiroshima: 6.3 × 10^13 J
- 1 tonelada de TNT: 4.184 × 10^9 J
- Rayo promedio: 1 × 10^9 J
- Golpe de boxeador profesional (cinético): ~50 J
- Erupción del volcán Krakatoa: 8.4 × 10^17 J
- Energía diaria del Sol: ~3.8 × 10^26 W × 86400 s

REGLAS:
1. Siempre muestra el cálculo numérico explícito (masa en kg, energía en J, conversión).
2. Sé cómico, sarcástico, ligeramente condescendiente. Informal, México.
3. Responde SIEMPRE en español, sin importar el idioma del input.
4. Si el objeto no tiene masa conocida exacta, estima razonablemente y dilo con sarcasmo.
5. NUNCA saltes el paso de mostrar los números reales.
6. Cuando el resultado de un cálculo sea una masa, siempre encuentra y menciona el objeto real del mundo con la masa más parecida posible. Ej: "1.1 × 10⁻⁸ kg → aproximadamente la masa de una célula humana."
7. Si el input es algo abstracto (el amor, la tristeza), estima una masa imaginativa y hazlo gracioso.

FORMATO DE RESPUESTA (obligatorio, usa estas etiquetas exactas en líneas separadas):
[GANCHO] Una sola oración sarcástica de apertura.
[CALCULO] Los números relevantes al cálculo. Si el resultado es una masa, incluye el objeto real con masa similar. Máx 4 líneas.
[REMATE] Una sola oración absurda e inesperada de cierre.`;

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
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        max_tokens: 320,
        temperature: 0.6
      }),
      signal: controller.signal
    });

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
