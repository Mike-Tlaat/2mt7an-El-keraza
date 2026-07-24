// config.js
// إعدادات المشروع العامة. لازم تحط هنا بيانات مشروعك على Supabase.

// ⚠️ هام جداً: غيّر القيمتين دول ببيانات مشروعك في Supabase
// (Project Settings -> API -> Project URL / anon public key)
export const SUPABASE_URL = "https://xwmevttfvhanlwxnlwtm.supabase.co";
export const SUPABASE_ANON_KEY =
  "sb_publishable_BOK8_NnGm6722HvsLFJ6Xw_I6EU2HfS";

// مدة الامتحان بالثواني (30 دقيقة)
export const EXAM_DURATION_SECONDS = 30 * 60;

// مسار فولدر الأسئلة (مسار نسبي بدون / في البداية لتجنب خطأ 404)
export const QUESTIONS_PATH = "questions/";

// اسم فولدر الإدارة (بدون أي باسورد)
export const ADMIN_FOLDER = "admin21-samanoud";

// حد أقصى اختيار الأنشطة (بدون احتساب "مسابقات رياضية" ضمنه)
export const MAX_ACTIVITIES = 3;

// اسم خيار المسابقات الرياضية الخاص (مجرد خانة تفعّل قسم الألعاب، لا تُحسب من ضمن الـ 3 أنشطة)
export const SPORTS_TOGGLE_ITEM = "مسابقات رياضية";

// الحد الأقصى لكل بكدج (الفردي / الجماعي كل واحد بحد أقصى اختيار واحد)
export const PACKAGE_CATEGORIES = {
  أنشطة: MAX_ACTIVITIES,
  "اللعب الفردي": 1,
  "اللعب الجماعي": 1,
};
