// PlayerOK Mini App - Production Version

// Telegram WebApp initialization
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Get bot username from URL parameter
let botUsername = 'playerok_bot';

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('bot')) {
    botUsername = urlParams.get('bot');
}

// User data
let userData = {
    userId: tg.initDataUnsafe?.user?.id || null,
    username: tg.initDataUnsafe?.user?.username || 'User',
    firstName: tg.initDataUnsafe?.user?.first_name || 'User',
    requisites: {},
    ancTeam: false
};

// Current deal state
let currentDeal = {};

// Currency icons mapping
const currencyIcons = {
    'TON': '💎',
    'USDT': '💵',
    'RUB': '₽',
    'STARS': '⭐'
};

// ==================== INITIALIZATION ====================

function init() {
    console.log('Initializing PlayerOK Mini App...');
    console.log('User:', userData);
    
    loadUserDataFromCache();
    
    const urlParams = new URLSearchParams(window.location.search);
    
    // Открытие после создания сделки (бот передаёт deal_created через URL)
    if (urlParams.has('deal_created')) {
        const dealIdStr = urlParams.get('deal_created');
        const dealId = parseInt(dealIdStr);
        const currency = urlParams.get('currency');
        const amount = parseFloat(urlParams.get('amount'));
        const description = decodeURIComponent(urlParams.get('description') || '');
        const bot = urlParams.get('bot');
        
        if (!dealId || isNaN(dealId)) {
            console.error('Invalid deal ID:', dealIdStr);
            tg.showAlert('Ошибка: некорректный ID сделки');
            return;
        }
        
        if (bot) botUsername = bot;
        
        currentDeal.createdDeal = { currency, amount, description };
        currentDeal.createdDealId = dealId;
        
        showDealCreatedScreen(dealId);
        return;
    }
    
    // Открытие как покупатель по ссылке (start_param = deal_<id>)
    const startParam = tg.initDataUnsafe?.start_param;
    if (startParam && startParam.startsWith('deal_')) {
        const dealId = parseInt(startParam.replace('deal_', ''));
        console.log('Opening deal for buyer:', dealId);
        showDealForBuyer(dealId);
    }
}

// ==================== API FUNCTIONS ====================

function sendToBot(data) {
    console.log('Sending to bot:', data);
    try {
        tg.sendData(JSON.stringify(data));
    } catch (e) {
        console.error('Error sending data to bot:', e);
        tg.showAlert('Ошибка отправки данных. Попробуйте еще раз.');
    }
}

function loadUserDataFromCache() {
    const cached = localStorage.getItem('playerok_user_' + userData.userId);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            userData.requisites = data.requisites || {};
            userData.ancTeam = data.ancTeam || false;
        } catch (e) {
            console.error('Error loading cached data:', e);
        }
    }
}

function saveUserDataToCache() {
    try {
        localStorage.setItem('playerok_user_' + userData.userId, JSON.stringify({
            requisites: userData.requisites,
            ancTeam: userData.ancTeam
        }));
    } catch (e) {
        console.error('Error saving to cache:', e);
    }
}

// ==================== SCREEN NAVIGATION ====================

// BUG FIX #2: убираем старый обработчик BackButton перед добавлением нового
let _backButtonHandler = null;

function showScreen(screenId) {
    console.log('Showing screen:', screenId);
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'mainScreen') {
        tg.BackButton.hide();
        if (_backButtonHandler) {
            tg.BackButton.offClick(_backButtonHandler);
            _backButtonHandler = null;
        }
    } else {
        tg.BackButton.show();
        // Удаляем предыдущий обработчик прежде чем добавить новый
        if (_backButtonHandler) {
            tg.BackButton.offClick(_backButtonHandler);
        }
        _backButtonHandler = () => handleBackButton(screenId);
        tg.BackButton.onClick(_backButtonHandler);
    }
}

function handleBackButton(currentScreen) {
    const backMap = {
        'requisitesScreen': 'mainScreen',
        'addRequisiteScreen': 'requisitesScreen',
        'enterRequisiteScreen': 'addRequisiteScreen',
        'currencyScreen': 'mainScreen',
        'dealDetailsScreen': 'currencyScreen',
        'myDealsScreen': 'mainScreen',
        'dealDetailScreen': 'myDealsScreen',
        'viewDealScreen': 'mainScreen',
        'dealCreatedScreen': 'mainScreen',
        'inviteScreen': 'dealCreatedScreen'
    };
    
    showScreen(backMap[currentScreen] || 'mainScreen');
}

