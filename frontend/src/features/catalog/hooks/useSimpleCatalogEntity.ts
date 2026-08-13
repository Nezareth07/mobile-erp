import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SimpleEntity, SimpleEntityApi } from '../types/simpleEntity'

export function useSimpleCatalogEntity<T extends SimpleEntity>(
  queryKey: string,
  entityApi: SimpleEntityApi<T>,
) {
  const queryClient = useQueryClient()
  const key = ['catalog', queryKey]

  const listQuery = useQuery({
    queryKey: key,
    queryFn: entityApi.list,
  })

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: key })
  }

  const createMutation = useMutation({
    mutationFn: entityApi.create,
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      entityApi.update(id, { name }),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: entityApi.remove,
    onSuccess: invalidate,
  })

  return { listQuery, createMutation, updateMutation, deleteMutation }
}
