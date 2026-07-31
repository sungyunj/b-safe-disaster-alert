from flask import Flask, jsonify, request
from urllib.parse import unquote

app = Flask(__name__)

# 실시간 재난 상태 관리 (메모리 전역 변수)
current_alert = {
    "alert_level": "정상 (특보 없음)",
    "message": "현재 발효된 재난 특보가 없습니다."
}

@app.route("/")
def home():
    """헬스 체크 기본 라우트"""
    return "Rocky Linux API Success!"

@app.route("/status")
def status():
    """
    [원천 데이터 조회 API]
    Azure VM(FastAPI) 및 send_alert.py가 현재 재난 상태를 조회하는 엔드포인트
    """
    return jsonify({
        "server": "Rocky Linux",
        "status": "running",
        "region": "부산광역시",
        "alert_level": current_alert["alert_level"],
        "message": current_alert["message"]
    })

@app.route("/update", methods=["POST", "GET"])
def update_alert():
    """
    [재난 상태 변경/테스트 API]
    GET 쿼리 스트링 또는 POST JSON을 통해 재난 특보 단계 및 메시지를 동적으로 업데이트
    - URL 인코딩 문자열 처리를 위해 unquote 적용
    """
    global current_alert

    # GET 요청의 Query String 또는 POST 요청의 Body(JSON)에서 파라미터 수집
    req_json = request.get_json(silent=True) or {}
    level = request.args.get("level") or req_json.get("level")
    msg = request.args.get("msg") or req_json.get("msg")

    # 전달받은 파라미터가 존재할 경우 전역 변수 업데이트
    if level:
        current_alert["alert_level"] = unquote(level)
    if msg:
        current_alert["message"] = unquote(msg)

    return jsonify({
        "result": "success",
        "current_alert": current_alert
    })

if __name__ == "__main__":
    # 외부(Azure VM 및 렉 서버 내부 데몬) 접속 허용을 위해 0.0.0.0 바인딩
    app.run(host="0.0.0.0", port=10220)  # 서비스 포트(10220)에 맞게 설정
