import { useQuery } from '@tanstack/react-query'
import { listPermissions } from '../api'

const PERMISSIONS_KEY = ['administration', 'permissions']

export function usePermissionsQuery() {
  return useQuery({
    queryKey: PERMISSIONS_KEY,
    queryFn: listPermissions,
  })
}
