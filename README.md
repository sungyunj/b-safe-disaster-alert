# 🚨 B-SAFE : 고가용성(HA) 부산 재난 알림 서비스
> **Azure Load Balancer 및 Nginx, FastAPI, systemd 기반의 서버 장애 극복 및 고가용성 검증 프로젝트**

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=FastAPI&logoColor=white)](#)
[![Jinja2](https://img.shields.io/badge/Jinja2-B41717?style=flat-square&logo=jinja&logoColor=white)](#)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](#)
[![Nginx](https://img.shields.io/badge/Nginx-009639?style=flat-square&logo=NGINX&logoColor=white)](#)
[![Microsoft Azure](https://img.shields.io/badge/Azure_Load_Balancer-0089D6?style=flat-square&logo=microsoftazure&logoColor=white)](#)
[![Ubuntu](https://img.shields.io/badge/Ubuntu_22.04_LTS-E95420?style=flat-square&logo=ubuntu&logoColor=white)](#)
[![k6](https://img.shields.io/badge/k6-7D64FF?style=flat-square&logo=k6&logoColor=white)](#)

---

## 📌 1. 프로젝트 개요 (Overview)

* **핵심 질문**: *"태풍 경보 등 재난 상황에서 접속 요청이 급증하고, 일부 웹 서버나 애플리케이션 장애가 발생해도 재난 알림 서비스를 무중단으로 유지할 수 있는가?"*
* **목표**: Azure 인프라의 Load Balancer와 Linux 환경의 Nginx / FastAPI / systemd 자동 복구 메커니즘을 구축하고, k6 부하 테스트를 통해 장애 시 서비스 유지 능력 및 복구 시간을 정량 수치로 검증합니다.

---

## 🏗️ 2. 시스템 아키텍처 (Architecture)

```text
                                  [ 사용자 / k6 부하 테스트 ]
                                             │
                                             ▼
                              [ Azure Standard Load Balancer ]
                                     (대표 Public IP:80)
                                             │
                    ┌────────────────────────┴────────────────────────┐
                    │             (Health Probe: /health)             │ (Traffic 분산)
                    ▼                                                 ▼
          ┌───────────────────┐                             ┌───────────────────┐
          │ Azure VM-A (Linux)│                             │ Azure VM-B (Linux)│
          │                   │                             │                   │
          │  [Nginx] :80      │                             │  [Nginx] :80      │
          │      │            │                             │      │            │
          │      ▼ (Reverse)  │                             │      ▼ (Reverse)  │
          │  [FastAPI] :8080  │                             │  [FastAPI] :8080  │
          │   (bsafe.service) │                             │   (bsafe.service) │
          └─────────┬─────────┘                             └─────────┬─────────┘
                    │                                                 │
                    └────────────────────────┬────────────────────────┘
                                             │ (외부 상태 조회)
                                             ▼
                                 [ Rocky Linux 렉 서버 ]
                               (218.154.110.155:10220/status)
```

### 📂 2.1 디렉토리 및 파일 구조 (Directory & File Structure)

본 프로젝트는 GitHub 저장소(코드 및 문서 관리)와 DCA 렉 서버(부하 테스트 수행) 환경으로 구분되어 있습니다.

#### 1) 🐙 GitHub 저장소 구조 (Project Repository)
웹 백엔드 코드, Nginx/systemd 설정 파일, DCA 렉 서버 구동 컴포넌트(k6 부하 테스트 스크립트, 원천 API, 메일 데몬) 및 증빙 자료를 보관합니다.

```text
.
├── app.py                       # [FastAPI] 백엔드 재난 알림 API, Jinja2 템플릿 연동 및 Uvicorn 실행 (127.0.0.1:8080)
├── templates/                   # [UI] 프론트엔드 HTML 템플릿 디렉토리
│   └── index.html               # ➔ Jinja2 기반 재난 알림 실시간 웹 DashBoard UI (Tailwind CSS 적용)
├── rocky-server/                # [렉 서버] DCA 렉 서버(Rocky Linux) 전용 구동 컴포넌트 모음
│   ├── app.py                   # ➔ [Flask] 실시간 재난 상태 원천 API 서버 (포트 10220)
│   ├── mail-server/             # ➔ [Mail] 24시간 재난 감시 및 이메일 알림 데몬
│   │   ├── send_alert.py        #   - 재난 특보 자동 감지 및 메일 발송 스크립트
│   │   └── bsafe-alert-mail.service # - systemd 메일 데몬 자동 가동 서비스 설정 파일
│   └── tests/                   # ➔ [k6] 부하 및 장애 테스트 스크립트/결과 모음
│       ├── disaster-scenario.js #   - [메인] 재난 단계별(10->50->100 VU) 종합 장애 실험 스크립트
│       ├── load-test.js         #   - 표준 단계별 부하 테스트 및 정확한 서버 카운팅 스크립트
│       ├── level-test.js        #   - 특정 VU 수치 동적 지정 단독 테스트 스크립트
│       ├── test.js              #   - k6 환경 및 네트워크 기본 통신 점검용 스크립트
│       └── results/             #   - [결과] k6 부하/장애 테스트 및 CPU 과부하 실험 결과 파일 모음
├── config/                      # [설정] 서버 및 인프라 자동화 설정 파일 모음
│   ├── bsafe.nginx              # ➔ [Nginx] 80번 포트 Reverse Proxy 설정 파일
│   └── bsafe.service            # ➔ [systemd] FastAPI 자동 실행 및 장애 자동 복구 설정 파일
├── docs/                        # [문서] 프로젝트 아키텍처 및 화면 증빙 자료
│   └── images/                  # ➔ Azure NSG, Health Probe, UI 화면 캡처본 저장
└── README.md                    # [문서] 프로젝트 개요, 아키텍처 및 HA 장애 실험 결과 문서
```

#### 2) 🖥️ DCA 렉 서버 환경 구조 (Test Execution Node)
k6 부하 테스트 수행, 재난 원천 API 제공 및 24시간 이메일 알림 데몬이 동작하는 Rocky Linux 서버 실행 환경입니다.

```text
/root/
├── app.py                       # [Flask] 실시간 재난 상태 원천 API 서버 코드 (포트 10220)
├── bsafe-mail/                  # [Mail] 재난 특보 감시 및 이메일 알림 데몬 디렉토리
│   ├── send_alert.py            # ➔ 재난 특보 자동 감지 및 SMTP 메일 발송 스크립트
│   └── send_alert.log           # ➔ 메일 발송 및 감시 로그 기록 파일
├── bsafe-k6/                    # [k6] 부하 테스트 수행 및 결과 보관 디렉토리
│   ├── disaster-scenario.js     # ➔ [메인] 재난 단계별(10->50->100 VU) 종합 장애 실험 스크립트
│   ├── load-test.js             # ➔ 표준 단계별 부하 테스트 및 서버 카운팅 스크립트
│   ├── level-test.js            # ➔ 특정 VU 수치 동적 지정 단독 테스트 스크립트
│   ├── test.js                  # ➔ k6 설치 및 네트워크 기본 통신 점검용 스크립트
│   └── results/                 # ➔ k6 실행 결과 요약(summary.json) 및 로그 자동 저장 폴더
├── /etc/systemd/system/
│   ├── bsafe-api.service        # ➔ [systemd] Flask 원천 API 상시 가동 서비스
│   └── bsafe-alert-mail.service # ➔ [systemd] 메일 발송 데몬 상시 가동 서비스
├── anaconda-ks.cfg              # [시스템] Linux OS 설치 자동 설정 파일 (무시)
└── initial-setup-ks.cfg         # [시스템] Linux OS 초기 설정 기록 파일 (무시)
```

---
## ⚙️ 3. 인프라 보안 및 서비스 자동화 설정 (Configuration)

FastAPI 애플리케이션의 외부 직접 접근을 차단하고, 백그라운드 상시 실행 및 장애 발생 시 자동 복구(Auto-Recovery) 체계를 구축했습니다.

### 🏗️ Azure 인프라 및 네트워크 보안 구성 (Infrastructure & NSG)

시스템의 고가용성(HA)과 보안을 위해 Azure Standard Load Balancer와 NSG 포트 제어를 적용했습니다.

### 🔒 1) Network Security Group (NSG) 포트 정책
* **HTTP (80)**: Load Balancer 및 Nginx 외부 트래픽 허용
* **SSH (22)**: 서버 관리용 접속 허용
* **FastAPI (8080)**: 외부 직접 접근 전면 차단 (Nginx 역프록시를 통해서만 진입 가능)

### ⚖️ 2) Azure Standard Load Balancer & Health Probe
* **Backend Pool**: `vm-web-01` (`alert-server-a`), `vm-web-02` (`alert-server-b`) 등록
* **Health Probe**:
  * Protocol: `HTTP`
  * Port: `80`
  * Request Path: `/health` (FastAPI 헬스체크 API)
  * Interval: `5s` (5초마다 VM 상태 점검)
* **Load Balancing Rule**: 외부 Port 80 요청을 백엔드 VM 80번 포트로 균등 분산 (Session Persistence: None)

### 🔒 3) FastAPI 내부 바인딩 및 포트 차단 (`app.py`)
외부 인터넷에서 8080 포트로 직접 접근하는 것을 차단하고, Nginx를 통해서만 통신하도록 루프백(`127.0.0.1`) 바인딩을 적용했습니다.

```python
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="127.0.0.1",  # 외부 직접 접근 차단 (내부 루프백 전용)
        port=8080,        # Nginx Reverse Proxy 연동 포트
        reload=False
    )
```
### 🔄 4) Nginx Reverse Proxy 설정 (`/etc/nginx/sites-available/bsafe`)
외부에서 **80번 포트(HTTP)** 로 들어오는 요청을 내부에서 실행 중인 **FastAPI(127.0.0.1:8080)** 로 전달하도록 Nginx Reverse Proxy를 구성했습니다. 이를 통해 사용자는 80번 포트만 사용하고, FastAPI는 외부에 직접 노출되지 않도록 설정했습니다.

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass [http://127.0.0.1:8080](http://127.0.0.1:8080);
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
### 🤖 5) systemd 자동 실행 및 복구 데몬 등록 (`/etc/systemd/system/bsafe.service`)
FastAPI 서비스를 **systemd**에 등록하여 VM 서버가 부팅될 때 자동으로 실행되도록 설정했습니다. 또한 프로세스가 예기치 않게 종료될 경우 **3초 후 자동으로 재시작(`Restart=always`)** 하여 서비스의 가용성을 유지하도록 구성했습니다.

```ini
[Unit]
Description=BSAFE FastAPI Service
After=network.target

[Service]
User=azureuser
WorkingDirectory=/home/azureuser/project
Environment="SERVER_NAME=alert-server-a"  # VM-B는 alert-server-b로 설정
ExecStart=/usr/bin/python3 /home/azureuser/project/app.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```
### ✉️ 6) 렉 서버 메일 자동 발송 데몬 등록 (`/etc/systemd/system/bsafe-alert-mail.service`)
DCA 렉 서버(Rocky Linux)에서 Postfix 메일 서비스와 연동하여 24시간 재난 특보 감시 및 이메일 자동 발송을 수행하도록 했습니다. 프로세스 실패 시 **10초 후 자동으로 재시작(`Restart=on-failure`)** 되도록 설정하였습니다.

```ini
[Unit]
Description=B-SAFE One-Time Disaster Alert Mail
Wants=network-online.target
After=network-online.target postfix.service
Requires=postfix.service

[Service]
Type=simple
User=root
Environment=PYTHONUNBUFFERED=1
ExecStart=/usr/bin/python3 /root/bsafe-mail/send_alert.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

> 📸 **Azure 인프라 설정 증빙 문서**:
> * [Backend Pool 및 VM 연결 상태](docs/images/01_backend_pool.png)
> * [Health Probe (/health, 5초) 상세 설정](docs/images/02_health_probe.png)
> * [NSG 80, 22 허용 및 8080 차단 규칙](docs/images/03_nsg_rules.png)

---

## 🛠️ 4. API 엔드포인트 명세 (API Endpoints)

| Method | Endpoint | Response Type | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `text/html` | **[UI]** 사용자용 실시간 재난 알림 웹 대시보드 (`templates/index.html`) |
| `GET` | `/health` | `application/json` | Health Probe 및 Azure Load Balancer 상태 점검용 |
| `GET` | `/alerts` | `application/json` | 부산 재난 경보 실시간 동적 상태 데이터 API (새로고침 시 특보 무작위 변경) |

### 📄 `/alerts` 응답 예시 (동적 변경 반영)
```json
{
  "region": "부산광역시",
  "alert_level": "호우 주의보",
  "message": "산사태 우려 지역 주민은 안전에 유의하십시오.",
  "rocky_api_status": "running",
  "served_by": "alert-server-a",
  "timestamp": "2026-07-30T14:25:00.000000Z"
}
```
---

## 🎨 5. 웹 프론트엔드 Dashboard UI (Web UI)

사용자가 재난 상황 및 서버 가용성 상태를 한눈에 파악할 수 있도록 Jinja2 템플릿 엔진 및 Tailwind CSS 기반의 반응형 대시보드를 구축했습니다.

* **동적 UI 테마 변경**: `/alerts` API의 `alert_level` 응답값("경보", "주의보", "정상")에 따라 상단 헤더 색상 및 깜빡임 효과(`animate-pulse`)가 자동 전환됩니다.
* **실시간 비동기 처리**: 브라우저에서 `🔄 실시간 상태 새로고침` 버튼 클릭 시 `fetch()` API를 호출하여 화면 전체 리로드 없이 데이터를 즉시 갱신합니다.
* **KST 한국 시간 자동 변환**: 백엔드의 UTC 타임스탬프(`Z`)를 자바스크립트 `Intl.DateTimeFormat`을 이용해 사용자 브라우저 기준 한국 표준시(KST)로 자동 교정 및 출력합니다.

---

## 🧪 6. 장애 실험 시나리오 및 측정 지표 (HA Experiments)

부하 테스트 도구인 **k6**를 활용해 재난 단계별 트래픽을 주입하면서 3가지 장애 시나리오를 연출하고 지표를 정량 측정합니다.

### 🌪️ 재난 단계별 트래픽 시나리오 (동시 접속자 수, VU)
1. **평상시**: 10 VU (Virtual Users) (일반 재난 정보 조회)
2. **주의보**: 50 VU (호우·강풍 예보로 인한 트래픽 증가)
3. **재난 경보**: 100 VU (태풍 상륙 및 침수 발생 시 접속자 폭증)
4. **장애 발생**: 100 VU 피크 상태에서 인위적 장애 유발
   * **실험 1 (프로세스 장애)**: FastAPI 프로세스 강제 종료 (`kill -9`) ➔ systemd 자동 복구
   * **실험 2 (CPU 과부하)**: `stress-ng`를 이용한 CPU 100% 연출 ➔ 지연 시간 및 회복 측정
   * **실험 3 (VM 전체 장애)**: VM-A 전체 중단 ➔ Load Balancer의 VM-B로의 Failover 및 재합류

---

### 📊 정량적 검증 지표 표 (Results)

| 구분 | 측정 지표 | 목표 기준 | 실제 측정 결과 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **기본 성능** | **정상 요청 성공률 (10~100 VU)** | 100% | `100.00 %` | 정상 트래픽 구간 |
| | **평균 / P95 응답 속도** | P95 < 2000ms | `21.50 / 30.88 ms` | Latency 분석 |
| **실험 1<br>(Process)** | **systemd 복구 시간** | 3초 이내 | `6 초` | `pkill -f uvicorn` 후 자동 재시작 |
| | **프로세스 장애 구간 성공률** | 99% 이상 | `98.20 %` | 트래픽 유실 방어율 |
| **실험 2<br>(CPU)** | **CPU 과부하 전/중/후 P95 응답속도** | - | `34.49 / 7,169.97 / 1,041.47 ms` | `stress-ng --cpu 2` 실행 시 |
| | **CPU 과부하 종료 후 회복 시간** | - | `32 초` | CPU 부하 종료 후 고지연 응답이 마지막으로 관측될 때까지의 시간 |
| **실험 3<br>(VM Failover)**| **VM 전환 (Failover) 시간** | - | `약 13 초` | VM-A 중지 후 VM-B 정상 응답이 최초 확인되기까지의 시간 |
| | **VM 재합류 (Failback) 시간** | - | `1초 이내` | VM-A 재시작 기록 시점과 트래픽 재합류가 동일 초 단위에서 관측됨 |
| | **VM 장애 구간 성공률** | 99% 이상 | `96.75 %` | 트래픽 유실 방어율 |

---

## 📊 7. Azure Monitor 관측 지표 (Server Metrics)

k6 부하 테스트 및 장애 실험 진행 시 Azure Portal 지표(Metrics)를 통해 인프라 관점의 상태 변화를 추적했습니다.

| 관측 지표 | 캡처 이미지 예시 | 설명 |
| :--- | :--- | :--- |
| **VM CPU Percentage** | `![CPU](docs/images/azure_cpu.png)` | `stress-ng` 실행 시 CPU 100% 스파이크 관측 |
| **Health Probe Status** | `![Probe](docs/images/azure_probe.png)`| VM-A Down 시 Health Probe 실패 감지 관측 |
| **Network In/Out Total** | `![Network](docs/images/azure_network.png)`| 100 VU 피크 부하 유입 시 네트워크 트래픽 증가 |

---

## 📈 8. 재난 단계별 개별 부하 테스트 상세 결과

통합 테스트와 별도로 평상시·주의보·태풍 경보 상황을 각각 실행하여 VU 증가에 따른 처리량, 응답 지연 및 백엔드 VM 분산 상태를 확인했습니다.

### 성능 결과

| 단계 | VU | 총 요청 | 성공률 | 실패 | 평균 | P95 | 최대 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **평상시** | 10 | 590 | 100% | 0 | 31.15ms | 35.87ms | 56.71ms |
| **주의보** | 50 | 2,945 | 100% | 0 | 33.07ms | 37.83ms | 1.07s |
| **태풍 경보** | 100 | 5,843 | 100% | 0 | 34.44ms | 50.97ms | 1.11s |

### 서버별 요청 분산

| 단계 | VU | VM-A | VM-B | 합계 |
| :--- | ---: | ---: | ---: | ---: |
| **평상시** | 10 | 590 | 0 | 590 |
| **주의보** | 50 | 1,120 | 1,825 | 2,945 |
| **태풍 경보** | 100 | 2,743 | 3,100 | 5,843 |

* 모든 단계에서 요청 성공률 100%와 실패 요청 0건을 기록했습니다.
* 100 VU에서도 P95 응답시간은 약 51ms로 확인됐습니다.
* 10 VU에서는 연결 재사용 등의 영향으로 VM-A만 응답했으나, 50 VU부터는 VM-A와 VM-B가 모두 요청을 처리했습니다.
* VU가 증가할수록 P95 응답시간도 점진적으로 증가했습니다.

### 🔁 8.1 통합 부하 테스트 결과

10 → 50 → 100 VU 순서로 약 7분간 통합 부하 테스트를 실행했습니다.

| 항목 | 측정 결과 |
| :--- | :--- |
| 총 요청 | 25,863건 |
| 성공률 | 100% |
| 실패 요청 | 0건 |
| 평균 응답시간 | 21.50ms |
| P95 응답시간 | 30.88ms |
| 최대 응답시간 | 1.05s |
| VM-A 처리 요청 | 9,891건 |
| VM-B 처리 요청 | 15,972건 |

`checks > 99%`, `P95 < 2s`, `실패율 < 1%`로 설정한 임계값을 모두 통과했습니다. 최대 100 VU까지 타임아웃 없이 서비스를 유지했으며, Load Balancer를 통해 두 VM이 요청을 분담하는 것도 확인했습니다.

---

## 📉 9. Azure Monitor 상세 관측 결과

부하 테스트 전후의 CPU 사용률과 Network In/Out을 Azure Monitor에서 비교하여 k6 사용자 관점 결과와 서버 자원 사용량의 상관관계를 확인했습니다.

### 🖥️ 9.1 VM-A (`vm-web-01`)

| 구간 | CPU | Network In | Network Out |
| :--- | ---: | ---: | ---: |
| 부하 전 | 0.3450% | 47.3 KiB | 60.1 KiB |
| 10 VU | 1.3850% | 141.6 KiB | 181.9 KiB |
| 50 VU | 1.9800% | 767.6 KiB | 989.6 KiB |
| 100 VU | 3.9600% | 1.1 MiB | 1.5 MiB |
| 통합 부하 대표값 | 4.1700% | 900.7 KiB | 1.1 MiB |

요청 증가에 따라 CPU와 네트워크 송수신량이 함께 증가했습니다. 100 VU 구간의 CPU 사용률은 부하 전 대비 약 11.5배였으며, 통합 부하에서는 약 4.17%까지 관측됐습니다.

### 🖥️ 9.2 VM-B (`vm-web-02`)

| 구간 | CPU | Network In | Network Out |
| :--- | ---: | ---: | ---: |
| 부하 전 | 0.2700% | 49.2 KiB | 62.3 KiB |
| 10 VU | 0.2500% | 46.5 KiB | 59.4 KiB |
| 50 VU | 2.4500% | 1.0 MiB | 1.3 MiB |
| 100 VU | 5.4650% | 1.6 MiB | 2.1 MiB |
| 통합 부하 대표값 | 6.5550% | 약 1.0 MiB | 2.0 MiB |

10 VU에서는 VM-B가 요청을 처리하지 않아 유휴 상태와 비슷한 지표를 보였습니다. 50 VU부터 CPU와 네트워크 사용량이 증가했고, 통합 부하에서 VM-B의 CPU가 6.555%로 관측됐습니다. 이는 VM-B가 VM-A보다 더 많은 요청을 처리한 k6 결과와 일치합니다.

---

## 🔥 10. CPU 부하 실험 관측 결과

VM-A에 CPU 부하를 집중시킨 뒤 두 VM의 CPU 및 네트워크 지표 변화를 관측했습니다.

| 시각 | VM-A CPU | VM-B CPU |
| :--- | ---: | ---: |
| 17:23 | 53.0600% | 5.6950% |
| 17:24 | 49.8500% | 2.2200% |

| 시각 | VM-A Network In | VM-A Network Out | VM-B Network In | VM-B Network Out |
| :--- | ---: | ---: | ---: | ---: |
| 17:23 | 1.3 MiB | 2.1 MiB | 801.2 KiB | 1.3 MiB |
| 17:24 | 850.3 KiB | 1.3 MiB | 1.4 MiB | 2.2 MiB |

CPU 부하가 집중된 VM-A는 최대 53.06%까지 상승했으며, VM-B의 CPU는 상대적으로 낮게 유지됐습니다. 같은 구간에서 VM-B의 네트워크 사용량 증가도 관찰되어, 부하 상황에서 다른 백엔드가 요청 처리에 참여하는 흐름을 확인했습니다.

> **검증 범위**: 위 결과는 Azure Monitor의 서버 자원 관측값입니다. CPU 부하 실험의 성공률, 평균·P95 응답시간, 실패 요청 수 및 VM별 응답 수는 k6 결과 원본과 함께 추가 검증이 필요합니다.

---

## 🔀 11. VM 전체 장애 전환 타임라인

VM-A를 강제로 중지하고 API 응답을 지속적으로 모니터링하여 VM-B 단독 처리와 VM-A 복구 후 재합류 과정을 확인했습니다.

| 시각 | 관측 사건 |
| :--- | :--- |
| 17:06:27 | VM-A와 VM-B 정상 응답 |
| 17:06:28 | 최초 요청 실패 관측 |
| 17:06:33 | VM-B 응답 관측 |
| 17:06:49 | 연속 실패 구간 시작 |
| 17:07:29 | 연속 실패 구간 종료 |
| 17:07:33 | VM-B 단독 응답 안정화 |
| 17:08:34 | VM-A 재합류 확인 |

VM-A 강제 종료 기록은 `2026-07-27 17:07:15 KST`, 재시작 기록은 `2026-07-27 17:08:33 KST`입니다. VM 장애 후 Load Balancer가 VM-B로 요청을 전환했고, VM-B의 안정적인 단독 처리와 VM-A 복구 후 재분산을 확인했습니다.

다만 장애 감지와 전환 과정에서 일시적인 요청 실패가 발생했으므로 완전한 무중단 전환으로 볼 수는 없습니다. Health Probe의 검사 주기, 비정상 임계값 및 백엔드 제거 시간을 조정해 장애 감지 시간을 단축하는 개선이 필요합니다.

---

## ✅ 12. 추가 검증 사항 및 후속 과제

### 확인 완료

* Azure Linux VM 2대와 Load Balancer Backend Pool 연결
* NSG의 SSH 22번 및 HTTP 80번 포트 허용
* Load Balancer를 통한 `/health`, `/alerts` 정상 응답
* Nginx 80번 포트에서 FastAPI `127.0.0.1:8080`으로의 Reverse Proxy 연결
* VM-A의 `bsafe.service` 실행, 활성화 및 `Restart=always` 설정
* `/health` 30회 호출 시 VM-A 15회, VM-B 15회 응답
* 단계별·통합 부하 테스트 성공률 100%
* VM-A 장애 시 VM-B 단독 처리 및 VM-A 복구 후 재합류

### 추가 증빙 필요

* VM-B의 `systemctl status bsafe.service` 및 `systemctl is-enabled bsafe.service` 실행 화면
* CPU 부하 실험의 k6 결과 원본
* VM 장애 실험의 k6 결과 원본
* Azure VM-A 중지·시작 Activity Log
* VM 중지 요청 시각과 실제 중지 완료 시각의 구분

### ⚠️ 프로세스 장애 실험 해석 주의

초기 프로세스 장애 실험에서 사용한 `sudo pkill -f uvicorn`은 실제 실행 프로세스인 `/usr/bin/python3 /home/azureuser/project/app.py`를 종료하지 못했고, 당시 `NRestarts=0`으로 확인됐습니다. 따라서 이 실행만으로는 systemd 자동 복구가 성공했다고 단정할 수 없습니다.

systemd 자동 복구를 정확히 증명하려면 실제 FastAPI 프로세스 PID를 종료한 뒤 다음 항목을 함께 확인해야 합니다.

1. 종료 전후 PID 변경
2. `NRestarts` 값 증가
3. `journalctl -u bsafe.service` 재시작 로그
4. 장애 구간의 `/health`, `/alerts` 응답 및 k6 측정 결과

---

## 🏁 13. 최종 검증 요약

B-SAFE는 부산 태풍 경보 상황을 가정하여 10 → 50 → 100 VU의 요청 증가를 재현했습니다. 통합 부하 테스트에서 총 25,863건을 성공률 100%, P95 30.88ms로 처리했으며, Azure Monitor를 통해 요청 증가에 따른 VM-A와 VM-B의 CPU 및 네트워크 변화를 확인했습니다.

CPU 부하 실험에서는 VM-A CPU가 최대 53.06%까지 상승했고, VM 전체 장애 실험에서는 VM-B로의 전환과 VM-A 복구 후 재합류를 확인했습니다. 동시에 VM 장애 감지 과정에서 일시적인 요청 실패가 발생한다는 한계도 발견했으며, 향후 Health Probe 설정 개선과 장애 실험별 k6 원본 결과 확보를 통해 고가용성 검증의 정확도를 높일 수 있습니다.
