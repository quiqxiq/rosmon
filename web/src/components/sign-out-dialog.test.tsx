import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SignOutDialog } from './sign-out-dialog'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  reset: vi.fn(),
  MOCK_HREF: 'https://app.test/dashboard?tab=1',
}))

vi.mock('@/stores/auth-store', () => {
  const mockUseAuthStore = (selector: (state: any) => any) => {
    const fakeState = {
      auth: {
        reset: mocks.reset,
        refreshToken: 'mock-refresh-token',
      },
    }
    return selector(fakeState)
  }
  mockUseAuthStore.getState = () => ({
    auth: {
      reset: mocks.reset,
      refreshToken: 'mock-refresh-token',
    },
  })
  return {
    useAuthStore: mockUseAuthStore,
  }
})

vi.mock('@/features/auth/api/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/auth/api/service')>()
  return {
    ...actual,
    logout: vi.fn(() => Promise.resolve()),
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ href: mocks.MOCK_HREF }),
  }
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

describe('SignOutDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls auth.reset and navigates to sign-in with current location as redirect', async () => {
    const { getByRole } = await render(
      <QueryClientProvider client={queryClient}>
        <SignOutDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )

    await userEvent.click(getByRole('button', { name: /^Sign out$/i }))

    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/sign-in',
      search: { redirect: mocks.MOCK_HREF },
      replace: true,
    })
  })

  it('does not call reset or navigate when Cancel is clicked', async () => {
    const { getByRole } = await render(
      <QueryClientProvider client={queryClient}>
        <SignOutDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )

    await userEvent.click(getByRole('button', { name: /^Cancel$/i }))

    expect(mocks.reset).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
