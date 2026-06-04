const API = 'http://2.27.4.124:4000/api';

function showToast(msg, type = 'success') {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const icon = type === 'success' ? '&#10003;' : '&#10007;';
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// Перенаправление на страницу входа (для неавторизованных)
function requireAuth(customMessage = 'Сначала войдите в личный кабинет') {
    if (!localStorage.getItem('currentUser')) {
        showToast(customMessage, 'error');
        setTimeout(() => {
            const isPagesDir = window.location.pathname.includes('/pages/');
            window.location.href = (isPagesDir ? '' : 'pages/') + 'login.html';
        }, 1500);
        return false;
    }
    return true;
}

// Мобильное меню
const burger = document.querySelector('.burger');
const nav = document.querySelector('nav');

const navOverlay = document.createElement('div');
navOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:97;display:none;backdrop-filter:blur(2px);transition:opacity .28s;';
document.body.appendChild(navOverlay);

function closeNav() {
    if (nav) {
        nav.style.pointerEvents = 'none';
        nav.classList.remove('open');
        setTimeout(() => { nav.style.pointerEvents = ''; }, 350);
    }
    navOverlay.style.display = 'none';
    if (burger) burger.classList.remove('active');
}

if (burger && nav) {
    burger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = nav.classList.toggle('open');
        navOverlay.style.display = isOpen ? 'block' : 'none';
        burger.classList.toggle('active', isOpen);
    });
    navOverlay.addEventListener('click', closeNav);
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
}

// Активный пункт меню
document.querySelectorAll('nav a').forEach(link => {
    if (link.href === location.href || location.pathname === new URL(link.href).pathname) {
        link.classList.add('active');
    }
});

