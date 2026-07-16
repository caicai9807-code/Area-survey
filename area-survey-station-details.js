const CURRENT_YEAR='2026年';
const departments=[
  {id:'d1',name:'桥西管理部',offices:[{id:'o1',name:'桥西片区所'},{id:'o2',name:'振头片区所'},{id:'o3',name:'红旗片区所'}]},
  {id:'d2',name:'长安管理部',offices:[{id:'o4',name:'长安片区所'},{id:'o5',name:'谈固片区所'}]},
  {id:'d3',name:'裕华管理部',offices:[{id:'o6',name:'裕华片区所'},{id:'o7',name:'槐底片区所'}]}
];
const stationNames=['春江花月西站','金域蓝湾站','盛世长安站','恒大华府站','和平家园站','新石小区站','拉菲大厦','省教育考试院用户站','恒泰商务楼','龙湖天街站','荣盛华府站','西美花街站'];
const statuses=['待普查','普查中','所长审核','管理部审核','已退回','普查完成'];
const types=['自管站','用户站','对公用户'];
const surveyors=['张三','李晨晨','王海','赵敏','刘洋'];
const areaCategories=['highRise','multiStorey','apartment','nonResidential','nonCooperative'];
function roundArea(value){return Math.round((Number(value)||0)*1000)/1000;}
function buildCategoryAreas(originalArea,totalChange,index){
  const highRise=roundArea(originalArea*.4),multiStorey=roundArea(originalArea*.25),apartment=roundArea(originalArea*.1),nonResidential=roundArea(originalArea*.2);
  const original={highRise,multiStorey,apartment,nonResidential,nonCooperative:roundArea(originalArea-highRise-multiStorey-apartment-nonResidential)};
  const current={...original};
  current[areaCategories[index%areaCategories.length]]=roundArea(current[areaCategories[index%areaCategories.length]]+totalChange);
  return {original,current};
}
let stations=Array.from({length:28},(_,index)=>{
  const dept=index<16?departments[0]:index<22?departments[1]:departments[2];
  const office=dept.offices[index%dept.offices.length];
  const status=statuses[index%statuses.length];
  const buildingStart=1988+(index%25);
  const complete=status==='普查完成'?`2026-0${6+(index%3)}-${String(10+index%18).padStart(2,'0')} ${String(9+index%8).padStart(2,'0')}:20:36`:'';
  const originalArea=index%9===0?0:18000+index*2156.35;
  const totalChange=status==='普查完成'&&index===17?0:index%4===0?0:index%4===1?1250:index%4===2?-620:380;
  const currentArea=originalArea===0?2450:originalArea+totalChange;
  const effectiveChange=currentArea-originalArea;
  const categoryAreas=buildCategoryAreas(originalArea,effectiveChange,index);
  const residentialChange=index%3===2?0:effectiveChange*.65;
  const nonResidentialChange=effectiveChange-residentialChange;
  const district={d1:'桥西区',d2:'长安区',d3:'裕华区'}[dept.id];
  const road={d1:['新石中路','友谊大街','红旗大街'],d2:['和平东路','中山东路','谈固大街'],d3:['槐安东路','体育南大街','裕华路']}[dept.id][index%3];
  return {id:`station-detail-${index+1}`,year:index%7===0?'2027年':'2026年',code:index===6?'33925A001000000001Z':`60218B${String(index+1).padStart(3,'0')}`,name:stationNames[index%stationNames.length]+(index>11?`${index+1}`:''),status,auditStatus:status==='普查完成'?'通过':status==='管理部审核'?'待审核':'未上报',taskStatus:status,departmentId:dept.id,department:dept.name,officeId:office.id,office:office.name,type:types[index%types.length],subdistrict:['新石街道办事处','振头街道办事处','红旗街道办事处'][index%3],address:`石家庄市${district}${road}${118+index}号`,buildingStart,buildingEnd:index%4===0?buildingStart+8:buildingStart,originalArea,currentArea,categoryAreas,residentialChange,nonResidentialChange,surveyors:index%5===0?[]:[surveyors[index%surveyors.length],...(index%6===0?['张三']:[])],completedAt:complete,lastSyncedAt:'2026-07-14 09:30:00',approvalRecords:[],operationLogs:[]};
});

