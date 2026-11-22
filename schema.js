(async function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));

  const SHEET_ID = "10898Bo6l9yyogVuuqIAfZjhvQgl1TxKU-5QX4T_IF8A";
  const SHEET_NAME = "Сотрудники";

  // Жёсткий порядок брендов
  const BRAND_ORDER = ["ЧИО ЧИО", "БИГБРО", "ПЛОЩАДКА", "ИНДИ"];

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
        division: r.c[1]?.v || '',
        dept:     r.c[2]?.v || '',
        manager:  r.c[3]?.v || '',
        position: r.c[4]?.v || '',
        name:     r.c[5]?.v || '',
        status:   r.c[6]?.v || '',
      };
    })
    .filter(e => e && e.name && e.name.trim() !== '')
    .filter(e => !/^(фио|ф\.?и\.?о\.?|фио\s*\/\s*роль|должность|статус)$/i.test(e.name.trim()));
  }

  function buildTree(list) {
    const tree = new Map();
    for (const e of list) {
      const brand = e.brand || 'Без бренда';
      const div   = e.division || 'Без департамента';
      const dept  = e.dept || 'Без отдела';
      if (!tree.has(brand)) tree.set(brand, new Map());
      const byDiv = tree.get(brand);
      if (!byDiv.has(div)) byDiv.set(div, new Map());
      const byDept = byDiv.get(div);
      if (!byDept.has(dept)) byDept.set(dept, []);
      byDept.get(dept).push(e);
    }
    return tree;
  }

  // Сортировка брендов по заданному порядку, остальные — в конце по алфавиту
  function sortBrands(brands) {
    const known = BRAND_ORDER.filter(b => brands.includes(b));
    const unknown = brands.filter(b => !BRAND_ORDER.includes(b)).sort((a, b) => a.localeCompare(b, 'ru'));
    return [...known, ...unknown];
  }

        function render(tree, total) {
    $('count').textContent = `Всего сотрудников: ${total}`;

    const brands = sortBrands([...tree.keys()]);
    if (!brands.length) {
      $('schema').innerHTML = '<p>Нет данных.</p>';
      return;
    }

    // Формируем содержимое главного блока "ИНБРЕНД (Холдинг)"
    const brandsHtml = brands.map(brand => {
      const byDiv = tree.get(brand);
      const divs = [...byDiv.keys()].sort((a, b) => a.localeCompare(b, 'ru'));

      return `
        <div class="org-brand">
          <div class="org-brand-title">🏷 ${esc(brand)}</div>
          <div class="org-divisions">
            ${divs.map(div => {
              const byDept = byDiv.get(div);
              const depts = [...byDept.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
              return `
                <div class="org-division">
                  <div class="org-division-title">🏛 ${esc(div)}</div>
                  <div class="org-depts">
                    ${depts.map(dept => {
                      const items = byDept.get(dept);
                      const totalEmp = items.filter(e => e.status !== 'Вакансия').length;
                      const vac = items.filter(e => e.status === 'Вакансия').length;
                      const leader = items.find(e => /руководител|директор|главн/i.test(e.position));

                      const cards = items
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                        .map(e => `
                          <div class="org-emp ${e.status === 'Вакансия' ? 'vacancy' : ''}">
                            <div class="org-emp-name">${esc(e.name)}</div>
                            <div class="org-emp-pos">${esc(e.position || '—')}</div>
                          </div>
                        `).join('');

                      return `
                        <details class="org-dept">
                          <summary>
                            <span class="org-dept-title">🏢 ${esc(dept)}</span>
                            <span class="org-badge">${totalEmp} сотр.${vac ? ` · ${vac} вак.` : ''}</span>
                          </summary>
                          ${leader ? `<div class="org-dept-leader">Руководитель: ${esc(leader.name)}</div>` : ''}
                          <div class="org-emps">${cards}</div>
                        </details>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <div class="org-holding-card">
        <div class="org-holding-header">
          <span class="org-holding-icon">🏢</span>
          <span class="org-holding-title">ИНБРЕНД (Холдинг)</span>
        </div>
        <div class="org-holding-body">
          ${brandsHtml}
        </div>
      </div>
    `;
    $('schema').innerHTML = html;
  }

  try {
    $('intro').textContent = 'Дивизиональная структура: холдинг → бренды → департаменты → отделы. Нажмите на отдел, чтобы раскрыть сотрудников.';
    const employees = await loadFromSheet();
    const tree = buildTree(employees);
    render(tree, employees.length);

    // Кнопки «Раскрыть все» / «Свернуть все»
       $('expand-all').addEventListener('click', () => {
      document.querySelectorAll('#schema details').forEach(d => d.open = true);
    });
    $('collapse-all').addEventListener('click', () => {
      document.querySelectorAll('#schema details').forEach(d => d.open = false);
    });
  } catch (e) {
    $('count').textContent = e.message;
    $('count').className = 'error';
  }
})();
