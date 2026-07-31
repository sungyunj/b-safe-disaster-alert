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
