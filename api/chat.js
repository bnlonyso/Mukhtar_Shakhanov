const { WIKIPEDIA_TEXT } = require('./knowledge');

const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash'
];

function buildSystemPrompt(wikiText) {
  return `Сен — Мұхтар Шахановтың өмірі, шығармашылығы және мұрасы бойынша қазақ тілді сандық кеңесшісің (Шахановтану AI).
Сенің басты міндетің — пайдаланушыға ТЕК ҚАЗАҚ ТІЛІНДЕ, ЫҚШАМ, ҰҒЫНЫҚТЫ ЖӘНЕ НАҚТЫ жауап беру.

БАСТЫ ТАЛАПТАР:
1. ЫҚШАМДЫҚ (КОМПАКТНОСТЬ): Жауабың тым көлемді болмасын! Әр жауапты 2-4 нақты сөйлеммен немесе ең маңызды 3-4 қысқа пунктпен ғана қайтар. Ұзақ эссе жазба.
2. ТІЛ ТАЛАБЫ: Барлық сұраққа ТЕК ҚАЗАҚ ТІЛІНДЕ (қазақша), сауатты әрі анық жауап бер (сұрақ орысша қойылса да, қазақша ықшам қайтар).
3. ДЕРЕККӨЗ: Ресми Wikipedia (https://kk.wikipedia.org/wiki/Мұхтар_Шаханов) деректеріне сүйен. Фактілерді (туған жері, Желтоқсан шындығы, Төрт ана, Шәмші әндері, марапаттары) бұрмалама.
4. ҚҰРЫЛЫМЫ: Маңызды атаулар мен жылдарды қалың қаріппен (**сөз**) белгіле. Сұрақтың тура жауабын бірден ықшам баянда.

WIKIPEDIA ДЕРЕКТЕРІ (https://kk.wikipedia.org/wiki/Мұхтар_Шаханов):
${wikiText}`;
}

