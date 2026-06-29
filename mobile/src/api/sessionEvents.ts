type UnauthorizedHandler = () => void | Promise<void>

let unauthorizedHandler: UnauthorizedHandler | null = null

export function registerUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler
}

export function notifyUnauthorized() {
  if (!unauthorizedHandler) return
  void Promise.resolve(unauthorizedHandler()).catch(() => {
    // Session teardown should not block error propagation to callers.
  })
}
