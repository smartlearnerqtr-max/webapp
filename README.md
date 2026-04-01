# Ban hoc thong minh

Webapp/PWA ho tro hoc tap cho hoc sinh khuyet tat, co 3 vai tro `teacher`, `student`, `parent`, backend Flask va frontend React/Vite.

## Chuc nang MVP da co

- Dang nhap theo role.
- Giao vien tao hoc sinh, lop hoc, mon hoc, bai hoc, activity, assignment.
- Hoc sinh nhan bai, cap nhat tien do, hoan thanh bai hoc.
- Phu huynh xem dashboard con duoc lien ket.
- Gemini API key luu ma hoa o backend va co luong AI chat/test.
- Dashboard log ky thuat.
- Frontend build duoc thanh PWA dung tren desktop va Android.

## Demo account

- `teacher@example.com / 123456`
- `student@example.com / 123456`
- `parent@example.com / 123456`

## Chay local

### Backend

```powershell
cd backend
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
flask --app run.py seed-base
python run.py
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend local mac dinh: `http://localhost:5173`

Backend local mac dinh: `http://localhost:5000`

## Smoke test truoc deploy

```powershell
cd backend
.\.venv\Scripts\activate
python smoke_test.py
```

Script nay test nhanh cac luong chinh:

- auth teacher, student, parent
- class + subject + lesson + activity + assignment
- progress/readiness
- parent dashboard
- AI settings + AI chat bang mock response

## Deploy len Render

Project da duoc chuan bi san file [render.yaml](d:/webapp/render.yaml) de deploy bang Render Blueprint.

### 1. Day code len GitHub

Render se lay source tu repo GitHub/GitLab.

### 2. Tao Blueprint tren Render

- Vao Render Dashboard.
- Chon `New +` -> `Blueprint`.
- Chon repo cua du an.
- Render se doc `render.yaml` va tao 3 resource:
  - `ban-hoc-backend`
  - `ban-hoc-frontend`
  - `ban-hoc-db`

### 3. Bien moi truong da duoc setup san

Backend:

- `SECRET_KEY`: generate tu Render
- `JWT_SECRET_KEY`: generate tu Render
- `ENCRYPTION_SECRET`: generate tu Render
- `DATABASE_URL`: lay tu Render Postgres
- `CORS_ORIGINS`: lay tu URL frontend service
- `FLASK_ENV=production`

Frontend:

- `VITE_API_BASE_URL`: lay tu URL backend service

### 4. Luu y ky thuat quan trong

- Render Postgres thuong tra ve `postgresql://...`; backend da duoc sua de tu dong doi sang `postgresql+psycopg://...` trong [backend/app/config.py](d:/webapp/backend/app/config.py).
- Backend start command tren Render se chay `flask --app run.py init-db` truoc khi mo Gunicorn.
- Gunicorn la server production cho Render/Linux. Neu test truc tiep bang Gunicorn tren Windows local, ban co the gap loi `fcntl`; khi do hay dung `python run.py` de dev local hoac deploy tren Render/WSL de test production runtime.
- Frontend static site da co rule rewrite `/* -> /index.html` de React Router hoat dong dung.
- Health check backend dung `/api/v1/health`.

### 5. Seed demo sau deploy (tuy chon)

Neu muon kiem tra nhanh tren moi truong Render bang tai khoan demo, mo Render Shell cua backend va chay:

```powershell
flask --app run.py seed-base
```

### 6. Lenh build/start tren Render

Backend:

- Build: `pip install -r requirements.txt`
- Start: `flask --app run.py init-db && gunicorn run:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120`

Frontend:

- Build: `npm install && npm run build`
- Publish dir: `dist`

## Tai lieu tham khao chinh thuc

- Render Blueprint Spec: https://render.com/docs/blueprint-spec
- Render Python/Flask deployment docs: https://render.com/docs/deploy-flask
- Render Static Site docs: https://render.com/docs/static-sites
- Render default environment variables: https://render.com/docs/environment-variables#default-environment-variables
- Google Gemini text generation docs: https://ai.google.dev/gemini-api/docs/text-generation
