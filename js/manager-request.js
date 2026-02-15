/* ======================
   REQUEST (หัวหน้าเอง)
====================== */
function openRequest() {
  document.getElementById("requestModal").style.display = "block";
}

function closeRequest() {
  document.getElementById("requestModal").style.display = "none";
}
async function submitRequest() {

  const leaveType = document.getElementById("leaveType").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const detail = document.getElementById("leaveDetail").value;

  if (!leaveType || !startDate || !endDate) {
    alert("กรุณากรอกข้อมูลให้ครบ");
    return;
  }

  if (endDate < startDate) {
    alert("วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่ม");
    return;
  }

  const empCode = localStorage.getItem("empId");
  const fullName = localStorage.getItem("userName");

  const s = new Date(startDate);
  const e = new Date(endDate);
  const totalDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;

  const isValid = await validateLeaveRequest(empCode, leaveType, startDate, endDate);
if (!isValid) return;

  // 🔥 INSERT แบบ await (ดีกว่า .then)
  const { error } = await window.supabaseClient
    .from("leave_requests")
    .insert([{
      emp_code: empCode,
      full_name: fullName,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      detail: detail,
      status: "approved",
      approver_name: fullName,
      approver_id: empCode,

      created_at: new Date().toISOString()  // 🔥 สำคัญมาก
    }]);

  if (error) {
    console.error(error);
    alert(error.message);   // 🔥 แสดง error จริง
    return;
  }

  // 🔥 หักวันลาอัตโนมัติ
  let field = null;
  if (leaveType === "ลาพักร้อน") field = "annual_quota";
  if (leaveType === "ลาป่วย") field = "sick_quota";
  if (leaveType === "ลากิจ") field = "personal_quota";

  if (field) {
    const { data, error: empError } = await window.supabaseClient
      .from("employees")
      .select(`${field}, id`)
      .eq("emp_code", empCode)
      .single();

    if (empError) {
      console.error(empError);
      alert(empError.message);
      return;
    }

    const newQuota = Math.max(0, (data[field] || 0) - totalDays);

    const { error: updateError } = await window.supabaseClient
      .from("employees")
      .update({ [field]: newQuota })
      .eq("id", data.id);

    if (updateError) {
      console.error(updateError);
      alert(updateError.message);
      return;
    }
  }

  alert("ส่งคำขอเรียบร้อย (อนุมัติอัตโนมัติ)");
  closeRequest();

}



document.getElementById("startDate").addEventListener("change", function () {
  document.getElementById("endDate").min = this.value;
});
