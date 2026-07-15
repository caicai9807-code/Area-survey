const params=new URLSearchParams(location.search);
let task={id:'role-task-1',type:'自管站',code:'60218B001',name:'春江花月西站',address:'石家庄市桥西区新石中路118号',department:'桥西管理部',office:'桥西片区所',year:'2026年',status:'进行中',auditStatus:'未上报',assignees:['张三']};
try { if(params.get('task')) task={...task,...JSON.parse(decodeURIComponent(params.get('task')))}; } catch(error) {}
if(task.type==='部分报停') task.type='对公户';

const defaultBuildings=[
  {id:1,name:'石家庄市桥西区实验小学',floors:'1-2F',nature:'办公',fee:'非居',status:'普查完成',original:25874.36,current:25874.36,control:'并联',heating:'地暖',year:'2008年',basis:'建筑图',remark:''},
  {id:2,name:'一加二联合不动产',floors:'1F',nature:'商业',fee:'非居',status:'待普查',original:454545.54,current:454545.54,control:'并联',heating:'地暖',year:'2008年',basis:'实测',remark:''},
  {id:3,name:'卓优教育',floors:'1F',nature:'商业',fee:'非居',status:'普查完成',original:45845645.25,current:46297959.50,control:'并联',heating:'地暖',year:'2008年',basis:'实测',remark:'现场复测面积增加'},
  {id:4,name:'百医堂',floors:'1F',nature:'商业',fee:'非居',status:'普查完成',original:78458.41,current:78458.41,control:'并联',heating:'地暖',year:'2008年',basis:'实测',remark:''},
  {id:5,name:'萌乐园',floors:'1F',nature:'商业',fee:'非居',status:'普查完成',original:58762.47,current:57526.69,control:'并联',heating:'地暖',year:'2008年',basis:'实测',remark:'拆除部分采暖区域'},
  {id:6,name:'春江花月6号楼',floors:'3-18F',nature:'住宅',fee:'高层',status:'待普查',original:12858.56,current:12858.56,control:'并联',heating:'地暖',year:'2008年',basis:'实测',remark:''},
  {id:7,name:'春江花月7号楼',floors:'1-4F',nature:'住宅',fee:'多层',status:'普查完成',original:2167845.15,current:2167845.15,control:'并联',heating:'地暖',year:'2008年',basis:'房产证',remark:''}
];
let buildings=defaultBuildings;
let attachments={door:'门头图_0333.pdf',plan:'站点平面图.pdf'};
let summary={text:'已完成站内全部楼栋面积普查，现场资料与系统台账已核对。',resident:2,nonresident:3,rows:[{building:'8号楼',unit:'1单元',room:'101',heating:'集中供暖',nature:'居民'}]};
let editingId=null,changingId=null,uploadKind='door',selectedUpload='',toastTimer,buildingEvidenceUploaded=false,changeRecords=[],changeRecordSeed=0;

