export type AsyncStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'empty'
  | 'error'
  | 'offline'
  | 'retrying'

export type AsyncResourceState<T> = {
  status: AsyncStatus
  data: T | null
  error: string | null
  errorKind: string | null
  updatedAt: number | null
  fromCache: boolean
}
