(async function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));

  // ===== НАСТРОЙКИ =====
  const SHEET_ID = "10898Bo6l9yyogVuuqIAfZjhvQgl1TxKU-5QX4T_IF8A";
  const SHEET_NAME = "Сотрудники"; // при необходимости замените на точное имя листа

  // ===== ЗАГРУЗКА ДАННЫХ =====
  async function loadFromSheet() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw Error('Не удалось загрузить данные из таблицы');
    const txt = await resp.text();
    const jsonStr = txt.replace("/*O_o*/\ngoogle.visualization.Query.setResponse(", "").replace(/\);?\s*$/, "");
    const data = JSON.parse(jsonStr);
    const rows = data.table.rows;

    return rows.map(r => {
      if (!r.c) return null;
      return {
        brand:    r.c[0]?.v || '',
        dept:     r.c[2]?.v || '',
        manager:  r.c[3]?.v || '',
        position: r.c[4]?.v || '',
        name:     r.c[5]?.v || '',
        status:   r.c[6]?.v || '',
        ckp:      r.c[7]?.v || '',
        contact:  r.c[8]?.v || '',
      };
    }).filter(e => e && e.name && e.name.trim() !== '');
  }

  // ===== ЗАПОЛНЕНИЕ СЕЛЕКТОВ =====
  function fillSelect(id, key, allLabel, employees) {
    const sel = $(id);
    const vals = [...new Set(employees.map(e => e[key]).filter(v => v && v.trim()))].sort();
    sel.innerHTML = `<option value="">${allLabel}</option>` +
      vals.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }

  // ===== РЕНДЕР: ГРУППИРОВКА ПО РУКОВОДИТЕЛЮ =====
  let employees = [];

  function draw() {
    const brand = $('f-brand').value;
    const dept = $('f-dept').value;
    const manager = $('f-manager').value;
    const status = $('f-status').value;
    const q = $('search').value.toLocaleLowerCase('ru');

    // 1. Фильтрация
    const list = employees.filter(e => {
      if (brand && e.brand !== brand) return false;
      if (dept && e.dept !== dept) return false;
      if (manager && e.manager !== manager) return false;
      if (status && e.status !== status) return false;
      if (q && !(e.name + ' ' + e.position).toLocaleLowerCase('ru').includes(q)) return false;
      return true;
    });

    const total = list.filter(e => e.status !== 'Вакансия').length;
    const vac = list.filter(e => e.status === 'Вакансия').length;
    $('count').textContent = `Сотрудников: ${total} · Вакансий: ${vac}`;

    // 2. Группировка по руководителю
    const groups = new Map();
    for (const e of list) {
      const mgr = (e.manager && e.manager.trim() && e.manager !== '-') ? e.manager : 'Без руководителя';
      if (!groups.has(mgr)) groups.set(mgr, []);
      groups.get(mgr).push(e);
    }

    // 3. Сортировка руководителей по алфавиту
    const sortedManagers = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'ru'));

    if (!sortedManagers.length) {
      $('partner-list').innerHTML = '<p>Нет данных по выбранным фильтрам.</p>';
      return;
    }

    // 4. Рендер аккордеонов
    $('partner-list').innerHTML = sortedManagers.map(mgr => {
      const items = groups.get(mgr);
      const totalItems = items.filter(e => e.status !== 'Вакансия').length;
      const vacItems = items.filter(e => e.status === 'Вакансия').length;

      const body = items.map(e => `
        <article class="partner ${e.status === 'Вакансия' ? 'vacancy' : ''}">
          <div>
            <strong>${esc(e.position || '—')}</strong>
            <div class="partner-name">${esc(e.name)}</div>
            <small>${esc(e.brand || '—')} · ${esc(e.dept || '—')}</small>
            ${e.ckp ? `<small><b>ЦКП:</b> ${esc(e.ckp)}</small>` : ''}
            ${e.contact ? `<small><b>Обращаться:</b> ${esc(e.contact)}</small>` : ''}
          </div>
          <div class="row-actions">
            <span class="badge ${e.status === 'Вакансия' ? 'badge-vacancy' : ''}">${esc(e.status || '—')}</span>
          </div>
        </article>
      `).join('');

      return `
        <details class="mgr-group">
          <summary>
            <span class="mgr-name">👤 ${esc(mgr)}</span>
            <span class="mgr-count">${totalItems} сотр.${vacItems ? ` · ${vacItems} ваканс.` : ''}</span>
          </summary>
          <div class="mgr-body">${body}</div>
        </details>
      `;
    }).join('');
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====
  try {
    $('intro').textContent = 'Навигатор по оргструктуре: сотрудники сгруппированы по руководителям. Нажмите на руководителя, чтобы раскрыть список.';
    employees = await loadFromSheet();

    fillSelect('f-brand', 'brand', 'Все бренды', employees);
    fillSelect('f-dept', 'dept', 'Все отделы', employees);
    fillSelect('f-manager', 'manager', 'Все руководители', employees);

    ['f-brand', 'f-dept', 'f-manager', 'f-status'].forEach(id => $(id).addEventListener('change', draw));
    $('search').addEventListener('input', draw);

    draw();
  } catch (e) {
    $('count').textContent = e.message;
    $('count').className = 'error';
  }
})();