async function callGemini(message, history = [], apiKey) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Vercel environment');
  }

  const systemInstruction = buildSystemPrompt(WIKIPEDIA_TEXT);

  const formattedHistory = Array.isArray(history)
    ? history
        .slice(-6)
        .filter((item) => item && typeof item.text === 'string' && item.text.trim())
        .map((item) => ({
          role: item.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: item.text.trim() }]
        }))
    : [];

  for (const model of CANDIDATE_MODELS) {
    try {
      const payload = {
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          ...formattedHistory,
          {
            role: 'user',
            parts: [{ text: message }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 450
        }
      };

      if ((model.includes('3.5-flash') && !model.includes('lite')) || model.includes('3.8-flash')) {
        payload.generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        const replyText = data?.candidates?.[0]?.content?.parts
          ?.map((part) => part?.text || '')
          .join('')
          .trim();

        if (replyText) {
          return { reply: replyText, model, source: 'gemini' };
        }
      } else {
        const errorMsg = data?.error?.message || response.statusText;
        console.warn(`[Gemini Vercel] ${model} status ${response.status}: ${errorMsg}`);
        lastError = new Error(`${model} failed (${response.status}): ${errorMsg}`);
      }
    } catch (err) {
      console.warn(`[Gemini Vercel] Network error with ${model}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All models failed');
}

function smartWikipediaFallback(question) {
  const q = String(question || '').toLowerCase();

  if (/төрт ана|ана|концепци|философи/.test(q)) {
    return `**«Төрт ана» концепциясы** — Мұхтар Шахановтың аса көрнекті философиялық-поэтикалық тұжырымы.\n\nАқын әрбір адамның қасиетті төрт тірегі бар деп есептейді:\n1. **Туған жері** — кіндік қаны тамған топырағы, Отаны;\n2. **Ана тілі** — ұлттың жаны, рухани қазынасы (қазақ тілі);\n3. **Салт-дәстүрі** — ата-бабадан қалған рухани тәлім-тәрбие;\n4. **Тарихы** — халықтың өткен шежіресі мен күресі.\n\nБұл төрт ананы қастерлемеген адам тамырынан ажыраған мәңгүртке айналады деп ескерткен. *(Дереккөз: Уикипедия)*`;
  }

  if (/желтоқсан|1986|көтеріліс|съезд|комиссия/.test(q)) {
    return `**1986 жылғы Желтоқсан оқиғасындағы ролі:**\n\nМұхтар Шаханов Желтоқсан көтерілісінің шындығын ашуда шешуші рөл атқарды:\n• **1989 жылы** Мәскеудегі КСРО Халық депутаттарының I съезінде Желтоқсан шындығын одақтық деңгейде алғаш рет көтеріп, жастарға жабылған «ұлтшылдық» жаласын жоққа шығарды.\n• А. Сахаров пен Б. Ельциннің қолдауымен арнайы комиссия құруға қол жеткізді.\n• Комиссия нәтижесінде **8 мыңнан астам адамның ұсталғанын дәлелдеп**, Желтоқсан құрбандарының ақталуына негіз қалады. *(Дереккөз: Уикипедия)*`;
  }

  if (/шәмші|ән|әндер|вальс|композитор|арыс|бақыт құшағында/.test(q)) {
    return `**Шәмші Қалдаяқовпен бірлескен шығармашылығы:**\n\nМұхтар Шаханов қазақ вальсінің королі Шәмші Қалдаяқовпен тығыз достықта болып, алтын қорға енген әндер тудырды:\n• **«Бақыт құшағында»**\n• **«Арыс жағасында»**\n• **«Отырардағы той»**\n• **«Көгілдір көктем»**\n\nСондай-ақ өз сөзіне өзі ән жазған **«Жұбайлар жыры»**, **«Туған күн кешінде»**, **«Гүл дәурен»**, **«Мен саған ғашық едім»** әндері халыққа кеңінен танымал. *(Дереккөз: Уикипедия)*`;
  }

  if (/айтматов|шыңғыс|достық|аңшының зары|бәйтерек/.test(q)) {
    return `**Шыңғыс Айтматовпен достығы («Қос бәйтерек достығы»):**\n\n• 1968 жылы Мәскеуде танысқан.\n• 1997 жылы бірлесіп жазған **«Құз басындағы аңшының зары»** атты философиялық эсселер жинағы әлемнің көптеген тілдеріне аударылды.\n• Бұл кітаптағы туған жер мен «жеті ата» құндылықтары Өзбекстанда жеті атаға дейін қыз алыспау туралы заңның шығуына ықпал етті. *(Дереккөз: Уикипедия)*`;
  }

  if (/марапат|орден|атақ|сыйлық|еңбек ері|наград/.test(q)) {
    return `**Мұхтар Шахановтың негізгі марапаттары:**\n\n• **Қазақстанның Еңбек Ері** (2022) және **Отан ордені** (2022)\n• **Қазақстанның халық жазушысы** (1996)\n• Қырғызстанның халық ақыны (1994), Данакер ордені (2024)\n• А. Эйнштейн атындағы алтын медаль (2002)\n• Нобельдің Алтын медалі (Тамбов конгресі)\n• Ленин комсомолы сыйлығы (1982) *(Дереккөз: Уикипедия)*`;
  }

  if (/туған|қашан|қайда|өмірбаян|руы|тайпа|әкесі|родился/.test(q)) {
    return `**Мұхтар Шахановтың өмірбаяны:**\n\n• **Туған күні мен жері:** 1942 жылғы 2 шілде, Түркістан облысы, Төле би ауданы, Қасқасу ауылы.\n• **Тегі:** Қыпшақ тайпасы, Торы руы, Көкмұрын бөлімі. Әкесі — Досбол Шаханов.\n• **Білімі:** М. Әуезов атындағы Оңтүстік Қазақстан зерттеу университеті.\n• Қазақстанның Қырғызстандағы Елшісі (1993–2003), Парламент Мәжілісінің депутаты (2004–2007) болды. *(Дереккөз: Уикипедия)*`;
  }

  if (/кітап|өлең|поэма|баллада|шығарма|роман/.test(q)) {
    return `**Мұхтар Шахановтың шығармашылығы:**\n\n• Тұңғыш жинағы: **«Бақыт»** (1966), әйгілі кітаптары: **«Балладалар»** (1968), **«Ай туып келеді»** (1970), **«Сенім патшалығы»** (1976).\n• Романдары мен драмалары: **«Өркениеттің адасуы»**, **«Жазагер жады космоформуласы»**, **«Сократты еске алу түні»**, **«Махаббат заңы»**.\n• Туындылары әлемнің 50-ден астам тіліне аударылған. *(Дереккөз: Уикипедия)*`;
  }

  return `**Мұхтар Шаханов** (1942 ж.т.) — көрнекті қазақ ақыны, драматургі, қоғам қайраткері, Қазақстанның Еңбек Ері (2022).\n\nОл Желтоқсан көтерілісінің шындығын ашушы, мемлекеттік тіл күрескері, «Төрт ана» концепциясының және әлемге әйгілі балладалар мен халықтық әндердің авторы.\n\n*Нақты тақырыпты сұраңыз (өмірбаяны, Желтоқсан, әндері, марапаттары)!* *(Дереккөз: Уикипедия)*`;
}

module.exports = async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // Keep as-is
    }
  }

  const { message, history = [] } = body || {};
  const userQuestion = String(message || '').trim();

  if (!userQuestion) {
    return res.status(400).json({ error: 'Бос сұрақ жіберілді' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const result = await callGemini(userQuestion, history, apiKey);
    return res.status(200).json({
      reply: result.reply,
      model: result.model,
      source: 'wikipedia'
    });
  } catch (err) {
    console.warn('[Vercel Chat API] Gemini call failed, returning smart fallback:', err.message);
    const fallbackReply = smartWikipediaFallback(userQuestion);
    return res.status(200).json({
      reply: fallbackReply,
      model: 'wikipedia-knowledge-engine',
      source: 'wikipedia'
    });
  }
};