function loadSaved(){
  try { const saved=JSON.parse(localStorage.getItem(`areaSurveyDraft:${task.id}`)||'null'); if(saved){buildings=saved.buildings||buildings;attachments=saved.attachments||attachments;summary=saved.summary||summary;} } catch(error) {}
}
function init(){
  document.getElementById('stationName').textContent=task.name;
  document.getElementById('stationCode').textContent=task.code;
  document.getElementById('stationAddress').textContent=task.address;
  document.getElementById('stationDepartment').textContent=task.department;
  document.getElementById('stationOffice').textContent=task.office;
  document.getElementById('surveyYear').textContent=task.year;
  if(params.get('unsupported')==='1'||task.type!=='自管站'){
    document.getElementById('fillView').hidden=true;document.getElementById('stickyActions').hidden=true;document.getElementById('unsupportedView').hidden=false;
    document.getElementById('pageTitle').textContent=`${task.type}普查填报`;
    document.getElementById('breadcrumbLast').textContent=`${task.type}普查填报`;
    document.getElementById('unsupportedTitle').textContent=`${task.type}普查流程待完善`;
    document.getElementById('pageSubtitle').textContent='本期仅实现自管站面积普查流程';return;
  }
  loadSaved();
  const readonly=['所长审核','管理部审核','已结束'].includes(task.status);
  if(readonly){document.body.classList.add('readonly');document.getElementById('readonlyTip').textContent='任务已上报，当前为只读模式';}
  setStatus(task.status);renderAttachments();renderBuildings();renderSummary();renderStationSummary();
}
function setStatus(status){const el=document.getElementById('taskStatus');el.textContent=status;el.className=`tag ${status==='已结束'?'tag-gray':status==='已退回'?'tag-red':status==='进行中'?'tag-blue':'tag-orange'}`;}
function fmt(value){return Number(value||0).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});}
function renderStationSummary(){
  const resident=summary?.resident;
  const nonresident=summary?.nonresident;
  document.getElementById('unnetworkedCount').textContent=resident==null||nonresident==null?'待补充':`居民 ${resident} 户　非居民 ${nonresident} 户`;
  document.getElementById('stationSummary').textContent=summary?.text?.trim()||'待补充';
}
function renderAttachments(){
  ['door','plan'].forEach(kind=>{const state=document.getElementById(`${kind}State`);state.textContent=attachments[kind]||'尚未上传';state.classList.toggle('missing',!attachments[kind]);document.getElementById(`${kind}Actions`).hidden=!attachments[kind];});
}
function renderBuildings(){
  const body=document.getElementById('buildingBody');
  const readonly=document.body.classList.contains('readonly');
  body.innerHTML=buildings.map((b,index)=>{const change=b.current-b.original;const rate=b.original?change/b.original*100:null;const ops=readonly?`<button class="link" onclick="openBuilding(${b.id})">查看</button>`:`<button class="link" onclick="openBuilding(${b.id})">编辑</button><button class="link danger-link" onclick="deleteBuilding(${b.id})">删除</button><button class="link" onclick="openChange(${b.id})">录入变更</button>`;return `<tr><td><input type="checkbox" ${readonly?'disabled':''}/></td><td>${index+1}</td><td title="${b.name}">${b.name}</td><td>${b.floors}</td><td>${b.nature}</td><td>${b.fee}</td><td class="center"><span class="tag ${b.status==='普查完成'?'tag-green':'tag-orange'}">${b.status}</span></td><td class="number">${fmt(b.original)}</td><td class="number">${fmt(b.current)}</td><td class="number ${change>0?'change-up':change<0?'change-down':''}">${change>0?'+':''}${fmt(change)}${change>0?'↑':change<0?'↓':''}</td><td class="number ${change>0?'change-up':change<0?'change-down':''}">${rate===null?'无法计算':`${rate.toFixed(2)}%`}</td><td>${b.control}</td><td>${b.heating}</td><td>${b.year}</td><td>${b.basis}</td><td class="operation-cell">${ops}</td></tr>`}).join('');
  document.getElementById('buildingEmpty').hidden=buildings.length>0;
  document.querySelector('.building-table').hidden=buildings.length===0;
  document.querySelector('.pagination-row').hidden=buildings.length===0;
  document.getElementById('buildingCount').textContent=`共 ${buildings.length} 项`;
  document.getElementById('buildingTotal').textContent=`共 ${buildings.length} 个项目`;
}
function totals(field){
  const result={total:0,residential:0,nonresidential:0,multi:0,apartment:0,high:0,nonres:0,noncoop:0};
  buildings.forEach(b=>{const value=Number(b[field]||0);result.total+=value;if(['多层','公寓','高层'].includes(b.fee))result.residential+=value;else result.nonresidential+=value;const map={多层:'multi',公寓:'apartment',高层:'high',非居:'nonres',非协:'noncoop'};if(map[b.fee])result[map[b.fee]]+=value;});return result;
}
function renderSummary(){['original','current'].forEach(field=>{const t=totals(field);Object.keys(t).forEach(key=>{const el=document.getElementById(`${field}${key[0].toUpperCase()}${key.slice(1)}`);if(el)el.textContent=fmt(t[key]);});});}

