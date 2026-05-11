import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/due-products')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/due-products"!</div>
}
