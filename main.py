from __future__ import annotations

import uvicorn
from api import create_app

app = create_app()

if __name__ == "__main__":
    # Bật tự động tải lại (auto-reload) khi phát triển ở local
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False, access_log=False, log_level="info")
