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

---

## 🛠️ 3. API 엔드포인트 명세 (API Endpoints)

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

## 🧪 4. 장애 실험 시나리오 및 측정 지표 (HA Experiments)

부하 테스트 도구인 **k6**를 활용해 지속적인 트래픽을 주입하면서 3가지 장애 시나리오를 연출하고 지표를 정량 측정합니다.

### 🌪️ 트래픽 및 장애 시나리오
1. **평상시**: 10 VU (Virtual Users) (일반 재난 정보 조회)
2. **주의보**: 50 VU (호우-강풍 예보)
3. **재난 경보**: 100 VU (태풍 상륙 및 침수 발생)
4. **장애 발생**: 100 VU 상태에서 인위적 장애 유발
   * **실험 A**: FastAPI 프로세스 강제 종료 (`kill -9`) ➔ systemd 자동 복구
   * **실험 B**: VM-A 전체 중단 ➔ Load Balancer의 VM-B로의 Failover
   * **실험 C**: `stress-ng`를 이용한 CPU 과부하 연출 ➔ 지연 시간 변화 측정

### 📊 정량적 검증 지표 표 (Results)

| 측정 지표 | 목표 기준 | 실험 결과 | 비고 |
| :--- | :--- | :--- | :--- |
| **정상 요청 성공률** | 100% | `__ %` | 정상 트래픽 구간 |
| **장애 구간 성공률** | 99% 이상 | `__ %` | 장애 발생 시 트래픽 유실률 |
| **평균 / P95 응답 속도** | - | `__ / __ ms` | Latency 분석 |
| **systemd 복구 시간** | 3초 이내 | `__ 초` | 프로세스 자동 재시작 |
| **VM 전환 (Failover) 시간** | - | `__ 초` | LB Health Probe 감지 |
| **VM 재합류 (Failback) 시간** | - | `__ 초` | VM 복구 후 트래픽 재합류 |

---