function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function openUpload(kind){if(document.body.classList.contains('readonly')){previewAttachment(kind);return;}uploadKind=kind;selectedUpload=attachments[kind]||'';document.getElementById('uploadTitle').textContent=kind==='door'?'上传门头图':'上传平面图';document.getElementById('uploadFileName').textContent=selectedUpload||'请选择PDF文件';openModal('uploadMask');}
function selectUploadFile(input){const file=input.files[0];if(!file)return;if(file.size>20*1024*1024){showToast('文件不能超过20MB');input.value='';return;}selectedUpload=file.name;document.getElementById('uploadFileName').textContent=file.name;}
function saveUpload(){if(!selectedUpload){showToast('请选择需要上传的PDF文件');return;}attachments[uploadKind]=selectedUpload;renderAttachments();closeModal('uploadMask');showToast('附件上传成功');}
function previewAttachment(kind){if(!attachments[kind])return;document.getElementById('previewTitle').textContent=kind==='door'?'门头图预览':'平面图预览';document.getElementById('pdfFileName').textContent=attachments[kind];openModal('previewMask');}
function deleteAttachment(kind){if(document.body.classList.contains('readonly'))return;if(!confirm(`确认删除${kind==='door'?'门头图':'平面图'}“${attachments[kind]}”吗？`))return;attachments[kind]='';renderAttachments();showToast('附件已删除');}

function openImport(){document.getElementById('importInput').value='';document.getElementById('importResult').hidden=true;document.getElementById('importSaveBtn').disabled=true;openModal('importMask');}
function selectImportFile(input){const file=input.files[0];if(!file)return;if(file.size>20*1024*1024){showToast('文件不能超过20MB');input.value='';return;}document.getElementById('importFileName').textContent=file.name;document.getElementById('importResult').hidden=false;document.getElementById('importSaveBtn').disabled=false;}
function saveImport(){const nextId=Math.max(0,...buildings.map(b=>b.id))+1;buildings.push({id:nextId,name:'导入楼栋A座',floors:'1-6F',nature:'住宅',fee:'多层',status:'待普查',original:16880,current:16880,control:'并联',heating:'地暖',year:'2012年',basis:'房产证',remark:'Excel导入'},{id:nextId+1,name:'导入商业网点',floors:'1F',nature:'商业',fee:'非居',status:'待普查',original:3580,current:3580,control:'串联',heating:'挂暖',year:'2015年',basis:'实测',remark:'Excel导入'});renderBuildings();renderSummary();closeModal('importMask');showToast('已导入2条有效数据，1条异常数据未导入');}

