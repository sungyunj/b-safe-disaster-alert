// 렉 서버에서 "k6 패키지가 에러 없이 잘 설치되었는지, 렉 서버에서 외부 인터넷 연결이 잘 되는지" 환경 점검용으로 초기에 돌려보는 기본 예제

// VU(가상 사용자) 지정 없음 (기본 1 VU, 1회 실행):
// options나 stages가 없어, 단 1명의 가상 사용자가 1번만 요청을 보내고 바로 종료됨.
// 외부 샘플 서버 타겟팅 (https://test.k6.io):
// 우리 Azure Load Balancer(20.249.156.9)가 아니라 k6 제공 샘플 웹사이트로 연결

import http from 'k6/http';
import { check } from 'k6';

export default function () {
    // k6 공식 샘플 테스트 웹사이트로 요청
    const response = http.get('https://test.k6.io');

    check(response, {
        '응답 상태가 200이다': (res) => res.status === 200,
    });
}