// ==================== REQUISITES ====================

function loadRequisites() {
    showScreen('requisitesScreen');
    updateRequisitesList();
}

function updateRequisitesList() {
    const list = document.getElementById('requisitesList');
    const currencies = ['TON', 'USDT', 'RUB', 'STARS'];
    
    let html = '';
    currencies.forEach(currency => {
        const value = userData.requisites[currency];
        const hasValue = value && value.trim() !== '';
        
        html += `
            <div class="requisite-item ${hasValue ? 'active' : 'inactive'}">
                <div class="requisite-info">
                    <div class="requisite-currency">${currencyIcons[currency]} ${currency}</div>
                    <div class="requisite-value">${hasValue ? value : 'Не указано'}</div>
                </div>
                <div class="requisite-status">${hasValue ? '✅' : '❌'}</div>
            </div>
        `;
    });
    
    list.innerHTML = html;
}

function selectRequisiteCurrency(currency) {
    currentDeal.requisiteCurrency = currency;
    
    const titles = {
        'TON': '💎 TON адрес',
        'USDT': '💵 USDT адрес (TRC20)',
        'RUB': '₽ Номер банковской карты',
        'STARS': '⭐ STARS реквизиты'
    };
    
    const placeholders = {
        'TON': 'UQAbc...xyz',
        'USDT': 'TRXabc...xyz',
        'RUB': '1234 5678 9012 3456',
        'STARS': 'Введите реквизиты'
    };
    
    document.getElementById('requisiteTitle').innerHTML = titles[currency];
    document.getElementById('requisiteLabel').textContent = `${currency} реквизиты:`;
    document.getElementById('requisiteInput').placeholder = placeholders[currency];
    document.getElementById('requisiteInput').value = userData.requisites[currency] || '';
    
    showScreen('enterRequisiteScreen');
}

function saveRequisite() {
    const currency = currentDeal.requisiteCurrency;
    const value = document.getElementById('requisiteInput').value.trim();
    
    if (!value) {
        tg.showAlert('Пожалуйста, введите реквизиты');
        return;
    }
    
    userData.requisites[currency] = value;
    saveUserDataToCache();
    
    sendToBot({
        action: 'save_requisite',
        currency: currency,
        requisite: value
    });
    
    updateRequisitesList();
    showScreen('requisitesScreen');
}

// ==================== DEAL CREATION ====================

function checkRequisitesAndCreateDeal() {
    const hasAnyRequisite = Object.values(userData.requisites).some(v => v && v.trim() !== '');
    
    if (!hasAnyRequisite) {
        tg.showPopup({
            title: '⚠️ Необходимы реквизиты',
            message: 'Для создания сделки сначала укажите ваши реквизиты для получения оплаты.',
            buttons: [
                {id: 'add', type: 'default', text: 'Добавить реквизиты'},
                {type: 'cancel'}
            ]
        }, (buttonId) => {
            if (buttonId === 'add') showScreen('requisitesScreen');
        });
        return;
    }
    
    showScreen('currencyScreen');
}

function selectCurrency(currency) {
    currentDeal.currency = currency;
    document.getElementById('selectedCurrencyIcon').textContent = currencyIcons[currency];
    showScreen('dealDetailsScreen');
}

function createDeal() {
    const description = document.getElementById('dealDescription').value.trim();
    const amount = parseFloat(document.getElementById('dealAmount').value);
    
    if (!description) {
        tg.showAlert('Пожалуйста, введите описание сделки');
        return;
    }
    
    if (!amount || amount <= 0) {
        tg.showAlert('Пожалуйста, введите корректную сумму');
        return;
    }
    
    currentDeal.createdDeal = {
        currency: currentDeal.currency,
        amount: amount,
        description: description
    };
    
    sendToBot({
        action: 'create_deal',
        currency: currentDeal.currency,
        amount: amount,
        description: description
    });
    
    document.getElementById('dealDescription').value = '';
    document.getElementById('dealAmount').value = '';
    
    // sendData автоматически закрывает приложение
    // Бот отправит кнопку с URL deal_created для повторного открытия
    tg.close();
}

