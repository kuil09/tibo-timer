export const COPY = Object.freeze({
  status: Object.freeze({
    pending: '해석 대기',
    complete: '3개 모델 일치',
    unresolved: '모델 해석 불일치',
    error: '해석 재확인 필요',
    source_only: '원문만 제공'
  }),
  analysis: Object.freeze({
    pending: '새 발언 해석 대기',
    up_to_date: '최신 수집 발언 확인 완료',
    unresolved: '일치하지 않은 해석이 있습니다',
    error: '모델 응답 오류 · 예정 시각 확정 안 함',
    missing_key: '운영 설정 확인 필요',
    daily_limit: '무료 호출 한도 도달 · 다음 UTC 날짜에 재개',
    retry_pending: '모델 응답 재시도 대기',
    source_unavailable: '최신 원문 확인 실패',
    running: '세 모델이 발언을 해석 중'
  }),
  hero: Object.freeze({
    banked_reset_label: '추가 리셋권',
    reset_label: '최근 리셋 공지',
    approximate_suffix: '경',
    deadline_suffix: ' 이전',
    countdown_suffix: ' 남음',
    notes: Object.freeze({
      elapsed: '예정 시각 경과는 실제 리셋 완료를 뜻하지 않습니다.',
      completed: '발언에 따른 안내입니다. 개인 계정의 실제 리셋 여부는 확인하지 않습니다.',
      stale: '이전 데이터는 아래에 남겨두되, 현재 예정 시각으로 안내하지 않습니다.',
      pending: '새 발언의 해석이 확인되기 전에는 이전 예정 시각을 현재 일정으로 표시하지 않습니다.',
      default: '예정 시각은 실제 계정의 리셋을 보장하지 않습니다.'
    })
  }),
  page: Object.freeze({
    timezone_prefix: '표시 시간대: ',
    timezone_suffix: ' · 기기 설정 기준',
    freshness_prefix: '마지막 수집 성공: ',
    freshness_suffix: ' · 약 20분 간격으로 확인',
    no_successful_collection: '아직 수집에 성공한 발언이 없습니다.',
    analysis_prefix: 'AI: ',
    model_unavailable: '모델 이용 불가 · 확인 필요',
    no_recent_posts: '최근 24시간의 수집된 발언이 없습니다.',
    needs_review: '확인 필요',
    banked_reset_granted: '추가 리셋권 지급',
    usage_reset: '사용량 리셋',
    conditional_notice: '조건부 공지',
    time_unknown: '시각 미정',
    separator: ' · ',
    model_details: '모델별 확인 내용',
    not_reset_notice: '리셋 공지가 아님',
    no_model_response: '응답을 확인하지 못함',
    load_failure_title: '최신 정보를 불러오지 못했습니다',
    load_failure_note: '연결이 복구되면 다시 확인합니다. 이전 시각을 현재 일정으로 안내하지 않습니다.'
  })
});
