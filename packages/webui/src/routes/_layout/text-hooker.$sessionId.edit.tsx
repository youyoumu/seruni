import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/text-hooker/$sessionId/edit')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_layout/text-hooker/$sessionId/edit"!</div>
}
