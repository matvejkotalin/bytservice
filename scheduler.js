/**
 * scheduler.js — Алгоритмы теории расписаний для БытСервис
 *
 * Реализованы:
 *  1. Алгоритм Джонсона (2 этапа: диагностика → ремонт)
 *  2. SPT — Shortest Processing Time (минимальное время обработки)
 *  3. EDD — Earliest Due Date (ближайший дедлайн)
 *  4. Сравнение SPT vs EDD, выбор лучшего по Cmax
 *  5. Учёт оборудования (сдвиг если занято)
 *  6. Перепланирование при срочном заказе
 */

'use strict';

// ─────────────────────────────────────────────
// ВСПОМОГАТЕЛЬНЫЕ УТИЛИТЫ
// ─────────────────────────────────────────────

/**
 * Суммарное время выполнения всех заданий (Cmax — makespan)
 * @param {Array} scheduled  — массив {start_time, end_time} в минутах
 */
function calcMakespan(scheduled) {
    if (!scheduled.length) return 0;
    return Math.max(...scheduled.map(s => s.end_time));
}

/**
 * Суммарное опоздание (sum of tardiness)
 * @param {Array} scheduled  — массив {end_time, deadline_min}
 */
function calcTotalTardiness(scheduled) {
    return scheduled.reduce((sum, s) => {
        const tardiness = Math.max(0, s.end_time - (s.deadline_min ?? Infinity));
        return sum + tardiness;
    }, 0);
}

/**
 * Строим расписание для одного мастера по заданной последовательности заказов.
 * Учитываем занятость оборудования (equipBusy).
 *
 * @param {Array}  sequence      — заказы в нужном порядке
 * @param {number} startMin      — с какой минуты начинаем (от начала дня)
 * @param {Object} equipBusy     — { equipId: freeFromMin } — когда оборудование освободится
 * @returns {{ schedule: Array, equipBusy: Object }}
 */
function buildScheduleForMaster(sequence, startMin = 0, equipBusy = {}) {
    const schedule = [];
    let cursor = startMin; 

    for (const order of sequence) {

        let diagStart = cursor;


        if (order.equipment_id && equipBusy[order.equipment_id] !== undefined) {
            diagStart = Math.max(diagStart, equipBusy[order.equipment_id]);
        }

        const diagEnd = diagStart + (order.diagnosis_time || 30);


        if (order.equipment_id) {
            equipBusy[order.equipment_id] = diagEnd;
        }


        let repairStart = diagEnd;

  
        if (order.equipment_id && equipBusy[order.equipment_id] !== undefined) {
            repairStart = Math.max(repairStart, equipBusy[order.equipment_id]);
        }

        const repairEnd = repairStart + (order.repair_time || 60);

        if (order.equipment_id) {
            equipBusy[order.equipment_id] = repairEnd;
        }

        schedule.push({
            order_id:      order.id,
            client_name:   order.client_name,
            device_type:   order.device_type,
            device_model:  order.device_model,
            problem:       order.problem,
            equipment_id:  order.equipment_id || null,
            priority:      order.priority || 0,
            deadline_min:  order.deadline_min || null,

            diag_start:  diagStart,
            diag_end:    diagEnd,
            repair_start: repairStart,
            end_time:    repairEnd,   
            start_time:  diagStart,   
        });

        cursor = repairEnd;
    }

    return { schedule, equipBusy };
}

// ─────────────────────────────────────────────
// 1. АЛГОРИТМ ДЖОНСОНА (2 мастера / 2 этапа)
// ─────────────────────────────────────────────

/**
 * Алгоритм Джонсона для 2 машин (диагностика + ремонт).
 * Минимизирует общее время выполнения всех заказов (Cmax).
 *
 * Правило:
 *   - Из незапланированных выбираем min(diagnosis_time, repair_time)
 *   - Если min — диагностика → задание в начало очереди
 *   - Если min — ремонт → задание в конец очереди
 *
 * @param {Array} orders
 * @returns {Array} 
 */
function johnsonSort(orders) {
    const remaining = [...orders];
    const front = [];
    const back  = [];

    while (remaining.length) {
        let minVal = Infinity;
        let minIdx = -1;
        let minStage = null; 

        remaining.forEach((o, i) => {
            const d = o.diagnosis_time || 30;
            const r = o.repair_time    || 60;
            if (d < minVal) { minVal = d; minIdx = i; minStage = 'diag'; }
            if (r < minVal) { minVal = r; minIdx = i; minStage = 'repair'; }
        });

        const chosen = remaining.splice(minIdx, 1)[0];
        if (minStage === 'diag') {
            front.push(chosen);
        } else {
            back.unshift(chosen);
        }
    }

    return [...front, ...back];
}

