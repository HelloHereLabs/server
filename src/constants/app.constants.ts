export const LANGUAGES = [
  'English',
  'Korean',
  'Japanese',
  'Chinese',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Russian',
  'Portuguese',
  'Arabic',
  'Hindi',
  'Vietnamese',
  'Thai',
  'Indonesian',
  'Turkish',
] as const;

export const INTERESTS = [
  'K-POP',
  'K-DRAMA',
  'K-FOOD',
  'HISTORY',
  'HANBOK',
  'TAEKWONDO',
  'K-BEAUTY',
  'LANGUAGE',
] as const;

export const PURPOSES = [
  'Language Exchange',
  'Travel Companion',
  'Professional Networking',
  'Cultural Learning',
  'Friendship',
  'Study Partner',
  'Business Collaboration',
  'Hobby Sharing',
] as const;

// 타입 정의
export type Language = typeof LANGUAGES[number];
export type Interest = typeof INTERESTS[number];
export type Purpose = typeof PURPOSES[number];

// 검증 함수들
export const isValidLanguage = (language: string): language is Language => {
  return LANGUAGES.includes(language as Language);
};

export const isValidInterest = (interest: string): interest is Interest => {
  return INTERESTS.includes(interest as Interest);
};

export const isValidPurpose = (purpose: string): purpose is Purpose => {
  return PURPOSES.includes(purpose as Purpose);
};

export const validateInterests = (interests: string[]): interests is Interest[] => {
  return interests.every(interest => isValidInterest(interest));
};