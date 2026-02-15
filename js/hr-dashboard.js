/* ==========================================
   HR DASHBOARD - PRODUCTION VERSION
========================================== */

let currentUser = {
  empId: null,
  role: null,
  name: null
};

/* ==========================================
   INIT
========================================== */
document.addEventListener("DOMContentLoaded", async () => {

  currentUser.empId = localStorage.getItem("empId");
  currentUser.role = localStorage.getItem("role");
  currentUser.name = localStorage.getItem("userName");

  if (!currentUser.empId) {
    window.location.href = "index.html";
    return;
  }

  await loadTopbar();
  setupRoleUI();
});

/* ==========================================
   ROLE CONTROL
========================================== */
function setupRoleUI() {

  const role = currentUser.role;

  // ถ้าไม่ใช่ HR ซ่อน HR module
  if (role !== "hr") {
    const hrOnly = document.querySelectorAll(".hr-only");
    hrOnly.forEach(el => el.style.display = "none");
  }
}

/* ==========================================
   TOPBAR
========================================== */
async function loadTopbar() {

  const topbarEl = document.getElementById("topbarUserName");
  if (!topbarEl) return;

  if (currentUser.name) {
    topbarEl.textContent = currentUser.name;
  }

  // โหลดชื่อใหม่จาก DB
  const { data } = await window.supabaseClient
    .from("employees")
    .select("full_name")
    .eq("emp_code", currentUser.empId)
    .maybeSingle();

  if (data?.full_name) {
    topbarEl.textContent = data.full_name;
    localStorage.setItem("userName", data.full_name);
  }
}

/* ==========================================
   REQUEST (HR ก็ใช้เหมือนพนักงาน)
========================================== */
async function submitRequest() {

  const role = localStorage.getItem("role");
  const empCode = localStorage.getItem("empId");
  const fullName = localStorage.getItem("userName");

  const leaveType = document.getElementById("leaveType").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const detail = document.getElementById("leaveDetail").value;

  if (!leaveType || !startDate || !endDate) {
    alert("กรุณากรอกข้อมูลให้ครบ");
    return;
  }
if (endDate < startDate) {
    alert("วันที่ไม่ถูกต้อง");
    return;
  }

  // คำนวณจำนวนวัน
  const s = new Date(startDate);
  const e = new Date(endDate);
  const totalDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;

  // 🔥 HR = อนุมัติอัตโนมัติ
  const status = role === "hr" ? "approved" : "pending";

  const isValid = await validateLeaveRequest(empCode, leaveType, startDate, endDate);
if (!isValid) return;

  // 1️⃣ INSERT ก่อน
  const { error } = await window.supabaseClient
    .from("leave_requests")
    .insert([{
      emp_code: empCode,
      full_name: fullName,
      role: role,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      detail: detail,
      status: status,
      approver_name: role === "hr" ? fullName : null,
      approved_at: role === "hr" ? new Date().toISOString() : null,
      created_at: new Date().toISOString()
    }]);

  if (error) {
    alert(error.message);
    return;
  }

  // 2️⃣ ถ้า HR → หักวันลาเลย
  if (role === "hr") {

    let field = null;
    if (leaveType === "ลาพักร้อน") field = "annual_quota";
    if (leaveType === "ลาป่วย") field = "sick_quota";
    if (leaveType === "ลากิจ") field = "personal_quota";

    if (field) {
      const { data } = await window.supabaseClient
        .from("employees")
        .select(`${field}, id`)
        .eq("emp_code", empCode)
        .single();

      const newQuota = Math.max(0, (data[field] || 0) - totalDays);

      await window.supabaseClient
        .from("employees")
        .update({ [field]: newQuota })
        .eq("id", data.id);
    }
  }

  alert("บันทึกคำขอเรียบร้อย");
  closeRequest();

}

async function deductLeaveQuota(empCode, leaveType, days) {

  const { data: emp, error } = await window.supabaseClient
    .from("employees")
    .select("annual_quota, sick_quota, personal_quota")
    .eq("emp_code", empCode)
    .maybeSingle();

  if (error || !emp) return;

  let updateData = {};

  if (leaveType === "ลาพักร้อน") {

    if (emp.annual_quota < days) return false;

    updateData.annual_quota = emp.annual_quota - days;
  }

  if (leaveType === "ลาป่วย") {

    if (emp.sick_quota < days) return false;

    updateData.sick_quota = emp.sick_quota - days;
  }

  if (leaveType === "ลากิจ") {

    if (emp.personal_quota < days) return false;

    updateData.personal_quota = emp.personal_quota - days;
  }


  await window.supabaseClient
    .from("employees")
    .update(updateData)
    .eq("emp_code", empCode);

  return true;
}




/* ==========================================
   APPROVE (HR เห็นทั้งหมด)
========================================== */ 
async function openApprovePopup() {

  const role = localStorage.getItem("role");

  document.getElementById("approvePopup").style.display = "block";

  // 🔹 Manager = อนุมัติ
  if (role === "manager") {
    await loadAllPendingRequests();
    return;
  }

  // 🔹 Employee + HR = ดูสถานะของตัวเอง
  await loadMyLeaveStatus();
}

