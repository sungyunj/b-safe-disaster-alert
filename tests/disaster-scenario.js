// 재난 단계(평상시 -> 주의보 -> 경보)별로 트래픽을 단계적으로 올려 100 VU 피크 부하를 유발하고, 그 사이 응답이 VM-A에서 왔는지 VM-B에서 왔는지 개수를 따로 카운팅하면서 성공률 및 지연 시간을 검증하는 메인 테스트 스크립트

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// k6 기본 지표 외에, "어느 가상머신이 응답했는가?" 를 추적하기 위한 카운터 생성
const vmAResponses = new Counter('vm_a_responses'); // VM-A가 응답한 횟수 누적
const vmBResponses = new Counter('vm_b_responses'); // VM-B가 응답한 횟수 누적
const unknownResponses = new Counter('unknown_responses'); // 장애 발생 등으로 응답 파싱할 수 없거나 실패한 횟수 누적

export const options = {
    // 부하 시나리오 단계
    // 총 7분 동안 진행, target: 100으로 3분간 유지되는 구간에서 kill -9, stress-ng, VM Down 등 인위적 장애 실험을 진행하도록 설계
    stages: [
        { duration: '30s', target: 10 },        // [1단계: 평상시] 30초 동안 10 VU까지 워밍업
        { duration: '1m', target: 10 },         // 1분간 10 VU 유지 (일반 재난 정보 조회)

        { duration: '30s', target: 50 },        // [2단계: 주의보] 30초 동안 50 VU로 급증
        { duration: '1m', target: 50 },         // 1분간 50 VU 유지 (호우/강풍 예보)

        { duration: '30s', target: 100 },       // [3단계: 재난 경보] 30초 동안 100 VU로 최고조 상승
        { duration: '3m', target: 100 },        // 3분간 100 VU 유지 (장애 유발 실험 진행 구간)

        { duration: '30s', target: 0 },         // [4단계: 종료] 30초 동안 트래픽 감소 후 종료
    ],

    // 성공/실패 합격 기준
    // 테스트가 끝난 후, 위 기준을 충족했는지 k6 리포트 상단에 [✓] 또는 [✗] 표시로 통과 여부를 알려줌
    thresholds: {
        checks: ['rate>0.99'],           // 검증 항목(200 OK 등) 성공률이 99% 이상일 것
        http_req_duration: ['p(95)<2000'],   // 상위 95% 응답 속도가 2000ms(2초) 이내일 것
        http_req_failed: ['rate<0.01'],      // 전체 요청 실패율이 1% 미만일 것
    },
};

// 요청 및 응답 검증
// 역할: Load Balancer의 대표 IP(20.249.156.9)의 /alerts 엔드포인트로 GET 요청을 보냄
// 체크 사항: HTTP 200 응답 여부와, 응답 JSON에 어떤 VM이 처리했는지 보여주는 served_by 키가 존재하는지 확인
export default function () {
    const baseUrl = __ENV.BASE_URL || 'http://20.249.156.9';
    const response = http.get(`${baseUrl}/alerts`, {
        timeout: '60s',
    });

    check(response, {
        'HTTP 상태 코드가 200이다': (res) =>
            res.status === 200,

        '응답에 served_by가 있다': (res) =>
            res.status === 200 &&
            typeof res.body === 'string' &&
            res.body.includes('served_by'),
    });

    if (
        response.status === 200 &&
        typeof response.body === 'string' &&
        response.body.length > 0
    ) {
        // 서버별 응답 분기 카운팅 로직 (핵심)
        // 역할: FastAPI가 응답해 준 JSON의 served_by 문자열(alert-server-a 또는 alert-server-b)을 파싱
        // 효과: 테스트 완료 후 결과 창에 "VM-A: 5,420번 / VM-B: 5,398번" 같이 Azure Load Balancer가 부하를 분산시켰음을 증명
        try {
            const body = response.json();
            const server = String(body.served_by || '').toLowerCase();

            if (
                server.includes('alert-server-a') ||
                server.includes('server-a') ||
                server.includes('vm-a')
            ) {
                vmAResponses.add(1);        // VM-A 카운터 +1
            } else if (
                server.includes('alert-server-b') ||
                server.includes('server-b') ||
                server.includes('vm-b')
            ) {
                vmBResponses.add(1);        // VM-B 카운터 +1
            } else {
                unknownResponses.add(1);
            }
        } catch (error) {
            unknownResponses.add(1);
        }
    } else {
        unknownResponses.add(1);
    }

    sleep(1);
}
