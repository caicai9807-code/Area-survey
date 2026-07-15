const pageMode = document.body.dataset.mode;
const isSurveyorPage = pageMode === 'surveyor';
const currentSurveyor = '张三';
const people = ['张三','李晨晨','王海','赵敏','刘洋','孙琪'];
const taskTypes = ['自管站','用户站','对公户'];
const statusPool = ['待分配','进行中','所长审核','管理部审核','已结束','已退回'];
const auditPool = ['未上报','已上报','待审核','待审核','通过','已退回'];
const CURRENT_YEAR = '2026年';

let tasks = Array.from({length:24},(_,index)=>{
  const assigned = index % 4 === 0 ? [] : index % 3 === 0 ? ['张三','李晨晨'] : index % 3 === 1 ? ['李晨晨'] : ['张三'];
  const dispatched = index % 5 !== 0 && assigned.length > 0;
  return {
    id:`role-task-${index+1}`, type:taskTypes[index%taskTypes.length], code:`60218B${String(index+1).padStart(3,'0')}`,
    name:['春江花月西站','金域蓝湾站','盛世长安站','恒大华府站','和平家园站','新石小区站'][index%6]+(index>5?index+1:''),
    address:`石家庄市桥西区新石中路${118+index}号`, department:'桥西管理部', office:'桥西片区所', year:index%2?'2027年':'2026年',
    status:statusPool[index%statusPool.length], dispatchStatus:dispatched?'已下发':'未下发', auditStatus:auditPool[index%auditPool.length],
    assignees:assigned, initialSurvey:index%2===1, updatedAt:`2026-07-${String(14-index%9).padStart(2,'0')} ${String(9+index%8).padStart(2,'0')}:43:23`
  };
});

// 保证原型首屏存在一条可以完整演示的自管站普查任务。
tasks[0] = {
  ...tasks[0], type:'自管站', assignees:['张三'], dispatchStatus:'已下发',
  status:'进行中', auditStatus:'未上报', updatedAt:'2026-07-14 10:20:36'
};
tasks[1] = {...tasks[1],type:'用户站',code:'33315A001',name:'河北省教育考试院服务部',address:'石家庄市桥西区红旗大街297号',assignees:['张三'],dispatchStatus:'已下发',status:'进行中',auditStatus:'未上报',initialSurvey:true,updatedAt:'2026-07-14 10:18:20'};
tasks[2] = {...tasks[2],type:'对公户',code:'33925A001000000001Z',name:'河北保家物业服务有限公司',fullName:'河北保家物业服务有限公司',shortName:'拉菲大厦',userCard:'30000088',address:'石家庄市桥西区新石北路417号',contact:'吕经理',phone:'15350599407',assignees:['张三'],dispatchStatus:'已下发',status:'进行中',auditStatus:'未上报',initialSurvey:true,updatedAt:'2026-07-14 10:16:08'};
tasks[4] = {...tasks[4],type:'用户站',code:'33315A005',name:'省直机关第二用户站',assignees:['张三'],dispatchStatus:'已下发',status:'进行中',auditStatus:'未上报',initialSurvey:false,updatedAt:'2026-07-13 16:08:12'};
tasks[5] = {...tasks[5],type:'对公户',code:'33925A001000000006Z',name:'河北恒泰商贸有限公司',fullName:'河北恒泰商贸有限公司',shortName:'恒泰商务楼',userCard:'30000126',contact:'王经理',phone:'15350599426',assignees:['张三'],dispatchStatus:'已下发',status:'进行中',auditStatus:'未上报',initialSurvey:false,updatedAt:'2026-07-13 15:22:16'};
tasks[6] = {...tasks[6],type:'自管站',year:'2026年',assignees:['张三','李晨晨'],dispatchStatus:'已下发',status:'所长审核',auditStatus:'待审核',updatedAt:'2026-07-14 11:28:46'};

try {
  const savedStates = JSON.parse(localStorage.getItem('areaSurveyTaskStates') || '{}');
  tasks = tasks.map(task => savedStates[task.id] ? {...task, ...savedStates[task.id]} : task);
} catch (error) {
  // 本地存储不可用时继续使用页面内模拟数据。
}

const incomingTask = new URLSearchParams(location.search).get('taskUpdate');
if (incomingTask) {
  try {
    const updatedTask = JSON.parse(incomingTask);
    tasks = tasks.map(item => item.id === updatedTask.id ? {
      ...item,
      status: updatedTask.status,
      auditStatus: updatedTask.auditStatus,
      updatedAt: updatedTask.updatedAt
    } : item);
  } catch (error) {
    // 保留原模拟数据，页面仍可继续使用。
  }
}

