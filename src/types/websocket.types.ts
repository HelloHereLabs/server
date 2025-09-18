// 위치정보 최신화 요청 (온라인 상태 확인) / 30초 배치 (S → C)
export interface UpdateUserLocation {
  action: 'updateUserLocation';
  data: {}; // 클라이언트에게 위치 정보 요청
}

// 위치정보 최신화 완료 안내 (C → S)
export interface UpdateUserLocationSuccess {
  action: 'updateUserLocationSuccess';
  data: {
    userId: string; // sender → userId (더 직관적)
    latitude?: number;  // 좌표 정보 optional 추가
    longitude?: number; // 좌표 정보 optional 추가
    updatedAt?: string; // 갱신 시각
  };
}