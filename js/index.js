// index.js - صفحة عرض الامتحانات الأربعة
import { getAllExams } from "../includes/functions.js";

const grid = document.getElementById("examsGrid");

const icons = ["fa-child-reaching", "fa-user-graduate", "fa-book-open-reader", "fa-dove"];

async function render() {
  const exams = await getAllExams();

  if (!exams.length) {
    grid.innerHTML = `<div class="idx-empty"><i class="fa-solid fa-inbox"></i><br>لا توجد امتحانات متاحة حالياً.</div>`;
    return;
  }

  grid.innerHTML = exams
    .map(
      (exam, i) => `
      <div class="idx-card">
        <div>
          <div class="icon-box"><i class="fa-solid ${icons[i % icons.length]}"></i></div>
          <h3>${escapeHtml(exam.name)}</h3>
          <p>تقييم إلكتروني شامل مصمم لقياس الحفظ والاستيعاب والمفاهيم الأساسية بدقة.</p>
        </div>
        <a class="btn-go" href="exam.html?exam=${encodeURIComponent(exam.slug)}">
          <span>ابدأ الامتحان</span>
          <i class="fa-solid fa-arrow-left"></i>
        </a>
      </div>`
    )
    .join("");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

render();
