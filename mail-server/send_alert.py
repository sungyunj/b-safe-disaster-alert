import json
import os
import smtplib
import time
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

import requests


# API_URL = "http://20.249.156.9/alerts"
# ➔ 렉 서버 자기 자신의 Flask API를 바라보도록 수정
API_URL = "http://127.0.0.1:80/status"
MAIL_FROM = "sender@example.com"
MAIL_TO = ["recipient1@example.com", "recipient2@example.com", "recipient3@example.com"]

CHECK_INTERVAL = 10
SENT_FILE = "/var/lib/bsafe-mail/random-alert-mail.sent"


def already_sent():
    return os.path.exists(SENT_FILE)


def is_disaster(data):
    level = str(data.get("alert_level", ""))

    # 현재 랜덤 API에서 사용하는 재난 단계
    return "주의보" in level or "경보" in level


def send_email(data):
    level = data.get("alert_level", "재난 특보")
    region = data.get("region", "부산광역시")
    message = data.get("message", "안전 안내를 확인하십시오.")
    raw_timestamp = str(data.get("timestamp", ""))

    try:
        utc_time = datetime.strptime(
            raw_timestamp.rstrip("Z")[:19],
            "%Y-%m-%dT%H:%M:%S"
        )

        kst_time = utc_time + timedelta(hours=9)
        timestamp = kst_time.strftime("%Y-%m-%d %H:%M:%S KST")

    except (TypeError, ValueError):
        timestamp = raw_timestamp or "-"
    served_by = data.get("served_by", "Unknown")

    mail = EmailMessage()
    mail["From"] = MAIL_FROM
    mail["To"] = ", ".join(MAIL_TO)
    mail["Subject"] = f"[B-SAFE 부산시 재난안전 시스템] {level}"

    original_json = json.dumps(
        data,
        ensure_ascii=False,
        indent=2
    )

    mail.set_content(
        f"""B-SAFE 부산시 재난안전 시스템입니다.

{region}에 {level}가 발령되었습니다.

■ 재난 정보
- 발생 지역: {region}
- 경보 단계: {level}
- 발생 시각: {timestamp}

■ 행동 요령
{message}

■ 시스템 정보
- API 주소: {API_URL}
- 응답 서버: {served_by}

■ API 원본 JSON
{original_json}

이 메일은 DCA 렉 서버의 B-SAFE 재난 알림 시스템에서
자동으로 1회 발송되었습니다.
"""
    )

    with smtplib.SMTP("127.0.0.1", 25, timeout=10) as smtp:
        smtp.send_message(mail)


def save_sent_record(data):
    record = {
        "mail_sent_at": datetime.now().isoformat(),
        "alert": data
    }

    temporary_file = SENT_FILE + ".tmp"

    with open(temporary_file, "w", encoding="utf-8") as file:
        json.dump(record, file, ensure_ascii=False, indent=2)

    os.replace(temporary_file, SENT_FILE)


def main():
    print("B-SAFE 랜덤 재난 감시 서비스를 시작합니다.")
    print(f"API 주소: {API_URL}")
    print(f"확인 간격: {CHECK_INTERVAL}초")

    # 계속 감시하도록 수정
    # if already_sent():
        # print("이미 메일을 발송했습니다.")
        # print(f"발송 기록: {SENT_FILE}")
        # return

    # 최근에 메일을 보냈던 재난 문구를 기억하는 변수
    last_sent_level = ""

    while True:
        try:
            response = requests.get(API_URL, timeout=5)
            response.raise_for_status()
            data = response.json()

            level = str(data.get("alert_level", "알 수 없음"))
            server = str(data.get("served_by", "Unknown"))

            print(f"조회 결과: {level} / {server}")

            # 1. 정상 상태이면 대기(특보 해제 시 기록 초기화)
            if not is_disaster(data):
                print("정상 상태이므로 메일을 보내지 않습니다.")
                # 다시 정상으로 돌아오면 이전 기록 리셋(추가)
                last_sent_level = ""
                time.sleep(CHECK_INTERVAL)
                continue

            # 2. 이미 같은 재난 특보로 메일을 보냈다면 스킵 (도배 방지)
            if level == last_sent_level:
                print(f"이미 '{level}' 상태로 메일을 발송했습니다. (상태 변경 대기 중)")
                time.sleep(CHECK_INTERVAL)
                continue
            
            # 3. 새로운 재난 특보가 감지되었을 때만 메일 발송!
            print(f"🚨 새로운 재난 감지: {level}")
            print("메일을 발송합니다.")

            send_email(data)
            save_sent_record(data)

            # 마지막으로 보낸 특보 저장 및 계속 감시
            last_sent_level = level
            print(f"재난 알림 메일 발송 완료! (수신자: {MAIL_TO})")
            print("다음 상태 변경을 계속 감시합니다...\n")

            time.sleep(CHECK_INTERVAL)

        except Exception as error:
            print(f"API 조회 또는 메일 발송 실패: {error}")
            print(f"{CHECK_INTERVAL}초 후 다시 시도합니다.")
            time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
