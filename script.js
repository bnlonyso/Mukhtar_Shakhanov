const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const lightbox = document.querySelector('.lightbox');
const lightboxImage = lightbox.querySelector('img');
const lightboxCaption = lightbox.querySelector('p');
const lightboxClose = lightbox.querySelector('.lightbox-close');

menuToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

document.querySelectorAll('.main-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

document.querySelectorAll('.gallery-item').forEach((item) => {
  item.addEventListener('click', () => {
    const image = item.querySelector('img');
    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
    lightboxCaption.textContent = item.dataset.lightbox;
    lightbox.hidden = false;
    document.body.classList.add('locked');
    lightboxClose.focus();
  });
});

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.src = '';
  document.body.classList.remove('locked');
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !lightbox.hidden) closeLightbox();
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.14 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

(function () {
  const chatWidget = document.querySelector('.chat-widget');
  const chatFab = document.querySelector('.chat-fab');
  const chatPanel = document.querySelector('.chat-panel');
  const chatPanelBody = document.querySelector('.chat-panel__body');
  const collapseButton = document.querySelector('.chat-panel__collapse');
  const closeButton = document.querySelector('.chat-panel__close');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');
  const quickActions = document.querySelectorAll('.quick-action');

  const CHAT_API_URL = '/api/chat';

  const state = {
    isOpen: false,
    isMinimized: false,
    isLoading: false,
    history: []
  };

  function buildMessage(role, text) {
    return { role, text, id: String(Date.now() + Math.random()) };
  }

  function formatMarkdown(rawText) {
    if (!rawText) return '';
    // 1. Escape HTML special characters
    let text = String(rawText)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Headings: ### Title or ## Title
    text = text.replace(/^###\s+(.*)$/gm, '<strong style="display:block;margin-top:5px;margin-bottom:2px;color:#f4c15d;">$1</strong>');
    text = text.replace(/^##\s+(.*)$/gm, '<strong style="display:block;margin-top:6px;margin-bottom:3px;color:#f4c15d;">$1</strong>');

    // 3. Bold: **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 4. Bullet lists: lines starting with * or -
    text = text.replace(/^[\*\-]\s+(.*)$/gm, '<div style="margin-left:6px;padding-left:2px;">• $1</div>');

    // 5. Line breaks: preserve multiple and single breaks
    text = text.replace(/\n\n/g, '<div style="height:6px;"></div>');
    text = text.replace(/\n/g, '<br>');

    return text;
  }

  function scrollToBottom(smooth = true) {
    const scrollElem = chatPanelBody || chatMessages;
    if (scrollElem) {
      if (typeof scrollElem.scrollTo === 'function') {
        scrollElem.scrollTo({
          top: scrollElem.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        });
      } else {
        scrollElem.scrollTop = scrollElem.scrollHeight;
      }
    }
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function forceScrollDown() {
    scrollToBottom(false);
    requestAnimationFrame(() => scrollToBottom(true));
    setTimeout(() => scrollToBottom(true), 40);
    setTimeout(() => scrollToBottom(true), 120);
  }

  function renderHistory() {
    chatMessages.innerHTML = '';

    if (!state.history.length) {
      const welcome = buildMessage(
        'assistant',
        'Сәлем! Мен — Шахановтану AI кеңесшісімін. Мұхтар Шахановтың өмірі, шығармашылығы, Желтоқсан шындығы және әндері жайлы сұрақтарыңызға Уикипедия деректерімен қысқа әрі нақты жауап беремін.'
      );
      state.history.push(welcome);
    }

    state.history.forEach((message) => {
      appendMessageToView(message.role, message.text, false);
    });

    forceScrollDown();
  }

  function appendMessageToView(role, text, saveToHistory = true) {
    const wrapper = document.createElement('div');
    wrapper.className = `chat-message chat-message--${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-message__bubble';

    if (role === 'assistant') {
      bubble.innerHTML = formatMarkdown(text);
    } else {
      bubble.textContent = text;
    }

    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);

    if (saveToHistory) {
      state.history.push(buildMessage(role, text));
    }

    forceScrollDown();
  }

  function showTypingIndicator() {
    const typing = document.createElement('div');
    typing.className = 'chat-message chat-message--assistant';
    typing.id = 'typing-indicator';
    typing.innerHTML = '<div class="chat-typing"><span class="chat-typing__dot"></span><span class="chat-typing__dot"></span><span class="chat-typing__dot"></span></div>';
    chatMessages.appendChild(typing);
    forceScrollDown();
  }

  function hideTypingIndicator() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
  }

  function setOpenState(open) {
    state.isOpen = open;
    chatWidget.classList.toggle('open', open);
    chatFab.setAttribute('aria-expanded', String(open));

    if (open) {
      chatInput.focus();
      forceScrollDown();
    }
  }

  function toggleMinimized() {
    state.isMinimized = !state.isMinimized;
    chatPanel.classList.toggle('minimized', state.isMinimized);

    if (!state.isMinimized) {
      chatInput.focus();
      forceScrollDown();
    }
  }

  function normalizeApiResponse(payload) {
    if (typeof payload?.reply === 'string' && payload.reply.trim()) {
      return payload.reply.trim();
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || '')
      .join('')
      .trim();

    return text || 'Кешіріңіз, жауап алу кезінде ақау болды. Сұрағыңызды қайта қойып көріңіз.';
  }

  function localOfflineFallback(input) {
    const text = input.toLowerCase();

    if (/төрт ана|ана|концепци/.test(text)) {
      return '«Төрт ана» — Мұхтар Шахановтың атақты концепциясы. Әр адамның қасиетті 4 анасы: 1) Туған жері; 2) Ана тілі; 3) Салт-дәстүрі; 4) Тарихы. Осы құндылықтарды ұмытқан жан мәңгүртке айналады деп ескерткен.';
    }

    if (/желтоқсан|1986|көтеріліс/.test(text)) {
      return '1986 жылғы Желтоқсан көтерілісі: Мұхтар Шаханов 1989 жылы КСРО депутаттарының I съезінде Желтоқсан шындығын одақтық деңгейде алғаш көтерді. Комиссия құрып, 8 мыңнан астам адамның ұсталғанын дәлелдеп, құрбандардың ақталуына қол жеткізді.';
    }

    if (/шәмші|ән|әндер|вальс/.test(text)) {
      return 'Шәмші Қалдаяқовпен бірлескен атақты әндері: «Бақыт құшағында», «Арыс жағасында», «Отырардағы той», «Көгілдір көктем». Сондай-ақ өз сөзі мен әніне жазылған: «Жұбайлар жыры», «Гүл дәурен», «Мен саған ғашық едім».';
    }

    if (/марапат|орден|атақ|еңбек ері/.test(text)) {
      return 'Басты марапаттары: Қазақстанның Еңбек Ері (2022), Отан ордені (2022), Халық жазушысы (1996), Қырғызстанның халық ақыны (1994), Данакер ордені (2024), Ленин комсомолы сыйлығы (1982).';
    }

    if (/туған|қашан|қайда|өмірбаян/.test(text)) {
      return 'Мұхтар Шаханов 1942 жылы 2 шілдеде Түркістан облысы, Төле би ауданы, Қасқасу ауылында туған. Қыпшақ тайпасы, Торы руы, Көкмұрын бөлімінен. Әкесі — Досбол Шаханов.';
    }

    return 'Мұхтар Шаханов (1942 ж.т.) — аса көрнекті қазақ ақыны, драматургі, қоғам қайраткері, Қазақстанның Еңбек Ері. Желтоқсан шындығын ашушы, мемлекеттік тіл күрескері және «Төрт ана» концепциясының авторы.';
  }

  async function sendToApi(messageText) {
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: messageText,
        history: state.history.slice(-6)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async function handleSubmit(event) {
    if (event) event.preventDefault();

    const messageText = chatInput.value.trim();
    if (!messageText || state.isLoading) return;

    appendMessageToView('user', messageText, true);
    chatInput.value = '';
    state.isLoading = true;
    showTypingIndicator();
    forceScrollDown();

    try {
      const data = await sendToApi(messageText);
      const reply = normalizeApiResponse(data);
      hideTypingIndicator();
      appendMessageToView('assistant', reply, true);
    } catch (error) {
      console.warn('Chat API error, fallback triggered:', error);
      hideTypingIndicator();
      const fallbackReply = localOfflineFallback(messageText);
      appendMessageToView('assistant', fallbackReply, true);
    } finally {
      state.isLoading = false;
      forceScrollDown();
      chatInput.focus();
    }
  }

  chatFab.addEventListener('click', () => {
    const open = !state.isOpen;
    setOpenState(open);
    if (open) {
      if (state.isMinimized) {
        toggleMinimized();
      }
      forceScrollDown();
    }
  });

  collapseButton.addEventListener('click', () => {
    toggleMinimized();
  });

  closeButton.addEventListener('click', () => {
    setOpenState(false);
    if (state.isMinimized) {
      state.isMinimized = false;
      chatPanel.classList.remove('minimized');
    }
  });

  quickActions.forEach((button) => {
    button.addEventListener('click', () => {
      const text = button.textContent.trim();
      setOpenState(true);
      if (state.isMinimized) {
        state.isMinimized = false;
        chatPanel.classList.remove('minimized');
      }
      chatInput.value = text;
      handleSubmit();
    });
  });

  chatForm.addEventListener('submit', handleSubmit);

  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  });

  renderHistory();
  setOpenState(false);
})();
