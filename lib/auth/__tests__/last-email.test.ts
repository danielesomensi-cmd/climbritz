import { LAST_EMAIL_KEY, getLastEmail, saveLastEmail } from '../last-email';

describe('last-email (B-AUTH-PERSIST)', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('returns undefined when nothing is stored', () => {
    expect(getLastEmail()).toBeUndefined();
  });

  it('round-trips the email under the documented key', () => {
    saveLastEmail('climber@example.com');
    expect(localStorage.getItem(LAST_EMAIL_KEY)).toBe('climber@example.com');
    expect(getLastEmail()).toBe('climber@example.com');
  });

  it('trims and ignores blank values (a sign-out never erases the email)', () => {
    saveLastEmail('  climber@example.com ');
    saveLastEmail(undefined);
    saveLastEmail(null);
    saveLastEmail('   ');
    expect(getLastEmail()).toBe('climber@example.com');
  });

  it('never throws when storage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => saveLastEmail('climber@example.com')).not.toThrow();
    expect(getLastEmail()).toBeUndefined();
  });

  it('stores nothing but the email', () => {
    saveLastEmail('climber@example.com');
    expect(localStorage.length).toBe(1);
  });
});