function closeApprovePopup() {
  document.getElementById("approvePopup").style.display = "none";
}

async function loadMyLeaveStatus() {
  const list = document.getElementById("approveList");
  list.innerHTML = "กำลังโหลดข้อมูล...";

  const empId = localStorage.getItem("empId");

  const { data, error } = await window.supabaseClient
    .from("leave_requests")
    .select("leave_type, start_date, end_date, status")
    .eq("emp_code", empId)
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = "โหลดข้อมูลไม่สำเร็จ";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "ยังไม่มีคำขอ";
    return;
  }

  list.innerHTML = "";

  data.forEach(r => {
    list.innerHTML += `
      <div class="approve-item">
        <b>${r.leave_type}</b><br>
        วันที่: ${r.start_date} - ${r.end_date}<br>
        สถานะ: <b>${translateStatus(r.status)}</b>
      </div>
      <hr>
    `;
  });
}


/* ==========================================
   HR REPORT (FINAL CLEAN VERSION)
========================================== */

function openHRReport() {
  document.getElementById("hrReportModal").style.display = "block";
  generateReportYears();
  generateHRReport(); // โหลดทันที
}

function closeHRReport() {
  document.getElementById("hrReportModal").style.display = "none";
}

function generateReportYears() {

  const yearSelect = document.getElementById("reportYear");
  if (!yearSelect) return;

  const currentYear = new Date().getFullYear();
  yearSelect.innerHTML = "";

  for (let y = currentYear; y >= currentYear - 5; y--) {
    const option = document.createElement("option");
    option.value = y;
    option.textContent = y;
    yearSelect.appendChild(option);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("reportYear");
  const monthEl = document.getElementById("reportMonth");

  if (yearEl) yearEl.addEventListener("change", generateHRReport);
  if (monthEl) monthEl.addEventListener("change", generateHRReport);
});

let currentReportData = [];