function sptSort(orders) {
    return [...orders].sort((a, b) => {
        const timeA = (a.diagnosis_time || 30) + (a.repair_time || 60);
        const timeB = (b.diagnosis_time || 30) + (b.repair_time || 60);
        return timeA - timeB;
    });
}

function eddSort(orders) {
    return [...orders].sort((a, b) => {
        if (!a.deadline_min && !b.deadline_min) return 0;
        if (!a.deadline_min) return 1;
        if (!b.deadline_min) return -1;
        return a.deadline_min - b.deadline_min;
    });
}

// ─────────────────────────────────────────────
// 4. ВЫБОР ЛУЧШЕГО АЛГОРИТМА (SPT vs EDD)
// ─────────────────────────────────────────────

/**
 * Сравниваем SPT и EDD, выбираем по минимальному Cmax.
 * Если суммарное опоздание одинаковое — выбираем по Cmax.
 *
 * @param {Array}  orders
 * @param {number} startMin
 * @param {Object} equipBusy
 * @returns {{ sequence: Array, schedule: Array, algorithm: string, makespan: number }}
 */
function chooseBestAlgorithm(orders, startMin = 0, equipBusy = {}) {
    const sptSeq = sptSort(orders);
    const eddSeq = eddSort(orders);

    const { schedule: sptSched } = buildScheduleForMaster(sptSeq, startMin, { ...equipBusy });
    const { schedule: eddSched } = buildScheduleForMaster(eddSeq, startMin, { ...equipBusy });

    const sptMakespan   = calcMakespan(sptSched);
    const eddMakespan   = calcMakespan(eddSched);
    const sptTardiness  = calcTotalTardiness(sptSched);
    const eddTardiness  = calcTotalTardiness(eddSched);


    let winner;
    if (eddTardiness < sptTardiness) {
        winner = { sequence: eddSeq, schedule: eddSched, algorithm: 'EDD' };
    } else if (sptTardiness < eddTardiness) {
        winner = { sequence: sptSeq, schedule: sptSched, algorithm: 'SPT' };
    } else {

        winner = sptMakespan <= eddMakespan
            ? { sequence: sptSeq, schedule: sptSched, algorithm: 'SPT' }
            : { sequence: eddSeq, schedule: eddSched, algorithm: 'EDD' };
    }

    winner.makespan     = calcMakespan(winner.schedule);
    winner.tardiness    = calcTotalTardiness(winner.schedule);
    winner.sptMakespan  = sptMakespan;
    winner.eddMakespan  = eddMakespan;

    return winner;
}

// ─────────────────────────────────────────────
// 5. ОСНОВНАЯ ФУНКЦИЯ: buildSchedule
// ─────────────────────────────────────────────

/**
 * Строим расписание — трёхуровневая оптимизация:
 *
 * ШАГ 1 — ДЖОНСОН:
 *   Определяет глобально оптимальный ПОРЯДОК всех заказов
 *   для двухэтапного конвейера (диагностика → ремонт).
 *   Минимизирует общее время простоев (Cmax).
 *
 * ШАГ 2 — LPT (Least Processing Time):
 *   Распределяет заказы из джонсоновской последовательности
 *   по мастерам: каждый следующий заказ → наименее загруженному.
 *   Балансирует нагрузку между мастерами.
 *
 * ШАГ 3 — SPT vs EDD (локальная оптимизация):
 *   Внутри очереди каждого мастера дополнительно применяем
 *   SPT и EDD, сравниваем с исходным порядком и берём лучший
 *   вариант по суммарному опозданию и makespan.
 *   Учитывает дедлайны конкретного мастера.
 *
 * Срочные заказы (priority=1) всегда идут первыми.
 */
