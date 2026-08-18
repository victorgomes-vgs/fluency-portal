/* ── RELATÓRIOS ADM (injected into portal.html babel block) ── */
function formatTs(ms){
  if(!ms)return "—";
  try{return new Date(ms).toLocaleString("pt-BR");}catch(e){return "—";}
}
function formatDuration(ms){
  if(ms==null||ms===""||isNaN(ms))return "—";
  const s=Math.max(0,Math.round(Number(ms)/1000));
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),r=s%60;
  if(h)return h+"h "+m+"min";
  if(m)return m+"min "+r+"s";
  return r+"s";
}
function evalLabel(v){
  const hit=EVAL_OPTS.find(o=>o.v===v);
  return hit?hit.l:(v||"—");
}

function CompetencyChart({competencies}){
  const canvasRef=useRef(null);
  const chartRef=useRef(null);
  useEffect(()=>{
    if(!canvasRef.current||typeof Chart==="undefined")return;
    const keys=[
      {k:"fluenciaOral",label:"Fluência Oral"},
      {k:"escrita",label:"Escrita"},
      {k:"leitura",label:"Leitura"},
      {k:"compreensaoAuditiva",label:"Compreensão Auditiva"},
    ];
    // No formulas: bar height = count of raw evaluations stored (structure only).
    const counts=keys.map(x=>(competencies&&competencies[x.k]?competencies[x.k].length:0));
    if(chartRef.current){chartRef.current.destroy();chartRef.current=null;}
    chartRef.current=new Chart(canvasRef.current,{
      type:"bar",
      data:{
        labels:keys.map(x=>x.label),
        datasets:[{
          label:"Registros brutos no módulo (sem média)",
          data:counts,
          backgroundColor:["#0f766e","#1d4ed8","#7c3aed","#b45309"],
          borderRadius:8,
        }]
      },
      options:{
        responsive:true,
        plugins:{legend:{display:false},tooltip:{callbacks:{footer:()=>"Cálculo de desempenho será definido depois."}}},
        scales:{y:{beginAtZero:true,ticks:{stepSize:1},title:{display:true,text:"Qtd. de avaliações gravadas"}}}
      }
    });
    return()=>{if(chartRef.current){chartRef.current.destroy();chartRef.current=null;}};
  },[competencies]);
  return(
    <div className="glass rounded-2xl p-4">
      <h4 className="font-bold text-sm mb-1">Gráfico geral de competências</h4>
      <p className="text-xs muted mb-3">Exibe apenas a quantidade de avaliações já registradas por competência. Nenhuma média ou peso é aplicado.</p>
      <canvas ref={canvasRef} height="140"/>
    </div>
  );
}

async function loadStudentExercises(uid){
  const snap=await db.collection("students").doc(uid).collection("exercises").get();
  const map={};
  snap.docs.forEach(d=>{map[d.id]=d.data();});
  return map;
}
async function loadStudentDiario(uid){
  const snap=await db.collection("students").doc(uid).collection("diario").orderBy("num","asc").get();
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}

