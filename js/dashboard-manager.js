
/* ======================
   APPROVE (MANAGER) อัพเดตแก้ไข 16/02/69
====================== */

function openApprovePopup() {
  document.getElementById("approvePopup").style.display = "block";
  loadApproveList();
}

function closeApprovePopup() {
  document.getElementById("approvePopup").style.display = "none";
}

/* โหลดรายการรออนุมัติจาก Supabase */
async function loadApproveList() {
  const list = document.getElementById("approveList");
  list.innerHTML = "กำลังโหลด...";

  // show only requests assigned to this manager (approver_id matches)
  const myApproverId = localStorage.getItem("empId");

 let query = window.supabaseClient
  .from("leave_requests")
  .select("id, emp_code, full_name, leave_type, start_date, end_date, status, approver_id")
  .eq("status", "pending")
  .order("created_at", { ascending: true });

if (myApproverId) {
  query = query.eq("approver_id", myApproverId);
}

const { data, error } = await query;


  if (error) {
    console.error(error);
    list.innerHTML = "<p>โหลดข้อมูลไม่สำเร็จ</p>";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<p>ไม่มีรายการรออนุมัติ</p>";
    return;
  }

  list.innerHTML = "";

  data.forEach(r => {
    list.innerHTML += `
      <div class="approve-item">
        <b>${r.leave_type}</b><br>
        พนักงาน: ${r.full_name}<br>
        วันที่: ${r.start_date} - ${r.end_date}<br>
        <button onclick="approve(${r.id})">✅ อนุมัติ</button>
<button onclick="reject(${r.id})">❌ ปฏิเสธ</button>

      </div>
      
    `;
  });
}


/* ปุ่มอนุมัติ / ปฏิเสธ */
function approve(id) {
  updateStatus(id, "approved");
}

function reject(id) {
  updateStatus(id, "rejected");
}

/* update สถานะลง Supabase */
async function updateStatus(id, status) {
  const { error } = await window.supabaseClient
  .from("leave_requests")
 .update({
  status: status,
  approver_name: localStorage.getItem("userName"),
  approved_at: new Date()
})

  .eq("id", id);   // 🔥 ต้องมีบรรทัดนี้

if (error) {
  console.error(error);
  alert(error.message);
  return;
}


  // If approved, deduct leave days from employee quotas
  if (status === "approved") {
    // fetch the leave request to know emp and dates
    const { data: leave, error: leaveErr } = await window.supabaseClient
      .from("leave_requests")
      .select("emp_code, start_date, end_date, leave_type")
      .eq("id", id)
      .maybeSingle();

    if (leaveErr) console.warn("failed to fetch leave record:", leaveErr);

    if (leave) {
      const empCode = leave.emp_code;

      // calculate number of days (inclusive)
      let days = 1;
      try {
        const s = new Date(leave.start_date);
        const e = leave.end_date ? new Date(leave.end_date) : s;
        days = Math.round((e - s) / (24 * 60 * 60 * 1000)) + 1;
        if (!isFinite(days) || days < 1) days = 1;
        const d = leave.end_date ? new Date(leave.end_date) : s;
if (isNaN(e)) e = s;

      } catch (e) {
        days = 1;
      }

      // map leave_type to employees quota field
      const lt = (leave.leave_type || "").trim();
      let field = null;
      if (lt === "ลาพักร้อน") field = "annual_quota";
      else if (lt === "ลาป่วย") field = "sick_quota";
      else if (lt === "ลากิจ") field = "personal_quota";

      if (field) {
        // fetch employee record (try emp_code then id)
        let { data: emp, error: empErr } = await window.supabaseClient
          .from("employees")
          .select(`${field}, id, emp_code`)
          .eq("emp_code", empCode)
          .maybeSingle();

        if (empErr) console.warn("fetch employee by emp_code error", empErr);

        if (!emp && /^\d+$/.test(String(empCode))) {
          const r = await window.supabaseClient
            .from("employees")
            .select(`${field}, id, emp_code`)
            .eq("id", parseInt(empCode, 10))
            .maybeSingle();
          emp = r.data;
          if (r.error) console.warn("fetch employee by id error", r.error);
        }

        if (emp) {
          const current = emp[field] != null ? Number(emp[field]) : 0;
          const newVal = Math.max(0, current - Number(days));

          const { error: updErr } = await window.supabaseClient
            .from("employees")
            .update({ [field]: newVal })
            .eq("id", emp.id);

          if (updErr) console.error("failed updating employee quota", updErr);
        } else {
          console.warn("employee not found to deduct quota:", empCode);

        }
      }
    }
  }

  // โหลดรายการใหม่ (pending จะหายไป)
  loadApproveList();

  // If ESS popup is open, refresh it to show new quotas
  try {
    const ess = document.getElementById("essPopup");
    if (ess && ess.style.display === "block" && typeof openESSPopup === "function") {
      openESSPopup();
    }
  } catch (e) {
    console.warn("failed to refresh ESS popup", e);
  }
}

/* ======================
   STATUS (MANAGER)
====================== */

function openStatusPopup() {
  document.getElementById("statusPopup").style.display = "block";
  loadStatusList();
}

function closeStatusPopup() {
  document.getElementById("statusPopup").style.display = "none";
}

