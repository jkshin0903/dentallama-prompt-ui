# DentalLama Prompt UI

간결하고 직관적인 프롬프트 기반 채팅 UI입니다.

## 💬 채팅 기능 (간략)

- 핵심 흐름: 질문 입력 → 서버가 응답을 스트리밍으로 전송 → 화면에 실시간 표시
- 모델 전환: OpenAI, Google, Anthropic, Groq, Ollama 등 여러 모델을 UI에서 선택
- 도구 연동: 검색/크롤링 등 도구 호출을 통해 더 정확한 답변 제공
- 기록/공유(옵션): Redis(Upstash/로컬)로 대화 기록 저장 및 결과 공유 지원
- 게이트웨이 프록시(옵션): `CHAT_GATEWAY_URL` 설정 시 `/api/chat`을 외부 게이트웨이로 프록시하여 그대로 스트리밍

환경변수 요약

- 필수: `OPENAI_API_KEY`, `TAVILY_API_KEY`
- 선택: `NEXT_PUBLIC_CHAT_GATEWAY_URL`, `NEXT_PUBLIC_ENABLE_SAVE_CHAT_HISTORY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 등

자세한 설정과 배포는 `docs/CONFIGURATION.md`, `docs/DEPLOYMENT_VERCEL.md` 참고.
