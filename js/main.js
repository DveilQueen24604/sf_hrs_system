const BALANCES = {
  Vacation: '06:00:00',
  Sick: '30:00:00',
  Personal: '06:00:00'
};

let calDate = new Date();
let globalRequests = [];
let currentRole = '';
let currentUserId = '';

// ===== LOGIN =====
async function handleLogin() {
  const id = empId.value.trim().toUpperCase();
  const pass = empPass.value.trim();
  const { data: user } = await _supabase
    .from('profiles')
    .select('*')
    .eq('emp_id', id)
    .single();

  if (!user || pass !== '1234') return alert('Login ไม่ถูกต้อง');

  currentRole = user.role;
  currentUserId = user.emp_id;

  loginSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  document.body.classList.remove('bg-office');
  userDisplayName.textContent = user.full_name;

  essInfoId.textContent = user.emp_id;
  essInfoName.textContent = user.full_name;

  setupRolePermissions(user.role);
  renderCalendar();
  fetchRequestsFromSupabase();
  renderESSBalances();
}

// ===== DATA =====
async function fetchRequestsFromSupabase() {
  const { data } = await _supabase
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false });

  globalRequests = data || [];
  currentRole === 'manager' ? renderManagerTable() : renderStaffTable();
}

// ===== UI =====
function showSubMenu(){ requestSubMenu.classList.remove('hidden'); }
function hideSubMenu(){ requestSubMenu.classList.add('hidden'); }
function showESSPanel(){ essPanel.classList.remove('hidden'); }
function hideESSPanel(){ essPanel.classList.add('hidden'); }

// ===== CALENDAR =====
function renderCalendar(){
  calendarGrid.innerHTML = '';
  const months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  calendarTitle.textContent = `${months[calDate.getMonth()]} ${calDate.getFullYear()}`;

  const first = new Date(calDate.getFullYear(), calDate.getMonth(), 1).getDay();
  const last = new Date(calDate.getFullYear(), calDate.getMonth()+1, 0).getDate();

  for(let i=0;i<first;i++) calendarGrid.appendChild(document.createElement('div'));

  for(let d=1;d<=last;d++){
    const el = document.createElement('div');
    el.textContent = d;
    el.className = 'p-2 rounded-lg hover:bg-rose-50 cursor-pointer';
    calendarGrid.appendChild(el);
  }
}
