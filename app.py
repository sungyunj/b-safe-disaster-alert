import os
from datetime import datetime

import requests
# [추가] Request, HTMLResponse, Jinja2Templates Import (UI 렌더링용)
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

# [추가] 랜덤 데이터 테스트를 위한 random 모듈 Import
import random

app = FastAPI(
    title="B-SAFE Disaster Alert API",
    version="1.0"
)
# -------------------------------
# [추가] 1. Jinja2 템플릿 설정
# -------------------------------
# templates 폴더 안의 HTML 파일들을 불러오기 위한 설정
templates = Jinja2Templates(directory="templates")

# -------------------------------
# Rocky Linux API
# -------------------------------
ROCKY_API = "http://218.154.110.155:10220/status"

# VM 구분용 환경변수
SERVER_NAME = os.getenv("SERVER_NAME", "VM-A")


# 현재 시간
def current_time():
    return datetime.now().isoformat() + "Z"


# -------------------------------
# 기본 페이지 (UI 화면)
# -------------------------------
# 수정: templates/index.html UI 페이지 반환
@app.get("/", response_class=HTMLResponse)
def root(request: Request):
    # 브라우저 접속 시 templates/index.html UI 출력
    return templates.TemplateResponse(request=request, name="index.html")


# -------------------------------
# Health Check(Azure Load Balencer용)
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
    # [추가] 테스트용 랜덤 재난 특보 목록 정의
    mock_alerts = [
        {"level": "태풍 경보", "msg": "해안가와 하천 주변 접근을 피하십시오."},
        {"level": "호우 주의보", "msg": "산사태 우려 지역 주민은 안전에 유의하십시오."},
        {"level": "강풍 주의보", "msg": "간판 및 시설물 관리에 유의하시기 바랍니다."},
        {"level": "정상 (특보 없음)", "msg": "현재 발효된 재난 특보가 없습니다."}
    ]

    # [추가] 요청(새로고침)이 들어올 때마다 무작위로 하나 선택
    selected = random.choice(mock_alerts)

    # 렉 서버 연동 로직
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
        "alert_level": selected["level"],  # <-- 무작위 경보 단계
        "message": selected["msg"],        # <-- 무작위 메시지

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