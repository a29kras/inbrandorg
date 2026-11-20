(async function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));

  const SHEET_ID = "10898Bo6l9yyogVuuqIAfZjhvQgl1TxKU-5QX4T_IF8A";
  const SHEET_NAME = "Сотрудники";

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
    // Бренд → Департамент → Отдел → массив сотрудников
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

  function render(tree, total) {
    $('count').textContent = `Всего сотрудников: ${total}`;

    const brands = [...tree.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
    if (!brands.length) {
      $('schema').innerHTML = '<p>Нет данных.</p>';
      return;
    }

    const html = `
      <div class="org-root">ИНБРЕНД (Холдинг)</div>
      <div class="org-brands">
        ${brands.map(brand => {
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
                          return `
                            <div class="org-dept">
                              <div class="org-dept-title">🏢 ${esc(dept)}</div>
                              <div class="org-dept-meta">
                                ${leader ? `<span>${esc(leader.name)}</span>` : ''}
                                <span class="org-badge">${totalEmp} сотр.${vac ? ` · ${vac} вак.` : ''}</span>
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    $('schema').innerHTML = html;
  }

  try {
    $('intro').textContent = 'Дивизиональная структура: бренды → департаменты → отделы.';
    const employees = await loadFromSheet();
    const tree = buildTree(employees);
    render(tree, employees.length);
  } catch (e) {
    $('count').textContent = e.message;
    $('count').className = 'error';
  }
})();