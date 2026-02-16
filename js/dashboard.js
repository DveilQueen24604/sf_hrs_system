
/* ======================
   ROLE UI SWITCH อัพเดตแก้ไข 16/02/69
====================== */
document.addEventListener("DOMContentLoaded", async () => {

  // Load topbar user name. Prefer localStorage, otherwise fetch from `employees` by emp_code or id
  const topbarEl = document.getElementById("topbarUserName");
  const cachedName = localStorage.getItem("userName");
  if (topbarEl && cachedName) {
    topbarEl.textContent = cachedName;
  }

  const empId = localStorage.getItem("empId");
  // Always attempt to fetch latest name from DB (override cache when available)
  if (empId && topbarEl) {
    // try emp_code first
    let { data, error } = await window.supabaseClient
      .from("employees")
      .select("full_name")
      .eq("emp_code", empId)
      .maybeSingle();

    if (error) console.warn("load topbar name by emp_code error", error);

    if (!data && /^\d+$/.test(empId)) {
      const r = await window.supabaseClient
        .from("employees")
        .select("full_name")
        .eq("id", parseInt(empId, 10))
        .maybeSingle();
      data = r.data;
      if (r.error) console.warn("load topbar name by id error", r.error);
    }

    if (data && data.full_name) {
      topbarEl.textContent = data.full_name;
      localStorage.setItem("userName", data.full_name);
    }
  }
});

/* ======================
   REQUEST (EMPLOYEE)
====================== */
/* =========================
   SUBMIT LEAVE REQUEST
========================= */
async function submitRequest() {
  const request = {
  emp_code: localStorage.getItem("empId"),
  full_name: localStorage.getItem("userName"),
  role: localStorage.getItem("role"),
  leave_type: document.getElementById("leaveType").value,
  start_date: document.getElementById("startDate").value,
  end_date: document.getElementById("endDate").value,
  detail: document.getElementById("leaveDetail").value,
  status: "pending"
};


  if (!request.leave_type || !request.start_date || !request.end_date) {
    alert("กรุณากรอกข้อมูลให้ครบ");
    return;
  }

  const isValid = await validateLeaveRequest(request.emp_code, request.leave_type, request.start_date, request.end_date);
if (!isValid) return;
  // Attempt to find the department manager for this employee and attach approver info
  try {
    const empCode = request.emp_code;
    if (empCode) {
      const { data: empRec } = await window.supabaseClient
        .from("employees")
        .select("department")
        .eq("emp_code", empCode)
        .maybeSingle();

      const department = empRec && empRec.department;
      if (department) {
        // find manager in same department
        const { data: mgr } = await window.supabaseClient
          .from("employees")
          .select("emp_code, full_name")
          .eq("role", "manager")
          .eq("department", department)
          .limit(1)
          .maybeSingle();

        if (mgr) {
          request.approver_id = mgr.emp_code;
          request.approver_name = mgr.full_name;
        }
      }
    }
  } catch (e) {
    console.warn("failed to lookup approver:", e);
  }

  const { error } = await window.supabaseClient
  .from("leave_requests")
  .insert([request]);

if (error) {
  console.error("INSERT ERROR:", error);
  alert(error.message);
  return;
}


  alert("ส่งคำขอเรียบร้อย");
  closeRequest();

}


 /* ======================
   APPROVE BUTTON (SHARED)
====================== */
// ===== APPROVE / STATUS (ใช้ Supabase จริง) =====

async function openApprovePopup() {
  document.getElementById("approvePopup").style.display = "block";
  await loadEmployeeStatus(); // ใช้ตัวเดียวกับ status พนักงาน
}

function closeApprovePopup() {
  document.getElementById("approvePopup").style.display = "none";
}

