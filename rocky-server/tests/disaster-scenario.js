import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const vmAResponses = new Counter('vm_a_responses');
const vmBResponses = new Counter('vm_b_responses');
const unknownResponses = new Counter('unknown_responses');

export const options = {
    stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },

        { duration: '30s', target: 50 },
        { duration: '1m', target: 50 },

        { duration: '30s', target: 100 },
        { duration: '3m', target: 100 },

        { duration: '30s', target: 0 },
    ],

    thresholds: {
        checks: ['rate>0.99'],
        http_req_duration: ['p(95)<2000'],
        http_req_failed: ['rate<0.01'],
    },
};

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
    } else {
        unknownResponses.add(1);
    }

    sleep(1);
}
