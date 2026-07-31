import os
from datetime import datetime

import requests
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates


app = FastAPI(
    title="B-SAFE Disaster Alert API",
    version="1.0"
)

# 1. Jinja2 템플릿 설정 (index.html 연동용)
templates = Jinja2Templates(directory="templates")

# -------------------------------
# Rocky Linux API
# -------------------------------
ROCKY_API = "http://218.154.110.155:10220/status"

# VM 구분용 환경변수 (기본값: VM-A)
SERVER_NAME = os.getenv("SERVER_NAME", "VM-A")

# 현재 시간
def current_time():
    return datetime.now().isoformat() + "Z"


# -------------------------------
# 기본 페이지 (UI 화면 출력)
# -------------------------------
@app.get("/", response_class=HTMLResponse)
def root(request: Request):
    # 브라우저 접속 시 templates/index.html UI 출력
    return templates.TemplateResponse(request=request, name="index.html")


# -------------------------------
# Health Check (Azure Load Balancer용)
# -------------------------------
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "served_by": SERVER_NAME,
        "timestamp": current_time()
    }


# -------------------------------
# Disaster Alert API (JSON 데이터)
# -------------------------------
@app.get("/alerts")
def get_alerts():

    alert_level = "정상 (특보 없음)"
    message = "현재 발효된 재난 특보가 없습니다."

    # 렉 서버 API  연동 로직
    rocky_status = "Unknown"
    try:
        response = requests.get(ROCKY_API, timeout=2)

        if response.status_code == 200:
            res_json = response.json()
            rocky_status = res_json.get("status", "running")

            # 렉 서버가 넘겨준 진짜 재난 상태와 메시지로 교체
            alert_level = res_json.get("alert_level", alert_level)
            message = res_json.get("message", message)
        else:
            rocky_status = f"HTTP {response.status_code}"

    except Exception:
        rocky_status = "Disconnected"

    return {
        "region": "부산광역시",
        "alert_level": alert_level, # 렉 서버의 데이터
        "message": message, # 렉 서버의 데이터

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
        host="127.0.0.1",       # 외부 직접 접근 차단, 내부 루프백 (Nginx 역프록시용)
        port=8080,              # Nginx와 통신할 내부 포트
        reload=True
    )


#if __name__ == "__main__":
#    import uvicorn

    # [오늘 단독 VM 테스트용] 외부 접속을 받기 위해 host="0.0.0.0" 및 포트 지정
#    uvicorn.run(
#        "app:app",
#        host="0.0.0.0",
#        port=10220,
#        reload=True
#    )