function openBuilding(id=null){editingId=id;buildingEvidenceUploaded=Boolean(id);const evidenceInput=document.getElementById('buildingEvidenceInput');evidenceInput.value='';document.getElementById('buildingEvidenceState').textContent=id?'已保留原普查依据PDF':'仅支持PDF，单个文件不超过20MB';const readonly=document.body.classList.contains('readonly');document.getElementById('buildingModalTitle').textContent=readonly?'查看普查信息':id?'编辑普查信息':'添加楼栋或建筑物';document.getElementById('buildingError').textContent='';const b=buildings.find(item=>item.id===id)||{};document.getElementById('buildingName').value=b.name||'';document.getElementById('buildingFloors').value=b.floors||'';document.getElementById('buildingYear').value=(b.year||'').replace('年','');document.getElementById('buildingNature').value=b.nature||'';document.getElementById('buildingFee').value=b.fee||'';document.getElementById('buildingControl').value=b.control||'';document.getElementById('buildingArea').value=b.current??'';document.getElementById('buildingHeating').value=b.heating||'';document.getElementById('buildingBasis').value=b.basis||'';document.getElementById('buildingRemark').value=b.remark||'';document.querySelectorAll('#buildingMask input,#buildingMask select,#buildingMask textarea').forEach(el=>el.disabled=readonly);document.querySelector('#buildingMask .modal-footer .btn-primary').hidden=readonly;document.querySelector('#buildingMask .modal-footer.split > .btn').hidden=readonly;openModal('buildingMask');}
function isValidPdf(file){return Boolean(file&&file.name.toLowerCase().endsWith('.pdf')&&(!file.type||file.type==='application/pdf'));}
function selectBuildingEvidence(input){const file=input.files[0];if(!file)return;if(!isValidPdf(file)){input.value='';buildingEvidenceUploaded=false;document.getElementById('buildingEvidenceState').textContent='仅支持PDF，单个文件不超过20MB';showToast('仅支持上传PDF格式的普查依据');return;}if(file.size>20*1024*1024){input.value='';buildingEvidenceUploaded=false;document.getElementById('buildingEvidenceState').textContent='仅支持PDF，单个文件不超过20MB';showToast('普查依据文件大小不能超过20MB');return;}buildingEvidenceUploaded=true;document.getElementById('buildingEvidenceState').textContent=`已选择：${file.name}`;showToast('普查依据PDF上传成功');}
function buildingValues(){return {name:document.getElementById('buildingName').value.trim(),floors:document.getElementById('buildingFloors').value.trim(),year:document.getElementById('buildingYear').value?`${document.getElementById('buildingYear').value}年`:'待补充',nature:document.getElementById('buildingNature').value,fee:document.getElementById('buildingFee').value,control:document.getElementById('buildingControl').value,current:Number(document.getElementById('buildingArea').value),heating:document.getElementById('buildingHeating').value,basis:document.getElementById('buildingBasis').value,remark:document.getElementById('buildingRemark').value.trim()};}
function saveBuilding(next){const value=buildingValues();if(!value.name||!value.floors||!value.nature||!value.fee||!value.control||!value.current||!value.heating||!value.basis||!buildingEvidenceUploaded){document.getElementById('buildingError').textContent='请完整填写所有必填字段并上传普查依据';return;}if(editingId){const b=buildings.find(item=>item.id===editingId);Object.assign(b,value,{status:'普查完成'});}else{const id=Math.max(0,...buildings.map(b=>b.id))+1;buildings.push({...value,id,original:value.current,status:'普查完成'});}renderBuildings();renderSummary();showToast('楼栋信息已保存');if(next){editingId=null;openBuilding();}else closeModal('buildingMask');}
function previousBuilding(){if(!buildings.length)return;const index=Math.max(0,buildings.findIndex(item=>item.id===editingId)-1);openBuilding(buildings[index].id);}
function deleteBuilding(id){const b=buildings.find(item=>item.id===id);if(!confirm(`确认删除“${b.name}”吗？删除后面积汇总将同步更新。`))return;buildings=buildings.filter(item=>item.id!==id);renderBuildings();renderSummary();showToast('楼栋数据已删除');}
function makeChangeRecord(value={}){return {uid:++changeRecordSeed,card:value.card||'',area:value.area??'',basis:value.basis||'',evidence:value.evidence||'',remark:value.remark||'',error:''};}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function openChange(id){changingId=id;const b=buildings.find(item=>item.id===id);document.getElementById('changeBuildingName').textContent=`${b.name} · 热费卡变更明细不参与楼栋面积汇总`;changeRecords=(b.changeRecords?.length?b.changeRecords:[{basis:b.basis}]).map(item=>makeChangeRecord(item));document.getElementById('changeError').textContent='';renderChangeGroups();openModal('changeMask');}
function renderChangeGroups(){const basisOptions=['房产证','确权书','实测','建筑图'];document.getElementById('changeGroups').innerHTML=changeRecords.map((record,index)=>`<section class="change-group ${record.error?'has-error':''}" data-change-index="${index}"><div class="change-group-header"><div><strong>变更明细 ${index+1}</strong><span>每组对应一张独立热费卡</span></div>${index?`<button type="button" class="link danger-link" onclick="removeChangeGroup(${index})">删除</button>`:''}</div><div class="change-group-form"><label><span><i>*</i>热费卡号：</span><input value="${escapeHtml(record.card)}" placeholder="请输入热费卡号" oninput="updateChangeRecord(${index},'card',this.value)" /></label><label><span><i>*</i>普查面积（m²）：</span><input type="number" min="0" step="0.01" value="${escapeHtml(record.area)}" placeholder="请输入普查面积" oninput="updateChangeRecord(${index},'area',this.value)" /></label><label><span><i>*</i>核查依据：</span><select onchange="updateChangeRecord(${index},'basis',this.value)"><option value="">请选择核查依据</option>${basisOptions.map(option=>`<option ${record.basis===option?'selected':''}>${option}</option>`).join('')}</select></label><label class="change-upload-field"><span><i>*</i>上传普查依据：</span><div class="change-upload-control"><input id="changeEvidence-${record.uid}" class="hidden-file-input" type="file" accept=".pdf,application/pdf" onchange="selectChangeEvidence(${index},this)" /><button type="button" class="btn" onclick="document.getElementById('changeEvidence-${record.uid}').click()">▣ 上传PDF</button><small>${record.evidence?`已选择：${escapeHtml(record.evidence)}`:'仅支持PDF，单文件≤20MB'}</small>${record.evidence?`<button type="button" class="link danger-link" onclick="removeChangeEvidence(${index})">删除</button>`:''}</div></label><label class="full change-remark"><span>备注：</span><textarea placeholder="输入内容" oninput="updateChangeRecord(${index},'remark',this.value)">${escapeHtml(record.remark)}</textarea></label>${record.error?`<div class="change-group-error full">${escapeHtml(record.error)}</div>`:''}</div></section>`).join('');}
function updateChangeRecord(index,key,value){changeRecords[index][key]=value;changeRecords[index].error='';}
function addChangeGroup(){changeRecords.push(makeChangeRecord());renderChangeGroups();requestAnimationFrame(()=>document.querySelector(`[data-change-index="${changeRecords.length-1}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}));}
function removeChangeGroup(index){if(index===0)return;if(!confirm(`确认删除“变更明细 ${index+1}”吗？`))return;changeRecords.splice(index,1);renderChangeGroups();}
function selectChangeEvidence(index,input){const file=input.files[0];if(!file)return;if(!isValidPdf(file)){input.value='';changeRecords[index].evidence='';changeRecords[index].error='仅支持上传PDF格式的普查依据';renderChangeGroups();showToast('仅支持上传PDF格式的普查依据');return;}if(file.size>20*1024*1024){input.value='';changeRecords[index].evidence='';changeRecords[index].error='普查依据文件大小不能超过20MB';renderChangeGroups();showToast('普查依据文件大小不能超过20MB');return;}changeRecords[index].evidence=file.name;changeRecords[index].error='';renderChangeGroups();showToast('普查依据PDF上传成功');}
function removeChangeEvidence(index){changeRecords[index].evidence='';changeRecords[index].error='';renderChangeGroups();}
function saveChange(){let firstInvalid=-1;changeRecords.forEach((record,index)=>{const missing=[];if(!record.card.trim())missing.push('热费卡号');if(!(Number(record.area)>0))missing.push('普查面积');if(!record.basis)missing.push('核查依据');if(!record.evidence)missing.push('普查依据PDF');record.error=missing.length?`请补充：${missing.join('、')}`:'';if(missing.length&&firstInvalid<0)firstInvalid=index;});if(firstInvalid>=0){document.getElementById('changeError').textContent='存在未完成的变更明细，请按提示补充后再保存';renderChangeGroups();requestAnimationFrame(()=>document.querySelector(`[data-change-index="${firstInvalid}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}));return;}const b=buildings.find(item=>item.id===changingId);b.changeRecords=changeRecords.map(({uid,error,...record})=>({...record,area:Number(record.area)}));document.getElementById('changeError').textContent='';closeModal('changeMask');showToast(`已保存 ${changeRecords.length} 条热费卡变更明细，楼栋面积汇总未变化`);}

function openSummary(){document.getElementById('summaryText').value=summary.text;document.getElementById('residentCount').value=summary.resident;document.getElementById('nonresidentCount').value=summary.nonresident;document.getElementById('summaryError').textContent='';renderUnnetworked();openModal('summaryMask');}
function renderUnnetworked(){const box=document.getElementById('unnetworkedRows');box.innerHTML=summary.rows.map((row,index)=>`<div class="unnetworked-row"><input placeholder="楼号" value="${row.building||''}" onchange="updateUnnetworked(${index},'building',this.value)"/><input placeholder="单元号" value="${row.unit||''}" onchange="updateUnnetworked(${index},'unit',this.value)"/><input placeholder="户室号" value="${row.room||''}" onchange="updateUnnetworked(${index},'room',this.value)"/><select onchange="updateUnnetworked(${index},'heating',this.value)"><option ${row.heating==='集中供暖'?'selected':''}>集中供暖</option><option ${row.heating==='自采暖'?'selected':''}>自采暖</option></select><select onchange="updateUnnetworked(${index},'nature',this.value)"><option ${row.nature==='居民'?'selected':''}>居民</option><option ${row.nature==='非居民'?'selected':''}>非居民</option></select><button type="button" onclick="removeUnnetworked(${index})">×</button></div>`).join('');}
function addUnnetworkedRow(){summary.rows.push({building:'',unit:'',room:'',heating:'集中供暖',nature:'居民'});renderUnnetworked();}
function removeUnnetworked(index){summary.rows.splice(index,1);renderUnnetworked();}
function updateUnnetworked(index,key,value){summary.rows[index][key]=value;}
function saveSummary(){const text=document.getElementById('summaryText').value.trim(),resident=Number(document.getElementById('residentCount').value),nonresident=Number(document.getElementById('nonresidentCount').value);if(!text||resident<0||nonresident<0||((resident+nonresident)>0&&!summary.rows.length)){document.getElementById('summaryError').textContent='请填写普查小结、未入网户数；存在未入网户数时至少添加一条明细';return;}summary={...summary,text,resident,nonresident};renderStationSummary();closeModal('summaryMask');showToast('普查小结已保存，顶部站点信息已同步更新');}

function persistDraft(){localStorage.setItem(`areaSurveyDraft:${task.id}`,JSON.stringify({buildings,attachments,summary,updatedAt:nowText()}));}
function saveDraft(){persistDraft();showToast('暂存成功，可从个人任务列表继续编辑');}
function reportValidation(){const errors=[];if(!buildings.length)errors.push('至少添加1条楼栋或建筑物数据');if(buildings.some(b=>!b.name||!b.floors||!b.nature||!b.fee||!b.control||!b.current||!b.heating||!b.basis))errors.push('存在必填字段不完整的楼栋数据');if(!attachments.door)errors.push('请上传门头图');if(!attachments.plan)errors.push('请上传站点平面图');if(!summary.text)errors.push('请填写普查小结');if(summary.resident==null||summary.nonresident==null)errors.push('请填写未入网居民及非居民户数');return errors;}
function openReportConfirm(){const errors=reportValidation(),box=document.getElementById('reportErrors');box.hidden=!errors.length;box.innerHTML=errors.length?`<strong>暂不能上报：</strong><br>${errors.map((item,index)=>`${index+1}. ${item}`).join('<br>')}`:'';openModal('reportMask');}
function submitReport(){const errors=reportValidation();if(errors.length){openReportConfirm();return;}persistDraft();task.status='所长审核';task.auditStatus='待审核';task.updatedAt=nowText();try{const states=JSON.parse(localStorage.getItem('areaSurveyTaskStates')||'{}');states[task.id]={status:task.status,auditStatus:task.auditStatus,updatedAt:task.updatedAt};localStorage.setItem('areaSurveyTaskStates',JSON.stringify(states));}catch(error){}closeModal('reportMask');showToast('上报成功，任务已进入所长审核');setTimeout(()=>location.href='area-survey-surveyor-tasks.html',900);}
function nowText(){const d=new Date(),p=v=>String(v).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;}
function showToast(message){clearTimeout(toastTimer);const toast=document.getElementById('toast');toast.textContent=message;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),2400);}
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.modal-mask.open').forEach(el=>el.classList.remove('open'));});
init();
