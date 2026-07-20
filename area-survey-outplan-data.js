const OUTPLAN_KEY='areaSurveyOutPlanTasks';
const OUTPLAN_REASONS={AREA_CHANGE:'面积变化',DIRECT_TO_HOUSEHOLD:'一管到户',NEW_ACCOUNT_OR_CAPACITY:'新开户及增容',WHOLESALE_USER:'趸售用户'};
const OUTPLAN_REASON_ALIASES={
  AREA_CHANGE:'AREA_CHANGE',area:'AREA_CHANGE','面积变化':'AREA_CHANGE',
  DIRECT_TO_HOUSEHOLD:'DIRECT_TO_HOUSEHOLD',direct:'DIRECT_TO_HOUSEHOLD','一管到户':'DIRECT_TO_HOUSEHOLD','一管到户（自管站）':'DIRECT_TO_HOUSEHOLD',
  NEW_ACCOUNT_OR_CAPACITY:'NEW_ACCOUNT_OR_CAPACITY',new:'NEW_ACCOUNT_OR_CAPACITY','新开户':'NEW_ACCOUNT_OR_CAPACITY','新开户及增容':'NEW_ACCOUNT_OR_CAPACITY',
  WHOLESALE_USER:'WHOLESALE_USER',gas:'WHOLESALE_USER',GAS_REPLACEMENT:'WHOLESALE_USER','燃气替代':'WHOLESALE_USER','趸售用户':'WHOLESALE_USER'
};
const OUTPLAN_STATIONS=[
  {id:'s01',code:'60218B001',name:'春江花月西站',type:'自管站',department:'桥西管理部',office:'桥西片区所',address:'桥西区新石中路118号'},
  {id:'s02',code:'60218B002',name:'金域蓝湾站',type:'自管站',department:'桥西管理部',office:'振头片区所',address:'桥西区友谊南大街106号'},
  {id:'s03',code:'33315A001',name:'河北省教育考试院服务部',type:'用户站',department:'桥西管理部',office:'红旗片区所',address:'桥西区红旗大街297号'},
  {id:'s04',code:'33925A001000000001Z',name:'河北保家物业服务有限公司',type:'对公用户',department:'桥西管理部',office:'振头片区所',address:'桥西区新石北路417号'},
  {id:'s05',code:'60218C011',name:'盛世长安站',type:'自管站',department:'长安管理部',office:'长安片区所',address:'长安区和平东路303号'},
  {id:'s06',code:'33316A021',name:'谈固社区服务站',type:'用户站',department:'长安管理部',office:'谈固片区所',address:'长安区中山东路568号'},
  {id:'s07',code:'60218Y016',name:'恒大华府站',type:'自管站',department:'裕华管理部',office:'槐底片区所',address:'裕华区槐安东路145号'},
  {id:'s08',code:'33925Y030',name:'河北恒泰商贸有限公司',type:'对公用户',department:'裕华管理部',office:'裕华片区所',address:'裕华区体育南大街212号'}
];
const OUTPLAN_SEED=[
 {id:'OP20260715001',name:'桥西管理部面积变化专项普查',reason:'AREA_CHANGE',start:'2026-07-16T09:00',end:'2026-07-30T18:00',stationIds:['s01','s02'],status:'待分配',creator:'王建国',creatorRole:'管理部',createdAt:'2026-07-15 09:18:20',logs:[{action:'下发任务',operator:'王建国',time:'2026-07-15 09:25:10',detail:'任务已下发至桥西片区所、振头片区所'},{action:'创建任务',operator:'王建国',time:'2026-07-15 09:18:20',detail:'创建计划外普查任务'}]},
 {id:'OP20260714002',name:'新开户及增容面积确认任务',reason:'NEW_ACCOUNT_OR_CAPACITY',start:'2026-07-15T08:30',end:'2026-07-25T17:30',stationIds:['s03'],status:'进行中',creator:'业务管理员',creatorRole:'业务管理员',createdAt:'2026-07-14 14:06:33',logs:[{action:'分配人员',operator:'桥西片区所',time:'2026-07-15 08:40:00',detail:'已分配普查人员张三'},{action:'下发任务',operator:'业务管理员',time:'2026-07-14 14:10:00',detail:'任务已下发'}]},
 {id:'OP20260712003',name:'趸售用户专项普查',reason:'WHOLESALE_USER',start:'2026-07-12T09:00',end:'2026-07-22T18:00',stationIds:['s04'],status:'所长审核',creator:'业务管理员',creatorRole:'业务管理员',createdAt:'2026-07-12 08:50:16',logs:[{action:'提交审核',operator:'张三',time:'2026-07-14 16:20:00',detail:'普查结果已提交片区所审核'}]},
 {id:'OP20260701004',name:'自管站一管到户普查',reason:'DIRECT_TO_HOUSEHOLD',start:'2026-07-01T09:00',end:'2026-07-12T18:00',stationIds:['s05'],status:'已完成',creator:'长安管理部',creatorRole:'管理部',createdAt:'2026-07-01 09:00:00',logs:[{action:'审核完成',operator:'长安管理部',time:'2026-07-11 15:30:00',detail:'管理部审核通过，任务完成'}]},
 {id:'OP20260715005',name:'裕华新开户及增容临时普查',reason:'NEW_ACCOUNT_OR_CAPACITY',start:'2026-07-18T09:00',end:'2026-07-31T18:00',stationIds:['s07','s08'],status:'未下发',creator:'业务管理员',creatorRole:'业务管理员',createdAt:'2026-07-15 11:10:08',logs:[{action:'创建任务',operator:'业务管理员',time:'2026-07-15 11:10:08',detail:'任务保存为未下发'}]}
];
const OUTPLAN_STATION_IDS=new Set(OUTPLAN_STATIONS.map(item=>item.id));
function outPlanNormalizeReason(reason){return OUTPLAN_REASON_ALIASES[String(reason||'').trim()]||null;}
function outPlanNormalizeTemporaryStations(stations){return (Array.isArray(stations)?stations:[]).filter(item=>item&&String(item.id||'').startsWith('tmp-')).map(item=>({...item,code:String(item.code||'').toUpperCase(),type:'用户站',source:'新建',temporary:true}));}
function outPlanNormalizeTasks(tasks){return (Array.isArray(tasks)?tasks:[]).map(item=>{const {reasonSubtype,reasonRaw,...task}=item,reason=outPlanNormalizeReason(item.reason),temporaryStations=outPlanNormalizeTemporaryStations(item.temporaryStations),temporaryIds=new Set(temporaryStations.map(station=>station.id));return {...task,reason:reason||'UNKNOWN',...(reason?{}:{reasonRaw:item.reason||reasonRaw||''}),temporaryStations,stationIds:(task.stationIds||[]).filter(id=>OUTPLAN_STATION_IDS.has(id)||temporaryIds.has(id)),logs:[...(task.logs||[])]};}).filter(item=>item.stationIds.length);}
function outPlanLoad(){try{const saved=JSON.parse(localStorage.getItem(OUTPLAN_KEY)||'null');return outPlanNormalizeTasks(Array.isArray(saved)?saved:OUTPLAN_SEED);}catch(e){return outPlanNormalizeTasks(OUTPLAN_SEED);}}
function outPlanSave(tasks){localStorage.setItem(OUTPLAN_KEY,JSON.stringify(outPlanNormalizeTasks(tasks)));}
function outPlanNow(){const d=new Date(),p=v=>String(v).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;}
function outPlanStation(id,task){return OUTPLAN_STATIONS.find(item=>item.id===id)||(task?.temporaryStations||[]).find(item=>item.id===id);}
function outPlanReason(task){return OUTPLAN_REASONS[outPlanNormalizeReason(task.reason)]||'未知原因';}
function outPlanConflict(stationId,start,end,ignoreId){return outPlanLoad().find(task=>task.id!==ignoreId&&!['已完成','已作废'].includes(task.status)&&task.stationIds.includes(stationId)&&start<task.end&&end>task.start);}
function outPlanTag(status){const map={'未下发':'gray','待分配':'orange','进行中':'blue','普查中':'blue','所长审核':'orange','管理部审核':'orange','已完成':'green','普查完成':'green','已作废':'red'};return `<span class="tag tag-${map[status]||'gray'}">${status}</span>`;}
function outPlanToast(text){const toast=document.getElementById('toast');if(!toast)return;toast.textContent=text;toast.classList.add('show');clearTimeout(window.__outPlanToast);window.__outPlanToast=setTimeout(()=>toast.classList.remove('show'),2300);}
