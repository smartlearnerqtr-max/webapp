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

- Backend start command dang chay `seed-base`, nhung gio chi bootstrap admin va mon hoc co ban, khong tao demo teacher/student/parent nua.
- `ADMIN_EMAIL` va `ADMIN_PASSWORD` duoc doc tu env var de tao admin bootstrap.
- Health check backend dung `/api/v1/health`.

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
