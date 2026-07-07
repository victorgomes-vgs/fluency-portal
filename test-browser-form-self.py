#!/usr/bin/env python3
"""Preenche form-self no navegador com cadastro fictício."""
import json
import sys
import time
import urllib.request
import urllib.error
from playwright.sync_api import sync_playwright

import os
# Usa arquivo local se FORM_SELF_LOCAL=1 (para testar antes do deploy)
URL = os.environ.get("FORM_SELF_URL") or (
    "file:///C:/Projetos/fluency-portal/form-self.html"
    if os.environ.get("FORM_SELF_LOCAL") == "1"
    else "https://thefluency.studio/form-self.html"
)
TS = int(time.time())
EMAIL = f"maria.browser.{TS}@fluency-test.local"
PASS = "BrowserTest2026!"
NOME = "Maria Fernanda Browser Test"

API_KEY = "AIzaSyARQfoifySDycd37gXw4sofwPu7tHkiip0"
FS = f"https://firestore.googleapis.com/v1/projects/fluency-studio-portal/databases/(default)/documents"


def verify_firestore(email):
    """Busca aluno pendente via REST (query limitada — verifica por leitura após auth)."""
    # sign in to get uid
    body = json.dumps({"email": EMAIL, "password": PASS, "returnSecureToken": True}).encode()
    req = urllib.request.Request(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}",
        body, {"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read().decode())
        token, uid = data["idToken"], data["localId"]
        req2 = urllib.request.Request(
            f"{FS}/students/{uid}?key={API_KEY}",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(req2, timeout=20) as r2:
            doc = json.loads(r2.read().decode())
        status = doc.get("fields", {}).get("status", {}).get("stringValue", "")
        name = doc.get("fields", {}).get("name", {}).get("stringValue", "")
        return {"ok": status == "pendente_aprovacao", "uid": uid, "status": status, "name": name}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def run():
    shots = []
    errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(URL, wait_until="networkidle", timeout=60000)

        # Aguarda React renderizar
        page.wait_for_selector("text=Bem-vindo", timeout=30000)
        page.screenshot(path="C:/Projetos/fluency-portal/test-shot-0-welcome.png")
        shots.append("welcome")

        # Step 0
        page.get_by_role("button", name="Começar cadastro").click()
        page.wait_for_selector("text=Dados Pessoais", timeout=10000)

        # Step 1 — dados pessoais
        page.locator('input[placeholder="Nome completo"]').fill(NOME)
        page.locator('input[placeholder="seuemail@exemplo.com"]').fill(EMAIL)
        page.locator('input[placeholder="+55 11 9..."]').first.fill("+55 11 98765-4321")
        page.locator('input[placeholder="Mínimo 6 caracteres"]').fill(PASS)
        page.locator('input[placeholder="Repita a senha"]').fill(PASS)
        page.screenshot(path="C:/Projetos/fluency-portal/test-shot-1-dados.png")
        shots.append("dados")
        page.get_by_role("button", name="Perfil do Aluno").click()
        page.wait_for_selector("text=Faixa Etária", timeout=10000)

        # Step 2 — triagem
        page.locator(".triagem-option", has_text="25–34 anos").click()
        page.locator(".triagem-option", has_text="Ensino Superior Completo").click()
        page.locator(".triagem-option", has_text="CLT").click()
        page.locator(".day-pill", has_text="Não").click()
        page.locator(".triagem-option", has_text="Tecnologia").click()
        page.locator(".triagem-option", has_text="Melhorar minha confiança na comunicação").click()
        page.locator(".triagem-option", has_text="1–2 horas").click()
        page.get_by_text("1 ano", exact=True).click()
        page.locator('textarea[placeholder*="motivações"]').fill("Quero falar inglês com confiança no trabalho.")
        page.screenshot(path="C:/Projetos/fluency-portal/test-shot-3-perfil.png")
        shots.append("perfil")

        # Enviar
        page.locator(".form-footer .btn-primary").click()

        # Sucesso
        try:
            page.wait_for_selector("text=Cadastro enviado", timeout=25000)
            success = True
            page.screenshot(path="C:/Projetos/fluency-portal/test-shot-4-sucesso.png")
            shots.append("sucesso")
        except Exception as e:
            success = False
            err_text = page.locator(".err-box").inner_text() if page.locator(".err-box").count() else ""
            errors.append(f"Tela sucesso não apareceu: {e}. Erro na página: {err_text}")
            page.screenshot(path="C:/Projetos/fluency-portal/test-shot-4-erro.png")

        # iVi visível?
        ivi = page.locator(".ivictor-btn, .ivictor-panel").count() > 0
        browser.close()

    fs = verify_firestore(EMAIL) if success else {"ok": False, "skipped": True}

    print("=== Teste navegador form-self ===\n")
    print(f"URL: {URL}")
    print(f"Aluno fictício: {NOME}")
    print(f"Email: {EMAIL}")
    print(f"Senha: {PASS}\n")
    print(f"Passos UI: {', '.join(shots)}")
    print(f"iVi presente: {'sim' if ivi else 'não'}")
    print(f"Envio UI: {'OK' if success else 'FALHOU'}")
    if errors:
        for e in errors:
            print(f"  Erro: {e}")
    if fs.get("ok"):
        print(f"Firestore: OK — uid={fs['uid'][:12]}… status={fs['status']}")
    elif fs.get("error"):
        print(f"Firestore: {fs['error']}")
    else:
        print(f"Firestore: status={fs.get('status', '?')}")

    if success and fs.get("ok"):
        print("\nRESULTADO: PASS")
        return 0
    print("\nRESULTADO: FAIL")
    return 1


if __name__ == "__main__":
    sys.exit(run())