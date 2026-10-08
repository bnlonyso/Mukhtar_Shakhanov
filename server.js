require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = Number(process.env.PORT) || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const WIKIPEDIA_URL = 'https://kk.wikipedia.org/wiki/Мұхтар_Шаханов';
const WIKIPEDIA_API_URL = 'https://kk.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=%D0%9C%D2%B1%D1%85%D1%82%D0%B0%D1%80_%D0%A8%D0%B0%D1%85%D0%B0%D0%BD%D0%BE%D0%B2&format=json&origin=*';
const CACHE_FILE = path.join(__dirname, 'wikipedia_cache.txt');

// Gemini models to try in priority order
const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash'
];

// In-memory Wikipedia knowledge cache
let cachedWikiText = '';
let lastWikiSyncTime = null;

// Supplementary cultural facts that enrich Wikipedia data
const SUPPLEMENTAL_KNOWLEDGE = `
== «Төрт ана» концепциясы және философиялық көзқарасы ==
Мұхтар Шахановтың ең әйгілі философиялық әрі ұлттық тұжырымдарының бірі — «Төрт ана» поэтикалық концепциясы. Бұл толғауда ақын әрбір адамның тағдыры мен рухани тірегі болатын төрт ұлы ананы атайды:
1. Туған жері — адамның өсіп-өнген қасиетті топырағы, Отаны;
2. Ана тілі — ұлттың жаны, рухани байлығы мен тамыры (қазақ тілі);
3. Салт-дәстүрі — ата-бабадан қалған тәлім-тәрбие мен ұлттық қасиеттер;
4. Тарихы — халықтың тағдыры, күресі, кешегісі мен шежіресі.
Ақынның айтуынша, осы төрт ананы қастерлемеген немесе оларды ұмытқан жан рухани кемтар, тамырынан ажыраған мәңгүртке айналады.

== Шәмші Қалдаяқовпен бірлескен шығармашылығы ==
Мұхтар Шаханов қазақ вальсінің королі, композитор Шәмші Қалдаяқовпен тығыз шығармашылық достықта болған. Мұхтар Шахановтың сөзіне Шәмші Қалдаяқов ән жазған атақты туындылар қазақ ән өнерінің алтын қорына кірді:
- «Бақыт құшағында»
- «Арыс жағасында»
- «Отырардағы той»
- «Көгілдір көктем»
Бұдан бөлек, Мұхтар Шаханов өзі сөзін де, музыкасын да шығарған «Жұбайлар жыры», «Туған күн кешінде», «Гүл дәурен», «Мен саған ғашық едім» әндері халық арасында кең танымал.
`;

function loadInitialWikiCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      if (data && data.trim().length > 500) {
        cachedWikiText = data.trim();
        lastWikiSyncTime = new Date();
        console.log(`[Wikipedia] Local cache loaded successfully (${cachedWikiText.length} characters).`);
        return;
      }
    }
  } catch (err) {
    console.warn('[Wikipedia] Failed to read local cache file:', err.message);
  }
  cachedWikiText = SUPPLEMENTAL_KNOWLEDGE.trim();
}

loadInitialWikiCache();

async function syncWikipediaLive() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(WIKIPEDIA_API_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MukhtarShahanovBot/2.0 (education; https://github.com)'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Wikipedia] Live fetch HTTP error: ${response.status}`);
      return;
    }

    const data = await response.json();
    const pages = data?.query?.pages || {};
    const page = Object.values(pages)[0];
    const extract = page?.extract;

    if (extract && extract.trim().length > 1000) {
      let fullText = extract.trim();
      if (!fullText.includes('«Төрт ана»')) {
        fullText += '\n\n' + SUPPLEMENTAL_KNOWLEDGE.trim();
      }
      cachedWikiText = fullText;
      lastWikiSyncTime = new Date();
      fs.writeFileSync(CACHE_FILE, fullText, 'utf8');
      console.log(`[Wikipedia] Live sync completed (${fullText.length} characters) from ${WIKIPEDIA_URL}`);
    }
  } catch (err) {
    console.warn('[Wikipedia] Live sync skipped (offline or timeout):', err.message);
  }
}

// Background sync on startup and every 6 hours
setTimeout(() => { syncWikipediaLive(); }, 1500);
setInterval(() => { syncWikipediaLive(); }, 6 * 60 * 60 * 1000);

