import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const vmAResponses = new Counter('vm_a_responses');
const vmBResponses = new Counter('vm_b_responses');
const unknownResponses = new Counter('unknown_responses');

const BASE_URL = __ENV.BASE_URL || 'http://20.249.156.9';
const TEST_VUS = Number(__ENV.TEST_VUS || 10);
const TEST_DURATION = __ENV.TEST_DURATION || '1m';

export const options = {
    vus: TEST_VUS,
    duration: TEST_DURATION,

    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<2000'],
        checks: ['rate>0.99'],
    },
};

export default function () {
    const response = http.get(`${BASE_URL}/alerts`);

    check(response, {
        'HTTP 상태코드가 200이다': (res) => res.status === 200,
        '응답시간이 2초 미만이다': (res) =>
            res.timings.duration < 2000,
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