// Модальные окна
function openModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Модалка категории (для главной страницы) — показывает все услуги категории
function openCategoryModal(category, items) {
    const old = document.getElementById('service-detail-modal');
    if (old) old.remove();

    const minPrice = Math.min(...items.map(s => s.price_from));

    const categoryDescriptions = {
        'Ремонт телефонов':     'Профессиональный ремонт смартфонов всех марок: Apple, Samsung, Xiaomi, Huawei и других. Используем оригинальные запчасти, даём гарантию на все виды работ.',
        'Ремонт ноутбуков':     'Ремонт ноутбуков любых брендов: Lenovo, ASUS, HP, Dell, Acer, Apple MacBook. Чистка, замена матриц, установка ОС, ремонт плат.',
        'Ремонт телевизоров':   'Ремонт телевизоров LED, OLED, QLED всех производителей. Замена подсветки, ремонт плат, восстановление изображения и звука.',
        'Ремонт холодильников': 'Ремонт холодильников на дому и в сервисе. Работаем с техникой Bosch, Samsung, LG, Indesit, Atlant и другими брендами.',
        'Ремонт кондиционеров': 'Ремонт и обслуживание кондиционеров всех типов: сплит-системы, мульти-сплит, кассетные. Заправка фреоном, чистка, замена запчастей.',
    };

    const desc = categoryDescriptions[category] || 'Профессиональный ремонт с гарантией на все виды работ.';

    const serviceRows = items.map(s => {
        const safeName = s.name.replace(/'/g, "\'");
        const priceStr = s.price_to && s.price_to > s.price_from
            ? `${s.price_from.toLocaleString()} — ${s.price_to.toLocaleString()} руб.`
            : `от ${s.price_from.toLocaleString()} руб.`;
        return `
            <div class="cat-modal-service-row" onclick="document.getElementById('service-detail-modal').remove(); document.body.style.overflow=''; openServiceModal(window.__servicesData['${safeName}'])">
                <div class="cat-modal-service-info">
                    <div class="cat-modal-service-icon">${getServiceIcon(s.name)}</div>
                    <span class="cat-modal-service-name">${s.name}</span>
                </div>
                <div class="cat-modal-service-price">${priceStr}</div>
            </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'service-detail-modal';
    modal.innerHTML = `
        <div class="modal svc-modal-large">
            <button class="modal-close svc-modal-close-top" id="service-modal-close">&#10005;</button>

            <div class="svc-modal-hero">
                <div class="svc-modal-category">Категория услуг</div>
                <h2 class="svc-modal-title">${category}</h2>
                <div class="svc-modal-price">от ${minPrice.toLocaleString()} руб.</div>
            </div>

            <div class="svc-modal-body">
                <div class="svc-modal-section">
                    <p style="font-size:15px; color:var(--text); line-height:1.65; margin:0;">${desc}</p>
                </div>

                <div class="svc-modal-section">
                    <h4 class="svc-modal-section-title">Услуги и цены</h4>
                    <div class="cat-modal-services-list">
                        ${serviceRows}
                    </div>
                </div>

                <div class="svc-modal-section svc-modal-advantages">
                    <div class="svc-adv-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Оригинальные запчасти
                    </div>
                    <div class="svc-adv-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Диагностика перед ремонтом
                    </div>
                    <div class="svc-adv-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Гарантия 1 год
                    </div>
                    <div class="svc-adv-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Работаем с 2016 года
                    </div>
                </div>

                <div class="svc-modal-actions">
                    <button class="btn btn-primary svc-modal-order" id="svc-modal-order-btn">
                        Записаться на ремонт
                    </button>
                    <button class="btn svc-modal-cancel" id="service-modal-close2">Закрыть</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const closeModal = () => { modal.remove(); document.body.style.overflow = ''; };
    modal.querySelector('#service-modal-close').addEventListener('click', closeModal);
    modal.querySelector('#service-modal-close2').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    modal.querySelector('#svc-modal-order-btn').addEventListener('click', () => {
        closeModal();
        openAppointmentWithService('', category);
    });
}

// Открыть модальное окно с подробным описанием услуги
function openServiceModal(serviceData) {
    const old = document.getElementById('service-detail-modal');
    if (old) old.remove();

    const s = serviceData;
    const priceStr = s.price_to && s.price_to > s.price_from
        ? `от ${Number(s.price_from).toLocaleString()} — ${Number(s.price_to).toLocaleString()} руб.`
        : `от ${Number(s.price_from).toLocaleString()} руб.`;

    const warrantyHtml = s.warranty ? `
        <div class="svc-info-card">
            <div class="svc-info-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
                <div class="svc-info-label">Гарантия</div>
                <div class="svc-info-val">${s.warranty}</div>
            </div>
        </div>` : '';

    const durationHtml = s.duration ? `
        <div class="svc-info-card">
            <div class="svc-info-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
                <div class="svc-info-label">Срок ремонта</div>
                <div class="svc-info-val">${s.duration}</div>
            </div>
        </div>` : '';

    const descHtml = s.description
        ? s.description.split('. ').filter(Boolean).map(sentence =>
            `<li>${sentence.trim().replace(/\.?$/, '')}.</li>`
          ).join('')
        : '<li>Описание услуги уточняйте у мастера.</li>';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'service-detail-modal';
    modal.innerHTML = `
        <div class="modal svc-modal-large">
            <button class="modal-close svc-modal-close-top" id="service-modal-close">&#10005;</button>

            <div class="svc-modal-hero">
                <div class="svc-modal-category">${s.category}</div>
                <h2 class="svc-modal-title">${s.name}</h2>
                <div class="svc-modal-price">${priceStr}</div>
            </div>

            <div class="svc-modal-body">
                <div class="svc-modal-section">
                    <h4 class="svc-modal-section-title">Что включает услуга</h4>
                    <ul class="svc-desc-list">${descHtml}</ul>
                </div>

                ${(warrantyHtml || durationHtml) ? `
                <div class="svc-modal-section">
                    <h4 class="svc-modal-section-title">Условия</h4>
                    <div class="svc-info-grid">
                        ${warrantyHtml}
                        ${durationHtml}
                    </div>
                </div>` : ''}

                <div class="svc-modal-section svc-modal-advantages">
                    <div class="svc-adv-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Оригинальные запчасти
                    </div>
                    <div class="svc-adv-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Диагностика перед ремонтом
                    </div>
                    <div class="svc-adv-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Письменная гарантия
                    </div>
                    <div class="svc-adv-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Работаем с 2016 года
                    </div>
                </div>

                <div class="svc-modal-actions">
                    <button class="btn btn-primary svc-modal-order" id="svc-modal-order-btn">
                        Записаться на ремонт
                    </button>
                    <button class="btn svc-modal-cancel" id="service-modal-close2">
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Закрытие
    const closeModal = () => {
        modal.remove();
        document.body.style.overflow = '';
    };
    modal.querySelector('#service-modal-close').addEventListener('click', closeModal);
    modal.querySelector('#service-modal-close2').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Кнопка "Записаться"
    modal.querySelector('#svc-modal-order-btn').addEventListener('click', () => {
        closeModal();
        openAppointmentWithService(s.name, s.category);
    });
}

// Открыть форму записи с предзаполненной услугой
function openAppointmentWithService(serviceName, category) {
    if (!requireAuth('Для записи нужно войти в аккаунт')) return;

    openModal('appointment-modal');

    const form = document.getElementById('appointment-form');
    if (!form) return;

    // Подставляем название услуги в поле "услуга"
    const serviceTypeInput = form.querySelector('[name="service_type"]');
    if (serviceTypeInput) {
        serviceTypeInput.value = serviceName;
    }

    // Пытаемся выбрать подходящий тип устройства по категории
    const deviceSelect = form.querySelector('[name="device_type"]');
    if (deviceSelect && category) {
        const cat = category.toLowerCase();
        const map = {
            'смартфон': 'Смартфон',
            'телефон': 'Смартфон',
            'ноутбук': 'Ноутбук',
            'телевизор': 'Телевизор',
            'холодильник': 'Холодильник',
            'кондиционер': 'Кондиционер',
        };
        for (const [key, val] of Object.entries(map)) {
            if (cat.includes(key)) {
                deviceSelect.value = val;
                break;
            }
        }
    }
}

document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;

        if (modalId === 'appointment-modal') {
            if (!requireAuth('Для записи нужно войти в аккаунт')) return;
        }

        openModal(modalId);
    });
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay.id);
    });
});

document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) closeModal(modal.id);
    });
});

// ============================================
// ВАЛИДАЦИЯ ФОРМ
// ============================================
function validateForm(form) {
    let isValid = true;
    let firstErrorMsg = '';

    form.querySelectorAll('.error-border').forEach(el => el.classList.remove('error-border'));

    const name = form.querySelector('[name="client_name"], [name="name"]');
    if (name && name.value.trim().length < 2) {
        name.classList.add('error-border');
        isValid = false;
        if (!firstErrorMsg) firstErrorMsg = 'Введите корректное имя';
    }

    const phone = form.querySelector('[name="phone"]');
    if (phone && phone.value.length !== 18) {
        phone.classList.add('error-border');
        isValid = false;
        if (!firstErrorMsg) firstErrorMsg = 'Введите полный номер телефона';
    }

    const selects = form.querySelectorAll('select[required]');
    selects.forEach(select => {
        if (!select.value) {
            select.classList.add('error-border');
            isValid = false;
            if (!firstErrorMsg) firstErrorMsg = 'Выберите значение из списка';
        }
    });

    const date = form.querySelector('input[type="date"][required]');
    if (date && !date.value) {
        date.classList.add('error-border');
        isValid = false;
        if (!firstErrorMsg) firstErrorMsg = 'Выберите дату';
    }
    
    const textareas = form.querySelectorAll('textarea[required]');
    textareas.forEach(textarea => {
        if (textarea.value.trim().length < 5) {
            textarea.classList.add('error-border');
            isValid = false;
            if (!firstErrorMsg) firstErrorMsg = 'Текст должен содержать минимум 5 символов';
        }
    });

    if (!isValid) {
        showToast(firstErrorMsg, 'error');
    }

    return isValid;
}

document.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', () => el.classList.remove('error-border'));
    el.addEventListener('change', () => el.classList.remove('error-border'));
});

// ============================================
// ОТПРАВКА ФОРМ
// ============================================

// Быстрая заявка
const quickForm = document.getElementById('quick-form');
if (quickForm) {
    quickForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!requireAuth('Для отправки заявки нужно войти в аккаунт')) return;
        if (!validateForm(quickForm)) return;

        const btn = quickForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Отправляем...';

        const data = {
            client_name: quickForm.querySelector('[name="client_name"]').value,
            phone: quickForm.querySelector('[name="phone"]').value,
            device_type: quickForm.querySelector('[name="device_type"]').value,
            device_model: quickForm.querySelector('[name="device_model"]')?.value || '',
            service_type: quickForm.querySelector('[name="service_type"]')?.value || '',
            urgency: quickForm.querySelector('[name="urgency"]')?.value || 'normal',
            has_warranty: quickForm.querySelector('[name="has_warranty"]')?.value || '0',
            preferred_date: quickForm.querySelector('[name="preferred_date"]').value,
            preferred_time: quickForm.querySelector('[name="preferred_time"]').value,
            problem: quickForm.querySelector('[name="problem"]')?.value || ''
        };

        try {
            const res = await fetch(`${API}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.success) {
                showToast('Заявка отправлена! Мы перезвоним вам в ближайшее время.');
                quickForm.reset();
                prefillUserData();
            } else {
                showToast(result.message || 'Ошибка при отправке', 'error');
            }
        } catch {
            showToast('Ошибка соединения с сервером', 'error');
        }

        btn.disabled = false;
        btn.textContent = 'Отправить заявку';
    });
}

