// includes/functions.js
import { supabase } from "./db.js";
import { QUESTIONS_PATH, PACKAGE_CATEGORIES, SPORTS_TOGGLE_ITEM } from "./config.js";

/* =======================================
   الامتحانات
======================================= */
export async function getExamBySlug(slug) {
  const { data } = await supabase.from("exams").select("*").eq("slug", slug).maybeSingle();
  return data || null;
}

export async function getExamById(examId) {
  const { data } = await supabase.from("exams").select("*").eq("id", examId).maybeSingle();
  return data || null;
}

export async function getAllExams() {
  const { data } = await supabase.from("exams").select("*").order("id");
  return data || [];
}

/* =======================================
   تحميل الأسئلة من ملف JSON
======================================= */
export async function loadQuestions(jsonFile) {
  const res = await fetch(QUESTIONS_PATH + jsonFile, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || typeof data !== "object") return null;

  let flat = [];
  if (Array.isArray(data.questions)) {
    flat = data.questions;
  } else {
    for (const group of Object.values(data)) {
      if (Array.isArray(group)) {
        for (const item of group) {
          if (item && typeof item === "object") flat.push(item);
        }
      }
    }
    const hasAllIds = flat.every((q) => q.id !== undefined);
    if (hasAllIds) flat.sort((a, b) => a.id - b.id);
  }

  flat = flat.map((q) => (q.type === "complete" ? { ...q, type: "fill_in_the_blank" } : q));
  return flat;
}

/* =======================================
   التصحيح التلقائي
======================================= */
export function getAutoGradedTypes() {
  return ["true_false", "multiple_choice", "location_source", "fill_in_the_blank"];
}

function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isAnswerCorrect(userAnswer, correctAnswer) {
  const u = normalize(userAnswer);
  if (u === "") return false;

  if (Array.isArray(correctAnswer)) {
    return correctAnswer.some((accepted) => normalize(accepted) === u);
  }
  return normalize(correctAnswer) === u;
}

function normalizeBlanksCorrectAnswer(correctAnswer) {
  if (!Array.isArray(correctAnswer)) return [[String(correctAnswer)]];
  const isNested = correctAnswer.some((v) => Array.isArray(v));
  if (isNested) return correctAnswer.map((v) => (Array.isArray(v) ? v : [String(v)]));
  return [correctAnswer];
}

function gradeFillInTheBlank(userAnswer, correctAnswer) {
  const blanks = normalizeBlanksCorrectAnswer(correctAnswer);
  const userBlanks = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
  return blanks.every((accepted, i) => isAnswerCorrect(userBlanks[i] ?? "", accepted));
}

export function gradeQuestion(type, userAnswer, correctAnswer) {
  if (type === "fill_in_the_blank") return gradeFillInTheBlank(userAnswer, correctAnswer);
  if (["true_false", "multiple_choice", "location_source"].includes(type)) {
    return isAnswerCorrect(userAnswer, correctAnswer);
  }
  return false;
}

/* =======================================
   إعدادات النظام
======================================= */
let settingsCache = null;
async function getSettingsMap() {
  if (settingsCache) return settingsCache;
  const { data } = await supabase.from("settings").select("setting_key, setting_value");
  settingsCache = {};
  (data || []).forEach((row) => (settingsCache[row.setting_key] = row.setting_value));
  return settingsCache;
}

export async function getGradeText(percentage) {
  const s = await getSettingsMap();
  const excellent = Number(s.grade_excellent ?? 90);
  const veryGood = Number(s.grade_very_good ?? 80);
  const good = Number(s.grade_good ?? 70);
  const acceptable = Number(s.grade_acceptable ?? 60);

  if (percentage >= excellent) return "ممتاز";
  if (percentage >= veryGood) return "جيد جداً";
  if (percentage >= good) return "جيد";
  if (percentage >= acceptable) return "مقبول";
  return "راسب";
}

export async function getPassThreshold() {
  const s = await getSettingsMap();
  return Number(s.pass_percentage ?? 50);
}