// ==================== DEAL CREATED SCREEN ====================

function showDealCreatedScreen(dealId) {
    console.log('showDealCreatedScreen called with dealId:', dealId);
    
    if (!dealId || isNaN(dealId)) {
        console.error('Deal ID is invalid!', dealId);
        tg.showAlert('Ошибка: ID сделки не найден');
        showScreen('mainScreen');
        return;
    }
    
    if (!currentDeal.createdDeal) {
        console.error('currentDeal.createdDeal is not defined!');
        tg.showAlert('Ошибка: данные сделки не найдены');
        showScreen('mainScreen');
        return;
    }
    
    const dealLink = `https://t.me/${botUsername}?startapp=deal_${dealId}`;
    const deal = currentDeal.createdDeal;
    
    // Сохраняем ID для экрана приглашения
    currentDeal.createdDealId = dealId;
    
    document.getElementById('createdDealInfo').innerHTML = `
        <div class="deal-id">Сделка #${dealId}</div>
        <div class="deal-row">
            <span class="deal-label">Валюта:</span>
            <span class="deal-value">${currencyIcons[deal.currency]} ${deal.currency}</span>
        </div>
        <div class="deal-row">
            <span class="deal-label">Сумма:</span>
            <span class="deal-value deal-amount">${deal.amount}</span>
        </div>
        <div class="deal-row">
            <span class="deal-label">Описание:</span>
            <span class="deal-value">${deal.description}</span>
        </div>
        <div class="deal-row">
            <span class="deal-label">Статус:</span>
            <span class="status status-waiting">⏳ Ожидание оплаты</span>
        </div>
    `;
    
    document.getElementById('dealLinkInput').value = dealLink;
    showScreen('dealCreatedScreen');
}

function copyDealLink() {
    const linkInput = document.getElementById('dealLinkInput');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(linkInput.value).then(() => {
                tg.showPopup({
                    title: '✅ Скопировано!',
                    message: 'Ссылка скопирована в буфер обмена. Отправьте её покупателю.',
                    buttons: [{type: 'ok'}]
                });
            }).catch(() => {
                document.execCommand('copy');
                tg.showPopup({
                    title: '✅ Скопировано!',
                    message: 'Ссылка скопирована в буфер обмена.',
                    buttons: [{type: 'ok'}]
                });
            });
        } else {
            document.execCommand('copy');
            tg.showPopup({
                title: '✅ Скопировано!',
                message: 'Ссылка скопирована в буфер обмена.',
                buttons: [{type: 'ok'}]
            });
        }
    } catch (err) {
        console.error('Error copying:', err);
        tg.showAlert('Ошибка копирования. Попробуйте выделить и скопировать вручную.');
    }
}

// ==================== INVITE TO DEAL ====================

function showInviteScreen() {
    // Переходим на экран приглашения
    document.getElementById('inviteDealId').textContent = currentDeal.createdDealId || '?';
    document.getElementById('inviteUsernameInput').value = '';
    document.getElementById('inviteError').style.display = 'none';
    showScreen('inviteScreen');
}