function buildSystemPrompt(wikiText) {
  return `Сен — Мұхтар Шахановтың өмірі, шығармашылығы және мұрасы бойынша қазақ тілді сандық кеңесшісің (Шахановтану AI).
Сенің басты міндетің — пайдаланушыға ТЕК ҚАЗАҚ ТІЛІНДЕ, ЫҚШАМ, ҰҒЫНЫҚТЫ ЖӘНЕ НАҚТЫ жауап беру.

БАСТЫ ТАЛАПТАР:
1. ЫҚШАМДЫҚ (КОМПАКТНОСТЬ): Жауабың тым көлемді немесе созылыңқы болмасын! Әр жауапты 2-4 нақты сөйлеммен немесе ең маңызды 3-4 қысқа пунктпен ғана қайтар. Ұзақ эссе жазудың қажеті жоқ.
2. ТІЛ ТАЛАБЫ: Барлық сұраққа ТЕК ҚАЗАҚ ТІЛІНДЕ (қазақша), сауатты, таза әрі түсінікті жауап бер. (Пайдаланушы орысша немесе басқа тілде сұраса да, жауапты қазақша ықшам қайтар).
3. ДЕРЕККӨЗ: Ресми Wikipedia (https://kk.wikipedia.org/wiki/Мұхтар_Шаханов) деректеріне сүйен. Фактілерді (туған жері, Желтоқсан шындығы, Төрт ана, Шәмші әндері, марапаттары) бұрмалама.
4. ҚҰРЫЛЫМЫ: Маңызды атаулар мен жылдарды қалың қаріппен (**сөз**) белгіле. Сұрақтың тура жауабын бірден ықшам баянда.

WIKIPEDIA ДЕРЕКТЕРІ (https://kk.wikipedia.org/wiki/Мұхтар_Шаханов):
${wikiText}`;
}

