/* ── AGENDA DO ALUNO + REPOSIÇÕES (FullCalendar) ── */
const REPO_STATUS={PENDENTE:"PENDENTE",AGENDADO:"AGENDADO",REPOSICAO_FEITA:"REPOSICAO_FEITA"};
const PROF_WORKING_DAYS=["seg","ter","qua","qui","sex"];
const PROF_WORKING_HOURS=["08:00","09:00","10:00","11:00","14:00","15:00","16:00","17:00","18:00","19:00"];

function diaryGrantsReposicao(entry){
  const st=normalizeDiarioStatus(entry);
  return st==="falta_aluno_com_reposicao"||st==="ausencia_com_reposicao"||st==="falta_professor"||st==="a_repor";
}
function diaryReposicaoTipoLabel(entry){
  const st=normalizeDiarioStatus(entry);
  if(st==="falta_professor"||entry.reposicaoMotivo==="professor")return"Falta do professor";
  return"Falta do aluno";
}
function diaryReposicaoValidUntil(entry){
  const st=normalizeDiarioStatus(entry);
  if(st==="falta_professor")return null; // sem limite
  if(entry.reposicaoVence)return entry.reposicaoVence;
  if(!entry.date)return null;
  return addDaysISO(entry.date,30);
}
function isReposicaoVencida(entry,todayISO){
  const st=normalizeDiarioStatus(entry);
  if(st==="falta_professor")return false;
  if((entry.reposicaoStatus||REPO_STATUS.PENDENTE)===REPO_STATUS.REPOSICAO_FEITA)return false;
  if((entry.reposicaoStatus||"")===REPO_STATUS.AGENDADO)return false;
  const until=diaryReposicaoValidUntil(entry);
  return !!(until&&todayISO>until);
}
function isReposicaoAFazer(entry,todayISO){
  if(!diaryGrantsReposicao(entry))return false;
  const rs=entry.reposicaoStatus||REPO_STATUS.PENDENTE;
  if(rs===REPO_STATUS.REPOSICAO_FEITA)return false;
  if(rs===REPO_STATUS.AGENDADO)return true; // ainda conta até ser feita? Spec: a fazer decrements when FEITA. AGENDADO still "a fazer" scheduled.
  return !isReposicaoVencida(entry,todayISO);
}
function computeReposicaoCounters(diarioEntries,todayISO){
  const today=todayISO||new Date().toISOString().slice(0,10);
  let aFazer=0,vencidas=0,agendadas=0;
  (diarioEntries||[]).forEach(e=>{
    if(!diaryGrantsReposicao(e))return;
    const rs=e.reposicaoStatus||REPO_STATUS.PENDENTE;
    if(rs===REPO_STATUS.REPOSICAO_FEITA)return;
    if(rs===REPO_STATUS.AGENDADO){agendadas++;aFazer++;return;}
    if(isReposicaoVencida(e,today))vencidas++;
    else aFazer++;
  });
  return{aFazer,vencidas,agendadas};
}
async function syncStudentReposicaoCounters(uid,diarioEntries){
  const c=computeReposicaoCounters(diarioEntries);
  try{
    await db.collection("students").doc(uid).set({
      reposicoesAFazer:c.aFazer,
      reposicoesVencidas:c.vencidas,
      reposicoesAgendadas:c.agendadas,
      reposicoesUpdatedAt:firebase.firestore.FieldValue.serverTimestamp(),
    },{merge:true});
  }catch(e){console.warn("sync reposicao counters",e);}
  return c;
}
function nextPaymentInfo(financeiro){
  const parcelas=financeiro?.parcelas||[];
  const snap=typeof resolveFinanceSnapshot==="function"?resolveFinanceSnapshot(parcelas):{};
  const today=getTodayISO();
  const open=(parcelas||[]).filter(p=>getEffectiveParcelStatus(p,today)!=="paga").sort((a,b)=>(a.dataVencimento||"").localeCompare(b.dataVencimento||""));
  const next=open[0]||null;
  if(!next||!next.dataVencimento)return{date:null,status:"sem_vencimento",label:"Sem vencimento cadastrado",days:null};
  const due=next.dataVencimento;
  const eff=getEffectiveParcelStatus(next,today);
  if(eff==="vencida"||due<today)return{date:due,status:"atrasado",label:"Atrasado",days:Math.round((new Date(today+"T12:00:00")-new Date(due+"T12:00:00"))/86400000)};
  const days=Math.round((new Date(due+"T12:00:00")-new Date(today+"T12:00:00"))/86400000);
  if(days===0)return{date:due,status:"hoje",label:"Vence hoje",days:0};
  if(days<=7)return{date:due,status:"proximo",label:"Vence em "+days+" dia(s)",days};
  return{date:due,status:"em_dia",label:"Em dia",days};
}
function findNextClassEvent(uid,schedule,trilhaData){
  const today=new Date().toISOString().slice(0,10);
  const arr=[{
    uid,name:"",status:"ativo",
    diasAulas:schedule?.diasAulas||[],horarioAulas:schedule?.horarioAulas||"",
    dataInicio:schedule?.dataInicio||"",trilha:trilhaData||{},calendarioCompleto:schedule?.calendarioCompleto||[],
  }];
  for(let i=0;i<6;i++){
    const mk=shiftMonthKey(getMonthKey(new Date()),i);
    const evs=buildAgendaEventsForMonth(arr,mk,{onlyUid:uid}).filter(e=>e.type==="aula"&&e.date>=today);
    if(evs.length)return evs.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||"").localeCompare(b.time||""))[0];
  }
  return null;
}
function lessonForCalendarDate(trilhaData,schedule,course,dateISO){
  const cal=(schedule?.calendarioCompleto||[]).find(c=>c.date===dateISO);
  if(cal?.lessonId){
    const books=mergeBooks(trilhaData||{},course);
    for(const b of books){const it=b.items.find(i=>i.id===cal.lessonId);if(it)return it;}
  }
  if(cal?.lessonNum){
    const id=lessonIdFromNum(cal.lessonNum,course);
    const books=mergeBooks(trilhaData||{},course);
    for(const b of books){const it=b.items.find(i=>i.id===id);if(it)return it;}
  }
  // fallback: next pending/atual lesson
  const books=mergeBooks(trilhaData||{},course);
  for(const b of books){
    const it=b.items.find(i=>i.status==="atual"||i.status==="andamento");
    if(it)return it;
  }
  return null;
}