function buildReportCardPayload({student,course,moduleBook,exercisesMap,diarioEntries}){
  const courseId=course?.id||student?.contrato||"course";
  const moduleId=moduleBook.bookIdx;
  const moduleName=(course?.modulos||[]).find(m=>(m.id||m.nome)===moduleId||m.id===moduleId)?.nome
    || (course?.modulos||[])[moduleId-1]?.nome
    || ("Módulo "+moduleId);
  const competencies={fluenciaOral:[],escrita:[],leitura:[],compreensaoAuditiva:[]};
  const lessons=[];
  (moduleBook.items||[]).forEach(item=>{
    if(item.type==="report_card"||item.lessonType==="report_card")return;
    const ex=exercisesMap[item.id]||Object.values(exercisesMap).find(x=>x&&x.lessonId&&String(x.lessonId).includes(String(item.num)))||null;
    const presence=(diarioEntries||[]).filter(e=>e.licaoId===item.id||Number(e.licaoNum)===Number(item.num));
    const grades={
      evalF:item.evalF||"",evalA:item.evalA||"",evalL:item.evalL||"",evalE:item.evalE||"",
      feedback:item.feedback||"",obs:item.obs||"",date:item.date||""
    };
    EVAL_SKILLS.forEach(sk=>{
      const val=grades[sk.f];
      if(val)competencies[sk.reportKey].push({lessonId:item.id,lessonNum:item.num,value:val,date:grades.date||null});
    });
    lessons.push({
      lessonId:item.id,
      lessonNum:item.num,
      title:item.title||getLessonDisplayLabel(item),
      grades,
      task:{
        accessed:!!(ex&&(ex.accessed||ex.firstAccessAt)),
        firstAccessAt:ex?.firstAccessAt||null,
        completed:!!(ex?.completed||item.tarefaFeita),
        completedAt:ex?.completedAt||null,
        timeToCompleteMs:ex?.timeToCompleteMs??null,
        grade10:ex?.score?.grade10??null,
        percentage:ex?.score?.percentage??null,
        manualTarefaFeita:!!item.tarefaFeita,
      },
      presence:presence.map(p=>({id:p.id,num:p.num,date:p.date,status:normalizeDiarioStatus(p),ocorrido:p.ocorrido||"",obs:p.obs||""})),
      raw:{status:item.status||"",dataPrevista:item.dataPrevista||""}
    });
  });
  return{
    courseId,moduleId,moduleName,
    studentId:student.uid,
    studentName:student.name||"",
    createdAt:Date.now(),
    updatedAt:Date.now(),
    lessons,
    competencies,
    summary:null
  };
}

