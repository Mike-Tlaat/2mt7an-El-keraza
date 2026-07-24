import { getAllExams, setExamOpenStatus } from "./includes/functions.js";

const listEl = document.getElementById("examsList");

async function render() {
  const exams = await getAllExams();

  if (!exams.length) {
    listEl.innerHTML = `<div class="adm-empty">لا توجد امتحانات.</div>`;
    return;
  }

  listEl.innerHTML = exams
    .map((exam) => {
      const isOpen = exam.is_open !== false;
      return `
        <div class="adm-row" data-exam-id="${exam.id}">
          <div>
            <h3>${exam.name}</h3>
            <span class="slug">slug: ${exam.slug || exam.id}</span>
            &nbsp;
            <span class="adm-status ${isOpen ? "open" : "closed"}">
              ${isOpen ? "مفتوح" : "مغلق"}
            </span>
          </div>
          <button
            type="button"
            class="adm-toggle-btn ${isOpen ? "to-close" : "to-open"}"
            data-id="${exam.id}"
            data-current="${isOpen}"
          >
            <i class="fa-solid ${isOpen ? "fa-lock" : "fa-lock-open"}"></i>
            ${isOpen ? "غلق الامتحان" : "فتح الامتحان"}
          </button>
        </div>`;
    })
    .join("");

  listEl.querySelectorAll(".adm-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const examId = Number(btn.dataset.id);
      const currentlyOpen = btn.dataset.current === "true";
      const nextOpen = !currentlyOpen;

      btn.disabled = true;
      try {
        await setExamOpenStatus(examId, nextOpen);
        await render();
      } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء تحديث حالة الامتحان.");
        btn.disabled = false;
      }
    });
  });
}

render();