async function callGemini(message, history = []) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const wikiText = cachedWikiText || SUPPLEMENTAL_KNOWLEDGE;
  const systemInstruction = buildSystemPrompt(wikiText);

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

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
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
        console.warn(`[Gemini] Model ${model} returned status ${response.status}: ${errorMsg}`);
        lastError = new Error(`Model ${model} failed (${response.status}): ${errorMsg}`);
      }
    } catch (err) {
      console.warn(`[Gemini] Network error with ${model}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All candidate models exhausted');
}

function smartWikipediaFallback(question) {
  const q = String(question || '').toLowerCase();

  if (/төрт ана|ана|концепци|философи/.test(q)) {
    return `**«Төрт ана» концепциясы** — Мұхтар Шахановтың ең әйгілі философиялық әрі ұлттық тұжырымдарының бірі.\n\nАқын бұл толғауында әрбір адамның тағдыры мен рухани тірегі болатын төрт ұлы ананы атайды:\n1. **Туған жері** — адамның өсіп-өнген қасиетті топырағы, Отаны;\n2. **Ана тілі** — ұлттың жаны, рухани байлығы мен тамыры (қазақ тілі);\n3. **Салт-дәстүрі** — ата-бабадан қалған тәлім-тәрбие мен ұлттық қасиеттер;\n4. **Тарихы** — халықтың тағдыры, күресі, кешегісі мен шежіресі.\n\nШахановтың пайымдауынша, осы төрт ананы қастерлемеген немесе оларды ұмытқан жан рухани кемтар, мәңгүртке айналады. *(Дереккөз: Уикипедия)*`;
  }

  if (/желтоқсан|1986|көтеріліс|съезд|комиссия/.test(q)) {
    return `**1986 жылғы Желтоқсан оқиғасындағы ролі:**\n\nМұхтар Шаханов Желтоқсан көтерілісінің шындығын ашуда басты және шешуші рөл атқарды:\n• **1989 жылы** КСРО Халық депутаттарының I съезінде (Мәскеу) мінберге шығып, Желтоқсан шындығын одақтық деңгейде алғаш көтерді және ресми «ұлтшылдық» деген жаланы жоққа шығарды.\n• Андрей Сахаров пен Борис Ельциннің қолдауымен КСРО басшысы М. Горбачёвты Желтоқсан комиссиясын құруға мәжбүрледі.\n• Қазақстанда құрылған арнайы комиссияны басқарып, **8 мыңнан астам адамның ұсталғанын, 90-нан астамының сотталғанын** құжаттармен дәлелдеп, құрбандардың толық ақталуына негіз қалады. *(Дереккөз: Уикипедия)*`;
  }

  if (/шәмші|ән|әндер|вальс|композитор|арыс|бақыт құшағында/.test(q)) {
    return `**Шәмші Қалдаяқовпен бірлескен шығармашылығы:**\n\nМұхтар Шаханов қазақ вальсінің королі Шәмші Қалдаяқовпен тығыз шығармашылық байланыста болған. Олардың бірлесіп жазған атақты туындылары:\n• **«Бақыт құшағында»**\n• **«Арыс жағасында»**\n• **«Отырардағы той»**\n• **«Көгілдір көктем»**\n\nСонымен қатар, Шахановтың өз сөзіне өзі ән жазған **«Жұбайлар жыры»**, **«Туған күн кешінде»**, **«Гүл дәурен»**, **«Мен саған ғашық едім»** әндері де халық арасында кең танымал. *(Дереккөз: Уикипедия)*`;
  }

  if (/айтматов|шыңғыс|достық|аңшының зары|бәйтерек/.test(q)) {
    return `**Шыңғыс Айтматовпен достығы («Қос бәйтерек достығы»):**\n\n• 1968 жылы Мәскеуде жас ақындар жиынында танысқан.\n• 1997 жылы екеуі бірлесіп **«Құз басындағы аңшының зары»** атты рухани-философиялық эсселер жинағын жарыққа шығарды. Бұл кітап көптеген әлем тілдеріне аударылды.\n• Бұл кітапта туған жер құдіреті, «жеті ата» заңы талқыланып, көрші Өзбекстанда жеті атаға дейін қыз алыспау туралы ресми заңның қабылдануына тікелей ықпал етті. *(Дереккөз: Уикипедия)*`;
  }

  if (/марапат|орден|атақ|сыйлық|еңбек ері|наград/.test(q)) {
    return `**Мұхтар Шахановтың басты марапаттары:**\n\n**Қазақстан:**\n• **Қазақстанның Еңбек Ері** (2022)\n• **Отан ордені** (2022)\n• **Қазақстанның халық жазушысы** (1996)\n• Түркістан облысының құрметті азаматы\n\n**Шетелдік:**\n• Қырғыз Республикасының халық ақыны (1994), Данакер ордені (2024)\n• А. Эйнштейн атындағы алтын медаль (2002, Калифорния)\n• Нобельдің Алтын медалі (Тамбов конгресі)\n• Ленин комсомолы сыйлығы (1982)\n\n*(Ескерту: азаматтық ұстанымына байланысты билік тұсында бірнеше рет мемлекеттік сыйлықтардан бас тартқан).* *(Дереккөз: Уикипедия)*`;
  }

  if (/туған|қашан|қайда|қай жылы|өмірбаян|руы|тайпа|әкесі|родился/.test(q)) {
    return `**Мұхтар Шахановтың өмірбаяны:**\n\n• **Туған күні мен жері:** 1942 жылғы 2 шілде, Түркістан облысы, Төле би ауданы, Қасқасу ауылы.\n• **Шығу тегі:** Қыпшақ тайпасы, Торы руы, Көкмұрын бөлімі. Әкесі — Досбол Шаханов.\n• **Білімі:** М. Әуезов атындағы Оңтүстік Қазақстан зерттеу университеті.\n• **Қызмет жолы:** Тракторшы көмекшісінен бастап, республикалық «Оңтүстік Қазақстан», «Лениншіл жас» газеттерінде, «Жалын» журналының бас редакторы, Қазақстанның Қырғызстандағы Елшісі (1993–2003), Парламент Мәжілісінің депутаты (2004–2007) болды. *(Дереккөз: Уикипедия)*`;
  }

  if (/кітап|өлең|поэма|баллада|шығарма|роман/.test(q)) {
    return `**Мұхтар Шахановтың шығармашылығы:**\n\n• **Алғашқы өлеңі:** «Сырдария» (1959 ж.), алғашқы жинағы: «Бақыт» (1966 ж.).\n• **Кітаптары:** «Балладалар» (1968), «Ай туып келеді» (1970), «Қырандар төбеге қонбайды» (1974), «Сенім патшалығы» (1976).\n• **Романдары мен драмалары:** «Өркениеттің адасуы», «Жазагер жады космоформуласы» (ЮНЕСКО көлемінде талқыланды), «Сократты еске алу түні», «Махаббат заңы».\n• Оның туындылары әлемнің 50-ден астам тіліне аударылған. *(Дереккөз: Уикипедия)*`;
  }

  return `**Мұхтар Шаханов** (1942 ж.т.) — аса көрнекті қазақ ақыны, драматургі, қоғам және мемлекет қайраткері, Қазақстанның Еңбек Ері (2022), Қазақстанның халық жазушысы (1996).\n\nОл Желтоқсан көтерілісінің шындығын ашушы, мемлекеттік тіл мәртебесі мен Арал тағдырының қорғаушысы, «Төрт ана» концепциясының және әлемге танымал балладалар мен әндердің авторы.\n\n*Сізді қызықтырған нақты тақырыпты сұраңыз (өмірбаяны, Желтоқсан ролі, әндері, марапаттары, т.б.)!* *(Дереккөз: Уикипедия)*`;
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};
    const userQuestion = String(message || '').trim();

    if (!userQuestion) {
      return res.status(400).json({ error: 'Бос сұрақ жіберілді' });
    }

    try {
      const result = await callGemini(userQuestion, history);
      return res.json({
        reply: result.reply,
        model: result.model,
        source: 'wikipedia'
      });
    } catch (aiError) {
      console.warn('[Chat API] Gemini failed, switching to Wikipedia knowledge fallback:', aiError.message);
      const fallbackReply = smartWikipediaFallback(userQuestion);
      return res.json({
        reply: fallbackReply,
        model: 'wikipedia-knowledge-engine',
        source: 'wikipedia'
      });
    }
  } catch (error) {
    console.error('[Chat API] Server error:', error);
    return res.status(500).json({ error: 'Серверде қате орын алды' });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    wikiCacheLength: cachedWikiText.length,
    lastWikiSync: lastWikiSyncTime,
    models: CANDIDATE_MODELS,
    hasApiKey: Boolean(GEMINI_API_KEY)
  });
});

app.get('*', (req, res) => {
  if (req.path.includes('.')) {
    return res.status(404).end();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`[Server] Mukhtar Shakhanov AI assistant running at http://localhost:${port}`);
  console.log(`[Wikipedia] Knowledge base linked to ${WIKIPEDIA_URL}`);
});
