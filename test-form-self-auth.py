#!/usr/bin/env python3
"""Testa escrita autenticada em cadastros_pendentes e students."""
import json
import time
import urllib.request
import urllib.error

API_KEY = "AIzaSyARQfoifySDycd37gXw4sofwPu7tHkiip0"
PROJECT = "fluency-studio-portal"
FS_BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"

ts = int(time.time())
TEST_EMAIL = f"teste.formself.{ts}@fluency-test.local"
TEST_PASS = "TesteFlow2026!"


def post_json(url, body, token=None, method="POST"):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, json.dumps(body).encode(), headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode()
            return (json.loads(body) if body else {}), r.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return json.loads(raw), e.code
        except Exception:
            return {"raw": raw}, e.code


def fs_value(v):
    if isinstance(v, str):
        return {"stringValue": v}
    if isinstance(v, dict):
        return {"mapValue": {"fields": {k: fs_value(v[k]) for k in v}}}
    return {"stringValue": str(v)}


def try_write(collection, token, label):
    body = {"fields": {"status": fs_value("pendente"), "email": fs_value(TEST_EMAIL), "nome": fs_value("Teste"), "cadastroOrigem": fs_value("test")}}
    url = f"{FS_BASE}/{collection}?key={API_KEY}"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    req = urllib.request.Request(url, json.dumps(body).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            res = json.loads(r.read().decode())
            doc_id = res.get("name", "").split("/")[-1]
            print(f"   {label}: OK — {collection}/{doc_id}")
            # delete
            del_req = urllib.request.Request(f"{FS_BASE}/{collection}/{doc_id}?key={API_KEY}", headers={"Authorization": f"Bearer {token}"}, method="DELETE")
            try:
                urllib.request.urlopen(del_req, timeout=15)
            except Exception:
                pass
            return True
    except urllib.error.HTTPError as e:
        print(f"   {label}: FALHOU HTTP {e.code} — {e.read().decode()[:200]}")
        return False


print("=== Teste com usuário autenticado ===\n")
print(f"Email: {TEST_EMAIL}\n")

print("1. Criar usuário Firebase Auth...")
auth_res, auth_status = post_json(
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}",
    {"email": TEST_EMAIL, "password": TEST_PASS, "returnSecureToken": True},
)
if auth_status != 200:
    print(f"   FALHOU ({auth_status}): {json.dumps(auth_res, ensure_ascii=False)[:300]}")
    raise SystemExit(1)

token = auth_res["idToken"]
uid = auth_res["localId"]
print(f"   OK — uid: {uid}")

print("\n2. Escrever coleções com token do aluno...")
ok_pend = try_write("cadastros_pendentes", token, "cadastros_pendentes")
ok_stu = try_write(f"students", token, "students (auto-id)")

# students with own uid
body = {"fields": {"name": fs_value("Teste"), "email": fs_value(TEST_EMAIL), "status": fs_value("pendente_aprovacao")}}
url = f"{FS_BASE}/students/{uid}?key={API_KEY}"
headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
req = urllib.request.Request(url, json.dumps(body).encode(), headers=headers, method="PATCH")
try:
    urllib.request.urlopen(req, timeout=30)
    print(f"   students/{uid}: OK (PATCH)")
    del_req = urllib.request.Request(f"{FS_BASE}/students/{uid}?key={API_KEY}", headers={"Authorization": f"Bearer {token}"}, method="DELETE")
    try:
        urllib.request.urlopen(del_req, timeout=15)
    except Exception:
        pass
    ok_own = True
except urllib.error.HTTPError as e:
    print(f"   students/{uid}: FALHOU HTTP {e.code}")
    ok_own = False

print("\n3. Limpar usuário Auth...")
post_json(
    f"https://identitytoolkit.googleapis.com/v1/accounts:delete?key={API_KEY}",
    {"idToken": token},
)

print("\n=== Resumo ===")
print(f"cadastros_pendentes (auth): {'OK' if ok_pend else 'BLOQUEADO'}")
print(f"students auto-id (auth):      {'OK' if ok_stu else 'BLOQUEADO'}")
print(f"students/{{uid}} (auth):       {'OK' if ok_own else 'BLOQUEADO'}")