let role='planning';
let selectedOrg=null;
let filteredStations=[];
let currentPage=1;
let selectedIds=new Set();
let syncIds=[];
let syncMode='single';
let returningId=null;
let returnInProgress=false;
let toastTimer;
const pageSize=10;

function roleScope(list=stations){
  if(role==='planning')return list;
  if(role==='department')return list.filter(item=>item.departmentId==='d1');
  if(role==='office')return list.filter(item=>item.officeId==='o1');
  return list.filter(item=>item.surveyors.includes('张三'));
}
function scopedDepartments(){
  if(role==='planning')return departments;
  if(role==='department')return departments.filter(item=>item.id==='d1');
  if(role==='office')return departments.filter(item=>item.id==='d1').map(item=>({...item,offices:item.offices.filter(office=>office.id==='o1')}));
  const allowed=new Set(roleScope().map(item=>item.officeId));
  return departments.map(item=>({...item,offices:item.offices.filter(office=>allowed.has(office.id))})).filter(item=>item.offices.length);
}
function changeRole(nextRole){
  role=nextRole;
  const config={planning:{name:'业务管理员',avatar:'业',scope:'数据范围：全部管理部',tip:'业务管理员可查看全部站点、审批记录和操作日志'},department:{name:'王建国',avatar:'管',scope:'数据范围：桥西管理部',tip:'管理部人员仅审核、查看和删除本管理部管辖站点'},office:{name:'李主任',avatar:'所',scope:'数据范围：桥西片区所',tip:'片区所长仅查看本片区所数据'},surveyor:{name:'张三',avatar:'普',scope:'数据范围：本人已分配站点',tip:'普查人员仅查看已分配给本人的站点'}}[role];
  document.getElementById('currentUser').textContent=config.name;document.getElementById('currentAvatar').textContent=config.avatar;document.getElementById('scopeTag').textContent=config.scope;document.getElementById('treeTip').textContent=config.tip;
  selectedOrg=role==='planning'||role==='surveyor'?null:role==='office'?{type:'office',id:'o1'}:{type:'department',id:'d1'};
  selectedIds.clear();currentPage=1;renderTree();applyFilters();renderTable();
}
function renderTree(){
  const keyword=document.getElementById('treeSearch').value.trim();
  const groups=scopedDepartments();
  const html=groups.map(dept=>{
    const offices=dept.offices.filter(item=>!keyword||item.name.includes(keyword)||dept.name.includes(keyword));
    if(keyword&&!dept.name.includes(keyword)&&!offices.length)return '';
    const deptCount=roleScope().filter(item=>item.departmentId===dept.id&&item.year===document.getElementById('yearFilter').value).length;
    const children=offices.map(office=>`<div class="tree-node office ${selectedOrg?.type==='office'&&selectedOrg.id===office.id?'selected':''}" onclick="selectOrg('office','${office.id}')"><span class="tree-icon">⌁</span><span>${office.name}</span><span class="tree-count">${roleScope().filter(item=>item.officeId===office.id&&item.year===document.getElementById('yearFilter').value).length}</span></div>`).join('');
    return `<div class="tree-node ${selectedOrg?.type==='department'&&selectedOrg.id===dept.id?'selected':''}" onclick="selectOrg('department','${dept.id}')"><span class="tree-arrow">⌄</span><span class="tree-icon">▣</span><span>${dept.name}</span><span class="tree-count">${deptCount}</span></div>${children}`;
  }).join('');
  document.getElementById('orgTree').innerHTML=html||'<div class="tree-empty">未找到匹配的组织机构</div>';
}
function selectOrg(type,id){selectedOrg={type,id};selectedIds.clear();currentPage=1;renderTree();applyFilters();renderTable();}
function resetTree(){selectedOrg=role==='planning'||role==='surveyor'?null:role==='office'?{type:'office',id:'o1'}:{type:'department',id:'d1'};document.getElementById('treeSearch').value='';currentPage=1;renderTree();applyFilters();renderTable();}

