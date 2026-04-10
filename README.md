# Ban hoc thong minh

Webapp/PWA ho tro hoc tap cho hoc sinh khuyet tat, backend Flask va frontend React/Vite.

## Vai tro he thong

- `admin`: chi tao va cap tai khoan giao vien
- `teacher`: quan ly ho so hoc sinh, lop hoc, bai hoc, assignment va tien do
- `student`: tu dang ky tai khoan, dang nhap, xem bai duoc giao va cap nhat tien do
- `parent`: tu dang ky tai khoan, dang nhap va xem dashboard cua con sau khi duoc lien ket

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

`seed-base` hien chi tao mon hoc co ban va 1 tai khoan `admin` bootstrap.
Mac dinh theo [.env.example](d:/webapp/backend/.env.example):

- `admin@example.com / admin123456`

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend local mac dinh: `http://localhost:5173`

Backend local mac dinh: `http://localhost:5000`

## Luong tai khoan moi

- Hoc sinh va phu huynh tu dang ky ngay tren man hinh auth cua frontend.
- Giao vien khong tu dang ky; admin dang nhap vao khu vuc `/admin` de cap tai khoan giao vien.
- Sau khi dang nhap, moi role duoc dua thang vao khu vuc rieng cua minh.

## Smoke test truoc deploy

```powershell
cd backend
.\.venv\Scripts\activate
python smoke_test.py
python persona_test.py
```

`smoke_test.py` test nhanh luong:

- admin tao teacher
- student va parent tu dang ky
- teacher tao class, lesson, activity, assignment
- student hoc bai va cap nhat tien do
- parent xem dashboard
- AI settings + AI chat bang mock response

`persona_test.py` mo phong:

- 1 admin
- 3 giao vien
- 10 hoc sinh
- 10 phu huynh

## Deploy len Render

Project da co san file [render.yaml](d:/webapp/render.yaml).

Luu y:

- Backend start command dang chay `python init_and_seed.py && gunicorn ...`.
- `ADMIN_EMAIL` va `ADMIN_PASSWORD` duoc doc tu env var de tao admin bootstrap.
- `DATABASE_URL` tren Render duoc noi thang toi Render Postgres, nen du lieu se duoc giu lai sau moi lan deploy.
- `SEED_PERSONA_DATA` da duoc tat trong `render.yaml` de tranh viec reset lai du lieu khong phai admin moi lan service khoi dong.
- `SEED_VISUAL_SUPPORT_DEMO=true` se tao 1 bo demo on dinh cho giao dien visual support neu database chua co.
- Health check backend dung `/api/v1/health`.

### Tai khoan demo visual support

Khi `SEED_VISUAL_SUPPORT_DEMO=true`, backend se dam bao co san:

- teacher: `visual.teacher.demo@example.com`
- student: `visual.student.demo@example.com`
- class: `Lop Truc Quan Demo`
- join password mac dinh: `VISUAL08`

Mat khau teacher/student duoc lay tu env var:

- `VISUAL_DEMO_TEACHER_PASSWORD`
- `VISUAL_DEMO_STUDENT_PASSWORD`

Neu khong set, backend se dung mat khau mac dinh trong code seed.

## Dua du lieu local hien tai len Render

Neu ban dang co du lieu that trong local SQLite tai [backend/instance/dev.db](d:/webapp/backend/instance/dev.db), Render se khong tu dong nhan du lieu do vi service tren Render dang dung Postgres rieng.

Co the dong bo nguyen trang local len database Render bang lenh:

```powershell
cd backend
.\.venv\Scripts\activate
$env:TARGET_DATABASE_URL="postgresql://<user>:<password>@<host>/<database>"
python sync_local_db.py
```

Script nay se:

- tao bang neu database dich chua co
- xoa du lieu hien co trong database dich
- copy toan bo du lieu tu `backend/instance/dev.db`
- reset lai sequence ID tren Postgres sau khi copy

Lay `External Database URL` trong dashboard database Render va gan vao `TARGET_DATABASE_URL` truoc khi chay.

## Seed demo bang tay

Neu can tao lai bo demo visual support o local hoac tren server:

```powershell
cd backend
flask --app run.py seed-visual-demo
```
