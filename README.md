# 🚨 B-SAFE : 고가용성(HA) 부산 재난 알림 서비스
> **Azure Load Balancer 및 Nginx, FastAPI, systemd 기반의 서버 장애 극복 및 고가용성 검증 프로젝트**

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=FastAPI&logoColor=white)](#)
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
웹 백엔드 코드, Nginx 및 systemd 설정 파일, k6 부하 테스트 스크립트 및 증빙 자료를 보관합니다.

```text
.
├── app.py                      # [FastAPI] 백엔드 재난 알림 API 및 Uvicorn 실행 코드 (127.0.0.1:8080)
├── config/                     # [설정] 서버 및 인프라 자동화 설정 파일 모음
│   ├── bsafe.nginx             # ➔ [Nginx] 80번 포트 Reverse Proxy 설정 파일
│   └── bsafe.service           # ➔ [systemd] FastAPI 자동 실행 및 장애 자동 복구 설정 파일
├── tests/                      # [k6] 부하 및 장애 테스트 스크립트 및 결과 모음
│   ├── disaster-scenario.js    # ➔ [메인] 재난 단계별(10->50->100 VU) 종합 장애 실험 스크립트
│   ├── load-test.js            # ➔ 표준 단계별 부하 테스트 및 정확한 서버 카운팅 스크립트
│   ├── level-test.js           # ➔ 특정 VU 수치 동적 지정 단독 테스트 스크립트
│   ├── test.js                 # ➔ k6 환경 및 네트워크 기본 통신 점검용 스크립트
│   └── results/                # ➔ [결과] k6 부하/장애 테스트 및 CPU 과부하 실험 결과 파일 모음 (txt 등)
├── docs/                       # [문서] 프로젝트 아키텍처 및 화면 증빙 자료
│   └── images/                 # ➔ Azure NSG, Health Probe, Azure Monitor 지표 등 캡처본 저장
└── README.md                   # [문서] 프로젝트 개요, 아키텍처 및 HA 장애 실험 결과 문서
```

#### 2) 🖥️ DCA 렉 서버 환경 구조 (Test Execution Node)
k6 부하 테스트 도구가 설치되어 Azure Load Balancer로 부하를 주입하고 테스트 결과를 수집하는 리눅스 실행 환경입니다.

```text
/root/
├── bsafe-k6/                   # [k6] 테스트 수행 및 결과 보관 디렉토리
│   ├── disaster-scenario.js    # ➔ [메인] 재난 단계별(10->50->100 VU) 종합 장애 실험 스크립트
│   ├── load-test.js            # ➔ 표준 단계별 부하 테스트 및 서버 카운팅 스크립트
│   ├── level-test.js           # ➔ 특정 VU 수치 동적 지정 단독 테스트 스크립트
│   ├── test.js                 # ➔ k6 설치 및 네트워크 기본 통신 점검용 스크립트
│   └── results/                # ➔ k6 실행 결과 요약(summary.json) 및 로그 자동 저장 폴더
├── app.py                      # [백엔드] 실행 테스트용 FastAPI 코드
├── /etc/systemd/system/
│   └── bsafe.service           # ➔ [systemd] FastAPI 프로세스 상시 가동 및 장애 자동 복구 서비스
├── anaconda-ks.cfg             # [시스템] Linux OS 설치 자동 설정 파일 (무시)
└── initial-setup-ks.cfg        # [시스템] Linux OS 초기 설정 기록 파일 (무시)
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

> 📸 **Azure 인프라 설정 증빙 문서**:
> * [Backend Pool 및 VM 연결 상태](docs/images/01_backend_pool.png)
> * [Health Probe (/health, 5초) 상세 설정](docs/images/02_health_probe.png)
> * [NSG 80, 22 허용 및 8080 차단 규칙](docs/images/03_nsg_rules.png)

---

## 🛠️ 4. API 엔드포인트 명세 (API Endpoints)

| Method | Endpoint | Description | Response Example |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Health Probe 및 인프라 상태 점검용 | `{"status": "healthy", "served_by": "alert-server-a"}` |
| `GET` | `/alerts` | 부산 재난 경보 실시간 알림 API | *(아래 예시 참고)* |

### 📄 `/alerts` 응답 예시
```json
{
  "region": "부산광역시",
  "alert_level": "태풍 경보",
  "message": "해안가와 하천 주변 접근을 피하십시오.",
  "rocky_api_status": "running",
  "served_by": "alert-server-a",
  "timestamp": "2026-07-23T13:57:46.348242"
}
```

---

## 🧪 5. 장애 실험 시나리오 및 측정 지표 (HA Experiments)

부하 테스트 도구인 **k6**를 활용해 재난 단계별 트래픽을 주입하면서 3가지 장애 시나리오를 연출하고 지표를 정량 측정합니다.

### 🌪️ 재난 단계별 트래픽 시나리오
1. **평상시**: 10 VU (Virtual Users) (일반 재난 정보 조회)
2. **주의보**: 50 VU (호우·강풍 예보)
3. **재난 경보**: 100 VU (태풍 상륙 및 침수 발생)
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

## 📊 6. Azure Monitor 관측 지표 (Server Metrics)

k6 부하 테스트 및 장애 실험 진행 시 Azure Portal 지표(Metrics)를 통해 인프라 관점의 상태 변화를 추적했습니다.

| 관측 지표 | 캡처 이미지 예시 | 설명 |
| :--- | :--- | :--- |
| **VM CPU Percentage** | `![CPU](docs/images/azure_cpu.png)` | `stress-ng` 실행 시 CPU 100% 스파이크 관측 |
| **Health Probe Status** | `![Probe](docs/images/azure_probe.png)`| VM-A Down 시 Health Probe 실패 감지 관측 |
| **Network In/Out Total** | `![Network](docs/images/azure_network.png)`| 100 VU 피크 부하 유입 시 네트워크 트래픽 증가 |

---
