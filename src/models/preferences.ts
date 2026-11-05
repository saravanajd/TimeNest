export type UserPreferences = {
  timeZone: string;
  workdayStart: string;
  workdayEnd: string;
  aiEnabled: boolean;
  reminderTime: string | null;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  timeZone: 'America/Chicago',
  workdayStart: '16:00',
  workdayEnd: '01:00',
  aiEnabled: false,
  reminderTime: null,
};