/* =======================================
   المحاولات (Attempts)
======================================= */
export async function checkExistingAttempt(examId, phone) {
  const { count } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId)
    .eq("user_phone", phone)
    .in("status", ["submitted", "graded"]);
  return (count || 0) > 0;
}

export async function createAttempt(examId, name, church, phone) {
  const { data, error } = await supabase
    .from("attempts")
    .insert({
      exam_id: examId,
      user_name: name,
      user_church: church,
      user_phone: phone,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAttempt(attemptId) {
  const { data } = await supabase.from("attempts").select("*").eq("id", attemptId).maybeSingle();
  return data || null;
}

// تسجيل أو جلب أول لحظة يشوف فيها الطالب صفحة الأسئلة
export async function ensureExamStarted(attemptId) {
  const attempt = await getAttempt(attemptId);
  if (attempt && !attempt.exam_started_at) {
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("attempts")
      .update({ exam_started_at: nowIso })
      .eq("id", attemptId)
      .is("exam_started_at", null)
      .select("exam_started_at")
      .maybeSingle();
    return data?.exam_started_at || nowIso;
  }
  return attempt?.exam_started_at || null;
}

export async function submitExamAttempt(attemptId, questions, postedAnswers) {
  const rows = [];
  let totalScore = 0;
  let totalPossible = 0;
  const autoGradedTypes = getAutoGradedTypes();

  questions.forEach((q, index) => {
    const type = q.type;
    const correctAnswer = q.correct_answer ?? "";
    const rawAnswer = postedAnswers[index] ?? "";

    let storedAnswer, cleanAnswer;
    if (type === "fill_in_the_blank" && Array.isArray(rawAnswer)) {
      cleanAnswer = rawAnswer.map((v) => String(v ?? "").trim());
      storedAnswer = JSON.stringify(cleanAnswer);
    } else {
      cleanAnswer = Array.isArray(rawAnswer) ? "" : String(rawAnswer ?? "").trim();
      storedAnswer = cleanAnswer;
    }

    const autoGraded = autoGradedTypes.includes(type);
    const isCorrect = autoGraded ? gradeQuestion(type, cleanAnswer, correctAnswer) : false;
    const score = isCorrect ? 1 : 0;

    if (autoGraded) {
      totalPossible++;
      totalScore += score;
    }

    rows.push({
      attempt_id: attemptId,
      question_index: index,
      question_type: type,
      user_answer: storedAnswer,
      correct_answer: Array.isArray(correctAnswer) ? JSON.stringify(correctAnswer) : String(correctAnswer),
      auto_graded: autoGraded,
      is_correct: isCorrect,
      score,
    });
  });

  const percentage = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
  const gradeText = await getGradeText(percentage);
  const passThreshold = await getPassThreshold();
  const passFail = percentage >= passThreshold ? "pass" : "fail";

  if (rows.length) {
    const { error: ansErr } = await supabase.from("answers").upsert(rows, { onConflict: "attempt_id,question_index" });
    if (ansErr) throw ansErr;
  }

  const { error: attErr } = await supabase
    .from("attempts")
    .update({
      end_time: new Date().toISOString(),
      status: "submitted",
      answers_json: postedAnswers,
      total_score: totalScore,
      total_possible: totalPossible,
      percentage,
      grade_text: gradeText,
      pass_fail: passFail,
    })
    .eq("id", attemptId);
  if (attErr) throw attErr;

  return true;
}

/* =======================================
   نظام اختيار الأنشطة
======================================= */
export function getPackageCategories() {
  return PACKAGE_CATEGORIES;
}

export async function loadPackages() {
  const categories = getPackageCategories();
  const empty = {};
  Object.keys(categories).forEach((c) => (empty[c] = []));

  try {
    const res = await fetch(QUESTIONS_PATH + "pk.json", { cache: "no-store" });
    if (!res.ok) return empty;
    const data = await res.json();
    const result = { ...empty };
    Object.keys(categories).forEach((cat) => {
      if (Array.isArray(data[cat])) {
        result[cat] = data[cat].map((v) => String(v).trim()).filter((v) => v !== "");
      }
    });
    return result;
  } catch {
    return empty;
  }
}

export async function savePackageSelections(attemptId, selections, sportsEnabled) {
  const categories = getPackageCategories();
  const available = await loadPackages();

  await supabase.from("attempt_packages").delete().eq("attempt_id", attemptId);

  const rowsToInsert = [];
  for (const category of Object.keys(categories)) {
    let chosen = selections[category] || [];
    if (!Array.isArray(chosen)) chosen = chosen ? [chosen] : [];

    const validItems = available[category] || [];
    chosen = [...new Set(chosen.filter((v) => v !== "" && validItems.includes(v)))];

    if (category === "أنشطة") {
      const withoutSports = chosen.filter((v) => v !== SPORTS_TOGGLE_ITEM);
      chosen = withoutSports.slice(0, categories[category]);
      if (sportsEnabled) chosen.push(SPORTS_TOGGLE_ITEM);
    } else {
      chosen = sportsEnabled ? chosen.slice(0, categories[category]) : [];
    }

    chosen.forEach((item) => rowsToInsert.push({ attempt_id: attemptId, category, item }));
  }

  if (rowsToInsert.length) {
    await supabase.from("attempt_packages").insert(rowsToInsert);
  }

  await supabase.from("attempts").update({ packages_confirmed: true }).eq("id", attemptId);
  return true;
}

export async function getPackageSelections(attemptId) {
  const categories = getPackageCategories();
  const result = {};
  Object.keys(categories).forEach((c) => (result[c] = []));

  const { data } = await supabase
    .from("attempt_packages")
    .select("category, item")
    .eq("attempt_id", attemptId)
    .order("id");

  (data || []).forEach((row) => result[row.category]?.push(row.item));
  return result;
}

/* =======================================
   لوحة الإدارة
======================================= */
export async function countAttemptsByPassFail(passFail, filterCategory = null, filterItem = null) {
  if (filterCategory && filterItem) {
    const { data } = await supabase
      .from("attempt_packages")
      .select("attempt_id")
      .eq("category", filterCategory)
      .eq("item", filterItem);
    const ids = (data || []).map((r) => r.attempt_id);
    if (!ids.length) return 0;
    const { count } = await supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("pass_fail", passFail)
      .in("id", ids);
    return count || 0;
  }

  const { count } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("pass_fail", passFail);
  return count || 0;
}

export async function getAttemptsByPassFail(passFail, filterCategory, filterItem, limit = 50, offset = 0) {
  let idFilter = null;
  if (filterCategory && filterItem) {
    const { data } = await supabase
      .from("attempt_packages")
      .select("attempt_id")
      .eq("category", filterCategory)
      .eq("item", filterItem);
    idFilter = (data || []).map((r) => r.attempt_id);
    if (!idFilter.length) return [];
  }

  let query = supabase
    .from("attempts")
    .select("id, exam_id, user_name, user_church, user_phone, status, total_score, total_possible, percentage, grade_text, pass_fail, created_at, exams(name)")
    .eq("pass_fail", passFail)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (idFilter) query = query.in("id", idFilter);

  const { data } = await query;
  return (data || []).map((row) => ({ ...row, exam_name: row.exams?.name || "" }));
}

export async function getPackageSelectionsBatch(attemptIds) {
  const categories = getPackageCategories();
  const result = {};
  attemptIds.forEach((id) => {
    result[id] = {};
    Object.keys(categories).forEach((c) => (result[id][c] = []));
  });

  if (!attemptIds.length) return result;

  const { data } = await supabase
    .from("attempt_packages")
    .select("attempt_id, category, item")
    .in("attempt_id", attemptIds);

  (data || []).forEach((row) => {
    if (!result[row.attempt_id]) result[row.attempt_id] = {};
    if (!result[row.attempt_id][row.category]) result[row.attempt_id][row.category] = [];
    result[row.attempt_id][row.category].push(row.item);
  });

  return result;
}
