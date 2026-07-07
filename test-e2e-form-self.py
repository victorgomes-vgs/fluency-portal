#!/usr/bin/env python3
"""E2E: simula form-self (auth + students/{uid}) e leitura pendente."""
import json
import time
import urllib.request
import urllib.error

API_KEY = "AIzaSyARQfoifySDycd37gXw4sofwPu7tHkiip0"
PROJECT = "fluency-studio-portal"
FS = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"

ts = int(time.time())
EMAIL = f"e2e.formself.{ts}@fluency-test.local"
PASS = "E2eTest2026!"
NOME = "E2E Teste Form Self"


def req(method, url, body=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, json.dumps(body).encode() if body else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as res:
            raw = res.read().decode()
            return (json.loads(raw) if raw else {}), res.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode()), e.code


def fv(v):
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, str):
        return {"stringValue": v}
    if isinstance(v, dict):
        return {"mapValue": {"fields": {k: fv(v[k]) for k in v}}}
    return {"stringValue": str(v)}


print("=== E2E form-self flow ===\n")
ok = True

# 1 Auth
print("1. createUserWithEmailAndPassword (form-self)...")
auth, st = req("POST", f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}",
               {"email": EMAIL, "password": PASS, "returnSecureToken": True})
if st != 200:
    print(f"   FALHOU {st}: {auth}")
    raise SystemExit(1)
token, uid = auth["idToken"], auth["localId"]
print(f"   OK uid={uid}")

# 2 Write students/{uid} pendente_aprovacao
print("2. Salvar students/{uid} status=pendente_aprovacao...")
fields = {
    "name": fv(NOME), "email": fv(EMAIL), "status": fv("pendente_aprovacao"),
    "aguardandoLancamento": fv(True), "cadastroOrigem": fv("form-self"),
    "contrato": fv("fluency_foundation"), "dataInicio": fv("2026-08-01"),
    "valorFinal": fv("890"), "diaVencimento": fv("10"), "numParcelas": fv("18"),
    "triagem": fv({"objetivo": "Falar fluentemente em viagens"}),
    "phone": fv("+55 11 90000-0000"),
}
patch_url = f"{FS}/students/{uid}?key={API_KEY}"
_, st2 = req("PATCH", patch_url, {"fields": fields}, token)
if st2 != 200:
    print(f"   FALHOU {st2}")
    ok = False
else:
    print("   OK")

# 3 Read own doc
print("3. Aluno lê próprio perfil (portal login gate)...")
doc, st3 = req("GET", f"{FS}/students/{uid}?key={API_KEY}", token=token)
if st3 == 200:
    status = doc.get("fields", {}).get("status", {}).get("stringValue", "")
    print(f"   OK status={status}")
    if status != "pendente_aprovacao":
        print("   AVISO: status inesperado")
        ok = False
else:
    print(f"   FALHOU {st3}")
    ok = False

# 4 Simular admin update (PATCH mesmo token — rules podem bloquear status ativo)
print("4. Simular AUTORIZAR LANÇAR (update financeiro + ativo)...")
fields2 = {
    "status": fv("ativo"), "aguardandoLancamento": fv(False),
    "level": fv("A1"), "valorFinal": fv("890"),
}
_, st4 = req("PATCH", patch_url, {"fields": fields2}, token)
if st4 == 200:
    print("   OK — aluno pode atualizar (rules permissivas)")
elif st4 == 403:
    print("   ESPERADO 403 — só admin altera para ativo (correto em produção)")
else:
    print(f"   HTTP {st4}")

# Cleanup
print("\n5. Limpeza...")
req("POST", f"https://identitytoolkit.googleapis.com/v1/accounts:delete?key={API_KEY}", {"idToken": token})
try:
    del_r = urllib.request.Request(f"{FS}/students/{uid}?key={API_KEY}", method="DELETE")
    urllib.request.urlopen(del_r, timeout=15)
    print("   Doc removido")
except Exception as e:
    print(f"   Aviso cleanup doc: {e}")

print("\n=== RESULTADO ===")
if ok:
    print("PASS — form-self consegue gravar cadastro pendente em students/{uid}")
else:
    print("FAIL — verifique acima")
    raise SystemExit(1)