# Check Pilot Web

Phiên bản web của công cụ theo dõi luồng chứng từ SAP B1 (TTVH ↔ KBMD).

## Kiến trúc

```
web check Pilot/
├── frontend/        # React + Vite + TailwindCSS
├── backend/         # FastAPI + Python
│   └── queries/     # Copy file query từ Check Pilot Tool vào đây
├── docker-compose.yml
└── .env.example
```

## Tính năng

| Màn hình | Mô tả |
|---|---|
| Luồng Bán (Tổng hợp) | PR→PO→SO→DO→AR→GRPO→AP (không có item) |
| Luồng Bán (Chi tiết Item) | Như trên nhưng theo từng dòng item |
| Luồng Trả (Tổng hợp) | Luồng trả hàng nội bộ |
| Luồng Trả (Chi tiết Item) | Luồng trả theo item |
| Nguồn Chứng Từ | Tra cứu PR/GRPO/AP/SO/AR là AUTO hay thủ công |
| GRPO Vượt PO | Kiểm soát GRPO nhập vượt số lượng PO |
| Cài Đặt | Quản lý kết nối SQL Server |

## Cài đặt nhanh (Docker)

### 1. Clone / Copy project
```bash
git clone <repo-url>
cd "web check Pilot"
```

### 2. Copy file query
```
Từ: Check Pilot Tool\
Vào: web check Pilot\backend\queries\

Các file cần copy:
- Query_Purchase_Sale_Combined.txt
- Query_Purchase_Sale_Combined_NoItem.txt
- Query_Return_Combined.txt
- Query_Return_Combined_NoItem.txt
- Query_Khac\Query_Monitor_GRPO_Vuot_PO_TTVH.txt → queries\Query_Monitor_GRPO_Vuot_PO_TTVH.txt
- Query_Khac\Query_Monitor_GRPO_Vuot_PO_KBMD.txt → queries\Query_Monitor_GRPO_Vuot_PO_KBMD.txt
```

### 3. Tạo file .env
```bash
cp .env.example .env
# Chỉnh sửa .env theo môi trường của bạn
```

### 4. Build và chạy
```bash
docker compose up -d --build
```

### 5. Truy cập
- Web: http://localhost (hoặc port trong .env)
- API docs: http://localhost/api/docs

### 6. Thêm kết nối SQL Server
Vào **Cài Đặt** trong menu → Thêm thông tin kết nối SQL Server (server, username, password).

## Phát triển local

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt

# Tạo file .env trong backend/
DATABASE_URL=postgresql://pilot:pilot123@localhost:5432/checkpilot
SECRET_KEY=dev-secret

uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

## GitHub

### Khởi tạo repo
```bash
cd "web check Pilot"
git init
git add .
git commit -m "Initial commit: Check Pilot Web"
git remote add origin https://github.com/your-org/check-pilot-web.git
git push -u origin main
```

> **Lưu ý bảo mật**: File `.env` và các file query (`.txt`) đã được thêm vào `.gitignore` để tránh lộ thông tin nhạy cảm. Không commit file `.env` hoặc `Account SQL.txt`.

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, TanStack Table |
| Backend | FastAPI, Python 3.12, pyodbc |
| Database | PostgreSQL 16 (lưu config kết nối + logs) |
| SAP | SQL Server → Linked Server hana_mc → SAP HANA |
| Deploy | Docker Compose, Nginx |
