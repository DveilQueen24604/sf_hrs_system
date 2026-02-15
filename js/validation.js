/* ==========================================
   LEAVE VALIDATION (ใช้ร่วมกันทุก Role)
========================================== */

async function validateLeaveRequest(empCode, leaveType, startDate, endDate) {

  const s = new Date(startDate);
  const e = new Date(endDate);
  const totalDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;

  let field = null;
  if (leaveType === "ลาพักร้อน") field = "annual_quota";
  if (leaveType === "ลาป่วย") field = "sick_quota";
  if (leaveType === "ลากิจ") field = "personal_quota";

  /* ==============================
     1️⃣ ตรวจสอบ quota
  ============================== */
  if (field) {
    const { data: empData, error } = await window.supabaseClient
      .from("employees")
      .select(`${field}`)
      .eq("emp_code", empCode)
      .single();

    if (error || !empData) {
      alert("ไม่สามารถตรวจสอบวันลาได้");
      return false;
    }

    if (empData[field] < totalDays) {
      alert("วันลาคงเหลือไม่เพียงพอ");
      return false;
    }
  }

  /* ==============================
     2️⃣ ตรวจสอบลาซ้อน
  ============================== */
  const { data: overlap } = await window.supabaseClient
    .from("leave_requests")
    .select("id")
    .eq("emp_code", empCode)
    .neq("status", "rejected")
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (overlap && overlap.length > 0) {
    alert("มีคำขอลาในช่วงเวลานี้แล้ว");
    return false;
  }

  return true;
}
