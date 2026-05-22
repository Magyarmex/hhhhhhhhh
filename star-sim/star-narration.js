const FATE_NAMES = {
  stable:      'estable',
  brownDwarf:  'enana café (sin ignición)',
  whiteDwarf:  'enana blanca',
  neutronStar: 'estrella de neutrones',
  blackHole:   'agujero negro',
};

const FALLBACKS = {
  stable: {
    etapa1: [
      { texto: 'En el núcleo, los átomos de hidrógeno colisionan a millones de grados y se fusionan formando helio.', ancla:'nucleo' },
      { texto: 'Cada fusión libera una pequeña cantidad de energía, pero multiplícala por billones de reacciones por segundo y obtienes una estrella.', ancla:'particulas' },
    ],
    etapa2: [
      { texto: 'Esta estrella mantiene un equilibrio perfecto: la presión de la fusión empuja hacia afuera exactamente igual que la gravedad tira hacia adentro.', ancla:'estrella' },
      { texto: 'Puede continuar así por miles de millones de años más. La física, por una vez, está de buen humor.', ancla:'estrella' },
    ],
  },
  brownDwarf: {
    etapa1: [
      { texto: 'Con tan poca masa, la presión en el núcleo nunca alcanza los 10 millones de grados necesarios para iniciar la fusión.', ancla:'nucleo' },
    ],
    etapa2: [
      { texto: 'Esta enana café no es una estrella en el sentido estricto. Es el intento fallido del universo de hacer una. Técnicamente, es un fracaso cósmico.', ancla:'estrella' },
    ],
  },
  whiteDwarf: {
    etapa1: [
      { texto: 'El núcleo ha consumido casi todo su hidrógeno. La presión de radiación ya no puede sostener el peso de la estrella.', ancla:'nucleo' },
      { texto: 'Las capas externas se hinchan en una gigante roja mientras el núcleo colapsa lentamente.', ancla:'particulas' },
    ],
    etapa2: [
      { texto: 'Las capas externas se dispersan como una nebulosa planetaria, dejando atrás un núcleo compacto del tamaño de la Tierra pero con la masa del Sol.', ancla:'estrella' },
      { texto: 'La enana blanca brillará por miles de millones de años más, enfriándose lentamente hasta apagarse. Triste, pero bonito.', ancla:'estrella' },
    ],
  },
  neutronStar: {
    etapa1: [
      { texto: 'El núcleo ha agotado su combustible. Sin la presión de la fusión, la gravedad colapsa el centro de la estrella en microsegundos.', ancla:'nucleo' },
      { texto: 'Los electrones son forzados dentro de los protones, creando neutrones. El núcleo se vuelve tan denso que una cucharadita pesa mil millones de toneladas.', ancla:'particulas' },
    ],
    etapa2: [
      { texto: 'El colapso rebota en una onda de choque que destruye el resto de la estrella: una supernova.', ancla:'explosion' },
      { texto: 'Lo que queda es una estrella de neutrones. Gira cientos de veces por segundo y emite rayos de radiación como un faro cósmico.', ancla:'estrella' },
    ],
  },
  blackHole: {
    etapa1: [
      { texto: 'Cuando una estrella masiva agota su combustible, nada en el universo puede detener el colapso gravitacional.', ancla:'nucleo' },
      { texto: 'El núcleo se comprime más allá del límite de Chandrasekhar. No hay fuerza conocida que lo detenga.', ancla:'particulas' },
    ],
    etapa2: [
      { texto: 'Una hipernova: la explosión más violenta desde el Big Bang. Destruye todo el sistema planetario en segundos.', ancla:'explosion' },
      { texto: 'El núcleo colapsa hasta una singularidad. Un punto donde la física tal como la conocemos deja de funcionar. El universo tiene sentido del humor oscuro.', ancla:'estrella' },
    ],
  },
};

export class StarNarration {
  constructor() {
    this._voices = [];
    this._esVoice = null;
    this._ttsReady = false;
    this._initTTS();
  }

  _initTTS() {
    if (!window.speechSynthesis) return;
    const load = () => {
      this._voices = speechSynthesis.getVoices();
      this._esVoice = this._voices.find(v => v.lang.startsWith('es')) || null;
      this._ttsReady = true;
    };
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
  }

  async generate(fate, sliderState, physics) {
    const auth = window.__sc;
    if (!auth) return this.getFallback(fate);

    const prompt = `Genera la narración para una simulación de estrella con estos parámetros:
Masa: ${sliderState.mass} M☉, Edad: ${sliderState.age} Gyr, Hidrógeno restante: ${physics.hRemaining.toFixed(1)}%, Destino: ${FATE_NAMES[fate] || fate}.

Devuelve SOLO un objeto JSON válido con esta estructura exacta (sin markdown, sin texto extra):
{"etapa1":[{"texto":"...","ancla":"nucleo"},{"texto":"...","ancla":"particulas"}],"etapa2":[{"texto":"...","ancla":"estrella"},{"texto":"...","ancla":"estrella"}]}

Tono: científico pero accesible para preparatoria mexicana. Español México informal. Máximo 2 oraciones por texto. Menciona los parámetros dados.`;

    try {
      const endpoint = ['https://api','.open','ai.com','/v1/chat/','completions'].join('');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+auth },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role:'user', content:prompt }],
          max_tokens: 400, temperature: 0.7,
        })
      });
      if (!res.ok) throw new Error('api');
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim() || '';
      const json = JSON.parse(text);
      if (json.etapa1 && json.etapa2) return json;
    } catch(e) {
      console.warn('Narration API failed, using fallback');
    }
    return this.getFallback(fate);
  }

  getFallback(fate) {
    return FALLBACKS[fate] || FALLBACKS.stable;
  }

  speak(text) {
    return new Promise(resolve => {
      if (!this._ttsReady || !window.speechSynthesis) {
        setTimeout(resolve, text.length * 55); // estimate reading time
        return;
      }
      speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang  = this._esVoice?.lang || 'es-MX';
      utt.voice = this._esVoice;
      utt.rate  = 0.92;
      utt.pitch = 1.0;
      utt.onend = resolve;
      utt.onerror = resolve;
      speechSynthesis.speak(utt);
    });
  }

  cancel() { window.speechSynthesis?.cancel(); }
}
