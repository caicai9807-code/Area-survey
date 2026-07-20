const OUTPLAN_CHILD_KEY = 'areaSurveyOutPlanChildStates';
const OUTPLAN_ROLE_KEY = 'areaSurveyOutPlanRole';
const OUTPLAN_PEOPLE = ['张三', '李晨晨', '王海', '赵敏', '刘洋', '孙琪'];
const OUTPLAN_REASON_TABS = [
  { value: '', label: '全部' },
  { value: 'AREA_CHANGE', label: '面积变化' },
  { value: 'DIRECT_TO_HOUSEHOLD', label: '一管到户' },
  { value: 'NEW_ACCOUNT_OR_CAPACITY', label: '新开户及增容' },
  { value: 'WHOLESALE_USER', label: '趸售用户' }
];
const childPageSize = 10;

let currentRole = 'admin';
let currentReasonTab = '';
let childTasks = [];
let filteredTasks = [];
let currentPage = 1;
let currentTaskId = null;
let temporaryAssignees = new Set();
let toastTimer;

function childNow() {
  const date = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function loadChildStates() {
  try {
    return JSON.parse(localStorage.getItem(OUTPLAN_CHILD_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function parentStatus(status) {
  return {
    待分配: '待分配',
    进行中: '进行中',
    所长审核: '所长审核',
    管理部审核: '管理部审核',
    已完成: '已结束'
  }[status] || '待分配';
}

function syncParentStatus(parentId) {
  const parents = outPlanLoad();
  const parent = parents.find(item => item.id === parentId);
  if (!parent) return;
  const states = loadChildStates();
  const statuses = parent.stationIds.map(stationId => {
    const childId = `outplan-${parent.id}-${stationId}`;
    return states[childId]?.status || parentStatus(parent.status);
  });
  let next = '待分配';
  if (statuses.length && statuses.every(status => status === '已结束')) next = '已完成';
  else if (statuses.includes('管理部审核')) next = '管理部审核';
  else if (statuses.includes('所长审核')) next = '所长审核';
  else if (statuses.some(status => ['进行中', '已退回'].includes(status))) next = '进行中';
  if (parent.status !== next) {
    parent.status = next;
    parent.updatedAt = childNow();
    outPlanSave(parents);
  }
}

function saveChildState(task) {
  const states = loadChildStates();
  states[task.id] = {
    status: task.status,
    auditStatus: task.auditStatus,
    dispatchStatus: task.dispatchStatus,
    assignees: [...task.assignees],
    updatedAt: task.updatedAt
  };
  localStorage.setItem(OUTPLAN_CHILD_KEY, JSON.stringify(states));
  syncParentStatus(task.parentId);
}

function buildChildren() {
  const states = loadChildStates();
  childTasks = outPlanLoad()
    .filter(parent => !['未下发', '已作废'].includes(parent.status))
    .flatMap(parent => parent.stationIds.map(stationId => {
      const station = outPlanStation(stationId, parent);
      if (!station) return null;
      const status = parentStatus(parent.status);
      const active = !['待分配', '已结束'].includes(status);
      const base = {
        id: `outplan-${parent.id}-${station.id}`,
        parentId: parent.id,
        parentName: parent.name,
        reason: parent.reason,
        reasonText: outPlanReason(parent),
        source: '计划外',
        year: `${parent.start.slice(0, 4)}年`,
        station,
        status,
        auditStatus: ['所长审核', '管理部审核'].includes(status) ? '待审核' : status === '已结束' ? '通过' : '未上报',
        dispatchStatus: status === '待分配' ? '未下发' : '已下发',
        assignees: active ? ['张三'] : [],
        updatedAt: parent.logs?.[0]?.time || parent.createdAt
      };
      return states[base.id] ? { ...base, ...states[base.id] } : base;
    }).filter(Boolean));
  [...new Set(childTasks.map(task => task.parentId))].forEach(syncParentStatus);
}

function roleScope(task) {
  if (currentRole === 'admin') return true;
  if (currentRole === 'department') return task.station.department === '桥西管理部';
  if (currentRole === 'office') return task.station.office === '桥西片区所';
  return task.dispatchStatus === '已下发' && task.assignees.includes('张三');
}

function visibleTasks() {
  return childTasks.filter(roleScope);
}

function statusTag(status) {
  const map = {
    待分配: 'orange', 进行中: 'blue', 所长审核: 'orange', 管理部审核: 'orange', 已结束: 'green', 已退回: 'red',
    未下发: 'gray', 已下发: 'green', 未上报: 'gray', 已上报: 'blue', 待审核: 'orange', 通过: 'green'
  };
  return `<span class="tag tag-${map[status] || 'gray'}">${status}</span>`;
}

function changeRole(role) {
  currentRole = role;
  sessionStorage.setItem(OUTPLAN_ROLE_KEY, role);
  document.getElementById('roleSelect').value = role;
  const config = {
    admin: { name: '业务管理员', avatar: '业', title: '业务管理员全量视图', tip: '：查看全部计划外任务进度、审批记录和操作日志。', scope: '数据范围：全部管理部' },
    department: { name: '桥西管理部人员', avatar: '管', title: '管理部任务视图', tip: '：仅查看桥西管理部任务，处理管理部审核。', scope: '数据范围：桥西管理部' },
    office: { name: '桥西片区所所长', avatar: '所', title: '片区所长任务视图', tip: '：仅所长可分配、转派、改派和审核本所任务。', scope: '数据范围：桥西片区所' },
    surveyor: { name: '张三', avatar: '普', title: '普查人员个人视图', tip: '：仅查看已分配给本人的已下发任务。', scope: '当前普查人员：张三' }
  }[role];
  document.getElementById('currentUser').textContent = config.name;
  document.getElementById('currentAvatar').textContent = config.avatar;
  document.getElementById('roleViewTitle').textContent = config.title;
  document.getElementById('roleViewTip').textContent = config.tip;
  document.getElementById('scopeText').textContent = config.scope;
  currentPage = 1;
  applyFilters();
  renderAll();
}

function filteredByQuery() {
  const code = document.getElementById('codeFilter').value.trim().toLowerCase();
  const name = document.getElementById('nameFilter').value.trim().toLowerCase();
  const type = document.getElementById('typeFilter').value;
  const status = document.getElementById('statusFilter').value;
  return visibleTasks().filter(task => (!code || task.station.code.toLowerCase().includes(code))
    && (!name || task.station.name.toLowerCase().includes(name) || task.parentName.toLowerCase().includes(name))
    && (!type || task.station.type === type)
    && (!status || task.status === status));
}

function applyFilters() {
  filteredTasks = filteredByQuery()
    .filter(task => !currentReasonTab || task.reason === currentReasonTab);
}

function renderTabs() {
  const queriedTasks = filteredByQuery();
  document.getElementById('reasonTabs').innerHTML = OUTPLAN_REASON_TABS.map(tab => {
    const count = tab.value ? queriedTasks.filter(task => task.reason === tab.value).length : queriedTasks.length;
    return `<button class="task-tab ${tab.value === currentReasonTab ? 'active' : ''}" onclick="switchReason('${tab.value}')">${tab.label}<span class="count-badge">${count}</span></button>`;
  }).join('');
}

function switchReason(reason) {
  currentReasonTab = reason;
  currentPage = 1;
  applyFilters();
  renderAll();
}

function taskContext(task) {
  return encodeURIComponent(JSON.stringify({
    plan: { id: task.parentId, name: task.parentName, year: task.year, type: task.station.type, status: '创建成功', source: '计划外', reason: task.reasonText },
    task: {
      id: task.id,
      status: task.status,
      auditStatus: task.auditStatus,
      updatedAt: task.updatedAt,
      surveyors: task.assignees.join('、') || '待分配',
      station: { ...task.station, district: task.station.address.slice(0, 3) },
      timeline: []
    }
  }));
}

function fillContext(task) {
  return encodeURIComponent(JSON.stringify({
    id: task.id,
    type: task.station.type,
    code: task.station.code,
    name: task.station.name,
    address: task.station.address,
    department: task.station.department,
    office: task.station.office,
    district: task.station.address.slice(0, 3),
    year: task.year,
    status: task.status,
    auditStatus: task.auditStatus,
    assignees: task.assignees,
    initialSurvey: true,
    source: '计划外',
    reason: task.reasonText
  }));
}

function detailLink(task, audit = false) {
  return `area-survey-task-detail.html?data=${taskContext(task)}${audit ? '&audit=1' : ''}&source=outplan`;
}

function fillLink(task) {
  if (task.reason === 'WHOLESALE_USER') {
    return `area-survey-wholesale-fill.html?taskId=${encodeURIComponent(task.parentId)}&itemId=${encodeURIComponent(outPlanWholesaleItemId(task.parentId, task.station.id))}&source=wholesale-fill&mode=edit`;
  }
  const page = task.station.type === '自管站'
    ? 'area-survey-survey-fill.html'
    : task.station.type === '用户站'
      ? 'area-survey-user-fill.html'
      : 'area-survey-corporate-fill.html';
  return `${page}?task=${fillContext(task)}&source=outplan`;
}

function actions(task) {
  const detail = `<a class="link" href="${detailLink(task)}">详情</a>`;
  if (currentRole === 'admin') return detail;
  if (currentRole === 'department') {
    const audit = task.status === '管理部审核' && task.auditStatus === '待审核'
      ? `<a class="link" href="${detailLink(task, true)}">审核</a>`
      : '';
    return detail + audit;
  }
  if (currentRole === 'office') {
    const canAssign = ['待分配', '进行中', '已退回'].includes(task.status);
    const assign = canAssign
      ? `<button class="link" onclick="openPersonModal('${task.id}')">${task.assignees.length ? '转派/改派' : '设置人员'}</button>`
      : '';
    const dispatch = canAssign && task.assignees.length && task.dispatchStatus === '未下发'
      ? `<button class="link" onclick="openDispatchConfirm('${task.id}')">下发</button>`
      : '';
    const audit = task.status === '所长审核' && task.auditStatus === '待审核'
      ? `<a class="link" href="${detailLink(task, true)}">审核</a>`
      : '';
    return assign + dispatch + detail + audit;
  }
  const editable = ['进行中', '已退回'].includes(task.status);
  const fill = editable ? `<a class="link" href="${fillLink(task)}" target="_blank" rel="noopener">填报</a>` : '';
  const canWithdraw = task.status === '所长审核' && ['待审核', '已上报'].includes(task.auditStatus);
  const withdraw = canWithdraw ? `<button class="link" onclick="openWithdrawConfirm('${task.id}')">撤回</button>` : '';
  return fill + detail + withdraw;
}

function renderTable() {
  const pages = Math.max(1, Math.ceil(filteredTasks.length / childPageSize));
  currentPage = Math.min(currentPage, pages);
  const start = (currentPage - 1) * childPageSize;
  const rows = filteredTasks.slice(start, start + childPageSize);
  document.getElementById('taskBody').innerHTML = rows.map((task, index) => `<tr>
    <td>${start + index + 1}</td>
    <td class="task-name-cell"><span class="source-mini">计划外</span>${task.parentName}</td>
    <td>${task.station.code}</td>
    <td title="${task.station.name}">${task.station.name}</td>
    <td>${task.station.type}</td>
    <td class="reason-cell" title="${task.reasonText}">${task.reasonText}</td>
    <td>${task.station.department}</td>
    <td>${task.station.office}</td>
    <td>${task.assignees.join('、') || '<span class="muted">待分配</span>'}</td>
    <td class="center">${statusTag(task.status)}</td>
    <td class="center">${statusTag(task.dispatchStatus)}</td>
    <td class="center">${statusTag(task.auditStatus)}</td>
    <td>${task.updatedAt}</td>
    <td class="operation-cell">${actions(task)}</td>
  </tr>`).join('');
  document.getElementById('emptyState').style.display = rows.length ? 'none' : 'block';
  document.getElementById('totalText').textContent = `共 ${filteredTasks.length} 个项目`;
  document.getElementById('pages').innerHTML = Array.from({ length: pages }, (_, index) => `<button class="page-btn ${index + 1 === currentPage ? 'active' : ''}" onclick="goPage(${index + 1})">${index + 1}</button>`).join('');
}

function renderAll() {
  renderTabs();
  renderTable();
}

function goPage(page) {
  currentPage = page;
  renderTable();
}

function searchTasks() {
  currentPage = 1;
  applyFilters();
  renderAll();
}

function resetFilters() {
  ['codeFilter', 'nameFilter', 'typeFilter', 'statusFilter'].forEach(id => {
    document.getElementById(id).value = '';
  });
  currentReasonTab = '';
  currentPage = 1;
  applyFilters();
  renderAll();
}

function openPersonModal(id) {
  const task = childTasks.find(item => item.id === id);
  if (currentRole !== 'office' || !task || !['待分配', '进行中', '已退回'].includes(task.status)) {
    showToast('仅片区所长可在待分配或执行阶段设置、转派或改派普查人员');
    return;
  }
  currentTaskId = id;
  temporaryAssignees = new Set(task.assignees);
  document.getElementById('personSearch').value = '';
  document.getElementById('personError').textContent = '';
  renderSelectedPersons();
  renderPersonOptions();
  document.getElementById('personMask').classList.add('open');
}

function closePersonModal() {
  document.getElementById('personMask').classList.remove('open');
}

function renderSelectedPersons() {
  document.getElementById('selectedPersons').innerHTML = temporaryAssignees.size
    ? [...temporaryAssignees].map(name => `<span class="person-tag">${name}<button onclick="togglePerson('${name}',false)">×</button></span>`).join('')
    : '<span class="muted">请选择至少一名普查人员</span>';
}

function renderPersonOptions() {
  const keyword = document.getElementById('personSearch').value.trim();
  document.getElementById('personOptions').innerHTML = OUTPLAN_PEOPLE
    .filter(name => !keyword || name.includes(keyword))
    .map(name => `<label class="person-option"><input type="checkbox" ${temporaryAssignees.has(name) ? 'checked' : ''} onchange="togglePerson('${name}',this.checked)"/>${name}</label>`)
    .join('');
}

function togglePerson(name, checked) {
  if (checked) temporaryAssignees.add(name);
  else temporaryAssignees.delete(name);
  renderSelectedPersons();
  renderPersonOptions();
}

function saveAssignees() {
  if (currentRole !== 'office') return;
  if (!temporaryAssignees.size) {
    document.getElementById('personError').textContent = '请选择至少一名普查人员';
    return;
  }
  const task = childTasks.find(item => item.id === currentTaskId);
  if (!task || !['待分配', '进行中', '已退回'].includes(task.status)) {
    closePersonModal();
    showToast('任务状态已变化，请刷新后重试');
    return;
  }
  task.assignees = [...temporaryAssignees];
  task.updatedAt = childNow();
  saveChildState(task);
  closePersonModal();
  applyFilters();
  renderAll();
  showToast(task.dispatchStatus === '已下发' ? '普查人员已改派，可见范围已同步更新' : '普查人员设置成功，请继续下发');
}

function openDispatchConfirm(id) {
  const task = childTasks.find(item => item.id === id);
  if (currentRole !== 'office' || !task || !task.assignees.length || task.dispatchStatus === '已下发') return;
  currentTaskId = id;
  document.getElementById('dispatchText').innerHTML = `确认将“${task.station.name}”下发给 <strong>${task.assignees.join('、')}</strong> 吗？<br/>下发后，被选中的人员可在本列表的普查人员视图中处理任务。`;
  document.getElementById('dispatchMask').classList.add('open');
}

function closeDispatchConfirm() {
  document.getElementById('dispatchMask').classList.remove('open');
}

function confirmDispatch() {
  if (currentRole !== 'office') return;
  const task = childTasks.find(item => item.id === currentTaskId);
  if (!task || !task.assignees.length || task.dispatchStatus === '已下发') {
    closeDispatchConfirm();
    showToast('任务状态已变化，请刷新后重试');
    return;
  }
  task.dispatchStatus = '已下发';
  task.status = '进行中';
  task.auditStatus = '未上报';
  task.updatedAt = childNow();
  saveChildState(task);
  closeDispatchConfirm();
  applyFilters();
  renderAll();
  showToast('任务已下发，仅被选中的普查人员可以查看');
}

function openWithdrawConfirm(id) {
  const task = childTasks.find(item => item.id === id);
  if (currentRole !== 'surveyor' || !task || task.status !== '所长审核' || !['待审核', '已上报'].includes(task.auditStatus)) {
    showToast('任务审核状态已变化，请刷新后重试');
    return;
  }
  currentTaskId = id;
  document.getElementById('withdrawText').innerHTML = `确认撤回“<strong>${task.station.name}</strong>”的上报吗？<br/>撤回后任务恢复为进行中，已填报数据和附件不会丢失。`;
  document.getElementById('withdrawMask').classList.add('open');
}

function closeWithdrawConfirm() {
  document.getElementById('withdrawMask').classList.remove('open');
}

function confirmWithdraw() {
  if (currentRole !== 'surveyor') return;
  const task = childTasks.find(item => item.id === currentTaskId);
  if (!task || task.status !== '所长审核' || !['待审核', '已上报'].includes(task.auditStatus)) {
    closeWithdrawConfirm();
    showToast('任务审核状态已变化，请刷新后重试');
    return;
  }
  task.status = '进行中';
  task.auditStatus = '未上报';
  task.updatedAt = childNow();
  saveChildState(task);
  closeWithdrawConfirm();
  applyFilters();
  renderAll();
  showToast('任务已撤回，可继续修改并重新上报');
}

function showToast(message) {
  clearTimeout(toastTimer);
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
}

function consumeTaskUpdate() {
  const raw = new URLSearchParams(location.search).get('taskUpdate');
  if (!raw) return;
  try {
    const update = JSON.parse(raw);
    const task = childTasks.find(item => item.id === update.id);
    if (!task) return;
    Object.assign(task, {
      status: update.status,
      auditStatus: update.auditStatus,
      updatedAt: update.updatedAt
    });
    saveChildState(task);
  } catch (error) {
    showToast('任务更新数据读取失败');
  }
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closePersonModal();
    closeDispatchConfirm();
    closeWithdrawConfirm();
  }
});

buildChildren();
consumeTaskUpdate();
changeRole(sessionStorage.getItem(OUTPLAN_ROLE_KEY) || 'admin');
