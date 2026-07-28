import http from 'k6/http';
import { check } from 'k6';

export default function () {
    const response = http.get('https://test.k6.io');

    check(response, {
        '응답 상태가 200이다': (res) => res.status === 200,
    });
}