let activeType='自管站';
let appliedYear=CURRENT_YEAR;
let filteredTasks=[];
let currentPage=1;
let currentTaskId=null;
let tempAssignees=new Set();
let dispatchMode='dispatch';
let withdrawInProgress=false;
let toastTimer;
const pageSize=10;

function tag(status) {
  const map={'待分配':'orange','进行中':'blue','所长审核':'blue','管理部审核':'blue','已结束':'gray','已退回':'red','未下发':'gray','已下发':'green','未上报':'gray','已上报':'blue','待审核':'orange','通过':'green'};
  return `<span class="tag tag-${map[status]||'gray'}">${status}</span>`;
}

function visibleTasks() {
  return tasks.filter(task=>activeType==='全部'||task.type===activeType).filter(task=>!isSurveyorPage||(task.dispatchStatus==='已下发'&&task.assignees.includes(currentSurveyor)));
}

function applyFilters() {
  const code=document.getElementById('codeFilter').value.trim().toLowerCase();
  const name=document.getElementById('nameFilter').value.trim().toLowerCase();
  const audit=document.getElementById('auditFilter').value;
  filteredTasks=visibleTasks().filter(task=>task.year===appliedYear).filter(task=>(!code||task.code.toLowerCase().includes(code))&&(!name||task.name.toLowerCase().includes(name))&&(!audit||task.auditStatus===audit));
}

function renderTabs() {
  document.getElementById('taskTabs').innerHTML=taskTypes.map(type=>{
    const count=tasks.filter(task=>task.type===type&&task.year===appliedYear).filter(task=>!isSurveyorPage||(task.dispatchStatus==='已下发'&&task.assignees.includes(currentSurveyor))).length;
    return `<button class="task-tab ${type===activeType?'active':''}" onclick="switchType('${type}')">${type}<span class="count-badge">${count}</span></button>`;
  }).join('');
}

function switchType(type){activeType=type;const typeFilter=document.getElementById('stationTypeFilter');if(typeFilter)typeFilter.value=type;currentPage=1;applyFilters();renderAll();}
function filterByStationType(type){switchType(type||'全部');}
function renderAll(){renderTabs();renderTable();}

function taskContext(task){
  const station={id:task.id,code:task.code,name:task.name,department:task.department,office:task.office,district:'桥西区',address:task.address};
  return encodeURIComponent(JSON.stringify({plan:{id:'role-plan',name:`${task.year}${task.type}普查计划`,year:task.year,type:task.type,status:'创建成功'},task:{id:task.id,status:task.status,auditStatus:task.auditStatus,updatedAt:task.updatedAt,surveyors:task.assignees.join('、')||'待分配',station,timeline:[]}}));
}

function fillContext(task){
  return encodeURIComponent(JSON.stringify({
    id:task.id,type:task.type,code:task.code,name:task.name,address:task.address,
    department:task.department,office:task.office,year:task.year,status:task.status,
    auditStatus:task.auditStatus,assignees:task.assignees,initialSurvey:task.initialSurvey,
    fullName:task.fullName,shortName:task.shortName,userCard:task.userCard,contact:task.contact,phone:task.phone
  }));
}

function actions(task){
  const detail=`<a class="link" href="area-survey-task-detail.html?data=${taskContext(task)}&source=${pageMode}">详情</a>`;
  if(isSurveyorPage){
    const editable=['待分配','进行中','已退回'].includes(task.status);
    const fill=editable?(task.type==='自管站'
      ? `<a class="link" href="area-survey-survey-fill.html?task=${fillContext(task)}">填报</a>`
      : task.type==='用户站'
        ? `<a class="link" href="area-survey-user-fill.html?task=${fillContext(task)}">填报</a>`
        : `<a class="link" href="area-survey-corporate-fill.html?task=${fillContext(task)}">填报</a>`):'';
    const canWithdraw=task.status==='所长审核'&&['待审核','已上报'].includes(task.auditStatus);
    const withdraw=canWithdraw?`<button class="link" onclick="openWithdrawConfirm('${task.id}')">撤回</button>`:'';
    return fill+detail+withdraw;
  }
  const set=`<button class="link" onclick="openPersonModal('${task.id}')">设置普查人员</button>`;
  const canDispatch=task.assignees.length>0&&task.dispatchStatus==='未下发';
  const dispatch=canDispatch?`<button class="link" onclick="openDispatchConfirm('${task.id}')">下发</button>`:`<button class="link disabled-link" title="${task.dispatchStatus==='已下发'?'任务已下发':'请先设置普查人员'}">下发</button>`;
  const audit=task.status==='所长审核'&&task.auditStatus==='待审核'?`<a class="link" href="area-survey-task-detail.html?data=${taskContext(task)}&audit=1&source=office">审核</a>`:`<span class="link disabled-link" title="仅普查人员上报后的所长审核任务可操作">审核</span>`;
  return set+dispatch+detail+audit;
}