// Форма онлайн-записи (в модалке) — отправляет в /api/orders
const appointmentForm = document.getElementById('appointment-form');
if (appointmentForm) {
    appointmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!validateForm(appointmentForm)) return;

        const btn = appointmentForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Отправляем...';

        const data = {
            client_name: appointmentForm.querySelector('[name="client_name"]').value,
            phone: appointmentForm.querySelector('[name="phone"]').value,
            device_type: appointmentForm.querySelector('[name="device_type"]').value,
            device_model: appointmentForm.querySelector('[name="device_model"]')?.value || '',
            service_type: appointmentForm.querySelector('[name="service_type"]')?.value || '',
            urgency: appointmentForm.querySelector('[name="urgency"]')?.value || 'normal',
            has_warranty: appointmentForm.querySelector('[name="has_warranty"]')?.value || '0',
            preferred_date: appointmentForm.querySelector('[name="preferred_date"]').value,
            preferred_time: appointmentForm.querySelector('[name="preferred_time"]').value,
            problem: appointmentForm.querySelector('[name="problem"]')?.value || ''
        };

        try {
            const res = await fetch(`${API}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.success) {
                showToast('Заявка отправлена! Мы перезвоним вам в ближайшее время.');
                closeModal('appointment-modal');
                appointmentForm.reset();
                prefillUserData();
            } else {
                showToast(result.message || 'Ошибка', 'error');
            }
        } catch {
            showToast('Ошибка соединения с сервером', 'error');
        }

        btn.disabled = false;
        btn.textContent = 'Записаться';
    });
}

// Загрузка отзывов
async function loadReviews() {
    const container = document.getElementById('reviews-container');
    if (!container) return;

    try {
        const res = await fetch(`${API}/reviews`);
        const result = await res.json();

        if (result.success && result.data.length > 0) {
            container.innerHTML = result.data.map(r => `
                <div class="review-card">
                    <div class="review-top">
                        <div class="review-avatar">${r.client_name[0].toUpperCase()}</div>
                        <div>
                            <div class="review-name">${r.client_name}</div>
                            <div class="review-stars">${'&#9733;'.repeat(r.rating)}${'&#9734;'.repeat(5 - r.rating)}</div>
                        </div>
                    </div>
                    <p>${r.text}</p>
                    ${r.device_type ? `<div class="review-date">${r.device_type}</div>` : ''}
                </div>
            `).join('');
        }
    } catch (e) {
        console.log('Сервер недоступен, показываем статичные отзывы');
    }
}

if (!window.location.pathname.includes('reviews.html')) loadReviews();

// Форма отзыва
let selectedRating = 5;

const starBtns = document.querySelectorAll('.star-btn');
if (starBtns.length > 0) {
    starBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedRating = parseInt(btn.dataset.val);
            starBtns.forEach((s, i) => {
                s.classList.toggle('active', i < selectedRating);
            });
        });
    });
    starBtns.forEach(s => s.classList.add('active'));
}

const reviewForm = document.getElementById('review-form');
if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // ПРОВЕРКА АВТОРИЗАЦИИ
        if (!requireAuth('Войдите в аккаунт, чтобы оставить отзыв')) return;

        if (!validateForm(reviewForm)) return;

        const btn = reviewForm.querySelector('button[type="submit"]');
        btn.disabled = true;

        const data = {
            client_name: reviewForm.querySelector('[name="client_name"]').value,
            rating: selectedRating,
            text: reviewForm.querySelector('[name="text"]').value,
            device_type: reviewForm.querySelector('[name="device_type"]')?.value || ''
        };

        try {
            const res = await fetch(`${API}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            showToast(result.message || 'Спасибо за отзыв!', result.success ? 'success' : 'error');
            if (result.success) {
                reviewForm.reset();
                prefillUserData(); // Снова заполняем имя и телефон
            }
        } catch {
            showToast('Ошибка соединения с сервером', 'error');
        }

        btn.disabled = false;
    });
}

