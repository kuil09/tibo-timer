export const COPY = Object.freeze({
  hero: Object.freeze({
    titles: Object.freeze({
      stale: '최신 공지를 확인할 수 없습니다',
      pending: '새 공지를 확인 중입니다',
      cancelled: '최근 리셋 공지가 취소되었습니다',
      completed: '최근 공지에서 리셋을 알렸습니다',
      conditional: '조건부 리셋 공지입니다',
      unknown: '예정 시각이 없습니다',
      elapsed: '공지된 예정 시각이 지났습니다',
      scheduled_banked: '추가 리셋권 지급 예정',
      scheduled_reset: '사용량 리셋 예정',
      empty: '새로운 리셋 공지가 없습니다'
    }),
    approximate_suffix: '경',
    deadline_suffix: ' 이전',
    countdown_suffix: ' 남음'
  }),
  history: Object.freeze({
    separator: ' · ',
    pending: '판정 대기 중',
    none: '리셋 공지 아님',
    conditional: '조건부 리셋 공지',
    unknown: '예정 시각 없음',
    scheduled_reset: '사용량 리셋 예정',
    scheduled_banked: '추가 리셋권 지급 예정',
    elapsed_reset: '공지된 사용량 리셋 시각이 지났습니다',
    elapsed_banked: '공지된 추가 리셋권 지급 시각이 지났습니다',
    completed_reset: '사용량 리셋 완료 공지',
    completed_banked: '추가 리셋권 지급 완료 공지',
    cancelled_reset: '사용량 리셋 공지 취소',
    cancelled_banked: '추가 리셋권 지급 공지 취소'
  }),
  page: Object.freeze({
    no_recent_posts: '최근 발언이 없습니다.',
    load_failure_title: '최신 공지를 확인할 수 없습니다'
  })
});