function buildSchedule(orders, masters, options = {}) {
    const dayStartMin = (options.dayStartHour ?? 9) * 60;
    const equipBusy   = options.equipBusy ?? {};
    const warnings    = [];

    if (!orders.length || !masters.length) {
        return { masterSchedules: {}, algorithm: 'none', totalMakespan: 0, warnings };
    }


    const urgentOrders = orders.filter(o => o.priority === 1 || o.urgency === 'urgent');
    const normalOrders = orders.filter(o => o.priority !== 1 && o.urgency !== 'urgent');
    const masterSchedules = {};
    const johnsonSeq = johnsonSort(normalOrders);
    const fullSequence = [...urgentOrders, ...johnsonSeq];
    const masterQueues   = {};
    const masterLoad     = {}; 
    for (const master of masters) {
        masterQueues[master.id] = [];
        masterLoad[master.id]   = dayStartMin;
    }
    for (const order of fullSequence) {
        if (order.master_id && masterQueues[order.master_id] !== undefined) {

            masterQueues[order.master_id].push(order);
            masterLoad[order.master_id] +=
                (order.diagnosis_time || 30) + (order.repair_time || 60);
        } else {
            const leastBusy = masters.reduce((best, m) =>
                masterLoad[m.id] < masterLoad[best.id] ? m : best
            );
            masterQueues[leastBusy.id].push(order);
            masterLoad[leastBusy.id] +=
                (order.diagnosis_time || 30) + (order.repair_time || 60);
        }
    }
    for (const master of masters) {
        const queue = masterQueues[master.id];

        if (!queue.length) {
            masterSchedules[master.id] = {
                master, algorithm: 'Johnson+LPT', schedule: [], makespan: 0
            };
            continue;
        }
        const myUrgent = queue.filter(o => o.priority === 1 || o.urgency === 'urgent');
        const myNormal = queue.filter(o => o.priority !== 1 && o.urgency !== 'urgent');

        const urgentRes = buildScheduleForMaster(myUrgent, dayStartMin, { ...equipBusy });
        const normalStart = urgentRes.schedule.length
            ? Math.max(...urgentRes.schedule.map(s => s.end_time))
            : dayStartMin;

        // Применяем SPT и EDD к обычным заказам этого мастера
        // Сравниваем три варианта: джонсоновский порядок, SPT, EDD
        const johnsonRes = buildScheduleForMaster(myNormal, normalStart, { ...equipBusy });
        const sptRes     = buildScheduleForMaster(sptSort(myNormal), normalStart, { ...equipBusy });
        const eddRes     = buildScheduleForMaster(eddSort(myNormal), normalStart, { ...equipBusy });

        // Выбираем лучший: сначала по суммарному опозданию, затем по makespan
        const variants = [
            { name: 'Johnson',  res: johnsonRes },
            { name: 'SPT',      res: sptRes     },
            { name: 'EDD',      res: eddRes     },
        ];

        const best = variants.reduce((a, b) => {
            const tardA = calcTotalTardiness(a.res.schedule);
            const tardB = calcTotalTardiness(b.res.schedule);
            if (tardB < tardA) return b;
            if (tardA < tardB) return a;
            // При равных опозданиях — меньший makespan
            return calcMakespan(a.res.schedule) <= calcMakespan(b.res.schedule) ? a : b;
        });

        const fullSchedule = [...urgentRes.schedule, ...best.res.schedule];

        masterSchedules[master.id] = {
            master,
            algorithm: 'Johnson+LPT+' + best.name,
            schedule:  fullSchedule,
            makespan:  calcMakespan(fullSchedule),
        };
    }

    // ── Проверяем дедлайны ──
    for (const [masterId, data] of Object.entries(masterSchedules)) {
        for (const slot of data.schedule) {
            if (slot.deadline_min && slot.end_time > slot.deadline_min) {
                warnings.push({
                    order_id:    slot.order_id,
                    client_name: slot.client_name,
                    device_type: slot.device_type,
                    master_id:   parseInt(masterId),
                    end_time:    slot.end_time,
                    deadline_min: slot.deadline_min,
                    overdue_min: slot.end_time - slot.deadline_min,
                });
            }
        }
    }

    const totalMakespan = Math.max(
        ...Object.values(masterSchedules).map(m => m.makespan || 0)
    );

    const algorithms = [...new Set(
        Object.values(masterSchedules).map(m => m.algorithm)
    )].join(', ');

    return { masterSchedules, algorithm: algorithms || 'Johnson+LPT', totalMakespan, warnings };
}

// ─────────────────────────────────────────────
// 6. ПЕРЕПЛАНИРОВАНИЕ при срочном заказе
// ─────────────────────────────────────────────

/**
 * Вставляем срочный заказ в начало очереди наименее загруженного мастера
 * и пересчитываем расписание.
 *
 * @param {Object} urgentOrder   — новый срочный заказ
 * @param {Object} masterSchedules — текущее расписание { masterId: { master, schedule } }
 * @param {Array}  masters
 * @param {Object} options
 * @returns {Object} — новое расписание (тот же формат что buildSchedule)
 */
