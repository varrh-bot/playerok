// PlayerOK Mini App - Production Version
// Все данные хранятся на сервере - ссылки КОРОТКИЕ!

// Telegram WebApp initialization
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Get bot username from URL parameter
let botUsername = 'playerok_bot'; // Default fallback

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
    
    // Load user data from localStorage as cache
    loadUserDataFromCache();
    
    // Проверяем параметры URL
    const urlParams = new URLSearchParams(window.location.search);
    
    // Если открыли с созданной сделкой (Вариант 2 - через URL параметры)
    if (urlParams.has('deal_created')) {
        const dealId = parseInt(urlParams.get('deal_created'));
        const currency = urlParams.get('currency');
        const amount = parseFloat(urlParams.get('amount'));
        const description = urlParams.get('description') || '';
        const bot = urlParams.get('bot');
        
        if (bot) {
            botUsername = bot;
        }
        
        // Восстанавливаем данные сделки
        currentDeal.createdDeal = {
            currency: currency,
            amount: amount,
            description: description
        };
        
        console.log('Deal created via URL params:', dealId);
        
        // Показываем экран с реальным ID от бота
        showDealCreatedScreen(dealId);
        return;
    }
    
    // Check if opened with deal link (для покупателя)
    const startParam = tg.initDataUnsafe?.start_param;
    if (startParam && startParam.startsWith('deal_')) {
        // ВАЖНО: Получаем ТОЛЬКО ID из ссылки!
        const dealId = parseInt(startParam.replace('deal_', ''));
        console.log('Opening deal:', dealId);
        
        // Показываем экран для покупателя
        showDealForBuyer(dealId);
    }
}

// ==================== API FUNCTIONS ====================

// Send data to Telegram Bot
function sendToBot(data) {
    console.log('Sending to bot:', data);
    try {
        tg.sendData(JSON.stringify(data));
    } catch (e) {
        console.error('Error sending data to bot:', e);
        tg.showAlert('Ошибка отправки данных. Попробуйте еще раз.');
    }
}

// Load user data from localStorage (cache)
function loadUserDataFromCache() {
    const cached = localStorage.getItem('playerok_user_' + userData.userId);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            userData.requisites = data.requisites || {};
            userData.ancTeam = data.ancTeam || false;
            console.log('Loaded user data from cache:', userData);
        } catch (e) {
            console.error('Error loading cached data:', e);
        }
    }
}

// Save user data to localStorage (cache)
function saveUserDataToCache() {
    try {
        localStorage.setItem('playerok_user_' + userData.userId, JSON.stringify({
            requisites: userData.requisites,
            ancTeam: userData.ancTeam
        }));
        console.log('Saved user data to cache');
    } catch (e) {
        console.error('Error saving to cache:', e);
    }
}

// ==================== SCREEN NAVIGATION ====================

function showScreen(screenId) {
    console.log('Showing screen:', screenId);
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');

    // Update Telegram back button
    if (screenId === 'mainScreen') {
        tg.BackButton.hide();
    } else {
        tg.BackButton.show();
        tg.BackButton.onClick(() => {
            handleBackButton(screenId);
        });
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
        'dealCreatedScreen': 'mainScreen'
    };
    
    const backTo = backMap[currentScreen] || 'mainScreen';
    showScreen(backTo);
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
    
    // Save to local cache
    userData.requisites[currency] = value;
    saveUserDataToCache();
    
    // Send to bot
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
            if (buttonId === 'add') {
                showScreen('requisitesScreen');
            }
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
    
    // Сохраняем данные сделки для отображения
    currentDeal.createdDeal = {
        currency: currentDeal.currency,
        amount: amount,
        description: description
    };
    
    // Send to bot to create deal in database
    sendToBot({
        action: 'create_deal',
        currency: currentDeal.currency,
        amount: amount,
        description: description
    });
    
    // Clear inputs
    document.getElementById('dealDescription').value = '';
    document.getElementById('dealAmount').value = '';
    
    // После отправки данных бот создаст сделку и отправит кнопку для получения ссылки
    // Приложение закроется, а при нажатии на кнопку откроется с параметрами deal_created
    tg.close();
}

// ==================== DEAL CREATED SCREEN ====================

// Глобальная переменная для хранения ID созданной сделки
let lastCreatedDealId = null;

// Функция будет вызвана когда бот вернет ID созданной сделки через URL параметры
function onDealCreated(dealId) {
    lastCreatedDealId = dealId;
    showDealCreatedScreen(dealId);
}

function showDealCreatedScreen(dealId) {
    // ID всегда приходит от бота через URL параметры
    if (!dealId) {
        console.error('Deal ID is required!');
        tg.showAlert('Ошибка: ID сделки не найден');
        showScreen('mainScreen');
        return;
    }
    
    const dealLink = `https://t.me/${botUsername}?startapp=deal_${dealId}`;
    
    const deal = currentDeal.createdDeal;
    
    // Отображаем информацию о сделке
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
    
    // Устанавливаем ссылку в поле ввода
    document.getElementById('dealLinkInput').value = dealLink;
    
    // Показываем экран
    showScreen('dealCreatedScreen');
}

function copyDealLink() {
    const linkInput = document.getElementById('dealLinkInput');
    
    // Копируем в буфер обмена
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        // Используем современный Clipboard API если доступен
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(linkInput.value).then(() => {
                tg.showPopup({
                    title: '✅ Скопировано!',
                    message: 'Ссылка скопирована в буфер обмена. Отправьте её покупателю.',
                    buttons: [{type: 'ok'}]
                });
            }).catch(() => {
                // Fallback для старых браузеров
                document.execCommand('copy');
                tg.showPopup({
                    title: '✅ Скопировано!',
                    message: 'Ссылка скопирована в буфер обмена.',
                    buttons: [{type: 'ok'}]
                });
            });
        } else {
            // Fallback для старых браузеров
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

// ==================== MY DEALS ====================

function loadMyDeals() {
    showScreen('myDealsScreen');
    
    const container = document.getElementById('dealsListContainer');
    const noDealsMsg = document.getElementById('noDealsMessage');
    
    // В production версии список сделок доступен через бота
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
    
    // В production версии данные о сделке должны загружаться с сервера через бота
    // Пока показываем информацию о том, что нужно сделать
    
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
    
    // Check if user can pay
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
    
    // Сохраняем ID сделки для оплаты
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
            // Send payment to bot
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

// Get status text in Russian
function getStatusText(status) {
    const statusMap = {
        'waiting_buyer': '⏳ Ожидание оплаты',
        'paid': '💰 Оплачено',
        'completed': '✅ Завершено',
        'cancelled': '❌ Отменено'
    };
    return statusMap[status] || status;
}

// Get status CSS class
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

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Debug function for testing
window.debugInfo = function() {
    console.log('=== DEBUG INFO ===');
    console.log('User Data:', userData);
    console.log('Bot Username:', botUsername);
    console.log('Telegram WebApp:', tg);
    console.log('Start Param:', tg.initDataUnsafe?.start_param);
    console.log('Current Deal:', currentDeal);
    console.log('==================');
};

// Test function to activate buyer mode (for testing only)
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
console.log('Type debugInfo() in console for debug information');
console.log('Type activateBuyerMode() to test buyer features');
