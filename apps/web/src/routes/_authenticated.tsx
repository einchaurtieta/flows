import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  component: Layout,
  beforeLoad: async () => {
    const { isAuthenticated } = await auth();

    if (!isAuthenticated) {
      throw redirect({
        to: "/auth/$"
      })
    }
  }
})

function Layout() {
  return (
    <div>
      {/* <h1>This is a layout file</h1> */}
      <Outlet />
    </div>
  )
}