/* โหลดรายการที่อนุมัติ / ปฏิเสธแล้ว */
async function loadStatusList() {
  const list = document.getElementById("statusList");
  list.innerHTML = "กำลังโหลด...";

 const { data, error } = await window.supabaseClient
  .from("leave_requests")
  .select("*")
  .in("status", ["approved", "rejected"])
  .eq("approver_id", localStorage.getItem("empId"))
  .order("approved_at", { ascending: false });


  if (error) {
    console.error(error);
    list.innerHTML = "<p>โหลดข้อมูลไม่สำเร็จ</p>";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<p>ยังไม่มีรายการที่อนุมัติ / ปฏิเสธ</p>";
    return;
  }

  list.innerHTML = "";

  data.forEach(r => {
    const statusBadge =
      r.status === "approved"
        ? `<span style="color:green;font-weight:bold">อนุมัติ</span>`
        : `<span style="color:red;font-weight:bold">ปฏิเสธ</span>`;

    list.innerHTML += `
      <div class="status-item">
        <b>${r.leave_type}</b> (${statusBadge})<br>
        ${r.emp_code} - ${r.full_name}<br>
        วันที่ลา: ${r.start_date} ถึง ${r.end_date}<br>
        อนุมัติโดย: ${r.approver_name || "-"}<br>
        วันที่อนุมัติ: ${
          r.approved_at
            ? new Date(r.approved_at).toLocaleString()
            : "-"
        }
      </div>
      <hr>
    `;
  });
}

/* ======================
   EMPLOYEE SELF SERVICE
====================== */

async function openESSPopup() {
  document.getElementById("essPopup").style.display = "block";

  const empId = localStorage.getItem("empId") || "MGR-001";

  // Fetch employee record from employees table
  const { data, error } = await window.supabaseClient
    .from("employees")
    .select("id, emp_code, full_name, position, department, annual_quota, sick_quota, personal_quota")
    .eq("emp_code", empId)
    .limit(1)
    .maybeSingle();

  if (error) console.warn("fetch by emp_code error", error);

  if (!data && /^\d+$/.test(empId)) {
    const r = await window.supabaseClient
      .from("employees")
      .select("id, emp_code, full_name, position, department, annual_quota, sick_quota, personal_quota")
      .eq("id", parseInt(empId, 10))
      .limit(1)
      .maybeSingle();
    data = r.data;
    if (r.error) console.warn("fetch by id error", r.error);
  }

  if (!data) {
    console.warn("Employee not found:", empId);
    // fallback to showing stored localStorage values
    document.getElementById("essEmpId").textContent = empId;
    document.getElementById("essEmpName").textContent = localStorage.getItem("userName") || "-";
    return;
  }

  document.getElementById("essEmpId").textContent = data.emp_code || data.id || "-";
  document.getElementById("essEmpName").textContent = data.full_name || "-";
  document.getElementById("essPosition").textContent = data.position || "-";
  const deptEl = document.getElementById("essDepartment");
  if (deptEl) deptEl.textContent = data.department || "-";

  document.getElementById("vacationBox").textContent = (data.annual_quota != null) ? `${data.annual_quota} วัน` : "- วัน";
  document.getElementById("sickBox").textContent = (data.sick_quota != null) ? `${data.sick_quota} วัน` : "- วัน";
  document.getElementById("personalBox").textContent = (data.personal_quota != null) ? `${data.personal_quota} วัน` : "- วัน";

  // Update topbar and cache
  try {
    const topbarEl = document.getElementById("topbarUserName");
    if (data.full_name) {
      localStorage.setItem("userName", data.full_name);
      if (topbarEl) topbarEl.textContent = data.full_name;
    }
  } catch (e) {
    console.warn("could not update topbar from manager ESS popup", e);
  }
}

function closeESSPopup() {
  document.getElementById("essPopup").style.display = "none";
}

/* ======================
   HISTORY (MANAGER SELF)
====================== */

function openMyHistory() {
  document.getElementById("historyPopup").style.display = "block";
  loadMyHistory();
}

function closeMyHistory() {
  document.getElementById("historyPopup").style.display = "none";
}

async function loadMyHistory() {

  const empCode = localStorage.getItem("empId");
  const list = document.getElementById("historyList");

  list.innerHTML = "กำลังโหลด...";

  const { data, error } = await window.supabaseClient
    .from("leave_requests")
    .select("*")
    .eq("emp_code", empCode)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    list.innerHTML = "โหลดข้อมูลไม่สำเร็จ";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "ยังไม่มีประวัติการลา";
    return;
  }

  list.innerHTML = "";

  data.forEach(r => {
    const statusText =
      r.status === "approved"
        ? "อนุมัติ"
        : r.status === "rejected"
        ? "ปฏิเสธ"
        : "รอดำเนินการ";

    list.innerHTML += `
      <div class="status-item">
        <b>${r.leave_type}</b> (${statusText})<br>
        วันที่ลา: ${r.start_date} ถึง ${r.end_date}<br>
        วันที่ยื่น: ${new Date(r.created_at).toLocaleString()}
      </div>
      <hr>
    `;
  });
}




/* ======================
   LOGOUT
====================== */
function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}
