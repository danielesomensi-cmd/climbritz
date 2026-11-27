import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const pushMock = jest.fn();
const replaceMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const providerProps = jest.fn();
jest.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children, ...props }: { children: React.ReactNode }) => {
    providerProps(props);
    return <div>{children}</div>;
  },
  useUser: () => ({ isSignedIn: false, user: null }),
}));

import ClerkSpaProvider, { toAppPath } from '../ClerkSpaProvider';

describe('ClerkSpaProvider (B-AUTH-PERSIST)', () => {
  const original = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    providerProps.mockClear();
    pushMock.mockClear();
    replaceMock.mockClear();
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = original;
  });

  it('lets Clerk navigate on the iOS capacitor:// origin', () => {
    // Without this clerk-js rewrites every in-app redirect to "/", which made
    // the "Sign up" link bounce back to /sign-in on iOS.
    render(
      <ClerkSpaProvider>
        <span data-testid="child" />
      </ClerkSpaProvider>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(providerProps.mock.calls[0][0].allowedRedirectProtocols).toContain('capacitor:');
  });

  it('sends an origin-only redirect to the home page, not to ""', () => {
    // iOS post-sign-in target is `capacitor://app.climbritz.app` (empty path):
    // clerk-js strips the origin and calls the router with "".
    render(
      <ClerkSpaProvider>
        <span />
      </ClerkSpaProvider>,
    );
    const { routerPush, routerReplace } = providerProps.mock.calls[0][0];
    routerPush('');
    routerReplace('');
    routerPush('/sign-up');
    expect(pushMock).toHaveBeenNthCalledWith(1, '/');
    expect(replaceMock).toHaveBeenCalledWith('/');
    expect(pushMock).toHaveBeenNthCalledWith(2, '/sign-up');
  });

  it('toAppPath always yields an absolute in-app path', () => {
    expect(toAppPath('')).toBe('/');
    expect(toAppPath('/')).toBe('/');
    expect(toAppPath('/discover/detail?id=1')).toBe('/discover/detail?id=1');
    expect(toAppPath('?redirect=1')).toBe('/?redirect=1');
  });
});