function ReportCardView({student,course,moduleBook,exercisesMap,diarioEntries,onBack}){
  const [payload,setPayload]=useState(null);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    const p=buildReportCardPayload({student,course,moduleBook,exercisesMap,diarioEntries});
    setPayload(p);
  },[student,course,moduleBook,exercisesMap,diarioEntries]);
  async function persist(){
    if(!payload)return;
    setSaving(true);
    try{
      const id=`${payload.courseId}_m${payload.moduleId}`;
      await db.collection("students").doc(student.uid).collection("reportCards").doc(id).set(payload,{merge:true});
      alert("Report Card estrutural salvo (sem fórmulas).");
    }catch(e){alert("Erro ao salvar Report Card: "+(e.message||e));}
    setSaving(false);
  }
  if(!payload)return <LoadingScreen/>;
  return(
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <button type="button" className="page-back mb-2" onClick={onBack}><Icon name="arrow-left" size={16}/> Voltar</button>
          <h3 className="text-xl font-bold" style={{fontFamily:"'Sora',sans-serif"}}>Report Card — {payload.moduleName}</h3>
          <p className="text-xs muted">{payload.studentName} · dados brutos do módulo (cálculo futuro)</p>
        </div>
        <button className="btn btn-primary rounded-xl px-4 py-2 text-sm font-semibold" disabled={saving} onClick={persist}>{saving?"Salvando…":"Salvar estrutura no Firebase"}</button>
      </div>
      <CompetencyChart competencies={payload.competencies}/>
      <div className="glass rounded-2xl p-4">
        <h4 className="font-bold text-sm mb-2">Resumo geral do módulo</h4>
        <p className="text-sm muted">Campo <code>summary</code> reservado. Nenhuma fórmula de média/peso está ativa nesta versão.</p>
      </div>
      <div className="space-y-3">
        {payload.lessons.map(L=>(
          <div key={L.lessonId} className="glass rounded-2xl p-4">
            <div className="font-bold text-sm mb-2">Lição {L.lessonNum} — {L.title}</div>
            <div className="grid gap-2 text-xs" style={{gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))"}}>
              <div><div className="muted">Notas (F/A/L/E)</div>
                {EVAL_SKILLS.map(sk=><div key={sk.f}>{sk.name}: <strong>{evalLabel(L.grades[sk.f])}</strong></div>)}
              </div>
              <div><div className="muted">Tarefa</div>
                <div>Acessou: <strong>{L.task.accessed?"sim":"não"}</strong></div>
                <div>1º acesso: {formatTs(L.task.firstAccessAt)}</div>
                <div>Concluída: <strong>{L.task.completed?"sim":"não"}</strong></div>
                <div>Tempo até envio: {formatDuration(L.task.timeToCompleteMs)}</div>
                <div>Nota: {L.task.grade10!=null?L.task.grade10:"—"} · %: {L.task.percentage!=null?L.task.percentage:"—"}</div>
              </div>
              <div><div className="muted">Presença (Diário)</div>
                {L.presence.length===0?<div>—</div>:L.presence.map(p=><div key={p.id}>Aula {p.num} · {p.date||"—"} · {(dStatusMap[p.status]||{}).label||p.status}</div>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminRelatorioAluno({student,onBack}){
  const courses=useCourses();
  const course=useMemo(()=>getCourseById(student.contrato),[courses,student.contrato]);
  const books=useMemo(()=>mergeBooks(student.trilha||{},course),[student.trilha,course]);
  const [tab,setTab]=useState("tarefas");
  const [exercisesMap,setExercisesMap]=useState({});
  const [diarioEntries,setDiarioEntries]=useState([]);
  const [rcMod,setRcMod]=useState(null);
  useEffect(()=>{
    let alive=true;
    (async()=>{
      const [ex,di]=await Promise.all([loadStudentExercises(student.uid),loadStudentDiario(student.uid)]);
      if(!alive)return;
      setExercisesMap(ex);setDiarioEntries(di);
    })();
    return()=>{alive=false;};
  },[student.uid]);

  if(rcMod){
    const moduleBook=books.find(b=>b.bookIdx===rcMod);
    return <ReportCardView student={student} course={course} moduleBook={moduleBook} exercisesMap={exercisesMap} diarioEntries={diarioEntries} onBack={()=>setRcMod(null)}/>;
  }

  const tabs=[
    {id:"tarefas",label:"Tarefas"},
    {id:"notas",label:"Notas das aulas"},
    {id:"presenca",label:"Presença"},
    {id:"report",label:"Report Card"},
  ];

  return(
    <div>
      <button type="button" className="page-back mb-3" onClick={onBack}><Icon name="arrow-left" size={16}/> Voltar</button>
      <h3 className="text-xl font-bold mb-1" style={{fontFamily:"'Sora',sans-serif"}}>{student.name}</h3>
      <p className="text-xs muted mb-4">{getCourseLabel(student.contrato)} · relatório individual</p>
      <div className="tab-bar mb-4" style={{maxWidth:560}}>
        {tabs.map(t=><button key={t.id} type="button" className={"tab-btn"+(tab===t.id?" tab-btn-active":"")} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab==="tarefas"&&(
        <div className="space-y-4">
          {books.map(b=>(
            <div key={b.bookIdx} className="glass rounded-2xl p-4">
              <h4 className="font-bold text-sm mb-3">Módulo {b.bookIdx}</h4>
              <div className="space-y-2">
                {b.items.filter(i=>i.type!=="report_card"&&i.lessonType!=="report_card").map(item=>{
                  const ex=exercisesMap[item.id]||null;
                  const accessed=!!(ex&&(ex.accessed||ex.firstAccessAt));
                  const completed=!!(ex?.completed);
                  const missing=!completed;
                  return(
                    <div key={item.id} className="rounded-xl p-3 text-xs" style={{border:"1px solid var(--divider)",background:missing?"rgba(229,99,107,.06)":"var(--badge)"}}>
                      <div className="font-semibold text-sm mb-1">Lição {getLessonDisplayLabel(item)} — {item.title||"Sem título"}</div>
                      <div className="grid gap-1" style={{gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))"}}>
                        <div>Acessou: <strong>{accessed?"sim":"não"}</strong></div>
                        <div>1º acesso: {formatTs(ex?.firstAccessAt)}</div>
                        <div>Tempo até envio: {formatDuration(ex?.timeToCompleteMs)}</div>
                        <div>Concluída/enviada: <strong>{completed?"sim":"não"}</strong>{item.tarefaFeita?" · marcada na trilha":""}</div>
                        <div>Nota: {ex?.score?.grade10!=null?ex.score.grade10:"—"}</div>
                        <div>Aproveitamento: {ex?.score?.percentage!=null?ex.score.percentage+"%":"—"}</div>
                      </div>
                      {missing&&<div className="mt-1" style={{color:"#e5636b"}}>Tarefa não concluída / sem envio</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="notas"&&(
        <div className="space-y-3">
          {books.map(b=>b.items.filter(i=>i.type!=="report_card").map(item=>(
            <div key={item.id} className="glass rounded-xl p-4 text-sm">
              <div className="font-bold mb-2">Lição {getLessonDisplayLabel(item)} — {item.title||"—"}{item.date?(" · "+formatDateBR(item.date)):""}</div>
              <div className="grid gap-2 text-xs" style={{gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))"}}>
                {EVAL_SKILLS.map(sk=><div key={sk.f}>{sk.name}: <strong>{evalLabel(item[sk.f])}</strong></div>)}
              </div>
              {item.feedback?<div className="text-xs muted mt-2">Feedback: {item.feedback}</div>:null}
              {item.obs?<div className="text-xs muted mt-1">Obs.: {item.obs}</div>:null}
            </div>
          )))}
        </div>
      )}

      {tab==="presenca"&&(
        <div className="space-y-2">
          {diarioEntries.length===0?<div className="glass rounded-2xl p-8 text-center muted">Sem lançamentos no Diário.</div>:
            diarioEntries.map(e=>{
              const st=normalizeDiarioStatus(e);
              const ds=dStatusMap[st]||{};
              return(
                <div key={e.id} className="glass rounded-xl px-4 py-3 flex justify-between gap-3 items-center">
                  <div>
                    <div className="text-sm font-semibold">Aula {e.num} · {formatDateBR(e.date)}</div>
                    <div className="text-xs muted">{e.licaoTitulo||(e.licaoNum?`Lição ${e.licaoNum}`:"—")}</div>
                    {e.ocorrido?<div className="text-xs muted">Ocorrido: {e.ocorrido}</div>:null}
                    {e.obs?<div className="text-xs muted">Anotações: {e.obs}</div>:null}
                  </div>
                  <span className={"diario-badge "+(ds.cls||"")}>{ds.label||st}</span>
                </div>
              );
            })
          }
        </div>
      )}

      {tab==="report"&&(
        <div className="space-y-3">
          <p className="text-sm muted">Escolha o módulo para visualizar o Report Card estrutural (sem fórmulas).</p>
          {books.map(b=>(
            <button key={b.bookIdx} type="button" className="glass rounded-2xl p-4 w-full text-left hover:opacity-95" onClick={()=>setRcMod(b.bookIdx)}>
              <div className="font-bold">Módulo {b.bookIdx}</div>
              <div className="text-xs muted">{b.items.filter(i=>i.type!=="report_card").length} lições · Visualizar Report Card</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminRelatorioCurso({students,courseId,onBack,onOpenStudent}){
  const courses=useCourses();
  const course=useMemo(()=>getCourseById(courseId),[courses,courseId]);
  const linked=useMemo(()=>(students||[]).filter(s=>resolveContratoId(s.contrato)===courseId),[students,courseId]);
  const books=useMemo(()=>generateBooks(course),[course]);
  return(
    <div>
      <button type="button" className="page-back mb-3" onClick={onBack}><Icon name="arrow-left" size={16}/> Voltar</button>
      <h3 className="text-xl font-bold mb-1">{course?.nome||courseId}</h3>
      <p className="text-xs muted mb-4">{linked.length} aluno(s) vinculados · contagens brutas (sem médias)</p>
      <div className="grid gap-3 mb-5" style={{gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))"}}>
        <div className="dash-stat-card"><div className="dash-stat-num">{linked.length}</div><div className="dash-stat-label">Alunos</div></div>
        <div className="dash-stat-card"><div className="dash-stat-num">{books.length}</div><div className="dash-stat-label">Módulos</div></div>
        <div className="dash-stat-card"><div className="dash-stat-num">{books.reduce((s,b)=>s+b.items.filter(i=>i.type!=="report_card").length,0)}</div><div className="dash-stat-label">Lições</div></div>
      </div>
      <div className="glass rounded-2xl p-4 mb-4">
        <h4 className="font-bold text-sm mb-2">Módulos / Report Card</h4>
        {books.map(b=>(
          <div key={b.bookIdx} className="text-sm py-2" style={{borderBottom:"1px solid var(--divider)"}}>
            Módulo {b.bookIdx}: {b.items.filter(i=>i.type!=="report_card").length} lições
            {b.items.some(i=>i.reportCardAfter||i.reportCard)?<span className="ml-2 text-xs" style={{color:"#0f766e"}}>· âncora Report Card</span>:null}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {linked.map(s=>(
          <button key={s.uid} type="button" className="glass rounded-xl px-4 py-3 w-full text-left flex justify-between" onClick={()=>onOpenStudent(s)}>
            <span className="font-semibold text-sm">{s.name}</span>
            <span className="text-xs muted">Abrir relatório →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AdminRelatorioPeriodo({students,onBack,onOpenStudent}){
  const [from,setFrom]=useState(()=>{const d=new Date();d.setDate(1);return d.toISOString().slice(0,10);});
  const [to,setTo]=useState(()=>new Date().toISOString().slice(0,10));
  const [rows,setRows]=useState(null);
  async function run(){
    setRows(null);
    const list=[];
    for(const s of (students||[]).filter(x=>(x.status||"")==="ativo"||!x.status||x.status==="ativo")){
      const di=await loadStudentDiario(s.uid);
      const inRange=di.filter(e=>{
        const d=e.date||"";
        return d&&d>=from&&d<=to;
      });
      if(!inRange.length)continue;
      list.push({student:s,count:inRange.length,presencas:inRange.filter(e=>diarioIsPresence(normalizeDiarioStatus(e))).length});
    }
    setRows(list);
  }
  return(
    <div>
      <button type="button" className="page-back mb-3" onClick={onBack}><Icon name="arrow-left" size={16}/> Voltar</button>
      <h3 className="text-xl font-bold mb-3">Por período</h3>
      <div className="glass rounded-2xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <label className="text-xs muted">De<input type="date" className="input-light mt-1 block" value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label className="text-xs muted">Até<input type="date" className="input-light mt-1 block" value={to} onChange={e=>setTo(e.target.value)}/></label>
        <button className="btn btn-primary rounded-xl px-4 py-2 text-sm font-semibold" onClick={run}>Consultar Diário</button>
      </div>
      {rows==null?<p className="text-sm muted">Defina o intervalo e consulte. Exibe contagens brutas de lançamentos do Diário.</p>:(
        rows.length===0?<div className="glass rounded-2xl p-8 text-center muted">Nenhum lançamento no período.</div>:(
          <div className="space-y-2">{rows.map(r=>(
            <button key={r.student.uid} type="button" className="glass rounded-xl px-4 py-3 w-full text-left flex justify-between" onClick={()=>onOpenStudent(r.student)}>
              <span className="font-semibold text-sm">{r.student.name}</span>
              <span className="text-xs muted">{r.count} lançamento(s) · {r.presencas} presença(s)</span>
            </button>
          ))}</div>
        )
      )}
    </div>
  );
}

function AdminRelatorios({students,onBack,onOpenStudentProfile}){
  const courses=useCourses();
  const [mode,setMode]=useState("hub"); // hub | aluno-list | aluno | curso | periodo
  const [q,setQ]=useState("");
  const [selected,setSelected]=useState(null);
  const [courseId,setCourseId]=useState(null);
  const activeCourses=useMemo(()=>(courses||[]).filter(c=>c.ativo!==false),[courses]);
  const alunos=useMemo(()=>{
    let list=(students||[]).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
    const term=q.trim().toLowerCase();
    if(term)list=list.filter(s=>(s.name||"").toLowerCase().includes(term)||(s.email||"").toLowerCase().includes(term));
    return list;
  },[students,q]);

  if(mode==="aluno"&&selected){
    return <AdminRelatorioAluno student={selected} onBack={()=>{setSelected(null);setMode("aluno-list");}}/>;
  }
  if(mode==="curso"&&courseId){
    return <AdminRelatorioCurso students={students} courseId={courseId} onBack={()=>{setCourseId(null);setMode("hub");}} onOpenStudent={s=>{setSelected(s);setMode("aluno");}}/>;
  }
  if(mode==="periodo"){
    return <AdminRelatorioPeriodo students={students} onBack={()=>setMode("hub")} onOpenStudent={s=>{setSelected(s);setMode("aluno");}}/>;
  }
  if(mode==="aluno-list"){
    return(
      <div>
        <button type="button" className="page-back mb-3" onClick={()=>setMode("hub")}><Icon name="arrow-left" size={16}/> Voltar</button>
        <h3 className="text-xl font-bold mb-3">Por aluno</h3>
        <input className="input-light w-full mb-3" placeholder="Buscar aluno…" value={q} onChange={e=>setQ(e.target.value)}/>
        <div className="space-y-2">
          {alunos.map(s=>(
            <button key={s.uid} type="button" className="glass rounded-xl px-4 py-3 w-full text-left flex justify-between items-center" onClick={()=>{setSelected(s);setMode("aluno");}}>
              <div>
                <div className="font-semibold text-sm">{s.name}</div>
                <div className="text-xs muted">{getCourseLabel(s.contrato)}</div>
              </div>
              <span className="text-xs muted">Abrir →</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const cards=[
    {id:"aluno-list",icon:"user",title:"Por aluno",desc:"Histórico de tarefas, notas, presença e Report Card individual.",cor:"#0f2c5c"},
    {id:"curso",icon:"book-open",title:"Por curso",desc:"Visão dos módulos, âncoras de Report Card e alunos vinculados.",cor:"#0f766e"},
    {id:"periodo",icon:"calendar",title:"Por período",desc:"Filtrar lançamentos do Diário por intervalo de datas.",cor:"#1e3a8a"},
  ];
  return(
    <div>
      <button type="button" className="page-back mb-3" onClick={onBack}><Icon name="arrow-left" size={16}/> Dashboard</button>
      <h2 className="text-2xl font-bold mb-1" style={{fontFamily:"'Sora',sans-serif"}}>Relatórios</h2>
      <p className="text-sm muted mb-5">Consulte presença (Diário), tarefas e notas. Report Cards estruturais — sem fórmulas nesta versão.</p>
      <div className="grid gap-4" style={{gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}>
        {cards.map(c=>(
          <button key={c.id} type="button" className="glass rounded-2xl p-5 text-left" onClick={()=>{
            if(c.id==="curso"){setMode("hub"); /* show course picker below via state */}
            setMode(c.id==="curso"?"curso-pick":c.id);
          }} style={{borderTop:"3px solid "+c.cor}}>
            <Icon name={c.icon} size={22} style={{color:c.cor}}/>
            <div className="font-bold mt-3">{c.title}</div>
            <div className="text-xs muted mt-1">{c.desc}</div>
          </button>
        ))}
      </div>
      {mode==="curso-pick"&&(
        <div className="mt-5 space-y-2">
          <h4 className="font-bold text-sm">Escolha o curso</h4>
          {activeCourses.map(c=>(
            <button key={c.id} type="button" className="glass rounded-xl px-4 py-3 w-full text-left" onClick={()=>{setCourseId(c.id);setMode("curso");}}>
              <div className="font-semibold text-sm">{c.nome}</div>
              <div className="text-xs muted">{c.id}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function installExerciseBridge(studentId){
  if(!studentId)return;
  window.__fsExerciseStudentId=studentId;
  window.saveExerciseProgress=async(path,payload)=>{
    const resolved=String(path||"").replace("{studentId}",studentId);
    const parts=resolved.split("/").filter(Boolean);
    // students/{id}/exercises/{lessonId}
    if(parts[0]==="students"&&parts[2]==="exercises"&&parts[3]){
      await db.collection("students").doc(parts[1]).collection("exercises").doc(parts[3]).set(payload||{},{merge:true});
      return;
    }
    // fallback: last segment as doc id under exercises
    const lessonId=parts[parts.length-1];
    await db.collection("students").doc(studentId).collection("exercises").doc(lessonId).set(payload||{},{merge:true});
  };
  window.loadExerciseProgress=async(path)=>{
    const resolved=String(path||"").replace("{studentId}",studentId);
    const parts=resolved.split("/").filter(Boolean);
    let sid=studentId, lessonId=parts[parts.length-1];
    if(parts[0]==="students"&&parts[2]==="exercises"){sid=parts[1];lessonId=parts[3];}
    const snap=await db.collection("students").doc(sid).collection("exercises").doc(lessonId).get();
    return snap.exists?snap.data():null;
  };
}

if(typeof window!=="undefined"&&!window.__fsExerciseMsgHook){
  window.__fsExerciseMsgHook=true;
  window.addEventListener("message",async(ev)=>{
    const data=ev&&ev.data;
    if(!data||data.type!=="fluency:exercise-progress")return;
    const sid=window.__fsExerciseStudentId;
    if(!sid||typeof window.saveExerciseProgress!=="function")return;
    try{await window.saveExerciseProgress(data.path,data.payload);}catch(e){console.warn("exercise progress bridge",e);}
  });
}