function rescheduleUrgent(urgentOrder, masterSchedules, masters, options = {}) {
    const dayStartMin = (options.dayStartHour ?? 9) * 60;

    // Выбираем мастера с минимальным makespan
    let bestMasterId = null;
    let bestMakespan = Infinity;

    for (const [masterId, data] of Object.entries(masterSchedules)) {
        if ((data.makespan || 0) < bestMakespan) {
            bestMakespan   = data.makespan || 0;
            bestMasterId   = parseInt(masterId);
        }
    }

    // Берём текущие заказы этого мастера и ставим срочный первым
    const currentSchedule = masterSchedules[bestMasterId]?.schedule || [];
    const existingOrders  = currentSchedule.map(s => ({
        id:             s.order_id,
        client_name:    s.client_name,
        device_type:    s.device_type,
        device_model:   s.device_model,
        problem:        s.problem,
        equipment_id:   s.equipment_id,
        priority:       s.priority,
        deadline_min:   s.deadline_min,
        diagnosis_time: s.diag_end - s.diag_start,
        repair_time:    s.end_time - s.repair_start,
    }));

    urgentOrder.priority = 1;
    const newSequence = [urgentOrder, ...existingOrders];

    const { schedule } = buildScheduleForMaster(newSequence, dayStartMin, {});

    // Собираем обновлённое расписание
    const updated = { ...masterSchedules };
    updated[bestMasterId] = {
        ...updated[bestMasterId],
        schedule,
        makespan:  calcMakespan(schedule),
        algorithm: 'reschedule_urgent',
    };

    // Пересчитываем предупреждения
    const warnings = [];
    for (const [masterId, data] of Object.entries(updated)) {
        for (const slot of data.schedule) {
            if (slot.deadline_min && slot.end_time > slot.deadline_min) {
                warnings.push({
                    order_id:    slot.order_id,
                    master_id:   parseInt(masterId),
                    overdue_min: slot.end_time - slot.deadline_min,
                });
            }
        }
    }

    return {
        masterSchedules: updated,
        assignedMasterId: bestMasterId,
        warnings,
        totalMakespan: Math.max(...Object.values(updated).map(m => m.makespan || 0)),
    };
}

// ─────────────────────────────────────────────
// 7. КОНВЕРТАЦИЯ МИНУТ → DATETIME
// ─────────────────────────────────────────────

/**
 * Переводим минуты от начала дня в абсолютный DATETIME.
 * @param {number} minutes  — минуты от полуночи (540 = 09:00)
 * @param {Date}   baseDate — базовая дата (обычно сегодня)
 * @returns {Date}
 */
function minutesToDatetime(minutes, baseDate = new Date()) {
    const d = new Date(baseDate);
    // Строим дату как локальную строку, чтобы MySQL драйвер не конвертировал в UTC
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');
    const totalMin = minutes;
    const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const mm = String(totalMin % 60).padStart(2, '0');
    // Возвращаем строку формата MySQL DATETIME — без timezone
    return `${year}-${month}-${day} ${hh}:${mm}:00`;
}

/**
 * Конвертируем расписание (минуты) → абсолютные даты для записи в БД.
 * @param {Array} schedule
 * @param {Date}  baseDate
 * @returns {Array}
 */
function scheduleToDatetime(schedule, baseDate = new Date()) {
    return schedule.map(slot => ({
        ...slot,
        diag_start_dt:  minutesToDatetime(slot.diag_start,   baseDate),
        diag_end_dt:    minutesToDatetime(slot.diag_end,     baseDate),
        repair_start_dt: minutesToDatetime(slot.repair_start, baseDate),
        end_time_dt:    minutesToDatetime(slot.end_time,     baseDate),
    }));
}

/**
 * Переводим дедлайн из DATETIME в минуты от начала дня для алгоритмов.
 * @param {Date|string} deadline
 * @param {Date}        baseDate
 * @returns {number}
 */
function deadlineToMinutes(deadline, baseDate = new Date()) {
    if (!deadline) return null;
    const base = new Date(baseDate);
    base.setHours(0, 0, 0, 0);
    const dl   = new Date(deadline);
    return Math.round((dl - base) / 60000); // мс → минуты
}

// ─────────────────────────────────────────────
// ЭКСПОРТ
// ─────────────────────────────────────────────

module.exports = {
    buildSchedule,
    rescheduleUrgent,
    johnsonSort,
    sptSort,
    eddSort,
    chooseBestAlgorithm,
    buildScheduleForMaster,
    scheduleToDatetime,
    deadlineToMinutes,
    calcMakespan,
    calcTotalTardiness,
};