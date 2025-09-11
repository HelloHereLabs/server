# Foreigner-Citizen Matching Service

외국인과 시민 간의 매칭 및 대화 서비스

## 개요

외국인 관광객과 현지 시민을 연결하여 언어 교환, 관광 가이드, 문화 교류를 돕는 매칭 서비스입니다.

## 주요 기능

- 🔐 **인증 시스템**: JWT 기반 토큰 인증
- 👥 **사용자 관리**: 외국인/시민 사용자 프로필 관리
- 📍 **위치 기반 매칭**: GPS 기반 근처 사용자 찾기
- 💬 **실시간 채팅**: 매칭된 사용자 간 실시간 대화
- 📊 **로그 및 통계**: 안전 필터링 및 사용 통계
- 🛡️ **안전 필터**: AI 기반 불안전 콘텐츠 필터링

## 기술 스택

- **Backend**: NestJS, TypeScript
- **Authentication**: JWT
- **Documentation**: Swagger
- **Deployment**: AWS Lambda (Serverless)

## API 엔드포인트

### 인증
- `POST /auth/start` - 세션 시작 및 토큰 발급

### 사용자
- `POST /users` - 사용자 생성
- `GET /users/:id` - 사용자 조회
- `GET /users/nearby/:latitude/:longitude` - 근처 사용자 조회
- `PATCH /users/:id/location` - 위치 업데이트
- `PATCH /users/:id/deactivate` - 사용자 비활성화

### 채팅
- `POST /chat/rooms` - 채팅방 생성
- `GET /chat/rooms` - 채팅방 목록 조회
- `POST /chat/message` - 메시지 전송
- `GET /chat/history/:roomId` - 채팅 기록 조회
- `GET /chat/my-messages` - 내 메시지 조회

### 로그 및 통계
- `POST /logs` - 로그 생성
- `GET /logs/user/:userId` - 사용자별 로그
- `GET /logs/room/:roomId` - 채팅방별 로그
- `GET /logs/unsafe` - 안전하지 않은 로그
- `GET /logs/risk-level/:level` - 위험도별 로그
- `GET /logs/stats` - 통계 조회
- `DELETE /logs/:id` - 로그 삭제

## 개발 환경 설정

### 설치
```bash
npm install
```

### 개발 서버 실행
```bash
npm run start:dev
```

### 빌드
```bash
npm run build
```

### 테스트
```bash
npm run test
```

## API 문서

개발 서버 실행 후 다음 URL에서 Swagger 문서를 확인할 수 있습니다:
- http://localhost:3000/api

## 배포

```bash
npm run serverless:deploy
```

## 라이센스

MIT License