/* Compatibilidade do portal legado com o Supabase. */
(function(){
    const sb = window.supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON_KEY__, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    window.__sb = sb;

    function uuid(){ return (crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){const r=Math.random()*16|0;const v=c==="x"?r:(r&0x3|0x8);return v.toString(16);})); }
    function isFV(v,type){ return !!v && typeof v==="object" && v.__fv===type; }

    function resolveFieldValuesDeep(value){
      if(isFV(value,"serverTimestamp")) return new Date().toISOString();
      if(isFV(value,"delete")) return undefined;
      if(Array.isArray(value)) return value.map(resolveFieldValuesDeep);
      if(value && typeof value==="object"){
        const o={};
        Object.keys(value).forEach(function(k){
          const rv=resolveFieldValuesDeep(value[k]);
          if(rv!==undefined) o[k]=rv;
        });
        return o;
      }
      return value;
    }
    function deepMergeObjects(base, patch){
      if(patch===null || typeof patch!=="object" || Array.isArray(patch)) return resolveFieldValuesDeep(patch);
      const baseObj=(base && typeof base==="object" && !Array.isArray(base)) ? base : {};
      const out={...baseObj};
      Object.keys(patch).forEach(function(k){
        const v=patch[k];
        if(isFV(v,"delete")){ delete out[k]; return; }
        if(isFV(v,"serverTimestamp")){ out[k]=new Date().toISOString(); return; }
        if(v && typeof v==="object" && !Array.isArray(v) && baseObj[k] && typeof baseObj[k]==="object" && !Array.isArray(baseObj[k])){
          out[k]=deepMergeObjects(baseObj[k], v);
        }else{
          out[k]=resolveFieldValuesDeep(v);
        }
      });
      return out;
    }
    // Suporta chaves de caminho com ponto do Firestore, ex: "trilha.b1-l1.status"
    function setPath(obj, parts, value){
      let cur=obj;
      for(let i=0;i<parts.length-1;i++){
        const k=parts[i];
        if(cur[k]==null || typeof cur[k]!=="object") cur[k]={};
        cur=cur[k];
      }
      cur[parts[parts.length-1]]=value;
    }
    function deletePath(obj, parts){
      let cur=obj;
      for(let i=0;i<parts.length-1;i++){
        const k=parts[i];
        if(cur[k]==null || typeof cur[k]!=="object") return;
        cur=cur[k];
      }
      delete cur[parts[parts.length-1]];
    }
    function applyPatchToObject(base, patch){
      const out = base ? JSON.parse(JSON.stringify(base)) : {};
      Object.keys(patch).forEach(function(key){
        const val=patch[key];
        const parts=key.split(".");
        if(isFV(val,"delete")){ deletePath(out,parts); return; }
        const resolved = isFV(val,"serverTimestamp") ? new Date().toISOString() : resolveFieldValuesDeep(val);
        setPath(out,parts,resolved);
      });
      return out;
    }
    function pathColId(path){
      const parts=String(path).split("/").filter(Boolean);
      return { col: parts[parts.length-2]||parts[0]||"", id: parts[parts.length-1]||"" };
    }

    async function sbFetchRow(path){
      const {data,error}=await sb.from("docs").select("*").eq("path",path).maybeSingle();
      if(error) throw error;
      return data;
    }
    function shapeDocSnap(path,row){
      return {
        id: String(path).split("/").filter(Boolean).pop(),
        exists: !!row,
        data: function(){ return row ? JSON.parse(JSON.stringify(row.data||{})) : undefined; },
        ref: makeDocRef(path),
      };
    }
    async function sbGetDoc(path){ return shapeDocSnap(path, await sbFetchRow(path)); }
    async function sbSetDoc(path,data,opts){
      const {col,id}=pathColId(path);
      let finalData;
      if(opts && opts.merge){
        const existing=await sbFetchRow(path);
        finalData=deepMergeObjects(existing?existing.data:{}, data);
      }else{
        finalData=resolveFieldValuesDeep(data);
      }
      const {error}=await sb.from("docs").upsert({path,col,id,data:finalData,updated_at:new Date().toISOString()},{onConflict:"path"});
      if(error) throw error;
    }
    async function sbUpdateDoc(path,patch){
      const existing=await sbFetchRow(path);
      if(!existing) throw Object.assign(new Error("Documento nao existe: "+path),{code:"not-found"});
      const merged=applyPatchToObject(existing.data,patch);
      const {error}=await sb.from("docs").update({data:merged,updated_at:new Date().toISOString()}).eq("path",path);
      if(error) throw error;
    }
    async function sbDeleteDoc(path){
      const {error}=await sb.from("docs").delete().eq("path",path);
      if(error) throw error;
    }
    function readAtPath(obj, field){
      return String(field).split(".").reduce(function(o,k){return (o==null)?undefined:o[k];}, obj);
    }
    async function sbGetCollection(collPath, filters, orders, limitN){
      const depth = collPath.split("/").filter(Boolean).length + 1;
      const {data,error}=await sb.from("docs").select("*").like("path", collPath+"/%");
      if(error) throw error;
      let rows=(data||[]).filter(function(r){ return r.path.split("/").filter(Boolean).length===depth; });
      (filters||[]).forEach(function(f){
        rows=rows.filter(function(r){
          const v=readAtPath(r.data,f.field);
          switch(f.op){
            case "==": case "=": return v===f.val;
            case "!=": return v!==f.val;
            case "in": return Array.isArray(f.val)&&f.val.indexOf(v)!==-1;
            case ">=": return v>=f.val;
            case "<=": return v<=f.val;
            case ">": return v>f.val;
            case "<": return v<f.val;
            default: return true;
          }
        });
      });
      (orders||[]).forEach(function(o){
        rows=rows.slice().sort(function(a,b){
          const av=readAtPath(a.data,o.field), bv=readAtPath(b.data,o.field);
          if(av<bv) return o.dir==="desc"?1:-1;
          if(av>bv) return o.dir==="desc"?-1:1;
          return 0;
        });
      });
      if(limitN) rows=rows.slice(0,limitN);
      const docs=rows.map(function(r){ return shapeDocSnap(r.path,r); });
      return { empty: docs.length===0, docs: docs, forEach: function(cb){ docs.forEach(cb); } };
    }
    function sbSubscribeDoc(path,onNext,onErr){
      let stopped=false;
      function push(){ sbGetDoc(path).then(function(s){ if(!stopped) onNext(s); }).catch(function(e){ if(!stopped&&onErr) onErr(e); }); }
      push();
      const channel=sb.channel("doc:"+path+":"+uuid()).on("postgres_changes",{event:"*",schema:"public",table:"docs",filter:"path=eq."+path},push).subscribe();
      return function(){ stopped=true; sb.removeChannel(channel); };
    }
    function sbSubscribeCollection(collPath,onNext,onErr,filters,orders,limitN){
      let stopped=false;
      function push(){ sbGetCollection(collPath,filters,orders,limitN).then(function(s){ if(!stopped) onNext(s); }).catch(function(e){ if(!stopped&&onErr) onErr(e); }); }
      push();
      const channel=sb.channel("coll:"+collPath+":"+uuid()).on("postgres_changes",{event:"*",schema:"public",table:"docs"},function(payload){
        const p=(payload.new&&payload.new.path)||(payload.old&&payload.old.path)||"";
        if(p.indexOf(collPath+"/")===0) push();
      }).subscribe();
      return function(){ stopped=true; sb.removeChannel(channel); };
    }

    function makeDocRef(path){
      return {
        id: String(path).split("/").filter(Boolean).pop(),
        path: path,
        collection: function(sub){ return makeCollRef(path+"/"+sub); },
        get: function(){ return sbGetDoc(path); },
        set: function(data,opts){ return sbSetDoc(path,data,opts); },
        update: function(patch){ return sbUpdateDoc(path,patch); },
        delete: function(){ return sbDeleteDoc(path); },
        onSnapshot: function(onNext,onErr){ return sbSubscribeDoc(path,onNext,onErr); },
      };
    }
    function makeQuery(collPath, filters, orders, limitN){
      return {
        where: function(field,op,val){ return makeQuery(collPath,filters.concat([{field:field,op:op,val:val}]),orders,limitN); },
        orderBy: function(field,dir){ return makeQuery(collPath,filters,orders.concat([{field:field,dir:dir||"asc"}]),limitN); },
        limit: function(n){ return makeQuery(collPath,filters,orders,n); },
        get: function(){ return sbGetCollection(collPath,filters,orders,limitN); },
        onSnapshot: function(onNext,onErr){ return sbSubscribeCollection(collPath,onNext,onErr,filters,orders,limitN); },
      };
    }
    function makeCollRef(path){
      const q=makeQuery(path,[],[],null);
      return {
        path: path,
        doc: function(id){ return makeDocRef(path+"/"+(id!=null?String(id):uuid())); },
        add: async function(data){ const id=uuid(); await sbSetDoc(path+"/"+id,data,{merge:false}); return makeDocRef(path+"/"+id); },
        where: q.where, orderBy: q.orderBy, limit: q.limit, get: q.get, onSnapshot: q.onSnapshot,
      };
    }
    function makeBatch(){
      const ops=[];
      return {
        set: function(ref,data,opts){ ops.push({type:"set",ref:ref,data:data,opts:opts}); },
        update: function(ref,patch){ ops.push({type:"update",ref:ref,patch:patch}); },
        delete: function(ref){ ops.push({type:"delete",ref:ref}); },
        commit: async function(){
          for(const op of ops){
            if(op.type==="set") await sbSetDoc(op.ref.path,op.data,op.opts);
            else if(op.type==="update") await sbUpdateDoc(op.ref.path,op.patch);
            else if(op.type==="delete") await sbDeleteDoc(op.ref.path);
          }
        },
      };
    }
    async function runTransaction(fn){
      const ops=[];
      const tx={
        get: function(ref){ return sbGetDoc(ref.path); },
        set: function(ref,data,opts){ ops.push({type:"set",ref:ref,data:data,opts:opts}); },
        update: function(ref,patch){ ops.push({type:"update",ref:ref,patch:patch}); },
        delete: function(ref){ ops.push({type:"delete",ref:ref}); },
      };
      const result=await fn(tx);
      for(const op of ops){
        if(op.type==="set"){
          if(op.opts && op.opts.merge){
            await sbSetDoc(op.ref.path,op.data,op.opts);
          }else{
            // Insert puro (nao upsert): se a linha ja existir, o banco recusa por
            // violar a chave primaria -- e assim que travamos horario duplicado de verdade.
            const {col,id}=pathColId(op.ref.path);
            const {error}=await sb.from("docs").insert({path:op.ref.path,col:col,id:id,data:resolveFieldValuesDeep(op.data)});
            if(error){
              if(String(error.code)==="23505") throw new Error("Horário acabou de ser ocupado. Escolha outro.");
              throw error;
            }
          }
        }else if(op.type==="update"){ await sbUpdateDoc(op.ref.path,op.patch); }
        else if(op.type==="delete"){ await sbDeleteDoc(op.ref.path); }
      }
      return result;
    }

    const db = { collection: function(name){ return makeCollRef(name); }, batch: makeBatch, runTransaction: runTransaction };

    // ── Auth shim ────────────────────────────────────────────────────────
    function shapeUser(u){ if(!u) return null; return { uid: u.id, email: u.email, emailVerified: !!u.email_confirmed_at }; }
    function mapAuthError(error){
      const msg=(error&&error.message||"").toLowerCase();
      let code="auth/unknown";
      if(msg.indexOf("invalid login credentials")!==-1) code="auth/invalid-credential";
      else if(msg.indexOf("email not confirmed")!==-1) code="auth/invalid-credential";
      else if(msg.indexOf("too many")!==-1 || (error&&error.status===429)) code="auth/too-many-requests";
      else if(msg.indexOf("network")!==-1 || msg.indexOf("fetch")!==-1) code="auth/network-request-failed";
      else if(msg.indexOf("not found")!==-1) code="auth/user-not-found";
      const e=new Error((error&&error.message)||"Erro de autenticacao");
      e.code=code;
      return e;
    }
    let _currentUser=null;
    sb.auth.getSession().then(function(r){ _currentUser=shapeUser(r&&r.data&&r.data.session&&r.data.session.user); }).catch(function(){});
    sb.auth.onAuthStateChange(function(event,session){ _currentUser=shapeUser(session&&session.user); });

    const auth = {
      get currentUser(){ return _currentUser; },
      onAuthStateChanged: function(cb,errCb){
        const sub=sb.auth.onAuthStateChange(function(event,session){
          _currentUser=shapeUser(session&&session.user);
          try{ cb(_currentUser); }catch(e){ if(errCb) errCb(e); }
        });
        return function(){ try{ sub.data.subscription.unsubscribe(); }catch(e){} };
      },
      signInWithEmailAndPassword: async function(email,password){
        const {data,error}=await sb.auth.signInWithPassword({email:email,password:password});
        if(error) throw mapAuthError(error);
        _currentUser=shapeUser(data.user);
        return { user: _currentUser };
      },
      createUserWithEmailAndPassword: async function(email,password){
        const {data,error}=await sb.auth.signUp({email:email,password:password});
        if(error){
          const msg=(error.message||"").toLowerCase();
          const e=new Error(error.message);
          e.code=(msg.indexOf("already")!==-1||msg.indexOf("registered")!==-1)?"auth/email-already-in-use":"auth/internal-error";
          throw e;
        }
        _currentUser=shapeUser(data.user);
        return { user: _currentUser };
      },
      sendPasswordResetEmail: async function(email){
        const {error}=await sb.auth.resetPasswordForEmail(email);
        if(error) throw mapAuthError(error);
      },
      signOut: async function(){ await sb.auth.signOut(); _currentUser=null; },
    };

    // ── Secondary auth (admin cria login de aluno sem se deslogar) ──────
    // No Firebase isso exigia um 2o "app" (criar usuario loga como ele).
    // No Supabase resolvemos com uma Edge Function que usa a service role
    // no servidor -- a sessao do admin no navegador nunca e tocada.
    const secondaryAuth = {
      createUserWithEmailAndPassword: async function(email,password){
        const {data:sessionData}=await sb.auth.getSession();
        const token=sessionData&&sessionData.session&&sessionData.session.access_token;
        const {data,error}=await sb.functions.invoke("admin-create-user",{
          body:{email:email,password:password},
          headers: token?{Authorization:"Bearer "+token}:undefined,
        });
        if(error){
          const e=new Error(error.message||"Erro ao criar login");
          e.code="auth/internal-error";
          throw e;
        }
        if(data && data.code==="email_exists"){
          const e=new Error("E-mail ja cadastrado");
          e.code="auth/email-already-in-use";
          throw e;
        }
        if(data && data.error){
          const e=new Error(data.error);
          e.code="auth/internal-error";
          throw e;
        }
        return { user: { uid: data.uid } };
      },
      signOut: async function(){ /* no-op: a Edge Function nao cria sessao no navegador */ },
    };

    // ── Compat global "firebase.*" (so o pouco que o app usa) ───────────
    window.firebase = {
      app: function(name){ return { auth: function(){ return name==="Secondary" ? secondaryAuth : auth; }, options:{} }; },
      initializeApp: function(){ return { auth: function(){ return auth; }, options:{} }; },
      firestore: {
        FieldValue: {
          serverTimestamp: function(){ return {__fv:"serverTimestamp"}; },
          delete: function(){ return {__fv:"delete"}; },
        },
      },
    };
    window.SupabaseCompat = { auth: auth, db: db };
  })();
