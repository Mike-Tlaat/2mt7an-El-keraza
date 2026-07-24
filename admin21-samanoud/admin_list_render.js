// admin_list_render.js
// منطق وواجهة عرض قائمة الطلاب (ناجحين / غير ناجحين) - بدون أي باسورد
// مبني للسرعة: COUNT خفيف + Pagination + سحب أعمدة محددة فقط + Batch للبكدجات

import {
  loadPackages,
  countAttemptsByPassFail,
  getAttemptsByPassFail,
  getPackageSelectionsBatch,
} from "../includes/functions.js";

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

function scoreColor(percentage) {
  if (percentage >= 75) return "var(--a-success)";
  if (percentage >= 50) return "var(--a-warning)";
  return "var(--a-danger)";
}

export async function renderAdminAttemptsPage(tab) {
  const app = document.getElementById("app");
  const perPage = 50;
  const qs = new URLSearchParams(location.search);
  let page = Math.max(1, Number(qs.get("page") || 1));
  const filterRaw = qs.get("filter") || "";
  let filterCategory = "";
  let filterItem = "";
  if (filterRaw && filterRaw.includes("|||")) {
    [filterCategory, filterItem] = filterRaw.split("|||");
  }

  const packages = await loadPackages();
  const totalCount = await countAttemptsByPassFail(tab, filterCategory, filterItem);
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  if (page > totalPages) page = totalPages;
  const offset = (page - 1) * perPage;

  const attempts = await getAttemptsByPassFail(tab, filterCategory, filterItem, perPage, offset);
  const ids = attempts.map((a) => a.id);
  const selectionsBatch = await getPackageSelectionsBatch(ids);

  const passTotal = await countAttemptsByPassFail("pass");
  const failTotal = await countAttemptsByPassFail("fail");

  const isPassPage = tab === "pass";
  const pageTitle = isPassPage ? "الناجحون" : "غير الناجحين";

  const filterOptionsHtml = Object.entries(packages)
    .filter(([, items]) => items.length)
    .map(
      ([category, items]) => `
      <optgroup label="${escapeHtml(category)}">
        ${items
          .map((item) => {
            const val = `${category}|||${item}`;
            const selected = filterCategory === category && filterItem === item ? "selected" : "";
            return `<option value="${escapeHtml(val)}" ${selected}>${escapeHtml(item)}</option>`;
          })
          .join("")}
      </optgroup>`
    )
    .join("");

  const rowsHtml = attempts.length
    ? attempts
        .map((a) => {
          const sel = selectionsBatch[a.id] || {};
          const pkgBlocksHtml = Object.entries(sel)
            .map(
              ([cat, items]) => `
              <h4><i class="fa-solid fa-star"></i> ${escapeHtml(cat)}</h4>
              <div class="a-pkg-tags">
                ${
                  items.length
                    ? items.map((it) => `<span class="a-pkg-tag">${escapeHtml(it)}</span>`).join("")
                    : `<span class="a-pkg-tag none">لم يتم الاختيار</span>`
                }
              </div>`
            )
            .join("");

          return `
          <tr onclick="toggleRow(${a.id})">
            <td><b>${escapeHtml(a.user_name)}</b></td>
            <td>${escapeHtml(a.user_church)}</td>
            <td>${escapeHtml(a.user_phone)}</td>
            <td>${escapeHtml(a.exam_name)}</td>
            <td class="pct-pill" style="color:${scoreColor(a.percentage)}">${Number(a.percentage).toFixed(1)}%</td>
            <td>${escapeHtml(a.grade_text || "-")}</td>
            <td><i class="fa-solid fa-chevron-down"></i></td>
          </tr>
          <tr class="a-detail-row" id="detail_${a.id}">
            <td colspan="7">
              <div class="a-detail-grid">
                <div class="a-detail-box"><div class="t">الدرجة</div><div class="v">${a.total_score} / ${a.total_possible}</div></div>
                <div class="a-detail-box"><div class="t">حالة المحاولة</div><div class="v">${escapeHtml(a.status)}</div></div>
                <div class="a-detail-box"><div class="t">تاريخ التسجيل</div><div class="v" style="font-size:.8rem;">${escapeHtml(a.created_at)}</div></div>
              </div>
              <div class="a-pkg-block">${pkgBlocksHtml}</div>
            </td>
          </tr>`;
        })
        .join("")
    : "";

  let paginationHtml = "";
  if (totalPages > 1) {
    const links = [];
    for (let p = 1; p <= totalPages; p++) {
      const params = new URLSearchParams(qs);
      params.set("page", p);
      links.push(`<a href="?${params.toString()}" class="${p === page ? "active" : ""}">${p}</a>`);
    }
    paginationHtml = `<div class="a-pagination">${links.join("")}</div>`;
  }

  app.innerHTML = `
    <div class="a-topbar">
      <div>
        <h1><i class="fa-solid fa-graduation-cap"></i> ${pageTitle}</h1>
        <p>عرض سريع لقائمة الطلاب واختياراتهم من الأنشطة (بدون تحميل إجاباتهم)</p>
      </div>
      <button class="a-theme-btn" id="themeToggle"><i class="fa-solid fa-circle-half-stroke"></i></button>
    </div>

    <div class="a-stats-row">
      <div class="a-stat-card"><div class="num" style="color:var(--a-success);">${passTotal}</div><div class="lbl">إجمالي الناجحين</div></div>
      <div class="a-stat-card"><div class="num" style="color:var(--a-danger);">${failTotal}</div><div class="lbl">إجمالي غير الناجحين</div></div>
      <div class="a-stat-card"><div class="num">${totalCount}</div><div class="lbl">النتائج المعروضة الآن${filterCategory ? " (بالفلتر)" : ""}</div></div>
    </div>

    <div class="a-tabs-row">
      <a href="passed.html" class="a-tab-btn ${isPassPage ? "active pass" : ""}"><i class="fa-solid fa-circle-check"></i> الناجحون (${passTotal})</a>
      <a href="failed.html" class="a-tab-btn ${!isPassPage ? "active fail" : ""}"><i class="fa-solid fa-circle-xmark"></i> غير الناجحين (${failTotal})</a>
    </div>

    <form class="a-filter-bar" method="GET">
      <label style="font-size:.82rem;color:var(--a-text-soft);font-weight:700;"><i class="fa-solid fa-filter"></i> فلترة حسب النشاط:</label>
      <select name="filter">
        <option value="">-- كل الطلاب --</option>
        ${filterOptionsHtml}
      </select>
      <button type="submit"><i class="fa-solid fa-magnifying-glass"></i> فلترة</button>
      ${
        filterCategory && filterItem
          ? `<span class="a-filter-active-note">يعرض فقط من اختار: ${escapeHtml(filterItem)}</span><a class="clear-link" href="?">إلغاء الفلتر</a>`
          : ""
      }
    </form>

    ${
      attempts.length
        ? `<table class="a-table">
            <thead><tr><th>الاسم</th><th>الكنيسة</th><th>الهاتف</th><th>الامتحان</th><th>النسبة</th><th>التقدير</th><th></th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          ${paginationHtml}`
        : `<div class="a-empty-state"><i class="fa-solid fa-inbox"></i>لا يوجد طلاب في هذا القسم حالياً${filterCategory ? " بهذا الفلتر" : ""}.</div>`
    }
  `;

  window.toggleRow = (id) => document.getElementById(`detail_${id}`).classList.toggle("open");

  const themeToggle = document.getElementById("themeToggle");
  const htmlEl = document.documentElement;
  htmlEl.setAttribute("data-theme", localStorage.getItem("admin_theme") || "dark");
  themeToggle.addEventListener("click", () => {
    const next = htmlEl.getAttribute("data-theme") === "dark" ? "light" : "dark";
    htmlEl.setAttribute("data-theme", next);
    localStorage.setItem("admin_theme", next);
  });
}