function FullCalendarBox({events,onEventClick,selectable,onDateSelect,height}){
  const ref=useRef(null);
  const calRef=useRef(null);
  useEffect(()=>{
    if(!ref.current||typeof FullCalendar==="undefined")return;
    if(calRef.current){calRef.current.destroy();calRef.current=null;}
    calRef.current=new FullCalendar.Calendar(ref.current,{
      locale:"pt-br",
      initialView:"dayGridMonth",
      height:height||520,
      headerToolbar:{left:"prev,next today",center:"title",right:"dayGridMonth,timeGridWeek,listWeek"},
      buttonText:{today:"Hoje",month:"Mês",week:"Semana",list:"Lista"},
      navLinks:true,
      editable:false,
      selectable:!!selectable,
      selectMirror:true,
      dayMaxEvents:3,
      events:events||[],
      eventClick:(info)=>{
        info.jsEvent.preventDefault();
        onEventClick&&onEventClick(info.event);
      },
      select:(sel)=>{
        if(onDateSelect)onDateSelect(sel);
        calRef.current.unselect();
      },
      eventDidMount:(info)=>{
        if(info.event.extendedProps?.blocked){
          info.el.style.opacity=".45";
          info.el.style.pointerEvents="none";
        }
      }
    });
    calRef.current.render();
    return()=>{if(calRef.current){calRef.current.destroy();calRef.current=null;}};
  },[events,selectable,height]);
  if(typeof FullCalendar==="undefined"){
    return <div className="glass rounded-2xl p-6 text-center muted">FullCalendar não carregou. Verifique a conexão e recarregue a página.</div>;
  }
  return <div className="fc-host glass rounded-2xl p-3" ref={ref}/>;
}

