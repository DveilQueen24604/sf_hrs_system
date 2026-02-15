console.log("✅ employee-status.js LOADED");

async function loadEmployeeStatusFromDB() {
  const empId = localStorage.getItem("empId");
  console.log("👤 EMP ID =", empId);

  const { data, error } = await window.supabaseClient
    .from("leave_requests")
    .select("id, leave_type, start_date, end_date, status")
    .eq("emp_id", empId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ DB ERROR:", error);
    return;
  }

  console.log("📦 DATA FROM SUPABASE:", data);
}
