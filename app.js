// PlayerOK Mini App - Production Version
// API Integration с Telegram Bot

// Telegram WebApp initialization
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// API Configuration
const API_CONFIG = {
    // В production версии API запросы идут напрямую через Telegram Bot
    // Данные отправляются через tg.sendData()
};

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
    
    // Check if opened with deal link
    const startParam = tg.initDataUnsafe?.start_param;
    if (startParam && startParam.startsWith('deal_')) {
        const dealId = parseInt(startParam.replace('deal_', ''));
        console.log('Opening deal:', dealId);
        loadDealFromServer(dealId);
    }
    
    // Setup Main Button
    tg.MainButton.onClick(() => {
        console.log('Main button clicked');
    });
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
        'viewDealScreen': 'mainScreen'
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
    
    // Show loading (bot will respond with deal link)
    tg.showAlert('Сделка создается... Бот отправит вам ссылку в чат.');
    showScreen('mainScreen');
}

// ==================== MY DEALS ====================

function loadMyDeals() {
    showScreen('myDealsScreen');
    
    // In production, deals are loaded from bot's database
    // For now, show message to use bot
    const container = document.getElementById('dealsListContainer');
    const noDealsMsg = document.getElementById('noDealsMessage');
    
    // Show message to check bot
    container.innerHTML = `
        <div class="alert alert-warning">
            <span style="font-size: 24px;">ℹ️</span>
            <span>Список сделок обновляется через бота. Используйте команду /stats в боте для просмотра ваших сделок.</span>
        </div>
    `;
    noDealsMsg.style.display = 'none';
}

// ==================== VIEW DEAL (BUYER) ====================

function loadDealFromServer(dealId) {
    console.log('Loading deal from server:', dealId);
    showScreen('loadingScreen');
    
    // In production, deal data should be fetched from bot
    // For now, show message
    setTimeout(() => {
        showScreen('viewDealScreen');
        
        document.getElementById('viewDealCard').innerHTML = `
            <div class="alert alert-warning">
                <span style="font-size: 24px;">ℹ️</span>
                <span>Загрузка данных о сделке #${dealId}...</span>
            </div>
            <p style="color: #9CA3AF; margin-top: 16px;">
                Данные о сделке загружаются с сервера. Если сделка не отображается, 
                попросите продавца создать новую ссылку.
            </p>
        `;
        
        // Check if user can pay
        if (!userData.ancTeam) {
            document.getElementById('ancteamWarning').style.display = 'flex';
            document.getElementById('payDealBtn').style.opacity = '0.5';
            document.getElementById('payDealBtn').style.pointerEvents = 'none';
        }
    }, 1000);
}

function payDeal() {
    if (!userData.ancTeam) {
        tg.showAlert('Для оплаты активируйте режим покупателя командой /ancteam в боте');
        return;
    }
    
    // Get deal ID (in real implementation, this would come from loaded deal)
    const startParam = tg.initDataUnsafe?.start_param;
    if (startParam && startParam.startsWith('deal_')) {
        const dealId = parseInt(startParam.replace('deal_', ''));
        
        tg.showPopup({
            title: '💳 Подтверждение оплаты',
            message: 'Подтвердить оплату сделки?',
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
                
                tg.showAlert('Оплата отправлена! Бот уведомит продавца.');
                tg.close();
            }
        });
    }
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
    console.log('==================');
};

console.log('PlayerOK Mini App loaded!');
console.log('Type debugInfo() in console for debug information');