function LessonQuickPanel({lesson,onClose,title}){
  if(!lesson)return null;
  const links=[
    {k:"linkAula",l:"Lição (HTML)"},
    {k:"linkMaterial",l:"PDF do aluno"},
    {k:"linkLivroDigital",l:"Livro digital"},
    {k:"linkTarefa",l:"Tarefa"},
    {k:"linkExtra",l:"Material do professor / Extra"},
    {k:"linkGravacao",l:"Aula gravada"},
  ].map(x=>({...x,href:resolvePortalAssetUrl(lesson[x.k]||(x.k==="linkMaterial"?lesson.link:""))})).filter(x=>x.href);
  return(
    <div className="tj-sheet" role="dialog" aria-modal="true" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="tj-sheet-panel" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
        <div className="tj-sheet-head">
          <div>
            <div style={{fontSize:11,opacity:.7,textTransform:"uppercase",letterSpacing:".08em"}}>{title||"Material da aula"}</div>
            <div style={{fontSize:18,fontWeight:800,fontFamily:"'Sora',sans-serif"}}>{lesson.title||("Lição "+getLessonDisplayLabel(lesson))}</div>
          </div>
          <button type="button" className="tj-sheet-close" onClick={onClose}><Icon name="x" size={18}/></button>
        </div>
        <div className="tj-sheet-body space-y-3">
          {lesson.tema?<div className="text-sm"><span className="muted">Tema:</span> {lesson.tema}</div>:null}
          {lesson.objetivos?<div className="text-sm"><span className="muted">Objetivos:</span> {lesson.objetivos}</div>:null}
          {links.length===0?<p className="text-sm muted">Nenhum material liberado ainda para esta lição.</p>:(
            <div className="grid gap-2">
              {links.map(l=><a key={l.k} className="btn btn-primary rounded-xl px-4 py-3 text-sm font-semibold text-center" href={l.href} target="_blank" rel="noreferrer">{l.l}</a>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScheduleReposicaoModal({uid,faltas,onClose,onDone}){
  const [step,setStep]=useState("pick"); // pick | slot | saving | done | error
  const [faltaselected,setFalta]=useState(null);
  const [slots,setSlots]=useState([]);
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const [picked,setPicked]=useState(null);

  useEffect(()=>{
    if(step!=="slot")return;
    let alive=true;
    (async()=>{
      setBusy(true);setErr("");
      try{
        let booked={};
        try{
          const bookedSnap=await db.collection("bookedSlots").get();
          bookedSnap.docs.forEach(d=>{booked[d.id]=d.data();});
        }catch(e){}
        try{
          const agenda=await db.collection("studio").doc("agenda").get();
          Object.assign(booked,(agenda.exists&&agenda.data().bookedSlots)||{});
        }catch(e){}
        const out=[];
        const today=new Date().toISOString().slice(0,10);
        for(let d=1;d<=45;d++){
          const iso=addDaysISO(today,d);
          if(typeof isStudioClosed==="function"&&isStudioClosed(iso))continue;
          const dow=JS_TO_DIA[new Date(iso+"T12:00:00").getDay()];
          if(!PROF_WORKING_DAYS.includes(dow))continue;
          PROF_WORKING_HOURS.forEach(h=>{
            const id=iso+"_"+h;
            if(booked[id])return;
            out.push({id,date:iso,time:h,label:formatDateBR(iso)+" · "+h});
          });
        }
        if(alive)setSlots(out.slice(0,80));
      }catch(e){if(alive)setErr("Não foi possível carregar horários vagos.");}
      finally{if(alive)setBusy(false);}
    })();
    return()=>{alive=false;};
  },[step]);

  async function confirm(){
    if(!faltaselected||!picked)return;
    setStep("saving");setErr("");
    const slotId=picked.id;
    const payload={
      studentUid:uid,
      type:"reposicao",
      date:picked.date,
      time:picked.time,
      diarioId:faltaselected.id,
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    };
    try{
      await db.runTransaction(async(tx)=>{
        const ref=db.collection("bookedSlots").doc(slotId);
        const snap=await tx.get(ref);
        if(snap.exists)throw new Error("Horário acabou de ser ocupado. Escolha outro.");
        tx.set(ref,payload);
        const dRef=db.collection("students").doc(uid).collection("diario").doc(faltaselected.id);
        tx.update(dRef,{
          reposicaoStatus:REPO_STATUS.AGENDADO,
          reposicaoAgendadaEm:picked.date,
          reposicaoHorario:picked.time,
          reposicaoSlotId:slotId,
        });
        const cRef=db.collection("students").doc(uid).collection("calendarEvents").doc("repo_"+faltaselected.id);
        tx.set(cRef,{
          type:"reposicao",
          date:picked.date,
          time:picked.time,
          diarioId:faltaselected.id,
          title:"Reposição",
          createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        },{merge:true});
      });
      try{
        await db.collection("studio").doc("agenda").set({bookedSlots:{[slotId]:payload}},{merge:true});
      }catch(e){}
      setStep("done");
      onDone&&onDone();
    }catch(e){
      setErr(e.message||"Falha ao agendar.");
      setStep("slot");
    }
  }

  return(
    <div className="tj-sheet" role="dialog" aria-modal="true" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="tj-sheet-panel" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
        <div className="tj-sheet-head">
          <div>
            <div style={{fontSize:11,opacity:.7,textTransform:"uppercase",letterSpacing:".08em"}}>Reposições</div>
            <div style={{fontSize:18,fontWeight:800,fontFamily:"'Sora',sans-serif"}}>Agendar Reposição</div>
          </div>
          <button type="button" className="tj-sheet-close" onClick={onClose}><Icon name="x" size={18}/></button>
        </div>
        <div className="tj-sheet-body space-y-3">
          {err&&<div className="err-box text-sm">{err}</div>}
          {step==="pick"&&(
            <>
              <p className="text-sm muted">Selecione a falta que deseja repor:</p>
              {faltas.length===0?<p className="text-sm">Nenhuma reposição pendente.</p>:faltas.map(f=>(
                <button key={f.id} type="button" className="glass rounded-xl px-4 py-3 w-full text-left" onClick={()=>{setFalta(f);setStep("slot");}}>
                  <div className="font-semibold text-sm">{formatDateBR(f.date)} · {diaryReposicaoTipoLabel(f)}</div>
                  <div className="text-xs muted">Aula {f.num}{f.licaoTitulo?(" · "+f.licaoTitulo):""}{diaryReposicaoValidUntil(f)?(" · válido até "+formatDateBR(diaryReposicaoValidUntil(f))):" · sem prazo"}</div>
                </button>
              ))}
            </>
          )}
          {step==="slot"&&(
            <>
              <button type="button" className="page-back" onClick={()=>setStep("pick")}><Icon name="arrow-left" size={14}/> Trocar falta</button>
              <p className="text-sm muted">Horários vagos do professor:</p>
              {busy&&<div className="text-sm muted">Carregando horários…</div>}
              {!busy&&slots.length===0&&<div className="text-sm muted">Nenhum horário vago nos próximos dias.</div>}
              <div className="space-y-2" style={{maxHeight:320,overflow:"auto"}}>
                {slots.map(s=>(
                  <button key={s.id} type="button" className={"rounded-xl px-3 py-2 w-full text-left text-sm "+(picked?.id===s.id?"btn-primary btn":"glass")} onClick={()=>setPicked(s)}>{s.label}</button>
                ))}
              </div>
              <button type="button" className="btn btn-primary rounded-xl px-4 py-3 w-full font-semibold" disabled={!picked} onClick={confirm}>Confirmar horário</button>
            </>
          )}
          {step==="saving"&&<div className="text-center py-8 muted">Agendando…</div>}
          {step==="done"&&(
            <div className="text-center space-y-3 py-4">
              <div className="text-lg font-bold" style={{color:"#14b8a6"}}>Reposição agendada!</div>
              <p className="text-sm muted">Status no diário: AGENDADO</p>
              <button type="button" className="btn btn-primary rounded-xl px-4 py-2" onClick={onClose}>Fechar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentReposicoesPage({uid,financeiro}){
  const [diario,setDiario]=useState(null);
  const [err,setErr]=useState("");
  const [showSched,setShowSched]=useState(false);
  const today=new Date().toISOString().slice(0,10);
  useEffect(()=>{
    const unsub=db.collection("students").doc(uid).collection("diario").orderBy("num","asc")
      .onSnapshot(snap=>{
        const entries=snap.docs.map(d=>({id:d.id,...d.data()}));
        setDiario(entries);
        syncStudentReposicaoCounters(uid,entries);
      },e=>setErr(e.message||"Erro ao carregar reposições"));
    return()=>unsub();
  },[uid]);
  if(err)return <div className="err-box">{err}</div>;
  if(!diario)return <div className="glass rounded-2xl p-8 text-center muted">Carregando reposições…</div>;
  const pendentes=diario.filter(e=>diaryGrantsReposicao(e)&&(e.reposicaoStatus||REPO_STATUS.PENDENTE)===REPO_STATUS.PENDENTE&&!isReposicaoVencida(e,today));
  const agendadas=diario.filter(e=>(e.reposicaoStatus||"")===REPO_STATUS.AGENDADO);
  const vencidas=diario.filter(e=>diaryGrantsReposicao(e)&&isReposicaoVencida(e,today)&&(e.reposicaoStatus||REPO_STATUS.PENDENTE)!==REPO_STATUS.REPOSICAO_FEITA);
  const counters=computeReposicaoCounters(diario,today);

  return(
    <div className="space-y-4">
      <div className="grid gap-3" style={{gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))"}}>
        <div className="dash-stat-card"><div className="dash-stat-num" style={{color:"#0ea5e9"}}>{counters.aFazer}</div><div className="dash-stat-label">A fazer</div></div>
        <div className="dash-stat-card"><div className="dash-stat-num" style={{color:"#e5636b"}}>{counters.vencidas}</div><div className="dash-stat-label">Vencidas</div></div>
        <div className="dash-stat-card"><div className="dash-stat-num" style={{color:"#14b8a6"}}>{agendadas.length}</div><div className="dash-stat-label">Agendadas</div></div>
      </div>
      {pendentes.length>0&&(
        <button type="button" className="btn btn-primary rounded-xl px-4 py-3 w-full font-semibold" onClick={()=>setShowSched(true)}>Agendar Reposição</button>
      )}
      <div className="glass rounded-2xl p-4">
        <h4 className="font-bold text-sm mb-3">Reposições a fazer</h4>
        {pendentes.length===0?<p className="text-sm muted">Nenhuma reposição pendente.</p>:pendentes.map(f=>(
          <div key={f.id} className="rounded-xl px-3 py-2 mb-2" style={{border:"1px solid var(--divider)"}}>
            <div className="text-sm font-semibold">{formatDateBR(f.date)} · {diaryReposicaoTipoLabel(f)}</div>
            <div className="text-xs muted">Aula {f.num}{diaryReposicaoValidUntil(f)?(" · válido até "+formatDateBR(diaryReposicaoValidUntil(f))):" · sem prazo de validade"}</div>
          </div>
        ))}
      </div>
      {agendadas.length>0&&(
        <div className="glass rounded-2xl p-4">
          <h4 className="font-bold text-sm mb-3">Já agendadas</h4>
          {agendadas.map(f=>(
            <div key={f.id} className="text-sm mb-2">{formatDateBR(f.reposicaoAgendadaEm||f.date)} {f.reposicaoHorario||""} · status AGENDADO</div>
          ))}
        </div>
      )}
      <div className="glass rounded-2xl p-4">
        <h4 className="font-bold text-sm mb-3">Reposições vencidas</h4>
        {vencidas.length===0?<p className="text-sm muted">Nenhuma vencida.</p>:vencidas.map(f=>(
          <div key={f.id} className="text-sm mb-2 muted">{formatDateBR(f.date)} · {diaryReposicaoTipoLabel(f)} · venceu em {formatDateBR(diaryReposicaoValidUntil(f))}</div>
        ))}
      </div>
      {showSched&&<ScheduleReposicaoModal uid={uid} faltas={pendentes} onClose={()=>setShowSched(false)} onDone={()=>setShowSched(false)}/>}
    </div>
  );
}

function StudentAgendaPage({uid,profile,trilhaData,financeiro,schedule,onNavigate}){
  const courses=useCourses();
  const course=useMemo(()=>getCourseById(profile?.contrato),[courses,profile?.contrato]);
  const [diario,setDiario]=useState([]);
  const [calEvents,setCalEvents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");
  const [selectedLesson,setSelectedLesson]=useState(null);
  const [showSched,setShowSched]=useState(false);
  const today=new Date().toISOString().slice(0,10);

  useEffect(()=>{
    let alive=true;
    const u1=db.collection("students").doc(uid).collection("diario").orderBy("num","asc")
      .onSnapshot(snap=>{
        const entries=snap.docs.map(d=>({id:d.id,...d.data()}));
        if(!alive)return;
        setDiario(entries);
        syncStudentReposicaoCounters(uid,entries);
        // mark trilha ATUAL for today's class
        ensureTrilhaAtual(uid,trilhaData,schedule,course,entries).catch(()=>{});
      },e=>setErr(e.message||"Erro no diário"));
    const u2=db.collection("students").doc(uid).collection("calendarEvents")
      .onSnapshot(snap=>{
        if(!alive)return;
        setCalEvents(snap.docs.map(d=>({id:d.id,...d.data()})));
        setLoading(false);
      },()=>setLoading(false));
    return()=>{alive=false;u1();u2();};
  },[uid,trilhaData,schedule,course]);

  const counters=computeReposicaoCounters(diario,today);
  const pay=nextPaymentInfo(financeiro);
  const nextCls=findNextClassEvent(uid,schedule,trilhaData);
  const pendentes=diario.filter(e=>diaryGrantsReposicao(e)&&(e.reposicaoStatus||REPO_STATUS.PENDENTE)===REPO_STATUS.PENDENTE&&!isReposicaoVencida(e,today));

  const fcEvents=useMemo(()=>{
    const out=[];
    const arr=[{
      uid,name:profile?.name||"Aluno",status:"ativo",
      diasAulas:schedule?.diasAulas||[],horarioAulas:schedule?.horarioAulas||"",
      dataInicio:schedule?.dataInicio||"",trilha:trilhaData||{},calendarioCompleto:schedule?.calendarioCompleto||[],
    }];
    // generate ~12 months of regular classes
    for(let i=0;i<12;i++){
      const mk=shiftMonthKey(getMonthKey(new Date()),i);
      buildAgendaEventsForMonth(arr,mk,{onlyUid:uid}).forEach(e=>{
        if(e.type==="aula"){
          out.push({
            id:"aula-"+e.date+"-"+(e.time||""),
            title:(e.time?e.time+" · ":"")+"Aula",
            start:e.time?`${e.date}T${(e.time||"09:00").slice(0,5)}:00`:`${e.date}`,
            allDay:!e.time,
            backgroundColor:"#0f766e",
            borderColor:"#0f766e",
            extendedProps:{kind:"aula",date:e.date,time:e.time||""}
          });
        }else if(e.type==="feriado"||e.type==="recesso"||e.type==="carnaval"){
          out.push({
            id:e.type+"-"+e.date+"-"+e.label,
            title:e.label||e.type,
            start:e.date,
            allDay:true,
            backgroundColor:"#64748b",
            borderColor:"#64748b",
            extendedProps:{kind:"blocked",blocked:true,date:e.date}
          });
        }
      });
    }
    calEvents.forEach(ev=>{
      if(ev.type==="reposicao"&&ev.date){
        out.push({
          id:"repo-"+ev.id,
          title:(ev.time?ev.time+" · ":"")+"Reposição",
          start:ev.time?`${ev.date}T${String(ev.time).slice(0,5)}:00`:ev.date,
          allDay:!ev.time,
          backgroundColor:"#7c3aed",
          borderColor:"#7c3aed",
          extendedProps:{kind:"reposicao",date:ev.date,time:ev.time||"",diarioId:ev.diarioId}
        });
      }
    });
    if(pay.date){
      out.push({
        id:"pay-"+pay.date,
        title:"Vencimento",
        start:pay.date,
        allDay:true,
        backgroundColor:"#b45309",
        borderColor:"#b45309",
        extendedProps:{kind:"vencimento",date:pay.date}
      });
    }
    return out;
  },[uid,profile,schedule,trilhaData,calEvents,pay.date]);

  function onEventClick(ev){
    const xp=ev.extendedProps||{};
    if(xp.blocked||xp.kind==="vencimento")return;
    const lesson=lessonForCalendarDate(trilhaData,schedule,course,xp.date||(ev.startStr||"").slice(0,10));
    setSelectedLesson(lesson||{title:ev.title,tema:"",objetivos:""});
  }

  return(
    <div className="space-y-4">
      {err&&<div className="err-box">{err}</div>}
      <div className="grid gap-3" style={{gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))"}}>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs muted uppercase tracking-wide">Próxima aula</div>
          <div className="font-bold text-sm mt-1">{nextCls?`${formatDateBR(nextCls.date)}${nextCls.time?(" · "+nextCls.time):""}`:"—"}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs muted uppercase tracking-wide">Pagamento</div>
          <div className="font-bold text-sm mt-1">{pay.date?formatDateBR(pay.date):"—"}</div>
          <div className="text-xs mt-1" style={{color:pay.status==="atrasado"?"#e5636b":pay.status==="proximo"?"#f59e0b":"#14b8a6"}}>{pay.label}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs muted uppercase tracking-wide">Reposições a fazer</div>
          <div className="font-bold text-xl mt-1" style={{color:"#0ea5e9"}}>{counters.aFazer}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs muted uppercase tracking-wide">Reposições vencidas</div>
          <div className="font-bold text-xl mt-1" style={{color:"#e5636b"}}>{counters.vencidas}</div>
        </div>
      </div>
      {pendentes.length>0&&(
        <button type="button" className="btn btn-primary rounded-xl px-4 py-3 font-semibold" onClick={()=>setShowSched(true)}>Agendar Reposição</button>
      )}
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn rounded-xl px-3 py-2 text-sm" onClick={()=>onNavigate&&onNavigate("reposicoes")}>Ver área de Reposições</button>
      </div>
      {loading?<div className="glass rounded-2xl p-8 text-center muted">Carregando calendário…</div>:<FullCalendarBox events={fcEvents} onEventClick={onEventClick}/>}
      {selectedLesson&&<LessonQuickPanel lesson={selectedLesson} onClose={()=>setSelectedLesson(null)}/>}
      {showSched&&<ScheduleReposicaoModal uid={uid} faltas={pendentes} onClose={()=>setShowSched(false)} onDone={()=>setShowSched(false)}/>}
    </div>
  );
}

async function ensureTrilhaAtual(uid,trilhaData,schedule,course,diarioEntries){
  const today=new Date().toISOString().slice(0,10);
  const lesson=lessonForCalendarDate(trilhaData,schedule,course,today);
  if(!lesson||!lesson.id)return;
  if(lesson.status==="concluida"||lesson.status==="realizada"||lesson.status==="atual")return;
  // only promote if there is a class today for this student
  const hasClassToday=(schedule?.calendarioCompleto||[]).some(c=>c.date===today)
    || ((schedule?.diasAulas||[]).includes(JS_TO_DIA[new Date(today+"T12:00:00").getDay()]));
  if(!hasClassToday)return;
  const patch={};patch[`trilha.${lesson.id}.status`]="atual";
  await db.collection("students").doc(uid).update(patch);
}

function PresenceConfirmPage({uid,profile,schedule,trilhaData,financeiro,onDone}){
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);
  const courses=useCourses();
  const c=useMemo(()=>getCourseById(profile?.contrato),[courses,profile?.contrato]);
  const today=getTodayISO();
  const horario=(schedule?.horarioAulas||"09:00").slice(0,5);
  async function confirm(present){
    setBusy(true);setMsg("");
    try{
      if(present){
        await db.collection("students").doc(uid).collection("notifications").add({
          type:"presence_confirm",title:"Presença confirmada",message:"Você confirmou presença na aula de hoje.",read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp(),date:today
        });
        setMsg("Presença confirmada. Bom estudo!");
        onDone&&onDone(true);
        return;
      }
      // AUSENTE
      const [hh,mm]=(horario||"09:00").split(":").map(Number);
      const classAt=new Date(today+"T"+String(hh||9).padStart(2,"0")+":"+String(mm||0).padStart(2,"0")+":00");
      const hoursAhead=(classAt-new Date())/3600000;
      const diarioSnap=await db.collection("students").doc(uid).collection("diario").get();
      const entries=diarioSnap.docs.map(d=>({id:d.id,...d.data()}));
      const counters=computeReposicaoCounters(entries,today);
      // gratuitas: count how many falta_aluno_com_reposicao not vencida + contract limit if any
      const limit=Number(profile?.reposicoesGratuitasContrato??financeiro?.reposicoesGratuitas??3);
      const used=entries.filter(e=>normalizeDiarioStatus(e)==="falta_aluno_com_reposicao"||normalizeDiarioStatus(e)==="ausencia_com_reposicao").length;
      const hasGratis=used<limit;
      const okTime=hoursAhead>=3;
      let grant=okTime&&hasGratis;
      let reason="";
      if(!okTime)reason="menos de 3h de antecedência";
      else if(!hasGratis)reason="esgotou as gratuitas do contrato";

      const nextNum=entries.length?Math.max(...entries.map(e=>e.num||0))+1:1;
      const lesson=lessonForCalendarDate(trilhaData,schedule,c,today);
      const entry={
        num:nextNum,
        date:today,
        licaoNum:lesson?.num||null,
        licaoId:lesson?.id||"",
        licaoTitulo:lesson?.title||"",
        status:grant?"falta_aluno_com_reposicao":"falta_aluno_sem_reposicao",
        reposicaoTipo:grant?"com":"sem",
        reposicaoStatus:grant?REPO_STATUS.PENDENTE:"",
        reposicaoVence:grant?addDaysISO(today,30):"",
        ocorrido:grant?"Ausência com direito a reposição (auto)":("Ausência sem reposição. Motivo: "+reason),
        obs:"Confirmado pelo aluno via portal",
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        source:"presence_confirm",
      };
      await db.collection("students").doc(uid).collection("diario").add(entry);
      await db.collection("students").doc(uid).collection("notifications").add({
        type:"presence_absent",title:"Ausência registrada",message:grant?"Direito a reposição gerado.":("Não há direito a reposição. Motivo: "+reason),read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp(),date:today
      });
      // notify admin
      try{
        await db.collection("studio").doc("adminNotifications").collection("items").add({
          type:"aluno_ausente",studentUid:uid,studentName:profile?.name||"",reason:grant?"com reposição":reason,date:today,createdAt:firebase.firestore.FieldValue.serverTimestamp(),read:false
        });
      }catch(e){}
      if(grant)setMsg("Ausência registrada. Direito a reposição liberado.");
      else setMsg("Não há direito a reposição. Motivo: "+reason);
      onDone&&onDone(false);
    }catch(e){setMsg("Erro: "+(e.message||e));}
    finally{setBusy(false);}
  }

  return(
    <div className="glass rounded-2xl p-6 space-y-4">
      <h3 className="text-xl font-bold" style={{fontFamily:"'Sora',sans-serif"}}>CONFIRME SUA AULA DE HOJE</h3>
      <p className="text-sm">Horário previsto: <strong>{horario}</strong></p>
      <div className="rounded-xl p-3 text-sm" style={{background:"rgba(245,158,11,.12)",border:"1px solid rgba(245,158,11,.35)"}}>
        Reposição somente liberada se for desmarcado até 3h de antecedência e se estiver dentro do número de reposições gratuitas do seu contrato.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn btn-primary rounded-2xl px-4 py-6 text-base font-bold" disabled={busy} onClick={()=>confirm(true)}>CONFIRMAR PRESENÇA</button>
        <button type="button" className="btn rounded-2xl px-4 py-6 text-base font-bold" style={{background:"rgba(229,99,107,.15)",border:"1px solid rgba(229,99,107,.4)"}} disabled={busy} onClick={()=>confirm(false)}>AUSENTE</button>
      </div>
      {msg&&<div className="text-sm font-semibold">{msg}</div>}
    </div>
  );
}

function shouldShowPresenceConfirm(schedule){
  const today=getTodayISO();
  const hasClass=(schedule?.calendarioCompleto||[]).some(c=>c.date===today);
  if(hasClass)return true;
  const dias=schedule?.diasAulas||[];
  const dow=JS_TO_DIA[new Date(today+"T12:00:00").getDay()];
  return dias.includes(dow);
}