async function generateHRReport() {

  const year = document.getElementById("reportYear").value;
  const month = document.getElementById("reportMonth").value;

  let query = window.supabaseClient
 
  .from("leave_requests")
  .select(`
  emp_code,
  leave_type,
  start_date,
  end_date,
  status,
  employees!leave_requests_emp_code_fkey (
    full_name,
    position,
    department,
    annual_quota,
    sick_quota,
    personal_quota
  )
`)

  .eq("status", "approved");


  if (year) {
    const startDate = month
      ? `${year}-${month.padStart(2, "0")}-01`
      : `${year}-01-01`;

    const endDate = month
      ? `${year}-${month.padStart(2, "0")}-31`
      : `${year}-12-31`;

    query = query
      .gte("start_date", startDate)
      .lte("start_date", endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return;
  }

  // 🔥 ตรงนี้สำคัญมาก
  currentReportData = data.map(r => {

  const start = new Date(r.start_date);
  const end = new Date(r.end_date);
  const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

  let remaining = "";

  if (r.leave_type === "ลาพักร้อน") {
    remaining = r.employees?.annual_quota ?? "-";
  }
  if (r.leave_type === "ลาป่วย") {
    remaining = r.employees?.sick_quota ?? "-";
  }
  if (r.leave_type === "ลากิจ") {
    remaining = r.employees?.personal_quota ?? "-";
  }

  return {
    emp_code: r.emp_code,
    full_name: r.employees?.full_name ?? "-",
    position: r.employees?.position ?? "-",
    department: r.employees?.department ?? "-",
    leave_type: r.leave_type,
    start_date: r.start_date,
    end_date: r.end_date,
    days: days,
    remaining: remaining,
    status: r.status
  };
});


  console.log("REPORT DATA:", currentReportData);

  calculateReport(currentReportData);

}


function calculateReport(data) {

  let total = data.length;
  let sick = 0;
  let personal = 0;
  let annual = 0;
  let ot = 0;
  let wfh = 0;
  let totalDays = 0;

  const employeeSet = new Set();

  data.forEach(r => {

    employeeSet.add(r.emp_code);

    if (r.leave_type === "ลาป่วย") sick++;
    if (r.leave_type === "ลากิจ") personal++;
    if (r.leave_type === "ลาพักร้อน") annual++;
    if (r.leave_type === "ขอทำงานล่วงเวลา (OT)") ot++;
    if (r.leave_type === "ทำงานที่บ้าน (WFH)") wfh++;

    const start = new Date(r.start_date);
    const end = new Date(r.end_date);
    const diff = (end - start) / (1000 * 60 * 60 * 24) + 1;

    if (!isNaN(diff)) {
      totalDays += diff;
    }
  });

 document.getElementById("r_total").textContent = total;
document.getElementById("r_sick").textContent = sick;
document.getElementById("r_personal").textContent = personal;
document.getElementById("r_annual").textContent = annual;
document.getElementById("r_employee").textContent = employeeSet.size;
document.getElementById("r_days").textContent = totalDays;
document.getElementById("r_ot").textContent = ot;
document.getElementById("r_wfh").textContent = wfh;

}

function exportExcel() {

  if (!currentReportData.length) {
    alert("ไม่มีข้อมูลสำหรับ Export");
    return;
  }

  let csv = "Emp Code,Full Name,Position,Department,Leave Type,Start Date,End Date,Days Used,Remaining Leave,Status\n";

  currentReportData.forEach(r => {
    csv += `${r.emp_code},${r.full_name},${r.position},${r.department},${r.leave_type},${r.start_date},${r.end_date},${r.days},${r.remaining},${r.status}\n`;
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = "HR_Report_Detail.csv";
  link.click();
}


function exportPDF() {

  if (!currentReportData.length) {
    alert("ไม่มีข้อมูลสำหรับ Export");
    return;
  }

  let content = "HR REPORT\n\n";

  currentReportData.forEach(r => {
    content += `Emp: ${r.emp_code}\n`;
    content += `Type: ${r.leave_type}\n`;
    content += `Date: ${r.start_date} - ${r.end_date}\n`;
    content += `Status: ${r.status}\n`;
    content += "-----------------------------\n";
  });

  const blob = new Blob([content], { type: "application/pdf" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = "HR_Report.pdf";
  link.click();
}



/* ==========================================
   EMPLOYEE MANAGEMENT
========================================== */
function openEmployeePopup() {
  document.getElementById("employeePopup").style.display = "block";
  loadEmployees();   // 🔥 บรรทัดนี้สำคัญมาก
}


async function loadEmployees() {

  const list = document.getElementById("employeeList");
  list.innerHTML = "";

  const { data, error } = await window.supabaseClient
    .from("employees")
    .select("*")
    .order("emp_code", { ascending: true });

  if (error) {
    list.innerHTML = `<tr><td colspan="5">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    return;
  }

  data.forEach(emp => {
    list.innerHTML += `
      <tr>
        <td>${emp.emp_code}</td>
        <td>${emp.full_name}</td>
        <td>${emp.department}</td>
        <td>${emp.position || "-"}</td>
        <td>
          <button class="btn-edit" onclick="editEmployee('${emp.id}')">แก้ไข</button>
        </td>
      </tr>
    `;
  });
}

async function editEmployee(id) {

  const { data } = await window.supabaseClient
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  document.getElementById("editId").value = data.id;
  document.getElementById("editCode").value = data.emp_code;
  document.getElementById("editName").value = data.full_name;
  document.getElementById("editDepartment").value = data.department;
  document.getElementById("editPosition").value = data.position;
  document.getElementById("editAnnual").value = data.annual_quota;
  document.getElementById("editSick").value = data.sick_quota;
  document.getElementById("editPersonal").value = data.personal_quota;

  document.getElementById("editEmployeeModal").style.display = "block";
}

async function saveEmployee() {

  const id = document.getElementById("editId").value;

  const { error } = await window.supabaseClient
    .from("employees")
    .update({
      emp_code: document.getElementById("editCode").value,
      full_name: document.getElementById("editName").value,
      department: document.getElementById("editDepartment").value,
      position: document.getElementById("editPosition").value,
      annual_quota: parseInt(document.getElementById("editAnnual").value),
      sick_quota: parseInt(document.getElementById("editSick").value),
      personal_quota: parseInt(document.getElementById("editPersonal").value)
    })
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  alert("บันทึกสำเร็จ");
  closeEditEmployee();
  loadEmployees();
}
async function confirmDelete() {

  const id = document.getElementById("editId").value;

  if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบพนักงานคนนี้?")) {
    return;
  }

  const { error } = await window.supabaseClient
    .from("employees")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  alert("ลบพนักงานเรียบร้อย");
  closeEditEmployee();
  loadEmployees();
}

function closeEditEmployee() {
  document.getElementById("editEmployeeModal").style.display = "none";
}


async function openAddEmployee() {

  const emp_code = prompt("รหัสพนักงาน");
  const full_name = prompt("ชื่อ - นามสกุล");
  const department = prompt("แผนก");

  if (!emp_code || !full_name) return;

  const { error } = await window.supabaseClient
    .from("employees")
    .insert([{
      emp_code,
      full_name,
      department,
      annual_quota: 10,
      sick_quota: 30,
      personal_quota: 5
    }]);

  if (error) {
    alert(error.message);
    return;
  }

  alert("เพิ่มพนักงานสำเร็จ");
  loadEmployees();
}
function closeEmployeePopup() {
  document.getElementById("employeePopup").style.display = "none";
}


/* ==========================================
   HELPERS
========================================== */
function translateStatus(status) {
  if (status === "pending") return "รออนุมัติ";
  if (status === "approved") return "อนุมัติแล้ว";
  if (status === "rejected") return "ไม่อนุมัติ";
  return status;
}