function applyFilters(){
  const year=document.getElementById('yearFilter').value,code=document.getElementById('codeFilter').value.trim().toLowerCase(),name=document.getElementById('nameFilter').value.trim().toLowerCase(),status=document.getElementById('statusFilter').value,type=document.getElementById('typeFilter').value,areaChange=document.getElementById('areaChangeFilter').value;
  const yearStart=Number(document.getElementById('yearStart').value)||null,yearEnd=Number(document.getElementById('yearEnd').value)||null,dateStart=document.getElementById('dateStart').value,dateEnd=document.getElementById('dateEnd').value;
  filteredStations=roleScope().filter(item=>item.year===year).filter(item=>!selectedOrg||(selectedOrg.type==='department'?item.departmentId===selectedOrg.id:item.officeId===selectedOrg.id)).filter(item=>(!code||item.code.toLowerCase().includes(code))&&(!name||item.name.toLowerCase().includes(name))&&(!status||item.status===status)&&(!type||item.type===type)&&(!areaChange||(item.status==='普查完成'&&String(hasAreaChange(item))===String(areaChange==='yes')))&&(!yearStart||item.buildingEnd>=yearStart)&&(!yearEnd||item.buildingStart<=yearEnd)&&(!dateStart||item.completedAt.slice(0,10)>=dateStart)&&(!dateEnd||item.completedAt.slice(0,10)<=dateEnd));
}
function searchStations(){
  const start=document.getElementById('yearStart').value,end=document.getElementById('yearEnd').value,dateStart=document.getElementById('dateStart').value,dateEnd=document.getElementById('dateEnd').value;
  if(start&&end&&Number(start)>Number(end)){showToast('建筑年代开始年份不能晚于结束年份');return;}
  if(dateStart&&dateEnd&&dateStart>dateEnd){showToast('完成时间开始日期不能晚于结束日期');return;}
  currentPage=1;selectedIds.clear();applyFilters();renderTree();renderTable();
}
function resetFilters(){
  document.getElementById('yearFilter').value=CURRENT_YEAR;['codeFilter','nameFilter','statusFilter','typeFilter','areaChangeFilter','yearStart','yearEnd','dateStart','dateEnd'].forEach(id=>document.getElementById(id).value='');selectedIds.clear();currentPage=1;applyFilters();renderTree();renderTable();
}
function statusTag(status){const map={'待普查':'orange','普查中':'blue','所长审核':'orange','管理部审核':'orange','已退回':'red','普查完成':'green'};return `<span class="tag tag-${map[status]}">${status}</span>`;}
function formatBuildingYear(item){return item.buildingStart===item.buildingEnd?`${item.buildingStart}年`:`${item.buildingStart}—${item.buildingEnd}年`;}
function formatArea(value){return Number(value).toLocaleString('zh-CN',{minimumFractionDigits:3,maximumFractionDigits:3});}
function changeDisplay(value){const number=Number(value);if(number===0)return '<span class="area-flat">-</span>';return `<span class="${number>0?'area-up':'area-down'}">${number>0?'+':''}${formatArea(number)}</span>`;}
function rateDisplay(item){const change=item.currentArea-item.originalArea;if(change===0)return '<span class="area-flat">-</span>';if(item.originalArea===0)return '<span class="rate-unavailable" title="原面积为0，无法计算变化率">无法计算</span>';const rate=change/item.originalArea*100;return `<span class="${rate>0?'area-up':'area-down'}">${rate>0?'+':''}${rate.toFixed(2)}%</span>`;}
function hasAreaChange(item){return areaCategories.some(category=>roundArea(item.categoryAreas?.current?.[category])!==roundArea(item.categoryAreas?.original?.[category]));}
function areaChangeDisplay(item){if(item.status!=='普查完成')return statusTag(item.status);return hasAreaChange(item)?'<span class="tag tag-red">是</span>':'<span class="tag tag-green">否</span>';}
function renderTable(){
  const pages=Math.max(1,Math.ceil(filteredStations.length/pageSize));currentPage=Math.min(currentPage,pages);const start=(currentPage-1)*pageSize,pageRows=filteredStations.slice(start,start+pageSize);
  document.getElementById('stationBody').innerHTML=pageRows.map((item,index)=>{const canReturn=role==='planning'&&['管理部审核','普查完成'].includes(item.status),canAudit=role==='department'&&item.status==='管理部审核',canDelete=role==='department';return `<tr id="row-${item.id}"><td class="check-cell"><input type="checkbox" ${selectedIds.has(item.id)?'checked':''} onchange="toggleOne('${item.id}',this.checked)" /></td><td>${start+index+1}</td><td title="${item.code}">${item.code}</td><td title="${item.name}">${item.name}</td><td class="center">${statusTag(item.status)}</td><td>${item.department}</td><td>${item.office}</td><td>${item.type}</td><td title="${item.subdistrict}">${item.subdistrict}</td><td title="${item.address}">${item.address}</td><td>${formatBuildingYear(item)}</td><td class="number">${formatArea(item.originalArea)}</td><td class="number">${formatArea(item.currentArea)}</td><td class="number">${rateDisplay(item)}</td><td class="center">${areaChangeDisplay(item)}</td><td class="number">${changeDisplay(item.residentialChange)}</td><td class="number">${changeDisplay(item.nonResidentialChange)}</td><td title="${item.surveyors.join('、')||'待分配'}">${item.surveyors.join('、')||'<span class="muted">待分配</span>'}</td><td>${item.completedAt||'—'}</td><td class="operation-cell"><button class="link" onclick="openDetail('${item.id}')">详情</button>${canAudit?`<button class="link" onclick="openDetail('${item.id}',true)">审核</button>`:''}<button class="link" onclick="openSingleSync('${item.id}')">同步</button>${canDelete?`<button class="link danger-link" onclick="deletePlanStation('${item.id}')">删除</button>`:''}${canReturn?`<button class="link return-link" onclick="openReturnModal('${item.id}')">退回</button>`:''}</td></tr>`;}).join('');
  document.getElementById('emptyState').hidden=Boolean(pageRows.length);document.querySelector('.station-table-wrap').style.display=pageRows.length?'block':'none';document.getElementById('resultCount').textContent=`共 ${filteredStations.length} 项`;document.getElementById('totalText').textContent=`共 ${filteredStations.length} 个项目`;document.getElementById('pages').innerHTML=Array.from({length:pages},(_,i)=>`<button class="page-btn ${i+1===currentPage?'active':''}" onclick="goPage(${i+1})">${i+1}</button>`).join('');
  document.getElementById('selectAll').checked=Boolean(pageRows.length)&&pageRows.every(item=>selectedIds.has(item.id));updateSelection();
}
function goPage(page){currentPage=page;renderTable();}
function toggleOne(id,checked){checked?selectedIds.add(id):selectedIds.delete(id);updateSelection();}
function toggleAll(checked){const start=(currentPage-1)*pageSize;filteredStations.slice(start,start+pageSize).forEach(item=>checked?selectedIds.add(item.id):selectedIds.delete(item.id));renderTable();}
function updateSelection(){document.getElementById('selectedHint').textContent=`已选择 ${selectedIds.size} 项`;document.getElementById('batchSyncBtn').disabled=!selectedIds.size;}

