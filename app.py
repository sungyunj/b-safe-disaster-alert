import os
from datetime import datetime

import requests
from fastapi import FastAPI

app = FastAPI(
    title="B-SAFE Disaster Alert API",
    version="1.0"
)

# -------------------------------
# Rocky Linux API
# -------------------------------
ROCKY_API = "http://218.154.110.155:10220/status"

# VM 구분용 환경변수
SERVER_NAME = os.getenv("SERVER_NAME", "VM-A")


# 현재 시간
def current_time():
    return datetime.now().isoformat()


# -------------------------------
# 기본 페이지
# -------------------------------
@app.get("/")
def root():
    return {
        "service": "B-SAFE Disaster Alert API",
        "message": "Server is running.",
        "served_by": SERVER_NAME,
        "timestamp": current_time()
    }


# -------------------------------
# Health Check
# -------------------------------
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "served_by": SERVER_NAME,
        "timestamp": current_time()
    }


# -------------------------------
# Disaster Alert API
# -------------------------------
@app.get("/alerts")
def get_alerts():

    rocky_status = "Unknown"

    try:
        response = requests.get(ROCKY_API, timeout=2)

        if response.status_code == 200:
            rocky_status = response.json().get("status", "running")
        else:
            rocky_status = f"HTTP {response.status_code}"

    except Exception:
        rocky_status = "Disconnected"

    return {
        "region": "부산광역시",
        "alert_level": "태풍 경보",
        "message": "해안가와 하천 주변 접근을 피하십시오.",

        "rocky_api_status": rocky_status,

        "served_by": SERVER_NAME,
        "timestamp": current_time()
    }


# -------------------------------
# Local Test
# -------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="127.0.0.1",   # 외부 직접 접근 차단, 내부 루프백
        port=8080,          # Nginx와 통신할 내부 포트
        reload=True
    )

'''
# [오늘 단독 VM 테스트용] 외부 접속을 받기 위해 host="0.0.0.0" 및 포트 지정
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=10220,  # (또는 80)
        reload=True
    )
'''