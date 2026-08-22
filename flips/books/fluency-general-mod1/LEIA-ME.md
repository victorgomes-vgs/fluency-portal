# Fluency General — Flipbook Módulo 1

Livro digital do **material do aluno** (input lessons 1–48), no viewer magazine 3D (`St.PageFlip`) usado no portal.

## Abrir

- Duplo clique em `index.html`, ou
- `abrir.bat`, ou
- `http://127.0.0.1:8766/index.html` (servidor local)

Query params: `?embed=1` (modo portal), `?lesson=31`, `?page=12`.

## Conteúdo

- **32 páginas**: capa + 30 lições input (a lição 07 tem 2 páginas)
- Fonte: PDFs modernos em `Estruta de conteúdos/public/materials/fluency-general/module-1/student/`
- Índice com busca, marcadores, zoom, atalhos ← → / I / B / F

## Rebuild

```bash
python _build/build_flipbook.py
python _build/generate_index.py
python _build/test_flipbook.py   # requer servidor em :8766
```

## Portal

Publicado em `fluency-portal` → `flips/books/fluency-general-mod1/`.

Alunos com contrato **`foundation_general`** (Fluency General, inclusive legado `fluency_foundation`) veem o flipbook em **Materiais**.