function openDetail(id,audit=false){
  const item=stations.find(row=>row.id===id);const context={plan:{id:`plan-${item.year}`,name:`${item.year}${item.type}普查计划`,year:item.year,type:item.type,status:'创建成功'},task:{id:item.id,status:item.status,auditStatus:item.auditStatus,updatedAt:item.completedAt||item.lastSyncedAt,surveyors:item.surveyors.join('、')||'待分配',station:{id:item.id,code:item.code,name:item.name,department:item.department,office:item.office,district:'桥西区',address:item.address},timeline:item.approvalRecords}};
  location.href=`area-survey-task-detail.html?data=${encodeURIComponent(JSON.stringify(context))}&source=station-detail${audit?'&audit=1':''}`;
}
function deletePlanStation(id){if(role!=='department'){showToast('仅管理部人员可删除本部门计划内站点');return;}const item=stations.find(row=>row.id===id);if(!item||item.departmentId!=='d1'){showToast('只能删除本管理部管辖站点');return;}if(!confirm(`确认从计划内任务中删除“${item.name}（${item.code}）”吗？删除后将保留站点快照和操作记录。`))return;stations=stations.filter(row=>row.id!==id);selectedIds.delete(id);applyFilters();renderTree();renderTable();showToast('计划内站点已删除，操作记录已保留');}
function openReturnModal(id){
  const item=stations.find(row=>row.id===id);
  if(role!=='planning'){showToast('当前账号无退回权限');return;}
  if(!item||!['管理部审核','普查完成'].includes(item.status)){showToast('站点状态已变化，请刷新列表后重试');return;}
  returningId=id;document.getElementById('returnStation').textContent=`${item.name}（${item.code}）`;document.getElementById('returnLevel').value='';document.getElementById('returnReason').value='';document.getElementById('returnLevelError').textContent='';document.getElementById('returnReasonError').textContent='';updateReturnHint();updateReturnReasonCount();document.getElementById('returnMask').classList.add('open');
}
function closeReturnModal(){if(returnInProgress)return;document.getElementById('returnMask').classList.remove('open');}
function updateReturnHint(){const map={surveyor:'退回后由原普查人员继续修改并重新上报',office:'退回后由所属片区所所长重新审核',department:'退回后由所属管理部审核人员重新审核'};document.getElementById('returnLevelHint').textContent=map[document.getElementById('returnLevel').value]||'请选择退回后负责处理的业务节点';document.getElementById('returnLevelError').textContent='';}
function updateReturnReasonCount(){const value=document.getElementById('returnReason').value;document.getElementById('returnReasonCount').textContent=`${value.length}/300`;document.getElementById('returnReasonError').textContent='';}
function confirmReturn(){
  if(returnInProgress)return;const item=stations.find(row=>row.id===returningId),level=document.getElementById('returnLevel').value,reason=document.getElementById('returnReason').value.trim();let valid=true;
  if(!level){document.getElementById('returnLevelError').textContent='请选择退回节点';valid=false;}if(!reason){document.getElementById('returnReasonError').textContent='请输入退回原因';valid=false;}if(!valid)return;
  if(role!=='planning'){closeReturnModal();showToast('当前账号无退回权限');return;}if(!item||!['管理部审核','普查完成'].includes(item.status)){closeReturnModal();showToast('站点状态已变化，请刷新列表后重试');return;}
  returnInProgress=true;const button=document.getElementById('confirmReturnBtn');button.disabled=true;button.textContent='退回中…';const originalStatus=item.status,now=nowText();const target={surveyor:{name:'普查人员填报',status:'普查中'},office:{name:'片区所审核',status:'所长审核'},department:{name:'管理部审核',status:'管理部审核'}}[level];
  if(item.completedAt)item.previousCompletedAt=item.completedAt;item.completedAt='';item.status=target.status;item.auditStatus='已退回';item.taskStatus=target.status;item.lastSyncedAt=now;const record={title:'计划经营部退回',person:'赵经理（计划经营部）',time:now,result:'不通过',comment:`由${originalStatus}退回至${target.name}。退回原因：${reason}`};item.approvalRecords.unshift(record);item.operationLogs.unshift({type:'退回',operator:'赵经理',department:'计划经营部',from:originalStatus,to:target.name,reason,time:now,stationCode:item.code,taskId:`plan-${item.year}`});
  returnInProgress=false;button.disabled=false;button.textContent='确认退回';closeReturnModal();applyFilters();renderTree();renderTable();showToast(`已退回至${target.name}，审批记录和操作日志已更新`);
}
function openSingleSync(id){syncMode='single';syncIds=[id];openSyncModal();}
function openBatchSync(){if(!selectedIds.size){showToast('请先选择需要同步的站点');return;}syncMode='batch';syncIds=[...selectedIds];openSyncModal();}
function openSyncModal(){
  const items=syncIds.map(id=>stations.find(item=>item.id===id)).filter(Boolean);document.getElementById('syncTitle').textContent=syncMode==='batch'?'批量同步站点信息':'同步站点信息';document.getElementById('syncHeading').textContent=syncMode==='batch'?`确认同步已选择的 ${items.length} 个站点吗？`:`确认同步“${items[0].name}”的最新普查信息吗？`;document.getElementById('syncList').innerHTML=items.slice(0,8).map(item=>`<div><span>${item.name}</span><span>${item.code}</span></div>`).join('')+(items.length>8?`<div><span>其余 ${items.length-8} 个站点</span><span>……</span></div>`:'');document.getElementById('syncMask').classList.add('open');
}
function closeSync(){document.getElementById('syncMask').classList.remove('open');}
function confirmSync(){
  const button=document.getElementById('confirmSyncBtn');button.disabled=true;button.classList.add('syncing');button.textContent='同步中…';
  setTimeout(()=>{const failed=syncMode==='batch'?syncIds.filter(id=>Number(id.split('-').pop())%7===0):[];const success=syncIds.filter(id=>!failed.includes(id));const now=nowText();stations=stations.map(item=>success.includes(item.id)?{...item,currentArea:item.currentArea+12.5,categoryAreas:{...item.categoryAreas,current:{...item.categoryAreas.current,nonResidential:roundArea(item.categoryAreas.current.nonResidential+12.5)}},nonResidentialChange:item.nonResidentialChange+12.5,lastSyncedAt:now}:item);button.disabled=false;button.classList.remove('syncing');button.textContent='确认同步';closeSync();if(syncMode==='batch'){document.getElementById('successCount').textContent=success.length;document.getElementById('failCount').textContent=failed.length;document.getElementById('failureList').innerHTML=failed.map(id=>{const item=stations.find(row=>row.id===id);return `<div class="failure-item"><strong>${item.name}（${item.code}）</strong>上游站点接口响应超时，原面积数据已保留，请稍后重新同步。</div>`}).join('');document.getElementById('resultMask').classList.add('open');}else{showToast('同步成功，面积汇总字段已更新');}selectedIds.clear();applyFilters();renderTable();const row=document.getElementById(`row-${success[0]}`);if(row){row.classList.remove('row-flash');void row.offsetWidth;row.classList.add('row-flash');}},650);
}
function closeResult(){document.getElementById('resultMask').classList.remove('open');}
function nowText(){const d=new Date(),pad=value=>String(value).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;}
function showToast(message){clearTimeout(toastTimer);const toast=document.getElementById('toast');toast.textContent=message;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),2400);}
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeSync();closeResult();closeReturnModal();}});
try{const rawUpdate=new URLSearchParams(location.search).get('taskUpdate');if(rawUpdate){const update=JSON.parse(rawUpdate),item=stations.find(row=>row.id===update.id);if(item){item.status=update.status==='已结束'?'普查完成':update.status;item.auditStatus=update.auditStatus;item.lastSyncedAt=update.updatedAt;}}}catch(error){}
document.getElementById('yearFilter').value=CURRENT_YEAR;changeRole('planning');