function renderTable(){
  const totalPages=Math.max(1,Math.ceil(filteredTasks.length/pageSize));
  currentPage=Math.min(currentPage,totalPages);
  const start=(currentPage-1)*pageSize;
  const pageData=filteredTasks.slice(start,start+pageSize);
  document.getElementById('taskBody').innerHTML=pageData.map((task,index)=>`<tr><td>${start+index+1}</td><td>${task.code}</td><td title="${task.name}">${task.name}</td><td title="${task.address}">${task.address}</td><td>${task.department}</td><td>${task.office}</td><td>${task.year}</td><td class="center">${tag(task.status)}</td><td class="center">${tag(task.dispatchStatus)}</td><td class="center">${tag(task.auditStatus)}</td><td>${task.updatedAt}</td><td class="operation-cell">${actions(task)}</td></tr>`).join('');
  document.getElementById('emptyState').style.display=pageData.length?'none':'block';
  document.getElementById('emptyText').textContent=isSurveyorPage?'暂无分配给您的已下发任务':'暂无符合条件的任务';
  document.getElementById('totalText').textContent=`共 ${filteredTasks.length} 个项目`;
  document.getElementById('pages').innerHTML=Array.from({length:totalPages},(_,i)=>i+1).map(page=>`<button class="page-btn ${page===currentPage?'active':''}" onclick="goPage(${page})">${page}</button>`).join('');
}

function goPage(page){currentPage=page;renderTable();}
function searchTasks(){appliedYear=document.getElementById('yearFilter').value;currentPage=1;applyFilters();renderAll();}
function resetFilters(){document.getElementById('yearFilter').value=CURRENT_YEAR;appliedYear=CURRENT_YEAR;document.getElementById('codeFilter').value='';document.getElementById('nameFilter').value='';document.getElementById('auditFilter').value='';const typeFilter=document.getElementById('stationTypeFilter');if(typeFilter)typeFilter.value=activeType;currentPage=1;applyFilters();renderAll();}

function openPersonModal(id){
  currentTaskId=id;
  const task=tasks.find(item=>item.id===id);
  tempAssignees=new Set(task.assignees);
  document.getElementById('personSearch').value='';
  document.getElementById('personError').textContent='';
  renderSelectedPersons();renderPersonOptions();
  document.getElementById('personMask').classList.add('open');
}
function closePersonModal(){document.getElementById('personMask')?.classList.remove('open');}
function renderSelectedPersons(){const container=document.getElementById('selectedPersons');container.innerHTML=tempAssignees.size?[...tempAssignees].map(name=>`<span class="person-tag">${name}<button onclick="togglePerson('${name}',false)">×</button></span>`).join(''):'<span style="color:#b8bfc9">请选择至少一名普查人员</span>';}
function renderPersonOptions(){const keyword=document.getElementById('personSearch').value.trim();document.getElementById('personOptions').innerHTML=people.filter(name=>!keyword||name.includes(keyword)).map(name=>`<label class="person-option"><input type="checkbox" ${tempAssignees.has(name)?'checked':''} onchange="togglePerson('${name}',this.checked)"/>${name}</label>`).join('');}
function togglePerson(name,checked){checked?tempAssignees.add(name):tempAssignees.delete(name);renderSelectedPersons();renderPersonOptions();}
function saveAssignees(){
  if(!tempAssignees.size){document.getElementById('personError').textContent='请选择至少一名普查人员';return;}
  const task=tasks.find(item=>item.id===currentTaskId);
  if(task.dispatchStatus==='已下发'){
    dispatchMode='reassign';closePersonModal();document.getElementById('dispatchModalTitle').textContent='重新设置普查人员';
    document.getElementById('dispatchText').innerHTML=`任务“${task.name}”已经下发。确认将普查人员调整为 <strong>${[...tempAssignees].join('、')}</strong> 吗？<br/>保存后，未被选中的人员将无法继续看到该任务。`;
    document.getElementById('dispatchMask').classList.add('open');return;
  }
  task.assignees=[...tempAssignees];task.updatedAt=nowText();closePersonModal();applyFilters();renderAll();showToast('普查人员设置成功，请下发后通知对应人员');
}

