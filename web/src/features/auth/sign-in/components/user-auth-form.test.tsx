import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserAuthForm } from './user-auth-form'

const FORM_MESSAGES = {
  usernameEmpty: 'Please enter your username.',
  passwordEmpty: 'Please enter your password.',
  passwordShort: 'Password must be at least 7 characters long.',
} as const

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setUser: vi.fn(),
  setAccessToken: vi.fn(),
  setRefreshToken: vi.fn(),
}))

vi.mock('@/stores/auth-store', () => {
  const mockUseAuthStore = (selector: (state: any) => any) => {
    const fakeState = {
      auth: {
        setUser: mocks.setUser,
        setAccessToken: mocks.setAccessToken,
        setRefreshToken: mocks.setRefreshToken,
      },
    }
    return selector(fakeState)
  }
  mockUseAuthStore.getState = () => ({
    auth: {
      setUser: mocks.setUser,
      setAccessToken: mocks.setAccessToken,
      setRefreshToken: mocks.setRefreshToken,
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
    login: vi.fn((payload) =>
      Promise.resolve({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        user: {
          id: 1,
          username: payload.username,
          role: 'admin',
        },
      })
    ),
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    Link: ({
      children,
      to,
      className,
      ...rest
    }: {
      children?: React.ReactNode
      to: string
      className?: string
    }) => (
      <a href={to} className={className} {...rest}>
        {children}
      </a>
    ),
  }
})

vi.mock('@/lib/utils', async (orig) => ({
  ...(await orig()),
  sleep: vi.fn(() => Promise.resolve()),
}))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

describe('UserAuthForm', () => {
  describe('Rendering without redirectTo', () => {
    let screen: RenderResult
    let usernameInput: Locator
    let passwordInput: Locator
    let signInButton: Locator

    beforeEach(async () => {
      vi.clearAllMocks()
      screen = await render(
        <QueryClientProvider client={queryClient}>
          <UserAuthForm />
        </QueryClientProvider>
      )
      usernameInput = screen.getByPlaceholder('admin')
      passwordInput = screen.getByPlaceholder('********')
      signInButton = screen.getByRole('button', { name: /^Sign in$/i })
    })

    it('renders fields and submit button', async () => {
      await expect.element(usernameInput).toBeInTheDocument()
      await expect.element(passwordInput).toBeInTheDocument()
      await expect.element(signInButton).toBeInTheDocument()
    })

    it('shows validation messages when submitting empty form', async () => {
      await userEvent.click(signInButton)

      await expect
        .element(screen.getByText(FORM_MESSAGES.usernameEmpty))
        .toBeInTheDocument()
      await expect
        .element(screen.getByText(FORM_MESSAGES.passwordEmpty))
        .toBeInTheDocument()
    })

    it('authenticates and navigates to default route on success', async () => {
      await userEvent.fill(usernameInput, 'a@b.com')
      await userEvent.fill(passwordInput, '1234567')

      await userEvent.click(signInButton)

      await vi.waitFor(() => expect(mocks.setUser).toHaveBeenCalledOnce())
      expect(mocks.setUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'a@b.com',
          role: 'admin',
          id: expect.any(Number),
        })
      )
      expect(mocks.setAccessTokenMock || mocks.setAccessToken).toHaveBeenCalledOnce()
      expect(mocks.setAccessTokenMock || mocks.setAccessToken).toHaveBeenCalledWith('mock-access-token')

      await vi.waitFor(() =>
        expect(mocks.navigate).toHaveBeenCalledWith({ to: '/dashboard', replace: true })
      )
    })
  })

  it('navigates to redirectTo when provided', async () => {
    vi.clearAllMocks()

    const { getByPlaceholder, getByRole } = await render(
      <QueryClientProvider client={queryClient}>
        <UserAuthForm redirectTo='/settings' />
      </QueryClientProvider>
    )

    await userEvent.fill(getByPlaceholder('admin'), 'a@b.com')
    await userEvent.fill(getByPlaceholder('********'), '1234567')

    await userEvent.click(getByRole('button', { name: /Sign in/i }))

    await vi.waitFor(() => expect(mocks.setUser).toHaveBeenCalledOnce())
    expect(mocks.setAccessToken).toHaveBeenCalledOnce()

    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/settings',
        replace: true,
      })
    )
  })
})