function sendInvitation() {
    const rawInput = document.getElementById('inviteUsernameInput').value.trim();
    const errorEl = document.getElementById('inviteError');
    const dealId = currentDeal.createdDealId;

    // Валидация
    if (!rawInput) {
        errorEl.textContent = 'Введите @username покупателя';
        errorEl.style.display = 'block';
        return;
    }

    // Убираем @ если есть, и проверяем формат
    const username = rawInput.replace(/^@/, '');
    if (username.length < 3 || username.length > 32 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        errorEl.textContent = 'Некорректный username. Используйте только буквы, цифры и _';
        errorEl.style.display = 'block';
        return;
    }

    if (!dealId) {
        errorEl.textContent = 'Ошибка: ID сделки не найден';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';

    // Отправляем приглашение боту
    sendToBot({
        action: 'invite_to_deal',
        deal_id: dealId,
        invitee_username: username
    });

    // sendData закрывает приложение, бот ответит сообщением
    tg.close();
}

// ==================== MY DEALS ====================

function loadMyDeals() {
    showScreen('myDealsScreen');
    
    const container = document.getElementById('dealsListContainer');
    const noDealsMsg = document.getElementById('noDealsMessage');
    
    container.innerHTML = `
        <div class="alert alert-warning">
            <span style="font-size: 24px;">ℹ️</span>
            <span>Используйте команду /stats в боте для просмотра ваших сделок</span>
        </div>
        <p style="color: #9CA3AF; margin-top: 16px; text-align: center;">
            В этой версии все сделки управляются через Telegram бота для максимальной безопасности.
        </p>
    `;
    noDealsMsg.style.display = 'none';
}

// ==================== VIEW DEAL (BUYER) ====================

function showDealForBuyer(dealId) {
    console.log('Showing deal for buyer:', dealId);
    showScreen('viewDealScreen');
    
    document.getElementById('viewDealCard').innerHTML = `
        <div class="deal-id">Сделка #${dealId}</div>
        <div class="alert alert-warning" style="margin: 16px 0;">
            <span style="font-size: 24px;">ℹ️</span>
            <span>Данные о сделке загружаются с сервера</span>
        </div>
        <p style="color: #9CA3AF;">
            Детали сделки #${dealId} будут отображены после загрузки с сервера.
        </p>
    `;
    
    const canPay = userData.ancTeam;
    
    if (!canPay) {
        document.getElementById('error404Warning').style.display = 'flex';
        document.getElementById('payDealBtn').style.opacity = '0.5';
        document.getElementById('payDealBtn').style.pointerEvents = 'none';
    } else {
        document.getElementById('error404Warning').style.display = 'none';
        document.getElementById('payDealBtn').style.opacity = '1';
        document.getElementById('payDealBtn').style.pointerEvents = 'auto';
    }
    
    currentDeal.viewingDealId = dealId;
}

function payDeal() {
    if (!userData.ancTeam) {
        tg.showAlert('Error 404 - Access denied');
        return;
    }
    
    const dealId = currentDeal.viewingDealId;
    
    if (!dealId) {
        tg.showAlert('Ошибка: ID сделки не найден');
        return;
    }
    
    tg.showPopup({
        title: '💳 Подтверждение оплаты',
        message: `Подтвердить оплату сделки #${dealId}?`,
        buttons: [
            {id: 'confirm', type: 'default', text: 'Оплатить'},
            {type: 'cancel'}
        ]
    }, (buttonId) => {
        if (buttonId === 'confirm') {
            sendToBot({
                action: 'pay_deal',
                deal_id: dealId
            });
            
            tg.showPopup({
                title: '✅ Отправлено',
                message: 'Запрос на оплату отправлен боту. Вы получите подтверждение в чате.',
                buttons: [{type: 'ok'}]
            }, () => {
                tg.close();
            });
        }
    });
}

// ==================== UTILITY FUNCTIONS ====================

function getStatusText(status) {
    const statusMap = {
        'waiting_buyer': '⏳ Ожидание оплаты',
        'paid': '💰 Оплачено',
        'completed': '✅ Завершено',
        'cancelled': '❌ Отменено'
    };
    return statusMap[status] || status;
}

function getStatusClass(status) {
    const classMap = {
        'waiting_buyer': 'status-waiting',
        'paid': 'status-paid',
        'completed': 'status-completed',
        'cancelled': 'status-error'
    };
    return classMap[status] || 'status-waiting';
}

// ==================== INITIALIZE APP ====================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Debug
window.debugInfo = function() {
    console.log('=== DEBUG INFO ===');
    console.log('User Data:', userData);
    console.log('Bot Username:', botUsername);
    console.log('Start Param:', tg.initDataUnsafe?.start_param);
    console.log('Current Deal:', currentDeal);
    console.log('==================');
};

window.activateBuyerMode = function() {
    userData.ancTeam = true;
    saveUserDataToCache();
    console.log('Buyer mode activated!');
    tg.showPopup({
        title: '✅ Активировано',
        message: 'Режим покупателя активирован! (для теста)',
        buttons: [{type: 'ok'}]
    });
};

console.log('PlayerOK Mini App loaded!');
