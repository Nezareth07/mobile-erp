import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppRouter } from './app/router'
import { shouldRetryQuery } from './lib/queryRetry'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  )
}

export default App
