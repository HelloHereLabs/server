// 클라이언트 주도적 위치 정보 업데이트 (C → S)
export interface UpdateLocationMessage {
  action: 'updateLocation';
  data: {
    latitude: number;
    longitude: number;
    updatedAt?: string;
  };
}

// 위치정보 최신화 완료 안내 (C → S) - 기존 호환성 유지
export interface UpdateUserLocationSuccess {
  action: 'updateUserLocationSuccess';
  data: {
    userId: string; // sender → userId (더 직관적)
    latitude?: number;  // 좌표 정보 optional 추가
    longitude?: number; // 좌표 정보 optional 추가
    updatedAt?: string; // 갱신 시각
  };
}