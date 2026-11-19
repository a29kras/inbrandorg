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

  // ===== ХЕЛПЕРЫ ДЛЯ СЧЁТЧИКОВ =====
  function counts(items) {
    const total = items.filter(e => e.status !== 'Вакансия').length;
    const vac = items.filter(e => e.status === 'Вакансия').length;
    let label = `${total} сотр.`;
    if (vac) label += ` · ${vac} ваканс.`;
    return label;
  }

  // ===== РЕНДЕР: БРЕНД → ОТДЕЛ → РУКОВОДИТЕЛЬ → СОТРУДНИКИ =====
  let employees = [];

  function draw() {
    const brandF = $('f-brand').value;
    const deptF = $('f-dept').value;
    const managerF = $('f-manager').value;
    const statusF = $('f-status').value;
    const q = $('search').value.toLocaleLowerCase('ru');

    // 1. Фильтрация
    const list = employees.filter(e => {
      if (brandF && e.brand !== brandF) return false;
      if (deptF && e.dept !== deptF) return false;
      if (managerF && e.manager !== managerF) return false;
      if (statusF && e.status !== statusF) return false;
      if (q && !(e.name + ' ' + e.position).toLocaleLowerCase('ru').includes(q)) return false;
      return true;
    });

    $('count').textContent = `Сотрудников: ${list.filter(e => e.status !== 'Вакансия').length} · Вакансий: ${list.filter(e => e.status === 'Вакансия').length}`;

    if (!list.length) {
      $('partner-list').innerHTML = '<p>Нет данных по выбранным фильтрам.</p>';
      return;
    }

    // 2. Группировка: Бренд → Отдел → Руководитель → Сотрудники
    const byBrand = new Map();
    for (const e of list) {
      const brand = e.brand || 'Без бренда';
      const dept  = e.dept  || 'Без отдела';
      const mgr   = (e.manager && e.manager.trim() && e.manager !== '-') ? e.manager : 'Без руководителя';

      if (!byBrand.has(brand)) byBrand.set(brand, new Map());
      const byDept = byBrand.get(brand);
      if (!byDept.has(dept)) byDept.set(dept, new Map());
      const byMgr = byDept.get(dept);
      if (!byMgr.has(mgr)) byMgr.set(mgr, []);
      byMgr.get(mgr).push(e);
    }

    // 3. Рендер вложенных details
    const html = [...byBrand.keys()].sort((a, b) => a.localeCompare(b, 'ru')).map(brand => {
      const byDept = byBrand.get(brand);
      const brandItems = [...byDept.values()].flatMap(m => [...m.values()].flat());

      const deptsHtml = [...byDept.keys()].sort((a, b) => a.localeCompare(b, 'ru')).map(dept => {
        const byMgr = byDept.get(dept);
        const deptItems = [...byMgr.values()].flat();

        const mgrsHtml = [...byMgr.keys()].sort((a, b) => a.localeCompare(b, 'ru')).map(mgr => {
          const items = byMgr.get(mgr);
          const cards = items.map(e => `
            <article class="partner ${e.status === 'Вакансия' ? 'vacancy' : ''}">
              <div>
                <strong>${esc(e.position || '—')}</strong>
                <div class="partner-name">${esc(e.name)}</div>
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
                <span class="mgr-count">${counts(items)}</span>
              </summary>
              <div class="mgr-body">${cards}</div>
            </details>
          `;
        }).join('');

        return `
          <details class="dept-group">
            <summary>
              <span class="mgr-name">🏢 ${esc(dept)}</span>
              <span class="mgr-count">${counts(deptItems)}</span>
            </summary>
            <div class="dept-body">${mgrsHtml}</div>
          </details>
        `;
      }).join('');

      return `
        <details class="brand-group">
          <summary>
            <span class="mgr-name">🏷 ${esc(brand)}</span>
            <span class="mgr-count">${counts(brandItems)}</span>
          </summary>
          <div class="brand-body">${deptsHtml}</div>
        </details>
      `;
    }).join('');

    $('partner-list').innerHTML = html;
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====
  try {
    $('intro').textContent = 'Навигатор по оргструктуре: бренды → отделы → руководители → сотрудники. Нажмите на уровень, чтобы раскрыть.';
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