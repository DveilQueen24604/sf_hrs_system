async function login() {

  const empCode = document.getElementById("emp").value;
  const password = document.getElementById("pass").value;


  if (!empCode || !password) {
    alert("กรุณากรอกข้อมูลให้ครบ");
    return;
  }

  if (!window.supabaseClient) {
    alert("ระบบยังไม่เชื่อมต่อฐานข้อมูล กรุณาลองใหม่");
    return;
  }

  // Query employees table by emp_code
  const { data, error } = await window.supabaseClient
    .from('employees')
    .select('id, emp_code, full_name, password, role')
    .eq('emp_code', empCode)   // ✅ แก้ตรงนี้
    .maybeSingle();

  if (error) {
    console.error('Supabase query error', error);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล');
    return;
  }

  if (!data) {
    alert('ไม่พบรหัสพนักงาน');
    return;
  }

  // Compare password
  const dbPass = data.password || '';
  if (dbPass !== password) {   // ✅ แก้ตรงนี้
    alert('รหัสผ่านไม่ถูกต้อง');
    return;
  }

  // Success: store session info
  localStorage.setItem('isLogin', 'true');
  localStorage.setItem('empId', data.emp_code || data.id);
  localStorage.setItem('userName', data.full_name || '');
  localStorage.setItem('role', data.role || 'employee');
  localStorage.setItem('loginTime', Date.now());

  // Redirect by role
  if (data.role === "manager") {          // ✅ ใช้ data.role
    window.location.href = "dashboard-manager.html";
  } 
  else if (data.role === "hr") {
    window.location.href = "hr-dashboard.html";
  }
  else {
    window.location.href = "dashboard.html";
  }

}