// ============================================
// ДИНАМИЧЕСКАЯ ЗАГРУЗКА УСЛУГ И ЦЕН
// ============================================

// Функция подбора иконок для карточек услуг
function getServiceIcon(name) {
    const n = name.toLowerCase();

    // Экран / дисплей
    if (n.includes('\u044d\u043a\u0440\u0430\u043d') || n.includes('\u043c\u0430\u0442\u0440\u0438\u0446') || n.includes('\u0434\u0438\u0441\u043f\u043b'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
    // Аккумулятор / батарея
    if (n.includes('\u0430\u043a\u043a\u0443\u043c') || n.includes('\u0431\u0430\u0442\u0430\u0440') || n.includes('\u0431\u0430\u0442\u0430\u0440\u0435'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="2" width="12" height="20" rx="1"/><line x1="10" y1="18" x2="14" y2="18"/><line x1="10" y1="6" x2="14" y2="6"/></svg>';
    // Вода / чистка / пыль
    if (n.includes('\u0432\u043e\u0434') || n.includes('\u0447\u0438\u0441\u0442\u043a') || n.includes('\u043f\u044b\u043b\u044c'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>';
    // Разъём / зарядка / кабель
    if (n.includes('\u0440\u0430\u0437\u044a\u0435\u043c') || n.includes('\u0437\u0430\u0440\u044f\u0434') || n.includes('\u043a\u0430\u0431\u0435\u043b') || n.includes('usb'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    // ОС / прошивка / windows / android
    if (n.includes('\u043e\u0441') || n.includes('windows') || n.includes('\u043f\u0440\u043e\u0448\u0438\u0432') || n.includes('android') || n.includes('ios'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>';
    // Подсветка
    if (n.includes('\u043f\u043e\u0434\u0441\u0432\u0435\u0442\u043a'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>';
    // Камера / объектив
    if (n.includes('\u043a\u0430\u043c\u0435\u0440') || n.includes('\u043e\u0431\u044a\u0435\u043a\u0442'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
    // Звук / микрофон / динамик / колонка
    if (n.includes('\u0437\u0432\u0443\u043a') || n.includes('\u043c\u0438\u043a\u0440\u043e') || n.includes('\u0434\u0438\u043d\u0430\u043c') || n.includes('\u043a\u043e\u043b\u043e\u043d\u043a') || n.includes('\u043d\u0430\u0443\u0448\u043d'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    // Корпус / стекло / задняя крышка
    if (n.includes('\u043a\u043e\u0440\u043f\u0443\u0441') || n.includes('\u0441\u0442\u0435\u043a\u043b') || n.includes('\u043a\u0440\u044b\u0448'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>';
    // Клавиатура / кнопки
    if (n.includes('\u043a\u043b\u0430\u0432\u0438\u0430') || n.includes('\u043a\u043d\u043e\u043f\u043a'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h8"/></svg>';
    // Память / диск / SSD / HDD / флешка
    if (n.includes('\u043f\u0430\u043c\u044f\u0442') || n.includes('\u0434\u0438\u0441\u043a') || n.includes('ssd') || n.includes('hdd') || n.includes('\u0444\u043b\u0435\u0448'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>';
    // Восстановление данных
    if (n.includes('\u0434\u0430\u043d\u043d') || n.includes('\u0432\u043e\u0441\u0441\u0442\u0430\u043d'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
    // Диагностика
    if (n.includes('\u0434\u0438\u0430\u0433\u043d'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    // Паяльные работы / пайка / плата
    if (n.includes('\u043f\u0430\u044f') || n.includes('\u043f\u043b\u0430\u0442') || n.includes('\u043c\u0438\u043a\u0440\u043e\u0441'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>';
    // Принтер / картридж / заправка
    if (n.includes('\u043f\u0440\u0438\u043d\u0442') || n.includes('\u043a\u0430\u0440\u0442\u0440') || n.includes('\u0437\u0430\u043f\u0440\u0430\u0432'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
    // Холодильник / компрессор
    if (n.includes('\u0445\u043e\u043b\u043e\u0434') || n.includes('\u043a\u043e\u043c\u043f\u0440\u0435\u0441'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="9" y1="6" x2="9" y2="9"/><line x1="9" y1="14" x2="9" y2="19"/></svg>';
    // Стиральная машина
    if (n.includes('\u0441\u0442\u0438\u0440\u0430\u043b') || n.includes('\u0431\u0430\u0440\u0430\u0431\u0430\u043d'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="7" cy="6" r="1"/></svg>';
    // Кофемашина / кофе
    if (n.includes('\u043a\u043e\u0444'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>';
    // Пила / бензопила / триммер / мотокультиватор
    if (n.includes('\u043f\u0438\u043b') || n.includes('\u0446\u0435\u043f') || n.includes('\u0442\u0440\u0438\u043c') || n.includes('\u043a\u0443\u043b\u044c\u0442') || n.includes('\u043a\u043e\u0441') || n.includes('\u0433\u0430\u0437\u043e\u043d'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12h6l2-9 4 18 2-9h6"/></svg>';
    // Генератор / двигатель
    if (n.includes('\u0433\u0435\u043d\u0435\u0440') || n.includes('\u0434\u0432\u0438\u0433\u0430\u0442') || n.includes('\u043c\u043e\u0442\u043e\u043f'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>';
    // Кондиционер
    if (n.includes('\u043a\u043e\u043d\u0434\u0438\u0446'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="8" rx="2"/><path d="M8 18h.01M12 18h.01M16 18h.01"/><line x1="6" y1="10" x2="18" y2="10"/></svg>';
    // Телевизор
    if (n.includes('\u0442\u0435\u043b\u0435\u0432') || n.includes('\u0442\u0432'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>';
    // Микроволновка
    if (n.includes('\u043c\u0438\u043a\u0440\u043e\u0432') || n.includes('\u0441\u0432\u0447'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="14" rx="2"/><rect x="15" y="10" width="4" height="6" rx="1"/><circle cx="8" cy="13" r="3"/></svg>';
    // Замена (общая)
    if (n.includes('\u0437\u0430\u043c\u0435\u043d'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>';
    // Ноутбук / компьютер
    if (n.includes('\u043d\u043e\u0443\u0442') || n.includes('\u043a\u043e\u043c\u043f\u044c') || n.includes('\u043f\u043a') || n.includes('laptop'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>';
    // Смартфон / планшет / телефон
    if (n.includes('\u0441\u043c\u0430\u0440\u0442') || n.includes('\u043f\u043b\u0430\u043d\u0448') || n.includes('\u0442\u0435\u043b\u0435\u0444') || n.includes('iphone') || n.includes('samsung'))
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>';

    // Дефолт — гаечный ключ
    return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
}

// Загрузка услуг на страницу services.html
async function loadServicesPage() {
    const container = document.getElementById('services-page-container');
    if (!container) return;

    try {
        const res = await fetch(`${API}/services`);
        const result = await res.json();

        if (result.success && result.data.length > 0) {
            // Сохраняем данные в глобальный кэш для модалок
            window.__servicesData = {};
            result.data.forEach(s => { window.__servicesData[s.name] = s; });

            const grouped = result.data.reduce((acc, s) => {
                if (!acc[s.category]) acc[s.category] = [];
                acc[s.category].push(s);
                return acc;
            }, {});

            container.innerHTML = '';

            for (const category in grouped) {
                const section = document.createElement('div');
                section.style.marginBottom = '60px';
                section.innerHTML = `
                    <h2 style="font-size:26px; margin-bottom:32px; padding-bottom:12px; border-bottom:3px solid #e63329; display:inline-block;">${category}</h2>
                    <div class="services-grid">
                        ${grouped[category].map(s => {
                            const safeName = s.name.replace(/'/g, "\\'");
                            const safeCat = category.replace(/'/g, "\\'");
                            return `
                            <div class="service-card" style="cursor:pointer;" onclick="openServiceModal(window.__servicesData['${safeName}'])">
                                <div class="service-icon-wrap">${getServiceIcon(s.name)}</div>
                                <h3>${s.name}</h3>

                                <ul style="list-style:none; padding:0; margin-bottom:15px; display:flex; flex-direction:column; gap:6px;">
                                    <li style="font-size:13px; color:var(--gray); display:flex; align-items:center; gap:8px;">Оригинальные запчасти</li>
                                    <li style="font-size:13px; color:var(--gray); display:flex; align-items:center; gap:8px;">Гарантия на работу</li>
                                </ul>
                                <div class="service-price" style="font-weight:700; color:var(--primary);">
                                    от ${s.price_from.toLocaleString()} руб.
                                    ${s.price_to > s.price_from ? ` — ${s.price_to.toLocaleString()} руб.` : ''}
                                </div>
                                <button class="btn btn-subtle" onclick="event.stopPropagation(); openServiceModal(window.__servicesData['${safeName}'])">
                                    Подробнее
                                </button>
                            </div>`;
                        }).join('')}
                    </div>
                `;
                container.appendChild(section);
            }
        }
    } catch (e) {
        container.innerHTML = '<p>Не удалось загрузить список услуг.</p>';
    }
}

// Загрузка цен на страницу prices.html
async function loadPrices() {
    const tabsEl = document.getElementById('price-tabs');
    const tablesEl = document.getElementById('price-tables');
    if (!tabsEl || !tablesEl) return;

    try {
        const res = await fetch(`${API}/services`);
        const result = await res.json();

        if (result.success) {
            // Обновляем глобальный кэш данных услуг
            window.__servicesData = window.__servicesData || {};
            result.data.forEach(s => { window.__servicesData[s.name] = s; });

            const grouped = result.data.reduce((acc, s) => {
                if (!acc[s.category]) acc[s.category] = [];
                acc[s.category].push(s);
                return acc;
            }, {});

            tabsEl.innerHTML = '';
            tablesEl.innerHTML = '';

            Object.entries(grouped).forEach(([cat, items], idx) => {
                const tabId = 'tab-' + idx;
                tabsEl.innerHTML += `<button class="price-tab ${idx === 0 ? 'active' : ''}" data-tab="${tabId}">${cat}</button>`;
                tablesEl.innerHTML += `
                    <div class="price-table ${idx === 0 ? 'active' : ''}" id="${tabId}">
                        <table>
                            <thead><tr><th>Услуга</th><th>Цена, руб.</th></tr></thead>
                            <tbody>
                                ${items.map(s => {
                                    const safeName = s.name.replace(/'/g, "\\'");
                                    return `
                                    <tr style="cursor:pointer;" onclick="openServiceModal(window.__servicesData && window.__servicesData['${safeName}'] || {name:'${safeName}',price_from:${s.price_from},price_to:${s.price_to||0},category:'${cat.replace(/'/g,"\\'")}'})">
                                        <td>${s.name}</td>
                                        <td class="price-value">от ${s.price_from.toLocaleString()}${s.price_to ? ' — ' + s.price_to.toLocaleString() : ''}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            });

            tabsEl.querySelectorAll('.price-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    tabsEl.querySelectorAll('.price-tab').forEach(t => t.classList.remove('active'));
                    tablesEl.querySelectorAll('.price-table').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    document.getElementById(tab.dataset.tab).classList.add('active');
                });
            });
        }
    } catch (e) {
        console.log('Цены не загружены');
    }
}

// Загрузка услуг на главной странице (по одной карточке на категорию)
async function loadHomeServices() {
    const grid = document.getElementById('home-services-grid');
    if (!grid) return;

    try {
        const res = await fetch(`${API}/services`);
        const result = await res.json();

        if (!result.success || !result.data.length) return;

        // Сохраняем в глобальный кэш
        window.__servicesData = window.__servicesData || {};
        result.data.forEach(s => { window.__servicesData[s.name] = s; });

        // Группируем по категориям
        const grouped = result.data.reduce((acc, s) => {
            if (!acc[s.category]) acc[s.category] = { minPrice: s.price_from, items: [] };
            acc[s.category].items.push(s);
            if (s.price_from < acc[s.category].minPrice) acc[s.category].minPrice = s.price_from;
            return acc;
        }, {});

        grid.innerHTML = Object.entries(grouped).map(([category, data]) => {
            const safeCat = category.replace(/'/g, "\'");
            // Сериализуем items для передачи в onclick
            const itemsJson = JSON.stringify(data.items).replace(/'/g, "\'").replace(/"/g, '&quot;');
            return `
            <div class="service-card" style="cursor:pointer;" onclick="openCategoryModal('${safeCat}', JSON.parse(this.dataset.items));" data-items="${itemsJson}">
                <div class="service-icon-wrap">${getServiceIcon(category)}</div>
                <h3>${category}</h3>
                <ul style="list-style:none; padding:0; margin-bottom:15px; display:flex; flex-direction:column; gap:6px;">
                    ${data.items.slice(0, 5).map(s => `
                        <li style="font-size:13px; color:var(--gray); display:flex; align-items:center; gap:8px;">${s.name}</li>
                    `).join('')}
                </ul>
                <div class="service-price" style="font-weight:700; color:var(--primary);">
                    от ${data.minPrice.toLocaleString()} руб.
                </div>
                <button class="btn btn-subtle" onclick="event.stopPropagation(); openCategoryModal('${safeCat}', JSON.parse(this.closest('.service-card').dataset.items));">
                    Подробнее
                </button>
            </div>`;
        }).join('');

        // Анимация
        grid.querySelectorAll('.service-card').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(24px)';
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            observer.observe(el);
        });

    } catch (e) {
        console.log('Не удалось загрузить услуги на главной');
    }
}

// Запуск функций загрузки данных
loadServicesPage();
loadPrices();
loadHomeServices();

// Загрузка статистики отзывов (рейтинг и количество)
function declineReviews(n) {
    const abs = Math.abs(n) % 100;
    const mod = abs % 10;
    if (abs >= 11 && abs <= 19) return 'отзывов';
    if (mod === 1) return 'отзыв';
    if (mod >= 2 && mod <= 4) return 'отзыва';
    return 'отзывов';
}

async function loadRatingStats() {
    try {
        const res = await fetch(`${API}/reviews`);
        const result = await res.json();
        if (!result.success || !result.data.length) return;

        const reviews = result.data;
        const count = reviews.length;
        const avg = (reviews.reduce((s, r) => s + r.rating, 0) / count).toFixed(1);

        document.querySelectorAll('#hero-rating, #stat-rating-main, #reviews-section-rating').forEach(el => {
            if (el) el.textContent = avg;
        });
        document.querySelectorAll('#hero-count, #reviews-section-count').forEach(el => {
            if (el) el.textContent = count;
        });

        // Склонение слова "отзыв"
        document.querySelectorAll('.reviews-word').forEach(el => {
            if (el) el.textContent = declineReviews(count);
        });
    } catch (e) {
        console.log('Не удалось загрузить статистику отзывов');
    }
}
if (!window.location.pathname.includes('reviews.html')) loadRatingStats();
// ============================================
// АНИМАЦИИ И УТИЛИТЫ
// ============================================

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.adv-card, .service-card, .review-card, .step').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
});

document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('input', function () {
        let v = this.value.replace(/\D/g, '');
        if (v.startsWith('8')) v = '7' + v.slice(1);
        if (v.startsWith('7')) {
            this.value = '+7 (' + v.slice(1, 4) +
                (v.length > 4 ? ') ' + v.slice(4, 7) : '') +
                (v.length > 7 ? '-' + v.slice(7, 9) : '') +
                (v.length > 9 ? '-' + v.slice(9, 11) : '');
        }
    });
});

// ============================================
// ЛИЧНЫЙ КАБИНЕТ И АВТОРИЗАЦИЯ
// ============================================

const userBtn = document.getElementById('user-cabinet-btn');
const userNameSpan = document.getElementById('user-cabinet-name');

function prefillUserData() {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
        const user = JSON.parse(userStr);
        document.querySelectorAll('form').forEach(form => {
            const nameInp = form.querySelector('[name="client_name"], [name="name"]');
            const phoneInp = form.querySelector('[name="phone"]');
            if (nameInp && !nameInp.value) nameInp.value = user.name;
            if (phoneInp && !phoneInp.value) phoneInp.value = user.phone;
        });
    }
}

function checkAuth() {
    const userStr = localStorage.getItem('currentUser');
    if (userStr && userBtn) {
        const user = JSON.parse(userStr);
        userBtn.classList.add('logged-in');
        if (userNameSpan) {
            userNameSpan.textContent = user.name.split(' ')[0];
            userNameSpan.style.display = 'inline';
        }
        prefillUserData();
    }
}
checkAuth();

if (userBtn) {
    userBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const user = localStorage.getItem('currentUser');
        const isPagesDir = window.location.pathname.includes('/pages/');
        const basePath = isPagesDir ? '' : 'pages/';
        window.location.href = user ? basePath + 'cabinet.html' : basePath + 'login.html';
    });
}

const registerPageForm = document.getElementById('register-page-form');
if (registerPageForm) {
    registerPageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm(registerPageForm)) return;
        const btn = registerPageForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        const data = {
            name: registerPageForm.querySelector('[name="name"]').value,
            phone: registerPageForm.querySelector('[name="phone"]').value,
            password: registerPageForm.querySelector('[name="password"]').value
        };
        try {
            const res = await fetch(`${API}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.success) {
                showToast('Регистрация успешна!');
                localStorage.setItem('currentUser', JSON.stringify(result.user));
                setTimeout(() => window.location.href = '../index.html', 1500);
            } else {
                showToast(result.message, 'error');
                btn.disabled = false;
            }
        } catch {
            showToast('Ошибка соединения', 'error');
            btn.disabled = false;
        }
    });
}

const loginPageForm = document.getElementById('login-page-form');
if (loginPageForm) {
    loginPageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm(loginPageForm)) return;
        const btn = loginPageForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        const data = {
            name: loginPageForm.querySelector('[name="name"]').value,
            password: loginPageForm.querySelector('[name="password"]').value
        };
        try {
            const res = await fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.success) {
                showToast('Вход выполнен!');
                localStorage.setItem('currentUser', JSON.stringify(result.user));
                setTimeout(() => window.location.href = '../index.html', 1000);
            } else {
                showToast(result.message, 'error');
                btn.disabled = false;
            }
        } catch {
            showToast('Ошибка соединения', 'error');
            btn.disabled = false;
        }
    });
}