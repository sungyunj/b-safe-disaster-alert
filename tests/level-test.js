// 환경 변수(TEST_VUS, TEST_DURATION)를 활용해, 10 VU, 50 VU, 100 VU 등 원하는 특정 단계만 콕 집어서 원하는 시간 동안 단독 테스트를 돌릴 때 사용하는 유연한(Flexible) 테스트 스크립트
// 전체 7분짜리 시나리오(disaster-scenario.js)를 돌리기 전에, "100 VU일 때만 1분 동안 모니터링해 볼까?" 또는 "50 VU일 때 CPU 반응이 어떤지 잠깐 볼까?"처럼 특정 부하 단계만 단독으로 가볍고 신속하게 테스트할 때 사용

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const vmAResponses = new Counter('vm_a_responses');
const vmBResponses = new Counter('vm_b_responses');
const unknownResponses = new Counter('unknown_responses');

// 환경 변수를 활용한 동적 옵션 설정 (가장 중요!)
const BASE_URL = __ENV.BASE_URL || 'http://20.249.156.9';
const TEST_VUS = Number(__ENV.TEST_VUS || 10);
const TEST_DURATION = __ENV.TEST_DURATION || '1m';

export const options = {
    vus: TEST_VUS,            // 실행 시 넘겨받은 동시 접속자 수 (기본값: 10)
    duration: TEST_DURATION,  // 실행 시 넘겨받은 테스트 시간 (기본값: 1분)

    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<2000'],
        checks: ['rate>0.99'],
    },
};

export default function () {
    const response = http.get(`${BASE_URL}/alerts`);

    // disaster-scenario.js에 비해 '응답시간이 2초 미만이다'라는 개별 요청 수준의 시간 체크 항목 추가
    // 효과: 전체 통계뿐만 아니라, 매 요청 개별 단위로도 2초(2000ms)를 넘기는 딜레이가 발생하는지 실시간으로 추적할 수 있음
    check(response, {
        'HTTP 상태코드가 200이다': (res) => res.status === 200,
        '응답시간이 2초 미만이다': (res) =>
            res.timings.duration < 2000, // 추가된 항목
        '응답에 served_by가 있다': (res) =>
            res.status === 200 &&
            typeof res.body === 'string' &&
            res.body.includes('served_by'),
    });

    try {
        const body = response.json();
        const server = String(body.served_by || '').toLowerCase();

        if (
            server.includes('alert-server-a') ||
            server.includes('server-a') ||
            server.includes('vm-a')
        ) {
            vmAResponses.add(1);
        } else if (
            server.includes('alert-server-b') ||
            server.includes('server-b') ||
            server.includes('vm-b')
        ) {
            vmBResponses.add(1);
        } else {
            unknownResponses.add(1);
        }
    } catch (error) {
        unknownResponses.add(1);
    }

    sleep(1);
}
