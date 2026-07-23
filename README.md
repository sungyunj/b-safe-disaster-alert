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