async function loadEmployeeStatus() {
  const list = document.getElementById("approveList") || document.getElementById("statusList");
  if (!list) return;

  list.innerHTML = "กำลังโหลดข้อมูล...";

  const empId = localStorage.getItem("empId");

  const { data, error } = await window.supabaseClient
    .from("leave_requests")
    .select("leave_type, start_date, end_date, status")
    .eq("emp_code", empId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    list.innerHTML = "โหลดข้อมูลไม่สำเร็จ";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "ไม่มีข้อมูล";
    return;
  }

  list.innerHTML = "";
  data.forEach(r => {
    list.innerHTML += `
      <div class="approve-item">
        <b>${r.leave_type}</b><br>
        วันที่: ${r.start_date}${r.end_date ? " - " + r.end_date : ""}<br>
        สถานะ: ${translateStatus(r.status)}
      </div>
      <hr>
    `;
  });
}



/* ======================
   STATUS (EMPLOYEE)
====================== */
async function openApprovePopup() {
  document.getElementById("approvePopup").style.display = "block";
  await loadApproveList();
}

async function loadApproveList() {
  const list = document.getElementById("approveList");
  const empId = localStorage.getItem("empId");

  const { data, error } = await window.supabaseClient
    .from("leave_requests")
    .select("*")
    .eq("emp_code", empId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    list.innerHTML = "โหลดข้อมูลไม่สำเร็จ";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "ไม่มีคำขอรออนุมัติ";
    return;
  }

  list.innerHTML = "";
  data.forEach(r => {
    list.innerHTML += `
      <div>
        <b>${r.leave_type}</b><br>
        วันที่: ${r.start_date} - ${r.end_date}<br>
        สถานะ: รออนุมัติ
      </div>
      <hr>
    `;
  });
}
function closeApprovePopup() {
  document.getElementById("approvePopup").style.display = "none";
}

async function openStatusPopup() {
  document.getElementById("statusPopup").style.display = "block";
  await loadEmployeeStatusList();
}

async function loadEmployeeStatusList() {
  const list = document.getElementById("statusList");
  if (!list) return;

  list.innerHTML = "กำลังโหลดข้อมูล...";

  const empId = localStorage.getItem("empId");

  const { data, error } = await window.supabaseClient
    .from("leave_requests")
    .select("*")
    .eq("emp_code", empId)
    .order("created_at", { ascending: false });

 if (error) {
    console.error(error);
    list.innerHTML = "โหลดข้อมูลไม่สำเร็จ";
    return;
  }

  console.log("DATA:", data); 

if (!data || data.length === 0) {
    list.innerHTML = "ไม่มีข้อมูล";
    return;
  }

  list.innerHTML = "";

  data.forEach(r => {
  list.innerHTML += `
    <div>
      <b>${r.leave_type}</b><br>
      วันที่: ${r.start_date} - ${r.end_date}<br>
      สถานะ: ${translateStatus(r.status)}<br>

      ${r.status === "approved" ? `
        อนุมัติโดย: ${r.approved_by || "-"}<br>
        วันที่อนุมัติ: ${r.approved_at ? new Date(r.approved_at).toLocaleString() : "-"}<br>
      ` : ""}

      ${r.status === "rejected" ? `
        ปฏิเสธโดย: ${r.approved_by || "-"}<br>
        วันที่ดำเนินการ: ${r.approved_at ? new Date(r.approved_at).toLocaleString() : "-"}<br>
      ` : ""}

      ${r.status === "pending" ? `
        <button onclick="cancelLeave('${r.id}')"
        style="margin-top:8px;background:#dc3545;
        color:white;border:none;padding:6px 12px;
        border-radius:6px;cursor:pointer;">
        ยกเลิกคำขอ
        </button>
      ` : ""}
    </div>
    <hr>
  `;
});

}



function translateStatus(status) {
  if (status === "pending") return "รออนุมัติ";
  if (status === "approved") return "อนุมัติแล้ว";
  if (status === "rejected") return "ไม่อนุมัติ";
  if (status === "cancelled") return "ยกเลิกแล้ว";
  return status;
}