function openDispatchConfirm(id){currentTaskId=id;dispatchMode='dispatch';const task=tasks.find(item=>item.id===id);if(!task.assignees.length||task.dispatchStatus==='已下发')return;document.getElementById('dispatchModalTitle').textContent='下发普查任务';document.getElementById('dispatchText').innerHTML=`确认将“${task.name}”下发给 <strong>${task.assignees.join('、')}</strong> 吗？<br/>下发后，对应普查人员可在个人任务页面看到该任务。`;document.getElementById('dispatchMask').classList.add('open');}
function closeDispatchConfirm(){document.getElementById('dispatchMask')?.classList.remove('open');}
function confirmDispatch(){
  const task=tasks.find(item=>item.id===currentTaskId);
  if(dispatchMode==='reassign'){task.assignees=[...tempAssignees];task.updatedAt=nowText();closeDispatchConfirm();applyFilters();renderAll();showToast('普查人员已调整，任务可见范围已同步更新');return;}
  task.dispatchStatus='已下发';task.status='进行中';task.auditStatus='未上报';task.updatedAt=nowText();closeDispatchConfirm();applyFilters();renderAll();showToast('任务已下发，仅被选中的普查人员可以查看');
}

function persistTaskState(task){
  try {
    const states=JSON.parse(localStorage.getItem('areaSurveyTaskStates')||'{}');
    states[task.id]={status:task.status,auditStatus:task.auditStatus,updatedAt:task.updatedAt};
    localStorage.setItem('areaSurveyTaskStates',JSON.stringify(states));
  } catch(error) {}
}
function reportTask(id){const task=tasks.find(item=>item.id===id);task.status='所长审核';task.auditStatus='待审核';task.updatedAt=nowText();persistTaskState(task);applyFilters();renderAll();showToast('任务已上报，所长审核前可以撤回');}
function openWithdrawConfirm(id){
  const task=tasks.find(item=>item.id===id);
  if(!task||task.status!=='所长审核'||!['待审核','已上报'].includes(task.auditStatus)){showToast('任务审核状态已变化，请刷新列表后重试');return;}
  currentTaskId=id;
  document.getElementById('withdrawText').innerHTML=`确认撤回“<strong>${task.name}</strong>”吗？<br/>撤回后任务将恢复为进行中，可继续修改填报数据并重新上报，已填报数据和附件不会丢失。`;
  document.getElementById('withdrawMask').classList.add('open');
}
function closeWithdrawConfirm(){if(withdrawInProgress)return;document.getElementById('withdrawMask')?.classList.remove('open');}
function confirmWithdraw(){
  if(withdrawInProgress)return;
  const task=tasks.find(item=>item.id===currentTaskId);
  if(!task||task.status!=='所长审核'||!['待审核','已上报'].includes(task.auditStatus)){closeWithdrawConfirm();showToast('任务审核状态已变化，请刷新列表后重试');return;}
  withdrawInProgress=true;
  const button=document.getElementById('confirmWithdrawBtn');button.disabled=true;button.textContent='撤回中...';
  task.status='进行中';task.auditStatus='未上报';task.updatedAt=nowText();persistTaskState(task);
  withdrawInProgress=false;button.disabled=false;button.textContent='确认撤回';closeWithdrawConfirm();applyFilters();renderAll();showToast('任务已撤回，可继续修改并重新上报');
}
function nowText(){const d=new Date(),p=v=>String(v).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;}
function showToast(message){clearTimeout(toastTimer);const toast=document.getElementById('toast');toast.textContent=message;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),2300);}

document.addEventListener('keydown',event=>{if(event.key==='Escape'){closePersonModal();closeDispatchConfirm();closeWithdrawConfirm();}});
const initialTypeFilter=document.getElementById('stationTypeFilter');
if(initialTypeFilter)initialTypeFilter.value=activeType;
document.getElementById('yearFilter').value=CURRENT_YEAR;
applyFilters();renderAll();
