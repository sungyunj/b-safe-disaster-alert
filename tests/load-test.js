// disaster-scenario.js와 99% 동일한 구조를 가진 초기/표준 부하 테스트 버전
// 10 VU -> 50 VU -> 100 VU의 동일한 재난 단계별 부하 시나리오를 수행하지만, 카운팅 조건이 엄격하고 명확하게 작성된 기본 부하 테스트 스크립트
// disaster-scenario.js와 부하 방식(stages)과 검증 기준(thresholds)은 완전히 똑같지만, 응답을 파싱하여 카운팅하는 방식에서 차이점

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const serverAResponses = new Counter('server_a_responses');
const serverBResponses = new Counter('server_b_responses');
const unknownResponses = new Counter('unknown_responses');

export const options = {
    stages: [
        // 평상시: 0 → 10 VU
        { duration: '30s', target: 10 },

        // 평상시 유지
        { duration: '1m', target: 10 },

        // 주의보: 10 → 50 VU
        { duration: '30s', target: 50 },

        // 주의보 유지
        { duration: '1m', target: 50 },

        // 경보: 50 → 100 VU
        { duration: '30s', target: 100 },

        // 테스트를 켜고 약 2분 30초 후(100 VU 진입 후 30초 경과 시점)에 Azure Portal에서 VM-A를 Stop 시키거나 kill -9를 실행하라는 가이드 역할
        // 경보 및 장애 실험
        // 100 VU 도달 후 30초 뒤 VM-A 중지
        { duration: '3m', target: 100 },

        // 종료
        { duration: '30s', target: 0 },
    ],

    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<2000'],
        checks: ['rate>0.99'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://20.249.156.9';

export default function () {
    const response = http.get(`${BASE_URL}/alerts`);

    check(response, {
        'HTTP 상태가 200이다': (res) => res.status === 200,
        '응답 시간이 2초 미만이다': (res) =>
            res.timings.duration < 2000,
        'served_by 값이 있다': (res) =>
            res.body.includes('served_by'),
    });

    // 변수명 및 정확한 일치(Exact Match) 비교
    // app.py에서 SERVER_NAME 환경변수를 alert-server-a, alert-server-b로 지정해 두었기 때문에, load-test.js가 오탐 없이 훨씬 엄격하고 정확하게 서버별 트래픽을 분류해냄
    try {
        const body = response.json();
        const servedBy = body.served_by;

        if (servedBy === 'alert-server-a') {
            serverAResponses.add(1);
        } else if (servedBy === 'alert-server-b') {
            serverBResponses.add(1);
        } else {
            unknownResponses.add(1);
        }
    } catch (error) {
        unknownResponses.add(1);
    }

    sleep(1);
}
